// supabase/functions/ask-claude/index.ts
//
// Recibe { project_id, question } desde el frontend (ya autenticado).
// Reúne notas + tareas + agenda de ese proyecto y se lo pasa como contexto
// a Claude junto con la pregunta. Modo consultivo: Claude solo responde,
// no crea ni modifica nada en Legajo.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

type NoteRow = { title: string | null; body: string | null };
type TaskRow = { text: string; done: boolean; due_date: string | null };
type EventRow = { title: string; date: string; time: string | null };

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    try {
      const { supabase } = ctx;
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
        "Eres un asistente que ayuda a revisar un proyecto de trabajo a partir de sus notas, su agenda y sus tareas. " +
        "Responde SIEMPRE en español, en un máximo de 2-3 frases cortas y directas, sin rodeos ni listas largas. " +
        "Ve al grano: si hay un hueco o riesgo relevante (una reunión sin tarea de seguimiento, un plazo que choca con " +
        "la agenda, una tarea sin fecha que debería tenerla, una contradicción entre notas y planificación), dilo en " +
        "una frase. Si no lo hay, dilo brevemente también. No inventes datos que no estén en el contexto; si falta " +
        "información para responder con seguridad, dilo en una frase corta en vez de suponer. Nunca uses markdown.";

      const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-5",
          max_tokens: 300,
          system: systemPrompt,
          messages: [
            {
              role: "user",
              content: `Contexto del proyecto:\n\n${context}\n\nPregunta: ${question}`,
            },
          ],
        }),
      });

      const data = await anthropicRes.json();
      if (!anthropicRes.ok) return Response.json({ error: "anthropic_error", detail: data });

      const answer = (data.content || [])
        .filter((b: { type: string }) => b.type === "text")
        .map((b: { text: string }) => b.text)
        .join("\n");

      return Response.json({ answer });
    } catch (e) {
      return Response.json({ error: "unexpected", detail: String(e) }, { status: 500 });
    }
  }),
};

