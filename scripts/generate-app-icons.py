"""Generate Nudgenda launcher assets from the approved brand illustration."""

from pathlib import Path

from PIL import Image, ImageChops, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "branding" / "nudgenda-launcher-source.png"
IMAGES = ROOT / "assets" / "images"
CANVAS_SIZE = 1024
BACKGROUND = (246, 240, 227, 255)  # Muted cream used throughout Nudgenda.


def fit_art(source: Image.Image, max_width: int, max_height: int) -> Image.Image:
    """Crop transparent padding and resize without changing the illustration."""
    alpha = source.getchannel("A")
    bounds = alpha.getbbox()
    if bounds is None:
        raise ValueError(f"Source illustration is fully transparent: {SOURCE}")

    cropped = source.crop(bounds)
    scale = min(max_width / cropped.width, max_height / cropped.height)
    size = (round(cropped.width * scale), round(cropped.height * scale))
    return cropped.resize(size, Image.Resampling.LANCZOS)


def centered_layer(art: Image.Image, size: int = CANVAS_SIZE) -> Image.Image:
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    position = ((size - art.width) // 2, (size - art.height) // 2)
    layer.alpha_composite(art, position)
    return layer


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG", optimize=True)


def main() -> None:
    source = Image.open(SOURCE).convert("RGBA")

    # The adaptive foreground stays inside Android's central safe region so
    # circle, squircle, and rounded-square launchers keep the full character.
    adaptive_art = fit_art(source, max_width=660, max_height=600)
    adaptive_foreground = centered_layer(adaptive_art)

    # Legacy Android launchers and the web favicon need a flattened square.
    legacy_art = fit_art(source, max_width=780, max_height=690)
    legacy_icon = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), BACKGROUND)
    legacy_icon.alpha_composite(
        legacy_art,
        ((CANVAS_SIZE - legacy_art.width) // 2, (CANVAS_SIZE - legacy_art.height) // 2),
    )

    adaptive_background = Image.new(
        "RGBA", (CANVAS_SIZE, CANVAS_SIZE), BACKGROUND
    )

    # Android 13 themed icons use only alpha. Preserve the illustration's
    # strongest outlines and colour boundaries as a single tintable layer.
    grayscale = ImageOps.grayscale(adaptive_foreground)
    contrast = grayscale.point(lambda value: max(0, min(255, (235 - value) * 2)))
    monochrome_alpha = ImageChops.multiply(
        contrast, adaptive_foreground.getchannel("A")
    )
    monochrome = Image.new(
        "RGBA", (CANVAS_SIZE, CANVAS_SIZE), (255, 255, 255, 0)
    )
    monochrome.putalpha(monochrome_alpha)

    save_png(legacy_icon, IMAGES / "icon.png")
    save_png(adaptive_foreground, IMAGES / "android-icon-foreground.png")
    save_png(adaptive_background, IMAGES / "android-icon-background.png")
    save_png(monochrome, IMAGES / "android-icon-monochrome.png")
    save_png(
        legacy_icon.resize((64, 64), Image.Resampling.LANCZOS),
        IMAGES / "favicon.png",
    )


if __name__ == "__main__":
    main()
