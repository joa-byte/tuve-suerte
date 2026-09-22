import { json } from '../../lib/dinners-api.mjs';

export function onRequest() {
  return json({ error: 'Ruta no encontrada.' }, 404);
}

