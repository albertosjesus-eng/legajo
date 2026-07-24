import { useState, useEffect, useRef } from "react";
import {
  Plus, X, Trash2, ChevronLeft, FileText, CalendarDays,
  CheckSquare, Square, Loader2, FolderOpen, LogOut, Link2, CalendarCheck,
  Sparkles, Send, Pencil, History, Archive, ArchiveRestore, Search, Download, PenTool, Clock
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

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function slugify(name) {
  return (
    (name || "proyecto")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "proyecto"
  );
}

function projectToMarkdown(project, data) {
  const d = data || emptyData();
  let md = `# ${project.name}\n\n`;

  md += `## Tareas\n\n`;
  if (d.tasks.length === 0) md += "_Sin tareas._\n\n";
  d.tasks.forEach((t) => {
    md += `- [${t.done ? "x" : " "}] ${t.text}${t.due_date ? ` (vence ${t.due_date})` : ""}\n`;
  });

  md += `\n## Agenda\n\n`;
  if (d.events.length === 0) md += "_Sin citas._\n\n";
  d.events
    .slice()
    .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")))
    .forEach((e) => {
      md += `- ${e.date}${e.time ? " " + e.time : ""}: ${e.title}\n`;
    });

  md += `\n## Notas\n\n`;
  if (d.notes.length === 0) md += "_Sin notas._\n\n";
  d.notes.forEach((n) => {
    md += `### ${n.title || "(sin título)"}\n\n${n.body || ""}\n\n`;
  });

  return md;
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

function ProjectHeader({ project, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);
  const [color, setColor] = useState(project.color);

  const save = async () => {
    if (!name.trim()) return;
    const ok = await onUpdate(project.id, { name: name.trim(), color });
    if (ok) setEditing(false);
  };

  if (editing) {
    return (
      <div className="mb-4 p-3 rounded-lg flex flex-col gap-3" style={{ background: SURFACE2 }}>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          className="px-3 py-2 rounded-md text-sm outline-none"
          style={{ background: PAPER, color: INK_ON_PAPER }}
        />
        <div className="flex items-center gap-2 flex-wrap">
          {PALETTE.map((c) => (
            <button
              key={c.hex}
              onClick={() => setColor(c.hex)}
              title={c.name}
              className="w-7 h-7 rounded-full"
              style={{ background: c.hex, outline: color === c.hex ? `2px solid ${TEXT_LIGHT}` : "none", outlineOffset: "2px" }}
            />
          ))}
          <div className="flex-1" />
          <button onClick={() => setEditing(false)} className="text-xs px-2 py-1.5" style={{ color: TEXT_MUTED }}>
            Cancelar
          </button>
          <button onClick={save} className="text-xs px-3 py-1.5 rounded-md" style={{ background: color, color: "#fff" }}>
            Guardar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 mb-4 group">
      <span className="w-2.5 h-2.5 rounded-full" style={{ background: project.color }} />
      <h2 className="text-lg font-serif" style={{ color: TEXT_LIGHT }}>
        {project.name}
      </h2>
      <button onClick={() => setEditing(true)} className="opacity-70 hover:opacity-100" style={{ color: TEXT_MUTED }}>
        <Pencil size={13} />
      </button>
    </div>
  );
}


function NotesPanel({ notes, onAdd, onUpdate, onDelete, onFlush, onSaveDrawing, onLoadDrawing, color }) {
  const [openId, setOpenId] = useState(null);
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error
  const [saveMsg, setSaveMsg] = useState("");
  const [drawMode, setDrawMode] = useState(false);
  const openNote = notes.find((n) => n.id === openId);

  const canvasRef = useRef(null);
  const bodyRef = useRef(null);
  const containerRef = useRef(null);
  const ctxRef = useRef(null);
  const hasStrokesRef = useRef(false);
  const drawingRef = useRef(false);
  const lastPointRef = useRef(null);

  useEffect(() => {
    if (!openId) return;
    setDrawMode(false);
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + "px";
    canvas.style.height = rect.height + "px";
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#ffffff";
    ctxRef.current = ctx;
    hasStrokesRef.current = false;

    if (openNote?.has_drawing && onLoadDrawing) {
      onLoadDrawing(openId).then((url) => {
        if (!url || !ctxRef.current) return;
        const img = new Image();
        img.onload = () => {
          ctxRef.current.drawImage(img, 0, 0, rect.width, rect.height);
          hasStrokesRef.current = true;
          URL.revokeObjectURL(url);
        };
        img.src = url;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  const getPoint = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, pressure: e.pressure || 0.5 };
  };

  const handlePointerDown = (e) => {
    if (!drawMode) return;
    e.preventDefault();
    drawingRef.current = true;
    lastPointRef.current = getPoint(e);
    canvasRef.current.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!drawMode || !drawingRef.current) return;
    e.preventDefault();
    const ctx = ctxRef.current;
    const point = getPoint(e);
    const last = lastPointRef.current;
    ctx.lineWidth = e.pointerType === "pen" ? Math.max(1, point.pressure * 5) : 2.5;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPointRef.current = point;
    hasStrokesRef.current = true;
  };

  const handlePointerUp = () => {
    drawingRef.current = false;
  };

  const clearDrawing = () => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    hasStrokesRef.current = false;
  };

  const insertTimestamp = () => {
    const el = bodyRef.current;
    const now = new Date();
    const stamp =
      String(now.getDate()).padStart(2, "0") +
      "/" +
      String(now.getMonth() + 1).padStart(2, "0") +
      "/" +
      now.getFullYear() +
      " " +
      String(now.getHours()).padStart(2, "0") +
      ":" +
      String(now.getMinutes()).padStart(2, "0");
    const text = `[${stamp}] `;
    const current = openNote.body || "";
    const start = el ? el.selectionStart : current.length;
    const end = el ? el.selectionEnd : current.length;
    const newBody = current.slice(0, start) + text + current.slice(end);
    onUpdate(openId, { body: newBody });
    const newPos = start + text.length;
    setTimeout(() => {
      if (el) {
        el.focus();
        el.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  const handleSave = async () => {
    setSaveState("saving");
    const textResult = await onFlush(openId);
    let drawingResult = { ok: true };
    if (onSaveDrawing && canvasRef.current) {
      drawingResult = await onSaveDrawing(openId, canvasRef.current, hasStrokesRef.current);
    }
    if (textResult?.ok !== false && drawingResult?.ok) {
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1500);
    } else {
      setSaveState("error");
      setSaveMsg(drawingResult?.error || textResult?.error || "error desconocido");
    }
  };

  if (openId && openNote) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-10" style={{ background: "rgba(0,0,0,0.6)" }}>
        <div
          className="w-full max-w-3xl rounded-xl p-4 md:p-6 flex flex-col"
          style={{ background: "#000000", maxHeight: "92vh", height: "92vh" }}
        >
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={async () => {
                await onFlush(openId);
                setOpenId(null);
                setSaveState("idle");
              }}
              className="flex items-center gap-1 text-xs self-start"
              style={{ color: TEXT_MUTED }}
            >
              <ChevronLeft size={14} /> Volver a notas
            </button>
            <div className="flex items-center gap-2">
              {drawMode && (
                <button onClick={clearDrawing} className="text-xs px-2.5 py-1.5 rounded-md" style={{ color: "#e0836f" }}>
                  Borrar dibujo
                </button>
              )}
              <button
                onClick={() => setDrawMode((d) => !d)}
                className="text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-md"
                style={{ background: drawMode ? color : "rgba(255,255,255,0.1)", color: drawMode ? "#fff" : TEXT_MUTED }}
              >
                <PenTool size={13} /> {drawMode ? "Dibujando" : "Dibujar"}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <input
              value={openNote.title}
              onChange={(e) => onUpdate(openId, { title: e.target.value })}
              placeholder="Título de la nota"
              className="flex-1 bg-transparent border-none outline-none text-xl font-serif"
              style={{ color: "#ffffff" }}
            />
            <button
              onClick={insertTimestamp}
              title="Insertar fecha y hora en el texto"
              className="p-1.5 rounded-md shrink-0"
              style={{ color: TEXT_MUTED }}
            >
              <Clock size={16} />
            </button>
          </div>
          <div ref={containerRef} className="relative flex-1 min-h-0">
            <textarea
              ref={bodyRef}
              autoFocus={!drawMode}
              readOnly={drawMode}
              value={openNote.body}
              onChange={(e) => onUpdate(openId, { body: e.target.value })}
              placeholder="Escribe aquí..."
              className="absolute inset-0 bg-transparent border-none outline-none resize-none text-base leading-relaxed"
              style={{ color: "#ffffff" }}
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0"
              style={{ touchAction: "none", pointerEvents: drawMode ? "auto" : "none" }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            />
          </div>
          {saveState === "error" && (
            <div className="text-xs mb-2 px-2 py-1.5 rounded" style={{ background: "#4a2b23", color: "#f2d9d0" }}>
              No se pudo guardar: {saveMsg}
            </div>
          )}
          <div className="flex justify-between items-center mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}>
            <button
              onClick={() => {
                onDelete(openId);
                setOpenId(null);
              }}
              className="text-xs flex items-center gap-1"
              style={{ color: "#e0836f" }}
            >
              <Trash2 size={12} /> Eliminar nota
            </button>
            <button
              onClick={handleSave}
              disabled={saveState === "saving"}
              className="text-xs flex items-center gap-1.5 px-4 py-2 rounded-md"
              style={{ background: color, color: "#fff", opacity: saveState === "saving" ? 0.7 : 1 }}
            >
              {saveState === "saving" && <Loader2 size={12} className="animate-spin" />}
              {saveState === "saved" ? "Guardado ✓" : saveState === "saving" ? "Guardando..." : "Guardar"}
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
        title="Nueva nota"
        className="flex items-center justify-center w-8 h-8 rounded-md mb-3 self-start"
        style={{ background: color, color: "#fff" }}
      >
        <Plus size={16} />
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
              <div className="font-serif text-sm truncate flex items-center gap-1.5" style={{ color: INK_ON_PAPER }}>
                {n.has_drawing && <PenTool size={11} style={{ color: "#6b6252", flexShrink: 0 }} />}
                <span className="truncate">{n.title || "Sin título"}</span>
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

function TaskRow({ t, onToggle, onDelete, onUpdate, color, today, done }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(t.text);
  const [dueDate, setDueDate] = useState(t.due_date || "");

  const save = async () => {
    if (!text.trim()) return;
    const ok = await onUpdate(t.id, { text: text.trim(), due_date: dueDate || null });
    if (ok) setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-1.5 p-2 rounded-md" style={{ background: SURFACE2 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          className="px-2 py-1.5 rounded text-sm outline-none"
          style={{ background: PAPER, color: INK_ON_PAPER }}
        />
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="px-2 py-1.5 rounded text-sm outline-none self-start"
          style={{ background: PAPER, color: INK_ON_PAPER }}
        />
        <div className="flex gap-2 justify-end">
          <button onClick={() => setEditing(false)} className="text-xs px-2 py-1" style={{ color: TEXT_MUTED }}>
            Cancelar
          </button>
          <button onClick={save} className="text-xs px-3 py-1 rounded" style={{ background: color, color: "#fff" }}>
            Guardar
          </button>
        </div>
      </div>
    );
  }

  const isOverdue = !done && t.due_date && t.due_date < today;
  const isToday = !done && t.due_date && t.due_date === today;

  return (
    <div className="flex items-start gap-2 p-2 rounded-md group" style={{ background: done ? "transparent" : SURFACE2 }}>
      <button onClick={() => onToggle(t)} className="mt-0.5 shrink-0" style={{ color }}>
        {done ? <CheckSquare size={16} /> : <Square size={16} />}
      </button>
      <div className="flex-1 min-w-0">
        <span className="text-sm" style={{ color: done ? TEXT_MUTED : TEXT_LIGHT, textDecoration: done ? "line-through" : "none" }}>
          {t.text}
        </span>
        {t.due_date && !done && (
          <div className="text-[11px] font-mono mt-0.5" style={{ color: isOverdue ? "#e0836f" : isToday ? color : TEXT_MUTED }}>
            {isOverdue ? "vencida · " : ""}
            {t.due_date.slice(5).replace("-", "/")}
          </div>
        )}
      </div>
      <button
        onClick={() => setEditing(true)}
        className="opacity-70 hover:opacity-100 shrink-0"
        style={{ color: TEXT_MUTED }}
      >
        <Pencil size={13} />
      </button>
      <button onClick={() => onDelete(t.id)} className="opacity-70 hover:opacity-100 shrink-0" style={{ color: TEXT_MUTED }}>
        <X size={14} />
      </button>
    </div>
  );
}

function TasksPanel({ tasks, onAdd, onToggle, onDelete, onUpdate, color }) {
  const [text, setText] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [showDate, setShowDate] = useState(false);
  const submit = async () => {
    if (!text.trim()) return;
    const ok = await onAdd(text.trim(), dueDate || null);
    if (ok) {
      setText("");
      setDueDate("");
      setShowDate(false);
    }
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
        {pending.map((t) => (
          <TaskRow key={t.id} t={t} onToggle={onToggle} onDelete={onDelete} onUpdate={onUpdate} color={color} today={today} done={false} />
        ))}
        {done.length > 0 && (
          <div className="text-xs mt-2 mb-1" style={{ color: TEXT_MUTED }}>
            Hechas
          </div>
        )}
        {done.map((t) => (
          <TaskRow key={t.id} t={t} onToggle={onToggle} onDelete={onDelete} onUpdate={onUpdate} color={color} today={today} done={true} />
        ))}
      </div>
    </div>
  );
}

function EventRow({ ev, onDelete, onUpdate, color, today }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(ev.title);
  const [date, setDate] = useState(ev.date);
  const [time, setTime] = useState(ev.time || "");

  const save = async () => {
    if (!title.trim() || !date) return;
    const ok = await onUpdate(ev.id, { title: title.trim(), date, time: time || null });
    if (ok) setEditing(false);
  };

  if (editing) {
    return (
      <div className="p-3 rounded-md flex flex-col gap-2" style={{ background: PAPER }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
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
          <button onClick={() => setEditing(false)} className="text-xs px-2 py-1" style={{ color: "#6b6252" }}>
            Cancelar
          </button>
          <button onClick={save} className="text-xs px-3 py-1.5 rounded" style={{ background: color, color: "#fff" }}>
            Guardar
          </button>
        </div>
      </div>
    );
  }

  const isPast = ev.date < today;
  const isToday = ev.date === today;

  return (
    <div className="flex items-center gap-3 p-2.5 rounded-md group" style={{ background: SURFACE2 }}>
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
      <button onClick={() => setEditing(true)} className="opacity-70 hover:opacity-100 shrink-0" style={{ color: TEXT_MUTED }}>
        <Pencil size={13} />
      </button>
      <button onClick={() => onDelete(ev.id)} className="opacity-70 hover:opacity-100 shrink-0" style={{ color: TEXT_MUTED }}>
        <X size={14} />
      </button>
    </div>
  );
}

function AgendaPanel({ events, onAdd, onDelete, onUpdate, color }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState("");
  const [showForm, setShowForm] = useState(false);

  const submit = async () => {
    if (!title.trim() || !date) return;
    const ok = await onAdd(title.trim(), date, time);
    if (ok) {
      setTitle("");
      setTime("");
      setShowForm(false);
    }
  };

  const sorted = events.slice().sort((a, b) => (a.date + (a.time || "00:00")).localeCompare(b.date + (b.time || "00:00")));
  const today = todayISO();

  return (
    <div className="flex flex-col h-full">
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          title="Nueva cita"
          className="flex items-center justify-center w-8 h-8 rounded-md mb-3 self-start"
          style={{ background: color, color: "#fff" }}
        >
          <Plus size={16} />
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
        {sorted.map((ev) => (
          <EventRow key={ev.id} ev={ev} onDelete={onDelete} onUpdate={onUpdate} color={color} today={today} />
        ))}
      </div>
    </div>
  );
}


function AskClaudePanel({ projectId, color, onCreated }) {
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
        setLastQA({ question: q, answer: data.answer, created: data.created || [] });
        if (data.created && data.created.length > 0) onCreated();
      }
    } catch (e) {
      setError("No se pudo obtener respuesta. Inténtalo de nuevo.");
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-2 mb-3">
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
      {error && (
        <div className="text-xs mb-2 px-3 py-2 rounded-md" style={{ background: "#4a2b23", color: "#f2d9d0" }}>
          {error}
        </div>
      )}
      <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
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
            {lastQA.created && lastQA.created.length > 0 && (
              <div className="text-xs self-start px-2 py-1 rounded" style={{ background: SURFACE2, color: "#8fae7c" }}>
                ✓ {lastQA.created.length} elemento{lastQA.created.length > 1 ? "s" : ""} creado{lastQA.created.length > 1 ? "s" : ""} en el proyecto
              </div>
            )}
          </div>
        )}
        {loading && (
          <div className="flex items-center gap-2 text-xs" style={{ color: TEXT_MUTED }}>
            <Loader2 size={13} className="animate-spin" /> Pensando...
          </div>
        )}
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

function TimelineEntry({ entry, onOpen }) {
  const Icon = entry.type === "task" ? CheckSquare : entry.type === "event" ? CalendarDays : FileText;
  return (
    <button
      onClick={() => onOpen(entry.projectId)}
      className="w-full text-left flex items-center gap-3 p-2.5 rounded-md"
      style={{ background: SURFACE2 }}
    >
      <Icon size={15} style={{ color: entry.overdue ? "#e0836f" : entry.projectColor }} className="shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate" style={{ color: TEXT_LIGHT }}>
          {entry.label}
        </div>
        <div className="text-xs flex items-center gap-1.5 mt-0.5" style={{ color: entry.overdue ? "#e0836f" : TEXT_MUTED }}>
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: entry.projectColor }} />
          <span className="truncate">{entry.projectName}</span>
          {entry.sublabel && <span className="shrink-0">· {entry.sublabel}</span>}
        </div>
      </div>
    </button>
  );
}

function TimelineView({ projects, timelineData, loading, onOpen }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-16 justify-center" style={{ color: TEXT_MUTED }}>
        <Loader2 size={18} className="animate-spin" /> Cargando cronología...
      </div>
    );
  }
  if (!timelineData) return null;

  const projectById = Object.fromEntries(projects.map((p) => [p.id, p]));
  const today = todayISO();

  const noDate = [];
  const upcoming = [];
  const recent = [];

  timelineData.tasks.forEach((t) => {
    if (t.done) return;
    const p = projectById[t.project_id];
    if (!p || p.archived) return;
    const base = {
      type: "task",
      id: "task-" + t.id,
      projectId: t.project_id,
      projectName: p.name,
      projectColor: p.color,
      label: t.text,
    };
    if (!t.due_date) {
      noDate.push(base);
    } else if (t.due_date < today) {
      upcoming.push({ ...base, dateKey: t.due_date, sublabel: "vencida · " + t.due_date, overdue: true });
    } else {
      upcoming.push({ ...base, dateKey: t.due_date, sublabel: "vence " + t.due_date });
    }
  });

  timelineData.events.forEach((e) => {
    const p = projectById[e.project_id];
    if (!p || p.archived) return;
    const entry = {
      type: "event",
      id: "event-" + e.id,
      projectId: e.project_id,
      projectName: p.name,
      projectColor: p.color,
      label: e.title,
      dateKey: e.date + (e.time || "00:00"),
      sublabel: e.date.slice(5).replace("-", "/") + (e.time ? " " + e.time : ""),
    };
    if (e.date >= today) upcoming.push(entry);
    else recent.push(entry);
  });

  timelineData.notes.forEach((n) => {
    const p = projectById[n.project_id];
    if (!p || p.archived) return;
    recent.push({
      type: "note",
      id: "note-" + n.id,
      projectId: n.project_id,
      projectName: p.name,
      projectColor: p.color,
      label: n.title || "(sin título)",
      dateKey: n.updated_at,
      sublabel: "editada " + timeAgo(n.updated_at),
    });
  });

  upcoming.sort((a, b) => (a.dateKey || "").localeCompare(b.dateKey || ""));
  recent.sort((a, b) => new Date(b.dateKey) - new Date(a.dateKey));

  const isEmpty = noDate.length === 0 && upcoming.length === 0 && recent.length === 0;

  return (
    <div className="flex flex-col gap-6">
      {isEmpty && (
        <p className="text-sm text-center py-10" style={{ color: TEXT_MUTED }}>
          Todavía no hay tareas, citas o notas en ningún proyecto.
        </p>
      )}
      {upcoming.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wide mb-2" style={{ color: TEXT_MUTED }}>
            Próximamente
          </div>
          <div className="flex flex-col gap-1.5">
            {upcoming.map((e) => (
              <TimelineEntry key={e.id} entry={e} onOpen={onOpen} />
            ))}
          </div>
        </div>
      )}
      {noDate.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wide mb-2" style={{ color: TEXT_MUTED }}>
            Sin fecha
          </div>
          <div className="flex flex-col gap-1.5">
            {noDate.map((e) => (
              <TimelineEntry key={e.id} entry={e} onOpen={onOpen} />
            ))}
          </div>
        </div>
      )}
      {recent.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wide mb-2" style={{ color: TEXT_MUTED }}>
            Reciente
          </div>
          <div className="flex flex-col gap-1.5">
            {recent.map((e) => (
              <TimelineEntry key={e.id} entry={e} onOpen={onOpen} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HomeSummary({ projects, timelineData, onOpenTimeline }) {
  if (!timelineData) return null;
  const projectById = Object.fromEntries(projects.filter((p) => !p.archived).map((p) => [p.id, p]));
  const today = todayISO();
  const in7days = new Date();
  in7days.setDate(in7days.getDate() + 7);
  const in7daysStr = in7days.toISOString().slice(0, 10);

  let overdue = 0;
  let dueSoon = 0;
  timelineData.tasks.forEach((t) => {
    if (t.done || !t.due_date || !projectById[t.project_id]) return;
    if (t.due_date < today) overdue++;
    else if (t.due_date <= in7daysStr) dueSoon++;
  });

  let eventsSoon = 0;
  timelineData.events.forEach((e) => {
    if (!projectById[e.project_id]) return;
    if (e.date >= today && e.date <= in7daysStr) eventsSoon++;
  });

  if (overdue === 0 && dueSoon === 0 && eventsSoon === 0) {
    return (
      <div className="mb-4 px-4 py-3 rounded-lg text-sm" style={{ background: SURFACE2, color: TEXT_MUTED }}>
        Todo al día — sin tareas ni citas en los próximos 7 días.
      </div>
    );
  }

  const parts = [];
  if (overdue > 0) parts.push(`${overdue} tarea${overdue > 1 ? "s" : ""} vencida${overdue > 1 ? "s" : ""}`);
  if (dueSoon > 0) parts.push(`${dueSoon} tarea${dueSoon > 1 ? "s" : ""} para esta semana`);
  if (eventsSoon > 0) parts.push(`${eventsSoon} cita${eventsSoon > 1 ? "s" : ""} próxima${eventsSoon > 1 ? "s" : ""}`);

  return (
    <button
      onClick={onOpenTimeline}
      className="mb-4 px-4 py-3 rounded-lg text-sm text-left w-full"
      style={{ background: overdue > 0 ? "#4a2b23" : SURFACE2, color: overdue > 0 ? "#f2d9d0" : TEXT_LIGHT }}
    >
      {parts.join(" · ")}
    </button>
  );
}

function SearchView({ projects, timelineData, loading, onOpen }) {
  const [query, setQuery] = useState("");

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-16 justify-center" style={{ color: TEXT_MUTED }}>
        <Loader2 size={18} className="animate-spin" /> Cargando...
      </div>
    );
  }

  const projectById = Object.fromEntries(projects.map((p) => [p.id, p]));
  const q = query.trim().toLowerCase();

  let taskMatches = [];
  let eventMatches = [];
  let noteMatches = [];

  if (q && timelineData) {
    taskMatches = timelineData.tasks
      .filter((t) => !t.done && t.text.toLowerCase().includes(q))
      .map((t) => {
        const p = projectById[t.project_id];
        return p && !p.archived
          ? { id: "task-" + t.id, projectId: t.project_id, projectName: p.name, projectColor: p.color, label: t.text, sublabel: t.due_date ? "vence " + t.due_date : null }
          : null;
      })
      .filter(Boolean);

    eventMatches = timelineData.events
      .filter((e) => e.title.toLowerCase().includes(q))
      .map((e) => {
        const p = projectById[e.project_id];
        return p && !p.archived
          ? { id: "event-" + e.id, projectId: e.project_id, projectName: p.name, projectColor: p.color, label: e.title, sublabel: e.date }
          : null;
      })
      .filter(Boolean);

    noteMatches = timelineData.notes
      .filter((n) => (n.title || "").toLowerCase().includes(q) || (n.body || "").toLowerCase().includes(q))
      .map((n) => {
        const p = projectById[n.project_id];
        return p && !p.archived
          ? { id: "note-" + n.id, projectId: n.project_id, projectName: p.name, projectColor: p.color, label: n.title || "(sin título)", sublabel: "editada " + timeAgo(n.updated_at) }
          : null;
      })
      .filter(Boolean);
  }

  const totalMatches = taskMatches.length + eventMatches.length + noteMatches.length;

  return (
    <div>
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar en notas, tareas y citas de todos los proyectos..."
        className="w-full px-4 py-3 rounded-lg text-sm outline-none mb-6"
        style={{ background: SURFACE2, color: TEXT_LIGHT }}
      />
      {!q && (
        <p className="text-sm text-center py-10" style={{ color: TEXT_MUTED }}>
          Escribe algo para buscar en todos tus proyectos a la vez.
        </p>
      )}
      {q && totalMatches === 0 && (
        <p className="text-sm text-center py-10" style={{ color: TEXT_MUTED }}>
          Sin resultados para "{query}".
        </p>
      )}
      {q && noteMatches.length > 0 && (
        <div className="mb-5">
          <div className="text-xs uppercase tracking-wide mb-2" style={{ color: TEXT_MUTED }}>
            Notas
          </div>
          <div className="flex flex-col gap-1.5">
            {noteMatches.map((e) => (
              <TimelineEntry key={e.id} entry={{ ...e, type: "note" }} onOpen={onOpen} />
            ))}
          </div>
        </div>
      )}
      {q && taskMatches.length > 0 && (
        <div className="mb-5">
          <div className="text-xs uppercase tracking-wide mb-2" style={{ color: TEXT_MUTED }}>
            Tareas
          </div>
          <div className="flex flex-col gap-1.5">
            {taskMatches.map((e) => (
              <TimelineEntry key={e.id} entry={{ ...e, type: "task" }} onOpen={onOpen} />
            ))}
          </div>
        </div>
      )}
      {q && eventMatches.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wide mb-2" style={{ color: TEXT_MUTED }}>
            Agenda
          </div>
          <div className="flex flex-col gap-1.5">
            {eventMatches.map((e) => (
              <TimelineEntry key={e.id} entry={{ ...e, type: "event" }} onOpen={onOpen} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LegajoApp({ userId, userEmail, onLogout }) {
  const [projects, setProjects] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [view, setView] = useState("home"); // "home" | "project" | "timeline"
  const [timelineData, setTimelineData] = useState(null);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [projectData, setProjectData] = useState({});
  const [loadingIndex, setLoadingIndex] = useState(true);
  const [loadingProject, setLoadingProject] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PALETTE[0].hex);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [googleConnected, setGoogleConnected] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [calendarNotice, setCalendarNotice] = useState(null);

  const noteTimers = useRef({});
  const notePending = useRef({});

  useEffect(() => {
    loadProjects();
    checkCalendarStatus();
    loadTimeline();

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
    } else {
      setSaveError("No se pudo crear el proyecto: " + (error?.message || "error desconocido"));
    }
    setNewName("");
    setShowNewProject(false);
  }

  async function deleteProject(id) {
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) {
      setSaveError("No se pudo eliminar el proyecto: " + (error.message || "error desconocido"));
      setConfirmDelete(false);
      return;
    }
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

  async function updateProject(id, patch) {
    setProjects((p) => p.map((proj) => (proj.id === id ? { ...proj, ...patch } : proj)));
    const { error } = await supabase.from("projects").update(patch).eq("id", id);
    if (error) {
      setSaveError("No se pudo actualizar el proyecto: " + (error.message || "error desconocido"));
      return false;
    }
    return true;
  }

  function openProject(id) {
    setActiveId(id);
    setView("project");
  }

  async function loadTimeline() {
    setLoadingTimeline(true);
    const [tasksRes, eventsRes, notesRes] = await Promise.all([
      supabase.from("tasks").select("id,project_id,text,done,due_date"),
      supabase.from("events").select("id,project_id,title,date,time"),
      supabase.from("notes").select("id,project_id,title,body,updated_at"),
    ]);
    setTimelineData({
      tasks: tasksRes.data || [],
      events: eventsRes.data || [],
      notes: notesRes.data || [],
    });
    setLoadingTimeline(false);
  }

  function openFromTimeline(id) {
    setActiveId(id);
    setView("project");
  }

  async function exportAll() {
    setExporting(true);
    try {
      const [notesRes, tasksRes, eventsRes] = await Promise.all([
        supabase.from("notes").select("project_id,title,body,updated_at"),
        supabase.from("tasks").select("project_id,text,done,due_date"),
        supabase.from("events").select("project_id,title,date,time"),
      ]);
      const notesAll = notesRes.data || [];
      const tasksAll = tasksRes.data || [];
      const eventsAll = eventsRes.data || [];

      const exportObj = {
        exported_at: new Date().toISOString(),
        projects: projects.map((p) => ({
          name: p.name,
          color: p.color,
          archived: !!p.archived,
          created_at: p.created_at,
          notes: notesAll.filter((n) => n.project_id === p.id),
          tasks: tasksAll.filter((t) => t.project_id === p.id),
          events: eventsAll.filter((e) => e.project_id === p.id),
        })),
      };

      downloadFile(JSON.stringify(exportObj, null, 2), `legajo-export-${todayISO()}.json`, "application/json");
    } catch (e) {
      setSaveError("No se pudo exportar: " + String(e));
    }
    setExporting(false);
  }

  function exportActiveProject() {
    if (!active) return;
    const md = projectToMarkdown(active, data);
    downloadFile(md, `${slugify(active.name)}.md`, "text/markdown");
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

  async function flushNote(id) {
    clearTimeout(noteTimers.current[id]);
    const pending = notePending.current[id];
    if (!pending) return { ok: true, noChanges: true };
    delete notePending.current[id];
    const { error } = await supabase.from("notes").update({ ...pending, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) {
      setSaveError("No se pudo guardar la nota: " + (error.message || "error desconocido"));
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }

  function flushAllNotes() {
    Object.keys(notePending.current).forEach((id) => flushNote(id));
  }

  async function saveDrawing(noteId, canvas, hasStrokes) {
    const path = `${userId}/${noteId}.png`;
    if (!hasStrokes) {
      await supabase.storage.from("note-drawings").remove([path]);
      const { error } = await supabase.from("notes").update({ has_drawing: false }).eq("id", noteId);
      if (error) return { ok: false, error: error.message };
      setProjectData((pd) => ({
        ...pd,
        [activeId]: { ...pd[activeId], notes: pd[activeId].notes.map((n) => (n.id === noteId ? { ...n, has_drawing: false } : n)) },
      }));
      return { ok: true };
    }
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return { ok: false, error: "no se pudo generar la imagen" };
    const { error: upErr } = await supabase.storage.from("note-drawings").upload(path, blob, { upsert: true, contentType: "image/png" });
    if (upErr) return { ok: false, error: upErr.message };
    const { error } = await supabase.from("notes").update({ has_drawing: true }).eq("id", noteId);
    if (error) return { ok: false, error: error.message };
    setProjectData((pd) => ({
      ...pd,
      [activeId]: { ...pd[activeId], notes: pd[activeId].notes.map((n) => (n.id === noteId ? { ...n, has_drawing: true } : n)) },
    }));
    return { ok: true };
  }

  async function loadDrawing(noteId) {
    const path = `${userId}/${noteId}.png`;
    const { data, error } = await supabase.storage.from("note-drawings").download(path);
    if (error || !data) return null;
    return URL.createObjectURL(data);
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
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (error) {
      setSaveError("No se pudo eliminar la nota: " + (error.message || "error desconocido"));
      return;
    }
    setProjectData((pd) => ({ ...pd, [activeId]: { ...pd[activeId], notes: pd[activeId].notes.filter((n) => n.id !== id) } }));
  }

  async function addTask(text, dueDate) {
    const { data: task, error } = await supabase
      .from("tasks")
      .insert({ project_id: activeId, user_id: userId, text, due_date: dueDate || null })
      .select()
      .single();
    if (error || !task) {
      setSaveError("No se pudo crear la tarea: " + (error?.message || "error desconocido"));
      return false;
    }
    setProjectData((pd) => ({ ...pd, [activeId]: { ...pd[activeId], tasks: [...pd[activeId].tasks, task] } }));
    return true;
  }

  async function toggleTask(task) {
    const done = !task.done;
    setProjectData((pd) => ({
      ...pd,
      [activeId]: { ...pd[activeId], tasks: pd[activeId].tasks.map((t) => (t.id === task.id ? { ...t, done } : t)) },
    }));
    const { error } = await supabase.from("tasks").update({ done }).eq("id", task.id);
    if (error) {
      setSaveError("No se pudo actualizar la tarea: " + (error.message || "error desconocido"));
      // revertimos el cambio optimista si de verdad no se ha guardado
      setProjectData((pd) => ({
        ...pd,
        [activeId]: { ...pd[activeId], tasks: pd[activeId].tasks.map((t) => (t.id === task.id ? { ...t, done: !done } : t)) },
      }));
    }
  }

  async function deleteTask(id) {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) {
      setSaveError("No se pudo eliminar la tarea: " + (error.message || "error desconocido"));
      return;
    }
    setProjectData((pd) => ({ ...pd, [activeId]: { ...pd[activeId], tasks: pd[activeId].tasks.filter((t) => t.id !== id) } }));
  }

  async function updateTask(id, patch) {
    setProjectData((pd) => ({
      ...pd,
      [activeId]: { ...pd[activeId], tasks: pd[activeId].tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) },
    }));
    const { error } = await supabase.from("tasks").update(patch).eq("id", id);
    if (error) {
      setSaveError("No se pudo actualizar la tarea: " + (error.message || "error desconocido"));
      return false;
    }
    return true;
  }

  async function addEvent(title, date, time) {
    const { data: ev, error } = await supabase
      .from("events")
      .insert({ project_id: activeId, user_id: userId, title, date, time: time || null })
      .select()
      .single();
    if (error || !ev) {
      setSaveError("No se pudo crear la cita: " + (error?.message || "error desconocido"));
      return false;
    }
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
    return true;
  }

  async function deleteEvent(id) {
    const currentEvents = projectData[activeId]?.events || [];
    const ev = currentEvents.find((e) => e.id === id);

    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) {
      setSaveError("No se pudo eliminar la cita: " + (error.message || "error desconocido"));
      return;
    }
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

  async function updateEvent(id, patch) {
    const before = (projectData[activeId]?.events || []).find((e) => e.id === id);
    setProjectData((pd) => ({
      ...pd,
      [activeId]: { ...pd[activeId], events: pd[activeId].events.map((e) => (e.id === id ? { ...e, ...patch } : e)) },
    }));
    const { error } = await supabase.from("events").update(patch).eq("id", id);
    if (error) {
      setSaveError("No se pudo actualizar la cita: " + (error.message || "error desconocido"));
      return false;
    }
    if (googleConnected && before?.google_event_id) {
      try {
        await callEdgeFunction("sync-calendar-event", {
          action: "update",
          event: {
            google_event_id: before.google_event_id,
            title: patch.title ?? before.title,
            date: patch.date ?? before.date,
            time: patch.time ?? before.time,
          },
        });
      } catch (e) {
        // si falla la sincronización, el cambio se queda igualmente guardado en Legajo
      }
    }
    return true;
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
              onClick={exportAll}
              disabled={exporting}
              title="Descargar todos tus proyectos en un archivo"
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-md"
              style={{ background: SURFACE2, color: TEXT_LIGHT, opacity: exporting ? 0.7 : 1 }}
            >
              {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              Exportar
            </button>
            <button
              onClick={() => {
                setView("search");
                if (!timelineData) loadTimeline();
              }}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-md"
              style={{ background: SURFACE2, color: TEXT_LIGHT }}
            >
              <Search size={15} /> Buscar
            </button>
            <button
              onClick={() => {
                setView("timeline");
                loadTimeline();
              }}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-md"
              style={{ background: SURFACE2, color: TEXT_LIGHT }}
            >
              <History size={15} /> Ver cronología
            </button>
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

        {saveError && (
          <div
            className="mb-4 px-3 py-2 rounded-md text-xs flex items-center justify-between"
            style={{ background: "#4a2b23", color: "#f2d9d0" }}
          >
            <span>{saveError}</span>
            <button onClick={() => setSaveError("")} style={{ color: "inherit" }}>
              <X size={13} />
            </button>
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
          <div>
            <HomeSummary
              projects={projects}
              timelineData={timelineData}
              onOpenTimeline={() => {
                setView("timeline");
                loadTimeline();
              }}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[...projects]
                .filter((p) => !p.archived)
                .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
                .map((p) => (
                  <ProjectCard key={p.id} project={p} onOpen={openProject} />
                ))}
            </div>
            {projects.some((p) => p.archived) && (
              <div className="mt-6">
                {!showArchived ? (
                  <button
                    onClick={() => setShowArchived(true)}
                    className="text-xs flex items-center gap-1.5"
                    style={{ color: TEXT_MUTED }}
                  >
                    <Archive size={13} /> Ver proyectos archivados ({projects.filter((p) => p.archived).length})
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setShowArchived(false)}
                      className="text-xs flex items-center gap-1.5 mb-3"
                      style={{ color: TEXT_MUTED }}
                    >
                      <Archive size={13} /> Ocultar archivados
                    </button>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 opacity-70">
                      {[...projects]
                        .filter((p) => p.archived)
                        .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
                        .map((p) => (
                          <ProjectCard key={p.id} project={p} onOpen={openProject} />
                        ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ) : view === "timeline" ? (
          <div>
            <button
              onClick={() => setView("home")}
              className="flex items-center gap-1 text-xs mb-4"
              style={{ color: TEXT_MUTED }}
            >
              <ChevronLeft size={14} /> Inicio
            </button>
            <TimelineView projects={projects} timelineData={timelineData} loading={loadingTimeline} onOpen={openFromTimeline} />
          </div>
        ) : view === "search" ? (
          <div>
            <button
              onClick={() => setView("home")}
              className="flex items-center gap-1 text-xs mb-4"
              style={{ color: TEXT_MUTED }}
            >
              <ChevronLeft size={14} /> Inicio
            </button>
            <SearchView projects={projects} timelineData={timelineData} loading={loadingTimeline} onOpen={openFromTimeline} />
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
                <div className="flex items-start justify-between">
                  <ProjectHeader project={active} onUpdate={updateProject} />
                  <div className="flex items-center gap-3">
                    <button
                      onClick={exportActiveProject}
                      title="Descargar este proyecto en Markdown"
                      className="text-xs flex items-center gap-1"
                      style={{ color: TEXT_MUTED }}
                    >
                      <Download size={13} /> Exportar
                    </button>
                    <button
                      onClick={() => updateProject(active.id, { archived: !active.archived })}
                      className="text-xs flex items-center gap-1"
                      style={{ color: TEXT_MUTED }}
                    >
                      {active.archived ? (
                        <>
                          <ArchiveRestore size={13} /> Desarchivar
                        </>
                      ) : (
                        <>
                          <Archive size={13} /> Archivar
                        </>
                      )}
                    </button>
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
                      <TasksPanel tasks={data.tasks} onAdd={addTask} onToggle={toggleTask} onDelete={deleteTask} onUpdate={updateTask} color={active.color} />
                    </div>
                    <div className="flex flex-col" style={{ minHeight: 320 }}>
                      <div className="flex items-center gap-1.5 mb-2 text-xs uppercase tracking-wide" style={{ color: TEXT_MUTED }}>
                        <CalendarDays size={13} /> Agenda
                      </div>
                      <AgendaPanel events={data.events} onAdd={addEvent} onDelete={deleteEvent} onUpdate={updateEvent} color={active.color} />
                    </div>
                    <div className="flex flex-col" style={{ minHeight: 320 }}>
                      <div className="flex items-center gap-1.5 mb-2 text-xs uppercase tracking-wide" style={{ color: TEXT_MUTED }}>
                        <FileText size={13} /> Notas
                      </div>
                      <NotesPanel
                        notes={data.notes}
                        onAdd={addNote}
                        onUpdate={updateNote}
                        onDelete={deleteNote}
                        onFlush={flushNote}
                        onSaveDrawing={saveDrawing}
                        onLoadDrawing={loadDrawing}
                        color={active.color}
                      />
                    </div>
                    <div className="flex flex-col" style={{ minHeight: 320 }}>
                      <div className="flex items-center gap-1.5 mb-2 text-xs uppercase tracking-wide" style={{ color: TEXT_MUTED }}>
                        <Sparkles size={13} /> Preguntar a Claude
                      </div>
                      <AskClaudePanel projectId={active.id} color={active.color} onCreated={() => loadProjectData(active.id)} />
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
