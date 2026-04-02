import nodemailer from 'nodemailer';
import { createClient } from 'supabase';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-access-token, x-client-info, apikey, content-type',
};

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  type: string;
  created_at: string;
  vehicle_id: string | null;
  driver_id: string | null;
};

type ProfileRow = {
  id: string;
  email: string;
  name: string | null;
  settings: {
    emailNotifications?: boolean;
  } | null;
};

function decodeJwtPayload(token: string) {
  const [, payload] = token.split('.');
  if (!payload) {
    throw new Error('Invalid access token');
  }

  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const decoded = atob(padded);
  return JSON.parse(decoded) as { sub?: string; subject?: string };
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function buildEmailHtml(notification: NotificationRow, recipientName: string | null, appUrl: string) {
  const safeName = recipientName ? escapeHtml(recipientName) : 'there';
  const safeTitle = escapeHtml(notification.title);
  const safeMessage = escapeHtml(notification.message);
  const safeType = escapeHtml(notification.type);
  const safeAppUrl = escapeHtml(appUrl);
  const formattedDate = new Date(notification.created_at).toLocaleString('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return `
    <div style="font-family: Arial, sans-serif; background: #f5f7fb; padding: 24px;">
      <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; border: 1px solid #e5e7eb;">
        <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; letter-spacing: 0.04em; text-transform: uppercase;">LFZDC Fleet Management</p>
        <h1 style="margin: 0 0 16px; font-size: 26px; color: #111827;">${safeTitle}</h1>
        <p style="margin: 0 0 12px; color: #374151;">Hello ${safeName},</p>
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 18px;">
          <p style="margin: 0 0 10px; color: #6b7280; font-size: 13px;">Notification type: ${safeType}</p>
          <p style="margin: 0 0 12px; line-height: 1.6; color: #374151;">${safeMessage}</p>
          <p style="margin: 0; font-size: 13px; color: #6b7280;">Created: ${escapeHtml(formattedDate)}</p>
        </div>
        <div style="margin: 24px 0;">
          <a href="${safeAppUrl}" style="display: inline-block; background: #111827; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 10px; font-weight: 600;">
            Sign in to LFZDC Fleet Management
          </a>
        </div>
        <p style="margin: 0 0 8px; color: #6b7280;">If the button does not work, use this link:</p>
        <p style="margin: 0 0 16px;">
          <a href="${safeAppUrl}" style="color: #2563eb; word-break: break-all;">${safeAppUrl}</a>
        </p>
        <p style="margin: 16px 0 0; color: #6b7280;">You are receiving this email because email notifications are enabled in your account settings.</p>
      </div>
    </div>
  `;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const office365User = Deno.env.get('OFFICE365_SMTP_USER');
    const office365Password = Deno.env.get('OFFICE365_SMTP_PASSWORD');
    const notificationFromName = Deno.env.get('NOTIFICATION_FROM_NAME') ?? 'LFZ Fleet';
    const appUrl = Deno.env.get('APP_URL');
    const authHeader =
      req.headers.get('x-access-token') ??
      req.headers.get('authorization') ??
      req.headers.get('Authorization') ??
      req.headers.get('x-forwarded-authorization');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      throw new Error('Supabase function secrets are not configured');
    }

    if (!office365User || !office365Password || !appUrl) {
      return new Response(
        JSON.stringify({ error: 'Email notification service is not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accessToken = authHeader.replace('Bearer ', '').trim();
    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'Missing access token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const jwtPayload = decodeJwtPayload(accessToken);
    const requestingUserId = jwtPayload.sub ?? jwtPayload.subject;
    if (!requestingUserId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: requesterProfile, error: requesterProfileError } = await adminClient
      .from('profiles')
      .select('id')
      .eq('id', requestingUserId)
      .maybeSingle();

    if (requesterProfileError || !requesterProfile) {
      return new Response(JSON.stringify({ error: requesterProfileError?.message ?? 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { notificationId } = await req.json();
    if (!notificationId) {
      return new Response(JSON.stringify({ error: 'Missing notificationId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: notification, error: notificationError } = await adminClient
      .from('notifications')
      .select('id, title, message, type, created_at, vehicle_id, driver_id')
      .eq('id', notificationId)
      .maybeSingle<NotificationRow>();

    if (notificationError || !notification) {
      return new Response(JSON.stringify({ error: notificationError?.message ?? 'Notification not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profiles, error: profilesError } = await adminClient
      .from('profiles')
      .select('id, email, name, settings')
      .eq('status', 'active')
      .not('email', 'is', null);

    if (profilesError) {
      throw profilesError;
    }

    const optedInProfiles = (profiles as ProfileRow[]).filter(
      (profile) => profile.email && (profile.settings?.emailNotifications ?? true)
    );

    const { data: deliveries, error: deliveriesError } = await adminClient
      .from('notification_email_deliveries')
      .select('profile_id')
      .eq('notification_id', notification.id);

    if (deliveriesError) {
      throw deliveriesError;
    }

    const deliveredIds = new Set((deliveries ?? []).map((entry) => entry.profile_id as string));
    const recipients = optedInProfiles.filter((profile) => !deliveredIds.has(profile.id));

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.office365.com',
      port: 587,
      secure: false,
      auth: {
        user: office365User,
        pass: office365Password,
      },
    });

    let sentCount = 0;

    for (const profile of recipients) {
      try {
        await transporter.sendMail({
          from: `"${notificationFromName}" <${office365User}>`,
          to: profile.email,
          subject: `[LFZ Fleet] ${notification.title}`,
          html: buildEmailHtml(notification, profile.name, appUrl),
        });

        sentCount += 1;

        const { error: deliveryInsertError } = await adminClient
          .from('notification_email_deliveries')
          .insert({
            notification_id: notification.id,
            profile_id: profile.id,
          });

        if (deliveryInsertError) {
          console.error('Failed to record notification email delivery', deliveryInsertError);
        }
      } catch (error) {
        console.error('Failed to send notification email', {
          notificationId: notification.id,
          profileId: profile.id,
          errorText: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return new Response(JSON.stringify({ success: true, sent: sentCount }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('send-notification-emails failed', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unexpected error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
