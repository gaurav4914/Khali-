import shutil
import threading
from datetime import timedelta
from pathlib import Path
from uuid import uuid4

from .schemas import CaptureRecord, ScanSession, ScanStatus, utc_now


class ScanNotFoundError(Exception):
    pass


class InMemoryScanStore:
    """Temporary scan-session store, not a medicine catalogue or permanent database.

    The first deployment runs as one API process. For multi-replica deployments, replace
    this adapter with a buyer-managed shared session store before scaling horizontally.
    """

    def __init__(self, upload_dir: Path, ttl_seconds: int) -> None:
        self.upload_dir = upload_dir
        self.ttl_seconds = ttl_seconds
        self._sessions: dict[str, ScanSession] = {}
        self._lock = threading.RLock()
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    def create(self) -> ScanSession:
        now = utc_now()
        session = ScanSession(
            scan_id=str(uuid4()),
            created_at=now,
            expires_at=now + timedelta(seconds=self.ttl_seconds),
        )
        with self._lock:
            self._purge_expired_locked()
            self._sessions[session.scan_id] = session
        return session

    def get(self, scan_id: str) -> ScanSession:
        with self._lock:
            self._purge_expired_locked()
            session = self._sessions.get(scan_id)
            if session is None:
                raise ScanNotFoundError(scan_id)
            return session.model_copy(deep=True)

    def add_capture(self, scan_id: str, capture: CaptureRecord) -> ScanSession:
        with self._lock:
            self._purge_expired_locked()
            session = self._sessions.get(scan_id)
            if session is None:
                raise ScanNotFoundError(scan_id)
            session.captures.append(capture)
            session.status = ScanStatus.CAPTURING
            return session.model_copy(deep=True)

    def set_extraction(self, scan_id: str, extraction) -> ScanSession:
        with self._lock:
            self._purge_expired_locked()
            session = self._sessions.get(scan_id)
            if session is None:
                raise ScanNotFoundError(scan_id)
            session.extraction = extraction
            session.status = ScanStatus.RECOGNISED
            return session.model_copy(deep=True)

    def capture_path(self, scan_id: str, capture_id: str) -> Path | None:
        with self._lock:
            self._purge_expired_locked()
            session = self._sessions.get(scan_id)
            if session is None:
                raise ScanNotFoundError(scan_id)
            capture = next((item for item in session.captures if item.capture_id == capture_id), None)
            if capture is None:
                return None
            path = self.upload_dir / capture.filename
            return path if path.is_file() else None

    def _purge_expired_locked(self) -> None:
        now = utc_now()
        expired_ids = [key for key, value in self._sessions.items() if value.expires_at <= now]
        for key in expired_ids:
            session = self._sessions.pop(key)
            for capture in session.captures:
                try:
                    (self.upload_dir / capture.filename).unlink(missing_ok=True)
                except OSError:
                    pass

    def clear_upload_directory_on_startup(self) -> None:
        """Remove orphaned temporary images left by a previous process."""
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        for item in self.upload_dir.iterdir():
            try:
                if item.is_file():
                    item.unlink(missing_ok=True)
                elif item.is_dir():
                    shutil.rmtree(item, ignore_errors=True)
            except OSError:
                continue
