// supabase/functions/ask-claude/index.ts
//
// Recibe { project_id, question } desde el frontend (ya autenticado).
// Reúne notas + tareas + agenda de ese proyecto y se lo pasa como contexto
// a Claude junto con la pregunta. Modo mixto: si el usuario solo pregunta o
// pide opinión, Claude responde en texto sin tocar nada. Si pide
// explícitamente crear tareas o citas, Claude puede usar las herramientas
// create_task / create_event para crearlas de verdad en Legajo.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const MAX_TOOL_ITERATIONS = 5;

type NoteRow = { title: string | null; body: string | null };
type TaskRow = { text: string; done: boolean; due_date: string | null };
type EventRow = { title: string; date: string; time: string | null };

const tools = [
  {
    name: "create_task",
    description:
      "Crea una tarea nueva en este proyecto de Legajo. Úsala solo cuando el usuario pida explícitamente crear tareas.",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Texto de la tarea" },
        due_date: { type: "string", description: "Fecha límite en formato YYYY-MM-DD (opcional)" },
      },
      required: ["text"],
    },
  },
  {
    name: "create_event",
    description:
      "Crea una cita en la agenda de este proyecto de Legajo. Úsala solo cuando el usuario pida explícitamente crear citas.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Título de la cita" },
        date: { type: "string", description: "Fecha en formato YYYY-MM-DD" },
        time: { type: "string", description: "Hora en formato HH:MM (opcional)" },
      },
      required: ["title", "date"],
    },
  },
];

async function runTool(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  projectId: string,
  userId: string,
  name: string,
  input: Record<string, string>
) {
  if (name === "create_task") {
    const { data, error } = await supabase
      .from("tasks")
      .insert({ project_id: projectId, user_id: userId, text: input.text, due_date: input.due_date || null })
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, created: { type: "task", ...data } };
  }
  if (name === "create_event") {
    const { data, error } = await supabase
      .from("events")
      .insert({ project_id: projectId, user_id: userId, title: input.title, date: input.date, time: input.time || null })
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, created: { type: "event", ...data } };
  }
  return { ok: false, error: "unknown_tool" };
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    try {
      const { supabase, userClaims } = ctx;
      const userId = userClaims!.id;
      const { project_id, question } = await req.json();
      if (!project_id || !question) return Response.json({ error: "missing_params" }, { status: 400 });

      const { data: project } = await supabase.from("projects").select("*").eq("id", project_id).maybeSingle();
      if (!project) return Response.json({ error: "not_found" }, { status: 404 });

      const [notesRes, tasksRes, eventsRes] = await Promise.all([
        supabase.from("notes").select("title,body").eq("project_id", project_id),
        supabase.from("tasks").select("text,done,due_date").eq("project_id", project_id),
        supabase.from("events").select("title,date,time").eq("project_id", project_id),
      ]);

      const notes = (notesRes.data || []) as NoteRow[];
      const tasks = (tasksRes.data || []) as TaskRow[];
      const events = (eventsRes.data || []) as EventRow[];

      const today = new Date().toISOString().slice(0, 10);

      const lines: string[] = [];
      lines.push(`Proyecto: ${project.name}`);
      lines.push(`Fecha de hoy: ${today}`);
      lines.push("");
      lines.push(`Notas (${notes.length}):`);
      if (notes.length === 0) lines.push("(ninguna)");
      notes.forEach((n) => lines.push(`- ${n.title || "(sin título)"}: ${(n.body || "").slice(0, 600)}`));
      lines.push("");
      lines.push(`Tareas (${tasks.length}):`);
      if (tasks.length === 0) lines.push("(ninguna)");
      tasks.forEach((t) => lines.push(`- [${t.done ? "hecha" : "pendiente"}]${t.due_date ? ` (vence ${t.due_date})` : ""} ${t.text}`));
      lines.push("");
      lines.push(`Agenda (${events.length}):`);
      if (events.length === 0) lines.push("(ninguna)");
      events.forEach((e) => lines.push(`- ${e.date}${e.time ? " " + e.time : ""}: ${e.title}`));

      const context = lines.join("\n");

      const systemPrompt =
        "Eres un asistente que ayuda a revisar y gestionar un proyecto de trabajo a partir de sus notas, su agenda y " +
        "sus tareas. Responde SIEMPRE en español, en un máximo de 2-3 frases cortas y directas, sin rodeos ni listas " +
        "largas, y nunca uses markdown. " +
        "Si el usuario solo pregunta o pide tu opinión, responde en texto: señala huecos o riesgos relevantes " +
        "(reuniones sin tarea de seguimiento, plazos que chocan con la agenda, tareas sin fecha que deberían tenerla, " +
        "contradicciones entre notas y planificación) sin inventar datos que no estén en el contexto. " +
        "Si el usuario te pide EXPLÍCITAMENTE crear tareas o citas (por ejemplo 'créame tareas a partir de las notas' " +
        "o 'añade una cita para X'), usa las herramientas create_task / create_event para crearlas de verdad, " +
        "basándote en lo que digan las notas y usando la fecha de hoy como referencia para calcular fechas relativas. " +
        "Cuando crees algo, termina con una frase breve confirmando qué has creado. No uses las herramientas si el " +
        "usuario no lo ha pedido explícitamente.";

      const messages: Array<{ role: string; content: unknown }> = [
        { role: "user", content: `Contexto del proyecto:\n\n${context}\n\nPregunta: ${question}` },
      ];

      // deno-lint-ignore no-explicit-any
      const created: any[] = [];
      let finalText = "";

      for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
        const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-5",
            max_tokens: 1024,
            system: systemPrompt,
            tools,
            messages,
          }),
        });

        const data = await anthropicRes.json();
        if (!anthropicRes.ok) return Response.json({ error: "anthropic_error", detail: data });

        finalText = (data.content || [])
          .filter((b: { type: string }) => b.type === "text")
          .map((b: { text: string }) => b.text)
          .join("\n");

        const toolUses = (data.content || []).filter((b: { type: string }) => b.type === "tool_use");
        if (toolUses.length === 0 || data.stop_reason !== "tool_use") break;

        messages.push({ role: "assistant", content: data.content });

        const toolResults = [];
        for (const tu of toolUses as Array<{ id: string; name: string; input: Record<string, string> }>) {
          const result = await runTool(supabase, project_id, userId, tu.name, tu.input);
          if (result.ok && result.created) created.push(result.created);
          toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(result) });
        }
        messages.push({ role: "user", content: toolResults });
      }

      return Response.json({ answer: finalText, created });
    } catch (e) {
      return Response.json({ error: "unexpected", detail: String(e) }, { status: 500 });
    }
  }),
};
