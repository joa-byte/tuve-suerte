import test from 'node:test';
import assert from 'node:assert/strict';
import {
  average,
  handleDinner,
  handleDinners,
  handleItems,
  handleReviews,
  slug,
  withAverages
} from '../lib/dinners-api.mjs';

function fixture() {
  return {
    dinners: [{
      id: 'cena-uno', title: 'Cena uno', date: '2026-06-19', guests: ['Jo', 'Lu'],
      dishes: [{ id: 'fideos', name: 'Fideos', reviews: [{ author: 'Jo', score: 8, comment: 'Ricos' }] }],
      wines: [{ id: 'malbec', category: 'Tintos', winery: 'La Bodega', name: 'Reserva', varietal: 'Malbec', reviews: [] }]
    }]
  };
}

class MemoryRepository {
  constructor(data = fixture()) { this.data = structuredClone(data); this.sequence = 0; }
  async listDinners() { return this.data.dinners.map(dinner => withAverages(structuredClone(dinner))); }
  async getDinner(id) {
    const dinner = this.data.dinners.find(entry => entry.id === id);
    return dinner ? withAverages(structuredClone(dinner)) : null;
  }
  async createDinner(input) {
    const dinner = { id: `${slug(input.title)}-${++this.sequence}`, ...input, dishes: [], wines: [] };
    this.data.dinners.push(dinner);
    return withAverages(structuredClone(dinner));
  }
  async addItem(dinnerId, input) {
    const dinner = this.data.dinners.find(entry => entry.id === dinnerId);
    const item = input.type === 'wine'
      ? { id: `${slug(input.name)}-${++this.sequence}`, category: input.category, winery: input.winery, name: input.name, varietal: input.varietal, reviews: [] }
      : { id: `${slug(input.name)}-${++this.sequence}`, name: input.name, ...(input.description ? { description: input.description } : {}), reviews: [] };
    dinner[input.type === 'wine' ? 'wines' : 'dishes'].push(item);
    return { ...structuredClone(item), average: null };
  }
  async itemExists(dinnerId, type, itemId) {
    const dinner = this.data.dinners.find(entry => entry.id === dinnerId);
    return Boolean(dinner?.[type === 'wine' ? 'wines' : 'dishes'].some(item => item.id === itemId));
  }
  async addReview(dinnerId, type, itemId, input) {
    const dinner = this.data.dinners.find(entry => entry.id === dinnerId);
    const item = dinner[type === 'wine' ? 'wines' : 'dishes'].find(entry => entry.id === itemId);
    item.reviews.push(input);
    return { ...structuredClone(item), average: average(item.reviews) };
  }
}

function context(method, path, { body, params = {}, repository = new MemoryRepository() } = {}) {
  return {
    request: new Request(`http://local.test${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    }),
    params,
    repository
  };
}

const payload = response => response.json();

test('calcula el promedio con el redondeo existente', () => {
  assert.equal(average([{ score: 9.5 }, { score: 9 }, { score: 9 }]), 9.2);
  assert.equal(average([]), null);
  assert.equal(slug('Ñoquis de mamá'), 'noquis-de-mama');
});

test('lista cenas con objetos anidados y promedios', async () => {
  const response = await handleDinners(context('GET', '/api/dinners'));
  const dinners = await payload(response);
  assert.equal(response.status, 200);
  assert.equal(dinners.length, 1);
  assert.equal(dinners[0].dishes[0].average, 8);
  assert.deepEqual(dinners[0].guests, ['Jo', 'Lu']);
});

test('obtiene una cena por id', async () => {
  const response = await handleDinner(context('GET', '/api/dinners/cena-uno', { params: { id: 'cena-uno' } }));
  assert.equal(response.status, 200);
  assert.equal((await payload(response)).title, 'Cena uno');
});

test('crea una cena y elimina invitados repetidos o vacíos', async () => {
  const repository = new MemoryRepository();
  const response = await handleDinners(context('POST', '/api/dinners', {
    repository,
    body: { title: '  Noche de pastas  ', date: '2026-09-20', guests: [' Jo ', 'Jo', ''] }
  }));
  const dinner = await payload(response);
  assert.equal(response.status, 201);
  assert.equal(dinner.title, 'Noche de pastas');
  assert.deepEqual(dinner.guests, ['Jo']);
  assert.deepEqual(dinner.dishes, []);
});

test('mantiene las validaciones de campos obligatorios', async () => {
  const dinnerResponse = await handleDinners(context('POST', '/api/dinners', { body: { title: 'Sin fecha' } }));
  assert.equal(dinnerResponse.status, 400);
  assert.equal((await payload(dinnerResponse)).error, 'Título y fecha son obligatorios.');

  const itemResponse = await handleItems(context('POST', '/api/dinners/cena-uno/items', {
    params: { id: 'cena-uno' }, body: { type: 'dish', name: '   ' }
  }));
  assert.equal(itemResponse.status, 400);
  assert.equal((await payload(itemResponse)).error, 'El nombre es obligatorio.');
});

test('agrega un plato con descripción opcional', async () => {
  const response = await handleItems(context('POST', '/api/dinners/cena-uno/items', {
    params: { id: 'cena-uno' }, body: { type: 'dish', name: '  Helado  ', description: 'Casero' }
  }));
  const item = await payload(response);
  assert.equal(response.status, 201);
  assert.equal(item.name, 'Helado');
  assert.equal(item.description, 'Casero');
  assert.equal(item.average, null);
});

test('agrega un vino conservando categoría, bodega y varietal', async () => {
  const response = await handleItems(context('POST', '/api/dinners/cena-uno/items', {
    params: { id: 'cena-uno' },
    body: { type: 'wine', name: 'Trumpeter', category: 'Tintos', winery: 'Rutini', varietal: 'Malbec' }
  }));
  const item = await payload(response);
  assert.equal(response.status, 201);
  assert.deepEqual(
    { name: item.name, category: item.category, winery: item.winery, varietal: item.varietal },
    { name: 'Trumpeter', category: 'Tintos', winery: 'Rutini', varietal: 'Malbec' }
  );
});

test('agrega una opinión y recalcula el promedio', async () => {
  const repository = new MemoryRepository();
  const response = await handleReviews(context('POST', '/api/dinners/cena-uno/reviews/dish/fideos', {
    repository,
    params: { id: 'cena-uno', type: 'dish', itemId: 'fideos' },
    body: { author: ' Lu ', score: 10, comment: ' Repetiría ' }
  }));
  const item = await payload(response);
  assert.equal(response.status, 201);
  assert.equal(item.average, 9);
  assert.deepEqual(item.reviews[1], { author: 'Lu', score: 10, comment: 'Repetiría' });
});

test('rechaza puntuaciones fuera del rango de 1 a 10', async () => {
  for (const score of [0, 11, 'no-es-un-número']) {
    const response = await handleReviews(context('POST', '/api/dinners/cena-uno/reviews/dish/fideos', {
      params: { id: 'cena-uno', type: 'dish', itemId: 'fideos' }, body: { author: 'Jo', score }
    }));
    assert.equal(response.status, 400);
    assert.equal((await payload(response)).error, 'Indicá tu nombre y una nota del 1 al 10.');
  }
});

test('responde 404 para una cena inexistente', async () => {
  const response = await handleDinner(context('GET', '/api/dinners/no-existe', { params: { id: 'no-existe' } }));
  assert.equal(response.status, 404);
  assert.equal((await payload(response)).error, 'Cena no encontrada.');
});

test('responde 404 para un plato o vino inexistente', async () => {
  const response = await handleReviews(context('POST', '/api/dinners/cena-uno/reviews/wine/no-existe', {
    params: { id: 'cena-uno', type: 'wine', itemId: 'no-existe' }, body: { author: 'Jo', score: 8 }
  }));
  assert.equal(response.status, 404);
  assert.equal((await payload(response)).error, 'Elemento no encontrado.');
});
