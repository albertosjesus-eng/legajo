// supabase/functions/capture/index.ts
//
// Recibe un texto (por ejemplo, un correo seleccionado en Mail) desde un Atajo de
// iOS y lo guarda como captura pendiente en la Bandeja de Legajo.
//
// IMPORTANTE: esta función se despliega con "Verify JWT" DESACTIVADO, porque el
// Atajo no tiene sesión de Supabase. En su lugar se autentica con una clave
// personal (cabecera x-capture-token) cuyo hash está en capture_tokens. La clave
// solo permite CREAR capturas del usuario dueño; no lee nada y se puede anular.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

const MAX_CHARS = 15000; // tope de texto por captura
const MAX_PER_10_MIN = 30; // freno ante bucles o abusos

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default {
  fetch: withSupabase({ auth: "none" }, async (req, ctx) => {
    try {
      if (req.method !== "POST") return Response.json({ error: "method_not_allowed" }, { status: 405 });

      const token = (req.headers.get("x-capture-token") || "").trim();
      if (token.length < 32) return Response.json({ error: "unauthorized" }, { status: 401 });

      const { supabaseAdmin } = ctx;
      const hash = await sha256Hex(token);
      const { data: row, error: tokenErr } = await supabaseAdmin
        .from("capture_tokens")
        .select("id,user_id,revoked")
        .eq("token_hash", hash)
        .maybeSingle();
      if (tokenErr) return Response.json({ error: "token_lookup_failed", detail: tokenErr.message }, { status: 500 });
      if (!row || row.revoked) return Response.json({ error: "unauthorized" }, { status: 401 });

      let body: Record<string, unknown> = {};
      try {
        body = await req.json();
      } catch (_e) {
        return Response.json({ error: "bad_json" }, { status: 400 });
      }

      let texto = typeof body.texto === "string" ? body.texto : "";
      // Limpieza: espacios al final de línea y más de 2 saltos seguidos
      texto = texto.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
      if (!texto) return Response.json({ error: "empty_text" }, { status: 400 });
      if (texto.length > MAX_CHARS) texto = texto.slice(0, MAX_CHARS) + "\n…[recortado]";
      if (body.origen === "correo") texto = "[Correo] " + texto;

      const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { count } = await supabaseAdmin
        .from("capturas")
        .select("id", { count: "exact", head: true })
        .eq("user_id", row.user_id)
        .gte("created_at", since);
      if ((count || 0) >= MAX_PER_10_MIN) return Response.json({ error: "too_many_requests" }, { status: 429 });

      const { data: inserted, error: insErr } = await supabaseAdmin
        .from("capturas")
        .insert({ user_id: row.user_id, texto })
        .select("id")
        .single();
      if (insErr || !inserted) {
        return Response.json({ error: "insert_failed", detail: insErr?.message }, { status: 500 });
      }

      await supabaseAdmin.from("capture_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", row.id);

      return Response.json({ ok: true, id: inserted.id });
    } catch (e) {
      return Response.json({ error: "unexpected", detail: String(e) }, { status: 500 });
    }
  }),
};
