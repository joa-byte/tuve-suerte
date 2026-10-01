import test from 'node:test';
import assert from 'node:assert/strict';
import { handleDishImage, handleDinnerImage, MAX_IMAGE_BYTES } from '../lib/dish-images.mjs';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG1cAAAAASUVORK5CYII=', 'base64');
function fixture({ configured = true, exists = true, oldKey = null, dinner = false } = {}) {
  const objects = new Map(oldKey ? [[oldKey, { bytes: png, type: 'image/png' }]] : []);
  let key = oldKey;
  const repository = {
    async getDishImage(dinnerId, dishId) { return exists && dinnerId === 'dinner' && dishId === 'dish' ? { image_key: key } : null; },
    async replaceDishImage(dinnerId, dishId, previousKey, newKey) {
      if (previousKey !== key) return false;
      key = newKey;
      return true;
    }
  };
  repository.getDinnerImage = id => repository.getDishImage(id, 'dish');
  repository.replaceDinnerImage = (id, previousKey, newKey) => repository.replaceDishImage(id, 'dish', previousKey, newKey);
  const bucket = {
    async put(key, bytes, options) { objects.set(key, { bytes, type: options.httpMetadata.contentType }); return {}; },
    async get(key) { const value = objects.get(key); return value ? { body: value.bytes, httpMetadata: { contentType: value.type } } : null; },
    async delete(key) { objects.delete(key); }
  };
  const call = (method = 'PUT', body = png, headers = {}, params = { id: 'dinner', dishId: 'dish' }) => (dinner ? handleDinnerImage : handleDishImage)({
    request: new Request('https://app.test/api/dinners/dinner/dishes/dish/image', {
      method, headers: { 'content-type': 'image/png', ...headers }, ...(method === 'PUT' ? { body, duplex: 'half' } : {})
    }), repository, env: configured ? { DISH_IMAGES: bucket } : {}, params
  });
  return { call, repository, objects, bucket, key: () => key };
}

test('R2 nativo: subir, leer y reemplazar conserva una sola imagen', async () => {
  const f = fixture();
  const response = await f.call();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).imageUrl, '/api/dinners/dinner/dishes/dish/image');
  const first = f.key();
  const photo = await f.call('GET');
  assert.equal(photo.status, 200);
  assert.equal(photo.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(Buffer.from(await photo.arrayBuffer()), png);
  assert.equal((await f.call()).status, 200);
  assert.notEqual(f.key(), first);
  assert.equal(f.objects.size, 1);
  assert.equal(f.objects.has(first), false);
});

test('sin binding, plato ajeno, ausencia de foto y métodos inválidos', async () => {
  assert.equal((await fixture({ configured: false }).call()).status, 503);
  assert.equal((await fixture({ exists: false }).call()).status, 404);
  assert.equal((await fixture().call('GET')).status, 404);
  assert.equal((await fixture().call('DELETE')).status, 405);
  assert.equal((await fixture().call('PUT', png, {}, { id: 'otra-cena', dishId: 'dish' })).status, 404);
});

test('rechaza formatos falsos, SVG, cuerpo vacío, origen ajeno y exceso de tamaño', async () => {
  const f = fixture();
  assert.equal((await f.call('PUT', '<svg/>', { 'content-type': 'image/svg+xml' })).status, 415);
  assert.equal((await f.call('PUT', 'no es una imagen PNG')).status, 415);
  assert.equal((await f.call('PUT', null)).status, 400);
  assert.equal((await f.call('PUT', png, { origin: 'https://other.test' })).status, 403);
  assert.equal((await f.call('PUT', png, { 'content-length': MAX_IMAGE_BYTES + 1 })).status, 413);
  const stream = new ReadableStream({ start(controller) {
    controller.enqueue(new Uint8Array(MAX_IMAGE_BYTES)); controller.enqueue(new Uint8Array(1)); controller.close();
  } });
  assert.equal((await f.call('PUT', stream)).status, 413);
  assert.equal(f.objects.size, 0);
});

test('si falla R2 se conserva la referencia anterior', async () => {
  const f = fixture({ oldKey: 'old' });
  f.bucket.put = async () => { throw new Error('fallo simulado'); };
  assert.equal((await f.call()).status, 502);
  assert.equal(f.key(), 'old');
  assert.equal(f.objects.size, 1);
});

test('si falla D1 se elimina el objeto nuevo y se conserva el anterior', async () => {
  const f = fixture({ oldKey: 'old' });
  f.repository.replaceDishImage = async () => { throw new Error('fallo simulado'); };
  assert.equal((await f.call()).status, 502);
  assert.deepEqual([...f.objects.keys()], ['old']);
  assert.equal(f.key(), 'old');
});

test('dos reemplazos simultáneos: uno gana, el otro recibe 409 sin objetos sobrantes', async () => {
  const f = fixture({ oldKey: 'old' });
  let arrivals = 0;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const original = f.repository.getDishImage;
  f.repository.getDishImage = async (...args) => {
    const snapshot = await original(...args);
    if (++arrivals === 2) release();
    await gate;
    return snapshot;
  };
  const responses = await Promise.all([f.call(), f.call()]);
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
  assert.deepEqual([...f.objects.keys()], [f.key()]);
});

test('fallo al limpiar la anterior no revierte una foto ya confirmada', async () => {
  const f = fixture({ oldKey: 'old' });
  f.bucket.delete = async () => { throw new Error('fallo simulado'); };
  assert.equal((await f.call()).status, 200);
  assert.notEqual(f.key(), 'old');
  assert.equal((await f.call('GET')).status, 200);
});


test('foto propia de cena: upload, lectura y reemplazo independientes de los platos', async () => {
  const f = fixture({ dinner: true });
  const response = await f.call();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).imageUrl, '/api/dinners/dinner/image');
  assert.ok(f.key().startsWith('dinners/'));
  const previous = f.key();
  assert.deepEqual(Buffer.from(await (await f.call('GET')).arrayBuffer()), png);
  assert.equal((await f.call()).status, 200);
  assert.notEqual(f.key(), previous);
  assert.equal(f.objects.size, 1);
});

test('cena inexistente, sin binding o sin foto propia tiene respuesta explícita', async () => {
  assert.equal((await fixture({ dinner: true, exists: false }).call()).status, 404);
  assert.equal((await fixture({ dinner: true, configured: false }).call()).status, 503);
  assert.equal((await fixture({ dinner: true }).call('GET')).status, 404);
});

test('conflicto al reemplazar la cena conserva su foto anterior', async () => {
  const f = fixture({ dinner: true, oldKey: 'dinners/old' });
  f.repository.replaceDinnerImage = async () => false;
  assert.equal((await f.call()).status, 409);
  assert.deepEqual([...f.objects.keys()], ['dinners/old']);
});
