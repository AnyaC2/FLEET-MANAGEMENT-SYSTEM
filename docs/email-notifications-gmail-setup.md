# Email Notifications Setup (Gmail)

This version uses a dedicated Gmail account and a Google App Password, so you do not need to own a custom domain.

## 1. Create a Gmail sender account

Create a Gmail account just for the app, for example:

- `lfzdcfleetnotifications@gmail.com`

## 2. Turn on 2-Step Verification

Google only allows App Passwords on accounts with 2-Step Verification enabled.

Google help:
- https://support.google.com/accounts/answer/185833

## 3. Generate a Google App Password

Create a 16-digit App Password for the Gmail account.

Use that App Password, not your normal Gmail password.

## 4. Set Supabase function secrets

Run these in Terminal:

```bash
cd "/Users/milaxs/Desktop/my-react-app codex"

npx supabase secrets set GMAIL_SMTP_USER=your_gmail_address@gmail.com --project-ref tobpvfichoieucnvgdqf
npx supabase secrets set GMAIL_SMTP_APP_PASSWORD=your_16_digit_app_password --project-ref tobpvfichoieucnvgdqf
npx supabase secrets set NOTIFICATION_FROM_NAME="LFZ Fleet" --project-ref tobpvfichoieucnvgdqf
npx supabase secrets set APP_URL=https://your-live-vercel-url.vercel.app --project-ref tobpvfichoieucnvgdqf
```

## 5. Create the delivery tracking table

Run:

- `/Users/milaxs/Desktop/my-react-app codex/supabase/notification-email-deliveries.sql`

## 6. Deploy the function

```bash
cd "/Users/milaxs/Desktop/my-react-app codex"
npx supabase functions deploy send-notification-emails --project-ref tobpvfichoieucnvgdqf --use-api
```

## 7. Test

1. Turn on `Email Notifications` in Settings.
2. Save changes.
3. Create a new incident.
4. Check the inbox of an active user.

The email includes a link back to the live app so the user can sign in quickly.
