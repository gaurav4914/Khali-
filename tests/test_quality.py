from io import BytesIO

from PIL import Image, ImageDraw

from app.quality import InvalidImageError, inspect_image
from app.schemas import QualityStatus


def make_image(size=(900, 900), color=(255, 255, 255)):
    image = Image.new("RGB", size, color)
    draw = ImageDraw.Draw(image)
    draw.text((50, 50), "SAMPLE PACK TEXT 500 mg", fill=(0, 0, 0))
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def test_quality_check_returns_dimensions():
    report = inspect_image(make_image())
    assert report.width == 900
    assert report.height == 900
    assert report.status in {QualityStatus.ACCEPTED, QualityStatus.RETRY_RECOMMENDED}


def test_rejects_non_image():
    try:
        inspect_image(b"not an image")
    except InvalidImageError:
        assert True
    else:
        assert False, "Invalid image should be rejected"
