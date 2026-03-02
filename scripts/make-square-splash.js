/**
 * Генерирует квадратный splash.png из public/logo.png с гарантированным
 * центрированием логотипа (прозрачные поля по всем сторонам).
 * Записывает в drawable/splash.png и копирует во все drawable-* папки.
 */
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const resDir = path.join(root, 'android', 'app', 'src', 'main', 'res');
const logoPath = path.join(root, 'public', 'logo.png');
const outPath = path.join(resDir, 'drawable', 'splash.png');
const size = 512;
// Максимальный размер логотипа внутри холста (меньше = лого мельче, весь виден на иконке)
const logoMaxSize = 260;

const meta = await sharp(logoPath).metadata();
console.log(`Logo: ${meta.width}x${meta.height} → square ${size}x${size} (centered)`);

// Шаг 1: вписать логотип в logoMaxSize×logoMaxSize с сохранением пропорций
const resized = await sharp(logoPath)
  .resize(logoMaxSize, logoMaxSize, {
    fit: 'inside',
    withoutEnlargement: true,
  })
  .png()
  .toBuffer();

const resizedMeta = await sharp(resized).metadata();
const w = resizedMeta.width || size;
const h = resizedMeta.height || size;

// Шаг 2: вычислить равные отступы и расширить до 512×512 — логотип строго по центру
const padLeft = Math.floor((size - w) / 2);
const padRight = size - w - padLeft;
const padTop = Math.floor((size - h) / 2);
const padBottom = size - h - padTop;

await sharp(resized)
  .extend({
    top: padTop,
    bottom: padBottom,
    left: padLeft,
    right: padRight,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toFile(outPath);

console.log('Written:', outPath, `(padding L:${padLeft} R:${padRight} T:${padTop} B:${padBottom})`);

const dirs = fs.readdirSync(resDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name.startsWith('drawable'))
  .map((d) => path.join(resDir, d.name));
for (const dir of dirs) {
  const dest = path.join(dir, 'splash.png');
  if (dir !== path.dirname(outPath)) {
    fs.copyFileSync(outPath, dest);
    console.log('Copied:', path.relative(resDir, dest));
  }
}
