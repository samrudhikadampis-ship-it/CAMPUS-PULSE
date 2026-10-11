import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config();

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import mysql, { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import {
  Department,
  Committee,
  EventItem,
  EventLink,
  Student,
  DeptSummary,
  Feedback
} from "./types.js";

const db: Pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: +(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "campuspulse",
  dateStrings: true,
  timezone: "+05:30",
  connectionLimit: 10,
  ...(process.env.DB_SSL?.toLowerCase() === "true"
    ? { ssl: { rejectUnauthorized: false } }
    : {})
});

const app = express();
app.use(cors());
app.use(express.json());

interface AppError extends Error {
  status?: number;
  sqlState?: string;
  sqlMessage?: string;
  code?: string;
}

const fail = (status: number, error: string): AppError =>
  Object.assign(new Error(error), { status });

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<any>;

const h = (fn: AsyncHandler) => (req: Request, res: Response, next: NextFunction) => {
  fn(req, res, next).catch((e: AppError) => {
    const status = e.status || (e.sqlState ? 400 : 500);
    res.status(status).json({ error: e.sqlMessage || e.message || e.code || "Unexpected API error" });
  });
};

const rows = async <T extends RowDataPacket[]>(sql: string, params: any[] = []): Promise<T> => {
  const [data] = await db.query<T>(sql, params);
  return data;
};

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// Committees
app.get("/api/committees", h(async (_req, res) => {
  const result = await rows<RowDataPacket[] & Committee[]>("SELECT * FROM committees ORDER BY name ASC");
  res.json(result);
}));

// Departments
app.get("/api/departments", h(async (_req, res) => {
  const result = await rows<RowDataPacket[] & Department[]>("SELECT * FROM departments ORDER BY dept_id ASC");
  res.json(result);
}));

// Department analytics summary
app.get("/api/dept-summary", h(async (_req, res) => {
  const result = await rows<RowDataPacket[] & DeptSummary[]>("SELECT * FROM dept_summary");
  res.json(result);
}));

// Events with calculated status and links
app.get("/api/events", h(async (_req, res) => {
  const ev = await rows<RowDataPacket[] & (EventItem & RowDataPacket)[]>(`
    SELECT es.*, v.name AS venue,
      (SELECT COUNT(*) FROM registrations r WHERE r.event_id = es.event_id) AS registered
    FROM event_status es
    LEFT JOIN venues v ON v.venue_id = es.venue_id
    ORDER BY BINARY es.status = BINARY 'done', es.start_ts ASC
  `);
  const links = await rows<RowDataPacket[] & EventLink[]>("SELECT * FROM event_links");
  const merged = ev.map((e) => ({
    ...e,
    links: links.filter((l) => l.event_id === e.event_id)
  }));
  res.json(merged);
}));

// Students
app.get("/api/students", h(async (_req, res) => {
  const students = await rows<RowDataPacket[] & Student[]>(`
    SELECT s.*, 
      (SELECT COUNT(*) FROM registrations r WHERE r.student_id = s.student_id) AS reg_count,
      (SELECT COUNT(*) FROM registrations r JOIN attendance a ON a.reg_id = r.reg_id WHERE r.student_id = s.student_id) AS att_count
    FROM students s
    ORDER BY s.student_id ASC
  `);
  res.json(students);
}));

app.post("/api/students", h(async (req, res) => {
  const b = req.body;
  if (!b.student_id || !b.first_name || !b.last_name || !b.division) {
    throw fail(400, "Fill ID, name and division");
  }
  await db.query(
    `INSERT INTO students (student_id, first_name, last_name, dept_id, study_year, division, phone, email, gender, dob)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      b.student_id,
      b.first_name,
      b.last_name,
      b.dept_id || "EXTC",
      b.study_year || "FE",
      b.division,
      b.phone || null,
      b.email || null,
      b.gender || null,
      b.dob || null
    ]
  );
  res.status(201).json({ ok: true });
}));

app.delete("/api/students/:id", h(async (req, res) => {
  await db.query("DELETE FROM students WHERE student_id = ?", [req.params.id]);
  res.json({ ok: true });
}));

// Student Registrations
app.get("/api/students/:id/registrations", h(async (req, res) => {
  const result = await rows<RowDataPacket[]>(
    `SELECT r.reg_id, r.registered_on, e.event_id, e.name, e.status AS event_status,
       p.payment_id, p.status AS pay_status, p.amount, p.txn_ref, p.method,
       a.attendance_id, a.check_in, a.check_out,
       c.cert_id, c.cert_type, c.issued_on,
       f.feedback_id, f.rating, f.comments
     FROM registrations r
     JOIN event_status e ON e.event_id = r.event_id
     LEFT JOIN payments p ON p.reg_id = r.reg_id
     LEFT JOIN attendance a ON a.reg_id = r.reg_id
     LEFT JOIN certificates c ON c.reg_id = r.reg_id
     LEFT JOIN feedback f ON f.reg_id = r.reg_id
     WHERE r.student_id = ?
     ORDER BY r.reg_id DESC`,
    [req.params.id]
  );
  res.json(result);
}));

// Atomic Registration + Payment Transaction
app.post("/api/registrations", h(async (req, res) => {
  const { student_id, event_id, txn_ref, method } = req.body;
  if (!student_id || !event_id) throw fail(400, "Student ID and Event ID are required");

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[ev]] = (await conn.query<RowDataPacket[]>("SELECT fee FROM events WHERE event_id = ?", [event_id])) as any;
    if (!ev) throw fail(404, "Event not found");

    if (ev.fee > 0 && (!txn_ref || txn_ref.trim().length < 6)) {
      throw fail(400, "Enter the transaction reference (6+ characters)");
    }

    const [r] = await conn.query<ResultSetHeader>(
      "INSERT INTO registrations (student_id, event_id) VALUES (?, ?)",
      [student_id, event_id]
    );

    if (ev.fee > 0) {
      await conn.query(
        "INSERT INTO payments (reg_id, txn_ref, method, amount) VALUES (?, ?, ?, ?)",
        [r.insertId, txn_ref.trim(), method || "UPI", ev.fee]
      );
    }

    await conn.commit();
    res.status(201).json({ reg_id: r.insertId });
  } catch (err: any) {
    await conn.rollback();
    if (err.code === "ER_DUP_ENTRY") {
      throw fail(409, "Already registered for this event");
    }
    throw err;
  } finally {
    conn.release();
  }
}));

// Desk Attendance Check-in & Check-out
app.post("/api/attendance/check-in", h(async (req, res) => {
  const { reg_id } = req.body;
  if (!reg_id) throw fail(400, "reg_id is required");
  await db.query("INSERT INTO attendance (reg_id) VALUES (?)", [reg_id]);
  res.json({ ok: true });
}));

app.post("/api/attendance/check-out", h(async (req, res) => {
  const { reg_id } = req.body;
  if (!reg_id) throw fail(400, "reg_id is required");
  await db.query("UPDATE attendance SET check_out = NOW() WHERE reg_id = ?", [reg_id]);
  res.json({ ok: true });
}));

// Payments management & verification
app.get("/api/payments", h(async (_req, res) => {
  const payments = await rows<RowDataPacket[]>(`
    SELECT p.*, r.student_id, s.first_name, s.last_name, e.name AS event_name
    FROM payments p
    JOIN registrations r ON r.reg_id = p.reg_id
    JOIN students s ON s.student_id = r.student_id
    JOIN events e ON e.event_id = r.event_id
    ORDER BY p.payment_id DESC
  `);
  res.json(payments);
}));

app.post("/api/payments/:id/verify", h(async (req, res) => {
  await db.query("UPDATE payments SET status = 'Verified' WHERE payment_id = ?", [req.params.id]);
  res.json({ ok: true });
}));

// Verified Feedback
app.get("/api/feedback", h(async (_req, res) => {
  const feedbackList = await rows<RowDataPacket[]>(`
    SELECT f.*, r.student_id, s.first_name, s.last_name, e.name AS event_name
    FROM feedback f
    JOIN registrations r ON r.reg_id = f.reg_id
    JOIN students s ON s.student_id = r.student_id
    JOIN events e ON e.event_id = r.event_id
    ORDER BY f.feedback_id DESC
  `);
  res.json(feedbackList);
}));

app.post("/api/feedback", h(async (req, res) => {
  const { reg_id, rating, comments } = req.body;
  if (!reg_id || !rating) throw fail(400, "reg_id and rating are required");
  await db.query("INSERT INTO feedback (reg_id, rating, comments) VALUES (?, ?, ?)", [
    reg_id,
    rating,
    comments || null
  ]);
  res.status(201).json({ ok: true });
}));

// Automated Certificates Engine (Stored Procedure)
app.post("/api/admin/issue-certificates", h(async (_req, res) => {
  const [r] = await db.query<any[]>("CALL issue_certificates()");
  res.json(r[0][0] || { issued: 0 });
}));

app.get("/api/certificates", h(async (_req, res) => {
  const certs = await rows<RowDataPacket[]>(`
    SELECT c.*, r.student_id, s.first_name, s.last_name, s.dept_id, s.study_year, s.division,
           e.name AS event_name, e.committee_id, cm.name AS committee_name
    FROM certificates c
    JOIN registrations r ON r.reg_id = c.reg_id
    JOIN students s ON s.student_id = r.student_id
    JOIN events e ON e.event_id = r.event_id
    JOIN committees cm ON cm.committee_id = e.committee_id
    ORDER BY c.cert_id DESC
  `);
  res.json(certs);
}));

// Committee Follows
app.get("/api/follows/:student_id", h(async (req, res) => {
  const follows = await rows<RowDataPacket[]>(
    "SELECT committee_id FROM committee_follows WHERE student_id = ?",
    [req.params.student_id]
  );
  res.json(follows.map((f: any) => f.committee_id));
}));

app.post("/api/follows", h(async (req, res) => {
  const { student_id, committee_id } = req.body;
  if (!student_id || !committee_id) throw fail(400, "student_id and committee_id required");
  await db.query(
    "INSERT IGNORE INTO committee_follows (student_id, committee_id) VALUES (?, ?)",
    [student_id, committee_id]
  );
  res.json({ ok: true });
}));

app.delete("/api/follows", h(async (req, res) => {
  const { student_id, committee_id } = req.body;
  await db.query(
    "DELETE FROM committee_follows WHERE student_id = ? AND committee_id = ?",
    [student_id, committee_id]
  );
  res.json({ ok: true });
}));

// Event Alerts
app.get("/api/alerts/:student_id", h(async (req, res) => {
  const alerts = await rows<RowDataPacket[]>(
    "SELECT event_id, set_at FROM event_alerts WHERE student_id = ?",
    [req.params.student_id]
  );
  res.json(alerts);
}));

app.post("/api/alerts", h(async (req, res) => {
  const { student_id, event_id } = req.body;
  if (!student_id || !event_id) throw fail(400, "student_id and event_id required");
  await db.query("INSERT IGNORE INTO event_alerts (student_id, event_id) VALUES (?, ?)", [
    student_id,
    event_id
  ]);
  res.json({ ok: true });
}));

app.delete("/api/alerts", h(async (req, res) => {
  const { student_id, event_id } = req.body;
  await db.query("DELETE FROM event_alerts WHERE student_id = ? AND event_id = ?", [
    student_id,
    event_id
  ]);
  res.json({ ok: true });
}));

const PORT = +(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log(`⚡ CampusPulse TypeScript API running on http://localhost:${PORT}`);
});
