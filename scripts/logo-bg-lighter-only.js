/**
 * Делает только подложку (фон) чуть светлее. Остальное не меняет.
 * Использование: node scripts/logo-bg-lighter-only.js [входной.png] [выходной.png]
 */
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const inputPath = process.argv[2] || path.join(root, 'public', 'logo.png');
const outputPath = process.argv[3] || path.join(root, 'public', 'logo.png');

// Подложка чуть светлее (тёмно-серый вместо почти чёрного)
const BG_R = 0x2e, BG_G = 0x2e, BG_B = 0x2e;

function luminance(r, g, b) {
  return (0.299 * r + 0.587 * g + 0.114 * b) | 0;
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

    if (isDarkBackground(r, g, b)) {
      data[i] = BG_R;
      data[i + 1] = BG_G;
      data[i + 2] = BG_B;
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
