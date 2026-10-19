USE campuspulse;

ALTER TABLE students
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE events
  ADD COLUMN capacity INT UNSIGNED NULL,
  ADD COLUMN registration_open BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN registration_closes_at DATETIME NULL,
  ADD COLUMN eligible_dept_id VARCHAR(10) NULL,
  ADD CONSTRAINT fk_events_eligible_department
    FOREIGN KEY (eligible_dept_id) REFERENCES departments(dept_id),
  ADD CONSTRAINT chk_events_capacity CHECK (capacity IS NULL OR capacity > 0);

CREATE TABLE user_accounts (
  account_id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(200) NOT NULL,
  role ENUM('admin','student','committee') NOT NULL,
  student_id VARCHAR(20) NULL,
  committee_id VARCHAR(15) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_accounts_student FOREIGN KEY (student_id) REFERENCES students(student_id),
  CONSTRAINT fk_accounts_committee FOREIGN KEY (committee_id) REFERENCES committees(committee_id),
  CONSTRAINT chk_account_identity CHECK (
    (role = 'admin' AND student_id IS NULL AND committee_id IS NULL) OR
    (role = 'student' AND student_id IS NOT NULL AND committee_id IS NULL) OR
    (role = 'committee' AND student_id IS NOT NULL AND committee_id IS NOT NULL)
  )
);

CREATE TABLE auth_sessions (
  session_id CHAR(64) PRIMARY KEY,
  account_id INT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sessions_account FOREIGN KEY (account_id)
    REFERENCES user_accounts(account_id) ON DELETE CASCADE,
  INDEX idx_sessions_expiry (expires_at)
);

CREATE INDEX idx_registrations_event_status ON registrations(event_id, status);

CREATE TABLE student_status_audit (
  audit_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  student_id VARCHAR(20) NOT NULL,
  old_is_active BOOLEAN NOT NULL,
  new_is_active BOOLEAN NOT NULL,
  changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_student_status_audit_student (student_id, changed_at),
  CONSTRAINT fk_student_status_audit_student FOREIGN KEY (student_id)
    REFERENCES students(student_id) ON DELETE RESTRICT
);

DELIMITER $$
CREATE TRIGGER trg_student_status_audit
AFTER UPDATE ON students FOR EACH ROW
BEGIN
  IF OLD.is_active <> NEW.is_active THEN
    INSERT INTO student_status_audit (student_id, old_is_active, new_is_active)
    VALUES (NEW.student_id, OLD.is_active, NEW.is_active);
  END IF;
END$$

CREATE TRIGGER trg_students_prevent_delete
BEFORE DELETE ON students FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Student records are deactivated instead of deleted';
END$$
DELIMITER ;
