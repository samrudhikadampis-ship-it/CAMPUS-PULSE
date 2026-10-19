USE campuspulse;

ALTER TABLE user_accounts
  MODIFY COLUMN password_hash VARCHAR(200) NOT NULL;
