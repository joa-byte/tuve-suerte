import test from 'node:test';
import assert from 'node:assert/strict';
import { onAccessRequest, currentGuest } from '../lib/guest-access.mjs';

const makeRequest = (path, method = 'GET', data = null, headers = {}) =>
  new Request('https://example.pages.dev/api/access/' + path, {
    method, headers: { ...(data ? { 'content-type': 'application/json' } : {}), ...headers },
    ...(data ? { body: JSON.stringify(data) } : {})
  });

test('an anonymous browser is not authorized to comment', async () => {
  assert.equal(await currentGuest({ request: makeRequest('me'), env: {} }), null);
});

test('admin panel denies access without an authenticated cookie', async () => {
  const response = await onAccessRequest({
    request: makeRequest('admin/devices'),
    env: { DB: {}, ADMIN_SESSION_SECRET: 'long-secret-for-testing-only-1234567890' }
  });
  assert.equal(response.status, 401);
});

test('admin login fails when configuration is missing', async () => {
  const response = await onAccessRequest({
    request: makeRequest('admin/login', 'POST', { password: 'anything' }),
    env: { DB: {} }
  });
  assert.equal(response.status, 503);
});

test('admin login rejects wrong password and sets a secure cookie on success', async () => {
  const env = { DB: {}, ADMIN_PASSWORD: 'correct-password', ADMIN_SESSION_SECRET: 'long-secret-for-testing-only-1234567890' };
  const bad = await onAccessRequest({ request: makeRequest('admin/login', 'POST', { password: 'wrong' }), env });
  assert.equal(bad.status, 401);
  const good = await onAccessRequest({ request: makeRequest('admin/login', 'POST', { password: 'correct-password' }), env });
  assert.equal(good.status, 200);
  assert.match(good.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=Strict/);
  const cookie = good.headers.get('set-cookie').split(';')[0];
  const status = await onAccessRequest({ request: makeRequest('admin/me', 'GET', null, { cookie }), env });
  assert.deepEqual(await status.json(), { authenticated: true });
});

test('device request checks the name before writing', async () => {
  const response = await onAccessRequest({
    request: makeRequest('request', 'POST', { name: 'x' }),
    env: { DB: {} }
  });
  assert.equal(response.status, 400);
});
