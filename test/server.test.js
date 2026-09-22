const test = require('node:test');
const assert = require('node:assert/strict');
const { average, slug, withAverages } = require('../server');

test('calcula el promedio con un decimal', () => {
  assert.equal(average([{ score: 9.5 }, { score: 9 }, { score: 9 }]), 9.2);
  assert.equal(average([]), null);
});

test('genera identificadores legibles sin acentos', () => {
  assert.equal(slug('Ñoquis de mamá'), 'noquis-de-mama');
});

test('incorpora promedios sin mutar la cena', () => {
  const dinner = {
    title: 'Cena',
    dishes: [{ name: 'Plato', reviews: [{ score: 8 }, { score: 10 }] }],
    wines: [{ name: 'Vino', reviews: [] }]
  };
  const result = withAverages(dinner);
  assert.equal(result.dishes[0].average, 9);
  assert.equal(result.wines[0].average, null);
  assert.equal('average' in dinner.dishes[0], false);
});
