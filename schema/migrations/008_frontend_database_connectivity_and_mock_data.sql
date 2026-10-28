-- CampusPulse — Migration 008: Direct Frontend-to-Database Sync & Rich Mock Data
-- Connects Frontend directly to BCNF entities, provides verified procedures and loads comprehensive mock data
USE campuspulse;

-- 1. Ensure feedback table supports direct web submissions with UUID request idempotency
ALTER TABLE feedback
  ADD COLUMN IF NOT EXISTS request_id CHAR(36) NULL,
  ADD COLUMN IF NOT EXISTS student_id VARCHAR(20) NULL,
  ADD COLUMN IF NOT EXISTS committee_id VARCHAR(15) NULL,
  ADD COLUMN IF NOT EXISTS event_id INT NULL;

-- 2. Comprehensive Demo Students across all SPIT departments
INSERT INTO students (student_id, first_name, last_name, dept_id, study_year, division, phone, email, gender, is_active, department_verified) VALUES
('CP-S001', 'Samrudhi', 'Kadampi', 'CSE', 'TE', 'A', '9876543210', 'samrudhi@spit.ac.in', 'Female', 1, 1),
('CP-S002', 'Aditya', 'Verma', 'CE', 'BE', 'B', '9876543211', 'aditya.v@spit.ac.in', 'Male', 1, 1),
('CP-S003', 'Rhea', 'Kulkarni', 'EXTC', 'SE', 'A', '9876543212', 'rhea.k@spit.ac.in', 'Female', 1, 1),
('CP-S004', 'Tanmay', 'Bhat', 'CSE', 'TE', 'B', '9876543213', 'tanmay.b@spit.ac.in', 'Male', 1, 1),
('CP-S005', 'Ananya', 'Patel', 'CE', 'SE', 'C', '9876543214', 'ananya.p@spit.ac.in', 'Female', 1, 1),
('CP-S006', 'Dev', 'Sharma', 'EXTC', 'BE', 'B', '9876543215', 'dev.s@spit.ac.in', 'Male', 1, 1),
('CP-S007', 'Ira', 'Mehta', 'CSE', 'FE', 'A', '9876543216', 'ira.m@spit.ac.in', 'Female', 1, 1),
('CP-S008', 'Kabir', 'Joshi', 'CE', 'TE', 'A', '9876543217', 'kabir.j@spit.ac.in', 'Male', 1, 1),
('CP-S009', 'Sana', 'Khan', 'EXTC', 'SE', 'B', '9876543218', 'sana.k@spit.ac.in', 'Female', 1, 1),
('CP-S010', 'Arjun', 'Gupta', 'CSE', 'BE', 'A', '9876543219', 'arjun.g@spit.ac.in', 'Male', 1, 1)
ON DUPLICATE KEY UPDATE first_name=VALUES(first_name), last_name=VALUES(last_name), department_verified=1;

-- 3. Realistic Demo Events for Multiple Committees (Completed, Ongoing Live, Upcoming)
INSERT INTO events (event_id, committee_id, venue_id, name, description, start_ts, end_ts, fee, fee_note, audience, prize, capacity, registration_open, registration_question) VALUES
(1, 'CSI', 'v408', 'CSI HackSprint 2026', 'An intensive 24-hour algorithmic development and systems hackathon.', DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY), 0, 'Free entry', 'All SPIT students', 'Rs. 25,000', 80, 0, 'Github profile link'),
(2, 'CSI', 'seminar1', 'CSI Web3 & Cloud Expo', 'Interactive masterclass on decentralized web architectures and cloud-native microservices.', DATE_SUB(NOW(), INTERVAL 1 HOUR), DATE_ADD(NOW(), INTERVAL 3 HOUR), 0, 'Free entry', 'Engineering Students', 'Trophies & Swag', 100, 1, 'Why do you want to attend?'),
(3, 'CSI', 'auditorium', 'CSI National Tech Conclave 2026', 'Annual tech keynote featuring industry leaders, robotics exhibits, and project showcases.', DATE_ADD(NOW(), INTERVAL 3 DAY), DATE_ADD(DATE_ADD(NOW(), INTERVAL 3 DAY), INTERVAL 6 HOUR), 0, 'Free', 'Open to all', 'Rs. 50,000', 250, 1, 'Areas of interest'),
(4, 'IEEE', 'v408', 'IEEE Embedded Systems Bootcamp', 'Hands-on workshop on STM32 microcontrollers and RTOS development.', DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY), 0, 'Free', 'EXTC and CSE students', 'Certificate & Kits', 60, 0, 'Prior C programming experience'),
(5, 'IEEE', 'auditorium', 'IEEE AI & Robotics Colloquium', 'Deep dive into autonomous mobile robots, computer vision, and ROS2.', DATE_ADD(NOW(), INTERVAL 5 DAY), DATE_ADD(DATE_ADD(NOW(), INTERVAL 5 DAY), INTERVAL 5 HOUR), 0, 'Free', 'All branches', 'Merit Awards', 150, 1, 'Robotics club member? (Yes/No)'),
(6, 'MUDRA', 'auditorium', 'Aarohan Annual Cultural Night', 'The biggest cultural showcase of SPIT featuring theatrical arts, music bands, and dance troupes.', DATE_ADD(NOW(), INTERVAL 7 DAY), DATE_ADD(DATE_ADD(NOW(), INTERVAL 7 DAY), INTERVAL 8 HOUR), 0, 'Free', 'All SPITians', 'Trophies', 300, 1, 'Performance category'),
(7, 'FACE', 'seminar1', 'FACE Campus Placement Masterclass', 'Comprehensive prep on system design, coding rounds, resume teardowns, and HR interviews.', DATE_ADD(NOW(), INTERVAL 2 DAY), DATE_ADD(DATE_ADD(NOW(), INTERVAL 2 DAY), INTERVAL 4 HOUR), 0, 'Free', 'TE & BE students', 'Mock Interview Pass', 120, 1, 'Target company / role'),
(8, 'OCULUS', 'powai', 'Oculus Cinematography Walk 2026', 'Field photography, framing techniques, and color grading workshop around Powai.', DATE_ADD(NOW(), INTERVAL 4 DAY), DATE_ADD(DATE_ADD(NOW(), INTERVAL 4 DAY), INTERVAL 4 HOUR), 0, 'Free', 'All photo enthusiasts', 'Camera Gear', 50, 1, 'Camera model (DSLR/Phone)')
ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), capacity=VALUES(capacity);

-- 4. Mock Registrations & Attendance
INSERT IGNORE INTO registrations (reg_id, student_id, event_id, registered_on, status, application_answer) VALUES
(1, 'CP-S001', 1, CURRENT_DATE, 'Confirmed', 'https://github.com/samrudhi'),
(2, 'CP-S002', 1, CURRENT_DATE, 'Confirmed', 'https://github.com/aditya'),
(3, 'CP-S003', 1, CURRENT_DATE, 'Confirmed', 'https://github.com/rhea'),
(4, 'CP-S001', 3, CURRENT_DATE, 'Confirmed', 'Cloud Systems & AI'),
(5, 'CP-S004', 3, CURRENT_DATE, 'Confirmed', 'Competitive Programming'),
(6, 'CP-S003', 4, CURRENT_DATE, 'Confirmed', 'Basic C and Arduino'),
(7, 'CP-S006', 4, CURRENT_DATE, 'Confirmed', 'Microcontroller enthusiast'),
(8, 'CP-S005', 7, CURRENT_DATE, 'Confirmed', 'Software Development Engineer');

-- 5. Attendance & Certificates for Completed Events
INSERT IGNORE INTO attendance (attendance_id, reg_id, status, check_in) VALUES
(1, 1, 'Attended', DATE_SUB(NOW(), INTERVAL 2 DAY)),
(2, 2, 'Attended', DATE_SUB(NOW(), INTERVAL 2 DAY)),
(3, 6, 'Attended', DATE_SUB(NOW(), INTERVAL 3 DAY));

INSERT IGNORE INTO certificates (cert_id, reg_id, cert_type, issued_on) VALUES
(1, 1, 'Participation', CURRENT_DATE),
(2, 6, 'Participation', CURRENT_DATE);

-- 6. Sample Verified Feedback Records
INSERT INTO feedback (feedback_id, reg_id, student_id, committee_id, event_id, request_id, rating, comments, submitted_on) VALUES
(1, 1, 'CP-S001', 'CSI', 1, 'fdbk-csi-001', 5, 'Exceptional problem statements and smooth judging process. Great job CSI team!', CURRENT_DATE),
(2, 2, 'CP-S002', 'CSI', 1, 'fdbk-csi-002', 4, 'Great mentors during the overnight coding phase. Venue air conditioning could be improved.', CURRENT_DATE),
(3, 6, 'CP-S003', 'IEEE', 4, 'fdbk-ieee-001', 5, 'The hardware debugging kits provided were top-notch. Loved the hands-on sessions!', CURRENT_DATE)
ON DUPLICATE KEY UPDATE rating=VALUES(rating), comments=VALUES(comments);
