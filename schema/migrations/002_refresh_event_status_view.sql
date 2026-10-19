USE campuspulse;

CREATE OR REPLACE VIEW event_status AS
SELECT e.*,
  CASE WHEN e.start_ts IS NULL THEN 'live'
       WHEN NOW() < e.start_ts THEN 'up'
       WHEN NOW() <= e.end_ts THEN 'live'
       ELSE 'done'
  END AS status
FROM events e;
