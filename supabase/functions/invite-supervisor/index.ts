import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authorization = request.headers.get("Authorization");

    if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
      throw new Error("Configuracao de autenticacao incompleta");
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData.user) throw new Error("Sessao invalida");

    const { data: profile } = await adminClient
      .from("profiles")
      .select("role, active")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (profile?.role !== "admin" || !profile.active) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem convidar" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim();
    const role = body.role === "admin" ? "admin" : "supervisor";
    const redirectTo = String(body.redirectTo || "").trim() || undefined;
    if (!email || !email.includes("@")) throw new Error("E-mail invalido");

    const { error: inviteRowError } = await adminClient.from("supervisor_invites").upsert(
      {
        email,
        role,
        status: "pending",
        invited_by: userData.user.id,
        invited_user_id: null,
        invited_at: new Date().toISOString(),
        accepted_at: null,
      },
      { onConflict: "email" },
    );
    if (inviteRowError) throw inviteRowError;

    const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      email,
      {
        data: { full_name: name, role, must_set_password: true },
        redirectTo,
      },
    );
    if (inviteError) {
      await adminClient
        .from("supervisor_invites")
        .update({ status: "failed" })
        .eq("email", email);
      throw inviteError;
    }

    if (invited.user) {
      await adminClient.from("profiles").upsert({
        id: invited.user.id,
        nome: name || email.split("@")[0],
        email,
        role,
        active: true,
      });
    }

    return new Response(JSON.stringify({ ok: true, email, role }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao enviar convite";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
