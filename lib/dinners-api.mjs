const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store'
};

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export function slug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function average(reviews = []) {
  return reviews.length
    ? Number((reviews.reduce((sum, item) => sum + Number(item.score), 0) / reviews.length).toFixed(1))
    : null;
}

export function withAverages(dinner) {
  return {
    ...dinner,
    dishes: dinner.dishes.map(item => ({ ...item, average: average(item.reviews) })),
    wines: dinner.wines.map(item => ({ ...item, average: average(item.reviews) }))
  };
}

function createId(label) {
  const prefix = slug(label) || 'item';
  return `${prefix}-${crypto.randomUUID().slice(0, 12)}`;
}

async function requestBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function results(result) {
  return result?.results || [];
}

export function createD1Repository(db) {
  if (!db) throw new Error('Falta el binding D1 DB.');

  function hydrateDinner(row, guestRows, dishRows, wineRows, reviewRows) {
    const groupedReviews = new Map();
    for (const review of reviewRows.filter(entry => entry.dinner_id === row.id)) {
      const key = `${review.item_type}:${review.item_id}`;
      if (!groupedReviews.has(key)) groupedReviews.set(key, []);
      groupedReviews.get(key).push({
        author: review.author,
        score: Number(review.score),
        comment: review.comment || ''
      });
    }

    const dishes = dishRows.filter(item => item.dinner_id === row.id).map(item => ({
      id: item.id,
      name: item.name,
      ...(item.description ? { description: item.description } : {}),
      reviews: groupedReviews.get(`dish:${item.id}`) || []
    }));
    const wines = wineRows.filter(item => item.dinner_id === row.id).map(item => ({
      id: item.id,
      category: item.category,
      winery: item.winery || '',
      name: item.name,
      varietal: item.varietal || '',
      reviews: groupedReviews.get(`wine:${item.id}`) || []
    }));

    return withAverages({
      id: row.id,
      title: row.title,
      date: row.date,
      guests: guestRows.filter(guest => guest.dinner_id === row.id).map(guest => guest.name),
      dishes,
      wines
    });
  }

  return {
    async listDinners() {
      const [dinnerResult, guestResult, dishResult, wineResult, reviewResult] = await Promise.all([
        db.prepare('SELECT id, title, date FROM dinners ORDER BY rowid').all(),
        db.prepare('SELECT dinner_id, name FROM dinner_guests ORDER BY rowid').all(),
        db.prepare('SELECT dinner_id, id, name, description FROM dishes ORDER BY rowid').all(),
        db.prepare('SELECT dinner_id, id, name, category, winery, varietal FROM wines ORDER BY rowid').all(),
        db.prepare('SELECT dinner_id, item_type, item_id, author, score, comment FROM reviews ORDER BY rowid').all()
      ]);
      const related = [results(guestResult), results(dishResult), results(wineResult), results(reviewResult)];
      return results(dinnerResult).map(row => hydrateDinner(row, ...related));
    },

    async getDinner(id) {
      const row = await db.prepare('SELECT id, title, date FROM dinners WHERE id = ?').bind(id).first();
      if (!row) return null;
      const [guestResult, dishResult, wineResult, reviewResult] = await Promise.all([
        db.prepare('SELECT dinner_id, name FROM dinner_guests WHERE dinner_id = ? ORDER BY rowid').bind(id).all(),
        db.prepare('SELECT dinner_id, id, name, description FROM dishes WHERE dinner_id = ? ORDER BY rowid').bind(id).all(),
        db.prepare('SELECT dinner_id, id, name, category, winery, varietal FROM wines WHERE dinner_id = ? ORDER BY rowid').bind(id).all(),
        db.prepare('SELECT dinner_id, item_type, item_id, author, score, comment FROM reviews WHERE dinner_id = ? ORDER BY rowid').bind(id).all()
      ]);
      return hydrateDinner(row, results(guestResult), results(dishResult), results(wineResult), results(reviewResult));
    },

    async createDinner(input) {
      const id = createId(input.title);
      const statements = [
        db.prepare('INSERT INTO dinners (id, title, date) VALUES (?, ?, ?)').bind(id, input.title, input.date),
        ...input.guests.map(name => db.prepare('INSERT INTO dinner_guests (dinner_id, name) VALUES (?, ?)').bind(id, name))
      ];
      await db.batch(statements);
      return this.getDinner(id);
    },

    async addItem(dinnerId, input) {
      const id = createId(input.name);
      if (input.type === 'wine') {
        await db.prepare('INSERT INTO wines (id, dinner_id, name, category, winery, varietal) VALUES (?, ?, ?, ?, ?, ?)')
          .bind(id, dinnerId, input.name, input.category, input.winery, input.varietal)
          .run();
      } else {
        await db.prepare('INSERT INTO dishes (id, dinner_id, name, description) VALUES (?, ?, ?, ?)')
          .bind(id, dinnerId, input.name, input.description || null)
          .run();
      }
      return input.type === 'wine'
        ? { id, category: input.category, winery: input.winery, name: input.name, varietal: input.varietal, reviews: [], average: null }
        : { id, name: input.name, ...(input.description ? { description: input.description } : {}), reviews: [], average: null };
    },

    async addReview(dinnerId, type, itemId, input) {
      await db.prepare('INSERT INTO reviews (id, dinner_id, item_type, item_id, author, score, comment) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(createId(`opinion-${itemId}`), dinnerId, type, itemId, input.author, input.score, input.comment)
        .run();
      const dinner = await this.getDinner(dinnerId);
      const collection = type === 'wine' ? dinner.wines : dinner.dishes;
      return collection.find(item => item.id === itemId);
    },

    async itemExists(dinnerId, type, itemId) {
      const table = type === 'wine' ? 'wines' : 'dishes';
      const row = await db.prepare(`SELECT id FROM ${table} WHERE id = ? AND dinner_id = ?`).bind(itemId, dinnerId).first();
      return Boolean(row);
    }
  };
}

async function safely(action) {
  try {
    return await action();
  } catch (error) {
    console.error(error);
    return json({ error: 'Algo salió mal.' }, 500);
  }
}

function repositoryFor(context) {
  return context.repository || createD1Repository(context.env?.DB);
}

function methodNotAllowed() {
  return json({ error: 'Método no permitido.' }, 405);
}

export function handleDinners(context) {
  return safely(async () => {
    const repository = repositoryFor(context);
    if (context.request.method === 'GET') return json(await repository.listDinners());
    if (context.request.method !== 'POST') return methodNotAllowed();

    const input = await requestBody(context.request);
    const title = input.title?.trim();
    if (!title || !input.date) return json({ error: 'Título y fecha son obligatorios.' }, 400);
    const guests = [...new Set((Array.isArray(input.guests) ? input.guests : []).map(name => String(name).trim()).filter(Boolean))];
    const dinner = await repository.createDinner({ title, date: input.date, guests });
    return json(dinner, 201);
  });
}

export function handleDinner(context) {
  return safely(async () => {
    if (context.request.method !== 'GET') return methodNotAllowed();
    const dinner = await repositoryFor(context).getDinner(context.params.id);
    return dinner ? json(dinner) : json({ error: 'Cena no encontrada.' }, 404);
  });
}

export function handleItems(context) {
  return safely(async () => {
    if (context.request.method !== 'POST') return methodNotAllowed();
    const repository = repositoryFor(context);
    const dinner = await repository.getDinner(context.params.id);
    if (!dinner) return json({ error: 'Cena no encontrada.' }, 404);

    const input = await requestBody(context.request);
    const name = input.name?.trim();
    if (!name) return json({ error: 'El nombre es obligatorio.' }, 400);
    const type = input.type === 'wine' ? 'wine' : 'dish';
    const item = await repository.addItem(context.params.id, {
      type,
      name,
      description: input.description?.trim() || '',
      category: input.category?.trim() || 'Otros',
      winery: input.winery?.trim() || '',
      varietal: input.varietal?.trim() || ''
    });
    return json(item, 201);
  });
}

export function handleReviews(context) {
  return safely(async () => {
    if (context.request.method !== 'POST') return methodNotAllowed();
    const repository = repositoryFor(context);
    const dinnerId = context.params.id;
    const dinner = await repository.getDinner(dinnerId);
    if (!dinner) return json({ error: 'Cena no encontrada.' }, 404);

    const type = context.params.type === 'wine' ? 'wine' : 'dish';
    const itemId = context.params.itemId;
    if (!(await repository.itemExists(dinnerId, type, itemId))) return json({ error: 'Elemento no encontrado.' }, 404);

    const input = await requestBody(context.request);
    const author = input.author?.trim();
    const score = Number(input.score);
    if (!author || !Number.isFinite(score) || score < 1 || score > 10) {
      return json({ error: 'Indicá tu nombre y una nota del 1 al 10.' }, 400);
    }
    const item = await repository.addReview(dinnerId, type, itemId, {
      author,
      score,
      comment: input.comment?.trim() || ''
    });
    return json(item, 201);
  });
}
