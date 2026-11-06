from PIL import Image, ImageFilter, ImageOps


def prepare_for_ocr(image: Image.Image) -> Image.Image:
    """Create an OCR-friendly derivative; the original capture is never overwritten."""
    working = ImageOps.exif_transpose(image).convert("L")
    working = ImageOps.autocontrast(working, cutoff=1)
    working = working.filter(ImageFilter.MedianFilter(size=3))

    width, height = working.size
    shortest = min(width, height)
    if shortest < 1000:
        scale = min(2.0, 1000 / max(shortest, 1))
        new_size = (int(width * scale), int(height * scale))
        working = working.resize(new_size, Image.Resampling.LANCZOS)

    return working
