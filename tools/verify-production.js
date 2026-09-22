const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const required = [
  'public/index.html',
  'public/app.js',
  'public/styles.css',
  'public/styles/tokens.css',
  'public/styles/base.css',
  'public/styles/components.css',
  'public/styles/screens.css',
  'public/styles/forms.css',
  'public/assets/paper-texture.svg',
  'public/assets/fonts/covered-by-your-grace/CoveredByYourGrace.woff2',
  'public/assets/fonts/waiting-for-the-sunrise/WaitingfortheSunrise.woff2'
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

console.log(`Producción verificada: ${required.length} archivos y fuentes locales.`);
