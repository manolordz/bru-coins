# ☕ BRÜ Coins

Sistema gamificado de recompensas para el equipo BRÜ. Los baristas ganan ₿ BRÜ Coins por su desempeño y las canjean por premios reales desde su teléfono.

**Stack:** Next.js 14 (App Router) · Tailwind CSS · Supabase (PostgreSQL + Auth + Storage + Realtime) · Vercel · Resend

---

## Setup completo

### 1. Crear proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) → **New project**
2. Guarda las credenciales que te muestra (las necesitarás en el paso 3)
3. En el dashboard de tu proyecto ve a **Settings → API** y copia:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` *(nunca expongas esta al cliente)*

### 2. Ejecutar migraciones y seed

En Supabase Dashboard → **SQL Editor**:

1. Copia y ejecuta el contenido de `supabase/migrations/001_schema.sql`
2. Copia y ejecuta el contenido de `supabase/seed.sql`

### 3. Crear el bucket de Storage

En Supabase Dashboard → **Storage** → **New bucket**:

- **Name:** `bru-assets`
- **Public bucket:** ✅ activado
- **Allowed MIME types:** `image/*`
- **Max file size:** `5242880` (5 MB)

Luego en **Storage → Policies**, crea estas políticas para el bucket `bru-assets`:

```sql
-- Lectura pública
create policy "Public read bru-assets"
  on storage.objects for select
  using (bucket_id = 'bru-assets');

-- Escritura para todos (el service role lo controla en las Server Actions)
create policy "Upload bru-assets"
  on storage.objects for insert
  with check (bucket_id = 'bru-assets');

create policy "Update bru-assets"
  on storage.objects for update
  using (bucket_id = 'bru-assets');
```

### 4. Variables de entorno

```bash
cp .env.example .env.local
```

Edita `.env.local` con tus valores:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
RESEND_API_KEY=re_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 5. Instalar dependencias y correr localmente

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

---

## Crear el primer admin

Los administradores se autentican con Supabase Auth (email + contraseña). Para crear el primer admin:

1. En Supabase Dashboard → **Authentication → Users** → **Add user**
   - Email: `admin@bru.com` (o el que prefieras)
   - Password: (una contraseña segura)
   - Copia el **User ID** (UUID) que se genera

2. En **SQL Editor**, ejecuta:
   ```sql
   insert into admins (id, email)
   values ('<el-uuid-del-usuario>', 'admin@bru.com');
   ```

3. Ve a `/admin/login` en la app e inicia sesión con esas credenciales.

---

## Configurar notificaciones por email (Resend)

1. Crea una cuenta en [resend.com](https://resend.com)
2. Verifica tu dominio (o usa `onboarding@resend.dev` para pruebas)
3. Obtén tu API key desde **API Keys → Create API Key**
4. En la app, ve a **Admin → Configuración** y guarda tu API key y los correos de notificación

**Configurar el webhook en Supabase:**

1. Supabase Dashboard → **Database → Webhooks → Create a new hook**
2. Nombre: `notify-redemption`
3. Table: `redemptions` | Events: `INSERT`
4. Type: **Supabase Edge Functions**
5. Edge function: `notify`

**Deploy de la Edge Function:**

```bash
# Instala Supabase CLI si no lo tienes
npm install -g supabase

# Login
supabase login

# Link a tu proyecto
supabase link --project-ref <tu-project-ref>

# Deploy
supabase functions deploy notify
```

Agrega los secrets a la Edge Function:
```bash
supabase secrets set RESEND_API_KEY=re_...
supabase secrets set ADMIN_NOTIFICATION_EMAILS=admin@bru.com
```

---

## Deploy en Vercel

1. Sube el código a GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial BRÜ Coins setup"
   git remote add origin https://github.com/tu-usuario/bru-coins.git
   git push -u origin main
   ```

2. Ve a [vercel.com](https://vercel.com) → **New Project** → importa tu repo

3. En **Environment Variables** agrega todas las variables de `.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `RESEND_API_KEY`
   - `NEXT_PUBLIC_APP_URL` (tu URL de Vercel, ej: `https://bru-coins.vercel.app`)

4. Deploy → ¡listo!

---

## Cómo usar la app

### Para baristas (app pública — `/`)
- Ven el leaderboard con los saldos de todo el equipo en tiempo real
- Exploran el marketplace de rewards
- Tocan **"Canjear Reward"** → seleccionan su foto → ingresan su PIN → eligen reward → confirman

### Para admins (`/admin`)
- **Baristas:** gestión completa, agregar/quitar ₿ con motivos predefinidos, cambiar avatares y PINs
- **Transacciones:** historial completo con filtros
- **Rewards:** agregar, editar, activar/desactivar rewards con imágenes
- **Configuración:** emails de notificación y API key de Resend

---

## Notas de seguridad

- Los PINs se almacenan con **bcrypt** (nunca en texto plano)
- Las operaciones de coins se hacen en **funciones de PostgreSQL atómicas** (sin race conditions)
- El `SUPABASE_SERVICE_ROLE_KEY` solo se usa en **Server Actions** (nunca se expone al cliente)
- **RLS** activo en todas las tablas — baristas no pueden acceder a datos de admin
- 3 intentos fallidos de PIN → bloqueo de 5 minutos (cliente)

---

## Estructura del proyecto

```
app/
  page.tsx                  → Leaderboard + Marketplace (público)
  admin/
    login/page.tsx          → Login de admin
    baristas/page.tsx       → Gestión de baristas + monedas
    transacciones/page.tsx  → Historial de transacciones
    rewards/page.tsx        → Catálogo de rewards
    configuracion/page.tsx  → Notificaciones y settings
components/
  leaderboard/              → Leaderboard con realtime
  marketplace/              → Grid de rewards + CTA
  redemption/               → Modal de canje multi-paso + PIN pad
  admin/                    → Sidebar, modal de monedas
  ui/                       → Avatar y componentes base
lib/
  supabase/                 → Clientes browser/server/service
  actions/                  → Server Actions (admin, barista)
supabase/
  migrations/001_schema.sql → Schema completo + RLS + funciones
  seed.sql                  → 5 baristas + 9 rewards
  functions/notify/         → Edge Function para emails
```
