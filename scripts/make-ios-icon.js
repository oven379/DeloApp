/**
 * Генерирует иконку приложения для iOS (1024×1024) из public/logo.png.
 * Логотип по центру, занимает ~66% стороны — не обрезается на устройствах.
 */
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const logoPath = path.join(root, 'public', 'logo.png');
const outPath = path.join(root, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset', 'AppIcon-512@2x.png');

const SIZE = 1024;
const LOGO_RATIO = 0.66;

const logoSize = Math.round(SIZE * LOGO_RATIO);
const resized = await sharp(logoPath)
  .resize(logoSize, logoSize, { fit: 'inside', withoutEnlargement: true })
  .png()
  .toBuffer();
const meta = await sharp(resized).metadata();
const w = meta.width || logoSize;
const h = meta.height || logoSize;
const padLeft = Math.floor((SIZE - w) / 2);
const padRight = SIZE - w - padLeft;
const padTop = Math.floor((SIZE - h) / 2);
const padBottom = SIZE - h - padTop;

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

console.log('iOS App Icon:', outPath);
console.log('Готово. Логотип 66% от стороны, по центру.');
