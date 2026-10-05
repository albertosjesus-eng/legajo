// supabase/functions/rutinas/index.ts
//
// R2 (semanal), R3 (antes de una cita) y R4 (mensual). La app la llama al
// abrirse cuando toca una rutina (o a mano desde el botón). Genera el texto
// con Claude y lo guarda en rutinas_resultados; si ya existe para esa clave,
// lo devuelve sin volver a gastar (salvo force=true).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const TZ = "Europe/Madrid";

const fmt = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: TZ });
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
const clip = (s: string | null | undefined, n: number) => {
  const t = (s || "").trim();
  return t.length > n ? t.slice(0, n) + "…" : t;
};

// Semana ISO "YYYY-Www" de una fecha YYYY-MM-DD.
function isoWeekKey(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((dt.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

async function askClaude(system: string, user: string, maxTokens = 2500) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error("anthropic_error: " + JSON.stringify(data));
  const text = (data.content || [])
    // deno-lint-ignore no-explicit-any
    .filter((b: any) => b.type === "text")
    // deno-lint-ignore no-explicit-any
    .map((b: any) => b.text)
    .join("\n")
    .trim();
  if (!text) throw new Error("empty_answer");
  return text;
}

const STYLE =
  "Responde SIEMPRE en español, en texto plano sin símbolos de markdown (nada de asteriscos ni almohadillas; " +
  "el texto se muestra tal cual). Usa saltos de línea y guiones para listas. Sé concreto y breve: " +
  "cita nombres de proyectos y tareas tal como aparecen, no inventes datos y, si falta información, dilo.";

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    try {
      const { supabase, userClaims } = ctx;
      const userId = userClaims!.id as string;
      const { tipo, event_id, force } = await req.json();
      if (!["semanal", "mensual", "cita"].includes(tipo)) {
        return Response.json({ error: "bad_tipo" }, { status: 400 });
      }

      const now = new Date();
      const today = fmt(now);

      // --- clave y comprobación de existencia ---
      let clave = "";
      if (tipo === "semanal") clave = isoWeekKey(today);
      else if (tipo === "mensual") {
        // Repaso del mes anterior completo
        const firstOfThisMonth = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, 1));
        const prev = addDays(firstOfThisMonth, -1);
        clave = prev.toISOString().slice(0, 7);
      } else {
        if (!event_id) return Response.json({ error: "missing_event_id" }, { status: 400 });
        clave = String(event_id);
      }

      const { data: existing } = await supabase
        .from("rutinas_resultados")
        .select("*")
        .eq("tipo", tipo)
        .eq("clave", clave)
        .maybeSingle();
      if (existing && !force) return Response.json({ ok: true, existed: true, resultado: existing });

      // --- datos comunes ---
      const { data: projects, error: pErr } = await supabase
        .from("projects")
        .select("id,name,category,updated_at")
        .eq("archived", false);
      if (pErr) return Response.json({ error: "projects_query_failed", detail: pErr.message });
      if (!projects || projects.length === 0) return Response.json({ ok: true, skipped: "sin_proyectos" });
      const nameOf = new Map((projects as { id: string; name: string }[]).map((p) => [p.id, p.name]));
      const ids = (projects as { id: string }[]).map((p) => p.id);

      let titulo = "";
      let contenido = "";

      if (tipo === "semanal") {
        const from = fmt(addDays(now, -7));
        const to = fmt(addDays(now, 14));
        const [tasksRes, eventsRes, notesRes] = await Promise.all([
          supabase.from("tasks").select("project_id,text,due_date").in("project_id", ids).eq("done", false),
          supabase.from("events").select("project_id,title,date,time").in("project_id", ids).gte("date", from).lte("date", to),
          supabase.from("notes").select("project_id,title,body,updated_at").in("project_id", ids).gte("updated_at", addDays(now, -7).toISOString()),
        ]);
        const tasks = (tasksRes.data || []) as { project_id: string; text: string; due_date: string | null }[];
        const events = (eventsRes.data || []) as { project_id: string; title: string; date: string; time: string | null }[];
        const notes = (notesRes.data || []) as { project_id: string; title: string | null; body: string | null }[];

        const L: string[] = [`Hoy: ${today}`, "", "TAREAS PENDIENTES:"];
        tasks
          .sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999"))
          .forEach((t) => L.push(`- [${nameOf.get(t.project_id)}] ${t.due_date ? `(vence ${t.due_date}) ` : "(sin fecha) "}${t.text}`));
        L.push("", `AGENDA (de ${from} a ${to}):`);
        events
          .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")))
          .forEach((e) => L.push(`- ${e.date}${e.time ? " " + e.time : ""} [${nameOf.get(e.project_id)}] ${e.title}`));
        L.push("", "NOTAS TOCADAS EN LA ÚLTIMA SEMANA:");
        notes.forEach((n) => L.push(`- [${nameOf.get(n.project_id)}] ${n.title || "(sin título)"}: ${clip(n.body, 500)}`));

        contenido = await askClaude(
          "Preparas el resumen semanal de un usuario con varios proyectos. " + STYLE +
            " Estructura: 1) Lo más urgente (vencidas y lo que vence en 7 días, con proyecto). 2) Agenda de la semana " +
            "y citas próximas. 3) Actividad reciente (qué se ha movido según las notas). 4) Riesgos o huecos que veas " +
            "(proyectos sin movimiento, semanas sobrecargadas, citas sin tarea asociada). 5) Una propuesta de las 3 " +
            "prioridades para esta semana. Máximo unas 250 palabras.",
          L.join("\n")
        );
        titulo = `Resumen semanal · ${clave}`;
      } else if (tipo === "mensual") {
        const monthStart = `${clave}-01`;
        const monthEndDate = new Date(Date.UTC(Number(clave.slice(0, 4)), Number(clave.slice(5, 7)), 0));
        const monthEnd = monthEndDate.toISOString().slice(0, 10);
        const [tasksRes, eventsRes, notesRes] = await Promise.all([
          supabase.from("tasks").select("project_id,text,due_date,done").in("project_id", ids),
          supabase.from("events").select("project_id,title,date").in("project_id", ids).gte("date", monthStart).lte("date", monthEnd),
          supabase.from("notes").select("project_id,title,updated_at").in("project_id", ids),
        ]);
        const tasks = (tasksRes.data || []) as { project_id: string; text: string; due_date: string | null; done: boolean }[];
        const events = (eventsRes.data || []) as { project_id: string; title: string; date: string }[];
        const notes = (notesRes.data || []) as { project_id: string; title: string | null; updated_at: string }[];

        const L: string[] = [`Hoy: ${today}. Mes a repasar: ${clave}`, ""];
        for (const p of projects as { id: string; name: string; category: string | null; updated_at: string }[]) {
          const pt = tasks.filter((t) => t.project_id === p.id);
          const pending = pt.filter((t) => !t.done);
          const overdue = pending.filter((t) => t.due_date && t.due_date < today);
          const pe = events.filter((e) => e.project_id === p.id);
          const pn = notes.filter((n) => n.project_id === p.id);
          const lastNote = pn.map((n) => n.updated_at).sort().pop() || "ninguna";
          L.push(
            `### ${p.name} (${p.category || "operativo"}): tareas pendientes ${pending.length}, vencidas ${overdue.length}, ` +
              `hechas ${pt.length - pending.length}; citas del mes ${pe.length}; notas ${pn.length} (última edición ${lastNote.slice(0, 10)}); ` +
              `proyecto actualizado ${p.updated_at.slice(0, 10)}`
          );
          overdue.slice(0, 5).forEach((t) => L.push(`   vencida (${t.due_date}): ${t.text}`));
          pe.slice(0, 5).forEach((e) => L.push(`   cita ${e.date}: ${e.title}`));
        }

        contenido = await askClaude(
          "Preparas el repaso mensual de un usuario con proyectos Estratégicos y Operativos. " + STYLE +
            " Estructura: 1) Visión general del mes. 2) Estado por proyecto en una o dos líneas (los estratégicos primero). " +
            "3) Tareas vencidas acumuladas y qué hacer con ellas (replanificar, cerrar o descartar). 4) Proyectos que " +
            "parecen parados y que podrían archivarse o reactivarse. 5) Tres decisiones o acciones recomendadas para el " +
            "mes que empieza. Máximo unas 300 palabras.",
          L.join("\n"),
          3000
        );
        titulo = `Repaso mensual · ${clave}`;
      } else {
        const { data: ev, error: evErr } = await supabase
          .from("events")
          .select("id,project_id,title,date,time")
          .eq("id", event_id)
          .maybeSingle();
        if (evErr || !ev) return Response.json({ error: "event_not_found", detail: evErr?.message });

        const [notesRes, tasksRes, eventsRes] = await Promise.all([
          supabase.from("notes").select("title,body,updated_at").eq("project_id", ev.project_id),
          supabase.from("tasks").select("text,due_date").eq("project_id", ev.project_id).eq("done", false),
          supabase
            .from("events")
            .select("id,title,date,time")
            .eq("project_id", ev.project_id)
            .gte("date", fmt(addDays(now, -30)))
            .lte("date", fmt(addDays(now, 14))),
        ]);
        const notes = (notesRes.data || []) as { title: string | null; body: string | null; updated_at: string }[];
        const tasks = (tasksRes.data || []) as { text: string; due_date: string | null }[];
        const others = ((eventsRes.data || []) as { id: string; title: string; date: string; time: string | null }[]).filter(
          (e) => e.id !== ev.id
        );

        const L: string[] = [
          `Hoy: ${today}`,
          `CITA: ${ev.date}${ev.time ? " " + ev.time : ""} — ${ev.title}`,
          `PROYECTO: ${nameOf.get(ev.project_id)}`,
          "",
          "TAREAS PENDIENTES DEL PROYECTO:",
          ...tasks.map((t) => `- ${t.due_date ? `(vence ${t.due_date}) ` : ""}${t.text}`),
          "",
          "OTRAS CITAS DEL PROYECTO (último mes y próximas dos semanas):",
          ...others.map((e) => `- ${e.date}${e.time ? " " + e.time : ""}: ${e.title}`),
          "",
          "NOTAS DEL PROYECTO (más recientes primero):",
          ...notes
            .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
            .map((n) => `- ${n.title || "(sin título)"} [${n.updated_at.slice(0, 10)}]: ${clip(n.body, 1500)}`),
        ];

        contenido = await askClaude(
          "Preparas una ficha breve para que el usuario llegue preparado a una cita. " + STYLE +
            " Estructura: 1) De qué va y qué contexto hay en las notas del proyecto (lo relevante para esta cita). " +
            "2) Pendientes del proyecto que conviene tener resueltos o mencionar. 3) Preguntas o puntos que sería bueno " +
            "plantear. Si las notas no dicen nada relevante sobre la cita, dilo claramente y no rellenes. " +
            "Máximo unas 180 palabras.",
          L.join("\n"),
          1500
        );
        titulo = `Antes de la cita · ${ev.title}`;
      }

      const row = { user_id: userId, tipo, clave, titulo, contenido, leido: false, created_at: new Date().toISOString() };
      const { data: saved, error: saveErr } = await supabase
        .from("rutinas_resultados")
        .upsert(row, { onConflict: "user_id,tipo,clave" })
        .select()
        .single();
      if (saveErr) return Response.json({ error: "save_failed", detail: saveErr.message });

      return Response.json({ ok: true, existed: false, resultado: saved });
    } catch (e) {
      return Response.json({ error: "unexpected", detail: String(e) }, { status: 500 });
    }
  }),
};
