// supabase/functions/claude-global-v2/index.ts
//
// "Preguntar a Claude" de la Home, versión con acciones. Responde como antes,
// pero además puede PROPONER cambios (crear/editar/completar/mover tareas y
// citas). No ejecuta nada: devuelve la lista de acciones y la app las aplica
// solo cuando el usuario las confirma.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const TZ = "Europe/Madrid";

type ProjectRow = { id: string; name: string; category: string | null };
type NoteRow = { project_id: string; title: string | null; body: string | null };
type TaskRow = { id: string; project_id: string; text: string; done: boolean; due_date: string | null };
type EventRow = { id: string; project_id: string; title: string; date: string; time: string | null };

const isDate = (s: unknown) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
const isTime = (s: unknown) => typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

const TOOLS = [
  {
    name: "crear_tarea",
    description: "Propone crear una tarea nueva en un proyecto.",
    input_schema: {
      type: "object",
      properties: {
        project_id: { type: "string" },
        text: { type: "string" },
        due_date: { type: "string", description: "YYYY-MM-DD. Omitir si no hay fecha clara." },
      },
      required: ["project_id", "text"],
    },
  },
  {
    name: "crear_cita",
    description: "Propone crear una cita en la agenda de un proyecto.",
    input_schema: {
      type: "object",
      properties: {
        project_id: { type: "string" },
        title: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD" },
        time: { type: "string", description: "HH:MM (24h). Omitir si es de día completo." },
      },
      required: ["project_id", "title", "date"],
    },
  },
  {
    name: "editar_tarea",
    description: "Propone cambiar el texto o la fecha de una tarea existente (usa su id).",
    input_schema: {
      type: "object",
      properties: {
        task_id: { type: "string" },
        text: { type: "string" },
        due_date: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["task_id"],
    },
  },
  {
    name: "completar_tarea",
    description: "Propone marcar como hecha una tarea existente.",
    input_schema: { type: "object", properties: { task_id: { type: "string" } }, required: ["task_id"] },
  },
  {
    name: "mover_tarea",
    description: "Propone mover una tarea a otro proyecto.",
    input_schema: {
      type: "object",
      properties: { task_id: { type: "string" }, project_id: { type: "string", description: "Proyecto de destino" } },
      required: ["task_id", "project_id"],
    },
  },
  {
    name: "editar_cita",
    description: "Propone cambiar título, fecha u hora de una cita existente (usa su id).",
    input_schema: {
      type: "object",
      properties: {
        event_id: { type: "string" },
        title: { type: "string" },
        date: { type: "string" },
        time: { type: "string", description: "HH:MM" },
      },
      required: ["event_id"],
    },
  },
];

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    try {
      const { supabase } = ctx;
      const { question } = await req.json();
      if (!question) return Response.json({ error: "missing_params" }, { status: 400 });

      const { data: projectsData, error: projectsError } = await supabase
        .from("projects")
        .select("id,name,category")
        .eq("archived", false);
      if (projectsError) return Response.json({ error: "projects_query_failed", detail: projectsError.message });
      const projects = (projectsData || []) as ProjectRow[];
      if (projects.length === 0) {
        return Response.json({ answer: "Todavía no tienes proyectos activos sobre los que responder.", actions: [] });
      }
      const projectIds = projects.map((p) => p.id);

      const today = new Date().toLocaleDateString("sv-SE", { timeZone: TZ });
      const from = new Date(Date.now() - 14 * 86400000).toLocaleDateString("sv-SE", { timeZone: TZ });

      const [notesRes, tasksRes, eventsRes] = await Promise.all([
        supabase.from("notes").select("project_id,title,body").in("project_id", projectIds),
        supabase.from("tasks").select("id,project_id,text,done,due_date").in("project_id", projectIds).eq("done", false),
        supabase.from("events").select("id,project_id,title,date,time").in("project_id", projectIds).gte("date", from),
      ]);
      if (notesRes.error || tasksRes.error || eventsRes.error) {
        return Response.json({
          error: "data_query_failed",
          detail: JSON.stringify({ n: notesRes.error?.message, t: tasksRes.error?.message, e: eventsRes.error?.message }),
        });
      }
      const notes = (notesRes.data || []) as NoteRow[];
      const tasks = (tasksRes.data || []) as TaskRow[];
      const events = (eventsRes.data || []) as EventRow[];

      const lines: string[] = [`Fecha de hoy: ${today}`, ""];
      for (const p of projects) {
        lines.push(`### Proyecto: ${p.name} [project_id:${p.id}] (${p.category || "operativo"})`);
        const pNotes = notes.filter((n) => n.project_id === p.id);
        const pTasks = tasks.filter((t) => t.project_id === p.id);
        const pEvents = events.filter((e) => e.project_id === p.id);
        lines.push(`Notas (${pNotes.length}):`);
        if (!pNotes.length) lines.push("(ninguna)");
        pNotes.forEach((n) => lines.push(`- ${n.title || "(sin título)"}: ${n.body || ""}`));
        lines.push(`Tareas pendientes (${pTasks.length}):`);
        if (!pTasks.length) lines.push("(ninguna)");
        pTasks.forEach((t) => lines.push(`- [task_id:${t.id}] ${t.due_date ? `(vence ${t.due_date}) ` : ""}${t.text}`));
        lines.push(`Agenda (${pEvents.length}):`);
        if (!pEvents.length) lines.push("(ninguna)");
        pEvents.forEach((e) => lines.push(`- [event_id:${e.id}] ${e.date}${e.time ? " " + e.time : ""}: ${e.title}`));
        lines.push("");
      }

      const systemPrompt =
        "Eres el asistente de Legajo, una app personal de proyectos. Ves TODOS los proyectos activos del usuario " +
        "(notas, tareas pendientes y agenda, agrupados por proyecto, con sus identificadores). Responde SIEMPRE en " +
        "español, con la longitud que pida la consulta: 2-4 frases para preguntas simples; más extensión y " +
        "estructura (por proyecto, con guiones) para planificaciones o informes. No uses símbolos de markdown " +
        "(asteriscos, almohadillas): el texto se muestra tal cual. Cuando menciones algo concreto, di de qué proyecto es. " +
        "No inventes datos; si falta información, dilo. " +
        "ACCIONES: si el usuario te pide crear, cambiar, completar o mover tareas o citas, usa las herramientas para " +
        "PROPONERLAS (puedes usar varias). Nada se ejecuta hasta que el usuario lo confirma en pantalla, así que " +
        "NUNCA digas que ya está hecho: di 'te propongo…' y resume en una frase qué has preparado. Usa solo los " +
        "identificadores que aparecen en el contexto. Convierte fechas relativas (mañana, el viernes, en una semana) " +
        "a YYYY-MM-DD a partir de la fecha de hoy. Si la petición no encaja con ningún proyecto o es ambigua, pregunta " +
        "en vez de proponer. Si el usuario solo pregunta, no propongas acciones.";

      const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-5",
          max_tokens: 4096,
          system: systemPrompt,
          tools: TOOLS,
          messages: [{ role: "user", content: `Contexto de todos los proyectos:\n\n${lines.join("\n")}\n\nPetición: ${question}` }],
        }),
      });
      const data = await anthropicRes.json();
      if (!anthropicRes.ok) return Response.json({ error: "anthropic_error", detail: data });

      const projectById = new Map(projects.map((p) => [p.id, p]));
      const taskById = new Map(tasks.map((t) => [t.id, t]));
      const eventById = new Map(events.map((e) => [e.id, e]));

      const actions: Record<string, unknown>[] = [];
      const rejected: string[] = [];
      let n = 0;

      // deno-lint-ignore no-explicit-any
      for (const block of (data.content || []) as any[]) {
        if (block.type !== "tool_use") continue;
        const i = block.input || {};
        const id = `a${++n}`;
        const t = block.name as string;

        if (t === "crear_tarea") {
          const p = projectById.get(i.project_id);
          if (!p || !i.text) { rejected.push(t); continue; }
          actions.push({
            id, type: t, project_id: p.id, project_name: p.name, text: String(i.text),
            due_date: isDate(i.due_date) ? i.due_date : null,
          });
        } else if (t === "crear_cita") {
          const p = projectById.get(i.project_id);
          if (!p || !i.title || !isDate(i.date)) { rejected.push(t); continue; }
          actions.push({
            id, type: t, project_id: p.id, project_name: p.name, title: String(i.title),
            date: i.date, time: isTime(i.time) ? i.time : null,
          });
        } else if (t === "editar_tarea") {
          const task = taskById.get(i.task_id);
          if (!task) { rejected.push(t); continue; }
          const patch: Record<string, unknown> = {};
          if (i.text) patch.text = String(i.text);
          if (isDate(i.due_date)) patch.due_date = i.due_date;
          if (!Object.keys(patch).length) { rejected.push(t); continue; }
          actions.push({
            id, type: t, task_id: task.id, project_id: task.project_id,
            project_name: projectById.get(task.project_id)?.name, before: task.text, before_due: task.due_date, patch,
          });
        } else if (t === "completar_tarea") {
          const task = taskById.get(i.task_id);
          if (!task) { rejected.push(t); continue; }
          actions.push({
            id, type: t, task_id: task.id, project_id: task.project_id,
            project_name: projectById.get(task.project_id)?.name, text: task.text,
          });
        } else if (t === "mover_tarea") {
          const task = taskById.get(i.task_id);
          const dest = projectById.get(i.project_id);
          if (!task || !dest || dest.id === task.project_id) { rejected.push(t); continue; }
          actions.push({
            id, type: t, task_id: task.id, text: task.text,
            from_project_id: task.project_id, from_project_name: projectById.get(task.project_id)?.name,
            project_id: dest.id, project_name: dest.name,
          });
        } else if (t === "editar_cita") {
          const ev = eventById.get(i.event_id);
          if (!ev) { rejected.push(t); continue; }
          const patch: Record<string, unknown> = {};
          if (i.title) patch.title = String(i.title);
          if (isDate(i.date)) patch.date = i.date;
          if (isTime(i.time)) patch.time = i.time;
          if (!Object.keys(patch).length) { rejected.push(t); continue; }
          actions.push({
            id, type: t, event_id: ev.id, project_id: ev.project_id,
            project_name: projectById.get(ev.project_id)?.name, before: ev.title, before_date: ev.date, before_time: ev.time, patch,
          });
        }
      }

      let answer = (data.content || [])
        // deno-lint-ignore no-explicit-any
        .filter((b: any) => b.type === "text")
        // deno-lint-ignore no-explicit-any
        .map((b: any) => b.text)
        .join("\n")
        .trim();

      if (!answer) {
        answer = actions.length
          ? `Te propongo ${actions.length} ${actions.length === 1 ? "cambio" : "cambios"}. Revísalos y confirma los que quieras.`
          : "No he podido generar una respuesta de texto.";
      }
      if (rejected.length) {
        answer += `\n\n(No he podido preparar ${rejected.length} ${rejected.length === 1 ? "acción" : "acciones"} por datos incompletos o no válidos.)`;
      }

      return Response.json({ answer, actions });
    } catch (e) {
      return Response.json({ error: "unexpected", detail: String(e) }, { status: 500 });
    }
  }),
};
