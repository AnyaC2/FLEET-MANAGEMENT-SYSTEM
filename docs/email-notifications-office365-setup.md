# Email Notifications Setup (Office 365)

This version uses an Office 365 mailbox for sending notification emails, so you do not need to own a separate custom sending domain.

## 1. Choose the Office 365 sender mailbox

Use the Office 365 mailbox you want the app to send from.

If the mailbox has MFA enabled, use an app password. If not, use the mailbox password.

Important:
- SMTP host: `smtp.office365.com`
- Port: `587`
- Encryption: `STARTTLS/TLS`
- SMTP AUTH may need to be enabled for the mailbox in Microsoft 365

## 2. Set Supabase function secrets

Run these in Terminal:

```bash
cd "/Users/milaxs/Desktop/my-react-app codex"

npx supabase secrets set OFFICE365_SMTP_USER=your_office365_email@yourdomain.com --project-ref tobpvfichoieucnvgdqf
npx supabase secrets set OFFICE365_SMTP_PASSWORD=your_mailbox_password_or_app_password --project-ref tobpvfichoieucnvgdqf
npx supabase secrets set NOTIFICATION_FROM_NAME="LFZ Fleet" --project-ref tobpvfichoieucnvgdqf
npx supabase secrets set APP_URL=https://your-live-vercel-url.vercel.app --project-ref tobpvfichoieucnvgdqf
```

## 3. Create the delivery tracking table

Run:

- `/Users/milaxs/Desktop/my-react-app codex/supabase/notification-email-deliveries.sql`

## 4. Deploy the function

```bash
cd "/Users/milaxs/Desktop/my-react-app codex"
npx supabase functions deploy send-notification-emails --project-ref tobpvfichoieucnvgdqf --use-api
```

## 5. Test

1. Turn on `Email Notifications` in Settings.
2. Save changes.
3. Create a new incident.
4. Check the inbox of an active user.

The email includes a link back to the live app so the user can sign in quickly.
