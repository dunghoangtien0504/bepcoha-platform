-- SQL Schema Updates for Email Sequence System
-- Run these commands to add email sequence tracking to gift_leads table

-- Add email_sequence_status column
ALTER TABLE gift_leads
ADD COLUMN IF NOT EXISTS email_sequence_status TEXT DEFAULT 'pending_email1';

-- Add next_email_at column (when to send next email)
ALTER TABLE gift_leads
ADD COLUMN IF NOT EXISTS next_email_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 day');

-- Add email_sequence_paused column (stops sequence when customer purchases)
ALTER TABLE gift_leads
ADD COLUMN IF NOT EXISTS email_sequence_paused BOOLEAN DEFAULT FALSE;

-- Add last_email_sent_at column (track when last email was sent)
ALTER TABLE gift_leads
ADD COLUMN IF NOT EXISTS last_email_sent_at TIMESTAMPTZ;

-- Verify schema
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'gift_leads'
ORDER BY ordinal_position;

-- Sample queries to check data

-- Find all leads pending Email 1
SELECT id, name, email, email_sequence_status, next_email_at
FROM gift_leads
WHERE email_sequence_status = 'pending_email1'
ORDER BY created_at DESC;

-- Find all leads with paused sequences (converted)
SELECT id, name, email, email_sequence_status, email_sequence_paused, last_email_sent_at
FROM gift_leads
WHERE email_sequence_paused = TRUE
ORDER BY last_email_sent_at DESC;

-- Find leads ready for next email
SELECT id, name, email, email_sequence_status, next_email_at
FROM gift_leads
WHERE next_email_at <= NOW()
  AND email_sequence_paused = FALSE
  AND email_sequence_status NOT IN ('completed', 'converted')
ORDER BY next_email_at ASC;

-- Statistics: Email sequence status breakdown
SELECT email_sequence_status, COUNT(*) as count
FROM gift_leads
GROUP BY email_sequence_status
ORDER BY count DESC;

-- Statistics: Conversion rate
SELECT
  COUNT(*) as total_gift_leads,
  SUM(CASE WHEN email_sequence_status = 'converted' THEN 1 ELSE 0 END) as converted,
  ROUND(
    100.0 * SUM(CASE WHEN email_sequence_status = 'converted' THEN 1 ELSE 0 END) / COUNT(*),
    2
  ) as conversion_percentage
FROM gift_leads;
