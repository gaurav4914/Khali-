from io import BytesIO

from PIL import Image, ImageFilter, ImageOps, ImageStat, UnidentifiedImageError

from .schemas import QualityReport, QualityStatus


SUPPORTED_FORMATS = {"JPEG", "PNG", "WEBP"}


class InvalidImageError(ValueError):
    pass


def inspect_image(data: bytes, *, capture_id: str | None = None, step: str = "front") -> QualityReport:
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

    histogram = gray.histogram()
    total_pixels = max(width * height, 1)
    bright_pixels = sum(histogram[245:])
    glare_ratio = bright_pixels / total_pixels

    issues: list[str] = []
    action = None
    target_region = "composition_text" if step == "composition" else "full_pack"

    if brightness < 45:
        issues.append("low_light")
        action = "increase_light_or_enable_torch"
    elif brightness > 225:
        issues.append("overexposed")
        action = "reduce_light_or_adjust_angle"

    if glare_ratio > 0.35 and brightness <= 225:
        issues.append("glare_detected")
        action = action or "tilt_pack_slightly_to_reduce_glare"

    if edge_detail < 6:
        issues.append("severe_blur_or_blank")
        action = action or "hold_steady_and_capture_again"
    elif edge_detail < 14:
        issues.append("low_detail_or_possible_blur")
        action = action or "hold_steady_and_capture_again"

    if min(width, height) < 600:
        issues.append("low_resolution")
        action = action or "move_closer_without_cutting_off_the_label"
        target_region = "composition_text"

    if "severe_blur_or_blank" in issues and ("low_light" in issues or "overexposed" in issues):
        status = QualityStatus.RETRY_REQUIRED
    elif issues:
        status = QualityStatus.RETRY_RECOMMENDED
    else:
        status = QualityStatus.ACCEPTED

    return QualityReport(
        capture_id=capture_id,
        status=status,
        issues=issues,
        recommended_action=action,
        target_region=target_region,
        width=width,
        height=height,
        brightness_mean=round(brightness, 2),
        edge_detail_score=round(edge_detail, 2),
        glare_ratio=round(glare_ratio, 4),
    )
