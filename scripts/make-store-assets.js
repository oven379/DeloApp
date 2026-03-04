/**
 * Создаёт все визуальные материалы для Google Play и App Store:
 * - Иконка 512×512 (Play), 1024×1024 (App Store)
 * - Картинка для описания (Play) 1024×500
 * - Скриншоты: Play (phone, tablet), App Store (iPhone 6.5", iPad Pro 13")
 *
 * Запуск: npm run store-assets (из папки frontend)
 * Результат: папка store-assets/ в корне проекта (родитель frontend).
 * iPad Pro 13": store-assets/app-store/ipad-pro-13/ (2048×2732 px) — для загрузки в App Store Connect.
 */
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(frontendRoot, '..');
const storeDir = path.join(projectRoot, 'store-assets');
const logoPath = path.join(frontendRoot, 'public', 'logo.png');
const screenshotsSrc = path.join(projectRoot, 'landing', 'screenshots');

const BG = { r: 0x1a, g: 0x1a, b: 0x1a };

// Телефон: 9:16, мин 320 по короткой стороне
const PHONE_SHORT = 1080;
const PHONE_LONG = 1920;

// Планшет 7": 16:9 или 9:16
const TAB7_SHORT = 1024;
const TAB7_LONG = 1820;

async function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function makeIcon512() {
  const outPath = path.join(storeDir, 'icon-512.png');
  const logoSize = Math.round(512 * 0.96);
  const resized = await sharp(logoPath)
    .resize(logoSize, logoSize, { fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();
  const meta = await sharp(resized).metadata();
  const w = meta.width || logoSize;
  const h = meta.height || logoSize;
  const left = Math.floor((512 - w) / 2);
  const top = Math.floor((512 - h) / 2);
  const darkBg = await sharp({
    create: { width: 512, height: 512, channels: 3, background: BG },
  }).png().toBuffer();
  await sharp(darkBg)
    .composite([{ input: resized, left, top }])
    .png()
    .toFile(outPath);
  console.log('  icon-512.png (512×512)');
}

async function makeIcon1024() {
  const outPath = path.join(storeDir, 'icon-1024.png');
  const logoSize = Math.round(1024 * 0.96);
  const resized = await sharp(logoPath)
    .resize(logoSize, logoSize, { fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();
  const meta = await sharp(resized).metadata();
  const w = meta.width || logoSize;
  const h = meta.height || logoSize;
  const left = Math.floor((1024 - w) / 2);
  const top = Math.floor((1024 - h) / 2);
  const darkBg = await sharp({
    create: { width: 1024, height: 1024, channels: 3, background: BG },
  }).png().toBuffer();
  await sharp(darkBg)
    .composite([{ input: resized, left, top }])
    .png()
    .toFile(outPath);
  console.log('  icon-1024.png (1024×1024, App Store)');
}

async function makeFeatureGraphic() {
  const outPath = path.join(storeDir, 'feature-graphic-1024x500.png');
  const logoSize = 280;
  const resized = await sharp(logoPath)
    .resize(logoSize, logoSize, { fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();
  const meta = await sharp(resized).metadata();
  const w = meta.width || logoSize;
  const h = meta.height || logoSize;
  const left = Math.floor((1024 - w) / 2);
  const top = Math.floor((500 - h) / 2) - 20;
  const darkBg = await sharp({
    create: { width: 1024, height: 500, channels: 3, background: BG },
  }).png().toBuffer();
  await sharp(darkBg)
    .composite([{ input: resized, left, top }])
    .png()
    .toFile(outPath);
  console.log('  feature-graphic-1024x500.png (1024×500)');
}

async function processScreenshots() {
  const phoneDir = path.join(storeDir, 'phone');
  await ensureDir(phoneDir);
  if (!fs.existsSync(screenshotsSrc)) {
    console.log('  (landing/screenshots/ не найдена — скриншоты создайте вручную)');
    return;
  }
  const files = fs.readdirSync(screenshotsSrc)
    .filter(f => (f.endsWith('.png') || f.endsWith('.jpg')) && !f.startsWith('_'));
  const darkFirst = files.filter(f => f.includes('dark')).slice(0, 4);
  const lightFirst = files.filter(f => f.includes('light')).slice(0, 4);
  const toProcess = [...new Set([...darkFirst, ...lightFirst])].slice(0, 8);
  if (toProcess.length === 0) toProcess.push(...files.slice(0, 8));
  for (let i = 0; i < toProcess.length; i++) {
    const src = path.join(screenshotsSrc, toProcess[i]);
    const dest = path.join(phoneDir, `screenshot-${i + 1}.png`);
    await resizeScreenshot(src, dest, 9/16, 320, 3840);
    const meta = await sharp(dest).metadata();
    console.log(`  phone/screenshot-${i + 1}.png (${meta.width}×${meta.height})`);
  }
}

async function resizeScreenshot(srcPath, destPath, ratio, minSide, maxSide) {
  const img = sharp(srcPath);
  const meta = await img.metadata();
  let w = meta.width || 1080;
  let h = meta.height || 1920;
  const srcRatio = w / h;
  let nw, nh;
  if (srcRatio > ratio) {
    nw = Math.min(w, maxSide);
    nh = Math.round(nw / ratio);
  } else {
    nh = Math.min(h, maxSide);
    nw = Math.round(nh * ratio);
  }
  if (Math.min(nw, nh) < minSide) {
    if (nw < nh) { nw = minSide; nh = Math.round(minSide / ratio); }
    else { nh = minSide; nw = Math.round(minSide * ratio); }
  }
  await sharp(srcPath)
    .resize(nw, nh, { fit: 'cover', position: 'center' })
    .png()
    .toFile(destPath);
}

async function processTabletScreenshots() {
  const phoneDir = path.join(storeDir, 'phone');
  const tab7Dir = path.join(storeDir, 'tablet-7');
  const tab10Dir = path.join(storeDir, 'tablet-10');
  if (!fs.existsSync(phoneDir)) return;
  const files = fs.readdirSync(phoneDir).filter(f => f.endsWith('.png'));
  if (files.length === 0) return;
  await ensureDir(tab7Dir);
  await ensureDir(tab10Dir);
  for (let i = 0; i < Math.min(files.length, 8); i++) {
    const src = path.join(phoneDir, files[i]);
    await resizeScreenshot(src, path.join(tab7Dir, files[i]), 9/16, 320, 3840);
    await resizeScreenshot(src, path.join(tab10Dir, files[i]), 9/16, 1080, 7680);
  }
  console.log(`  tablet-7/ (${Math.min(files.length, 8)} шт)`);
  console.log(`  tablet-10/ (${Math.min(files.length, 8)} шт)`);
}

// App Store: iPhone 6.5" — 1242×2688. Убираем шторку (статус-бар) — обрезка ~6% сверху.
async function processAppStoreScreenshots() {
  const outDir = path.join(storeDir, 'app-store', 'iphone-6.5');
  await ensureDir(outDir);
  if (!fs.existsSync(screenshotsSrc)) return;
  const files = fs.readdirSync(screenshotsSrc)
    .filter(f => (f.endsWith('.png') || f.endsWith('.jpg')) && !f.startsWith('_'));
  const darkFirst = files.filter(f => f.includes('dark')).slice(0, 5);
  const lightFirst = files.filter(f => f.includes('light')).slice(0, 5);
  const toProcess = [...new Set([...darkFirst, ...lightFirst])].slice(0, 10);
  if (toProcess.length === 0) toProcess.push(...files.slice(0, 10));
  const W = 1242, H = 2688;
  const CROP_TOP_PERCENT = 0.07;
  for (let i = 0; i < toProcess.length; i++) {
    const src = path.join(screenshotsSrc, toProcess[i]);
    const dest = path.join(outDir, `screenshot-${i + 1}.png`);
    const meta = await sharp(src).metadata();
    const srcH = meta.height || 1920;
    const cropTop = Math.round(srcH * CROP_TOP_PERCENT);
    const extractH = srcH - cropTop;
    await sharp(src)
      .extract({ left: 0, top: cropTop, width: meta.width || 1080, height: extractH })
      .resize(W, H, { fit: 'cover', position: 'top' })
      .png()
      .toFile(dest);
  }
  console.log(`  app-store/iphone-6.5/ (${toProcess.length} шт, 1242×2688, шторка убрана)`);
}

// App Store: iPad Pro 13" (12.9" 6th gen) — 2048×2732 (portrait), обязателен для выкладки
async function processAppStoreIpadPro13() {
  const outDir = path.join(storeDir, 'app-store', 'ipad-pro-13');
  await ensureDir(outDir);
  let srcDir = screenshotsSrc;
  if (!fs.existsSync(srcDir)) {
    srcDir = path.join(frontendRoot, 'public', 'screenshots');
  }
  if (!fs.existsSync(srcDir)) {
    console.warn('  app-store/ipad-pro-13: пропущено (нет landing/screenshots или frontend/public/screenshots)');
    return;
  }
  const files = fs.readdirSync(srcDir)
    .filter(f => (f.endsWith('.png') || f.endsWith('.jpg')) && !f.startsWith('_'));
  const darkFirst = files.filter(f => f.includes('dark')).slice(0, 5);
  const lightFirst = files.filter(f => f.includes('light')).slice(0, 5);
  const toProcess = [...new Set([...darkFirst, ...lightFirst])].slice(0, 10);
  if (toProcess.length === 0) toProcess.push(...files.slice(0, 10));
  if (toProcess.length === 0) {
    console.warn('  app-store/ipad-pro-13: нет PNG/JPG в папке скриншотов');
    return;
  }
  const W = 2048, H = 2732;
  const CROP_TOP_PERCENT = 0.07;
  for (let i = 0; i < toProcess.length; i++) {
    const src = path.join(srcDir, toProcess[i]);
    const dest = path.join(outDir, `screenshot-${i + 1}.png`);
    const meta = await sharp(src).metadata();
    const srcW = meta.width || 1080;
    const srcH = meta.height || 1920;
    const cropTop = Math.round(srcH * CROP_TOP_PERCENT);
    const extractH = srcH - cropTop;
    await sharp(src)
      .extract({ left: 0, top: cropTop, width: srcW, height: extractH })
      .resize(W, H, { fit: 'cover', position: 'top' })
      .png()
      .toFile(dest);
  }
  console.log(`  app-store/ipad-pro-13/ (${toProcess.length} шт, ${W}×${H}, iPad Pro 12.9" 6gen)`);
}

async function main() {
  console.log('Создание визуальных материалов для Google Play и App Store...\n');
  if (!fs.existsSync(logoPath)) {
    console.error('Не найден frontend/public/logo.png');
    process.exit(1);
  }
  await ensureDir(storeDir);
  await makeIcon512();
  await makeIcon1024();
  await makeFeatureGraphic();
  await processScreenshots();
  await processTabletScreenshots();
  await processAppStoreScreenshots();
  await processAppStoreIpadPro13();
  console.log('\nГотово! Папка: store-assets/');
  console.log('\nGoogle Play:');
  console.log('- icon-512.png, feature-graphic-1024x500.png, phone/');
  console.log('\nApp Store:');
  console.log('- icon-1024.png (1024×1024, PNG, без прозрачности)');
  console.log('- app-store/iphone-6.5/ (1242×2688 px, до 10 шт)');
  console.log('- app-store/ipad-pro-13/ (2048×2732 px, iPad Pro 13", обязателен для проверки)');
}

main().catch(err => { console.error(err); process.exit(1); });
