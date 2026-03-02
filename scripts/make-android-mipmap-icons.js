/**
 * Генерирует PNG-иконки для Android (mipmap-*) из public/logo.png.
 * Логотип ~52% стороны, чтобы весь лого был виден в круге, фон #1a1a1a.
 */
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const resDir = path.join(root, 'android', 'app', 'src', 'main', 'res');
const logoPath = path.join(root, 'public', 'logo.png');

const DENSITIES = [
  { folder: 'mipmap-mdpi', size: 48 },
  { folder: 'mipmap-hdpi', size: 72 },
  { folder: 'mipmap-xhdpi', size: 96 },
  { folder: 'mipmap-xxhdpi', size: 144 },
  { folder: 'mipmap-xxxhdpi', size: 192 },
];

const BG_COLOR = { r: 0x1a, g: 0x1a, b: 0x1a };
const LOGO_RATIO = 0.52;

async function generateIcon(size) {
  const logoSize = Math.round(size * LOGO_RATIO);
  const resized = await sharp(logoPath)
    .resize(logoSize, logoSize, { fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();
  const meta = await sharp(resized).metadata();
  const w = meta.width || logoSize;
  const h = meta.height || logoSize;
  const padLeft = Math.floor((size - w) / 2);
  const padRight = size - w - padLeft;
  const padTop = Math.floor((size - h) / 2);
  const padBottom = size - h - padTop;
  return sharp(resized)
    .extend({
      top: padTop,
      bottom: padBottom,
      left: padLeft,
      right: padRight,
      background: BG_COLOR,
    })
    .png()
    .toBuffer();
}

console.log('Генерация mipmap-иконок из logo.png...');
for (const { folder, size } of DENSITIES) {
  const dir = path.join(resDir, folder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const buf = await generateIcon(size);
  const launcherPath = path.join(dir, 'ic_launcher.png');
  const roundPath = path.join(dir, 'ic_launcher_round.png');
  const foregroundPath = path.join(dir, 'ic_launcher_foreground.png');
  fs.writeFileSync(launcherPath, buf);
  fs.writeFileSync(roundPath, buf);
  fs.writeFileSync(foregroundPath, buf);
  console.log(`  ${folder}: ${size}px`);
}
console.log('Готово: ic_launcher.png, ic_launcher_round.png, ic_launcher_foreground.png во всех mipmap-*');
