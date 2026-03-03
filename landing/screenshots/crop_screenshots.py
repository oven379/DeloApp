"""
Обрезка скриншотов под соотношение экрана телефона 9:19.5
для ровного отображения в рамках на лендинге.
Центральная обрезка — сохраняется середина изображения.
"""
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Установите Pillow: pip install Pillow")
    raise

SCREEN_RATIO = 9 / 19.5  # соотношение экрана в мокапе
SCREENSHOTS_DIR = Path(__file__).resolve().parent


def crop_to_ratio(img: Image.Image, ratio: float) -> Image.Image:
    w, h = img.size
    current_ratio = w / h
    if abs(current_ratio - ratio) < 0.001:
        return img
    if current_ratio > ratio:
        # картинка шире — обрезаем по бокам
        new_w = int(h * ratio)
        left = (w - new_w) // 2
        return img.crop((left, 0, left + new_w, h))
    else:
        # картинка выше — обрезаем сверху и снизу
        new_h = int(w / ratio)
        top = (h - new_h) // 2
        return img.crop((0, top, w, top + new_h))


def main():
    for path in sorted(SCREENSHOTS_DIR.glob("*.png")):
        if path.name.startswith("_"):
            continue
        try:
            img = Image.open(path).convert("RGB")
            cropped = crop_to_ratio(img, SCREEN_RATIO)
            cropped.save(path, "PNG", optimize=True)
            print(f"OK: {path.name} -> {cropped.size[0]}x{cropped.size[1]}")
        except Exception as e:
            print(f"Ошибка {path.name}: {e}")


if __name__ == "__main__":
    main()
