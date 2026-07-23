import { useState } from "react";
import { Loader2, FolderOpen } from "lucide-react";
import { supabase } from "./supabaseClient";

const INK = "#1E1C1A";
const SURFACE2 = "#332D26";
const PAPER = "#F3EEE1";
const TEXT_LIGHT = "#EDE7D9";
const TEXT_MUTED = "#B7AE9C";
const INK_ON_PAPER = "#2A2520";
const ACCENT = "#C9992F";

export default function Login() {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const submit = async () => {
    if (!email.trim() || !password) return;
    setLoading(true);
    setError("");
    setNotice("");
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) setError(error.message);
    } else {
      const { error } = await supabase.auth.signUp({ email: email.trim(), password });
      if (error) setError(error.message);
      else setNotice("Cuenta creada. Si tu proyecto de Supabase pide confirmación por email, revisa tu correo antes de entrar.");
    }
    setLoading(false);
  };

  return (
    <div className="w-full min-h-screen flex items-center justify-center px-4" style={{ background: INK }}>
      <div className="w-full max-w-sm p-6 rounded-lg" style={{ background: SURFACE2 }}>
        <div className="flex items-center gap-2 mb-6 justify-center">
          <FolderOpen size={22} style={{ color: TEXT_LIGHT }} />
          <h1 className="text-2xl font-serif tracking-wide" style={{ color: TEXT_LIGHT }}>
            Legajo
          </h1>
        </div>

        <div className="flex flex-col gap-3">
          <input
            type="email"
            autoCapitalize="none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Correo electrónico"
            className="px-3 py-2 rounded-md text-sm outline-none"
            style={{ background: PAPER, color: INK_ON_PAPER }}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="Contraseña"
            className="px-3 py-2 rounded-md text-sm outline-none"
            style={{ background: PAPER, color: INK_ON_PAPER }}
          />

          {error && (
            <div className="text-xs px-3 py-2 rounded-md" style={{ background: "#4a2b23", color: "#f2d9d0" }}>
              {error}
            </div>
          )}
          {notice && (
            <div className="text-xs px-3 py-2 rounded-md" style={{ background: "#2f3d2a", color: "#dcead4" }}>
              {notice}
            </div>
          )}

          <button
            onClick={submit}
            disabled={loading}
            className="mt-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium"
            style={{ background: ACCENT, color: "#fff", opacity: loading ? 0.7 : 1 }}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {mode === "signin" ? "Entrar" : "Crear cuenta"}
          </button>

          <button
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError("");
              setNotice("");
            }}
            className="text-xs mt-1"
            style={{ color: TEXT_MUTED }}
          >
            {mode === "signin" ? "¿Primera vez? Crea una cuenta" : "¿Ya tienes cuenta? Entra"}
          </button>
        </div>
      </div>
    </div>
  );
}
