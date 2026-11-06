from PIL import Image

from app.preprocess import prepare_for_ocr


def test_preprocessing_returns_grayscale_derivative_without_mutating_source():
    source = Image.new("RGB", (400, 300), "white")
    processed = prepare_for_ocr(source)
    assert source.mode == "RGB"
    assert processed.mode == "L"
    assert processed.width >= source.width
    assert processed.height >= source.height
