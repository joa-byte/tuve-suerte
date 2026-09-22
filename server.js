const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const root = __dirname;
const dataFile = path.join(root, 'data', 'dinners.json');
const publicDir = path.join(root, 'public');
const port = Number(process.env.PORT || 3000);

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml'
};

async function readData() {
  return JSON.parse(await fs.readFile(dataFile, 'utf8'));
}

async function writeData(data) {
  const temp = `${dataFile}.tmp`;
  await fs.writeFile(temp, JSON.stringify(data, null, 2));
  await fs.rename(temp, dataFile);
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
}

async function body(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString() || '{}');
}

function slug(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || crypto.randomUUID();
}

function average(reviews = []) {
  return reviews.length ? Number((reviews.reduce((sum, item) => sum + Number(item.score), 0) / reviews.length).toFixed(1)) : null;
}

function withAverages(dinner) {
  return {
    ...dinner,
    dishes: dinner.dishes.map(item => ({ ...item, average: average(item.reviews) })),
    wines: dinner.wines.map(item => ({ ...item, average: average(item.reviews) }))
  };
}

async function api(req, res, pathname) {
  const data = await readData();
  const parts = pathname.split('/').filter(Boolean);

  if (req.method === 'GET' && pathname === '/api/dinners') {
    return send(res, 200, data.dinners.map(withAverages));
  }

  if (req.method === 'POST' && pathname === '/api/dinners') {
    const input = await body(req);
    if (!input.title?.trim() || !input.date) return send(res, 400, { error: 'Título y fecha son obligatorios.' });
    const dinner = {
      id: `${slug(input.title)}-${Date.now().toString(36)}`,
      title: input.title.trim(),
      date: input.date,
      guests: [...new Set((input.guests || []).map(item => item.trim()).filter(Boolean))],
      dishes: [],
      wines: []
    };
    data.dinners.push(dinner);
    await writeData(data);
    return send(res, 201, withAverages(dinner));
  }

  const dinner = data.dinners.find(item => item.id === parts[2]);
  if (!dinner) return send(res, 404, { error: 'Cena no encontrada.' });
  if (req.method === 'GET' && parts.length === 3) return send(res, 200, withAverages(dinner));

  if (req.method === 'POST' && parts[3] === 'items' && parts.length === 4) {
    const input = await body(req);
    const collection = input.type === 'wine' ? 'wines' : 'dishes';
    if (!input.name?.trim()) return send(res, 400, { error: 'El nombre es obligatorio.' });
    const item = collection === 'wines'
      ? { id: `${slug(input.name)}-${Date.now().toString(36)}`, category: input.category?.trim() || 'Otros', winery: input.winery?.trim() || '', name: input.name.trim(), varietal: input.varietal?.trim() || '', reviews: [] }
      : { id: `${slug(input.name)}-${Date.now().toString(36)}`, name: input.name.trim(), reviews: [] };
    dinner[collection].push(item);
    await writeData(data);
    return send(res, 201, { ...item, average: null });
  }

  if (req.method === 'POST' && parts[3] === 'reviews' && parts.length === 6) {
    const collection = parts[4] === 'wine' ? 'wines' : 'dishes';
    const item = dinner[collection].find(entry => entry.id === parts[5]);
    if (!item) return send(res, 404, { error: 'Elemento no encontrado.' });
    const input = await body(req);
    const score = Number(input.score);
    if (!input.author?.trim() || score < 1 || score > 10) return send(res, 400, { error: 'Indicá tu nombre y una nota del 1 al 10.' });
    item.reviews.push({ author: input.author.trim(), score, comment: input.comment?.trim() || '' });
    await writeData(data);
    return send(res, 201, { ...item, average: average(item.reviews) });
  }

  return send(res, 404, { error: 'Ruta no encontrada.' });
}

async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith('/api/')) return await api(req, res, url.pathname);
    const requestPath = url.pathname === '/' ? '/index.html' : url.pathname;
    const filePath = path.normalize(path.join(publicDir, requestPath));
    if (!filePath.startsWith(publicDir)) return send(res, 403, 'Forbidden', 'text/plain');
    try {
      const file = await fs.readFile(filePath);
      return send(res, 200, file, mime[path.extname(filePath)] || 'application/octet-stream');
    } catch {
      const html = await fs.readFile(path.join(publicDir, 'index.html'));
      return send(res, 200, html, mime['.html']);
    }
  } catch (error) {
    console.error(error);
    return send(res, 500, { error: 'Algo salió mal.' });
  }
}

if (require.main === module) {
  http.createServer(handler).listen(port, () => {
    console.log(`Tuve suerte en http://localhost:${port}`);
  });
}

module.exports = { average, handler, slug, withAverages };
