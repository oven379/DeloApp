/**
 * Линии (под словом «Дело» и под ним) — делаем серыми.
 * Фон логотипа — делаем светлее.
 * Слово «Дело» и зелёная галочка не меняем.
 *
 * Использование: node scripts/logo-lines-gray-bg-light.js [входной.png] [выходной.png]
 */
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const inputPath = process.argv[2] || path.join(root, 'public', 'logo.png');
const outputPath = process.argv[3] || path.join(root, 'public', 'logo.png');

// Целевой цвет фона (светло-серый вместо чёрного)
const BG_R = 0x42, BG_G = 0x42, BG_B = 0x42;
// Цвет линий (серый вместо белого)
const LINE_R = 0x88, LINE_G = 0x88, LINE_B = 0x88;

function luminance(r, g, b) {
  return (0.299 * r + 0.587 * g + 0.114 * b) | 0;
}

function isGreen(r, g, b) {
  return g > r + 30 && g > b + 30;
}

function isWhiteOrLightGray(r, g, b) {
  const L = luminance(r, g, b);
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  return L >= 140 && spread <= 80;
}

function isDarkBackground(r, g, b) {
  return luminance(r, g, b) < 100;
}

async function main() {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const n = width * height * channels;

  for (let i = 0; i < n; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const y = Math.floor((i / channels) / width);

    if (isGreen(r, g, b)) continue;

    if (isDarkBackground(r, g, b)) {
      data[i] = BG_R;
      data[i + 1] = BG_G;
      data[i + 2] = BG_B;
      continue;
    }

    // Серыми делаем линии: подчёркивание под «Дело» и линии списка (нижние ~65% по высоте)
    const isLineZone = y >= height * 0.30;
    if (isLineZone && isWhiteOrLightGray(r, g, b)) {
      data[i] = LINE_R;
      data[i + 1] = LINE_G;
      data[i + 2] = LINE_B;
    }
  }

  await sharp(data, {
    raw: { width, height, channels },
  })
    .png()
    .toFile(outputPath);

  console.log('Готово:', outputPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
