// supabase/functions/google-oauth-callback/index.ts
//
// Google redirige aquí tras el consentimiento (?code=...&state=...).
// state = el access token de sesión de Supabase del usuario, para saber quién es
// sin depender de cookies (los Edge Functions son sin estado).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("APP_URL")!; // p.ej. https://legajo.vercel.app

function redirectWithParam(param: string) {
  return new Response(null, {
    status: 302,
    headers: { Location: `${APP_URL}/?${param}` },
  });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) return redirectWithParam(`calendar_error=${encodeURIComponent(oauthError)}`);
  if (!code || !state) return redirectWithParam("calendar_error=missing_params");

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: userData, error: userError } = await supabase.auth.getUser(state);
  if (userError || !userData?.user) return redirectWithParam("calendar_error=invalid_session");
  const userId = userData.user.id;

  const redirectUri = `${SUPABASE_URL}/functions/v1/google-oauth-callback`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) return redirectWithParam("calendar_error=token_exchange_failed");

  const { access_token, refresh_token, expires_in } = tokenData;
  if (!refresh_token) {
    // Pasa si Google ya te había dado consentimiento antes y no repite el refresh_token.
    // Revoca el acceso previo en https://myaccount.google.com/permissions y vuelve a intentarlo.
    return redirectWithParam("calendar_error=no_refresh_token");
  }

  // Busca o crea el calendario "Legajo" dentro de la cuenta de Google del usuario
  let calendarId: string | null = null;
  const listRes = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const listData = await listRes.json();
  const existing = (listData.items || []).find((c: { summary?: string; id?: string }) => c.summary === "Legajo");

  if (existing) {
    calendarId = existing.id;
  } else {
    const createRes = await fetch("https://www.googleapis.com/calendar/v3/calendars", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ summary: "Legajo", description: "Agenda gestionada desde Legajo" }),
    });
    const createData = await createRes.json();
    if (!createRes.ok) return redirectWithParam("calendar_error=calendar_create_failed");
    calendarId = createData.id;
  }

  const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

  const { error: upsertError } = await supabase.from("calendar_connections").upsert(
    {
      user_id: userId,
      provider: "google",
      access_token,
      refresh_token,
      expires_at: expiresAt,
      calendar_id: calendarId,
    },
    { onConflict: "user_id,provider" }
  );
  if (upsertError) return redirectWithParam("calendar_error=save_failed");

  return redirectWithParam("calendar_connected=google");
});
