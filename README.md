# Tuve suerte

Diario gastronómico privado y colaborativo para registrar las cenas cocinadas por Juan.

## Ejecutar

En Windows (CMD o PowerShell):

```bash
copy .env.example .env
npm start
```

La aplicación queda disponible en `http://localhost:3000`.

No requiere instalar dependencias: usa Node.js y persiste los datos en `data/dinners.json`.

## Pantallas

- `#/` — inicio y registro de una cena.
- `#/cena/:id` — detalle, platos, vinos y opiniones.
- `#/calendario` — recuerdo cronológico de cenas pasadas; no agenda fechas.
- `#/vinos` — catálogo textual por categoría, varietal y etiqueta.
- `#/vino/:id` — opiniones y apariciones de una etiqueta.

## Interfaz

Las fuentes se sirven localmente y conservan sus licencias en
`public/assets/fonts/`. La textura de papel y los trazos auxiliares son SVG
originales del proyecto, con semillas estables. Las decisiones visuales están
separadas en `public/styles/` por tokens, base, componentes, pantallas y
formularios.

Las comparaciones de las tres pasadas visuales quedan en
`docs/visual-iterations/`.

## Verificación

```bash
npm run build
npm run lint
npm test
```
