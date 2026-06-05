# Email Sequence System – Quick Reference Card

## What Was Built?

A complete 5-email automated nurture sequence for gift leads with:
- ✓ 5 beautiful, personalized HTML email templates
- ✓ Hourly cron job to send emails on schedule
- ✓ Smart purchase detection to pause sequences
- ✓ Complete tracking and status management
- ✓ Build passes, ready for deployment

## Files to Know

### Core Files Modified
- **lib/db.ts** – Database functions + schema columns
- **lib/email.ts** – 5 new email templates
- **app/api/gift-form/route.ts** – Initialize sequence
- **app/api/course-form/route.ts** – Pause sequence on purchase

### New Files Created
- **app/api/email-sequences/send/route.ts** – Cron endpoint
- **app/api/email-sequences/webhook/route.ts** – Purchase webhook
- **vercel.json** – Cron configuration

### Documentation
- **EMAIL_SEQUENCE.md** – Full technical docs
- **IMPLEMENTATION_GUIDE.md** – Deployment steps
- **EMAIL_SEQUENCE_SUMMARY.md** – Complete overview
- **SQL_SCHEMA_UPDATES.sql** – Database migration
- **QUICK_REFERENCE.md** – This file

## The 5 Emails

| # | Name | Day | Price Focus | Key Element |
|---|------|-----|-------------|-------------|
| 1 | Welcome + Video | 0 | — | Video preview, community |
| 2 | 5 Mistakes | 2 | — | Case study, education |
| 3 | SALES | 3 | **299k** | Headline, value stack |
| 4 | FOMO | 4 | **Price rising** | Social proof, 149+ members |
| 5 | LAST CHANCE | 6 | **199k** | Countdown, urgency |

## Quick Setup (5 Steps)

### Step 1: Database
```sql
ALTER TABLE gift_leads ADD COLUMN email_sequence_status TEXT DEFAULT 'pending_email1';
ALTER TABLE gift_leads ADD COLUMN next_email_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 day');
ALTER TABLE gift_leads ADD COLUMN email_sequence_paused BOOLEAN DEFAULT FALSE;
ALTER TABLE gift_leads ADD COLUMN last_email_sent_at TIMESTAMPTZ;
```

### Step 2: Environment Variable
```env
EMAIL_SEQUENCE_API_KEY=your-secret-key-here
```

### Step 3: Update vercel.json
```json
"x-api-key": "your-secret-key-here"
```

### Step 4: Deploy
```bash
git add .
git commit -m "Add email sequence system"
git push
```

### Step 5: Verify
1. Check Vercel Functions dashboard
2. Monitor `/api/email-sequences/send` cron logs
3. Verify first emails delivered

## Status Flow

```
pending_email1
    ↓ (Email 1 sent)
pending_email2
    ↓ (Email 2 sent)
pending_email3
    ↓ (Email 3 sent, check purchase)
pending_email4 (if not purchased) OR converted (if purchased)
    ↓ (Email 4 sent, check purchase)
email4_sent (if not purchased) OR converted (if purchased)
    ↓ (Email 5 sent)
completed (if all emails sent) OR converted (if purchased)
```

## Key API Endpoints

### Send Cron (Vercel runs hourly)
```
POST /api/email-sequences/send
Header: x-api-key: your-secret-key
```

### Purchase Webhook (Called on course purchase)
```
POST /api/email-sequences/webhook
Body: { "giftLeadId": 123 }
```

### Gift Form (Updated)
```
POST /api/gift-form
Body: { name, email, phone }
Response: { success: true, giftLeadId: 123 }
```

### Course Form (Updated)
```
POST /api/course-form
Body: { name, email, phone, giftLeadId: 123 }
Response: { success: true, paymentRef, amount, qr }
```

## Monitoring Queries

### Check sequence status
```sql
SELECT id, name, email, email_sequence_status, next_email_at, email_sequence_paused
FROM gift_leads
ORDER BY created_at DESC
LIMIT 10;
```

### Conversion rate
```sql
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN email_sequence_status = 'converted' THEN 1 ELSE 0 END) as converted,
  ROUND(100.0 * SUM(CASE WHEN email_sequence_status = 'converted' THEN 1 ELSE 0 END) / COUNT(*), 2) as rate
FROM gift_leads;
```

### Pending emails
```sql
SELECT COUNT(*) as pending
FROM gift_leads
WHERE next_email_at <= NOW()
  AND email_sequence_paused = FALSE
  AND email_sequence_status NOT IN ('completed', 'converted');
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Cron not running | Check vercel.json API key matches env var |
| Emails not sending | Verify RESEND_API_KEY valid |
| Customer still getting emails | Check email_sequence_paused = TRUE |
| Wrong email sent | Verify email_sequence_status value |

## Environment Variables Needed

```env
# Existing
DATABASE_URL=...
RESEND_API_KEY=...
FROM_EMAIL=...
DRIVE_LINK_GIFT=...
COURSE_GROUP_LINK=...

# New
EMAIL_SEQUENCE_API_KEY=generate-random-secret
```

## Test Locally

```bash
# Start dev server
npm run dev

# Send test emails
curl -X POST http://localhost:3000/api/email-sequences/send \
  -H "x-api-key: test-key"

# Should return: "totalProcessed": 0 (no pending in local)
```

## Deployment Checklist

- [ ] Apply SQL schema changes
- [ ] Set EMAIL_SEQUENCE_API_KEY env var
- [ ] Update vercel.json with API key
- [ ] Run `npm run build` (should pass)
- [ ] Push to main branch
- [ ] Verify cron in Vercel dashboard
- [ ] Test with real gift lead
- [ ] Monitor first email delivery
- [ ] Wait +2 days for Email 2
- [ ] Verify sequence progresses

## Build Status

```
✓ Compilation: PASSED
✓ TypeScript: PASSED
✓ Routes: 21/21 BUILT
✓ New Routes:
  ✓ /api/email-sequences/send
  ✓ /api/email-sequences/webhook
```

## Email Design Details

All 5 emails include:
- ✓ Responsive HTML (600px max-width)
- ✓ Personalized greeting: `${to.name}`
- ✓ Brand green color: `#006400`
- ✓ Clear CTA buttons
- ✓ Professional footer
- ✓ Mobile-friendly layout

## Next: Advanced Features

Once deployed and working:
1. **A/B Testing**: Test different Email 3/5 subject lines
2. **SMS Fallback**: Add SMS reminder for Email 5
3. **Analytics**: Track open/click rates via Resend webhooks
4. **Segmentation**: Different sequences by referral source
5. **Behavioral**: Skip emails if already purchased

## Files Summary

| Type | Count |
|------|-------|
| Files Created | 7 |
| Files Modified | 4 |
| Database Columns Added | 4 |
| Database Functions Added | 3 |
| Email Templates | 5 |
| API Routes Created | 2 |
| API Routes Modified | 2 |
| Total Code Lines | 1500+ |

## Key Numbers

- **Email Timeline**: Day 0, 2, 3, 4, 6
- **Total Sequence**: 6 days from Email 1 to Email 5 sent
- **Members Referenced**: 149+
- **Email 1 Price**: Free (gift)
- **Email 3 Price**: 299,000 VND
- **Email 5 Price**: 199,000 VND (33% off)
- **Price Increase Timeline**: Email 3 (299k) → Email 4+ (399k) → Email 5 (199k limited)

## Support

### Documentation Files
- `EMAIL_SEQUENCE.md` – Full technical reference
- `IMPLEMENTATION_GUIDE.md` – Step-by-step deployment
- `EMAIL_SEQUENCE_SUMMARY.md` – Complete system overview

### Quick Commands
```bash
# Verify build
npm run build

# Test cron locally
curl -X POST http://localhost:3000/api/email-sequences/send \
  -H "x-api-key: test-key"

# Check database
psql -c "SELECT * FROM gift_leads LIMIT 5;"
```

---

**Status**: Ready for Deployment ✓
**Last Updated**: 2026-06-05
**Next Step**: Apply database schema & set environment variables
