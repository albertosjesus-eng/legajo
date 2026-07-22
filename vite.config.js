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

## Notas

- **Sesión recordada**: al entrar una vez, Safari recuerda tu sesión
  automáticamente; no tendrás que volver a escribir tu contraseña salvo que
  cierres sesión o borres los datos del sitio.
- **Tus datos**: viven en tu propio proyecto de Supabase (plan gratuito hasta
  500MB de base de datos, más que suficiente para este uso). Solo tú puedes
  verlos gracias a las reglas de seguridad del paso 2.
- **Pendiente**: conexión con Google Calendar / Outlook y Recordatorios de
  Apple — se añadirá en una siguiente fase.
