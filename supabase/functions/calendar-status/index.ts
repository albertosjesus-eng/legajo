// supabase/functions/calendar-status/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

export default {
  fetch: withSupabase({ auth: "user" }, async (_req, ctx) => {
    const { supabaseAdmin, userClaims } = ctx;
    const { data, error } = await supabaseAdmin
      .from("calendar_connections")
      .select("provider,connected_at")
      .eq("user_id", userClaims!.id);

    if (error) {
      return Response.json({ error: "status_query_failed", detail: error.message }, { status: 500 });
    }

    const rows = data || [];
    const google = rows.find((r: { provider: string }) => r.provider === "google");

    let needsReconnect = false;
    let daysLeft: number | null = null;
    if (google?.connected_at) {
      const connectedAt = new Date(google.connected_at).getTime();
      const msLeft = connectedAt + 7 * 24 * 60 * 60 * 1000 - Date.now();
      daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
      needsReconnect = msLeft <= 0;
    }

    return Response.json({
      connections: rows.map((d: { provider: string }) => d.provider),
      google_needs_reconnect: needsReconnect,
      google_days_left: daysLeft,
    });
  }),
};
