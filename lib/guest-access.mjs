import { json } from './dinners-api.mjs';

const encoder = new TextEncoder();
const cookieName = 'tuve_suerte_admin';
const cookieOptions = 'HttpOnly; Secure; SameSite=Strict; Path=/api/access; Max-Age=604800';
const encoded = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
const digest = async text => encoded(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
const secureToken = () => encoded(crypto.getRandomValues(new Uint8Array(32)));
const nowSeconds = () => Math.floor(Date.now() / 1000);

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return encoded(await crypto.subtle.sign('HMAC', key, encoder.encode(data)));
}
function equal(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
function cookie(request) {
  return (request.headers.get('cookie') || '').split(';').map(s => s.trim()).find(s => s.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
}
async function isAdmin(context) {
  const secret = context.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) return false;
  const value = cookie(context.request);
  if (!value) return false;
  const [expires, signature] = value.split('.');
  if (!/^\d+$/.test(expires) || Number(expires) <= nowSeconds() || !/^[a-f0-9]{64}$/.test(signature || '')) return false;
  return equal(signature, await hmac(secret, expires));
}
export async function currentGuest(context) {
  const token = context.request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/i)?.[1];
  if (!token || !context.env.DB) return null;
  return context.env.DB.prepare(`SELECT g.id, g.name FROM guest_devices d
    JOIN app_guests g ON g.id = d.guest_id
    WHERE d.token_hash = ? AND d.status = 'approved'`).bind(await digest(token)).first();
}
async function deviceStatus(context, token) {
  const row = await context.env.DB.prepare(`SELECT d.id, d.status, g.name FROM guest_devices d
    JOIN app_guests g ON g.id = d.guest_id WHERE d.token_hash = ?`).bind(await digest(token)).first();
  return row ? { status: row.status, name: row.name } : { status: 'unknown' };
}
const fail = (message, status) => json({ error: message }, status);
async function body(request) { try { return await request.json(); } catch { return {}; } }
async function adminRequired(context) { return (await isAdmin(context)) ? null : fail('Acceso de administrador requerido.', 401); }

export async function onAccessRequest(context) {
  try {
    if (!context.env.DB) return fail('Falta la base de datos.', 503);
    const url = new URL(context.request.url);
    const action = url.pathname.replace(/^\/api\/access\/?/, '').replace(/\/$/, '');
    const method = context.request.method;
    if (action === 'request' && method === 'POST') {
      const input = await body(context.request);
      const name = typeof input.name === 'string' ? input.name.trim().replace(/\s+/g, ' ') : '';
      const deviceLabel = typeof input.deviceLabel === 'string' ? input.deviceLabel.trim().slice(0, 100) : '';
      if (name.length < 2 || name.length > 70) return fail('Escribí un nombre de 2 a 70 caracteres.', 400);
      const guestId = crypto.randomUUID(), deviceId = crypto.randomUUID(), token = secureToken();
      await context.env.DB.batch([
        context.env.DB.prepare('INSERT INTO app_guests(id, name) VALUES (?, ?)').bind(guestId, name),
        context.env.DB.prepare('INSERT INTO guest_devices(id, guest_id, token_hash, device_label) VALUES (?, ?, ?, ?)').bind(deviceId, guestId, await digest(token), deviceLabel)
      ]);
      return json({ status: 'pending', token }, 201);
    }
    if (action === 'me' && method === 'GET') {
      const token = context.request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/i)?.[1];
      return json(token ? await deviceStatus(context, token) : { status: 'none' });
    }
    if (action === 'admin/login' && method === 'POST') {
      if (!context.env.ADMIN_PASSWORD || !context.env.ADMIN_SESSION_SECRET || context.env.ADMIN_SESSION_SECRET.length < 32)
        return fail('Configurá los secretos de administración.', 503);
      const input = await body(context.request);
      const supplied = typeof input.password === 'string' ? input.password : '';
      // HMAC comparison avoids timing differences in string comparison.
      const correct = equal(await hmac(context.env.ADMIN_SESSION_SECRET, supplied), await hmac(context.env.ADMIN_SESSION_SECRET, context.env.ADMIN_PASSWORD));
      if (!correct) return fail('Contraseña incorrecta.', 401);
      const expires = String(nowSeconds() + 604800);
      const signature = await hmac(context.env.ADMIN_SESSION_SECRET, expires);
      return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'set-cookie': `${cookieName}=${expires}.${signature}; ${cookieOptions}` } });
    }
    if (action === 'admin/logout' && method === 'POST') {
      return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json', 'set-cookie': `${cookieName}=; HttpOnly; Secure; SameSite=Strict; Path=/api/access; Max-Age=0` } });
    }
    if (action === 'admin/me' && method === 'GET') return json({ authenticated: await isAdmin(context) });
    if (action.startsWith('admin/')) {
      const denied = await adminRequired(context);
      if (denied) return denied;
      if (action === 'admin/devices' && method === 'GET') {
        const result = await context.env.DB.prepare(`SELECT d.id, d.status, d.device_label AS deviceLabel,
          d.created_at AS createdAt, g.name FROM guest_devices d JOIN app_guests g ON g.id = d.guest_id
          ORDER BY CASE d.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, d.created_at DESC`).all();
        return json(result.results);
      }
      const match = action.match(/^admin\/devices\/([a-f0-9-]{36})\/(approve|reject|revoke)$/);
      if (match && method === 'POST') {
        const [, id, change] = match;
        const expected = change === 'revoke' ? 'approved' : 'pending';
        const target = change === 'approve' ? 'approved' : change === 'reject' ? 'rejected' : 'revoked';
        const result = await context.env.DB.prepare('UPDATE guest_devices SET status = ?, decided_at = CURRENT_TIMESTAMP WHERE id = ? AND status = ?').bind(target, id, expected).run();
        return result.meta.changes ? json({ ok: true }) : fail('La solicitud ya no está en ese estado.', 409);
      }
    }
    return fail('Ruta no encontrada.', 404);
  } catch (error) {
    console.error(error);
    return fail('No se pudo completar la operación.', 500);
  }
}
