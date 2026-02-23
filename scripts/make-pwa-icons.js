/**
 * Генерирует иконки PWA из public/logo.png: тёмный фон #1a1a1a, логотип крупно по центру.
 */
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const logoPath = path.join(publicDir, 'logo.png');

const SIZES = [32, 192, 512];
const LOGO_RATIO = 0.96; // логотип почти на весь экран, без белых полей
const BG = { r: 0x1a, g: 0x1a, b: 0x1a };

async function makeCenteredIcon(size) {
  const logoSize = Math.round(size * LOGO_RATIO);
  const resized = await sharp(logoPath)
    .resize(logoSize, logoSize, { fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();
  const meta = await sharp(resized).metadata();
  const w = meta.width || logoSize;
  const h = meta.height || logoSize;
  const left = Math.floor((size - w) / 2);
  const top = Math.floor((size - h) / 2);
  const outPath = path.join(publicDir, `icon-${size}.png`);
  const darkBg = await sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: BG,
    },
  })
    .png()
    .toBuffer();
  await sharp(darkBg)
    .composite([{ input: resized, left, top }])
    .png()
    .toFile(outPath);
  console.log(`  icon-${size}.png (лого ${w}x${h} на ${size}x${size})`);
  return outPath;
}

console.log('Генерация центрированных иконок приложения из logo.png...');
for (const size of SIZES) {
  await makeCenteredIcon(size);
}
console.log('Готово: public/icon-32.png, icon-192.png, icon-512.png');
