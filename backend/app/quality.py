from io import BytesIO

from PIL import Image, ImageFilter, ImageOps, ImageStat, UnidentifiedImageError

from .schemas import QualityReport, QualityStatus


SUPPORTED_FORMATS = {"JPEG", "PNG", "WEBP"}


class InvalidImageError(ValueError):
    pass


def inspect_image(data: bytes) -> QualityReport:
    try:
        with Image.open(BytesIO(data)) as original:
            image_format = (original.format or "").upper()
            if image_format not in SUPPORTED_FORMATS:
                raise InvalidImageError("Unsupported image format. Use JPEG, PNG, or WEBP.")
            image = ImageOps.exif_transpose(original).convert("RGB")
            image.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise InvalidImageError("The uploaded file is not a valid supported image.") from exc

    width, height = image.size
    if width < 240 or height < 240:
        raise InvalidImageError("Image dimensions are too small. Capture a larger image.")

    gray = image.convert("L")
    brightness = float(ImageStat.Stat(gray).mean[0])
    edge_image = gray.filter(ImageFilter.FIND_EDGES)
    edge_detail = float(ImageStat.Stat(edge_image).stddev[0])

    issues: list[str] = []
    action = None
    if brightness < 45:
        issues.append("low_light")
        action = "increase_light_or_enable_torch"
    elif brightness > 225:
        issues.append("overexposed")
        action = "reduce_light_or_adjust_angle"
    if edge_detail < 14:
        issues.append("low_detail_or_possible_blur")
        action = action or "hold_steady_and_capture_again"
    if min(width, height) < 600:
        issues.append("low_resolution")
        action = action or "move_closer_without_cutting_off_the_label"

    status = QualityStatus.RETRY_RECOMMENDED if issues else QualityStatus.ACCEPTED
    return QualityReport(
        status=status,
        issues=issues,
        recommended_action=action,
        width=width,
        height=height,
        brightness_mean=round(brightness, 2),
        edge_detail_score=round(edge_detail, 2),
    )
