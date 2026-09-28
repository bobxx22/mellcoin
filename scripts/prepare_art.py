"""
Готовит игровую графику из исходников в корне проекта.

Что делает:
  coin.jpeg   — снимает зелёный хромакей, убирает зелёную кайму по краям
  logo.jpeg   — снимает белый фон (внутренние просветы буквы тоже становятся
                прозрачными — так лого ложится на любой фон)
  *_cup.png   — уже с прозрачностью, только увеличиваем до 256px
  platinum/diamond — перекрашены из серебряного кубка

Результат: client/public/art/
Запуск: npm run art:prepare
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "client" / "public" / "art"
OUT.mkdir(parents=True, exist_ok=True)


def trim_to_content(img: Image.Image, pad_ratio: float = 0.01) -> Image.Image:
    """Обрезает прозрачные поля, оставляя небольшой отступ."""
    bbox = img.getchannel("A").getbbox()
    if not bbox:
        return img
    pad = int(max(img.size) * pad_ratio)
    left, top, right, bottom = bbox
    return img.crop(
        (
            max(0, left - pad),
            max(0, top - pad),
            min(img.width, right + pad),
            min(img.height, bottom + pad),
        )
    )


def key_out_green(path: Path, size: int) -> Image.Image:
    """
    Хромакей по зелёному.

    Альфа считается по тому, насколько пиксель «зелёный»: у зелени G заметно
    выше R и B. Дальше делаем despill — гасим зелёный отлив на полупрозрачных
    краях, иначе по контуру монеты останется салатовая кайма.
    """
    rgb = np.asarray(Image.open(path).convert("RGB"), dtype=np.float32)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]

    # Насколько зелёный доминирует над остальными каналами
    dominance = g - np.maximum(r, b)

    # Плавный переход: >90 — точно фон, <25 — точно объект
    alpha = np.clip((90.0 - dominance) / 65.0, 0.0, 1.0)

    # Despill: у краевых пикселей срезаем избыток зелёного
    spill = np.maximum(g - np.maximum(r, b), 0.0)
    g = g - spill * (1.0 - alpha) * 0.9

    # Компенсируем «примешанный» фон на полупрозрачных краях
    with np.errstate(divide="ignore", invalid="ignore"):
        safe = np.maximum(alpha, 1e-3)[..., None]
        stacked = np.stack([r, g, b], axis=-1)
        key = np.array([2.0, 252.0, 4.0], dtype=np.float32)
        unpremul = (stacked - key * (1.0 - alpha)[..., None]) / safe
    stacked = np.where(alpha[..., None] > 0.02, unpremul, stacked)

    out = np.concatenate(
        [np.clip(stacked, 0, 255), (alpha * 255)[..., None]], axis=-1
    ).astype(np.uint8)

    img = trim_to_content(Image.fromarray(out, "RGBA"))
    return img.resize((size, size), Image.LANCZOS)


def key_out_white(path: Path, size: int) -> Image.Image:
    """
    Снимает белый фон. Внутренние белые просветы буквы тоже уходят
    в прозрачность — логотип должен читаться на любом фоне.
    """
    rgb = np.asarray(Image.open(path).convert("RGB"), dtype=np.float32)

    # Насколько пиксель далёк от белого
    distance = (255.0 - rgb).max(axis=-1)
    alpha = np.clip((distance - 12.0) / 30.0, 0.0, 1.0)

    # Убираем белую примесь с антиалиасных краёв
    with np.errstate(divide="ignore", invalid="ignore"):
        safe = np.maximum(alpha, 1e-3)[..., None]
        unpremul = (rgb - 255.0 * (1.0 - alpha)[..., None]) / safe
    rgb = np.where(alpha[..., None] > 0.02, unpremul, rgb)

    out = np.concatenate(
        [np.clip(rgb, 0, 255), (alpha * 255)[..., None]], axis=-1
    ).astype(np.uint8)

    img = trim_to_content(Image.fromarray(out, "RGBA"), pad_ratio=0.02)
    return img.resize((size, size), Image.LANCZOS)


def upscale(path: Path, size: int) -> Image.Image:
    img = trim_to_content(Image.open(path).convert("RGBA"))
    return img.resize((size, size), Image.LANCZOS)


def recolor(base: Image.Image, dark: str, mid: str, light: str) -> Image.Image:
    """
    Перекрашивает кубок: берём светлоту серебряного (он нейтральный,
    поэтому переносится чище всего) и раскрашиваем градиентом металла.
    Альфа остаётся исходной.
    """
    alpha = base.getchannel("A")
    luminance = ImageOps.grayscale(base.convert("RGB"))
    # Растягиваем контраст, иначе перекрашенный металл выходит плоским
    luminance = ImageOps.autocontrast(luminance, cutoff=1)
    tinted = ImageOps.colorize(luminance, black=dark, mid=mid, white=light)
    tinted = tinted.convert("RGBA")
    tinted.putalpha(alpha)
    return tinted


def main() -> None:
    coin = key_out_green(ROOT / "coin.jpeg", 512)
    coin.save(OUT / "coin.png", optimize=True)
    coin.resize((128, 128), Image.LANCZOS).save(OUT / "coin-small.png", optimize=True)
    print(f"  coin.png        {coin.size}")

    logo = key_out_white(ROOT / "logo.jpeg", 512)
    logo.save(OUT / "logo.png", optimize=True)
    print(f"  logo.png        {logo.size}")

    cups = {}
    for name, src in (
        ("bronze", "bronze_cup.png"),
        ("silver", "silver_cup.png"),
        ("gold", "gold_cup.png"),
    ):
        img = upscale(ROOT / src, 256)
        img.save(OUT / f"cup-{name}.png", optimize=True)
        cups[name] = img
        print(f"  cup-{name}.png{' ' * (7 - len(name))}{img.size}")

    # Платина — жемчужная, с лёгким сиреневым отливом.
    # Алмаз — насыщенно-голубой, чтобы две верхние лиги не сливались.
    for name, (dark, mid, light) in {
        "platinum": ("#5b5a78", "#c9c6de", "#fdfbff"),
        "diamond": ("#12649f", "#5cc8ff", "#e2f8ff"),
    }.items():
        img = recolor(cups["silver"], dark, mid, light)
        img.save(OUT / f"cup-{name}.png", optimize=True)
        print(f"  cup-{name}.png  {img.size}  (перекрашен из серебряного)")


if __name__ == "__main__":
    main()
