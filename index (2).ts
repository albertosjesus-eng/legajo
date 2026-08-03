// supabase/functions/calendar-status/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

export default {
  fetch: withSupabase({ auth: "user" }, async (_req, ctx) => {
    const { supabaseAdmin, userClaims } = ctx;
    const { data } = await supabaseAdmin
      .from("calendar_connections")
      .select("provider")
      .eq("user_id", userClaims!.id);

    return Response.json({ connections: (data || []).map((d: { provider: string }) => d.provider) });
  }),
};
