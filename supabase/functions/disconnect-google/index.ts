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

    const { error: deleteError } = await supabaseAdmin
      .from("calendar_connections")
      .delete()
      .eq("user_id", userId)
      .eq("provider", "google");
    if (deleteError) {
      return Response.json({ error: "delete_failed", detail: deleteError.message }, { status: 500 });
    }

    const { error: eventsError } = await supabase.from("events").update({ google_event_id: null }).eq("user_id", userId);
    const { error: tasksError } = await supabase.from("tasks").update({ google_task_id: null }).eq("user_id", userId);
    if (eventsError || tasksError) {
      // la conexión ya se borró (lo importante); esto solo deja referencias sueltas
      return Response.json({
        ok: true,
        warning: "cleanup_partial",
        detail: JSON.stringify({ events: eventsError?.message, tasks: tasksError?.message }),
      });
    }

    return Response.json({ ok: true });
  }),
};
