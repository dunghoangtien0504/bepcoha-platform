# Email Sequence System – Complete Implementation Summary

## Project Overview

A sophisticated 5-email nurture sequence system for gift leads (khách nhận quà miễn phí) designed to:
- Build trust and provide value progressively
- Guide prospects through a journey: Education → Problem-Solving → Social Proof → Urgency → Last Chance
- Automatically pause when customers purchase the course
- Track conversion metrics

---

## Email Sequence Architecture

### Timeline & Content

```
Day 0 | EMAIL 1: Welcome + Video Preview
      ├─ Subject: "Cô Hạ vừa gửi quà cho bạn – Mở ngay! 🎁"
      ├─ Content: Warm welcome, gift description, video preview, community invite
      ├─ CTA: "📥 Xem video ngay"
      └─ Next: +2 days

Day 2 | EMAIL 2: Case Study + 5 Mistakes
      ├─ Subject: "5 sai lầm khiến dưa bị hỏng – Chỉ 1% người biết #3 👀"
      ├─ Content: Chị T story, 5 detailed mistakes, before/after testimonial
      ├─ CTA: "📖 Xem hướng dẫn chi tiết"
      └─ Next: +1 day

Day 3 | EMAIL 3: SALES PITCH (Price 299k)
      ├─ Subject: "Khóa học Dưa Cà Muối Chuyên Sâu – Chỉ 299.000đ (hôm nay!) 🎓"
      ├─ Content: Headline "5 mistakes → 5 perfect secrets", value stack, 3 benefits, success story
      ├─ CTA: "✅ Đăng ký khóa học – 299.000đ"
      ├─ Urgency: "Price increases to 399k tomorrow"
      └─ Next: +1 day (or STOP if purchased)

Day 4 | EMAIL 4: Social Proof + FOMO
      ├─ Subject: "Có 149+ người đã làm được, tại sao bạn chưa? 🤔"
      ├─ Content: 149+ members, 90% success rate, 3 success stories, free bonus
      ├─ CTA: "🚀 Đăng ký khóa học ngay"
      ├─ Urgency: "Price rising to 399k"
      └─ Next: +2 days (or STOP if purchased)

Day 6 | EMAIL 5: LAST CHANCE Promo (Price 199k)
      ├─ Subject: "🔥 LAST CHANCE – 199.000đ (hết hôm nay!)"
      ├─ Content: Red-themed urgency, 299k→199k visual, countdown, limited spots
      ├─ CTA: "🚀 ĐỀ NGAY – 199.000đ"
      ├─ Urgency: "Expires 23:59 TODAY"
      └─ Next: COMPLETED (or STOP if purchased)
```

---

## Technical Implementation

### Database Schema Changes

```sql
ALTER TABLE gift_leads ADD COLUMN IF NOT EXISTS email_sequence_status TEXT DEFAULT 'pending_email1';
ALTER TABLE gift_leads ADD COLUMN IF NOT EXISTS next_email_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 day');
ALTER TABLE gift_leads ADD COLUMN IF NOT EXISTS email_sequence_paused BOOLEAN DEFAULT FALSE;
ALTER TABLE gift_leads ADD COLUMN IF NOT EXISTS last_email_sent_at TIMESTAMPTZ;
```

**Columns Added**:
- `email_sequence_status` – Current status in sequence (pending_email1, email1_sent, completed, converted, etc.)
- `next_email_at` – When to send the next email
- `email_sequence_paused` – Set to TRUE when customer purchases course
- `last_email_sent_at` – Track email delivery timestamps

### Code Structure

**Core Files Modified**:
```
lib/db.ts
├─ Added: gift_leads schema with 4 new columns
├─ New Functions:
│  ├─ getGiftLeadsPendingEmails() – Query leads ready for next email
│  ├─ updateGiftLeadSequence(id, status, nextEmailAt) – Update status & schedule
│  └─ pauseEmailSequence(id) – Stop emails when purchase detected
└─ Updated: GiftLead interface with new fields

lib/email.ts
├─ New Functions:
│  ├─ sendGiftSequenceEmail1() – Welcome + video preview
│  ├─ sendGiftSequenceEmail2() – 5 mistakes case study
│  ├─ sendGiftSequenceEmail3() – Sales pitch (299k)
│  ├─ sendGiftSequenceEmail4() – Social proof + FOMO
│  └─ sendGiftSequenceEmail5() – Last chance (199k)
└─ All templates: Responsive HTML, brand green (#006400), personalized

app/api/
├─ email-sequences/
│  ├─ send/route.ts – Cron endpoint (hourly)
│  │  ├─ Finds pending leads
│  │  ├─ Sends appropriate email
│  │  ├─ Updates status & next_email_at
│  │  └─ Returns results with success/fail details
│  └─ webhook/route.ts – Called on purchase
│     └─ Pauses email sequence (sets email_sequence_paused = TRUE)
├─ gift-form/route.ts (MODIFIED)
│  ├─ Creates gift_lead record
│  ├─ Sends Email 1 immediately
│  ├─ Initializes sequence: status = 'pending_email2', next = +2 days
│  └─ Returns giftLeadId to frontend
└─ course-form/route.ts (MODIFIED)
   ├─ Accepts optional giftLeadId parameter
   └─ Triggers webhook to pause sequence if giftLeadId provided
```

### API Endpoints

**1. POST `/api/email-sequences/send`** (Cron Trigger)
```bash
curl -X POST https://hacofood.vn/api/email-sequences/send \
  -H "x-api-key: your-secret-key"

Response:
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

**2. POST `/api/email-sequences/webhook`** (On Purchase)
```bash
curl -X POST https://hacofood.vn/api/email-sequences/webhook \
  -H "Content-Type: application/json" \
  -d '{"giftLeadId": 123}'

Response:
{
  "success": true,
  "message": "Email sequence paused for lead 123"
}
```

### Cron Job Configuration

**vercel.json**:
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

---

## Email Templates Design

### Design System

**Brand Colors**:
- Primary Green: `#006400` (Dark green)
- Secondary Green: `#16a34a` (Lighter green)
- Red (Urgency): `#dc2626`
- Yellow (Warning): `#fbbf24`

**Typography**:
- Font: Segoe UI, Arial, sans-serif
- Headers: 22-26px, bold/extra-bold
- Body: 14-15px, line-height 1.6-1.8

**Layout**:
- Max-width: 600px
- Responsive design (mobile-first)
- Professional footer with branding

### Template Breakdown

**Email 1 - Welcome + Video**
```
Header: Green gradient background with emoji
Body:
  - Warm greeting (personalized name)
  - Gift description box
  - Why watch? benefits list
  - Community section with links (6 platforms)
  - Upsell box (light red background)
Footer: Copyright + unsubscribe
CTA: Primary button "Xem video ngay"
```

**Email 2 - Case Study**
```
Header: Red gradient (warning color)
Body:
  - Case study intro (Chị T problem)
  - 5 mistakes boxes (4 normal + 1 highlighted)
  - Before/after comparison visual
  - Testimonial from Chị T
Footer: Standard
CTA: Secondary button "Xem hướng dẫn chi tiết"
```

**Email 3 - Sales Pitch**
```
Header: Green gradient
Body:
  - Main headline: "5 mistakes → 5 perfect secrets"
  - Price breakdown: 1,095k → 299k (save 796k)
  - 3 benefits as bullet list
  - Success story card with testimonial
  - Urgency: "Price increases tomorrow"
Footer: Standard
CTA: Bold button "Đăng ký khóa học – 299.000đ"
```

**Email 4 - Social Proof**
```
Header: Blue gradient (trust color)
Body:
  - Opening: "90% success in week 1"
  - Statistics cards: 149+ members, 90% success
  - 3 success story cards (A, B, C) with initials
  - Price urgency box: "Rising to 399k"
  - Free bonus: Checklist 12 signs
Footer: Standard
CTA: Action button "Đăng ký khóa học ngay"
```

**Email 5 - Last Chance**
```
Header: Red with pattern overlay + flame emoji
Body:
  - URGENCY BAR: Countdown "HẾT LÚC 23H59 HÔM NAY!"
  - Price visual: 299k crossed → 199k (33% off)
  - Why act now: 4-point FOMO list
  - Course contents recap
  - Cô Hạ quote (red box)
Footer: Standard
CTA: BOLD RED button "ĐỀ NGAY – 199.000đ"
```

---

## Data Flow Diagrams

### User Journey

```
1. Customer Submits Gift Form
   ↓
2. [POST /api/gift-form]
   ├─ Create gift_lead record
   ├─ Send Email 1 immediately (sendGiftEmail)
   ├─ Update: status='pending_email2', next_email_at=+2days
   ├─ Notify Telegram
   └─ Return giftLeadId

3. Customer Subscribes for Course
   ↓
4. [POST /api/course-form] with giftLeadId
   ├─ Create course_lead record
   ├─ Send QR code & payment instructions
   ├─ Trigger webhook: /api/email-sequences/webhook
   └─ Return paymentRef

5. [POST /api/email-sequences/webhook]
   ├─ Update gift_lead:
   │  ├─ email_sequence_paused = TRUE
   │  └─ status = 'converted'
   └─ Email sequence STOPS
```

### Cron Job Flow

```
Every Hour at :00 minutes
   ↓
1. [POST /api/email-sequences/send]
   ├─ Check API key
   └─ Query: next_email_at <= NOW() 
          AND email_sequence_paused = FALSE
          AND status NOT IN ('completed', 'converted')

2. For Each Pending Lead
   ├─ Determine email based on current status:
   │  ├─ status='pending_email1' → sendGiftSequenceEmail1
   │  ├─ status='pending_email2' → sendGiftSequenceEmail2
   │  ├─ status='pending_email3' → sendGiftSequenceEmail3
   │  ├─ status='pending_email4' → sendGiftSequenceEmail4
   │  └─ status='email4_sent' → sendGiftSequenceEmail5
   │
   ├─ Send email via Resend
   │
   └─ Update gift_lead:
      ├─ status = new_status (e.g., 'email1_sent')
      ├─ next_email_at = calculated future date
      └─ last_email_sent_at = NOW()

3. Return Results
   └─ Log: success/fail for each lead
```

---

## Files Summary

### New Files Created

| File | Purpose |
|------|---------|
| `app/api/email-sequences/send/route.ts` | Cron endpoint to send pending emails |
| `app/api/email-sequences/webhook/route.ts` | Webhook to pause sequence on purchase |
| `vercel.json` | Cron configuration (1 hour interval) |
| `EMAIL_SEQUENCE.md` | Complete technical documentation |
| `IMPLEMENTATION_GUIDE.md` | Step-by-step deployment guide |
| `SQL_SCHEMA_UPDATES.sql` | Database migration script |
| `EMAIL_SEQUENCE_SUMMARY.md` | This file |

### Files Modified

| File | Changes |
|------|---------|
| `lib/db.ts` | +4 columns, +3 functions, +1 interface update |
| `lib/email.ts` | +5 email template functions (850+ lines) |
| `app/api/gift-form/route.ts` | Initialize sequence, return giftLeadId |
| `app/api/course-form/route.ts` | Add giftLeadId param, trigger webhook |

---

## Build & Deployment Status

### Build Status: ✓ PASSED

```
Next.js 16.2.7 Compilation: ✓ Successful
TypeScript Check: ✓ Passed
Page Generation: ✓ 21/21 pages built

Routes Added:
✓ /api/email-sequences/send
✓ /api/email-sequences/webhook
```

### Pre-Deployment Checklist

- [x] Code written & tested locally
- [x] Build passes without errors
- [x] TypeScript validation passed
- [x] Database schema documented
- [x] API endpoints documented
- [x] Email templates designed
- [x] Environment variables documented
- [ ] Database schema applied (manual step)
- [ ] Environment variables set (manual step)
- [ ] Vercel cron configured (manual step)
- [ ] First test email sent (manual verification)

---

## Key Features

### 1. Automated Scheduling
- Hourly cron job via Vercel
- No manual email sending needed
- Respects timing (2-1-1-2 day intervals)

### 2. Smart Purchase Detection
- Detects when gift lead purchases course
- Automatically pauses email sequence
- Prevents redundant communications

### 3. Beautiful HTML Email Templates
- Mobile-responsive design
- Personalized greetings
- Clear calls-to-action
- Brand-aligned colors

### 4. Complete Tracking
- Current status for each lead
- Next email scheduled time
- Last email sent timestamp
- Conversion status

### 5. Flexible Status Management
- 12+ status values for granular tracking
- Easy to debug and monitor
- Supports manual status updates if needed

---

## Metrics to Track

### Conversion Funnel

```
Total Gift Leads → Email 1 → Email 2 → Email 3 → Email 4 → Email 5 → Conversion
```

**Key Metrics**:
- Total gift leads acquired
- Leads converted to course purchase
- Conversion rate (%)
- Conversion by email (which email closed the sale)
- Email delivery success rate
- Email open rate (via Resend analytics)
- Email click rate (via Resend analytics)

**Sample Queries**:

```sql
-- Conversion rate
SELECT
  COUNT(*) as total_leads,
  SUM(CASE WHEN email_sequence_status = 'converted' THEN 1 ELSE 0 END) as converted,
  ROUND(100.0 * SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) / COUNT(*), 2) as conversion_rate
FROM gift_leads;

-- Status breakdown
SELECT email_sequence_status, COUNT(*) as count
FROM gift_leads
GROUP BY email_sequence_status
ORDER BY count DESC;

-- Leads ready for next email
SELECT COUNT(*) as pending_count
FROM gift_leads
WHERE next_email_at <= NOW()
  AND email_sequence_paused = FALSE
  AND email_sequence_status NOT IN ('completed', 'converted');
```

---

## Testing Scenarios

### Test Scenario 1: Full Email Sequence
1. Submit gift form with test email
2. Verify Email 1 sent immediately
3. Check status = 'pending_email2', next = +2 days
4. Manually trigger cron (curl command)
5. Verify subsequent emails sent on schedule

### Test Scenario 2: Purchase Interruption
1. Submit gift form
2. Receive Email 1
3. Submit course form with giftLeadId
4. Verify webhook called
5. Verify no more emails sent
6. Check status = 'converted', paused = TRUE

### Test Scenario 3: Cron Reliability
1. Wait for next cron run (hourly)
2. Verify all pending leads processed
3. Check Vercel logs for success/fail
4. Verify next_email_at calculated correctly

---

## Support & Troubleshooting

### Common Issues

**Issue: Emails not sending**
- Check `EMAIL_SEQUENCE_API_KEY` env var
- Verify Resend API key valid
- Check database connectivity
- Review server logs

**Issue: Cron not running**
- Verify vercel.json has correct API key
- Redeploy to Vercel
- Check Vercel Functions dashboard

**Issue: Customers still getting emails after purchase**
- Verify webhook endpoint working
- Check email_sequence_paused = TRUE in database
- Manually update if needed: `UPDATE gift_leads SET email_sequence_paused=TRUE WHERE id=X`

### Quick Verification Commands

```bash
# Test cron endpoint
curl -X POST http://localhost:3000/api/email-sequences/send \
  -H "x-api-key: your-key"

# Check database schema
psql -U postgres -d hacofood -c "SELECT * FROM gift_leads LIMIT 1;"

# Verify Resend connection
curl -X GET https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY"
```

---

## Next Steps

1. **Immediate**: Apply database schema, set env vars, deploy
2. **Short-term**: Monitor email delivery, track conversion rates
3. **Medium-term**: A/B test different email versions
4. **Long-term**: Add SMS fallback, behavioral triggers, advanced segmentation

---

## Summary Statistics

- **Emails Designed**: 5
- **Email Templates**: 850+ lines of HTML
- **Database Columns Added**: 4
- **Database Functions Added**: 3
- **API Routes Created**: 2
- **API Routes Modified**: 2
- **Files Created**: 7
- **Files Modified**: 4
- **Total Code Lines**: ~1500+
- **Build Status**: ✓ PASSED

---

**Implementation Date**: 2026-06-05
**Status**: Ready for Deployment
**Next Step**: Apply database schema and deploy to Vercel
