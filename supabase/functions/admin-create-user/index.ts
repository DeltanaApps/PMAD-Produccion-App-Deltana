// Admin-only endpoint: creates a real Supabase Auth user and sets their
// profiles.role, so Administración can manage the team from inside the app
// instead of the Supabase dashboard. The service role key never leaves
// this server-side function — the browser only ever calls this endpoint
// with the caller's own session token.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });

const VALID_ROLES = ["direccion", "administracion", "gestor", "colaborador"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Falta el header de autorización." }, 401);
    }

    // Client scoped to the CALLER's own session — used only to verify who
    // is asking (RLS still applies, so this can never be spoofed).
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: caller },
      error: callerError,
    } = await callerClient.auth.getUser();
    if (callerError || !caller) {
      return json({ error: "Sesión inválida." }, 401);
    }

    const { data: callerProfile, error: profileError } = await callerClient
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();
    if (profileError || callerProfile?.role !== "administracion") {
      return json({ error: "Solo Administración puede crear usuarios." }, 403);
    }

    const body = await req.json();

    // Admin client — only ever used here, server-side, never sent to the browser.
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    if (body.action === "reset_password") {
      const { userId, newPassword } = body;
      if (!userId || !newPassword) {
        return json({ error: "userId y newPassword son obligatorios." }, 400);
      }
      if (newPassword.length < 8) {
        return json({ error: "La contraseña debe tener al menos 8 caracteres." }, 400);
      }

      const { error: resetError } = await adminClient.auth.admin.updateUserById(userId, {
        password: newPassword,
      });
      if (resetError) {
        return json({ error: resetError.message }, 400);
      }

      return json({ id: userId, reset: true });
    }

    const { email, password, role, name } = body;
    if (!email || !password || !role) {
      return json({ error: "Email, contraseña y rol son obligatorios." }, 400);
    }
    if (!VALID_ROLES.includes(role)) {
      return json({ error: "Rol inválido." }, 400);
    }
    if (password.length < 8) {
      return json({ error: "La contraseña debe tener al menos 8 caracteres." }, 400);
    }

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError || !created.user) {
      return json({ error: createError?.message ?? "No se pudo crear el usuario." }, 400);
    }

    const { error: updateError } = await adminClient
      .from("profiles")
      .update({ role, name: name || null, active: true })
      .eq("id", created.user.id);
    if (updateError) {
      return json({ error: updateError.message }, 400);
    }

    return json({ id: created.user.id, email: created.user.email, role, name: name || null });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
