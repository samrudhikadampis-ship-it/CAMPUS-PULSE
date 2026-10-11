-- CampusPulse — MySQL 8.0+ schema (BCNF). Run: mysql -u root -p < schema/schema.sql
-- All DATETIME values are stored in IST (Asia/Kolkata).
CREATE DATABASE IF NOT EXISTS campuspulse CHARACTER SET utf8mb4;
USE campuspulse;

CREATE TABLE departments (dept_id VARCHAR(10) PRIMARY KEY, name VARCHAR(80) NOT NULL UNIQUE);
CREATE TABLE committees (committee_id VARCHAR(15) PRIMARY KEY, name VARCHAR(80) NOT NULL,
  tagline VARCHAR(120), instagram_handle VARCHAR(60));
CREATE TABLE venues (venue_id VARCHAR(15) PRIMARY KEY, name VARCHAR(100) NOT NULL);
CREATE TABLE events (
  event_id INT AUTO_INCREMENT PRIMARY KEY,
  committee_id VARCHAR(15) NOT NULL, venue_id VARCHAR(15) NULL,
  name VARCHAR(150) NOT NULL, description TEXT,
  start_ts DATETIME NULL, end_ts DATETIME NULL,              -- both NULL = ongoing contest
  fee DECIMAL(8,2) NULL, fee_note VARCHAR(80), audience VARCHAR(60), prize VARCHAR(40), contact TEXT,
  FOREIGN KEY (committee_id) REFERENCES committees(committee_id),
  FOREIGN KEY (venue_id) REFERENCES venues(venue_id),
  CHECK (fee IS NULL OR fee >= 0),
  CHECK ((start_ts IS NULL) = (end_ts IS NULL) AND (end_ts IS NULL OR end_ts >= start_ts)));
CREATE TABLE event_links (
  link_id INT AUTO_INCREMENT PRIMARY KEY, event_id INT NOT NULL,
  label VARCHAR(60) NOT NULL, url TEXT NOT NULL,
  FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE);
CREATE TABLE students (
  student_id VARCHAR(20) PRIMARY KEY,
  first_name VARCHAR(50) NOT NULL, last_name VARCHAR(50) NOT NULL, dept_id VARCHAR(10) NOT NULL,
  study_year CHAR(2) NOT NULL, division VARCHAR(5) NOT NULL, phone VARCHAR(15),
  email VARCHAR(120) UNIQUE, gender VARCHAR(10), dob DATE,
  FOREIGN KEY (dept_id) REFERENCES departments(dept_id),
  CHECK (study_year IN ('FE','SE','TE','BE')), CHECK (gender IN ('Female','Male','Other')));
CREATE TABLE committee_follows (
  student_id VARCHAR(20), committee_id VARCHAR(15), PRIMARY KEY (student_id, committee_id),
  FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
  FOREIGN KEY (committee_id) REFERENCES committees(committee_id));
CREATE TABLE event_alerts (
  student_id VARCHAR(20), event_id INT, set_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (student_id, event_id),
  FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE);
CREATE TABLE registrations (
  reg_id INT AUTO_INCREMENT PRIMARY KEY, student_id VARCHAR(20) NOT NULL, event_id INT NOT NULL,
  registered_on DATE NOT NULL DEFAULT (CURRENT_DATE), status VARCHAR(12) NOT NULL DEFAULT 'Confirmed',
  UNIQUE (student_id, event_id), CHECK (status IN ('Confirmed','Cancelled')),
  FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(event_id));
CREATE TABLE payments (
  payment_id INT AUTO_INCREMENT PRIMARY KEY, reg_id INT NOT NULL UNIQUE,
  txn_ref VARCHAR(60) NOT NULL, method VARCHAR(8) NOT NULL, amount DECIMAL(8,2) NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'Submitted', paid_on DATE NOT NULL DEFAULT (CURRENT_DATE),
  CHECK (CHAR_LENGTH(txn_ref) >= 6), CHECK (method IN ('UPI','Card','Cash')), CHECK (amount > 0),
  CHECK (status IN ('Submitted','Verified','Rejected')),
  FOREIGN KEY (reg_id) REFERENCES registrations(reg_id) ON DELETE CASCADE);
CREATE TABLE attendance (
  attendance_id INT AUTO_INCREMENT PRIMARY KEY, reg_id INT NOT NULL UNIQUE,
  status VARCHAR(8) NOT NULL DEFAULT 'Present',
  check_in DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, check_out DATETIME NULL,
  CHECK (check_out IS NULL OR check_out >= check_in),
  FOREIGN KEY (reg_id) REFERENCES registrations(reg_id) ON DELETE CASCADE);
CREATE TABLE certificates (
  cert_id INT AUTO_INCREMENT PRIMARY KEY, reg_id INT NOT NULL UNIQUE,
  cert_type VARCHAR(20) NOT NULL DEFAULT 'Participation', issued_on DATE NOT NULL DEFAULT (CURRENT_DATE),
  FOREIGN KEY (reg_id) REFERENCES attendance(reg_id) ON DELETE CASCADE);   -- attended students only
CREATE TABLE feedback (
  feedback_id INT AUTO_INCREMENT PRIMARY KEY, reg_id INT NOT NULL UNIQUE,
  rating TINYINT NOT NULL, comments TEXT, submitted_on DATE NOT NULL DEFAULT (CURRENT_DATE),
  CHECK (rating BETWEEN 1 AND 5),
  FOREIGN KEY (reg_id) REFERENCES attendance(reg_id) ON DELETE CASCADE);   -- attended students only

CREATE INDEX idx_events_start ON events(start_ts);
CREATE INDEX idx_reg_event ON registrations(event_id);

CREATE VIEW event_status AS
SELECT e.*, CASE WHEN start_ts IS NULL THEN 'live' WHEN NOW() < start_ts THEN 'up'
                 WHEN NOW() <= end_ts THEN 'live' ELSE 'done' END AS status FROM events e;

CREATE VIEW dept_summary AS
SELECT d.dept_id, COUNT(DISTINCT s.student_id) AS students, COUNT(a.reg_id) AS attended, COUNT(c.reg_id) AS certs
FROM departments d LEFT JOIN students s ON s.dept_id = d.dept_id
LEFT JOIN registrations r ON r.student_id = s.student_id
LEFT JOIN attendance a ON a.reg_id = r.reg_id LEFT JOIN certificates c ON c.reg_id = r.reg_id
GROUP BY d.dept_id;

DELIMITER $$
-- Attendance can only be recorded once the event has started
CREATE TRIGGER trg_attendance BEFORE INSERT ON attendance FOR EACH ROW
BEGIN
  IF EXISTS (SELECT 1 FROM registrations r JOIN events e ON e.event_id = r.event_id
             WHERE r.reg_id = NEW.reg_id AND e.start_ts > NOW()) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Event has not started yet';
  END IF;
END$$
-- Batch certificate engine: attended + event ended => certificate (idempotent)
CREATE PROCEDURE issue_certificates()
BEGIN
  INSERT IGNORE INTO certificates(reg_id)
  SELECT a.reg_id FROM attendance a JOIN registrations r ON r.reg_id = a.reg_id
  JOIN events e ON e.event_id = r.event_id WHERE e.end_ts < NOW();
  SELECT ROW_COUNT() AS issued;
END$$
DELIMITER ;
