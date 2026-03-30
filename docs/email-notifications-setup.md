# Email Notifications Setup

The `Email Notifications` switch in Settings now supports real fleet email alerts.

## What it sends

- incident notifications
- automatic maintenance notifications
- automatic document expiry notifications
- automatic driver license expiry notifications

Emails are only sent to users whose profile settings have `Email Notifications` enabled.

## 1. Create the delivery table

Run this in Supabase SQL Editor:

- `/Users/milaxs/Desktop/my-react-app codex/supabase/notification-email-deliveries.sql`

## 2. Add function secrets

Set these in Supabase:

```bash
npx supabase secrets set RESEND_API_KEY=your_resend_api_key
npx supabase secrets set NOTIFICATION_FROM_EMAIL=notifications@yourdomain.com
npx supabase secrets set NOTIFICATION_FROM_NAME="LFZ Fleet"
```

Notes:
- `RESEND_API_KEY` comes from your Resend account.
- `NOTIFICATION_FROM_EMAIL` should be a verified sender/domain in Resend.
- `NOTIFICATION_FROM_NAME` is optional but recommended.

## 3. Deploy the Edge Function

```bash
cd "/Users/milaxs/Desktop/my-react-app codex"
npx supabase functions deploy send-notification-emails --project-ref tobpvfichoieucnvgdqf --use-api
```

## 4. Test it

1. Make sure a user has `Email Notifications` enabled in Settings.
2. Create a new incident or trigger an automatic alert condition.
3. Check that the user receives one email for that notification.

The function records deliveries in `public.notification_email_deliveries`, so repeated refreshes do not resend the same notification email.
