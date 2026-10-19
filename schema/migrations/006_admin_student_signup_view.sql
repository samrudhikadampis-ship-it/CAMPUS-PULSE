USE campuspulse;

CREATE OR REPLACE VIEW admin_student_signup_details AS
SELECT
  r.reg_id,
  r.student_id,
  s.first_name,
  s.last_name,
  s.dept_id,
  s.email,
  s.phone,
  s.department_verified,
  e.event_id,
  e.name,
  e.committee_id,
  r.application_answer,
  r.registered_on,
  r.status AS registration_status,
  p.status AS pay_status,
  p.amount,
  a.check_in,
  a.check_out,
  c.cert_id
FROM registrations r
JOIN students s ON s.student_id = r.student_id
JOIN event_status e ON e.event_id = r.event_id
LEFT JOIN payments p ON p.reg_id = r.reg_id
LEFT JOIN attendance a ON a.reg_id = r.reg_id
LEFT JOIN certificates c ON c.reg_id = r.reg_id;
