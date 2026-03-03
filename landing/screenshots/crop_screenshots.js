/**
 * Обрезка скриншотов под соотношение экрана 9:19.5 для ровного отображения в рамках.
 * Запуск: npx sharp-cli не подходит под crop по ratio, поэтому используем sharp в коде.
 * Запуск: node crop_screenshots.js (предварительно: npm install sharp)
 */
const fs = require('fs');
const path = require('path');

const SCREEN_RATIO = 9 / 19.5;
const DIR = __dirname;

async function run() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch (_) {
    console.log('Установите sharp: npm install sharp');
    process.exit(1);
  }
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.png') && !f.startsWith('_'));
  for (const name of files.sort()) {
    const filePath = path.join(DIR, name);
    const meta = await sharp(filePath).metadata();
    const w = meta.width;
    const h = meta.height;
    const currentRatio = w / h;
    let left = 0, top = 0, width = w, height = h;
    if (Math.abs(currentRatio - SCREEN_RATIO) < 0.001) {
      console.log('OK (без изменений):', name);
      continue;
    }
    if (currentRatio > SCREEN_RATIO) {
      width = Math.round(h * SCREEN_RATIO);
      left = Math.round((w - width) / 2);
    } else {
      height = Math.round(w / SCREEN_RATIO);
      top = Math.round((h - height) / 2);
    }
    await sharp(filePath)
      .extract({ left, top, width, height })
      .toFile(filePath + '.tmp');
    fs.renameSync(filePath + '.tmp', filePath);
    console.log('OK:', name, '->', width + 'x' + height);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
