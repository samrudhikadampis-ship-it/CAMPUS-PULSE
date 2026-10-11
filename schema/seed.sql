USE campuspulse;

INSERT INTO departments VALUES
 ('EXTC','Electronics & Telecommunication'),
 ('CSE','Computer Science & Engineering'),
 ('CE','Computer Engineering');

INSERT INTO committees VALUES
 ('IEEE','IEEE SPIT','IEEE student branch','ieee_spit'),
 ('IEEECS','IEEE CS SPIT','IEEE Computer Society chapter','ieee.cs.spit'),
 ('CSI','C.S.I. SPIT','Computer Society of India student branch','csispit'),
 ('MUDRA','Mudra','Dance, music & theatre','mudra_spit'),
 ('FACE','FACE','Placements & career prep','face_spit'),
 ('OCULUS','Oculus','Photography & film','o.c.u.l.u.s_s.p.i.t'),
 ('ECELL','E-Cell SPIT','Entrepreneurship cell','ecellspit'),
 ('WIE','IEEE WIE SPIT','Women in Engineering affinity group','wie_ieee_spit'),
 ('FEC','FEC SPIT','Student committee','fec_spit'),
 ('ENACTUS','Enactus SPIT','Enactus student chapter',NULL),
 ('AGILITY','Agility Cup','Sports & e-sports tournament',NULL),
 ('CAMPUS','SPIT Campus','Institute-level events',NULL);

INSERT INTO venues VALUES
 ('v408','Room 408 (New building)'),
 ('gym','Gymkhana'),
 ('raj','Rajgad Fort'),
 ('powai','Hiranandani Gardens, Powai');

INSERT INTO events(committee_id,venue_id,name,description,start_ts,end_ts,fee,fee_note,audience,prize) VALUES
 ('CSI','v408','Codehousie','Competitive Programming x Housie.','2026-10-15 17:00','2026-10-15 20:00',150,'Solo; Duo Rs.200','FE | SE | TE + BE','Rs.7,500'),
 ('CSI',NULL,'SourceStart','Open-source contest. Register, raise your PR and get your name on the leaderboard.',NULL,NULL,NULL,NULL,NULL,NULL),
 ('ENACTUS','raj','Rajgad Trek 26','Where history meets adventure.','2026-10-17 00:00','2026-10-18 23:59',NULL,NULL,NULL,NULL),
 ('AGILITY',NULL,'Table Tennis - Mens Singles','Agility Cup table tennis, mens singles.','2026-10-08 00:00','2026-10-08 23:59',NULL,NULL,NULL,NULL),
 ('AGILITY',NULL,'Table Tennis - Doubles + Womens Singles','Rescheduled to 26 Oct. Registrations extended.','2026-10-26 00:00','2026-10-26 23:59',NULL,NULL,NULL,NULL),
 ('AGILITY',NULL,'Chess','Agility Cup chess, 28 and 29 Oct.','2026-10-28 00:00','2026-10-29 23:59',NULL,NULL,NULL,NULL),
 ('AGILITY',NULL,'BGMI','Agility Cup e-sports takeover.','2026-10-12 00:00','2026-10-12 23:59',NULL,NULL,NULL,NULL),
 ('AGILITY',NULL,'Free Fire','Agility Cup e-sports takeover.','2026-10-13 00:00','2026-10-13 23:59',NULL,NULL,NULL,NULL),
 ('AGILITY',NULL,'FC Mobile & FC 25 (PS5)','Agility Cup e-sports takeover.','2026-10-15 00:00','2026-10-15 23:59',NULL,NULL,NULL,NULL),
 ('AGILITY',NULL,'Clash Royale','Agility Cup e-sports takeover.','2026-10-16 00:00','2026-10-16 23:59',NULL,NULL,NULL,NULL),
 ('CAMPUS','gym','Personal Safety & Self-Defence Workshop','Practical self-defence skills.','2026-10-08 16:00','2026-10-08 17:00',NULL,NULL,'Girls',NULL),
 ('CAMPUS','powai','Sardar Patel Run for Unity 2026','10 KM, 5 KM and 3 KM fun run.','2026-11-01 05:30','2026-11-01 08:30',NULL,'Free for SPIT students',NULL,NULL);

INSERT INTO students
 (student_id,first_name,last_name,dept_id,study_year,division,email)
SELECT CONCAT('MOCK',LPAD(n,3,'0')),
       ELT(MOD(n-1,12)+1,'Aarav','Anaya','Ishaan','Meera','Kabir','Aditi','Reyansh','Sana','Vihaan','Ira','Arjun','Diya'),
       ELT(MOD(FLOOR((n-1)/12),12)+1,'Shah','Patel','Desai','Rao','Mehta','Kulkarni','Joshi','Nair','Iyer','Khan','Gupta','Sharma'),
       ELT(MOD(n-1,3)+1,'EXTC','CSE','CE'),
       ELT(MOD(FLOOR((n-1)/3),4)+1,'FE','SE','TE','BE'),
       ELT(MOD(FLOOR((n-1)/3),4)+1,'A','B','C','D'),
       CONCAT('mock',LPAD(n,3,'0'),'@students.campuspulse.test')
FROM (
 SELECT 1 AS n UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL
 SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL
 SELECT 9 UNION ALL SELECT 10 UNION ALL SELECT 11 UNION ALL SELECT 12 UNION ALL
 SELECT 13 UNION ALL SELECT 14 UNION ALL SELECT 15 UNION ALL SELECT 16 UNION ALL
 SELECT 17 UNION ALL SELECT 18 UNION ALL SELECT 19 UNION ALL SELECT 20 UNION ALL
 SELECT 21 UNION ALL SELECT 22 UNION ALL SELECT 23 UNION ALL SELECT 24 UNION ALL
 SELECT 25 UNION ALL SELECT 26 UNION ALL SELECT 27 UNION ALL SELECT 28 UNION ALL
 SELECT 29 UNION ALL SELECT 30 UNION ALL SELECT 31 UNION ALL SELECT 32 UNION ALL
 SELECT 33 UNION ALL SELECT 34 UNION ALL SELECT 35 UNION ALL SELECT 36 UNION ALL
 SELECT 37 UNION ALL SELECT 38 UNION ALL SELECT 39 UNION ALL SELECT 40 UNION ALL
 SELECT 41 UNION ALL SELECT 42 UNION ALL SELECT 43 UNION ALL SELECT 44 UNION ALL
 SELECT 45 UNION ALL SELECT 46 UNION ALL SELECT 47 UNION ALL SELECT 48
) AS numbers;
