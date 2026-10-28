USE campuspulse;

ALTER TABLE students
  MODIFY COLUMN dept_id VARCHAR(10) NULL DEFAULT NULL,
  MODIFY COLUMN study_year CHAR(2) NULL DEFAULT NULL,
  MODIFY COLUMN division VARCHAR(5) NULL DEFAULT NULL;

DROP PROCEDURE IF EXISTS upgrade_campus_records;
DELIMITER $$
CREATE PROCEDURE upgrade_campus_records()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema=DATABASE() AND table_name='user_accounts' AND column_name='first_name'
  ) THEN
    ALTER TABLE user_accounts ADD COLUMN first_name VARCHAR(50) NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema=DATABASE() AND table_name='user_accounts' AND column_name='last_name'
  ) THEN
    ALTER TABLE user_accounts ADD COLUMN last_name VARCHAR(50) NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema=DATABASE() AND table_name='user_accounts' AND column_name='email'
  ) THEN
    ALTER TABLE user_accounts ADD COLUMN email VARCHAR(120) NULL;
    ALTER TABLE user_accounts ADD UNIQUE KEY uq_user_accounts_email (email);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema=DATABASE() AND table_name='user_accounts' AND column_name='approval_status'
  ) THEN
    ALTER TABLE user_accounts
      ADD COLUMN approval_status ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Approved';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema=DATABASE() AND table_name='user_accounts'
      AND constraint_name='chk_account_identity'
  ) THEN
    ALTER TABLE user_accounts DROP CHECK chk_account_identity;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema=DATABASE() AND table_name='user_accounts'
      AND constraint_name='chk_account_identity_v2'
  ) THEN
    ALTER TABLE user_accounts ADD CONSTRAINT chk_account_identity_v2 CHECK (
      (role='admin' AND student_id IS NULL) OR
      (role='student' AND student_id IS NOT NULL AND committee_id IS NULL) OR
      (role='committee' AND committee_id IS NOT NULL)
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema=DATABASE() AND table_name='feedback' AND column_name='student_id'
  ) THEN
    ALTER TABLE feedback ADD COLUMN student_id VARCHAR(20) NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema=DATABASE() AND table_name='feedback' AND column_name='committee_id'
  ) THEN
    ALTER TABLE feedback ADD COLUMN committee_id VARCHAR(15) NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema=DATABASE() AND table_name='feedback' AND column_name='event_id'
  ) THEN
    ALTER TABLE feedback ADD COLUMN event_id INT NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema=DATABASE() AND table_name='feedback' AND column_name='request_id'
  ) THEN
    ALTER TABLE feedback ADD COLUMN request_id CHAR(36) NULL;
    ALTER TABLE feedback ADD UNIQUE KEY uq_feedback_request_id (request_id);
  END IF;

  BEGIN
    DECLARE reg_fk VARCHAR(64) DEFAULT NULL;
    DECLARE reg_unique VARCHAR(64) DEFAULT NULL;
    DECLARE query_text VARCHAR(512);

    SELECT constraint_name INTO reg_fk
    FROM information_schema.key_column_usage
    WHERE table_schema=DATABASE() AND table_name='feedback' AND column_name='reg_id'
      AND referenced_table_name IS NOT NULL LIMIT 1;
    IF reg_fk IS NOT NULL THEN
      SET @query_text=CONCAT('ALTER TABLE feedback DROP FOREIGN KEY `',reg_fk,'`');
      PREPARE stmt FROM @query_text;
      EXECUTE stmt;
      DEALLOCATE PREPARE stmt;
    END IF;

    SELECT index_name INTO reg_unique
    FROM information_schema.statistics
    WHERE table_schema=DATABASE() AND table_name='feedback' AND column_name='reg_id'
      AND non_unique=0 AND index_name<>'PRIMARY' LIMIT 1;
    IF reg_unique IS NOT NULL THEN
      SET @query_text=CONCAT('ALTER TABLE feedback DROP INDEX `',reg_unique,'`');
      PREPARE stmt FROM @query_text;
      EXECUTE stmt;
      DEALLOCATE PREPARE stmt;
    END IF;
  END;

  ALTER TABLE feedback MODIFY COLUMN reg_id INT NULL;
  UPDATE feedback f
    LEFT JOIN registrations r ON r.reg_id=f.reg_id
    LEFT JOIN events e ON e.event_id=r.event_id
    SET f.student_id=COALESCE(f.student_id,r.student_id),
        f.event_id=COALESCE(f.event_id,r.event_id),
        f.committee_id=COALESCE(f.committee_id,e.committee_id);
  ALTER TABLE feedback
    MODIFY COLUMN student_id VARCHAR(20) NOT NULL,
    MODIFY COLUMN committee_id VARCHAR(15) NOT NULL;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.key_column_usage
    WHERE table_schema=DATABASE() AND table_name='feedback' AND column_name='reg_id'
      AND referenced_table_name='registrations'
  ) THEN
    ALTER TABLE feedback ADD CONSTRAINT fk_feedback_registration
      FOREIGN KEY (reg_id) REFERENCES registrations(reg_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.key_column_usage
    WHERE table_schema=DATABASE() AND table_name='feedback' AND column_name='student_id'
      AND referenced_table_name='students'
  ) THEN
    ALTER TABLE feedback ADD CONSTRAINT fk_feedback_student
      FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.key_column_usage
    WHERE table_schema=DATABASE() AND table_name='feedback' AND column_name='committee_id'
      AND referenced_table_name='committees'
  ) THEN
    ALTER TABLE feedback ADD CONSTRAINT fk_feedback_committee
      FOREIGN KEY (committee_id) REFERENCES committees(committee_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.key_column_usage
    WHERE table_schema=DATABASE() AND table_name='feedback' AND column_name='event_id'
      AND referenced_table_name='events'
  ) THEN
    ALTER TABLE feedback ADD CONSTRAINT fk_feedback_event
      FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE SET NULL;
  END IF;
END$$
DELIMITER ;

CALL upgrade_campus_records();
DROP PROCEDURE upgrade_campus_records;

INSERT INTO students
  (student_id,first_name,last_name,dept_id,study_year,division,email,gender,is_active,department_verified)
WITH RECURSIVE sequence_numbers(n) AS (
  SELECT 1
  UNION ALL
  SELECT n+1 FROM sequence_numbers WHERE n<120
)
SELECT CONCAT('CP-SEED-',LPAD(n,4,'0')),
  ELT(MOD(n-1,20)+1,'Aarav','Anaya','Ishaan','Meera','Kabir','Aditi','Reyansh','Sana','Vihaan','Ira',
    'Arjun','Diya','Advait','Kavya','Rohan','Tara','Neel','Mira','Dev','Nisha'),
  ELT(MOD(FLOOR((n-1)/20),20)+1,'Shah','Patel','Desai','Rao','Mehta','Kulkarni','Joshi','Nair','Iyer','Khan',
    'Gupta','Sharma','Pillai','Kapoor','Bose','Menon','Saxena','Ghosh','Shetty','Malhotra'),
  ELT(MOD(n-1,3)+1,'CSE','CE','EXTC'),
  ELT(MOD(FLOOR((n-1)/3),4)+1,'FE','SE','TE','BE'),
  ELT(MOD(FLOOR((n-1)/3),4)+1,'A','B','C','D'),
  CONCAT('student',LPAD(n,4,'0'),'@campuspulse.example'),
  ELT(MOD(n-1,3)+1,'Female','Male','Other'),TRUE,FALSE
FROM sequence_numbers
ON DUPLICATE KEY UPDATE student_id=VALUES(student_id);

INSERT INTO events
  (committee_id,venue_id,name,description,start_ts,end_ts,fee,fee_note,audience,capacity,
   registration_open,registration_closes_at,registration_question)
SELECT c.committee_id,'v408',
  CONCAT('CampusPulse Directory ',c.committee_id,
    CASE slots.slot WHEN 1 THEN ' Showcase' ELSE ' Workshop' END),
  CONCAT('A student event organized by ',c.name,'. All students are welcome.'),
  DATE_ADD(NOW(),INTERVAL CASE slots.slot WHEN 1 THEN -30 ELSE 10 END DAY),
  DATE_ADD(DATE_ADD(NOW(),INTERVAL CASE slots.slot WHEN 1 THEN -30 ELSE 10 END DAY),INTERVAL 2 HOUR),
  0,'Free','SPIT students',200,slots.slot=2,
  CASE slots.slot WHEN 1 THEN DATE_SUB(NOW(),INTERVAL 31 DAY)
    ELSE DATE_SUB(DATE_ADD(NOW(),INTERVAL 10 DAY),INTERVAL 1 DAY) END,
  NULL
FROM committees c
CROSS JOIN (SELECT 1 AS slot UNION ALL SELECT 2) slots
WHERE NOT EXISTS (
  SELECT 1 FROM events existing
  WHERE existing.committee_id=c.committee_id
    AND existing.name=CONCAT('CampusPulse Directory ',c.committee_id,
      CASE slots.slot WHEN 1 THEN ' Showcase' ELSE ' Workshop' END)
);

INSERT IGNORE INTO event_links (event_id,label,url)
SELECT event_id,'Event details','https://campuspulse.example/events'
FROM events WHERE name LIKE 'CampusPulse Directory %';

INSERT IGNORE INTO registrations (student_id,event_id,registered_on,status,application_answer)
WITH RECURSIVE registration_slots(n) AS (
  SELECT 1
  UNION ALL
  SELECT n+1 FROM registration_slots WHERE n<12
)
SELECT CONCAT('CP-SEED-',LPAD(MOD(e.event_id*12+registration_slots.n-1,120)+1,4,'0')),
  e.event_id,DATE(DATE_SUB(NOW(),INTERVAL MOD(registration_slots.n,10) DAY)),
  'Confirmed','Interested in participating'
FROM events e CROSS JOIN registration_slots
WHERE e.name LIKE 'CampusPulse Directory %';

INSERT IGNORE INTO attendance (reg_id,status,check_in)
SELECT r.reg_id,'Attended',DATE_SUB(NOW(),INTERVAL 29 DAY)
FROM registrations r JOIN events e ON e.event_id=r.event_id
WHERE e.name LIKE 'CampusPulse Directory % Showcase'
  AND e.end_ts<NOW() AND MOD(r.reg_id,3)=0;

INSERT INTO feedback (reg_id,student_id,committee_id,event_id,request_id,rating,comments,submitted_on)
SELECT r.reg_id,r.student_id,e.committee_id,e.event_id,UUID(),4,
  'Enjoyed meeting students from across campus.',DATE(NOW())
FROM registrations r JOIN events e ON e.event_id=r.event_id
JOIN attendance a ON a.reg_id=r.reg_id
WHERE e.name LIKE 'CampusPulse Directory % Showcase'
  AND MOD(r.reg_id,2)=0
  AND NOT EXISTS (SELECT 1 FROM feedback f WHERE f.reg_id=r.reg_id);
