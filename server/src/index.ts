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
import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";
import {
  Department,
  Committee,
  EventItem,
  EventLink,
  Student,
  DeptSummary
} from "./types.js";

const scrypt = promisify(scryptCallback);
const SESSION_HOURS = 8;
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
    ? { ssl: {} }
    : {})
});

type Role = "admin" | "student" | "committee";
interface AuthContext {
  account_id: number;
  username: string;
  role: Role;
  student_id: string | null;
  committee_id: string | null;
  first_name?: string;
  last_name?: string;
  dept_id?: string;
  study_year?: string;
  division?: string;
  email?: string | null;
  is_active?: number;
  department_verified?: number;
  approval_status?: "Pending" | "Approved" | "Rejected";
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "32kb" }));

const fail = (status: number, error: string): Error & { status: number } =>
  Object.assign(new Error(error), { status });
type AppError = Error & {
  status?: number;
  code?: string;
};
type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;
const h = (fn: AsyncHandler) => (req: Request, res: Response, next: NextFunction) => {
  fn(req, res, next).catch((e: AppError) => {
    if (e.status) return res.status(e.status).json({ error: e.message });
    if (e.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "This record already exists." });
    if (e.code === "ER_NO_REFERENCED_ROW_2" || e.code === "ER_CHECK_CONSTRAINT_VIOLATED") {
      return res.status(400).json({ error: "The submitted values are invalid." });
    }
    console.error("API request failed:", e);
    res.status(500).json({ error: "The request could not be completed. Please try again." });
  });
};

const rows = async <T extends RowDataPacket[]>(sql: string, params: unknown[] = []): Promise<T> => {
  const [data] = await db.query<T>(sql, params);
  return data;
};
const requiredText = (value: unknown, label: string, max: number): string => {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw fail(400, `${label} is required and must be at most ${max} characters.`);
  }
  return value.trim();
};
const optionalText = (value: unknown, max: number): string | null => {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > max) throw fail(400, "A text field is too long.");
  return value.trim();
};
const positiveInt = (value: unknown, label: string): number => {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) throw fail(400, `${label} must be a positive whole number.`);
  return n;
};
const dateTimeValue = (value: unknown, label: string): string | null => {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?$/.test(value)) {
    throw fail(400, `${label} must be a valid date and time.`);
  }
  const normalized = value.replace("T", " ");
  const canonical = normalized.length === 16 ? `${normalized}:00` : normalized;
  const iso = new Date(`${canonical.replace(" ", "T")}Z`);
  if (Number.isNaN(iso.getTime()) || iso.toISOString().slice(0, 19).replace("T", " ") !== canonical) {
    throw fail(400, `${label} must be a valid date and time.`);
  }
  return canonical;
};
const registrationStatusValue = (value: unknown): boolean => {
  if (value === undefined) return true;
  if (typeof value !== "boolean") throw fail(400, "Registration open must be true or false.");
  return value;
};
const validEmail = (value: unknown): string | null => {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || value.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw fail(400, "Enter a valid email address.");
  }
  return value.trim().toLowerCase();
};

async function passwordHash(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}
async function passwordMatches(password: string, stored: string): Promise<boolean> {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(key, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const token = req.get("authorization")?.match(/^Bearer ([\da-f]{64})$/i)?.[1];
  if (!token) return res.status(401).json({ error: "Please sign in to continue." });
  h(async (request, response, done) => {
    const session = await rows<RowDataPacket[] & AuthContext[]>(
      `SELECT a.account_id, a.username, a.role, a.student_id, a.committee_id,a.approval_status,
              COALESCE(a.first_name,s.first_name) AS first_name,
              COALESCE(a.last_name,s.last_name) AS last_name,
              s.dept_id,s.study_year,s.division,COALESCE(a.email,s.email) AS email,
              s.is_active,s.department_verified
       FROM auth_sessions x JOIN user_accounts a ON a.account_id = x.account_id
       LEFT JOIN students s ON s.student_id = a.student_id
       WHERE x.session_id = ? AND x.expires_at > NOW()`,
      [tokenHash(token)]
    );
    const user = session[0];
    if (!user || (user.role === "student" && !user.is_active)) {
      response.status(401).json({ error: "Your session has expired or your account is inactive. Sign in again." });
      return;
    }
    if (user.role === "committee" && user.approval_status !== "Approved") {
      response.status(403).json({ error: "This committee account is awaiting superadmin approval." });
      return;
    }
    request.auth = user;
    done();
  })(req, res, next);
};
const requireRole = (...roles: Role[]) => (req: Request, res: Response, next: NextFunction) => {
  if (!req.auth) return res.status(401).json({ error: "Please sign in to continue." });
  if (!roles.includes(req.auth.role)) return res.status(403).json({ error: "You are not authorized to perform this action." });
  next();
};
const requireAdmin = [requireAuth, requireRole("admin")];
const requireStudent = [requireAuth, requireRole("student")];
const requireCommitteeManager = [requireAuth, requireRole("admin", "committee")];

const committeeScope = (req: Request): string => {
  const requested = req.auth?.role === "committee"
    ? req.auth.committee_id
    : req.query.committee_id ?? req.body?.committee_id;
  const committeeId = requiredText(requested, "Committee", 15).toUpperCase();
  if (req.auth?.role === "committee" && committeeId !== req.auth.committee_id) {
    throw fail(403, "This account can only access its assigned committee.");
  }
  return committeeId;
};

async function bootstrapAdmin(): Promise<void> {
  const username = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!username && !password) {
    console.warn("Admin bootstrap is disabled: configure ADMIN_EMAIL and ADMIN_PASSWORD.");
    return;
  }
  if (!username || !password || !validEmail(username) || password.length < 12) {
    throw new Error("Configure a valid ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters.");
  }
  await db.query(
    "INSERT IGNORE INTO user_accounts (username, password_hash, role) VALUES (?, ?, 'admin')",
    [username, await passwordHash(password)]
  );
}

// Login always requires an explicit portal. Student identity is loaded from the authoritative student row.
app.post("/api/auth/login", h(async (req, res) => {
  const role = req.body?.role;
  const username = requiredText(req.body?.username, "Username or email", 120).toLowerCase();
  const password = requiredText(req.body?.password, "Password", 256);
  if (!["admin", "student"].includes(role)) throw fail(400, "Choose a valid sign-in portal.");
  const rolePredicate = role === "admin" ? "a.role IN ('admin','committee')" : "a.role = ?";
  const account = await rows<RowDataPacket[] & (AuthContext & { password_hash: string })[]>(
    `SELECT a.account_id,a.username,a.password_hash,a.role,a.student_id,a.committee_id,a.approval_status,
            COALESCE(a.first_name,s.first_name) AS first_name,
            COALESCE(a.last_name,s.last_name) AS last_name,
            s.dept_id,s.study_year,s.division,COALESCE(a.email,s.email) AS email,
            s.is_active,s.department_verified
     FROM user_accounts a LEFT JOIN students s ON s.student_id = a.student_id
     WHERE (a.username = ? OR (a.role = 'student' AND LOWER(s.email) = ?)) AND ${rolePredicate}`,
    role === "admin" ? [username, username] : [username, username, role]
  );
  const user = account[0];
  if (!user || !(await passwordMatches(password, user.password_hash))) {
    throw fail(401, "The sign-in details are incorrect or this account is inactive.");
  }
  if (user.role === "committee" && user.approval_status !== "Approved") {
    throw fail(403, "This committee account is awaiting superadmin approval.");
  }
  if (user.role === "student" && !user.is_active) {
    throw fail(401, "The sign-in details are incorrect or this account is inactive.");
  }
  const token = randomBytes(32).toString("hex");
  await db.query("INSERT INTO auth_sessions (session_id, account_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR))", [
    tokenHash(token), user.account_id, SESSION_HOURS
  ]);
  const { password_hash: _passwordHash, ...profile } = user;
  res.json({ token, user: profile, expires_in: SESSION_HOURS * 3600 });
}));

app.get("/api/auth/me", requireAuth, h(async (req, res) => {
  res.json({ user: req.auth });
}));

app.post("/api/auth/logout", requireAuth, h(async (req, res) => {
  const token = req.get("authorization")!.slice(7);
  await db.query("DELETE FROM auth_sessions WHERE session_id = ?", [tokenHash(token)]);
  res.json({ ok: true });
}));

app.patch("/api/students/:id/department-verification", ...requireAdmin, h(async (req, res) => {
  if (typeof req.body?.verified !== "boolean") throw fail(400, "Provide a department verification status.");
  const [result] = await db.query<ResultSetHeader>(
    "UPDATE students SET department_verified=? WHERE student_id=?",
    [req.body.verified, req.params.id]
  );
  if (!result.affectedRows) throw fail(404, "Student not found.");
  res.json({ ok: true });
}));

// Public catalog data; registration availability is computed from live database counts.
app.get("/api/committees", h(async (_req, res) => {
  res.json(await rows<RowDataPacket[] & Committee[]>("SELECT * FROM committees ORDER BY name ASC"));
}));
app.get("/api/departments", h(async (_req, res) => {
  res.json(await rows<RowDataPacket[] & Department[]>("SELECT * FROM departments ORDER BY dept_id ASC"));
}));
app.get("/api/venues", h(async (_req, res) => {
  res.json(await rows<RowDataPacket[]>("SELECT venue_id,name FROM venues ORDER BY name ASC"));
}));
app.get("/api/events", requireAuth, h(async (req, res) => {
  const committeeFilter = req.auth!.role === "committee" ? "WHERE es.committee_id=?" : "";
  const events = await rows<RowDataPacket[] & (EventItem & RowDataPacket)[]>(`
    SELECT es.*, v.name AS venue, es.capacity, es.registration_open, es.registration_closes_at,
      es.eligible_dept_id, es.registration_question,
      (SELECT COUNT(*) FROM registrations r WHERE r.event_id = es.event_id AND r.status = 'Confirmed') AS registered
    FROM event_status es LEFT JOIN venues v ON v.venue_id = es.venue_id
    ${committeeFilter}
    ORDER BY BINARY es.status = BINARY 'done', es.start_ts ASC
  `, req.auth!.role === "committee" ? [req.auth!.committee_id] : []);
  const links = await rows<RowDataPacket[] & EventLink[]>("SELECT * FROM event_links");
  res.json(events.map((e) => ({
    ...e,
    remaining: e.capacity == null ? null : Math.max(0, Number(e.capacity) - Number(e.registered)),
    links: links.filter((link) => link.event_id === e.event_id)
  })));
}));

app.get("/api/students", ...requireAdmin, h(async (req, res) => {
  const status = req.query.status;
  if (status && status !== "active" && status !== "inactive" && status !== "all") {
    throw fail(400, "Status must be active, inactive, or all.");
  }
  const clause = status === "active" ? "WHERE s.is_active = 1" :
    status === "inactive" ? "WHERE s.is_active = 0" : "";
  res.json(await rows<RowDataPacket[] & Student[]>(`
    SELECT s.*,
      (SELECT COUNT(*) FROM registrations r WHERE r.student_id = s.student_id) AS reg_count,
      (SELECT COUNT(*) FROM registrations r JOIN attendance a ON a.reg_id = r.reg_id WHERE r.student_id = s.student_id) AS att_count
    FROM students s ${clause} ORDER BY s.student_id ASC
  `));
}));

const validateStudent = async (body: any, includePassword: boolean, minimumPasswordLength = 12) => {
  const student_id = requiredText(body.student_id, "Student ID", 20).toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9._/-]*$/.test(student_id)) {
    throw fail(400, "Student ID may contain only letters, numbers, periods, underscores, slashes, and hyphens.");
  }
  const first_name = requiredText(body.first_name, "First name", 50);
  const last_name = requiredText(body.last_name, "Last name", 50);
  const dept_id = requiredText(body.dept_id, "Department", 10).toUpperCase();
  const study_year = body.study_year;
  if (!["FE", "SE", "TE", "BE"].includes(study_year)) throw fail(400, "Choose a valid study year.");
  const division = requiredText(body.division, "Division", 5);
  const email = validEmail(body.email);
  const phone = optionalText(body.phone, 15);
  if (phone && !/^\+?[0-9 ()-]{7,15}$/.test(phone)) throw fail(400, "Enter a valid phone number.");
  const gender = body.gender || null;
  if (gender && !["Female", "Male", "Other"].includes(gender)) throw fail(400, "Choose a valid gender.");
  const dob = body.dob || null;
  if (dob && (typeof dob !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dob) ||
      Number.isNaN(Date.parse(`${dob}T00:00:00Z`)) ||
      new Date(`${dob}T00:00:00Z`).toISOString().slice(0, 10) !== dob)) {
    throw fail(400, "Enter a valid date of birth.");
  }
  const depts = await rows<RowDataPacket[]>( "SELECT dept_id FROM departments WHERE dept_id = ?", [dept_id]);
  if (!depts.length) throw fail(400, "Choose a department from the department list.");
  let password_hash: string | null = null;
  if (includePassword) {
    const password = requiredText(body.password, "Initial student password", 256);
    if (password.length < minimumPasswordLength) {
      throw fail(400, `Student passwords must be at least ${minimumPasswordLength} characters.`);
    }
    password_hash = await passwordHash(password);
  }
  return { student_id, first_name, last_name, dept_id, study_year, division, phone, email, gender, dob, password_hash };
};

app.post("/api/auth/register-student", h(async (req, res) => {
  const firstName = requiredText(req.body?.first_name, "First name", 50);
  const lastName = requiredText(req.body?.last_name, "Last name", 50);
  const email = validEmail(req.body?.email);
  if (!email) throw fail(400, "Email is required.");
  const password = requiredText(req.body?.password, "Password", 256);
  if (password.length < 12) throw fail(400, "Passwords must be at least 12 characters.");
  const studentId = `CP-${randomBytes(6).toString("hex").toUpperCase()}`;
  const passwordHashValue = await passwordHash(password);
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `INSERT INTO students (student_id,first_name,last_name,email,department_verified)
       VALUES (?,?,?, ?,FALSE)`,
      [studentId,firstName,lastName,email]
    );
    await conn.query(
      `INSERT INTO user_accounts
        (username,password_hash,role,student_id,first_name,last_name,email,approval_status)
       VALUES (?,?,'student',?,?,?,?,'Approved')`,
      [email,passwordHashValue,studentId,firstName,lastName,email]
    );
    const [accounts] = await conn.query<RowDataPacket[]>(
      `SELECT a.account_id,a.username,a.role,a.student_id,a.committee_id,a.approval_status,
        s.first_name,s.last_name,s.dept_id,s.study_year,s.division,s.email,s.is_active,s.department_verified
       FROM user_accounts a JOIN students s ON s.student_id=a.student_id
       WHERE a.student_id=? AND a.role='student'`, [studentId]);
    const token = randomBytes(32).toString("hex");
    await conn.query(
      "INSERT INTO auth_sessions (session_id,account_id,expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR))",
      [tokenHash(token),accounts[0].account_id,SESSION_HOURS]
    );
    await conn.commit();
    res.status(201).json({ token,user:accounts[0] });
  } catch (error) {
    await conn.rollback();
    if ((error as any).code === "ER_DUP_ENTRY") {
      throw fail(409, "An account already exists for this email. Sign in instead.");
    }
    throw error;
  } finally {
    conn.release();
  }
}));

app.post("/api/auth/register-admin", h(async (req, res) => {
  const firstName = requiredText(req.body?.first_name, "First name", 50);
  const lastName = requiredText(req.body?.last_name, "Last name", 50);
  const email = validEmail(req.body?.email);
  if (!email) throw fail(400, "Email is required.");
  const password = requiredText(req.body?.password, "Password", 256);
  if (password.length < 12) throw fail(400, "Passwords must be at least 12 characters.");
  const committeeId = requiredText(req.body?.committee_id, "Committee", 15).toUpperCase();
  const committee = await rows<RowDataPacket[]>(
    "SELECT committee_id FROM committees WHERE committee_id=?", [committeeId]);
  if (!committee.length) throw fail(400, "Choose an existing committee.");
  try {
    await db.query(
      `INSERT INTO user_accounts
        (username,password_hash,role,committee_id,first_name,last_name,email,approval_status)
       VALUES (?,?, 'committee', ?,?,?,?,'Pending')`,
      [email,await passwordHash(password),committeeId,firstName,lastName,email]
    );
  } catch (error) {
    if ((error as AppError).code === "ER_DUP_ENTRY") throw fail(409, "An account already exists for this email.");
    throw error;
  }
  res.status(202).json({ ok: true, approval_status: "Pending" });
}));

app.post("/api/students", ...requireAdmin, h(async (req, res) => {
  const studentId = req.body?.student_id
    ? requiredText(req.body.student_id, "Student ID", 20).toUpperCase()
    : `CP-${randomBytes(6).toString("hex").toUpperCase()}`;
  const student = await validateStudent({ ...req.body, student_id: studentId }, true, 8);
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `INSERT INTO students
        (student_id, first_name, last_name, dept_id, study_year, division, phone, email, gender, dob, department_verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [student.student_id, student.first_name, student.last_name, student.dept_id, student.study_year,
        student.division, student.phone, student.email, student.gender, student.dob]
    );
    await conn.query(
      "INSERT INTO user_accounts (username, password_hash, role, student_id) VALUES (?, ?, 'student', ?)",
      [student.student_id, student.password_hash, student.student_id]
    );
    await conn.commit();
    res.status(201).json({ ok: true, student_id: student.student_id });
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}));

app.put("/api/students/:id", ...requireAdmin, h(async (req, res) => {
  const student = await validateStudent({ ...req.body, student_id: req.params.id }, false);
  let newPasswordHash: string | null = null;
  if ((req.body.password || "").length) {
    const password = requiredText(req.body.password, "Password", 256);
    if (password.length < 12) throw fail(400, "Student passwords must be at least 12 characters.");
    const account = await rows<RowDataPacket[]>(
      "SELECT role,student_id FROM user_accounts WHERE username=?", [student.student_id]);
    if (account.length && (account[0].role !== "student" || account[0].student_id !== student.student_id)) {
      throw fail(409, "The student ID conflicts with another account username.");
    }
    newPasswordHash = await passwordHash(password);
  }
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [updated] = await conn.query<ResultSetHeader>(
      `UPDATE students SET first_name=?,last_name=?,dept_id=?,study_year=?,division=?,phone=?,email=?,gender=?,dob=?,
        department_verified=TRUE
       WHERE student_id=?`,
      [student.first_name, student.last_name, student.dept_id, student.study_year, student.division,
        student.phone, student.email, student.gender, student.dob, student.student_id]);
    if (!updated.affectedRows) throw fail(404, "Student not found.");
    if (newPasswordHash) {
      await conn.query(
        `INSERT INTO user_accounts (username,password_hash,role,student_id) VALUES (?,?,'student',?)
         ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash)`,
        [student.student_id, newPasswordHash, student.student_id]);
      await conn.query(
        `DELETE x FROM auth_sessions x JOIN user_accounts a ON a.account_id=x.account_id
         WHERE a.student_id=? AND a.role='student'`, [student.student_id]);
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
  res.json({ ok: true });
}));

app.patch("/api/students/:id/status", ...requireAdmin, h(async (req, res) => {
  if (typeof req.body?.is_active !== "boolean") throw fail(400, "Provide an active status.");
  const [result] = await db.query<ResultSetHeader>("UPDATE students SET is_active=? WHERE student_id=?",
    [req.body.is_active, req.params.id]);
  if (!result.affectedRows) throw fail(404, "Student not found.");
  if (!req.body.is_active) {
    await db.query(`DELETE x FROM auth_sessions x JOIN user_accounts a ON a.account_id=x.account_id WHERE a.student_id=?`, [req.params.id]);
  }
  res.json({ ok: true });
}));

// Historical registrations must be preserved; hard deletion is deliberately unavailable.
app.delete("/api/students/:id", ...requireAdmin, h(async (_req, _res) => {
  throw fail(405, "Student records are deactivated, not deleted, so registration history is preserved.");
}));

app.get("/api/students/:id/registrations", requireAuth, h(async (req, res) => {
  const requestedId = req.params.id;
  if (req.auth!.role !== "admin" && req.auth!.student_id !== requestedId) {
    throw fail(403, "You can only view your own registrations.");
  }
  const result = await rows<RowDataPacket[]>(`
    SELECT r.reg_id, r.registered_on, r.application_answer, r.status AS registration_status,
      e.event_id, e.name, e.status AS event_status,
      e.committee_id, cm.name AS committee_name, p.payment_id, p.status AS pay_status, p.amount, p.txn_ref, p.method,
      a.attendance_id, a.check_in, a.check_out, c.cert_id, c.cert_type, c.issued_on,
      f.feedback_id, f.rating, f.comments
    FROM registrations r JOIN event_status e ON e.event_id=r.event_id
    JOIN committees cm ON cm.committee_id=e.committee_id
    LEFT JOIN payments p ON p.reg_id=r.reg_id LEFT JOIN attendance a ON a.reg_id=r.reg_id
    LEFT JOIN certificates c ON c.reg_id=r.reg_id LEFT JOIN feedback f ON f.reg_id=r.reg_id
    WHERE r.student_id=? ORDER BY r.reg_id DESC`, [requestedId]);
  res.json(result);
}));

app.get("/api/admin/registrations", ...requireCommitteeManager, h(async (req, res) => {
  const committeeId = committeeScope(req);
  res.json(await rows<RowDataPacket[]>(`
    SELECT reg_id,student_id,first_name,last_name,dept_id,email,phone,department_verified,
      event_id,name,committee_id,application_answer,registered_on,registration_status,
      pay_status,amount,check_in,check_out,cert_id
    FROM admin_student_signup_details WHERE committee_id=? ORDER BY reg_id DESC
  `, [committeeId]));
}));

app.delete("/api/admin/registrations/:id", ...requireCommitteeManager, h(async (req, res) => {
  const regId = positiveInt(req.params.id, "Registration");
  const committeeId = committeeScope(req);
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [registrations] = await conn.query<RowDataPacket[]>(
      `SELECT r.reg_id,r.status,e.committee_id FROM registrations r
       JOIN events e ON e.event_id=r.event_id WHERE r.reg_id=? FOR UPDATE`, [regId]);
    const registration = registrations[0];
    if (!registration || registration.committee_id !== committeeId) {
      throw fail(404, "Registration not found for this committee.");
    }
    if (registration.status !== "Confirmed") throw fail(409, "This registration is already cancelled.");
    await conn.query("UPDATE registrations SET status='Cancelled' WHERE reg_id=?", [regId]);
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
  res.json({ ok: true });
}));

app.post("/api/registrations", ...requireStudent, h(async (req, res) => {
  const eventId = positiveInt(req.body?.event_id, "Event");
  const studentId = req.auth!.student_id!;
  const conn = await db.getConnection();
  try {
    await conn.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
    await conn.beginTransaction();
    const [studentRows] = await conn.query<RowDataPacket[]>(
      "SELECT student_id, dept_id, is_active, department_verified FROM students WHERE student_id=? FOR UPDATE", [studentId]);
    const student = studentRows[0];
    if (!student || !student.is_active) throw fail(403, "Only active students can register.");
    const [eventRows] = await conn.query<RowDataPacket[]>(
      `SELECT e.event_id,e.committee_id,e.fee,e.capacity,e.registration_open,e.registration_closes_at,
              e.registration_question,
              e.eligible_dept_id,(e.registration_closes_at IS NOT NULL AND e.registration_closes_at <= NOW()) AS deadline_passed,
              (e.end_ts IS NOT NULL AND e.end_ts < NOW()) AS event_ended
       FROM events e WHERE e.event_id=? FOR UPDATE`, [eventId]);
    const event = eventRows[0];
    if (!event) throw fail(404, "Event not found.");
    if (!event.registration_open || event.deadline_passed || event.event_ended) {
      throw fail(409, "Registration for this event is closed.");
    }
    if (event.eligible_dept_id && !student.department_verified) {
      throw fail(403, "Your department must be verified by an administrator before registering for this event.");
    }
    if (event.eligible_dept_id && event.eligible_dept_id !== student.dept_id) {
      throw fail(403, "Your verified department is not eligible for this event.");
    }
    const [existingRegistrations] = await conn.query<RowDataPacket[]>(
      "SELECT status FROM registrations WHERE student_id=? AND event_id=?",
      [studentId,eventId]
    );
    if (existingRegistrations.length) {
      throw fail(409, existingRegistrations[0].status === "Confirmed"
        ? "You are already registered for this event."
        : "Your previous registration for this event was cancelled. Contact the committee for help.");
    }
    const [countRows] = await conn.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS registered FROM registrations WHERE event_id=? AND status='Confirmed'", [eventId]);
    if (event.capacity != null && Number(countRows[0].registered) >= Number(event.capacity)) {
      throw fail(409, "This event is full.");
    }
    const answer = optionalText(req.body?.application_answer, 2000);
    if (event.registration_question && !answer) throw fail(400, "Answer the required application question.");

    const [insert] = await conn.query<ResultSetHeader>(
      "INSERT INTO registrations (student_id,event_id,application_answer) VALUES (?,?,?)",
      [studentId, eventId, answer]);
    await conn.commit();
    res.status(201).json({ reg_id: insert.insertId });
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}));

app.post("/api/attendance/check-in", ...requireCommitteeManager, h(async (req, res) => {
  const regId = positiveInt(req.body?.reg_id, "Registration");
  const committeeId = committeeScope(req);
  const [registrations] = await db.query<RowDataPacket[]>(
    "SELECT r.reg_id FROM registrations r JOIN events e ON e.event_id=r.event_id WHERE r.reg_id=? AND e.committee_id=? AND r.status='Confirmed'",
    [regId, committeeId]);
  if (!registrations.length) throw fail(404, "Active registration not found for this committee.");
  await db.query("INSERT INTO attendance (reg_id) VALUES (?)", [regId]);
  res.json({ ok: true });
}));
app.post("/api/attendance/check-out", ...requireCommitteeManager, h(async (req, res) => {
  const regId = positiveInt(req.body?.reg_id, "Registration");
  const committeeId = committeeScope(req);
  const [result] = await db.query<ResultSetHeader>(
    `UPDATE attendance a JOIN registrations r ON r.reg_id=a.reg_id
     JOIN events e ON e.event_id=r.event_id SET a.check_out=NOW()
     WHERE r.reg_id=? AND e.committee_id=? AND a.check_out IS NULL`, [regId, committeeId]);
  if (!result.affectedRows) throw fail(409, "Attendance is missing or already checked out.");
  res.json({ ok: true });
}));

app.put("/api/admin/events/:id/attendance", ...requireCommitteeManager, h(async (req, res) => {
  const eventId = positiveInt(req.params.id, "Event");
  const regId = positiveInt(req.body?.reg_id, "Registration");
  if (typeof req.body?.attended !== "boolean") throw fail(400, "Attendance must be true or false.");
  const committeeId = committeeScope(req);
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [events] = await conn.query<RowDataPacket[]>(
      "SELECT committee_id,end_ts,end_ts IS NOT NULL AND end_ts<=NOW() AS completed FROM events WHERE event_id=? FOR UPDATE",
      [eventId]
    );
    const event = events[0];
    if (!event || event.committee_id !== committeeId) throw fail(404, "Event not found for this committee.");
    if (!event.completed) throw fail(409, "Attendance can be finalized after the event has ended.");
    const [registrations] = await conn.query<RowDataPacket[]>(
      "SELECT reg_id FROM registrations WHERE reg_id=? AND event_id=? AND status='Confirmed'",
      [regId,eventId]
    );
    if (!registrations.length) throw fail(404, "Confirmed registration not found for this event.");
    const [certificates] = await conn.query<RowDataPacket[]>(
      "SELECT cert_id FROM certificates WHERE reg_id=?", [regId]
    );
    if (certificates.length) throw fail(409, "Attendance is locked because a certificate has already been issued.");
    if (req.body.attended) {
      await conn.query("INSERT IGNORE INTO attendance (reg_id,status) VALUES (?,'Attended')", [regId]);
    } else {
      await conn.query("DELETE FROM attendance WHERE reg_id=?", [regId]);
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
  res.json({ ok: true });
}));

app.get("/api/payments", ...requireAdmin, h(async (_req, res) => {
  res.json(await rows<RowDataPacket[]>(`
    SELECT p.*,r.student_id,s.first_name,s.last_name,e.name AS event_name FROM payments p
    JOIN registrations r ON r.reg_id=p.reg_id JOIN students s ON s.student_id=r.student_id
    JOIN events e ON e.event_id=r.event_id ORDER BY p.payment_id DESC
  `));
}));
app.post("/api/payments/:id/verify", ...requireAdmin, h(async (req, res) => {
  const id = positiveInt(req.params.id, "Payment");
  const [result] = await db.query<ResultSetHeader>(
    "UPDATE payments SET status='Verified' WHERE payment_id=? AND status='Submitted'", [id]);
  if (!result.affectedRows) throw fail(404, "Pending payment not found.");
  res.json({ ok: true });
}));

app.get("/api/feedback", requireAuth, h(async (req, res) => {
  const role = req.auth!.role;
  let scope = "";
  const params: unknown[] = [];
  if (role === "student") {
    scope = "WHERE f.student_id=?";
    params.push(req.auth!.student_id);
  } else if (role === "committee") {
    scope = "WHERE f.committee_id=?";
    params.push(req.auth!.committee_id);
  } else if (role === "admin") {
    scope = "WHERE f.committee_id=?";
    params.push(committeeScope(req));
  } else {
    throw fail(403, "You are not authorized to view feedback.");
  }
  res.json(await rows<RowDataPacket[]>(`
    SELECT f.feedback_id,f.reg_id,f.student_id,s.first_name,s.last_name,
      f.committee_id,cm.name AS committee_name,f.event_id,e.name AS event_name,
      f.rating,f.comments,f.submitted_on
    FROM feedback f JOIN students s ON s.student_id=f.student_id
    LEFT JOIN events e ON e.event_id=f.event_id
    JOIN committees cm ON cm.committee_id=f.committee_id
    ${scope} ORDER BY f.feedback_id DESC`, params));
}));
app.post("/api/feedback", ...requireStudent, h(async (req, res) => {
  const committeeId = requiredText(req.body?.committee_id, "Committee", 15).toUpperCase();
  const requestId = requiredText(req.body?.request_id, "Submission ID", 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    throw fail(400, "Submission ID must be a valid UUID.");
  }
  const eventId = req.body?.event_id ? positiveInt(req.body.event_id, "Event") : null;
  const rating = Number(req.body?.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw fail(400, "Rating must be from 1 to 5.");
  const comments = requiredText(req.body?.comments, "Feedback message", 4000);
  const [committees] = await db.query<RowDataPacket[]>(
    "SELECT committee_id FROM committees WHERE committee_id=?", [committeeId]);
  if (!committees.length) throw fail(400, "Choose an existing committee.");
  if (eventId) {
    const [events] = await db.query<RowDataPacket[]>(
      "SELECT event_id FROM events WHERE event_id=? AND committee_id=?", [eventId,committeeId]);
    if (!events.length) throw fail(400, "The selected event does not belong to this committee.");
  }
  const [existing] = await db.query<RowDataPacket[]>(
    "SELECT feedback_id FROM feedback WHERE request_id=? AND student_id=?",
    [requestId,req.auth!.student_id]
  );
  if (existing.length) {
    res.json({ ok: true, feedback_id: existing[0].feedback_id, duplicate: true });
    return;
  }
  const [insert] = await db.query<ResultSetHeader>(
    `INSERT INTO feedback
      (reg_id,student_id,committee_id,event_id,request_id,rating,comments)
     VALUES (NULL,?,?,?,?,?,?)`,
    [req.auth!.student_id,committeeId,eventId,requestId,rating,comments]
  );
  res.status(201).json({ ok: true, feedback_id: insert.insertId });
}));

app.post("/api/admin/issue-certificates", ...requireCommitteeManager, h(async (req, res) => {
  const committeeId = committeeScope(req);
  const eventId = positiveInt(req.body?.event_id, "Event");
  const conn = await db.getConnection();
  let issued = 0;
  let skipped = 0;
  try {
    await conn.beginTransaction();
    const [events] = await conn.query<RowDataPacket[]>(
      "SELECT committee_id,end_ts,end_ts IS NOT NULL AND end_ts<=NOW() AS completed FROM events WHERE event_id=? FOR UPDATE",
      [eventId]
    );
    const event = events[0];
    if (!event || event.committee_id !== committeeId) throw fail(404, "Event not found for this committee.");
    if (!event.completed) throw fail(409, "Certificates can only be sent after an event is completed.");
    const [total] = await conn.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS count FROM registrations WHERE event_id=? AND status='Confirmed'", [eventId]
    );
    const [result] = await conn.query<ResultSetHeader>(
      `INSERT IGNORE INTO certificates (reg_id)
       SELECT r.reg_id FROM registrations r
       JOIN students s ON s.student_id=r.student_id AND s.is_active=1
       JOIN attendance a ON a.reg_id=r.reg_id
       WHERE r.event_id=? AND r.status='Confirmed'`,
      [eventId]
    );
    issued = result.affectedRows;
    skipped = Math.max(0, Number(total[0].count) - issued);
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
  res.json({ issued, skipped });
}));
app.get("/api/certificates", requireAuth, h(async (req, res) => {
  const scope = req.auth!.role === "student" ? "WHERE r.student_id=?" :
    req.auth!.role === "committee" ? "WHERE e.committee_id=?" :
      req.auth!.role === "admin" ? "WHERE e.committee_id=?" : "";
  if (!scope) throw fail(403, "You are not authorized to view certificates.");
  const params = req.auth!.role === "student" ? [req.auth!.student_id] :
    req.auth!.role === "committee" ? [req.auth!.committee_id] : [committeeScope(req)];
  res.json(await rows<RowDataPacket[]>(`
    SELECT c.*,r.student_id,s.first_name,s.last_name,s.dept_id,s.study_year,s.division,
      e.name AS event_name,e.committee_id,cm.name AS committee_name FROM certificates c
    JOIN registrations r ON r.reg_id=c.reg_id JOIN students s ON s.student_id=r.student_id
    JOIN events e ON e.event_id=r.event_id JOIN committees cm ON cm.committee_id=e.committee_id
    ${scope} ORDER BY c.cert_id DESC`, params));
}));
app.get("/api/dept-summary", ...requireAdmin, h(async (_req, res) => {
  res.json(await rows<RowDataPacket[] & DeptSummary[]>("SELECT * FROM dept_summary"));
}));

app.post("/api/admin/accounts", ...requireAdmin, h(async (req, res) => {
  const role = req.body?.role;
  const studentId = requiredText(req.body?.student_id, "Student ID", 20).toUpperCase();
  const username = requiredText(req.body?.username, "Committee username", 120).toLowerCase();
  if (username.includes(" ") || username.length < 3) throw fail(400, "Use a valid committee login username.");
  const password = requiredText(req.body?.password, "Password", 256);
  if (password.length < 12) throw fail(400, "Passwords must be at least 12 characters.");
  if (role !== "committee") throw fail(400, "Only committee accounts can be added here.");
  const committeeId = requiredText(req.body?.committee_id, "Committee", 15);
  const student = await rows<RowDataPacket[]>(
    "SELECT student_id FROM students WHERE student_id=? AND is_active=1", [studentId]);
  if (!student.length) throw fail(400, "Committee members must be active student records.");
  await db.query(
    "INSERT INTO user_accounts (username,password_hash,role,student_id,committee_id) VALUES (?,?, 'committee',?,?)",
    [username, await passwordHash(password), studentId, committeeId]
  );
  res.status(201).json({ ok: true });
}));

app.get("/api/admin/accounts/pending", ...requireAdmin, h(async (_req, res) => {
  res.json(await rows<RowDataPacket[]>(`
    SELECT a.account_id,a.first_name,a.last_name,a.email,a.committee_id,c.name AS committee_name,a.created_at
    FROM user_accounts a JOIN committees c ON c.committee_id=a.committee_id
    WHERE a.role='committee' AND a.approval_status='Pending'
    ORDER BY a.created_at ASC
  `));
}));

app.patch("/api/admin/accounts/:id/approval", ...requireAdmin, h(async (req, res) => {
  const accountId = positiveInt(req.params.id, "Account");
  const decision = req.body?.decision;
  if (decision !== "Approved" && decision !== "Rejected") {
    throw fail(400, "Choose Approved or Rejected.");
  }
  const [result] = await db.query<ResultSetHeader>(
    `UPDATE user_accounts SET approval_status=?
     WHERE account_id=? AND role='committee' AND approval_status='Pending'`,
    [decision,accountId]
  );
  if (!result.affectedRows) throw fail(404, "Pending committee account not found.");
  if (decision === "Rejected") {
    await db.query("DELETE FROM auth_sessions WHERE account_id=?", [accountId]);
  }
  res.json({ ok: true, approval_status: decision });
}));

app.post("/api/admin/committees", ...requireAdmin, h(async (req, res) => {
  const id = requiredText(req.body?.committee_id, "Committee ID", 15).toUpperCase();
  const name = requiredText(req.body?.name, "Name", 80);
  await db.query("INSERT INTO committees (committee_id,name,tagline,instagram_handle) VALUES (?,?,?,?)",
    [id, name, optionalText(req.body?.tagline, 120), optionalText(req.body?.instagram_handle, 60)]);
  res.status(201).json({ ok: true });
}));
app.put("/api/admin/committees/:id", ...requireAdmin, h(async (req, res) => {
  await db.query("UPDATE committees SET name=?,tagline=?,instagram_handle=? WHERE committee_id=?",
    [requiredText(req.body?.name, "Name", 80), optionalText(req.body?.tagline, 120),
      optionalText(req.body?.instagram_handle, 60), req.params.id]);
  res.json({ ok: true });
}));
app.post("/api/admin/venues", ...requireAdmin, h(async (req, res) => {
  const id = requiredText(req.body?.venue_id, "Venue ID", 15).toUpperCase();
  const name = requiredText(req.body?.name, "Venue name", 100);
  await db.query("INSERT INTO venues (venue_id,name) VALUES (?,?)", [id, name]);
  res.status(201).json({ ok: true });
}));

app.post("/api/admin/events", ...requireCommitteeManager, h(async (req, res) => {
  const b = req.body || {};
  const name = requiredText(b.name, "Event name", 150);
  const committee = requiredText(b.committee_id, "Committee", 15).toUpperCase();
  if (committeeScope(req) !== committee) throw fail(403, "You can only create events for your assigned committee.");
  const capacity = b.capacity === "" || b.capacity == null ? null : positiveInt(b.capacity, "Capacity");
  const fee = b.fee === "" || b.fee == null ? null : Number(b.fee);
  if (fee != null && (!Number.isFinite(fee) || fee < 0)) throw fail(400, "Fee must be zero or greater.");
  const start = dateTimeValue(b.start_ts, "Start time");
  const end = dateTimeValue(b.end_ts, "End time");
  const closes = dateTimeValue(b.registration_closes_at, "Registration close");
  const question = optionalText(b.registration_question, 500);
  if ((start && !end) || (!start && end) || (start && end && Date.parse(end.replace(" ", "T")) < Date.parse(start.replace(" ", "T")))) {
    throw fail(400, "Provide a valid event start and end time.");
  }
  const registrationOpen = registrationStatusValue(b.registration_open);
  await db.query(
    `INSERT INTO events (committee_id,venue_id,name,description,start_ts,end_ts,fee,fee_note,audience,prize,contact,
      capacity,registration_open,registration_closes_at,eligible_dept_id,registration_question)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [committee, b.venue_id || null, name, optionalText(b.description, 10000), start, end,
      fee, optionalText(b.fee_note, 80), optionalText(b.audience, 60), optionalText(b.prize, 40),
      optionalText(b.contact, 4000), capacity, registrationOpen, closes,
      b.eligible_dept_id ? requiredText(b.eligible_dept_id, "Eligible department", 10).toUpperCase() : null,
      question]
  );
  res.status(201).json({ ok: true });
}));
app.put("/api/admin/events/:id", ...requireCommitteeManager, h(async (req, res) => {
  const id = positiveInt(req.params.id, "Event");
  const b = req.body || {};
  const committee = requiredText(b.committee_id, "Committee", 15).toUpperCase();
  if (committeeScope(req) !== committee) throw fail(403, "You can only manage events for your assigned committee.");
  const name = requiredText(b.name, "Event name", 150);
  const capacity = b.capacity === "" || b.capacity == null ? null : positiveInt(b.capacity, "Capacity");
  const fee = b.fee === "" || b.fee == null ? null : Number(b.fee);
  if (fee != null && (!Number.isFinite(fee) || fee < 0)) throw fail(400, "Fee must be zero or greater.");
  const start = dateTimeValue(b.start_ts, "Start time");
  const end = dateTimeValue(b.end_ts, "End time");
  const closes = dateTimeValue(b.registration_closes_at, "Registration close");
  const question = optionalText(b.registration_question, 500);
  if ((start && !end) || (!start && end) || (start && end && Date.parse(end.replace(" ", "T")) < Date.parse(start.replace(" ", "T")))) {
    throw fail(400, "Provide a valid event start and end time.");
  }
  const registrationOpen = registrationStatusValue(b.registration_open);
  const conn = await db.getConnection();
  try {
    await conn.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
    await conn.beginTransaction();
    const [current] = await conn.query<RowDataPacket[]>("SELECT event_id,committee_id FROM events WHERE event_id=? FOR UPDATE", [id]);
    if (!current.length) throw fail(404, "Event not found.");
    if (req.auth!.role === "committee" && current[0].committee_id !== req.auth!.committee_id) {
      throw fail(404, "Event not found for this committee.");
    }
    const [counts] = await conn.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS registered FROM registrations WHERE event_id=? AND status='Confirmed'", [id]);
    if (capacity != null && capacity < Number(counts[0].registered)) {
      throw fail(409, "Capacity cannot be reduced below the existing confirmed registrations.");
    }
    await conn.query(
      `UPDATE events SET committee_id=?,venue_id=?,name=?,description=?,start_ts=?,end_ts=?,fee=?,fee_note=?,audience=?,
        prize=?,contact=?,capacity=?,registration_open=?,registration_closes_at=?,eligible_dept_id=?,
        registration_question=? WHERE event_id=?`,
      [committee, b.venue_id || null, name, optionalText(b.description, 10000),
        start, end, fee, optionalText(b.fee_note, 80), optionalText(b.audience, 60),
        optionalText(b.prize, 40), optionalText(b.contact, 4000), capacity, registrationOpen,
        closes, b.eligible_dept_id ? requiredText(b.eligible_dept_id, "Eligible department", 10).toUpperCase() : null,
        question, id]
    );
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
  res.json({ ok: true });
}));

app.get("/api/follows", ...requireStudent, h(async (req, res) => {
  const follows = await rows<RowDataPacket[]>(
    "SELECT committee_id FROM committee_follows WHERE student_id=?", [req.auth!.student_id]);
  res.json(follows.map((row) => row.committee_id));
}));
app.post("/api/follows", ...requireStudent, h(async (req, res) => {
  const committeeId = requiredText(req.body?.committee_id, "Committee", 15);
  await db.query("INSERT IGNORE INTO committee_follows (student_id,committee_id) VALUES (?,?)",
    [req.auth!.student_id, committeeId]);
  res.json({ ok: true });
}));
app.delete("/api/follows", ...requireStudent, h(async (req, res) => {
  await db.query("DELETE FROM committee_follows WHERE student_id=? AND committee_id=?",
    [req.auth!.student_id, requiredText(req.body?.committee_id, "Committee", 15)]);
  res.json({ ok: true });
}));
app.get("/api/alerts", ...requireStudent, h(async (req, res) => {
  res.json(await rows<RowDataPacket[]>(
    "SELECT event_id,set_at FROM event_alerts WHERE student_id=?", [req.auth!.student_id]));
}));
app.post("/api/alerts", ...requireStudent, h(async (req, res) => {
  await db.query("INSERT IGNORE INTO event_alerts (student_id,event_id) VALUES (?,?)",
    [req.auth!.student_id, positiveInt(req.body?.event_id, "Event")]);
  res.json({ ok: true });
}));
app.delete("/api/alerts", ...requireStudent, h(async (req, res) => {
  await db.query("DELETE FROM event_alerts WHERE student_id=? AND event_id=?",
    [req.auth!.student_id, positiveInt(req.body?.event_id, "Event")]);
  res.json({ ok: true });
}));

app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled API error:", error);
  res.status(400).json({ error: "The request body is invalid." });
});

const PORT = +(process.env.PORT || 4000);
bootstrapAdmin().then(() => {
  app.listen(PORT, () => console.log(`CampusPulse API listening on port ${PORT}`));
}).catch((error) => {
  console.error("API startup failed:", error);
  process.exitCode = 1;
});
