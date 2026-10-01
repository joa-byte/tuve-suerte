# Fotos de cenas y platos en Cloudflare R2

Cada cena y cada plato admiten una foto opcional. La foto propia de la cena
se usa arriba del detalle y en la miniatura del inicio. Si no tiene, se toma la
foto del primer plato que tenga imagen, en orden de creación ascendente
(`rowid ASC`, igual al listado de platos); no por nombre ni fecha de subida.
Si no hay ninguna imagen, se mantiene el dibujo de la app.

Usar **+ agregar foto de la cena** o **cambiar foto de la cena** arriba del detalle.
La foto propia tiene prioridad sin modificar las imágenes de los platos.

Cada plato admite una foto opcional. En el detalle, usar **+ agregar foto**;
**cambiar foto** reemplaza la anterior. Admite JPG, PNG y WebP hasta 5 MiB
(5.242.880 bytes). Exportar HEIC/HEIF como JPG antes de subir.

## Activar cuando crees el bucket

1. Crear un bucket en **Cloudflare → R2 Object Storage → Create bucket**.
   Elegir su nombre y ubicación al crearlo. No se crea ningún recurso remoto
   al compilar o probar este PR.
2. Mantener el bucket privado: no habilitar `r2.dev` ni un dominio público.
3. En `wrangler.toml`, descomentar el bloque preparado y poner el nombre real:

   ```toml
   [[r2_buckets]]
   binding = "DISH_IMAGES"
   bucket_name = "tu-nombre-real-de-bucket"
   ```

   Conservar exactamente `DISH_IMAGES`: es el nombre usado por el backend.
   Este repo ya usa Wrangler como fuente de configuración; guardar este cambio
   en Git. No dejar el placeholder activo antes de crear el bucket.
4. **Antes de desplegar el código de este PR**, aplicar la migración D1:

   ```bash
   npx wrangler d1 migrations apply tuve-suerte --remote
   ```

   `0003` agrega `dishes.image_key` y `0004` agrega `dinners.image_key`,
   ambas nullable y sin borrar registros. Son necesarias
   incluso si aún no habilitaste R2. La app anterior tolera estas columnas extra.
5. Desplegar Pages. En **Workers & Pages → proyecto → Settings → Bindings**,
   verificar `DISH_IMAGES` apuntando al bucket elegido. Si el proyecto se
   administra desde el dashboard en vez de Wrangler, agregar allí el binding
   **R2 bucket** con ese nombre y redesplegar; no mezclar configuraciones que
   se contradigan. No hace falta API token, access key ni secret S3.
6. Abrir una cena, agregar una foto a un plato, recargar y reemplazarla. Debe
   seguir mostrándose una sola foto. Las fotos de otros platos no cambian.

Para previews, usar otro bucket **y otra D1**. Si se habilitan entornos en el
Wrangler del proyecto, declarar sus bindings explícitos en `env.preview`;
no probar escrituras contra la base o el bucket de producción.

## Desarrollo local, sin cuenta ni bucket

```bash
npm install
npm run dev:images
```

Wrangler emula D1 y el binding R2 `DISH_IMAGES` localmente, con persistencia en
`.wrangler/state/`. No usa R2 remoto. `npm run dev` conserva el flujo habitual;
si todavía no hay binding configurado, subir una foto devuelve 503 y las demás
funciones siguen disponibles.

## Contrato y comportamiento

- `PUT /api/dinners/:id/dishes/:dishId/image`: body binario y `Content-Type`
  `image/jpeg`, `image/png` o `image/webp`. Limita los bytes durante la lectura y
  verifica la cabecera binaria. No decodifica ni convierte las imágenes.
- `GET` en esa ruta devuelve la foto desde R2; 404 si no existe. No se guarda
  en caché, para que los reemplazos aparezcan al recargar.
- `PUT /api/dinners/:id/image` y `GET` en esa ruta: foto propia de la cena,
  con el mismo formato, validaciones y reemplazo que las fotos de platos.
- Las respuestas incluyen `imageUrl` en cada cena/plato que tenga foto propia.
  `coverImageUrl` en la cena resuelve la prioridad cena → primer plato con foto;
  se omite si no hay imágenes. Inicio y detalle usan el mismo campo.
  No hay fotos para vinos. D1 guarda una única referencia por cena/plato.
- Cada intento usa una clave aleatoria bajo `dishes/` o `dinners/`, según corresponda. Se guarda en R2 antes de
  modificar D1: una subida fallida no pisa la foto anterior. La actualización
  compara la clave previa; si hay dos cargas simultáneas, una recibe 409 y debe
  reintentarse. Tras confirmar D1, se elimina el objeto anterior.
- Si falla D1 o hay conflicto, se intenta borrar el objeto recién subido.
  R2 y D1 no tienen una transacción compartida: una caída o fallo de limpieza
  puede dejar objetos sin referencia. Los logs indican fallos de limpieza;
  para reconciliar, comparar el prefijo con
  `SELECT image_key FROM dishes WHERE image_key IS NOT NULL UNION ALL SELECT
  image_key FROM dinners WHERE image_key IS NOT NULL` antes de borrar.
  No usar expiración general sobre `dishes/` o `dinners/`: borraría fotos vigentes.
- Estados: 400 vacío, 403 origen cruzado, 404 plato/foto ausente, 413 tamaño,
  415 formato, 409 concurrencia, 503 falta binding, 502 almacenamiento.

La app sirve las fotos a través de Pages Functions; no necesita CORS de R2 ni
acceso público al bucket. Esto no agrega autenticación a la app: las rutas
siguen el mismo acceso que las APIs existentes de cenas. Si protegés el sitio
con Cloudflare Access, incluir también `/api/*`.

Referencias: [bindings R2 en Pages](https://developers.cloudflare.com/pages/functions/bindings/#r2-buckets),
[API nativa de R2](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/).
