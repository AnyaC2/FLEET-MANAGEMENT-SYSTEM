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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const authHeader =
      req.headers.get('x-access-token') ??
      req.headers.get('authorization') ??
      req.headers.get('Authorization') ??
      req.headers.get('x-forwarded-authorization');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      throw new Error('Supabase function secrets are not configured');
    }

    if (!authHeader) {
      console.error('create-user missing auth header', {
        headerKeys: Array.from(req.headers.keys()),
      });
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);
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
      console.error('create-user auth failed: missing user identifier', jwtPayload);
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
      console.error('create-user forbidden', requesterProfileError, requesterProfile);
      return new Response(JSON.stringify({ error: requesterProfileError?.message ?? 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { email, password, name, role, department } = await req.json();

    if (!email || !password || !name || !role) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: createdUserData, error: createUserError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
      },
    });

    if (createUserError || !createdUserData.user) {
      console.error('create-user auth.admin.createUser failed', createUserError);
      return new Response(JSON.stringify({ error: createUserError?.message ?? 'Failed to create user' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: profileError } = await adminClient
      .from('profiles')
      .upsert({
        id: createdUserData.user.id,
        email,
        name,
        role,
        department: department || null,
        status: 'active',
      });

    if (profileError) {
      console.error('create-user profile upsert failed', profileError);
      await adminClient.auth.admin.deleteUser(createdUserData.user.id);

      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        id: createdUserData.user.id,
        email,
        name,
        role,
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
