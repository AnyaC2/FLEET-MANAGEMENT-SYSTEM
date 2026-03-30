import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-access-token, x-client-info, apikey, content-type',
};

type JwtPayload = {
  sub?: string;
  subject?: string;
};

type ProfileRow = {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  status: string | null;
  settings: {
    emailNotifications?: boolean;
  } | null;
};

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  type: string;
  created_at: string;
};

function decodeJwtPayload(token: string): JwtPayload {
  const [, payload] = token.split('.');
  if (!payload) {
    throw new Error('Invalid access token');
  }

  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return JSON.parse(atob(padded)) as JwtPayload;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function buildEmailHtml(notification: NotificationRow, recipientName: string | null) {
  const safeName = recipientName ? escapeHtml(recipientName) : 'there';
  const safeTitle = escapeHtml(notification.title);
  const safeMessage = escapeHtml(notification.message);
  const safeType = escapeHtml(notification.type);
  const formattedDate = new Date(notification.created_at).toLocaleString('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; color: #111827;">
      <p style="margin: 0 0 16px;">Hello ${safeName},</p>
      <p style="margin: 0 0 16px;">A new fleet notification was generated in LFZ Fleet Management.</p>
      <div style="border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; background: #f9fafb;">
        <p style="margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280;">${safeType}</p>
        <h2 style="margin: 0 0 12px; font-size: 20px; color: #111827;">${safeTitle}</h2>
        <p style="margin: 0 0 12px; line-height: 1.6; color: #374151;">${safeMessage}</p>
        <p style="margin: 0; font-size: 13px; color: #6b7280;">Created: ${escapeHtml(formattedDate)}</p>
      </div>
      <p style="margin: 16px 0 0; color: #6b7280;">You are receiving this email because email notifications are enabled in your account settings.</p>
    </div>
  `;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const notificationFromEmail = Deno.env.get('NOTIFICATION_FROM_EMAIL');
    const notificationFromName = Deno.env.get('NOTIFICATION_FROM_NAME') ?? 'LFZ Fleet';
    const authHeader =
      req.headers.get('x-access-token') ??
      req.headers.get('authorization') ??
      req.headers.get('Authorization') ??
      req.headers.get('x-forwarded-authorization');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Supabase function secrets are not configured');
    }

    if (!resendApiKey || !notificationFromEmail) {
      return new Response(
        JSON.stringify({ error: 'Email notification service is not configured' }),
        {
          status: 503,
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
    const jwtPayload = decodeJwtPayload(accessToken);
    const requesterId = jwtPayload.sub ?? jwtPayload.subject;

    if (!requesterId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { notificationId } = await req.json();

    if (!notificationId || typeof notificationId !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing notificationId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: requesterProfile, error: requesterProfileError } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', requesterId)
      .maybeSingle<{ role: string }>();

    if (
      requesterProfileError ||
      !requesterProfile ||
      !['system_admin', 'editor'].includes(requesterProfile.role)
    ) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: notification, error: notificationError } = await adminClient
      .from('notifications')
      .select('id, title, message, type, created_at')
      .eq('id', notificationId)
      .maybeSingle<NotificationRow>();

    if (notificationError) {
      throw notificationError;
    }

    if (!notification) {
      return new Response(JSON.stringify({ error: 'Notification not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profiles, error: profilesError } = await adminClient
      .from('profiles')
      .select('id, email, name, role, status, settings');

    if (profilesError) {
      throw profilesError;
    }

    const eligibleProfiles = (profiles as ProfileRow[]).filter(
      (profile) =>
        profile.status !== 'inactive' &&
        Boolean(profile.email) &&
        profile.settings?.emailNotifications !== false
    );

    if (eligibleProfiles.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, skipped: 0, message: 'No email recipients are opted in' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: existingDeliveries, error: deliveriesError } = await adminClient
      .from('notification_email_deliveries')
      .select('profile_id')
      .eq('notification_id', notificationId);

    if (deliveriesError) {
      throw deliveriesError;
    }

    const deliveredProfileIds = new Set(
      (existingDeliveries as Array<{ profile_id: string }>).map((delivery) => delivery.profile_id)
    );

    let sentCount = 0;
    let skippedCount = 0;

    for (const profile of eligibleProfiles) {
      if (deliveredProfileIds.has(profile.id)) {
        skippedCount += 1;
        continue;
      }

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${notificationFromName} <${notificationFromEmail}>`,
          to: [profile.email],
          subject: `[LFZ Fleet] ${notification.title}`,
          html: buildEmailHtml(notification, profile.name),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to send notification email', {
          notificationId,
          profileId: profile.id,
          errorText,
        });
        continue;
      }

      const { error: deliveryInsertError } = await adminClient
        .from('notification_email_deliveries')
        .insert({
          notification_id: notificationId,
          profile_id: profile.id,
        });

      if (deliveryInsertError) {
        console.error('Failed to record notification email delivery', deliveryInsertError);
        continue;
      }

      sentCount += 1;
    }

    return new Response(
      JSON.stringify({
        sent: sentCount,
        skipped: skippedCount,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
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
