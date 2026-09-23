import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'public/index.html',
  'public/app.js',
  'public/sw.js',
  'public/vendor/roughjs/rough.js',
  'public/vendor/roughjs/LICENSE',
  'public/manifest.webmanifest',
  'public/icons/apple-touch-icon.png',
  'public/icons/icon-192.png',
  'public/icons/icon-512.png',
  'public/styles.css',
  'public/styles/tokens.css',
  'public/styles/base.css',
  'public/styles/components.css',
  'public/styles/screens.css',
  'public/styles/forms.css',
  'public/assets/paper-texture.svg',
  'public/assets/fonts/covered-by-your-grace/CoveredByYourGrace.woff2',
  'public/assets/fonts/waiting-for-the-sunrise/WaitingfortheSunrise.woff2',
  'functions/api/dinners/index.js',
  'functions/api/dinners/[id]/index.js',
  'functions/api/dinners/[id]/items.js',
  'functions/api/dinners/[id]/reviews/[type]/[itemId].js',
  'lib/dinners-api.mjs',
  'migrations/0001_initial.sql',
  'migrations/0002_seed_existing_data.sql',
  'wrangler.toml'
];

for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Falta el activo de producción: ${file}`);
}

const publicFiles = required
  .filter(file => /\.(html|css|js)$/.test(file))
  .map(file => fs.readFileSync(path.join(root, file), 'utf8'))
  .join('\n');

if (/fonts\.googleapis|fonts\.gstatic|cdn\./i.test(publicFiles)) throw new Error('La interfaz depende de un activo externo.');
if (publicFiles.includes('Comic Sans')) throw new Error('Quedó un fallback tipográfico incompatible con la dirección visual.');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public/manifest.webmanifest'), 'utf8'));
if (manifest.name !== 'Tuve suerte' || manifest.display !== 'standalone' || manifest.start_url !== '/') {
  throw new Error('El manifest no conserva la identidad o el modo standalone esperados.');
}

for (const [file, expectedSize] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
  const png = fs.readFileSync(path.join(root, 'public/icons', file));
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  if (png.subarray(1, 4).toString() !== 'PNG' || width !== expectedSize || height !== expectedSize) {
    throw new Error(`El icono ${file} no es un PNG de ${expectedSize}x${expectedSize}.`);
  }
}

const index = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
for (const marker of ['manifest.webmanifest', 'apple-mobile-web-app-capable', 'apple-touch-icon.png']) {
  if (!index.includes(marker)) throw new Error(`Falta metadata PWA/iOS: ${marker}`);
}

const sourceFiles = ['lib/dinners-api.mjs', ...required.filter(file => file.startsWith('functions/'))]
  .map(file => fs.readFileSync(path.join(root, file), 'utf8'))
  .join('\n');
if (/fs\.writeFile|writeFile\(/.test(sourceFiles)) throw new Error('La API productiva intenta escribir en el filesystem.');

console.log(`Producción verificada: ${required.length} archivos, Functions, D1 y PWA.`);
