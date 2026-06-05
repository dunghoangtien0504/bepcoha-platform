# Email Sequence System – Implementation Guide

## What Was Built

A complete 5-email nurture sequence system for gift leads that:
1. Sends Email 1 immediately when customer submits gift form
2. Sends Emails 2-5 on a scheduled timeline (+1-2 days between each)
3. Pauses sequence automatically when customer purchases the course
4. Tracks conversion rate from gift lead to paying customer

## Files Created/Modified

### New Files
- `app/api/email-sequences/send/route.ts` – Cron endpoint for sending emails
- `app/api/email-sequences/webhook/route.ts` – Webhook to pause sequence on purchase
- `vercel.json` – Cron job configuration
- `EMAIL_SEQUENCE.md` – Complete documentation
- `SQL_SCHEMA_UPDATES.sql` – Database schema changes
- `IMPLEMENTATION_GUIDE.md` – This file

### Modified Files
- `lib/db.ts` – Added 4 new columns + 3 new functions
- `lib/email.ts` – Added 5 new email template functions
- `app/api/gift-form/route.ts` – Initialize sequence on form submit
- `app/api/course-form/route.ts` – Trigger webhook on purchase

## Step-by-Step Deployment

### Step 1: Database Schema Update

**For PostgreSQL** (Vercel Postgres / local):
```bash
# SSH into database and run:
psql -U postgres -d hacofood -f SQL_SCHEMA_UPDATES.sql
```

Or use an SQL client to run the commands in `SQL_SCHEMA_UPDATES.sql`:
```sql
ALTER TABLE gift_leads ADD COLUMN IF NOT EXISTS email_sequence_status TEXT DEFAULT 'pending_email1';
ALTER TABLE gift_leads ADD COLUMN IF NOT EXISTS next_email_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 day');
ALTER TABLE gift_leads ADD COLUMN IF NOT EXISTS email_sequence_paused BOOLEAN DEFAULT FALSE;
ALTER TABLE gift_leads ADD COLUMN IF NOT EXISTS last_email_sent_at TIMESTAMPTZ;
```

### Step 2: Environment Variables

Add to `.env.local`:
```env
EMAIL_SEQUENCE_API_KEY=generate-a-random-secret-key-here
```

Generate a secure key:
```bash
# On Mac/Linux:
openssl rand -hex 32

# On Windows PowerShell:
[Convert]::ToBase64String($(([guid]::NewGuid()).ToByteArray())) | Select-Object -First 32
```

### Step 3: Update vercel.json

The `vercel.json` file was created with:
```json
{
  "crons": [
    {
      "path": "/api/email-sequences/send",
      "schedule": "0 * * * *",
      "headers": {
        "x-api-key": "REPLACE_WITH_YOUR_SECRET_KEY"
      }
    }
  ]
}
```

**Update the API key**:
```json
{
  "crons": [
    {
      "path": "/api/email-sequences/send",
      "schedule": "0 * * * *",
      "headers": {
        "x-api-key": "your-secret-key-from-step-2"
      }
    }
  ]
}
```

### Step 4: Test Locally (Optional)

```bash
# Start development server
npm run dev

# Test cron endpoint
curl -X POST http://localhost:3000/api/email-sequences/send \
  -H "x-api-key: your-secret-key"
```

Expected response:
```json
{
  "success": true,
  "totalProcessed": 0,
  "results": []
}
```

(0 results because no leads are pending in local dev)

### Step 5: Build & Deploy

```bash
# Build locally to verify
npm run build

# Deploy to Vercel (if using Vercel)
git add .
git commit -m "Add email sequence system for gift leads"
git push origin main

# Or manually deploy with Vercel CLI
vercel deploy
```

### Step 6: Verify Deployment

1. **Check Vercel Cron**: Dashboard → Functions → Crons
   - Should show `/api/email-sequences/send` running hourly
   - Check logs for last run

2. **Test with Real Data**:
   - Submit test form via gift-form endpoint
   - Check database: `SELECT * FROM gift_leads WHERE email LIKE 'test%'`
   - Verify `email_sequence_status = 'pending_email2'`

3. **Monitor Email Delivery**:
   - Check Resend dashboard
   - Verify emails are being sent

## Email Sequence Status Values

| Status | Meaning |
|--------|---------|
| `pending_email1` | Ready to send Email 1 |
| `email1_sent` | Email 1 sent, waiting for +2 days |
| `pending_email2` | Ready to send Email 2 |
| `email2_sent` | Email 2 sent, waiting for +1 day |
| `pending_email3` | Ready to send Email 3 (SALES) |
| `email3_sent` | Email 3 sent, waiting for +1 day |
| `pending_email4` | Ready to send Email 4 (FOMO) |
| `email4_sent` | Email 4 sent, waiting for +2 days |
| `pending_email5` | Ready to send Email 5 (LAST CHANCE) |
| `email5_sent` | Email 5 sent, waiting for completion |
| `completed` | All 5 emails sent, sequence ended |
| `converted` | Customer purchased course, sequence stopped |

## Cron Job Details

**Schedule**: `0 * * * *` = Every hour at :00 minutes

**What it does**:
1. Finds all gift_leads where `next_email_at <= NOW()`
2. Sends appropriate email based on `email_sequence_status`
3. Updates status and calculates next email time
4. Logs results

**If you need different schedule**:
- `*/15 * * * *` = Every 15 minutes
- `0 9 * * *` = Daily at 9 AM
- `0 9 * * 1` = Every Monday at 9 AM

Update in `vercel.json`:
```json
"schedule": "0 9 * * *"
```

## Monitoring & Debugging

### Check Pending Emails

```sql
SELECT id, name, email, email_sequence_status, next_email_at
FROM gift_leads
WHERE email_sequence_paused = FALSE
  AND email_sequence_status NOT IN ('completed', 'converted')
ORDER BY next_email_at ASC;
```

### Check Conversions

```sql
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN email_sequence_status = 'converted' THEN 1 ELSE 0 END) as converted,
  ROUND(
    100.0 * SUM(CASE WHEN email_sequence_status = 'converted' THEN 1 ELSE 0 END) / COUNT(*),
    2
  ) as conversion_rate_percent
FROM gift_leads;
```

### Manual Trigger (Emergency)

If you need to send emails manually (not waiting for cron):
```bash
curl -X POST https://hacofood.vn/api/email-sequences/send \
  -H "x-api-key: your-secret-key"
```

### Check Last Cron Run

In Vercel dashboard:
1. Go to project
2. Click "Functions"
3. Look for `/api/email-sequences/send`
4. Check "Last Run" timestamp and logs

## Troubleshooting

### Problem: Cron not running

**Solution 1**: Verify API key in `vercel.json` matches environment variable
```bash
vercel env ls  # Check all env vars
```

**Solution 2**: Check Vercel logs
```bash
vercel logs --follow
```

**Solution 3**: Redeploy with fresh env vars
```bash
git push origin main  # Triggers auto-deploy
```

### Problem: Emails not sending

**Check 1**: Verify Resend API key
```bash
echo $RESEND_API_KEY
```

**Check 2**: Check database connection
```sql
SELECT COUNT(*) FROM gift_leads;
```

**Check 3**: Test email endpoint directly
```bash
curl -X POST http://localhost:3000/api/email-sequences/send \
  -H "x-api-key: test-key" \
  -H "Content-Type: application/json"
```

**Check 4**: Review server logs in Vercel dashboard

### Problem: Customers still receiving emails after purchase

**Check**: Verify webhook is being called
```sql
SELECT * FROM gift_leads 
WHERE email_sequence_paused = TRUE
LIMIT 5;
```

If not paused, manually pause:
```sql
UPDATE gift_leads
SET email_sequence_paused = TRUE, email_sequence_status = 'converted'
WHERE id = YOUR_ID;
```

## Performance Considerations

- Each cron run processes up to ~100 gift_leads at a time
- Resend API rate limits: 100 emails/second (should be fine)
- Database queries are optimized with proper indexes
- If you have 10k+ leads, consider batching or running cron more frequently

## Next Steps / Future Enhancements

1. **A/B Testing**: Test different Email 3 & 5 subject lines
2. **Segmentation**: Send different emails based on referral source
3. **Analytics**: Add open tracking via Resend webhooks
4. **SMS Fallback**: Send SMS reminder for Email 5
5. **Behavioral Triggers**: Skip emails if lead already purchased
6. **Dashboard**: Create admin page to view sequence stats

## Support

For issues or questions:
1. Check `EMAIL_SEQUENCE.md` for technical details
2. Review Vercel cron documentation: https://vercel.com/docs/functions/crons
3. Check Resend email logs: https://resend.com/dashboard
4. Review database logs for errors

## Rollback (If Needed)

If you need to disable the email sequence:

```sql
-- Pause all sequences
UPDATE gift_leads
SET email_sequence_paused = TRUE
WHERE email_sequence_paused = FALSE;

-- Or remove cron by deleting vercel.json and redeploying
```

---

**Deployment Date**: [Enter date]
**Deployed By**: [Enter name]
**Notes**: [Any special notes or customizations]
