import initSqlJs, { Database } from "sql.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createHash, randomBytes, scrypt as scryptCallback } from "crypto";
import { promisify } from "util";

const scrypt = promisify(scryptCallback);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.resolve(__dirname, "../../campuspulse.sqlite");

async function hashPwd(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}

export interface CPDatabase {
  query<T = any>(sql: string, params?: unknown[]): Promise<[T, any]>;
  getConnection(): Promise<{
    beginTransaction(): Promise<void>;
    commit(): Promise<void>;
    rollback(): Promise<void>;
    query<T = any>(sql: string, params?: unknown[]): Promise<[T, any]>;
    release(): void;
  }>;
}

let dbInstance: Database | null = null;
let inTransaction = false;

function saveDb() {
  if (!dbInstance || inTransaction) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE, buffer);
  } catch (err) {
    console.error("Warning: saveDb skipped:", err);
  }
}

function translateSql(sql: string, params: unknown[]): { sql: string; params: unknown[] } {
  let translated = sql
    .replace(/\bNOW\(\)/gi, "datetime('now', 'localtime')")
    .replace(/\bCURRENT_TIMESTAMP\b/gi, "datetime('now', 'localtime')")
    .replace(/\bCURRENT_DATE\b/gi, "date('now', 'localtime')")
    .replace(/DATE_ADD\(datetime\('now',\s*'localtime'\),\s*INTERVAL\s+\?\s+HOUR\)/gi, "datetime('now', 'localtime', '+' || ? || ' hours')")
    .replace(/DATE_ADD\(([^,]+),\s*INTERVAL\s+(\d+)\s+HOUR\)/gi, "datetime($1, '+$2 hours')")
    .replace(/DATE_ADD\(([^,]+),\s*INTERVAL\s+(\d+)\s+DAY\)/gi, "datetime($1, '+$2 days')")
    .replace(/DATE_SUB\(([^,]+),\s*INTERVAL\s+(\d+)\s+DAY\)/gi, "datetime($1, '-$2 days')")
    .replace(/\bBINARY\b/gi, "")
    .replace(/\bFOR\s+UPDATE\b/gi, "")
    .replace(/\bSET\s+TRANSACTION\s+ISOLATION\s+LEVEL[^\n;]+;/gi, "")
    .replace(/ON\s+DUPLICATE\s+KEY\s+UPDATE\s+password_hash=VALUES\(password_hash\)/gi, "")
    .replace(/INSERT\s+IGNORE\s+INTO/gi, "INSERT OR IGNORE INTO");

  return { sql: translated, params };
}

export async function getDb(): Promise<CPDatabase> {
  if (dbInstance) return wrapDb(dbInstance);

  const SQL = await initSqlJs();
  if (fs.existsSync(DB_FILE)) {
    const filebuffer = fs.readFileSync(DB_FILE);
    dbInstance = new SQL.Database(filebuffer);
  } else {
    dbInstance = new SQL.Database();
    await initSchema(dbInstance);
    saveDb();
  }

  return wrapDb(dbInstance);
}

function wrapDb(db: Database): CPDatabase {
  const runQuery = async <T = any>(sql: string, params: unknown[] = []): Promise<[T, any]> => {
    let { sql: cleanSql, params: boundParams } = translateSql(sql, params);
    cleanSql = cleanSql.trim();
    if (!cleanSql || cleanSql === ";") return [[] as any, { affectedRows: 0, insertId: 0 }];

    const lower = cleanSql.toLowerCase();
    const isSelect = lower.startsWith("select") || lower.startsWith("with");

    if (isSelect) {
      const stmt = db.prepare(cleanSql);
      if (boundParams && boundParams.length > 0) stmt.bind(boundParams as any);
      const rows: any[] = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();
      return [rows as unknown as T, null];
    } else {
      const stmt = db.prepare(cleanSql);
      if (boundParams && boundParams.length > 0) stmt.bind(boundParams as any);
      stmt.step();
      stmt.free();
      saveDb();

      const info = db.exec("SELECT changes() AS affectedRows, last_insert_rowid() AS insertId");
      let affectedRows = 0;
      let insertId = 0;
      if (info.length > 0 && info[0].values.length > 0) {
        affectedRows = Number(info[0].values[0][0]) || 0;
        insertId = Number(info[0].values[0][1]) || 0;
      }
      return [[] as any, { affectedRows, insertId }];
    }
  };

  return {
    query: runQuery,
    getConnection: async () => ({
      beginTransaction: async () => {
        inTransaction = true;
        db.run("BEGIN TRANSACTION;");
      },
      commit: async () => {
        db.run("COMMIT;");
        inTransaction = false;
        saveDb();
      },
      rollback: async () => {
        try {
          db.run("ROLLBACK;");
        } catch {}
        inTransaction = false;
      },
      query: runQuery,
      release: () => {
        inTransaction = false;
      }
    })
  };
}

async function initSchema(db: Database) {
  const schemaSql = `
    CREATE TABLE IF NOT EXISTS departments (
      dept_id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS committees (
      committee_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tagline TEXT,
      instagram_handle TEXT
    );

    CREATE TABLE IF NOT EXISTS venues (
      venue_id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      event_id INTEGER PRIMARY KEY AUTOINCREMENT,
      committee_id TEXT NOT NULL,
      venue_id TEXT,
      name TEXT NOT NULL,
      description TEXT,
      start_ts TEXT,
      end_ts TEXT,
      fee REAL,
      fee_note TEXT,
      audience TEXT,
      prize TEXT,
      contact TEXT,
      capacity INTEGER,
      registration_open INTEGER NOT NULL DEFAULT 1,
      registration_closes_at TEXT,
      eligible_dept_id TEXT,
      registration_question TEXT
    );

    CREATE TABLE IF NOT EXISTS event_links (
      link_id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      label TEXT NOT NULL,
      url TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS students (
      student_id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      dept_id TEXT,
      study_year TEXT,
      division TEXT,
      phone TEXT,
      email TEXT UNIQUE,
      gender TEXT,
      dob TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      department_verified INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS user_accounts (
      account_id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      student_id TEXT,
      committee_id TEXT,
      first_name TEXT,
      last_name TEXT,
      email TEXT UNIQUE,
      approval_status TEXT NOT NULL DEFAULT 'Approved',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS auth_sessions (
      session_id TEXT PRIMARY KEY,
      account_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS registrations (
      reg_id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT NOT NULL,
      event_id INTEGER NOT NULL,
      registered_on TEXT NOT NULL DEFAULT (date('now', 'localtime')),
      status TEXT NOT NULL DEFAULT 'Confirmed',
      application_answer TEXT,
      UNIQUE (student_id, event_id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
      reg_id INTEGER NOT NULL UNIQUE,
      txn_ref TEXT NOT NULL,
      method TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'Submitted',
      paid_on TEXT NOT NULL DEFAULT (date('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS attendance (
      attendance_id INTEGER PRIMARY KEY AUTOINCREMENT,
      reg_id INTEGER NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'Attended',
      check_in TEXT DEFAULT (datetime('now', 'localtime')),
      check_out TEXT
    );

    CREATE TABLE IF NOT EXISTS certificates (
      cert_id INTEGER PRIMARY KEY AUTOINCREMENT,
      reg_id INTEGER NOT NULL UNIQUE,
      cert_type TEXT NOT NULL DEFAULT 'Participation',
      issued_on TEXT NOT NULL DEFAULT (date('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS feedback (
      feedback_id INTEGER PRIMARY KEY AUTOINCREMENT,
      reg_id INTEGER,
      student_id TEXT NOT NULL,
      committee_id TEXT NOT NULL,
      event_id INTEGER,
      request_id TEXT UNIQUE,
      rating INTEGER NOT NULL,
      comments TEXT,
      submitted_on TEXT NOT NULL DEFAULT (date('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS committee_follows (
      student_id TEXT,
      committee_id TEXT,
      PRIMARY KEY (student_id, committee_id)
    );

    CREATE TABLE IF NOT EXISTS event_alerts (
      student_id TEXT,
      event_id INTEGER,
      set_at TEXT DEFAULT (datetime('now', 'localtime')),
      PRIMARY KEY (student_id, event_id)
    );

    CREATE VIEW IF NOT EXISTS event_status AS
    SELECT e.*,
      CASE 
        WHEN e.start_ts IS NULL THEN 'live'
        WHEN datetime('now', 'localtime') < e.start_ts THEN 'up'
        WHEN datetime('now', 'localtime') <= e.end_ts THEN 'live'
        ELSE 'done'
      END AS status
    FROM events e;

    CREATE VIEW IF NOT EXISTS admin_student_signup_details AS
    SELECT r.reg_id, r.student_id, s.first_name, s.last_name, s.dept_id, s.email, s.phone,
           s.department_verified, r.event_id, e.name, e.committee_id, r.application_answer,
           r.registered_on, r.status AS registration_status,
           'Free' AS pay_status, 0.0 AS amount, a.check_in, a.check_out, c.cert_id
    FROM registrations r
    JOIN students s ON s.student_id = r.student_id
    JOIN events e ON e.event_id = r.event_id
    LEFT JOIN attendance a ON a.reg_id = r.reg_id
    LEFT JOIN certificates c ON c.reg_id = r.reg_id;
  `;

  db.run(schemaSql);

  // Departments
  db.run(`
    INSERT INTO departments (dept_id, name) VALUES 
    ('CSE', 'Computer Science & Engineering'),
    ('CE', 'Computer Engineering'),
    ('EXTC', 'Electronics & Telecommunication');
  `);

  // Committees
  db.run(`
    INSERT INTO committees (committee_id, name, tagline, instagram_handle) VALUES 
    ('CSI', 'Computer Society of India - SPIT', 'Building tomorrow tech leaders today', 'csi_spit'),
    ('IEEE', 'IEEE Student Branch SPIT', 'Advancing technology for humanity', 'ieee_spit'),
    ('MUDRA', 'Mudra Cultural Committee', 'Dance, music and expression at SPIT', 'mudra_spit'),
    ('FACE', 'Forum of Aspiring Computer Engineers', 'Technical peer learning and hackathons', 'face_spit'),
    ('OCULUS', 'Oculus Photography & Media', 'Capturing campus moments frame by frame', 'oculus_spit'),
    ('ROTARACT', 'Rotaract Club of SPIT', 'Self development through fellowship and service', 'rotaract_spit');
  `);

  // Venues
  db.run(`
    INSERT INTO venues (venue_id, name) VALUES 
    ('v408', 'Lab 408, 4th Floor Academic Block'),
    ('auditorium', 'SPIT Main Auditorium'),
    ('gym', 'Indoor Sports Complex & Gym'),
    ('seminar1', 'Seminar Hall 1, Ground Floor'),
    ('powai', 'Powai Lake Promenade & Garden');
  `);

  // Password for all demo accounts: "CampusPulse@123"
  const defaultHash = await hashPwd("CampusPulse@123");

  // Admin and Committee Accounts
  db.run(`
    INSERT INTO user_accounts (username, password_hash, role, committee_id, first_name, last_name, email, approval_status)
    VALUES 
    ('admin@example.edu', '${defaultHash}', 'admin', NULL, 'Super', 'Admin', 'admin@example.edu', 'Approved'),
    ('csi_admin@spit.ac.in', '${defaultHash}', 'committee', 'CSI', 'Aarav', 'Sharma', 'csi_admin@spit.ac.in', 'Approved'),
    ('ieee_admin@spit.ac.in', '${defaultHash}', 'committee', 'IEEE', 'Priya', 'Nair', 'ieee_admin@spit.ac.in', 'Approved'),
    ('mudra_admin@spit.ac.in', '${defaultHash}', 'committee', 'MUDRA', 'Rohan', 'Deshmukh', 'mudra_admin@spit.ac.in', 'Approved');
  `);

  // Demo Students
  const students = [
    ['CP-S001', 'Samrudhi', 'Kadampi', 'CSE', 'TE', 'A', '9876543210', 'samrudhi@spit.ac.in', 'Female'],
    ['CP-S002', 'Aditya', 'Verma', 'CE', 'BE', 'B', '9876543211', 'aditya.v@spit.ac.in', 'Male'],
    ['CP-S003', 'Rhea', 'Kulkarni', 'EXTC', 'SE', 'A', '9876543212', 'rhea.k@spit.ac.in', 'Female'],
    ['CP-S004', 'Tanmay', 'Bhat', 'CSE', 'TE', 'B', '9876543213', 'tanmay.b@spit.ac.in', 'Male'],
    ['CP-S005', 'Ananya', 'Patel', 'CE', 'SE', 'C', '9876543214', 'ananya.p@spit.ac.in', 'Female']
  ];

  for (const s of students) {
    db.run(
      `INSERT INTO students (student_id, first_name, last_name, dept_id, study_year, division, phone, email, gender, is_active, department_verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)`,
      s
    );
    db.run(
      `INSERT INTO user_accounts (username, password_hash, role, student_id, first_name, last_name, email, approval_status)
       VALUES (?, '${defaultHash}', 'student', ?, ?, ?, ?, 'Approved')`,
      [s[7], s[0], s[1], s[2], s[7]]
    );
  }

  // Events (Past Completed, Ongoing Live, Upcoming)
  // 1. CSI Completed Event (Eligible for certificates demonstration)
  db.run(`
    INSERT INTO events (event_id, committee_id, venue_id, name, description, start_ts, end_ts, fee, fee_note, audience, prize, capacity, registration_open, registration_question)
    VALUES (
      1, 'CSI', 'v408', 'CSI HackSprint 2026',
      'An intensive 24-hour algorithmic development and systems hackathon.',
      datetime('now', '-2 days'), datetime('now', '-1 days'), 0, 'Free entry', 'All SPIT students', 'Rs. 25,000', 80, 0, 'Github profile link'
    );
  `);

  // 2. CSI Ongoing Live Event
  db.run(`
    INSERT INTO events (event_id, committee_id, venue_id, name, description, start_ts, end_ts, fee, fee_note, audience, prize, capacity, registration_open, registration_question)
    VALUES (
      2, 'CSI', 'seminar1', 'CSI Web3 & Cloud Expo',
      'Interactive masterclass on decentralized web architectures and cloud-native microservices.',
      datetime('now', '-1 hours'), datetime('now', '+3 hours'), 0, 'Free entry', 'Engineering Students', 'Trophies & Swag', 100, 1, 'Why do you want to attend?'
    );
  `);

  // 3. CSI Upcoming Event
  db.run(`
    INSERT INTO events (event_id, committee_id, venue_id, name, description, start_ts, end_ts, fee, fee_note, audience, prize, capacity, registration_open, registration_question)
    VALUES (
      3, 'CSI', 'auditorium', 'CSI National Tech Conclave 2026',
      'Annual tech keynote featuring industry leaders, robotics exhibits, and project showcases.',
      datetime('now', '+3 days'), datetime('now', '+3 days', '+6 hours'), 0, 'Free', 'Open to all', 'Rs. 50,000', 250, 1, 'Areas of interest'
    );
  `);

  // 4. IEEE Completed Event
  db.run(`
    INSERT INTO events (event_id, committee_id, venue_id, name, description, start_ts, end_ts, fee, fee_note, audience, prize, capacity, registration_open, registration_question)
    VALUES (
      4, 'IEEE', 'v408', 'IEEE Embedded Systems Bootcamp',
      'Hands-on workshop on STM32 microcontrollers and RTOS development.',
      datetime('now', '-3 days'), datetime('now', '-2 days'), 0, 'Free', 'EXTC and CSE students', 'Certificate & Kits', 60, 0, 'Prior C programming experience'
    );
  `);

  // 5. IEEE Upcoming Event
  db.run(`
    INSERT INTO events (event_id, committee_id, venue_id, name, description, start_ts, end_ts, fee, fee_note, audience, prize, capacity, registration_open, registration_question)
    VALUES (
      5, 'IEEE', 'auditorium', 'IEEE AI & Robotics Colloquium',
      'Deep dive into autonomous mobile robots, computer vision, and ROS2.',
      datetime('now', '+5 days'), datetime('now', '+5 days', '+5 hours'), 0, 'Free', 'All branches', 'Merit Awards', 150, 1, 'Robotics club member? (Yes/No)'
    );
  `);

  // 6. MUDRA Cultural Upcoming Event
  db.run(`
    INSERT INTO events (event_id, committee_id, venue_id, name, description, start_ts, end_ts, fee, fee_note, audience, prize, capacity, registration_open, registration_question)
    VALUES (
      6, 'MUDRA', 'auditorium', 'Aarohan Annual Cultural Night',
      'The biggest cultural showcase of SPIT featuring theatrical arts, music bands, and dance troupes.',
      datetime('now', '+7 days'), datetime('now', '+7 days', '+8 hours'), 0, 'Free', 'All SPITians', 'Trophies', 300, 1, 'Performance category'
    );
  `);

  // Registrations for CSI Event 1 (Completed event)
  // Student 1 (Samrudhi): Registered & Attended (Certificate issued)
  db.run(`
    INSERT INTO registrations (reg_id, student_id, event_id, registered_on, status, application_answer)
    VALUES (1, 'CP-S001', 1, date('now', '-3 days'), 'Confirmed', 'https://github.com/samrudhi');
    INSERT INTO attendance (attendance_id, reg_id, status, check_in)
    VALUES (1, 1, 'Attended', datetime('now', '-2 days', '+10 minutes'));
    INSERT INTO certificates (cert_id, reg_id, cert_type, issued_on)
    VALUES (1, 1, 'Participation', date('now', '-1 days'));
  `);

  // Student 2 (Aditya): Registered & Attended (Certificate NOT yet issued - ready to test "Issue Certificates")
  db.run(`
    INSERT INTO registrations (reg_id, student_id, event_id, registered_on, status, application_answer)
    VALUES (2, 'CP-S002', 1, date('now', '-3 days'), 'Confirmed', 'https://github.com/aditya');
    INSERT INTO attendance (attendance_id, reg_id, status, check_in)
    VALUES (2, 2, 'Attended', datetime('now', '-2 days', '+15 minutes'));
  `);

  // Student 3 (Rhea): Registered but Not Attended (No check_in row)
  db.run(`
    INSERT INTO registrations (reg_id, student_id, event_id, registered_on, status, application_answer)
    VALUES (3, 'CP-S003', 1, date('now', '-3 days'), 'Confirmed', 'https://github.com/rhea');
  `);

  // Registrations for CSI Event 3 (Upcoming)
  db.run(`
    INSERT INTO registrations (reg_id, student_id, event_id, registered_on, status, application_answer)
    VALUES 
    (4, 'CP-S001', 3, date('now'), 'Confirmed', 'Cloud Systems & AI'),
    (5, 'CP-S004', 3, date('now'), 'Confirmed', 'Competitive Programming');
  `);

  // Registrations for IEEE Event 4 (Completed)
  db.run(`
    INSERT INTO registrations (reg_id, student_id, event_id, registered_on, status, application_answer)
    VALUES (6, 'CP-S003', 4, date('now', '-4 days'), 'Confirmed', 'Basic C and Arduino');
    INSERT INTO attendance (attendance_id, reg_id, status, check_in)
    VALUES (3, 6, 'Attended', datetime('now', '-3 days', '+20 minutes'));
    INSERT INTO certificates (cert_id, reg_id, cert_type, issued_on)
    VALUES (2, 6, 'Participation', date('now', '-2 days'));
  `);

  // Sample feedback
  db.run(`
    INSERT INTO feedback (feedback_id, reg_id, student_id, committee_id, event_id, request_id, rating, comments, submitted_on)
    VALUES 
    (1, 1, 'CP-S001', 'CSI', 1, 'feed-uuid-1', 5, 'Exceptional problem statements and smooth judging process. Great job CSI team!', date('now', '-1 days')),
    (2, 2, 'CP-S002', 'CSI', 1, 'feed-uuid-2', 4, 'Great mentors during the overnight coding phase. Venue air conditioning could be improved.', date('now', '-1 days')),
    (3, 6, 'CP-S003', 'IEEE', 4, 'feed-uuid-3', 5, 'The hardware debugging kits provided were top-notch. Loved the hands-on sessions!', date('now', '-2 days'));
  `);
}
