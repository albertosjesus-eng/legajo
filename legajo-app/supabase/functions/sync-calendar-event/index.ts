// supabase/functions/sync-calendar-event/index.ts
//
// Llamada desde el frontend ya autenticado. Crea o borra un evento en el
// calendario "Legajo" del usuario en Google Calendar, renovando el token
// de acceso automáticamente si hace falta.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

function buildGoogleEventBody(event: { title: string; date: string; time?: string | null }) {
  if (event.time) {
    const start = `${event.date}T${event.time}:00`;
    const d = new Date(start);
    d.setMinutes(d.getMinutes() + 60);
    const end = d.toISOString().slice(0, 19);
    return {
      summary: event.title,
      start: { dateTime: start },
      end: { dateTime: end },
    };
  }
  return {
    summary: event.title,
    start: { date: event.date },
    end: { date: event.date },
  };
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    try {
      const { supabaseAdmin, userClaims } = ctx;
      const userId = userClaims!.id;
      const { action, event } = await req.json();

      const { data: conn } = await supabaseAdmin
        .from("calendar_connections")
        .select("*")
        .eq("user_id", userId)
        .eq("provider", "google")
        .maybeSingle();

      if (!conn) return Response.json({ error: "not_connected" });

      let accessToken = conn.access_token as string;
      const isExpiringSoon = new Date(conn.expires_at).getTime() < Date.now() + 60_000;

      if (isExpiringSoon) {
        const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            refresh_token: conn.refresh_token,
            grant_type: "refresh_token",
          }),
        });
        const refreshData = await refreshRes.json();
        if (!refreshRes.ok) return Response.json({ error: "refresh_failed", detail: refreshData });

        accessToken = refreshData.access_token;
        const newExpiresAt = new Date(Date.now() + refreshData.expires_in * 1000).toISOString();
        await supabaseAdmin
          .from("calendar_connections")
          .update({ access_token: accessToken, expires_at: newExpiresAt })
          .eq("user_id", userId)
          .eq("provider", "google");
      }

      const calendarId = conn.calendar_id as string;
      const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

      if (action === "create") {
        const res = await fetch(base, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(buildGoogleEventBody(event)),
        });
        const data = await res.json();
        if (!res.ok) return Response.json({ error: "google_api_error", detail: data });
        return Response.json({ google_event_id: data.id });
      }

      if (action === "delete") {
        if (!event.google_event_id) return Response.json({ ok: true });
        await fetch(`${base}/${event.google_event_id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        return Response.json({ ok: true });
      }

      return Response.json({ error: "unknown_action" }, { status: 400 });
    } catch (e) {
      return Response.json({ error: "unexpected", detail: String(e) }, { status: 500 });
    }
  }),
};
