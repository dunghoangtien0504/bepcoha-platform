# Email Sequence System – Khóa học Dưa Cà Muối

## Overview

Hệ thống email chăm sóc 5-email cho khách nhận quà miễn phí (gift_leads). Mỗi email được thiết kế để xây dựng tín nhiệm, chia sẻ giá trị, và cuối cùng chuyển đổi khách thành học viên khóa học.

## Email Sequence Flow

```
Day 0: Gift Form Submit
  ↓
  → Send Email 1 (Welcome + Video Preview)
  → Set status: pending_email2
  → Schedule: +2 days

Day 2: Email 2
  ↓
  → Send Email 2 (5 Mistakes Case Study)
  → Set status: pending_email3
  → Schedule: +1 day

Day 3: Email 3 (SALES)
  ↓
  → Send Email 3 (Sales Pitch – 299k)
  → Set status: pending_email4
  → Schedule: +1 day
  → Check: If purchased → STOP (converted)

Day 4: Email 4 (FOMO)
  ↓
  → Send Email 4 (Social Proof – 149+ members)
  → Set status: email4_sent
  → Schedule: +2 days
  → Check: If purchased → STOP (converted)

Day 6: Email 5 (LAST CHANCE)
  ↓
  → Send Email 5 (Red Promo – 199k Last Chance)
  → Set status: completed
  → Check: If purchased → STOP (converted)

STOP: After Email 5 OR when customer purchases course
```

## Database Schema

### gift_leads Table – New Columns

```sql
ALTER TABLE gift_leads ADD COLUMN IF NOT EXISTS email_sequence_status TEXT DEFAULT 'pending_email1';
-- Status values: pending_email1, email1_sent, pending_email2, email2_sent, pending_email3, email3_sent, pending_email4, email4_sent, pending_email5, email5_sent, completed, converted

ALTER TABLE gift_leads ADD COLUMN IF NOT EXISTS next_email_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 day');
-- Timestamp when the next email should be sent

ALTER TABLE gift_leads ADD COLUMN IF NOT EXISTS email_sequence_paused BOOLEAN DEFAULT FALSE;
-- Set to TRUE if customer purchases course (stops all future emails)

ALTER TABLE gift_leads ADD COLUMN IF NOT EXISTS last_email_sent_at TIMESTAMPTZ;
-- Track when the last email was sent
```

## API Routes

### 1. POST `/api/email-sequences/send`

**Purpose**: Cron endpoint to send pending emails in the sequence

**Authentication**: Requires `x-api-key` header

**Query**: Finds all gift_leads where:
- `next_email_at <= NOW()`
- `email_sequence_paused = FALSE`
- `email_sequence_status NOT IN ('completed', 'converted')`

**Response**:
```json
{
  "success": true,
  "totalProcessed": 5,
  "results": [
    {
      "id": 123,
      "email": "customer@example.com",
      "status": "email1_sent",
      "success": true
    }
  ]
}
```

**Example**:
```bash
curl -X POST https://hacofood.vn/api/email-sequences/send \
  -H "x-api-key: your-secret-key"
```

### 2. POST `/api/email-sequences/webhook`

**Purpose**: Called when a gift lead purchases the course (to pause email sequence)

**Body**:
```json
{
  "giftLeadId": 123
}
```

**Action**: Sets `email_sequence_paused = TRUE` and `email_sequence_status = 'converted'`

**Note**: This is called automatically from `/api/course-form` when a gift lead makes a purchase.

## Email Templates

### Email 1: Welcome + Video Preview (+1 day)
- **Subject**: "Cô Hạ vừa gửi quà cho bạn – Mở ngay! 🎁"
- **Content**: 
  - Warm greeting with gift description
  - Video preview: 5 bí quyết dưa không bị nhớt
  - Community invitation (149+ members)
  - Why they should watch (benefits)
- **CTA**: "📥 Xem video ngay"

### Email 2: Case Study – 5 Mistakes (+2 days from Email 1)
- **Subject**: "5 sai lầm khiến dưa bị hỏng – Chỉ 1% người biết #3 👀"
- **Content**:
  - Case study: Chị T before/after
  - 5 detailed mistakes with consequences
  - Testimonial from successful student
  - Problem → Solution narrative
- **CTA**: "📖 Xem hướng dẫn chi tiết"

### Email 3: SALES PITCH (+1 day from Email 2)
- **Subject**: "Khóa học Dưa Cà Muối Chuyên Sâu – Chỉ 299.000đ (hôm nay!) 🎓"
- **Content**:
  - Main headline: "From 5 Mistakes → 5 Perfect Secrets"
  - Value stack: 1,095k → 299k → Save 796k
  - 3 key benefits (5 videos, 100% formula, 24/7 group)
  - Success story with image + result
  - Price urgency: "Price increases to 399k tomorrow"
- **CTA**: "✅ Đăng ký khóa học – 299.000đ"
- **Note**: If customer buys after this email → STOP sequence (converted)

### Email 4: Social Proof + FOMO (+1 day from Email 3, if not converted)
- **Subject**: "Có 149+ người đã làm được, tại sao bạn chưa? 🤔"
- **Content**:
  - Social proof: 149+ members, 90% success in week 1
  - 3 short success story cards (A, B, C)
  - Statistics: revenue increases, customer frequency up
  - FOMO element: "Price rising to 399k"
  - Free bonus: Checklist 12 signs of spoiled pickles
- **CTA**: "🚀 Đăng ký khóa học ngay"

### Email 5: LAST CHANCE Promo (+2 days from Email 4, if not converted)
- **Subject**: "🔥 LAST CHANCE – 199.000đ (hết hôm nay!)"
- **Content**:
  - Red-themed design with urgency indicators
  - Visual price reduction: 299k → 199k (33% off)
  - Countdown: "Expires at 23:59 TODAY"
  - Limited supply: "Only 10 spots"
  - Why act now (FOMO list)
  - Course contents recap
- **CTA**: "🚀 ĐỀ NGAY – 199.000đ"

## Email Triggers & Conditions

### Gift Lead Creation Flow
1. Customer submits `/api/gift-form`
2. System creates gift_lead record
3. Send welcome email (Email 1)
4. Update: `email_sequence_status = 'pending_email2'`, `next_email_at = now + 2 days`
5. Return `giftLeadId` to frontend

### Course Purchase Trigger
1. Customer submits `/api/course-form` with optional `giftLeadId`
2. If `giftLeadId` is provided:
   - Trigger webhook: `POST /api/email-sequences/webhook`
   - Set `email_sequence_paused = TRUE`
   - Set `email_sequence_status = 'converted'`
3. No further emails sent

### Cron Job (Hourly)
1. API Key check: `x-api-key` header matches `EMAIL_SEQUENCE_API_KEY`
2. Query pending leads: `next_email_at <= NOW() AND email_sequence_paused = FALSE`
3. For each lead:
   - Send appropriate email based on `email_sequence_status`
   - Update status: `pending_emailN` → `emailN_sent`
   - Calculate next `next_email_at` based on email number
4. Return results with success/failure details

## Cron Job Setup

### Vercel Cron Configuration

In `vercel.json`:
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

**Schedule**: `0 * * * *` = Every hour at the top of the hour

**To Deploy**:
1. Set environment variable: `EMAIL_SEQUENCE_API_KEY=your-secret-key`
2. Redeploy to Vercel
3. Cron job runs automatically

### Alternative: External Cron Service

If not using Vercel, use external services like:
- **Easycron** (Free tier available)
- **Cron-job.org**
- **AWS CloudWatch Events** + Lambda

Example setup with Easycron:
```
URL: https://hacofood.vn/api/email-sequences/send
Method: POST
Headers: x-api-key: your-secret-key
Schedule: Every 60 minutes
```

## Database Functions

### getGiftLeadsPendingEmails()
Returns all gift_leads ready for their next email.

```typescript
export async function getGiftLeadsPendingEmails() {
  const sql = getDb()
  const rows = await sql`
    SELECT * FROM gift_leads
    WHERE next_email_at <= NOW()
      AND email_sequence_paused = FALSE
      AND email_sequence_status NOT IN ('completed', 'converted')
    ORDER BY next_email_at ASC
  `
  return rows as unknown as GiftLead[]
}
```

### updateGiftLeadSequence()
Updates status and schedules next email.

```typescript
export async function updateGiftLeadSequence(
  id: number,
  status: string,
  nextEmailAt?: Date
) {
  // Updates email_sequence_status, next_email_at, last_email_sent_at
}
```

### pauseEmailSequence()
Stops all emails when customer purchases.

```typescript
export async function pauseEmailSequence(id: number) {
  // Sets email_sequence_paused = TRUE, status = 'converted'
}
```

## Email Templates (Resend)

### Functions Added to lib/email.ts

```typescript
export async function sendGiftSequenceEmail1(to: { name: string; email: string })
export async function sendGiftSequenceEmail2(to: { name: string; email: string })
export async function sendGiftSequenceEmail3(to: { name: string; email: string })
export async function sendGiftSequenceEmail4(to: { name: string; email: string })
export async function sendGiftSequenceEmail5(to: { name: string; email: string })
```

All templates:
- Use brand green color: `#006400`
- Personalize with `${to.name}`
- Include professional footer with links
- Have clear CTA buttons
- Mobile-responsive HTML

## Environment Variables

Add these to `.env.local`:

```env
# Email Sequence
EMAIL_SEQUENCE_API_KEY=your-secret-key-here

# Existing Resend configuration
RESEND_API_KEY=re_xxxxx
FROM_EMAIL=Bếp Cô Hạ <no-reply@hacofood.vn>
DRIVE_LINK_GIFT=https://drive.google.com/...
COURSE_GROUP_LINK=https://www.facebook.com/groups/...
```

## Testing

### Test Individual Email

```typescript
import { sendGiftSequenceEmail1 } from '@/lib/email'

await sendGiftSequenceEmail1({
  name: 'Nguyễn Văn A',
  email: 'test@example.com'
})
```

### Test Cron Endpoint (Local)

```bash
curl -X POST http://localhost:3000/api/email-sequences/send \
  -H "x-api-key: test-key"
```

### Verify Sequence Status (Admin)

Check `/api/admin-data` to see all gift_leads with their current email sequence status.

## Monitoring

### Check Email Delivery
1. Go to Admin → Gift Leads
2. Verify `email_sequence_status` column
3. Check `last_email_sent_at` timestamp

### Monitor Cron Runs
- Vercel dashboard shows cron logs
- Check server logs for `[email-sequence]` entries

### Track Conversions
- Count leads where `email_sequence_status = 'converted'`
- Calculate conversion rate from Email 1 to Purchase

## Troubleshooting

### Emails Not Sending

**Check 1**: Verify cron is running
- Vercel dashboard → Functions tab → Check last run timestamp

**Check 2**: Verify API key
- `EMAIL_SEQUENCE_API_KEY` matches in `vercel.json`

**Check 3**: Check database
```sql
SELECT * FROM gift_leads 
WHERE next_email_at <= NOW() 
  AND email_sequence_paused = FALSE
LIMIT 5;
```

**Check 4**: Check Resend API
- Verify `RESEND_API_KEY` is valid
- Check Resend dashboard for bounced emails

### Emails Stuck

**Reason**: Status not progressing to next state

**Solution**: Manually update status
```sql
UPDATE gift_leads 
SET email_sequence_status = 'pending_email2', 
    next_email_at = NOW() + INTERVAL '2 days'
WHERE id = 123;
```

## Future Enhancements

1. **A/B Testing**: Test different subject lines for Email 3 & 5
2. **Personalization**: Include past purchase data in recommendations
3. **Dynamic Pricing**: Adjust Email 5 discount based on conversion rates
4. **SMS Fallback**: Send SMS reminder for Email 5 if email not opened
5. **Behavioral Triggers**: Skip to Email 3 if lead opened Email 1 & 2 within 24 hours
6. **Analytics**: Track open rates, click rates, conversion rate per email

## Quick Start Checklist

- [x] Update `gift_leads` schema with email_sequence columns
- [x] Add email sequence functions to `lib/db.ts`
- [x] Create 5 email templates in `lib/email.ts`
- [x] Create `/api/email-sequences/send` route
- [x] Create `/api/email-sequences/webhook` route
- [x] Update `/api/gift-form` to initialize sequence
- [x] Update `/api/course-form` to trigger webhook
- [x] Create `vercel.json` with cron configuration
- [ ] Set `EMAIL_SEQUENCE_API_KEY` environment variable
- [ ] Deploy to Vercel and verify cron runs
- [ ] Test email delivery with a test gift lead
- [ ] Monitor conversions in Admin panel

## References

- Vercel Cron: https://vercel.com/docs/functions/crons
- Resend Email API: https://resend.com/docs/api-reference/emails/send
- Next.js API Routes: https://nextjs.org/docs/pages/building-your-application/routing/api-routes
