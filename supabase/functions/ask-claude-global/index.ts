// supabase/functions/ask-claude-global/index.ts
//
// Versión de "Preguntar a Claude" para la pantalla de inicio: reúne notas,
// tareas y agenda de TODOS los proyectos activos (no archivados) del
// usuario, etiquetadas por proyecto, y responde de forma breve. Solo
// consultivo: no crea ni modifica nada.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

type ProjectRow = { id: string; name: string };
type NoteRow = { project_id: string; title: string | null; body: string | null };
type TaskRow = { project_id: string; text: string; done: boolean; due_date: string | null };
type EventRow = { project_id: string; title: string; date: string; time: string | null };

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    try {
      const { supabase } = ctx;
      const { question } = await req.json();
      if (!question) return Response.json({ error: "missing_params" }, { status: 400 });

      const { data: projectsData, error: projectsError } = await supabase.from("projects").select("id,name").eq("archived", false);
      if (projectsError) {
        return Response.json({ error: "projects_query_failed", detail: projectsError.message });
      }
      const projects = (projectsData || []) as ProjectRow[];

      if (projects.length === 0) {
        return Response.json({ answer: "Todavía no tienes proyectos activos sobre los que responder." });
      }

      const projectIds = projects.map((p) => p.id);

      const [notesRes, tasksRes, eventsRes] = await Promise.all([
        supabase.from("notes").select("project_id,title,body").in("project_id", projectIds),
        supabase.from("tasks").select("project_id,text,done,due_date").in("project_id", projectIds).eq("done", false),
        supabase.from("events").select("project_id,title,date,time").in("project_id", projectIds),
      ]);

      if (notesRes.error || tasksRes.error || eventsRes.error) {
        return Response.json({
          error: "data_query_failed",
          detail: JSON.stringify({
            notes: notesRes.error?.message,
            tasks: tasksRes.error?.message,
            events: eventsRes.error?.message,
          }),
        });
      }

      const notes = (notesRes.data || []) as NoteRow[];
      const tasks = (tasksRes.data || []) as TaskRow[];
      const events = (eventsRes.data || []) as EventRow[];

      const today = new Date().toISOString().slice(0, 10);
      const lines: string[] = [];
      lines.push(`Fecha de hoy: ${today}`);
      lines.push("");

      for (const p of projects) {
        lines.push(`### Proyecto: ${p.name}`);
        const pNotes = notes.filter((n) => n.project_id === p.id);
        const pTasks = tasks.filter((t) => t.project_id === p.id);
        const pEvents = events.filter((e) => e.project_id === p.id);

        lines.push(`Notas (${pNotes.length}):`);
        if (pNotes.length === 0) lines.push("(ninguna)");
        pNotes.forEach((n) => lines.push(`- ${n.title || "(sin título)"}: ${n.body || ""}`));

        lines.push(`Tareas pendientes (${pTasks.length}):`);
        if (pTasks.length === 0) lines.push("(ninguna)");
        pTasks.forEach((t) => lines.push(`- ${t.due_date ? `(vence ${t.due_date}) ` : ""}${t.text}`));

        lines.push(`Agenda (${pEvents.length}):`);
        if (pEvents.length === 0) lines.push("(ninguna)");
        pEvents.forEach((e) => lines.push(`- ${e.date}${e.time ? " " + e.time : ""}: ${e.title}`));

        lines.push("");
      }

      const context = lines.join("\n");

      const systemPrompt =
        "Eres un asistente que ayuda a revisar TODOS los proyectos activos de un usuario a la vez (notas, agenda y " +
        "tareas de cada uno, agrupados por proyecto). Responde SIEMPRE en español. " +
        "Ajusta la longitud a lo que se te pida: para una pregunta simple, responde en 2-4 frases. Para peticiones " +
        "de planificación semanal, priorización, pequeños informes de avance, o síntesis entre varios proyectos, " +
        "responde con la extensión y estructura que haga falta para ser realmente útil — puedes organizar la " +
        "respuesta por proyecto, usar saltos de línea y guiones para listas, pero no uses símbolos de markdown como " +
        "asteriscos o almohadillas (el texto se muestra tal cual, sin formato enriquecido). " +
        "Cuando menciones algo concreto, di de qué proyecto es (usa el nombre del proyecto tal cual aparece). " +
        "Señala huecos o riesgos relevantes que veas cruzando proyectos: tareas vencidas, citas próximas sin tarea " +
        "asociada, contradicciones, sobrecarga de una semana frente a otra, etc. No inventes datos que no estén en " +
        "el contexto; si falta información, dilo en vez de suponer. No puedes crear ni modificar nada, solo " +
        "responder.";

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
          messages: [
            {
              role: "user",
              content: `Contexto de todos los proyectos:\n\n${context}\n\nPregunta: ${question}`,
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

      return Response.json({ answer: answer || "No he podido generar una respuesta de texto." });
    } catch (e) {
      return Response.json({ error: "unexpected", detail: String(e) }, { status: 500 });
    }
  }),
};
