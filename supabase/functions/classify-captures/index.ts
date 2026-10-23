// supabase/functions/classify-captures/index.ts
//
// R1: sugiere qué hacer con cada captura pendiente (a qué proyecto va y si es
// tarea, cita o nota). Guarda la sugerencia en capturas.sugerencia_json; la
// app la muestra y el usuario la acepta o la ignora. No procesa nada solo.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const TZ = "Europe/Madrid";
const MAX_CAPTURAS = 30;

const isDate = (s: unknown) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
const isTime = (s: unknown) => typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

const TOOL = {
  name: "clasificar",
  description: "Devuelve una sugerencia para cada captura.",
  input_schema: {
    type: "object",
    properties: {
      sugerencias: {
        type: "array",
        items: {
          type: "object",
          properties: {
            captura_id: { type: "string" },
            tipo: { type: "string", enum: ["tarea", "cita", "nota"] },
            project_id: { type: "string", description: "id del proyecto más probable; omitir si no hay ninguno claro" },
            texto: { type: "string", description: "Texto limpio y breve para la tarea/cita/nota (sin la fecha si ya la pones aparte)" },
            fecha: { type: "string", description: "YYYY-MM-DD (fecha límite de la tarea o fecha de la cita)" },
            hora: { type: "string", description: "HH:MM, solo para citas" },
            motivo: { type: "string", description: "Una frase corta que explique la elección" },
          },
          required: ["captura_id", "tipo"],
        },
      },
    },
    required: ["sugerencias"],
  },
};

export default {
  fetch: withSupabase({ auth: "user" }, async (_req, ctx) => {
    try {
      const { supabase } = ctx;

      const { data: capturas, error: capErr } = await supabase
        .from("capturas")
        .select("id,texto,sugerencia_json")
        .eq("estado", "pendiente")
        .is("sugerencia_json", null)
        .order("created_at", { ascending: true })
        .limit(MAX_CAPTURAS);
      if (capErr) return Response.json({ error: "capturas_query_failed", detail: capErr.message });
      if (!capturas || capturas.length === 0) return Response.json({ ok: true, count: 0 });

      const { data: projects, error: pErr } = await supabase
        .from("projects")
        .select("id,name,category")
        .eq("archived", false);
      if (pErr) return Response.json({ error: "projects_query_failed", detail: pErr.message });
      if (!projects || projects.length === 0) return Response.json({ ok: true, count: 0 });

      const ids = projects.map((p: { id: string }) => p.id);
      const { data: tasks } = await supabase
        .from("tasks")
        .select("project_id,text")
        .in("project_id", ids)
        .eq("done", false)
        .limit(200);

      const lines: string[] = [];
      for (const p of projects as { id: string; name: string; category: string | null }[]) {
        lines.push(`- ${p.name} [project_id:${p.id}] (${p.category || "operativo"})`);
        const sample = ((tasks || []) as { project_id: string; text: string }[])
          .filter((t) => t.project_id === p.id)
          .slice(0, 4)
          .map((t) => t.text);
        if (sample.length) lines.push(`    tareas de ejemplo: ${sample.join(" | ")}`);
      }

      const today = new Date().toLocaleDateString("sv-SE", { timeZone: TZ });
      const weekday = new Date().toLocaleDateString("es-ES", { timeZone: TZ, weekday: "long" });

      const prompt =
        `Fecha de hoy: ${today} (${weekday}).\n\nProyectos activos:\n${lines.join("\n")}\n\n` +
        `Capturas pendientes:\n` +
        (capturas as { id: string; texto: string }[]).map((c) => `- [captura_id:${c.id}] ${c.texto}`).join("\n");

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 4096,
          system:
            "Clasificas notas rápidas de un usuario para su app de proyectos. Para cada captura decide: " +
            "'tarea' (algo por hacer), 'cita' (algo con fecha/hora concreta a la que acudir o que ocurre en un momento) " +
            "o 'nota' (información, idea o apunte sin acción). Elige el proyecto más probable usando solo los " +
            "project_id dados; si ninguno encaja con claridad, omite project_id. Convierte fechas relativas a " +
            "YYYY-MM-DD desde la fecha de hoy. No inventes fechas que no se deduzcan del texto. " +
            "Responde en español y llama a la herramienta 'clasificar' con una sugerencia por captura.",
          tools: [TOOL],
          tool_choice: { type: "tool", name: "clasificar" },
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await res.json();
      if (!res.ok) return Response.json({ error: "anthropic_error", detail: data });

      // deno-lint-ignore no-explicit-any
      const block = (data.content || []).find((b: any) => b.type === "tool_use");
      const sugerencias = (block?.input?.sugerencias || []) as Record<string, string>[];

      const projectIds = new Set(ids as string[]);
      const capturaIds = new Set((capturas as { id: string }[]).map((c) => c.id));
      let saved = 0;

      for (const s of sugerencias) {
        if (!capturaIds.has(s.captura_id)) continue;
        if (!["tarea", "cita", "nota"].includes(s.tipo)) continue;
        const sugerencia = {
          tipo: s.tipo,
          project_id: projectIds.has(s.project_id) ? s.project_id : null,
          texto: s.texto ? String(s.texto).slice(0, 500) : null,
          fecha: isDate(s.fecha) ? s.fecha : null,
          hora: isTime(s.hora) ? s.hora : null,
          motivo: s.motivo ? String(s.motivo).slice(0, 200) : null,
        };
        const { error } = await supabase.from("capturas").update({ sugerencia_json: sugerencia }).eq("id", s.captura_id);
        if (!error) saved++;
      }

      return Response.json({ ok: true, count: saved });
    } catch (e) {
      return Response.json({ error: "unexpected", detail: String(e) }, { status: 500 });
    }
  }),
};
