// supabase/functions/sync-google-task/index.ts
//
// Llamada desde el frontend ya autenticado. Crea, actualiza o borra una
// tarea en la lista "Legajo" de Google Tasks, renovando el token de acceso
// automáticamente si hace falta. Comparte el mismo token que Google Calendar.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

function buildGoogleTaskBody(task: { text: string; due_date?: string | null; done?: boolean }) {
  return {
    title: task.text,
    due: task.due_date ? `${task.due_date}T00:00:00.000Z` : undefined,
    status: task.done ? "completed" : "needsAction",
  };
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    try {
      const { supabaseAdmin, userClaims } = ctx;
      const userId = userClaims!.id;
      const { action, task } = await req.json();

      const { data: conn } = await supabaseAdmin
        .from("calendar_connections")
        .select("*")
        .eq("user_id", userId)
        .eq("provider", "google")
        .maybeSingle();

      if (!conn || !conn.task_list_id) return Response.json({ error: "not_connected" });

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

      const taskListId = conn.task_list_id as string;
      const base = `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(taskListId)}/tasks`;

      if (action === "create") {
        const res = await fetch(base, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(buildGoogleTaskBody(task)),
        });
        const data = await res.json();
        if (!res.ok) return Response.json({ error: "google_api_error", detail: data });
        return Response.json({ google_task_id: data.id });
      }

      if (action === "update") {
        if (!task.google_task_id) return Response.json({ error: "missing_google_task_id" });
        const res = await fetch(`${base}/${task.google_task_id}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(buildGoogleTaskBody(task)),
        });
        const data = await res.json();
        if (!res.ok) return Response.json({ error: "google_api_error", detail: data });
        return Response.json({ ok: true });
      }

      if (action === "delete") {
        if (!task.google_task_id) return Response.json({ ok: true });
        await fetch(`${base}/${task.google_task_id}`, {
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
