/**
 * Усиливает видимость белого текста «Дело» на логотипе:
 * контраст и яркость без изменения структуры (размеров, композиции).
 * Использование: node scripts/enhance-logo.js [входной.png] [выходной.png]
 */
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const inputPath = process.argv[2] || path.join(root, 'public', 'logo.png');
const outputPath = process.argv[3] || path.join(root, 'public', 'logo.png');

async function main() {
  await sharp(inputPath)
    // Усиление контраста — белый текст «Дело» становится ярче на тёмном фоне
    .linear(1.25, -(0.12 * 255))
    // Лёгкая яркость — лучше читаемость мела
    .modulate({ brightness: 1.08 })
    .png()
    .toFile(outputPath);
  console.log('Готово:', outputPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
