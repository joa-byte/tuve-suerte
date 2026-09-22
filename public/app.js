const app = document.querySelector('#app');
const modal = document.querySelector('#modal');
const toast = document.querySelector('#toast');

const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
const formatDate = value => new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
const formatShortDate = value => new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
const score = value => value == null ? '—' : Number(value).toLocaleString('es-AR', { maximumFractionDigits: 1 });

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
    <div><h2>${escapeHtml(dinner.title)}</h2><div class="dish-stack">${Array.from({length: plates}, (_, index) => `<span>${index === 0 ? '🍝' : index + 1}</span>`).reverse().join('')}</div></div>
    <div class="card-meta"><time datetime="${dinner.date}">${escapeHtml(formatShortDate(dinner.date))}</time><ul class="guests">${dinner.guests.map(guest => `<li>${escapeHtml(guest)}</li>`).join('')}</ul></div>
  </button>`;
}

async function renderHome() {
  app.innerHTML = '<div class="shell loading">Preparando la mesa…</div>';
  const dinners = await request('/api/dinners');
  app.innerHTML = `<div class="shell">
    <header class="home-header"><div class="face" aria-hidden="true">☻</div><div><p class="eyebrow">El diario de las cenas de Juan</p><h1>Tuve suerte</h1></div></header>
    <button class="primary new-dinner">＋ Registrar una cena</button>
    <section aria-label="Cenas anteriores" style="margin-top:28px"><p class="eyebrow">Cenas anteriores</p><div class="list">${dinners.length ? dinners.map(homeCard).join('') : '<p class="empty">Todavía no registramos ninguna cena.</p>'}</div></section>
  </div>`;
  app.querySelector('.new-dinner').onclick = dinnerForm;
  app.querySelectorAll('.dinner-card').forEach(card => card.onclick = () => location.hash = `#/cena/${card.dataset.id}`);
}

function itemCard(item, type) {
  const reviews = item.reviews.filter(review => review.comment).slice(0, 2);
  const title = type === 'wine' ? `${item.name}${item.varietal ? ` · ${item.varietal}` : ''}` : item.name;
  return `<article class="item">
    <div><h3 class="${type === 'wine' ? 'wine-name' : ''}">${escapeHtml(title)}</h3>${reviews.map(review => `<p class="review">“${escapeHtml(review.comment)}”<span>— ${escapeHtml(review.author)}</span></p>`).join('') || '<p class="review">Todavía no hay comentarios.</p>'}</div>
    <div class="score">${score(item.average)}<small>${item.reviews.length} ${item.reviews.length === 1 ? 'opinión' : 'opiniones'}</small></div>
    <button class="secondary review-button" data-type="${type}" data-item="${escapeHtml(item.id)}">＋ Opinar</button>
  </article>`;
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
    <div class="wine-fields hidden"><label>Bodega<input name="winery" placeholder="Patrillos"></label><label>Varietal<input name="varietal" placeholder="Malbec"></label></div>
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
  const totalItems = dinner.dishes.length + dinner.wines.length;
  app.innerHTML = `<div class="shell">
    <header class="detail-header"><button class="icon-button back" aria-label="Volver">←</button><h1>${escapeHtml(dinner.title)}</h1><div class="detail-meta"><time datetime="${dinner.date}">▣ ${escapeHtml(formatDate(dinner.date))}</time><span><strong>Estuvimos:</strong> ${dinner.guests.map(escapeHtml).join(' · ') || 'Juan'}</span></div></header>
    <div class="hero-stack" aria-hidden="true"><div class="hero-card">🍝</div><span class="hero-count">1 / ${Math.max(1, totalItems)}</span></div>
    <section><h2 class="section-title">Lo que comimos</h2><div class="item-list">${dinner.dishes.length ? dinner.dishes.map(item => itemCard(item, 'dish')).join('') : '<p class="empty">Todavía no sumamos platos.</p>'}</div></section>
    <section><h2 class="section-title">Lo que tomamos</h2><div class="item-list">${dinner.wines.length ? dinner.wines.map(item => itemCard(item, 'wine')).join('') : '<p class="empty">Todavía no sumamos vinos.</p>'}</div></section>
    <button class="secondary add-item">＋ Sumar plato o vino</button>
  </div>`;
  app.querySelector('.back').onclick = () => location.hash = '#/';
  app.querySelector('.add-item').onclick = () => itemForm(id);
  app.querySelectorAll('.review-button').forEach(button => {
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
