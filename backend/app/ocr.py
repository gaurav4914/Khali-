from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from PIL import Image

from .preprocess import prepare_for_ocr


@dataclass
class OCRDocument:
    text: str
    mean_confidence: float | None
    provider: str


class OCRProvider(Protocol):
    def read_text(self, image_path: Path) -> OCRDocument: ...


class TesseractOCRProvider:
    def __init__(self, languages: str = "eng+hin") -> None:
        self.languages = languages

    def read_text(self, image_path: Path) -> OCRDocument:
        try:
            import pytesseract

            with Image.open(image_path) as source:
                image = prepare_for_ocr(source)
                text = pytesseract.image_to_string(image, lang=self.languages)
                data = pytesseract.image_to_data(
                    image,
                    lang=self.languages,
                    output_type=pytesseract.Output.DICT,
                )
            confidence_values = []
            for raw in data.get("conf", []):
                try:
                    value = float(raw)
                    if value >= 0:
                        confidence_values.append(value / 100.0)
                except (TypeError, ValueError):
                    continue
            confidence = (
                sum(confidence_values) / len(confidence_values)
                if confidence_values
                else None
            )
            return OCRDocument(
                text=text.strip(),
                mean_confidence=confidence,
                provider="tesseract",
            )
        except ImportError as exc:
            raise RuntimeError("pytesseract is not installed.") from exc
        except Exception as exc:
            raise RuntimeError(f"OCR provider failed: {type(exc).__name__}") from exc


class EmptyMockOCRProvider:
    """Safe development provider: deliberately returns no invented medicine text."""

    def read_text(self, image_path: Path) -> OCRDocument:
        return OCRDocument(text="", mean_confidence=None, provider="mock-empty")
