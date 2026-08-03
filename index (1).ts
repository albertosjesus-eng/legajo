// supabase/functions/disconnect-google/index.ts
//
// Borra la conexión de Google guardada (calendario + tareas) y limpia las
// referencias de eventos/tareas que apuntaban a ella, para que una futura
// reconexión (misma cuenta u otra distinta) empiece limpia.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

export default {
  fetch: withSupabase({ auth: "user" }, async (_req, ctx) => {
    const { supabase, supabaseAdmin, userClaims } = ctx;
    const userId = userClaims!.id;

    await supabaseAdmin.from("calendar_connections").delete().eq("user_id", userId).eq("provider", "google");
    await supabase.from("events").update({ google_event_id: null }).eq("user_id", userId);
    await supabase.from("tasks").update({ google_task_id: null }).eq("user_id", userId);

    return Response.json({ ok: true });
  }),
};
