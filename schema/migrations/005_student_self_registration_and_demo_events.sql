USE campuspulse;

ALTER TABLE students
  ADD COLUMN department_verified BOOLEAN NOT NULL DEFAULT TRUE;

INSERT INTO events
  (committee_id,venue_id,name,description,start_ts,end_ts,fee,fee_note,audience,prize,capacity,
   registration_open,registration_closes_at,eligible_dept_id,registration_question)
SELECT demo.committee_id,demo.venue_id,demo.name,demo.description,
       DATE_ADD(NOW(), INTERVAL (3 + demo.day_offset * 24) HOUR),
       DATE_ADD(NOW(), INTERVAL (5 + demo.day_offset * 24) HOUR),
       0,'Free', 'SPIT students',NULL,60,TRUE,
       DATE_ADD(NOW(), INTERVAL (2 + demo.day_offset * 24) HOUR),NULL,
       'What interests you about joining this committee?'
FROM (
  SELECT 0 AS day_offset,'CSI' AS committee_id,'v408' AS venue_id,'CampusPulse Demo: Code Sprint' AS name,
    'A friendly, timed coding challenge for SPIT students.' AS description
  UNION ALL SELECT 1,'IEEE','v408','CampusPulse Demo: Build Night','A hands-on evening to prototype a small technology project.'
  UNION ALL SELECT 2,'MUDRA','gym','CampusPulse Demo: Open Mic','An inclusive showcase for music, poetry and performance.'
  UNION ALL SELECT 3,'FACE','v408','CampusPulse Demo: Career Toolkit','A practical workshop on resumes, interviews and networking.'
  UNION ALL SELECT 4,'OCULUS','powai','CampusPulse Demo: Photo Walk','A guided photography walk and peer review session.'
  UNION ALL SELECT 5,'ECELL','v408','CampusPulse Demo: Startup Jam','A team ideation session for early-stage campus ventures.'
  UNION ALL SELECT 6,'AGILITY','gym','CampusPulse Demo: Sports Mixer','A casual multi-sport meetup open to every skill level.'
) AS demo
WHERE NOT EXISTS (
  SELECT 1 FROM events existing
  WHERE existing.name=demo.name AND existing.committee_id=demo.committee_id
);

CREATE OR REPLACE VIEW event_status AS
SELECT e.*,
  CASE WHEN e.start_ts IS NULL THEN 'live'
       WHEN NOW() < e.start_ts THEN 'up'
       WHEN NOW() <= e.end_ts THEN 'live'
       ELSE 'done'
  END AS status
FROM events e;
