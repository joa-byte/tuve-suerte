import { readFile } from 'node:fs/promises';

const source = new URL('../data/dinners.json', import.meta.url);
const data = JSON.parse(await readFile(source, 'utf8'));

const sql = value => value == null ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`;
const lines = [
  '-- Generado desde data/dinners.json con: npm run db:seed:generate',
  '-- Es idempotente para poder aplicarlo más de una vez sin duplicar datos.',
  'PRAGMA foreign_keys = ON;',
  'BEGIN TRANSACTION;'
];

for (const dinner of data.dinners) {
  lines.push(`INSERT OR IGNORE INTO dinners (id, title, date) VALUES (${sql(dinner.id)}, ${sql(dinner.title)}, ${sql(dinner.date)});`);
  for (const guest of dinner.guests || []) {
    lines.push(`INSERT OR IGNORE INTO dinner_guests (dinner_id, name) VALUES (${sql(dinner.id)}, ${sql(guest)});`);
  }
  for (const dish of dinner.dishes || []) {
    lines.push(`INSERT OR IGNORE INTO dishes (id, dinner_id, name, description) VALUES (${sql(dish.id)}, ${sql(dinner.id)}, ${sql(dish.name)}, ${sql(dish.description)});`);
    (dish.reviews || []).forEach((review, index) => {
      lines.push(`INSERT OR IGNORE INTO reviews (id, dinner_id, item_type, item_id, author, score, comment) VALUES (${sql(`seed-${dinner.id}-dish-${dish.id}-${index + 1}`)}, ${sql(dinner.id)}, 'dish', ${sql(dish.id)}, ${sql(review.author)}, ${Number(review.score)}, ${sql(review.comment || '')});`);
    });
  }
  for (const wine of dinner.wines || []) {
    lines.push(`INSERT OR IGNORE INTO wines (id, dinner_id, name, category, winery, varietal) VALUES (${sql(wine.id)}, ${sql(dinner.id)}, ${sql(wine.name)}, ${sql(wine.category || 'Otros')}, ${sql(wine.winery || '')}, ${sql(wine.varietal || '')});`);
    (wine.reviews || []).forEach((review, index) => {
      lines.push(`INSERT OR IGNORE INTO reviews (id, dinner_id, item_type, item_id, author, score, comment) VALUES (${sql(`seed-${dinner.id}-wine-${wine.id}-${index + 1}`)}, ${sql(dinner.id)}, 'wine', ${sql(wine.id)}, ${sql(review.author)}, ${Number(review.score)}, ${sql(review.comment || '')});`);
    });
  }
}

lines.push('COMMIT;');
process.stdout.write(`${lines.join('\n')}\n`);

