const app = document.querySelector('#app');
const modal = document.querySelector('#modal');
const toast = document.querySelector('#toast');

const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
const formatDate = value => new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
const formatShortDate = value => new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
const score = value => value == null ? '—' : Number(value).toLocaleString('es-AR', { maximumFractionDigits: 1 });

const faceDoodle = `<svg viewBox="0 0 160 160" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M81 7c42 0 69 27 69 67 0 44-26 76-69 76S10 119 10 77C10 35 39 7 81 7Z"/><path d="M55 50c5-5 13-5 19-1m18 0c7-4 15-3 20 2M68 67c0 3-2 5-5 5s-5-2-5-5 2-5 5-5 5 2 5 5Zm39 0c0 3-2 5-5 5s-5-2-5-5 2-5 5-5 5 2 5 5ZM81 64c0 18-9 24-9 33 0 5 4 8 10 8m-24 18c14-7 30-7 44 0"/></g></svg>`;
const foodDoodle = `<svg class="food-doodle" viewBox="0 0 180 120" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="90" cy="72" rx="73" ry="34"/><ellipse cx="90" cy="67" rx="58" ry="23"/><path d="M48 67c17-28 65-31 87 0M50 60c18 17 58-15 82 8M53 72c20-19 54 15 77-6M60 52c5 11 13 14 22 3m15-6c1 11 10 14 18 5"/><circle cx="68" cy="63" r="6"/><circle cx="111" cy="61" r="7"/><path d="M83 43c3-10 11-16 20-17-3 7-8 12-17 14m4 3c-5-8-12-12-20-11 4 7 10 11 20 11Z"/></g></svg>`;
const calendarIcon = `<svg viewBox="0 0 48 48" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="7" y="10" width="34" height="31" rx="3"/><path d="M15 4v12M33 4v12M8 20h32"/></g></svg>`;
const bottomNav = active => `<nav class="bottom-nav" aria-label="Navegación principal">
  <button class="nav-button ${active === 'home' ? 'active' : ''}" data-nav="home" aria-label="Inicio"><svg viewBox="0 0 48 48"><path class="fill" d="M7 23 24 7l17 16v18H29V29H19v12H7Z"/></svg></button>
  <button class="nav-button inactive ${active === 'calendar' ? 'active' : ''}" type="button" aria-label="Agenda — próximamente"><svg viewBox="0 0 48 48"><rect class="fill" x="8" y="10" width="32" height="32" rx="3"/><path d="M16 4v12M32 4v12M9 20h30"/></svg></button>
  <button class="nav-button inactive ${active === 'wine' ? 'active' : ''}" type="button" aria-label="Vinos — próximamente"><svg viewBox="0 0 48 48"><path class="fill" d="M20 3h8l-1 10c0 4 7 6 7 13v19H14V26c0-7 7-9 7-13Z"/><path d="M20 8h8M15 28h18v12H15Z"/></svg></button>
</nav>`;

async function request(url, options) {
  const response = await fetch(url, { headers: { 'content-type': 'application/json' }, ...options });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'No se pudo completar la acción.');
  return payload;
}

function notify(message) {
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

function openModal(title, content, onSubmit) {
  modal.innerHTML = `<div class="modal-head"><h2>${escapeHtml(title)}</h2><button class="close" aria-label="Cerrar">×</button></div>${content}`;
  modal.querySelector('.close').onclick = () => modal.close();
  modal.querySelector('form').onsubmit = async event => {
    event.preventDefault();
    const submit = event.currentTarget.querySelector('[type=submit]');
    submit.disabled = true;
    try { await onSubmit(new FormData(event.currentTarget)); modal.close(); }
    catch (error) { notify(error.message); submit.disabled = false; }
  };
  modal.showModal();
}

function dinnerForm() {
  openModal('Registrar una cena', `<form>
    <label>Nombre de la cena<input name="title" required placeholder="Fideos caseros"></label>
    <label>Fecha<input type="date" name="date" required></label>
    <label>¿Quiénes estuvieron?<input name="guests" placeholder="Jo, Lu, Valen"><small>Separá los nombres con comas.</small></label>
    <button class="primary" type="submit">Guardar cena</button>
  </form>`, async data => {
    const dinner = await request('/api/dinners', { method: 'POST', body: JSON.stringify({ title: data.get('title'), date: data.get('date'), guests: data.get('guests').split(',') }) });
    location.hash = `#/cena/${dinner.id}`;
    notify('Cena registrada');
  });
}

function homeCard(dinner) {
  const plates = Math.max(1, Math.min(3, dinner.dishes.length));
  return `<button class="dinner-card" data-id="${escapeHtml(dinner.id)}">
    <div><h2>${escapeHtml(dinner.title)}</h2><div class="dish-stack">${Array.from({length: plates}, (_, index) => `<span class="dish-sheet">${index === 0 ? foodDoodle : index + 1}</span>`).join('')}</div></div>
    <div class="card-meta"><time datetime="${dinner.date}">${escapeHtml(formatShortDate(dinner.date))}</time><ul class="guests">${dinner.guests.map(guest => `<li>${escapeHtml(guest)}</li>`).join('')}</ul></div>
  </button>`;
}

async function renderHome() {
  app.innerHTML = '<div class="shell loading">Preparando la mesa…</div>';
  const dinners = await request('/api/dinners');
  app.innerHTML = `<div class="shell">
    <header class="home-header"><div class="face">${faceDoodle}</div></header>
    <button class="new-dinner"><span class="plus-circle">+</span><span>Tuve suerte</span></button>
    <section aria-label="Cenas anteriores" style="margin-top:34px"><div class="list">${dinners.length ? dinners.map(homeCard).join('') : '<p class="empty">Todavía no registramos ninguna cena.</p>'}</div></section>
    ${bottomNav('home')}
  </div>`;
  app.querySelector('.new-dinner').onclick = dinnerForm;
  app.querySelector('[data-nav="home"]').onclick = () => {};
  app.querySelectorAll('.dinner-card').forEach(card => card.onclick = () => location.hash = `#/cena/${card.dataset.id}`);
}

function dishCard(item, index) {
  const review = index === 0 ? item.reviews.find(entry => entry.comment) : null;
  return `<article class="item dish-item">
    <div><h3>${escapeHtml(item.name)}</h3>${review ? `<p class="review">“${escapeHtml(review.comment)}” <span>— ${escapeHtml(review.author)}</span></p>` : ''}</div>
    <div class="score">${score(item.average)}<small>${item.reviews.length} ${item.reviews.length === 1 ? 'opinión' : 'opiniones'}</small></div>
    <button class="secondary review-button" data-type="dish" data-item="${escapeHtml(item.id)}"><span class="mini-plus">+</span> Opinar</button>
  </article>`;
}

function wineHierarchy(wines) {
  const tree = new Map();
  wines.forEach(wine => {
    const category = wine.category?.trim() || 'Otros';
    const varietal = wine.varietal?.trim() || 'Sin varietal';
    if (!tree.has(category)) tree.set(category, new Map());
    if (!tree.get(category).has(varietal)) tree.get(category).set(varietal, []);
    tree.get(category).get(varietal).push(wine);
  });
  return `<div class="wine-tree">${[...tree].map(([category, varietals]) => `<section class="wine-category">
    <h3>${escapeHtml(category)}</h3>
    ${[...varietals].map(([varietal, items]) => `<div class="varietal-group"><h4><span>└</span> ${escapeHtml(varietal)}</h4>
      ${items.map((wine, index) => `<div class="wine-row"><span class="tree-line">${index === items.length - 1 ? '└' : '├'}</span><strong>${escapeHtml(wine.name)}</strong><span class="wine-score">${score(wine.average)}</span><span class="wine-opinions">${wine.reviews.length} ${wine.reviews.length === 1 ? 'opinión' : 'opiniones'}</span><button class="secondary wine-review" data-type="wine" data-item="${escapeHtml(wine.id)}"><span class="mini-plus">+</span> Opinar</button></div>`).join('')}
    </div>`).join('')}
  </section>`).join('')}</div>`;
}

function reviewForm(dinnerId, item, type) {
  openModal(`Opinar sobre ${item.name}`, `<form>
    <label>Tu nombre<input name="author" required placeholder="Jo"></label>
    <label>Nota del 1 al 10<input type="number" name="score" required min="1" max="10" step="0.1" inputmode="decimal"></label>
    <label>Comentario<textarea name="comment" placeholder="¿Qué te pareció?"></textarea></label>
    <button class="primary" type="submit">Publicar opinión</button>
  </form>`, async data => {
    await request(`/api/dinners/${dinnerId}/reviews/${type}/${item.id}`, { method: 'POST', body: JSON.stringify(Object.fromEntries(data)) });
    notify('Opinión publicada');
    await renderDetail(dinnerId);
  });
}

function itemForm(dinnerId) {
  openModal('Sumar plato o vino', `<form>
    <label>¿Qué querés sumar?<select name="type"><option value="dish">Un plato</option><option value="wine">Un vino</option></select></label>
    <label>Nombre<input name="name" required placeholder="Fideos con salsa de hongos"></label>
    <div class="wine-fields hidden"><label>Tipo<select name="category"><option>Tintos</option><option>Blancos</option><option>Rosados</option><option>Espumosos</option></select></label><label>Bodega<input name="winery" placeholder="Patrillos"></label><label>Varietal<input name="varietal" placeholder="Malbec"></label></div>
    <button class="primary" type="submit">Sumar a la cena</button>
  </form>`, async data => {
    await request(`/api/dinners/${dinnerId}/items`, { method: 'POST', body: JSON.stringify(Object.fromEntries(data)) });
    notify('Agregado a la cena');
    await renderDetail(dinnerId);
  });
  const select = modal.querySelector('select');
  select.onchange = () => modal.querySelector('.wine-fields').classList.toggle('hidden', select.value !== 'wine');
}

async function renderDetail(id) {
  app.innerHTML = '<div class="shell loading">Sirviendo la cena…</div>';
  let dinner;
  try { dinner = await request(`/api/dinners/${id}`); }
  catch { location.hash = '#/'; return; }
  const totalItems = dinner.dishes.length;
  app.innerHTML = `<div class="shell">
    <header class="detail-header"><button class="back" aria-label="Volver">←</button><button class="calendar-ghost" aria-label="Agenda — próximamente">${calendarIcon}</button><h1>Cena del ${escapeHtml(formatShortDate(dinner.date))}</h1><div class="detail-meta"><time datetime="${dinner.date}">${calendarIcon} ${escapeHtml(formatDate(dinner.date))}</time><span>Estuvimos: ${dinner.guests.map(escapeHtml).join(' · ') || 'Juan'}</span></div></header>
    <div class="hero-stack" aria-hidden="true"><div class="hero-sheet"></div><div class="hero-sheet"></div><div class="hero-sheet main">${foodDoodle}</div><span class="hero-count">1 / ${Math.max(1, totalItems)}</span></div>
    <section><h2 class="section-title">Lo que comimos</h2><div class="item-list dish-list">${dinner.dishes.length ? dinner.dishes.map(dishCard).join('') : '<p class="empty">Todavía no sumamos platos.</p>'}</div></section>
    <section><h2 class="section-title">Lo que tomamos</h2>${dinner.wines.length ? wineHierarchy(dinner.wines) : '<p class="empty">Todavía no sumamos vinos.</p>'}</section>
    <button class="secondary add-item">＋ Sumar plato o vino</button>
    ${bottomNav('calendar')}
  </div>`;
  app.querySelector('.back').onclick = () => location.hash = '#/';
  app.querySelector('[data-nav="home"]').onclick = () => location.hash = '#/';
  app.querySelector('.add-item').onclick = () => itemForm(id);
  app.querySelectorAll('.review-button, .wine-review').forEach(button => {
    const list = button.dataset.type === 'wine' ? dinner.wines : dinner.dishes;
    button.onclick = () => reviewForm(id, list.find(item => item.id === button.dataset.item), button.dataset.type);
  });
}

async function router() {
  const match = location.hash.match(/^#\/cena\/(.+)$/);
  try { match ? await renderDetail(match[1]) : await renderHome(); }
  catch (error) { app.innerHTML = `<div class="shell"><p class="empty">${escapeHtml(error.message)}</p></div>`; }
}

window.addEventListener('hashchange', router);
router();
