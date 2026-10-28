-- CampusPulse — MySQL 8.0+ schema (BCNF). Run: mysql -u root -p < schema/schema.sql
-- All DATETIME values are stored in IST (Asia/Kolkata).
CREATE DATABASE IF NOT EXISTS campuspulse CHARACTER SET utf8mb4;
USE campuspulse;

CREATE TABLE IF NOT EXISTS departments (
  dept_id VARCHAR(10) PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS committees (
  committee_id VARCHAR(15) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  tagline VARCHAR(120),
  instagram_handle VARCHAR(60)
);

CREATE TABLE IF NOT EXISTS venues (
  venue_id VARCHAR(15) PRIMARY KEY,
  name VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  event_id INT AUTO_INCREMENT PRIMARY KEY,
  committee_id VARCHAR(15) NOT NULL,
  venue_id VARCHAR(15) NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  start_ts DATETIME NULL,
  end_ts DATETIME NULL,
  fee DECIMAL(8,2) NULL,
  fee_note VARCHAR(80),
  audience VARCHAR(60),
  prize VARCHAR(40),
  contact TEXT,
  capacity INT UNSIGNED NULL,
  registration_open BOOLEAN NOT NULL DEFAULT TRUE,
  registration_closes_at DATETIME NULL,
  eligible_dept_id VARCHAR(10) NULL,
  registration_question VARCHAR(500) NULL,
  FOREIGN KEY (committee_id) REFERENCES committees(committee_id),
  FOREIGN KEY (venue_id) REFERENCES venues(venue_id),
  FOREIGN KEY (eligible_dept_id) REFERENCES departments(dept_id),
  CHECK (fee IS NULL OR fee >= 0),
  CHECK ((start_ts IS NULL) = (end_ts IS NULL) AND (end_ts IS NULL OR end_ts >= start_ts))
);

CREATE TABLE IF NOT EXISTS event_links (
  link_id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  label VARCHAR(60) NOT NULL,
  url TEXT NOT NULL,
  FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS students (
  student_id VARCHAR(20) PRIMARY KEY,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  dept_id VARCHAR(10) NULL,
  study_year CHAR(2) NULL,
  division VARCHAR(5) NULL,
  phone VARCHAR(15),
  email VARCHAR(120) UNIQUE,
  gender VARCHAR(10),
  dob DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  department_verified BOOLEAN NOT NULL DEFAULT TRUE,
  FOREIGN KEY (dept_id) REFERENCES departments(dept_id),
  CHECK (study_year IS NULL OR study_year IN ('FE','SE','TE','BE')),
  CHECK (gender IS NULL OR gender IN ('Female','Male','Other'))
);

CREATE TABLE IF NOT EXISTS user_accounts (
  account_id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(200) NOT NULL,
  role ENUM('admin','student','committee') NOT NULL,
  student_id VARCHAR(20) NULL,
  committee_id VARCHAR(15) NULL,
  first_name VARCHAR(50) NULL,
  last_name VARCHAR(50) NULL,
  email VARCHAR(120) UNIQUE,
  approval_status ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Approved',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(student_id),
  FOREIGN KEY (committee_id) REFERENCES committees(committee_id),
  CONSTRAINT chk_account_identity CHECK (
    (role = 'admin' AND student_id IS NULL) OR
    (role = 'student' AND student_id IS NOT NULL AND committee_id IS NULL) OR
    (role = 'committee' AND committee_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  session_id CHAR(64) PRIMARY KEY,
  account_id INT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES user_accounts(account_id) ON DELETE CASCADE,
  INDEX idx_sessions_expiry (expires_at)
);

CREATE TABLE IF NOT EXISTS committee_follows (
  student_id VARCHAR(20),
  committee_id VARCHAR(15),
  PRIMARY KEY (student_id, committee_id),
  FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
  FOREIGN KEY (committee_id) REFERENCES committees(committee_id)
);

CREATE TABLE IF NOT EXISTS event_alerts (
  student_id VARCHAR(20),
  event_id INT,
  set_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (student_id, event_id),
  FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS registrations (
  reg_id INT AUTO_INCREMENT PRIMARY KEY,
  student_id VARCHAR(20) NOT NULL,
  event_id INT NOT NULL,
  registered_on DATE NOT NULL DEFAULT (CURRENT_DATE),
  status VARCHAR(12) NOT NULL DEFAULT 'Confirmed',
  application_answer TEXT NULL,
  UNIQUE (student_id, event_id),
  CHECK (status IN ('Confirmed','Cancelled')),
  FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(event_id)
);

CREATE TABLE IF NOT EXISTS payments (
  payment_id INT AUTO_INCREMENT PRIMARY KEY,
  reg_id INT NOT NULL UNIQUE,
  txn_ref VARCHAR(60) NOT NULL,
  method VARCHAR(8) NOT NULL,
  amount DECIMAL(8,2) NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'Submitted',
  paid_on DATE NOT NULL DEFAULT (CURRENT_DATE),
  CHECK (CHAR_LENGTH(txn_ref) >= 6),
  CHECK (method IN ('UPI','Card','Cash')),
  CHECK (amount > 0),
  CHECK (status IN ('Submitted','Verified','Rejected')),
  FOREIGN KEY (reg_id) REFERENCES registrations(reg_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS attendance (
  attendance_id INT AUTO_INCREMENT PRIMARY KEY,
  reg_id INT NOT NULL UNIQUE,
  status VARCHAR(8) NOT NULL DEFAULT 'Attended',
  check_in DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  check_out DATETIME NULL,
  CHECK (check_out IS NULL OR check_out >= check_in),
  FOREIGN KEY (reg_id) REFERENCES registrations(reg_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS certificates (
  cert_id INT AUTO_INCREMENT PRIMARY KEY,
  reg_id INT NOT NULL UNIQUE,
  cert_type VARCHAR(20) NOT NULL DEFAULT 'Participation',
  issued_on DATE NOT NULL DEFAULT (CURRENT_DATE),
  FOREIGN KEY (reg_id) REFERENCES attendance(reg_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS feedback (
  feedback_id INT AUTO_INCREMENT PRIMARY KEY,
  reg_id INT NULL,
  student_id VARCHAR(20) NOT NULL,
  committee_id VARCHAR(15) NOT NULL,
  event_id INT NULL,
  request_id CHAR(36) UNIQUE,
  rating TINYINT NOT NULL,
  comments TEXT,
  submitted_on DATE NOT NULL DEFAULT (CURRENT_DATE),
  CHECK (rating BETWEEN 1 AND 5),
  FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
  FOREIGN KEY (committee_id) REFERENCES committees(committee_id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE SET NULL
);

CREATE INDEX idx_events_start ON events(start_ts);
CREATE INDEX idx_reg_event ON registrations(event_id);

CREATE OR REPLACE VIEW event_status AS
SELECT e.*,
  CASE
    WHEN e.start_ts IS NULL THEN 'live'
    WHEN NOW() < e.start_ts THEN 'up'
    WHEN NOW() <= e.end_ts THEN 'live'
    ELSE 'done'
  END AS status
FROM events e;

CREATE OR REPLACE VIEW admin_student_signup_details AS
SELECT r.reg_id, r.student_id, s.first_name, s.last_name, s.dept_id, s.email, s.phone,
       s.department_verified, r.event_id, e.name, e.committee_id, r.application_answer,
       r.registered_on, r.status AS registration_status,
       'Free' AS pay_status, 0.0 AS amount, a.check_in, a.check_out, c.cert_id
FROM registrations r
JOIN students s ON s.student_id = r.student_id
JOIN events e ON e.event_id = r.event_id
LEFT JOIN attendance a ON a.reg_id = r.reg_id
LEFT JOIN certificates c ON c.reg_id = r.reg_id;

CREATE OR REPLACE VIEW dept_summary AS
SELECT d.dept_id, COUNT(DISTINCT s.student_id) AS students, COUNT(a.reg_id) AS attended, COUNT(c.reg_id) AS certs
FROM departments d LEFT JOIN students s ON s.dept_id = d.dept_id
LEFT JOIN registrations r ON r.student_id = s.student_id
LEFT JOIN attendance a ON a.reg_id = r.reg_id LEFT JOIN certificates c ON c.reg_id = r.reg_id
GROUP BY d.dept_id;
