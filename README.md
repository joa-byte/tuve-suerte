# Tuve suerte

Diario gastronómico privado y colaborativo para registrar cenas. El frontend
continúa siendo HTML, CSS y JavaScript vanilla; Cloudflare Pages sirve los
archivos estáticos, Pages Functions atiende `/api/*` y Cloudflare D1 conserva
los datos.

## Arquitectura

```text
public/                 frontend estático y PWA
functions/api/          rutas de Cloudflare Pages Functions
lib/dinners-api.mjs     contrato HTTP y acceso SQL compartido
migrations/             esquema D1 y carga de los datos existentes
data/dinners.json       fixture original; no se usa en producción
```

La base está disponible para las Functions como `context.env.DB`. No hay
servidor Node ni escrituras al filesystem durante una request.

## Desarrollo local

Requiere Node.js 20 o superior.

```bash
npm install
npm run dev
```

`npm run dev` aplica las migraciones sobre la D1 local persistida en
`.wrangler/state/` y levanta Pages con sus Functions. La primera migración crea
las tablas y `migrations/0002_seed_existing_data.sql` importa las cenas que estaban en
`data/dinners.json`.

Comandos útiles:

```bash
npm run db:migrate:local
npm run db:seed:local
npm test
npm run lint
npm run build
```

El seed usa `INSERT OR IGNORE`, por lo que puede ejecutarse otra vez sin
duplicar los datos. Para regenerarlo después de modificar el fixture:

```bash
npm run db:seed:generate
```

Ese comando imprime el SQL por stdout para poder revisarlo antes de reemplazar
`migrations/0002_seed_existing_data.sql`.

## Deploy en Cloudflare

### 1. Crear D1

Autenticarse y crear la base:

```bash
npx wrangler login
npx wrangler d1 create tuve-suerte
```

Wrangler devuelve un UUID. Copiar solamente ese valor y reemplazar en
`wrangler.toml`:

```toml
database_id = "REPLACE_WITH_D1_DATABASE_ID"
```

No cambiar estos dos valores:

```toml
binding = "DB"
database_name = "tuve-suerte"
```

El único valor que hay que obtener de Cloudflare es el `database_id` real de
esa D1. No se necesita guardar un token ni otra credencial en el repositorio.

### 2. Crear las tablas e importar los datos existentes

Con el UUID ya configurado:

```bash
npx wrangler d1 migrations apply tuve-suerte --remote
```

Esto aplica `0001_initial.sql` y luego `0002_seed_existing_data.sql`. Para inspeccionar el estado:

```bash
npx wrangler d1 migrations list tuve-suerte --remote
```

### 3. Conectar Cloudflare Pages a GitHub

En el dashboard:

1. Ir a **Workers & Pages → Create application → Pages → Import an existing Git repository**.
2. Elegir `joa-byte/tuve-suerte`.
3. Configurar:
   - rama de producción: `main`;
   - framework preset: `None`;
   - build command: `npm run build`;
   - build output directory: `public`;
   - root directory: dejar vacío (raíz del repositorio).
4. Crear el proyecto.
5. En **Settings → Bindings**, verificar que exista una vinculación D1 llamada
   exactamente `DB` y que apunte a `tuve-suerte`. `wrangler.toml` ya la declara;
   si el dashboard no la refleja, agregarla con **Add → D1 database**.
6. Si se agregó o corrigió el binding desde el dashboard, volver a desplegar
   para que la Function reciba `context.env.DB`.

La carpeta `functions/` debe permanecer en la raíz del repositorio; no se debe
configurar como directorio público.

### 4. Comprobación posterior

Abrir la URL `*.pages.dev` asignada por Cloudflare y verificar:

- `/` carga la aplicación;
- `/api/dinners` devuelve JSON;
- crear una cena y recargar conserva los datos;
- no aparecen errores de binding `DB` en los logs de Functions.

## Instalar en iPhone

Con el sitio abierto mediante HTTPS:

**Safari → Compartir → Agregar a Inicio → Abrir como app web → Agregar**.

El manifest, los iconos PNG y los metadatos de iOS ya están incluidos. El
service worker guarda solamente el shell estático; las rutas `/api/*` siempre
van a la red y no se guardan en caché.

## Pantallas y estética

- `#/` — inicio y registro de una cena.
- `#/cena/:id` — detalle, platos, vinos y opiniones.
- `#/calendario` — recuerdo cronológico de cenas pasadas.
- `#/vinos` — catálogo textual por categoría, varietal y etiqueta.
- `#/vino/:id` — opiniones y apariciones de una etiqueta.

Las fuentes, la textura de papel, la navegación y la gramática manuscrita se
mantienen sin cambios. Las fuentes se sirven localmente desde
`public/assets/fonts/` con sus licencias.
