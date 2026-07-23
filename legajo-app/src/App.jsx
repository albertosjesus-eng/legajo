import { useState, useEffect, useRef } from "react";
import {
  Plus, X, Trash2, ChevronLeft, FileText, CalendarDays,
  CheckSquare, Square, Loader2, FolderOpen, LogOut, Link2, CalendarCheck,
  Sparkles, Send
} from "lucide-react";
import { supabase } from "./supabaseClient";
import Login from "./Login";

const PALETTE = [
  { name: "ámbar", hex: "#C9992F" },
  { name: "trébol", hex: "#5C7A52" },
  { name: "añil", hex: "#4C5B8C" },
  { name: "ladrillo", hex: "#B5533C" },
  { name: "malva", hex: "#7A4C6E" },
  { name: "petróleo", hex: "#2F6E68" },
];

const INK = "#1E1C1A";
const SURFACE = "#28241F";
const SURFACE2 = "#332D26";
const PAPER = "#F3EEE1";
const TEXT_LIGHT = "#EDE7D9";
const TEXT_MUTED = "#B7AE9C";
const INK_ON_PAPER = "#2A2520";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function emptyData() {
  return { notes: [], tasks: [], events: [] };
}

function timeAgo(iso) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "ahora mismo";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "ayer";
  if (days < 30) return `hace ${days} días`;
  const months = Math.floor(days / 30);
  if (months < 12) return `hace ${months} mes${months > 1 ? "es" : ""}`;
  const years = Math.floor(months / 12);
  return `hace ${years} año${years > 1 ? "s" : ""}`;
}

function ProjectCard({ project, onOpen }) {
  return (
    <button
      onClick={() => onOpen(project.id)}
      className="text-left p-4 rounded-lg flex flex-col gap-2 transition-transform"
      style={{ background: SURFACE2, borderLeft: `4px solid ${project.color}` }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: project.color }} />
        <span className="font-serif text-base truncate" style={{ color: TEXT_LIGHT }}>
          {project.name || "Sin nombre"}
        </span>
      </div>
      <span className="text-xs" style={{ color: TEXT_MUTED }}>
        Actualizado {timeAgo(project.updated_at || project.created_at)}
      </span>
    </button>
  );
}

function NotesPanel({ notes, onAdd, onUpdate, onDelete, onFlush, color }) {
  const [openId, setOpenId] = useState(null);
  const openNote = notes.find((n) => n.id === openId);

  if (openId && openNote) {
    return (
      <div className="flex flex-col h-full">
        <button
          onClick={() => {
            onFlush(openId);
            setOpenId(null);
          }}
          className="flex items-center gap-1 text-xs mb-3 self-start"
          style={{ color: TEXT_MUTED }}
        >
          <ChevronLeft size={14} /> Volver a notas
        </button>
        <div className="rounded-lg p-3 flex-1 flex flex-col" style={{ background: PAPER }}>
          <input
            value={openNote.title}
            onChange={(e) => onUpdate(openId, { title: e.target.value })}
            placeholder="Título de la nota"
            className="mb-2 bg-transparent border-none outline-none text-base font-serif"
            style={{ color: INK_ON_PAPER }}
          />
          <textarea
            value={openNote.body}
            onChange={(e) => onUpdate(openId, { body: e.target.value })}
            placeholder="Escribe aquí..."
            className="flex-1 bg-transparent border-none outline-none resize-none text-sm leading-relaxed"
            style={{ color: INK_ON_PAPER, minHeight: "220px" }}
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={() => {
                onDelete(openId);
                setOpenId(null);
              }}
              className="text-xs flex items-center gap-1"
              style={{ color: "#8a3b2a" }}
            >
              <Trash2 size={12} /> Eliminar nota
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <button
        onClick={async () => {
          const id = await onAdd();
          if (id) setOpenId(id);
        }}
        className="flex items-center gap-2 text-sm mb-3 px-3 py-2 rounded-md self-start"
        style={{ background: color, color: "#fff" }}
      >
        <Plus size={15} /> Nueva nota
      </button>
      <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
        {notes.length === 0 && (
          <p className="text-sm" style={{ color: TEXT_MUTED }}>
            Aún no hay notas en este proyecto.
          </p>
        )}
        {notes
          .slice()
          .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
          .map((n) => (
            <button
              key={n.id}
              onClick={() => setOpenId(n.id)}
              className="text-left p-3 rounded-md"
              style={{ background: PAPER }}
            >
              <div className="font-serif text-sm truncate" style={{ color: INK_ON_PAPER }}>
                {n.title || "Sin título"}
              </div>
              <div
                className="text-xs mt-1 overflow-hidden"
                style={{ color: "#6b6252", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
              >
                {n.body || "Nota vacía"}
              </div>
            </button>
          ))}
      </div>
    </div>
  );
}

function TasksPanel({ tasks, onAdd, onToggle, onDelete, color }) {
  const [text, setText] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [showDate, setShowDate] = useState(false);
  const submit = () => {
    if (!text.trim()) return;
    onAdd(text.trim(), dueDate || null);
    setText("");
    setDueDate("");
    setShowDate(false);
  };
  const today = todayISO();
  const pending = tasks
    .filter((t) => !t.done)
    .slice()
    .sort((a, b) => (a.due_date || "9999-99-99").localeCompare(b.due_date || "9999-99-99"));
  const done = tasks.filter((t) => t.done);

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col gap-1.5 mb-3">
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="Añadir tarea..."
            className="flex-1 px-3 py-2 rounded-md text-sm outline-none"
            style={{ background: PAPER, color: INK_ON_PAPER }}
          />
          <button
            onClick={() => setShowDate((s) => !s)}
            title="Poner fecha límite"
            className="px-2.5 rounded-md"
            style={{ background: showDate || dueDate ? color : SURFACE2, color: showDate || dueDate ? "#fff" : TEXT_MUTED }}
          >
            <CalendarDays size={15} />
          </button>
          <button onClick={submit} className="px-3 rounded-md" style={{ background: color, color: "#fff" }}>
            <Plus size={16} />
          </button>
        </div>
        {showDate && (
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="px-2 py-1.5 rounded text-sm outline-none self-start"
            style={{ background: PAPER, color: INK_ON_PAPER }}
          />
        )}
      </div>
      <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 pr-1">
        {tasks.length === 0 && (
          <p className="text-sm" style={{ color: TEXT_MUTED }}>
            Sin tareas todavía.
          </p>
        )}
        {pending.map((t) => {
          const isOverdue = t.due_date && t.due_date < today;
          const isToday = t.due_date && t.due_date === today;
          return (
            <div key={t.id} className="flex items-start gap-2 p-2 rounded-md group" style={{ background: SURFACE2 }}>
              <button onClick={() => onToggle(t)} className="mt-0.5 shrink-0" style={{ color }}>
                <Square size={16} />
              </button>
              <div className="flex-1 min-w-0">
                <span className="text-sm" style={{ color: TEXT_LIGHT }}>
                  {t.text}
                </span>
                {t.due_date && (
                  <div
                    className="text-[11px] font-mono mt-0.5"
                    style={{ color: isOverdue ? "#e0836f" : isToday ? color : TEXT_MUTED }}
                  >
                    {isOverdue ? "vencida · " : ""}
                    {t.due_date.slice(5).replace("-", "/")}
                  </div>
                )}
              </div>
              <button
                onClick={() => onDelete(t.id)}
                className="opacity-0 group-hover:opacity-100 shrink-0"
                style={{ color: TEXT_MUTED }}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
        {done.length > 0 && (
          <div className="text-xs mt-2 mb-1" style={{ color: TEXT_MUTED }}>
            Hechas
          </div>
        )}
        {done.map((t) => (
          <div key={t.id} className="flex items-start gap-2 p-2 rounded-md group">
            <button onClick={() => onToggle(t)} className="mt-0.5 shrink-0" style={{ color }}>
              <CheckSquare size={16} />
            </button>
            <span className="text-sm flex-1 line-through" style={{ color: TEXT_MUTED }}>
              {t.text}
            </span>
            <button
              onClick={() => onDelete(t.id)}
              className="opacity-0 group-hover:opacity-100 shrink-0"
              style={{ color: TEXT_MUTED }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgendaPanel({ events, onAdd, onDelete, color }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState("");
  const [showForm, setShowForm] = useState(false);

  const submit = () => {
    if (!title.trim() || !date) return;
    onAdd(title.trim(), date, time);
    setTitle("");
    setTime("");
    setShowForm(false);
  };

  const sorted = events.slice().sort((a, b) => (a.date + (a.time || "00:00")).localeCompare(b.date + (b.time || "00:00")));
  const today = todayISO();

  return (
    <div className="flex flex-col h-full">
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 text-sm mb-3 px-3 py-2 rounded-md self-start"
          style={{ background: color, color: "#fff" }}
        >
          <Plus size={15} /> Nueva cita
        </button>
      ) : (
        <div className="mb-3 p-3 rounded-md flex flex-col gap-2" style={{ background: PAPER }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Reunión / actividad"
            className="px-2 py-1.5 rounded text-sm outline-none"
            style={{ background: "#fff", color: INK_ON_PAPER }}
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="flex-1 px-2 py-1.5 rounded text-sm outline-none"
              style={{ background: "#fff", color: INK_ON_PAPER }}
            />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="px-2 py-1.5 rounded text-sm outline-none"
              style={{ background: "#fff", color: INK_ON_PAPER }}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="text-xs px-2 py-1" style={{ color: "#6b6252" }}>
              Cancelar
            </button>
            <button onClick={submit} className="text-xs px-3 py-1.5 rounded" style={{ background: color, color: "#fff" }}>
              Guardar
            </button>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
        {sorted.length === 0 && (
          <p className="text-sm" style={{ color: TEXT_MUTED }}>
            Agenda vacía.
          </p>
        )}
        {sorted.map((ev) => {
          const isPast = ev.date < today;
          const isToday = ev.date === today;
          return (
            <div key={ev.id} className="flex items-center gap-3 p-2.5 rounded-md group" style={{ background: SURFACE2 }}>
              <div
                className="text-center shrink-0 px-2 py-1 rounded"
                style={{ background: isToday ? color : isPast ? "#4a4038" : SURFACE, minWidth: "50px" }}
              >
                <div className="text-[10px] uppercase tracking-wide font-mono" style={{ color: "#fff" }}>
                  {ev.date.slice(5).replace("-", "/")}
                </div>
                {ev.time && (
                  <div className="text-[10px] font-mono" style={{ color: "#fff" }}>
                    {ev.time}
                  </div>
                )}
              </div>
              <span className="text-sm flex-1" style={{ color: isPast ? TEXT_MUTED : TEXT_LIGHT }}>
                {ev.title}
              </span>
              <button
                onClick={() => onDelete(ev.id)}
                className="opacity-0 group-hover:opacity-100 shrink-0"
                style={{ color: TEXT_MUTED }}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AskClaudePanel({ projectId, color }) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastQA, setLastQA] = useState(null);
  const [error, setError] = useState("");

  const ask = async () => {
    if (!question.trim() || loading) return;
    const q = question.trim();
    setQuestion("");
    setLoading(true);
    setError("");
    setLastQA(null);
    try {
      const { ok, status, data } = await callEdgeFunction("ask-claude", { project_id: projectId, question: q });
      if (!ok || data?.error) {
        const detail = data?.error
          ? data.error + (data.detail ? ": " + (typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail)) : "")
          : `HTTP ${status}`;
        setError("No se pudo obtener respuesta (" + detail + ").");
      } else {
        setLastQA({ question: q, answer: data.answer });
      }
    } catch (e) {
      setError("No se pudo obtener respuesta. Inténtalo de nuevo.");
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1 mb-3">
        {!lastQA && !loading && (
          <p className="text-sm" style={{ color: TEXT_MUTED }}>
            El asistente responde aquí, de forma breve, a tu última pregunta.
          </p>
        )}
        {lastQA && (
          <div className="flex flex-col gap-1.5">
            <div
              className="text-sm font-medium self-end px-3 py-1.5 rounded-md"
              style={{ background: color, color: "#fff", maxWidth: "90%" }}
            >
              {lastQA.question}
            </div>
            <div className="text-sm px-3 py-2 rounded-md whitespace-pre-wrap" style={{ background: PAPER, color: INK_ON_PAPER }}>
              {lastQA.answer}
            </div>
          </div>
        )}
        {loading && (
          <div className="flex items-center gap-2 text-xs" style={{ color: TEXT_MUTED }}>
            <Loader2 size={13} className="animate-spin" /> Pensando...
          </div>
        )}
      </div>
      {error && (
        <div className="text-xs mb-2 px-3 py-2 rounded-md" style={{ background: "#4a2b23", color: "#f2d9d0" }}>
          {error}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
          placeholder="Pregunta algo sobre este proyecto..."
          className="flex-1 px-3 py-2 rounded-md text-sm outline-none"
          style={{ background: PAPER, color: INK_ON_PAPER }}
        />
        <button
          onClick={ask}
          disabled={loading}
          className="px-3 rounded-md"
          style={{ background: color, color: "#fff", opacity: loading ? 0.7 : 1 }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

// Llama a una Edge Function directamente por HTTP (en vez de supabase.functions.invoke,
// que en ciertas versiones de supabase-js oculta el cuerpo real de las respuestas de
// error). Así siempre podemos ver el motivo exacto de un fallo.
async function callEdgeFunction(name, body) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const res = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token || anonKey}`,
      apikey: anonKey,
    },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

function LegajoApp({ userId, userEmail, onLogout }) {
  const [projects, setProjects] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [view, setView] = useState("home"); // "home" | "project"
  const [projectData, setProjectData] = useState({});
  const [loadingIndex, setLoadingIndex] = useState(true);
  const [loadingProject, setLoadingProject] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PALETTE[0].hex);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [googleConnected, setGoogleConnected] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [calendarNotice, setCalendarNotice] = useState(null);

  const noteTimers = useRef({});
  const notePending = useRef({});

  useEffect(() => {
    loadProjects();
    checkCalendarStatus();

    // Si venimos de vuelta de Google, mostramos aviso y limpiamos la URL
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("calendar_connected");
    const calError = params.get("calendar_error");
    if (connected) {
      setCalendarNotice({ type: "ok", text: "Google Calendar conectado. Se ha creado el calendario 'Legajo' en tu cuenta." });
      setGoogleConnected(true);
    } else if (calError) {
      setCalendarNotice({ type: "error", text: "No se pudo conectar Google Calendar (" + calError + ")." });
    }
    if (connected || calError) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkCalendarStatus() {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return;
    try {
      const { data } = await callEdgeFunction("calendar-status");
      if (data?.connections?.includes("google")) setGoogleConnected(true);
    } catch (e) {
      // silencioso: si falla, simplemente se mostrará el botón de conectar
    }
  }

  async function connectGoogleCalendar() {
    setConnectingGoogle(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) {
      setConnectingGoogle(false);
      return;
    }
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const redirectUri = `${supabaseUrl}/functions/v1/google-oauth-callback`;
    const authUrl =
      "https://accounts.google.com/o/oauth2/v2/auth" +
      `?client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      "&response_type=code" +
      "&access_type=offline" +
      "&prompt=consent" +
      `&scope=${encodeURIComponent("https://www.googleapis.com/auth/calendar")}` +
      `&state=${encodeURIComponent(token)}`;
    window.location.href = authUrl;
  }

  async function loadProjects() {
    setLoadingIndex(true);
    setLoadError("");
    const { data, error } = await supabase.from("projects").select("*").order("updated_at", { ascending: false });
    if (error) {
      setLoadError("No se pudieron cargar los proyectos: " + error.message);
    } else {
      setProjects(data || []);
    }
    setLoadingIndex(false);
  }

  useEffect(() => {
    if (!activeId || projectData[activeId]) return;
    loadProjectData(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  async function loadProjectData(id) {
    setLoadingProject(true);
    const [notesRes, tasksRes, eventsRes] = await Promise.all([
      supabase.from("notes").select("*").eq("project_id", id),
      supabase.from("tasks").select("*").eq("project_id", id),
      supabase.from("events").select("*").eq("project_id", id),
    ]);
    setProjectData((pd) => ({
      ...pd,
      [id]: {
        notes: notesRes.data || [],
        tasks: tasksRes.data || [],
        events: eventsRes.data || [],
      },
    }));
    setLoadingProject(false);
  }

  async function addProject() {
    if (!newName.trim()) return;
    const { data, error } = await supabase
      .from("projects")
      .insert({ name: newName.trim(), color: newColor, user_id: userId })
      .select()
      .single();
    if (!error && data) {
      setProjects((p) => [...p, data]);
      setProjectData((pd) => ({ ...pd, [data.id]: emptyData() }));
      setActiveId(data.id);
      setView("project");
    }
    setNewName("");
    setShowNewProject(false);
  }

  async function deleteProject(id) {
    await supabase.from("projects").delete().eq("id", id);
    const remaining = projects.filter((p) => p.id !== id);
    setProjects(remaining);
    setProjectData((pd) => {
      const c = { ...pd };
      delete c[id];
      return c;
    });
    setActiveId(null);
    setView("home");
    setConfirmDelete(false);
  }

  function openProject(id) {
    setActiveId(id);
    setView("project");
  }

  const active = projects.find((p) => p.id === activeId);
  const data = activeId ? projectData[activeId] || emptyData() : null;

  async function addNote() {
    const { data: note, error } = await supabase
      .from("notes")
      .insert({ project_id: activeId, user_id: userId, title: "", body: "" })
      .select()
      .single();
    if (error || !note) return null;
    setProjectData((pd) => ({ ...pd, [activeId]: { ...pd[activeId], notes: [...pd[activeId].notes, note] } }));
    return note.id;
  }

  function updateNote(id, patch) {
    setProjectData((pd) => ({
      ...pd,
      [activeId]: { ...pd[activeId], notes: pd[activeId].notes.map((n) => (n.id === id ? { ...n, ...patch } : n)) },
    }));
    // Acumulamos los cambios pendientes (título Y cuerpo) en vez de quedarnos
    // solo con el último campo tocado, para no perder ninguno de los dos si
    // el usuario alterna entre título y cuerpo antes de que se guarde.
    notePending.current[id] = { ...(notePending.current[id] || {}), ...patch };
    clearTimeout(noteTimers.current[id]);
    noteTimers.current[id] = setTimeout(() => flushNote(id), 500);
  }

  function flushNote(id) {
    clearTimeout(noteTimers.current[id]);
    const pending = notePending.current[id];
    if (!pending) return;
    delete notePending.current[id];
    supabase.from("notes").update({ ...pending, updated_at: new Date().toISOString() }).eq("id", id);
  }

  function flushAllNotes() {
    Object.keys(notePending.current).forEach((id) => flushNote(id));
  }

  useEffect(() => {
    window.addEventListener("beforeunload", flushAllNotes);
    return () => {
      flushAllNotes();
      window.removeEventListener("beforeunload", flushAllNotes);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function deleteNote(id) {
    clearTimeout(noteTimers.current[id]);
    delete notePending.current[id];
    await supabase.from("notes").delete().eq("id", id);
    setProjectData((pd) => ({ ...pd, [activeId]: { ...pd[activeId], notes: pd[activeId].notes.filter((n) => n.id !== id) } }));
  }

  async function addTask(text, dueDate) {
    const { data: task, error } = await supabase
      .from("tasks")
      .insert({ project_id: activeId, user_id: userId, text, due_date: dueDate || null })
      .select()
      .single();
    if (error || !task) return;
    setProjectData((pd) => ({ ...pd, [activeId]: { ...pd[activeId], tasks: [...pd[activeId].tasks, task] } }));
  }

  async function toggleTask(task) {
    const done = !task.done;
    setProjectData((pd) => ({
      ...pd,
      [activeId]: { ...pd[activeId], tasks: pd[activeId].tasks.map((t) => (t.id === task.id ? { ...t, done } : t)) },
    }));
    await supabase.from("tasks").update({ done }).eq("id", task.id);
  }

  async function deleteTask(id) {
    await supabase.from("tasks").delete().eq("id", id);
    setProjectData((pd) => ({ ...pd, [activeId]: { ...pd[activeId], tasks: pd[activeId].tasks.filter((t) => t.id !== id) } }));
  }

  async function addEvent(title, date, time) {
    const { data: ev, error } = await supabase
      .from("events")
      .insert({ project_id: activeId, user_id: userId, title, date, time: time || null })
      .select()
      .single();
    if (error || !ev) return;
    setProjectData((pd) => ({ ...pd, [activeId]: { ...pd[activeId], events: [...pd[activeId].events, ev] } }));

    if (googleConnected) {
      try {
        const { data } = await callEdgeFunction("sync-calendar-event", {
          action: "create",
          event: { title: ev.title, date: ev.date, time: ev.time },
        });
        if (data?.google_event_id) {
          await supabase.from("events").update({ google_event_id: data.google_event_id }).eq("id", ev.id);
          setProjectData((pd) => ({
            ...pd,
            [activeId]: {
              ...pd[activeId],
              events: pd[activeId].events.map((e) => (e.id === ev.id ? { ...e, google_event_id: data.google_event_id } : e)),
            },
          }));
        }
      } catch (e) {
        // si falla la sincronización, el evento se queda igualmente guardado en Legajo
      }
    }
  }

  async function deleteEvent(id) {
    const currentEvents = projectData[activeId]?.events || [];
    const ev = currentEvents.find((e) => e.id === id);

    await supabase.from("events").delete().eq("id", id);
    setProjectData((pd) => ({ ...pd, [activeId]: { ...pd[activeId], events: pd[activeId].events.filter((e) => e.id !== id) } }));

    if (googleConnected && ev?.google_event_id) {
      try {
        await callEdgeFunction("sync-calendar-event", {
          action: "delete",
          event: { google_event_id: ev.google_event_id },
        });
      } catch (e) {
        // si falla, el evento ya se ha borrado en Legajo; quedará huérfano en Google
      }
    }
  }

  return (
    <div className="w-full min-h-screen flex justify-center" style={{ background: INK }}>
      <div className="w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <FolderOpen size={22} style={{ color: TEXT_LIGHT }} />
            <h1 className="text-2xl font-serif tracking-wide" style={{ color: TEXT_LIGHT }}>
              Legajo
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {googleConnected ? (
              <span className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-md" style={{ background: SURFACE2, color: "#8fae7c" }}>
                <CalendarCheck size={14} /> Google Calendar conectado
              </span>
            ) : (
              <button
                onClick={connectGoogleCalendar}
                disabled={connectingGoogle}
                className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-md"
                style={{ background: SURFACE2, color: TEXT_LIGHT, opacity: connectingGoogle ? 0.7 : 1 }}
              >
                {connectingGoogle ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={15} />}
                Conectar Google Calendar
              </button>
            )}
            <button
              onClick={() => setShowNewProject((s) => !s)}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-md"
              style={{ background: SURFACE2, color: TEXT_LIGHT }}
            >
              <Plus size={15} /> Nuevo proyecto
            </button>
            <button onClick={onLogout} title={userEmail} className="p-2 rounded-md" style={{ background: SURFACE2, color: TEXT_MUTED }}>
              <LogOut size={15} />
            </button>
          </div>
        </div>

        {calendarNotice && (
          <div
            className="mb-4 px-3 py-2 rounded-md text-xs flex items-center justify-between"
            style={{
              background: calendarNotice.type === "ok" ? "#2f3d2a" : "#4a2b23",
              color: calendarNotice.type === "ok" ? "#dcead4" : "#f2d9d0",
            }}
          >
            <span>{calendarNotice.text}</span>
            <button onClick={() => setCalendarNotice(null)} style={{ color: "inherit" }}>
              <X size={13} />
            </button>
          </div>
        )}

        {loadError && (
          <div className="mb-4 px-3 py-2 rounded-md text-xs" style={{ background: "#4a2b23", color: "#f2d9d0" }}>
            {loadError}
          </div>
        )}

        {showNewProject && (
          <div className="mb-6 p-4 rounded-lg flex flex-col gap-3" style={{ background: SURFACE2 }}>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addProject();
              }}
              placeholder="Nombre del proyecto"
              className="px-3 py-2 rounded-md text-sm outline-none"
              style={{ background: PAPER, color: INK_ON_PAPER }}
            />
            <div className="flex items-center gap-2 flex-wrap">
              {PALETTE.map((c) => (
                <button
                  key={c.hex}
                  onClick={() => setNewColor(c.hex)}
                  title={c.name}
                  className="w-7 h-7 rounded-full"
                  style={{
                    background: c.hex,
                    outline: newColor === c.hex ? `2px solid ${TEXT_LIGHT}` : "none",
                    outlineOffset: "2px",
                  }}
                />
              ))}
              <div className="flex-1" />
              <button onClick={() => setShowNewProject(false)} className="text-xs px-2 py-1.5" style={{ color: TEXT_MUTED }}>
                Cancelar
              </button>
              <button onClick={addProject} className="text-xs px-3 py-1.5 rounded-md" style={{ background: newColor, color: "#fff" }}>
                Crear
              </button>
            </div>
          </div>
        )}

        {loadingIndex ? (
          <div className="flex items-center gap-2 py-16 justify-center" style={{ color: TEXT_MUTED }}>
            <Loader2 size={18} className="animate-spin" /> Cargando proyectos...
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <FolderOpen size={32} style={{ color: TEXT_MUTED }} />
            <p style={{ color: TEXT_MUTED }} className="text-sm max-w-xs">
              Todavía no tienes proyectos. Crea el primero para empezar a coordinar notas, agenda y tareas.
            </p>
          </div>
        ) : view === "home" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...projects]
              .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
              .map((p) => (
                <ProjectCard key={p.id} project={p} onOpen={openProject} />
              ))}
          </div>
        ) : (
          active && (
            <div>
              <button
                onClick={() => {
                  flushAllNotes();
                  setView("home");
                  loadProjects();
                }}
                className="flex items-center gap-1 text-xs mb-3"
                style={{ color: TEXT_MUTED }}
              >
                <ChevronLeft size={14} /> Todos los proyectos
              </button>

              <div className="rounded-xl p-4 md:p-6" style={{ background: SURFACE }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: active.color }} />
                    <h2 className="text-lg font-serif" style={{ color: TEXT_LIGHT }}>
                      {active.name}
                    </h2>
                  </div>
                  {!confirmDelete ? (
                    <button onClick={() => setConfirmDelete(true)} className="text-xs flex items-center gap-1" style={{ color: TEXT_MUTED }}>
                      <Trash2 size={13} /> Eliminar proyecto
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 text-xs">
                      <span style={{ color: TEXT_MUTED }}>¿Eliminar proyecto y todos sus datos?</span>
                      <button onClick={() => deleteProject(active.id)} className="px-2 py-1 rounded" style={{ background: "#8a3b2a", color: "#fff" }}>
                        Eliminar
                      </button>
                      <button onClick={() => setConfirmDelete(false)} style={{ color: TEXT_MUTED }}>
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>

                {loadingProject ? (
                  <div className="flex items-center gap-2 py-10 justify-center" style={{ color: TEXT_MUTED }}>
                    <Loader2 size={16} className="animate-spin" /> Cargando proyecto...
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                    <div className="flex flex-col" style={{ minHeight: 320 }}>
                      <div className="flex items-center gap-1.5 mb-2 text-xs uppercase tracking-wide" style={{ color: TEXT_MUTED }}>
                        <CheckSquare size={13} /> Tareas
                      </div>
                      <TasksPanel tasks={data.tasks} onAdd={addTask} onToggle={toggleTask} onDelete={deleteTask} color={active.color} />
                    </div>
                    <div className="flex flex-col" style={{ minHeight: 320 }}>
                      <div className="flex items-center gap-1.5 mb-2 text-xs uppercase tracking-wide" style={{ color: TEXT_MUTED }}>
                        <CalendarDays size={13} /> Agenda
                      </div>
                      <AgendaPanel events={data.events} onAdd={addEvent} onDelete={deleteEvent} color={active.color} />
                    </div>
                    <div className="flex flex-col" style={{ minHeight: 320 }}>
                      <div className="flex items-center gap-1.5 mb-2 text-xs uppercase tracking-wide" style={{ color: TEXT_MUTED }}>
                        <FileText size={13} /> Notas
                      </div>
                      <NotesPanel notes={data.notes} onAdd={addNote} onUpdate={updateNote} onDelete={deleteNote} onFlush={flushNote} color={active.color} />
                    </div>
                    <div className="flex flex-col" style={{ minHeight: 320 }}>
                      <div className="flex items-center gap-1.5 mb-2 text-xs uppercase tracking-wide" style={{ color: TEXT_MUTED }}>
                        <Sparkles size={13} /> Preguntar a Claude
                      </div>
                      <AskClaudePanel projectId={active.id} color={active.color} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = comprobando, null = sin sesión

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center" style={{ background: INK }}>
        <Loader2 size={20} className="animate-spin" style={{ color: TEXT_MUTED }} />
      </div>
    );
  }

  if (!session) return <Login />;

  return (
    <LegajoApp
      userId={session.user.id}
      userEmail={session.user.email}
      onLogout={() => supabase.auth.signOut()}
    />
  );
}
