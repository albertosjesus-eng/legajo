# Legajo — guía de despliegue

Proyectos, notas, agenda y tareas coordinados, con base de datos real (Supabase)
y login por email y contraseña.

## 1. Crear el proyecto en Supabase

1. Ve a https://supabase.com y crea una cuenta gratuita (o entra si ya tienes una).
2. "New project" → ponle un nombre (p. ej. "legajo") y una contraseña de base de
   datos (guárdala, no la necesitarás para la app, pero sí para el panel).
3. Espera a que el proyecto termine de aprovisionarse (1-2 minutos).

## 2. Crear las tablas

1. En el menú lateral, ve a **SQL Editor** → **New query**.
2. Abre el archivo `supabase/schema.sql` de este proyecto, copia todo su
   contenido, pégalo en el editor y pulsa **Run**.
3. Deberías ver "Success. No rows returned". Esto crea las 4 tablas
   (proyectos, notas, tareas, eventos) y las reglas de seguridad que aseguran
   que cada usuario solo vea sus propios datos.

## 3. Obtener las claves de conexión

1. En el menú lateral: **Settings** → **API**.
2. Copia el **Project URL** y la clave **anon public**.

## 4. Configurar el proyecto localmente

1. Instala las dependencias:
   ```
   npm install
   ```
2. Copia `.env.example` a `.env.local`:
   ```
   cp .env.example .env.local
   ```
3. Abre `.env.local` y pega tus valores reales:
   ```
   VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGc...
   ```
4. Pruébalo en local:
   ```
   npm run dev
   ```
   Abre la URL que te indique (normalmente http://localhost:5173). Crea una
   cuenta con tu email y una contraseña, y prueba a crear un proyecto.

## 5. Desplegar en Vercel (gratis)

1. Sube este proyecto a un repositorio de GitHub (puedes arrastrar la carpeta
   en github.com/new o usar `git init` / `git add .` / `git commit` / `git push`).
2. Ve a https://vercel.com, entra con tu cuenta de GitHub, y pulsa
   **Add New → Project**, seleccionando el repositorio.
3. Vercel detectará que es un proyecto Vite automáticamente. Antes de darle a
   "Deploy", abre **Environment Variables** y añade las mismas dos variables
   que en tu `.env.local`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Pulsa **Deploy**. En un par de minutos tendrás una URL pública
   (algo como `legajo.vercel.app`).

## 6. Instalarla en el iPad

1. Abre la URL de Vercel en **Safari** en tu iPad (no en Chrome).
2. Pulsa el icono de compartir → **Añadir a pantalla de inicio**.
3. Se instalará como un icono independiente, a pantalla completa, sin la
   barra de Safari — se comporta como una app nativa.

## 7. Conectar Google Calendar

Esto añade una tabla nueva, tres funciones de servidor (Edge Functions) y un
botón en la app para sincronizar tu agenda con un calendario "Legajo" que se
crea en tu cuenta de Google.

### 7.1 Base de datos

En el **SQL Editor** de Supabase, ejecuta también `supabase/calendar_sync.sql`
(además del `schema.sql` del paso 2).

### 7.2 Credenciales de Google

Sigue los pasos de Google Cloud Console (proyecto, OAuth consent screen,
credenciales) y anota tu **Client ID** y **Client Secret**. El Redirect URI
que debes registrar en Google es:
```
https://TU-PROYECTO.supabase.co/functions/v1/google-oauth-callback
```

### 7.3 Instalar la CLI de Supabase y vincular el proyecto

```
npm install -g supabase
supabase login
supabase link --project-ref TU-PROYECTO
```

(`TU-PROYECTO` es el identificador que aparece en tu Project URL, la parte
antes de `.supabase.co`)

### 7.4 Configurar los secretos de las funciones

Estos valores nunca llegan al navegador; solo las funciones los usan:

```
supabase secrets set GOOGLE_CLIENT_ID=tu_client_id
supabase secrets set GOOGLE_CLIENT_SECRET=tu_client_secret
supabase secrets set APP_URL=https://tu-app.vercel.app
```

(`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` ya los proporciona Supabase
automáticamente a las funciones, no hace falta configurarlos)

### 7.5 Desplegar las funciones

```
supabase functions deploy google-oauth-callback --no-verify-jwt
supabase functions deploy sync-calendar-event
supabase functions deploy calendar-status
```

(las dos últimas sí verifican el JWT automáticamente porque las llama la app
ya con la sesión iniciada; la primera la llama Google directamente, sin
cabecera de autorización, por eso lleva `--no-verify-jwt`)

### 7.6 Variable de entorno en Vercel

Añade en **Settings → Environment Variables**:
```
VITE_GOOGLE_CLIENT_ID=tu_client_id
```
(el Client ID no es secreto, puede ir en el frontend; el Client Secret nunca
debe estar aquí)

Guarda y haz **Redeploy**.

### 7.7 Probarlo

En la app, pulsa **Conectar Google Calendar**. Verás el aviso de "app no
verificada" de Google (normal, ver nota más abajo) — acéptalo, concede
permiso, y volverás a Legajo con el aviso de conexión correcta. A partir de
ahí, cada cita que crees o borres en la Agenda se reflejará en el calendario
"Legajo" de tu cuenta de Google.

## 8. Pantalla de inicio y "Preguntar a Claude"

Con muchos proyectos, las pestañas dejan de ser prácticas. Ahora la app abre
en una pantalla de inicio con todos los proyectos como tarjetas (ordenadas
por última modificación); al pulsar una entras a su vista con cuatro
columnas: Tareas, Agenda, Notas y **Preguntar a Claude** — un espacio donde
puedes preguntar cosas como "¿qué me estoy dejando?" y Claude responde
mirando las tres dimensiones del proyecto a la vez. Por ahora es solo
consultivo: no crea ni modifica nada por su cuenta.

### 8.1 Base de datos

Ejecuta también `supabase/home_and_assistant.sql` en el SQL Editor (además
de `schema.sql` y `calendar_sync.sql`). Añade la fecha de última modificación
a cada proyecto y la mantiene al día automáticamente.

### 8.2 Clave de la API de Anthropic

Necesitas tu propia clave de API en **console.anthropic.com** (con algo de
saldo — el coste de esto es de céntimos para un uso personal). Guárdala como
secreto de las funciones, igual que hiciste con las de Google:

```
supabase secrets set ANTHROPIC_API_KEY=tu_clave
```

O, si vas por el panel (Edge Functions → Secrets), añade `ANTHROPIC_API_KEY`
igual que los demás.

### 8.3 Desplegar la función

Crea una función nueva llamada exactamente `ask-claude` (Edge Functions →
Deploy a new function → Via Editor), pega el contenido de
`supabase/functions/ask-claude/index.ts`, y déjala con la verificación JWT
**activada** (la llama la app ya con tu sesión iniciada).

No hace falta ninguna variable nueva en Vercel para este apartado.

## Notas

- **Sesión recordada**: al entrar una vez, Safari recuerda tu sesión
  automáticamente; no tendrás que volver a escribir tu contraseña salvo que
  cierres sesión o borres los datos del sitio.
- **Tus datos**: viven en tu propio proyecto de Supabase (plan gratuito hasta
  500MB de base de datos, más que suficiente para este uso). Solo tú puedes
  verlos gracias a las reglas de seguridad del paso 2.
- **Google "app no verificada"**: si dejaste el proyecto de Google Cloud en
  modo "Testing", verás este aviso y la conexión caduca cada 7 días. Publícalo
  ("Publish app" en la pestaña Audience) para evitarlo — no hace falta pasar
  la revisión completa de Google para tu propio uso personal.
- **Pendiente**: conexión con Outlook (agenda/tareas/notas vía Microsoft
  Graph, bloqueada por ahora en espera de tu departamento de IT) y
  Recordatorios de Apple.
