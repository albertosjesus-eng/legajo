import { useState, useEffect, useRef } from "react";
import {
  Plus, X, Trash2, ChevronLeft, FileText, CalendarDays,
  CheckSquare, Square, Loader2, FolderOpen, LogOut
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

function TabShape({ project, isActive, onSelect }) {
  return (
    <div className="relative shrink-0" style={{ marginRight: -10 }}>
      <button
        onClick={() => onSelect(project.id)}
        className="relative px-5 pt-2.5 pb-3 text-sm font-serif whitespace-nowrap transition-all"
        style={{
          background: project.color,
          color: "#fff",
          clipPath: "polygon(3% 100%, 0% 0%, 100% 0%, 97% 100%)",
          opacity: isActive ? 1 : 0.6,
          transform: isActive ? "translateY(0)" : "translateY(3px)",
          zIndex: isActive ? 10 : 1,
        }}
      >
        {project.name || "Sin nombre"}
      </button>
    </div>
  );
}

function NotesPanel({ notes, onAdd, onUpdate, onDelete, color }) {
  const [openId, setOpenId] = useState(null);
  const openNote = notes.find((n) => n.id === openId);

  if (openId && openNote) {
    return (
      <div className="flex flex-col h-full">
        <button
          onClick={() => setOpenId(null)}
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
  const submit = () => {
    if (!text.trim()) return;
    onAdd(text.trim());
    setText("");
  };
  const pending = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-2 mb-3">
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
        <button onClick={submit} className="px-3 rounded-md" style={{ background: color, color: "#fff" }}>
          <Plus size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 pr-1">
        {tasks.length === 0 && (
          <p className="text-sm" style={{ color: TEXT_MUTED }}>
            Sin tareas todavía.
          </p>
        )}
        {pending.map((t) => (
          <div key={t.id} className="flex items-start gap-2 p-2 rounded-md group" style={{ background: SURFACE2 }}>
            <button onClick={() => onToggle(t)} className="mt-0.5 shrink-0" style={{ color }}>
              <Square size={16} />
            </button>
            <span className="text-sm flex-1" style={{ color: TEXT_LIGHT }}>
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

function LegajoApp({ userId, userEmail, onLogout }) {
  const [projects, setProjects] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [projectData, setProjectData] = useState({});
  const [loadingIndex, setLoadingIndex] = useState(true);
  const [loadingProject, setLoadingProject] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PALETTE[0].hex);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loadError, setLoadError] = useState("");

  const noteTimers = useRef({});

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    setLoadingIndex(true);
    setLoadError("");
    const { data, error } = await supabase.from("projects").select("*").order("created_at");
    if (error) {
      setLoadError("No se pudieron cargar los proyectos: " + error.message);
    } else {
      setProjects(data || []);
      if (data && data.length) setActiveId(data[0].id);
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
    setActiveId((prev) => (prev === id ? remaining[0]?.id || null : prev));
    setConfirmDelete(false);
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
    clearTimeout(noteTimers.current[id]);
    noteTimers.current[id] = setTimeout(() => {
      supabase.from("notes").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
    }, 500);
  }

  async function deleteNote(id) {
    await supabase.from("notes").delete().eq("id", id);
    setProjectData((pd) => ({ ...pd, [activeId]: { ...pd[activeId], notes: pd[activeId].notes.filter((n) => n.id !== id) } }));
  }

  async function addTask(text) {
    const { data: task, error } = await supabase
      .from("tasks")
      .insert({ project_id: activeId, user_id: userId, text })
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
  }

  async function deleteEvent(id) {
    await supabase.from("events").delete().eq("id", id);
    setProjectData((pd) => ({ ...pd, [activeId]: { ...pd[activeId], events: pd[activeId].events.filter((e) => e.id !== id) } }));
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
        ) : (
          <>
            <div className="flex overflow-x-auto pb-0" style={{ paddingLeft: 4 }}>
              {projects.map((p) => (
                <TabShape key={p.id} project={p} isActive={p.id === activeId} onSelect={setActiveId} />
              ))}
            </div>

            {active && (
              <div className="rounded-b-xl rounded-tr-xl p-4 md:p-6" style={{ background: SURFACE, position: "relative", zIndex: 5 }}>
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
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
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
                      <NotesPanel notes={data.notes} onAdd={addNote} onUpdate={updateNote} onDelete={deleteNote} color={active.color} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
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
