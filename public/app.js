const app = document.querySelector('#app');
const modal = document.querySelector('#modal');
const toast = document.querySelector('#toast');

const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const dateValue = value => new Date(`${value}T00:00:00Z`);
const formatDate = value => new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(dateValue(value));
const formatShortDate = value => new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(dateValue(value));
const score = value => value == null ? '—' : Number(value).toLocaleString('es-AR', { maximumFractionDigits: 1 });
const pluralOpinions = length => `${length} ${length === 1 ? 'opinión' : 'opiniones'}`;

const icons = {
  back: `<svg class="ink-icon" viewBox="0 0 54 38" aria-hidden="true"><path d="M22 4 5 19l17 15M6 19c15-1 29-1 43 1"/></svg>`,
  calendar: `<svg class="ink-icon" viewBox="0 0 44 44" aria-hidden="true"><path d="M8 9c8-1 19-1 28 0l1 29c-10 1-20 1-30 0Z"/><path d="M14 3v12M30 3v12M8 18c10-1 20 1 29 0"/></svg>`,
  home: `<svg class="ink-icon" viewBox="0 0 44 44" aria-hidden="true"><path d="m5 22 17-16 17 16M9 19v21h10V29h7v11h10V19"/></svg>`,
  wine: `<svg class="ink-icon" viewBox="0 0 44 44" aria-hidden="true"><path d="M12 5h20l-2 11c-1 7-15 7-16 0Z"/><path d="M22 22v15M14 39c6-2 11-2 16 0"/></svg>`
};

const faceDoodle = `<svg viewBox="0 0 150 150" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><path d="M76 7c40 0 65 26 65 63 0 42-25 72-65 72S9 113 9 73C9 33 36 7 76 7Z"/><path d="M51 47c5-5 13-5 18-1m18 0c7-4 14-3 19 2M64 63c0 3-2 5-5 5s-5-2-5-5 2-5 5-5 5 2 5 5Zm37 0c0 3-2 5-5 5s-5-2-5-5 2-5 5-5 5 2 5 5ZM76 60c0 18-8 23-8 31 0 5 4 8 10 8m-23 18c13-6 28-6 42 0"/><path d="M49 54c6 1 12 1 18-1m20 1c7 1 13 1 19 0" opacity=".55"/></g></svg>`;
const foodDoodle = `<svg viewBox="0 0 180 120" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="90" cy="74" rx="74" ry="32"/><ellipse cx="90" cy="68" rx="59" ry="23"/><path d="M46 68c18-30 68-31 90 0M49 59c20 18 60-14 84 9M52 73c21-20 56 15 79-7M59 51c6 11 14 14 23 3m16-6c1 12 10 15 19 6"/><circle cx="68" cy="64" r="6"/><circle cx="113" cy="61" r="7"/><path d="M84 42c4-10 12-16 21-17-3 7-9 12-18 14m4 3c-5-8-12-12-21-11 4 7 11 11 21 11Z"/></g></svg>`;

function bottomNav(active) {
  return `<nav class="bottom-nav" aria-label="Navegación principal">
    <button class="nav-button ${active === 'home' ? 'active' : ''}" data-route="#/" aria-label="Inicio">${icons.home}<span>inicio</span></button>
    <button class="nav-button ${active === 'calendar' ? 'active' : ''}" data-route="#/calendario" aria-label="Calendario">${icons.calendar}<span>calendario</span></button>
    <button class="nav-button ${active === 'wine' ? 'active' : ''}" data-route="#/vinos" aria-label="Vinos">${icons.wine}<span>vinos</span></button>
  </nav>`;
}

function bindNavigation(scope = app) {
  scope.querySelectorAll('[data-route]').forEach(button => {
    button.addEventListener('click', () => { location.hash = button.dataset.route; });
  });
}

async function request(url, options = {}) {
  const response = await fetch(url, { headers: { 'content-type': 'application/json' }, ...options });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'No se pudo completar la acción.');
  return payload;
}

function notify(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(notify.timeout);
  notify.timeout = setTimeout(() => toast.classList.remove('show'), 2600);
}

function showLoading(message) {
  app.innerHTML = `<div class="shell"><div class="loading-note" role="status">${escapeHtml(message)}</div></div>`;
}

function openModal(title, content, onSubmit) {
  modal.innerHTML = `<div class="modal-head"><h2>${escapeHtml(title)}</h2><button class="close" type="button" aria-label="Cerrar">×</button></div>${content}`;
  modal.querySelector('.close').addEventListener('click', () => modal.close());
  const form = modal.querySelector('form');
  const error = form.querySelector('.form-error');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = form.querySelector('[type=submit]');
    submit.disabled = true;
    submit.textContent = 'Escribiendo…';
    if (error) error.textContent = '';
    try { await onSubmit(new FormData(form)); modal.close(); }
    catch (problem) {
      if (error) error.textContent = problem.message;
      else notify(problem.message);
      submit.disabled = false;
      submit.textContent = submit.dataset.label;
    }
  });
  modal.showModal();
}

function dinnerForm() {
  openModal('Registrar una cena', `<form>
    <label>Nombre de la cena<input name="title" required autocomplete="off" placeholder="Fideos caseros"></label>
    <label>Fecha<input type="date" name="date" required></label>
    <label>¿Quiénes comieron?<input name="guests" autocomplete="off" placeholder="Jo, Lu, Valen"><small>Separá los nombres con comas.</small></label>
    <p class="form-error" role="alert"></p>
    <div class="form-actions"><button class="text-action submit-action" type="submit" data-label="+ guardar cena">+ guardar cena</button></div>
  </form>`, async data => {
    const dinner = await request('/api/dinners', { method: 'POST', body: JSON.stringify({ title: data.get('title'), date: data.get('date'), guests: data.get('guests').split(',') }) });
    location.hash = `#/cena/${dinner.id}`;
    notify('Cena registrada en la hoja');
  });
  modal.querySelector('[name=date]').max = new Date().toISOString().slice(0, 10);
}

function reviewForm(dinnerId, item, type) {
  openModal(`Opinar sobre ${item.name}`, `<form>
    <label>Tu nombre<input name="author" required autocomplete="name" placeholder="Jo"></label>
    <label>Puntuación, del 1 al 10<input type="number" name="score" required min="1" max="10" step="0.1" inputmode="decimal" placeholder="9,2"></label>
    <label>Tu anotación<textarea name="comment" placeholder="¿Qué te pareció?"></textarea></label>
    <p class="form-error" role="alert"></p>
    <div class="form-actions"><button class="text-action submit-action" type="submit" data-label="+ agregar mi opinión">+ agregar mi opinión</button></div>
  </form>`, async data => {
    await request(`/api/dinners/${dinnerId}/reviews/${type}/${item.id}`, { method: 'POST', body: JSON.stringify(Object.fromEntries(data)) });
    notify('Opinión anotada');
    await renderDetail(dinnerId);
  });
}

function itemForm(dinnerId) {
  openModal('Sumar a esta cena', `<form>
    <label>¿Qué querés sumar?<select name="type"><option value="dish">Un plato</option><option value="wine">Un vino</option></select></label>
    <label>Nombre<input name="name" required autocomplete="off" placeholder="Fideos con salsa de hongos"></label>
    <div class="wine-fields hidden"><label>Categoría<select name="category"><option>Tintos</option><option>Blancos</option><option>Rosados</option><option>Espumosos</option></select></label><label>Bodega<input name="winery" autocomplete="off" placeholder="Rutini Wines"></label><label>Varietal<input name="varietal" autocomplete="off" placeholder="Malbec"></label></div>
    <p class="form-error" role="alert"></p>
    <div class="form-actions"><button class="text-action submit-action" type="submit" data-label="+ sumar">+ sumar</button></div>
  </form>`, async data => {
    await request(`/api/dinners/${dinnerId}/items`, { method: 'POST', body: JSON.stringify(Object.fromEntries(data)) });
    notify('Quedó anotado en la cena');
    await renderDetail(dinnerId);
  });
  const type = modal.querySelector('[name=type]');
  type.addEventListener('change', () => modal.querySelector('.wine-fields').classList.toggle('hidden', type.value !== 'wine'));
}

function miniPhotos(amount) {
  return `<div class="mini-stack" aria-hidden="true">${Array.from({ length: Math.max(1, Math.min(3, amount)) }, (_, index) => `<span class="mini-photo">${index === 0 ? foodDoodle : ''}</span>`).join('')}</div>`;
}

function dinnerEntry(dinner) {
  return `<button class="dinner-entry" data-route="#/cena/${escapeHtml(dinner.id)}">
    <span><h2>${escapeHtml(dinner.title)}</h2>${miniPhotos(dinner.dishes.length)}</span>
    <span class="entry-meta"><time datetime="${dinner.date}">${escapeHtml(formatShortDate(dinner.date))}</time><span class="name-list">${dinner.guests.map(name => `<span style="display:block">— ${escapeHtml(name)}</span>`).join('')}</span></span>
  </button>`;
}

async function renderHome() {
  showLoading('Buscando recuerdos…');
  const dinners = await request('/api/dinners');
  const ordered = [...dinners].sort((a, b) => b.date.localeCompare(a.date));
  app.innerHTML = `<div class="shell">
    <header class="home-header"><div class="face">${faceDoodle}</div><h1 class="screen-reader-only">Tuve suerte</h1></header>
    <button class="new-dinner" type="button"><span class="plus-mark">+</span><span>Tuve suerte</span></button>
    <section aria-labelledby="dinners-heading"><h2 id="dinners-heading" class="screen-reader-only">Cenas anteriores</h2><div class="dinner-list">${ordered.length ? ordered.map(dinnerEntry).join('') : '<div class="empty-note">Todavía no hay cenas anotadas.<br>La primera empieza con “Tuve suerte”.</div>'}</div></section>
    ${bottomNav('home')}
  </div>`;
  app.querySelector('.new-dinner').addEventListener('click', dinnerForm);
  bindNavigation();
}

function dishRow(item) {
  const note = item.description || item.reviews.find(review => review.comment);
  return `<article class="dish-row">
    <div><h3>${escapeHtml(item.name)}</h3>${note ? `<p class="comment">“${escapeHtml(note.comment || note)}”${note.author ? ` — ${escapeHtml(note.author)}` : ''}</p>` : ''}</div>
    <div class="item-score">${score(item.average)}<small>${pluralOpinions(item.reviews.length)}</small></div>
    <button class="bracket-action review-button" type="button" data-type="dish" data-item="${escapeHtml(item.id)}">opinar</button>
  </article>`;
}

function groupWines(wines) {
  const tree = new Map();
  wines.forEach(wine => {
    const category = wine.category?.trim() || 'Otros';
    const varietal = wine.varietal?.trim() || 'Sin varietal';
    if (!tree.has(category)) tree.set(category, new Map());
    if (!tree.get(category).has(varietal)) tree.get(category).set(varietal, []);
    tree.get(category).get(varietal).push(wine);
  });
  return tree;
}

function wineHierarchy(wines, { catalog = false } = {}) {
  const tree = groupWines(wines);
  return `<div class="wine-tree ${catalog ? 'catalog-tree' : ''}">${[...tree].map(([category, varietals]) => `<section class="wine-category">
    <h3>${escapeHtml(category)}</h3>
    ${[...varietals].map(([varietal, items]) => `<div class="varietal-group"><h4>└ ${escapeHtml(varietal)}</h4>
      ${items.map((wine, index) => `<div class="wine-row"><span class="tree-branch">${index === items.length - 1 ? '└' : '├'}</span>${catalog ? `<button class="wine-label-link" data-route="#/vino/${escapeHtml(wine.catalogId)}">${escapeHtml(wine.name)}</button>` : `<strong>${escapeHtml(wine.name)}</strong>`}<span class="wine-score">${score(wine.average)}</span><span class="wine-opinions">${pluralOpinions(wine.reviews.length)}</span>${catalog ? '' : `<button class="bracket-action wine-review" type="button" data-type="wine" data-item="${escapeHtml(wine.id)}">opinar</button>`}</div>`).join('')}
    </div>`).join('')}
  </section>`).join('')}</div>`;
}

function photoStack(dinner) {
  const total = Math.max(1, dinner.dishes.length);
  return `<div class="photo-stack" role="img" aria-label="${total} fotografías de la cena"><div class="photo-print"></div><div class="photo-print"></div><div class="photo-print main">${foodDoodle}</div><span class="photo-count">1 / ${total}</span></div>`;
}

async function renderDetail(id) {
  showLoading('Abriendo la cena…');
  const dinner = await request(`/api/dinners/${id}`);
  app.innerHTML = `<div class="shell">
    <header class="detail-header"><button class="back-action" data-route="#/" aria-label="Volver al inicio">${icons.back}</button><h1 class="hand-title">Cena del ${escapeHtml(formatShortDate(dinner.date))}</h1><button class="header-calendar" data-route="#/calendario" aria-label="Ver en el calendario">${icons.calendar}</button>
      <div class="detail-meta"><time datetime="${dinner.date}">${icons.calendar}<span>${escapeHtml(formatDate(dinner.date))}</span></time><span>Estuvimos: ${dinner.guests.map(escapeHtml).join(' · ') || 'sin nombres anotados'}</span></div>
    </header>
    ${photoStack(dinner)}
    <section aria-labelledby="dishes-title"><h2 id="dishes-title" class="section-title">Lo que comimos</h2><div class="dish-list">${dinner.dishes.length ? dinner.dishes.map(dishRow).join('') : '<div class="empty-note">Todavía no sumamos platos.</div>'}</div></section>
    <section aria-labelledby="wines-title"><h2 id="wines-title" class="section-title">Lo que tomamos</h2>${dinner.wines.length ? wineHierarchy(dinner.wines) : '<div class="empty-note">Todavía no sumamos vinos.</div>'}</section>
    <button class="text-action add-item" type="button">+ sumar plato o vino</button>
    ${bottomNav('calendar')}
  </div>`;
  bindNavigation();
  app.querySelector('.add-item').addEventListener('click', () => itemForm(id));
  app.querySelectorAll('.review-button, .wine-review').forEach(button => {
    const items = button.dataset.type === 'wine' ? dinner.wines : dinner.dishes;
    button.addEventListener('click', () => reviewForm(id, items.find(item => item.id === button.dataset.item), button.dataset.type));
  });
}

function groupDinnersByMonth(dinners) {
  const years = new Map();
  [...dinners].sort((a, b) => b.date.localeCompare(a.date)).forEach(dinner => {
    const date = dateValue(dinner.date);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    if (!years.has(year)) years.set(year, new Map());
    if (!years.get(year).has(month)) years.get(year).set(month, []);
    years.get(year).get(month).push(dinner);
  });
  return years;
}

async function renderCalendar() {
  showLoading('Hojeando el calendario…');
  const dinners = (await request('/api/dinners')).filter(dinner => dinner.date <= new Date().toISOString().slice(0, 10));
  const years = groupDinnersByMonth(dinners);
  const content = years.size ? [...years].map(([year, months]) => `<section><h2 class="calendar-year">${year}</h2>${[...months].map(([month, entries]) => `<div class="month-group"><h3>${new Intl.DateTimeFormat('es-AR', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month, 1)))}</h3><div>${entries.map(dinner => `<button class="memory-link" data-route="#/cena/${escapeHtml(dinner.id)}"><time datetime="${dinner.date}">${dateValue(dinner.date).getUTCDate()}</time>${escapeHtml(dinner.title)}</button>`).join('')}</div></div>`).join('')}</section>`).join('') : '<div class="empty-note">Acá van a aparecer las cenas pasadas.<br>No se agendan cenas futuras.</div>';
  app.innerHTML = `<div class="shell"><header class="calendar-head"><button class="back-action" data-route="#/" aria-label="Volver">${icons.back}</button><h1 class="hand-title">Calendario</h1></header><p>Recuerdos, ordenados por fecha.</p>${content}${bottomNav('calendar')}</div>`;
  bindNavigation();
}

function buildCatalog(dinners) {
  const labels = new Map();
  dinners.forEach(dinner => dinner.wines.forEach(wine => {
    const category = wine.category?.trim() || 'Otros';
    const varietal = wine.varietal?.trim() || 'Sin varietal';
    const key = `${category}|${varietal}|${wine.name}`.toLowerCase();
    if (!labels.has(key)) labels.set(key, { catalogId: normalize(`${category}-${varietal}-${wine.name}`), category, varietal, name: wine.name, winery: wine.winery || '', reviews: [], occurrences: [] });
    const label = labels.get(key);
    label.reviews.push(...wine.reviews);
    label.occurrences.push({ dinnerId: dinner.id, dinnerTitle: dinner.title, date: dinner.date, itemId: wine.id, reviews: wine.reviews });
  }));
  return [...labels.values()].map(label => ({ ...label, average: label.reviews.length ? Number((label.reviews.reduce((sum, review) => sum + Number(review.score), 0) / label.reviews.length).toFixed(1)) : null }));
}

async function renderWineCatalog() {
  showLoading('Leyendo las etiquetas…');
  const dinners = await request('/api/dinners');
  const wines = buildCatalog(dinners);
  app.innerHTML = `<div class="shell"><header class="catalog-head"><button class="back-action" data-route="#/" aria-label="Volver">${icons.back}</button><h1 class="hand-title">Vinos</h1></header><p class="catalog-note">categoría → varietal → etiqueta</p>${wines.length ? wineHierarchy(wines, { catalog: true }) : '<div class="empty-note">Todavía no hay vinos anotados.</div>'}${bottomNav('wine')}</div>`;
  bindNavigation();
}

async function renderWineDetail(catalogId) {
  showLoading('Buscando la etiqueta…');
  const dinners = await request('/api/dinners');
  const wine = buildCatalog(dinners).find(item => item.catalogId === catalogId);
  if (!wine) throw new Error('No encontramos esa etiqueta.');
  app.innerHTML = `<div class="shell"><header class="wine-detail-head"><button class="back-action" data-route="#/vinos" aria-label="Volver a vinos">${icons.back}</button><h1 class="hand-title">${escapeHtml(wine.name)}</h1></header>
    <main class="wine-detail-sheet"><p class="wine-path">${escapeHtml(wine.category)} → ${escapeHtml(wine.varietal)} → ${escapeHtml(wine.name)}</p>${wine.winery ? `<p>Bodega: ${escapeHtml(wine.winery)}</p>` : ''}<p class="wine-big-score">${score(wine.average)}<small>${pluralOpinions(wine.reviews.length)}</small></p>
      <h2 class="section-title">Anotaciones</h2>${wine.reviews.length ? `<ul class="review-notes">${wine.reviews.map(review => `<li><q>${escapeHtml(review.comment || 'Sin comentario')}</q>— ${escapeHtml(review.author)} · ${score(review.score)}</li>`).join('')}</ul>` : '<div class="empty-note">Todavía no hay opiniones.</div>'}
      <h2 class="section-title">Apareció en</h2><ul class="dinner-appearances">${wine.occurrences.map(occurrence => `<li><a href="#/cena/${escapeHtml(occurrence.dinnerId)}">${escapeHtml(formatShortDate(occurrence.date))} — ${escapeHtml(occurrence.dinnerTitle)}</a></li>`).join('')}</ul>
    </main>${bottomNav('wine')}</div>`;
  bindNavigation();
}

async function router() {
  const hash = location.hash || '#/';
  try {
    const dinner = hash.match(/^#\/cena\/([^?]+)/);
    const wine = hash.match(/^#\/vino\/([^?]+)/);
    if (dinner) return await renderDetail(decodeURIComponent(dinner[1]));
    if (wine) return await renderWineDetail(decodeURIComponent(wine[1]));
    if (hash.startsWith('#/calendario')) return await renderCalendar();
    if (hash.startsWith('#/vinos')) return await renderWineCatalog();
    return await renderHome();
  } catch (problem) {
    app.innerHTML = `<div class="shell"><div class="error-note" role="alert"><p>${escapeHtml(problem.message)}</p><button class="text-action" data-route="#/">volver al inicio</button></div>${bottomNav('')}</div>`;
    bindNavigation();
  }
}

window.addEventListener('hashchange', router);
router();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(error => {
    console.warn('No se pudo registrar el service worker.', error);
  }));
}
