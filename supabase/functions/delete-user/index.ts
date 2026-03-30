import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-access-token, x-client-info, apikey, content-type',
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const authHeader =
      req.headers.get('x-access-token') ??
      req.headers.get('authorization') ??
      req.headers.get('Authorization') ??
      req.headers.get('x-forwarded-authorization');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Supabase function secrets are not configured');
    }

    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);
    const accessToken = authHeader.replace('Bearer ', '').trim();
    const jwtPayload = decodeJwtPayload(accessToken);
    const requestingUserId = jwtPayload.sub ?? jwtPayload.subject;

    if (!requestingUserId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: requesterProfile, error: requesterProfileError } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', requestingUserId)
      .maybeSingle();

    if (requesterProfileError || !requesterProfile || requesterProfile.role !== 'system_admin') {
      return new Response(JSON.stringify({ error: requesterProfileError?.message ?? 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { userId } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing userId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (userId === requestingUserId) {
      return new Response(JSON.stringify({ error: 'You cannot delete your own account.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: targetProfile, error: targetProfileError } = await adminClient
      .from('profiles')
      .select('role, email, name')
      .eq('id', userId)
      .maybeSingle();

    if (targetProfileError || !targetProfile) {
      return new Response(JSON.stringify({ error: targetProfileError?.message ?? 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (targetProfile.role === 'system_admin') {
      const { count, error: adminCountError } = await adminClient
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'system_admin');

      if (adminCountError) {
        return new Response(JSON.stringify({ error: adminCountError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if ((count ?? 0) <= 1) {
        return new Response(JSON.stringify({ error: 'You cannot delete the last remaining system admin.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(userId);

    if (deleteUserError) {
      return new Response(JSON.stringify({ error: deleteUserError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        id: userId,
        email: targetProfile.email,
        name: targetProfile.name,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
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
