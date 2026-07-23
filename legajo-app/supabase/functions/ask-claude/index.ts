// supabase/functions/ask-claude/index.ts
//
// Recibe { project_id, question } desde el frontend (ya autenticado).
// Reúne notas + tareas + agenda de ese proyecto y se lo pasa como contexto
// a Claude junto con la pregunta. Modo consultivo: Claude solo responde,
// no crea ni modifica nada en Legajo.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type NoteRow = { title: string | null; body: string | null };
type TaskRow = { text: string; done: boolean };
type EventRow = { title: string; date: string; time: string | null };

Deno.serve(async (req) => {
  try {
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !userData?.user) return json({ error: "unauthorized" }, 401);
    const userId = userData.user.id;

    const { project_id, question } = await req.json();
    if (!project_id || !question) return json({ error: "missing_params" }, 400);

    const { data: project } = await supabase
      .from("projects")
      .select("*")
      .eq("id", project_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!project) return json({ error: "not_found" }, 404);

    const [notesRes, tasksRes, eventsRes] = await Promise.all([
      supabase.from("notes").select("title,body").eq("project_id", project_id),
      supabase.from("tasks").select("text,done").eq("project_id", project_id),
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
    tasks.forEach((t) => lines.push(`- [${t.done ? "hecha" : "pendiente"}] ${t.text}`));
    lines.push("");
    lines.push(`Agenda (${events.length}):`);
    if (events.length === 0) lines.push("(ninguna)");
    events.forEach((e) => lines.push(`- ${e.date}${e.time ? " " + e.time : ""}: ${e.title}`));

    const context = lines.join("\n");

    const systemPrompt =
      "Eres un asistente que ayuda a revisar un proyecto de trabajo a partir de sus notas, su agenda y sus tareas. " +
      "Responde siempre en español, de forma breve, concreta y en formato de texto plano (sin markdown). " +
      "Cuando tenga sentido, señala huecos o riesgos: reuniones sin tarea de seguimiento, plazos que chocan con la " +
      "agenda, tareas sin fecha que probablemente deberían tenerla, contradicciones entre lo que dicen las notas y " +
      "lo planificado, o pasos que parecen no estar contemplados. No inventes datos que no estén en el contexto; " +
      "si falta información para responder con seguridad, dilo explícitamente en vez de suponer.";

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
        messages: [
          {
            role: "user",
            content: `Contexto del proyecto:\n\n${context}\n\nPregunta: ${question}`,
          },
        ],
      }),
    });

    const data = await anthropicRes.json();
    if (!anthropicRes.ok) return json({ error: "anthropic_error", detail: data });

    const answer = (data.content || [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n");

    return json({ answer });
  } catch (e) {
    return json({ error: "unexpected", detail: String(e) }, 500);
  }
});
