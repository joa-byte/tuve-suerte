import { createD1Repository, json } from './dinners-api.mjs';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function imageUrl(dinnerId, dishId) {
  return `/api/dinners/${encodeURIComponent(dinnerId)}/dishes/${encodeURIComponent(dishId)}/image`;
}

export function createR2Storage(bucket) {
  if (!bucket) return null;
  return {
    put: (key, bytes, type) => bucket.put(key, bytes, { httpMetadata: { contentType: type } }),
    get: key => bucket.get(key),
    delete: key => bucket.delete(key)
  };
}

async function readImage(request) {
  const type = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (!TYPES.includes(type)) return { error: 'Elegí una imagen JPG, PNG o WebP.', status: 415 };
  if (Number(request.headers.get('content-length')) > MAX_IMAGE_BYTES) return { error: 'La imagen debe pesar hasta 5 MB.', status: 413 };
  const reader = request.body?.getReader();
  if (!reader) return { error: 'La imagen está vacía.', status: 400 };
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_IMAGE_BYTES) {
      await reader.cancel();
      return { error: 'La imagen debe pesar hasta 5 MB.', status: 413 };
    }
    chunks.push(value);
  }
  if (!size) return { error: 'La imagen está vacía.', status: 400 };
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const starts = values => values.every((value, index) => bytes[index] === value);
  const valid = size > 12 && (
    (type === 'image/jpeg' && starts([0xff, 0xd8, 0xff])) ||
    (type === 'image/png' && starts([137, 80, 78, 71, 13, 10, 26, 10])) ||
    (type === 'image/webp' && starts([82, 73, 70, 70]) && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP')
  );
  return valid ? { bytes, type } : { error: 'El archivo no coincide con un formato de imagen admitido.', status: 415 };
}

export async function handleDishImage(context) {
  try {
    const { request, params } = context;
    if (!['GET', 'PUT'].includes(request.method)) return json({ error: 'Método no permitido.' }, 405);
    const origin = request.headers.get('origin');
    if (request.method === 'PUT' && origin && origin !== new URL(request.url).origin) return json({ error: 'Origen no permitido.' }, 403);
    const repository = context.repository || createD1Repository(context.env?.DB);
    const dish = await repository.getDishImage(params.id, params.dishId);
    if (!dish) return json({ error: 'Plato no encontrado.' }, 404);
    if (request.method === 'GET' && !dish.image_key) return json({ error: 'Este plato todavía no tiene foto.' }, 404);
    const storage = context.storage || createR2Storage(context.env?.DISH_IMAGES);
    if (!storage) return json({ error: 'La subida de fotos todavía no está habilitada.' }, 503);
    if (request.method === 'GET') {
      const response = await storage.get(dish.image_key);
      if (!response) return json({ error: 'Foto no encontrada.' }, 404);
      const type = response.httpMetadata?.contentType?.split(';')[0];
      if (!TYPES.includes(type)) return json({ error: 'Formato de imagen no admitido.' }, 502);
      return new Response(response.body, { headers: { 'content-type': type, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' } });
    }
    const input = await readImage(request);
    if (input.error) return json({ error: input.error }, input.status);
    // Cada intento tiene una clave propia: un upload fallido nunca pisa la foto anterior.
    const key = `dishes/${crypto.randomUUID()}`;
    await storage.put(key, input.bytes, input.type);
    let changed;
    try {
      changed = await repository.replaceDishImage(params.id, params.dishId, dish.image_key, key);
    } catch (error) {
      await storage.delete(key).catch(() => console.error('No se pudo limpiar una foto sin asociar.'));
      throw error;
    }
    if (!changed) {
      await storage.delete(key).catch(() => console.error('No se pudo limpiar una foto sin asociar.'));
      return json({ error: 'La foto cambió mientras la subías. Volvé a intentarlo.' }, 409);
    }
    if (dish.image_key) {
      const cleanup = storage.delete(dish.image_key).catch(() => console.error('No se pudo borrar la foto anterior de R2.'));
      if (context.waitUntil) context.waitUntil(cleanup);
      else await cleanup;
    }
    return json({ imageUrl: imageUrl(params.id, params.dishId) });
  } catch (error) {
    console.error('Error de foto:', error.message);
    return json({ error: 'No se pudo guardar o cargar la foto. Volvé a intentarlo.' }, 502);
  }
}
