"""Core HTTP client: auth, retries/rate limits, pagination."""
from __future__ import annotations

import logging
import os
import time
from typing import Any, Iterator

import requests

log = logging.getLogger(__name__)

BASE_URLS = {
    "production": "https://api.thetradedesk.com/v3",
    "sandbox": "https://ext-api.sb.thetradedesk.com/v3",
}

RETRY_STATUSES = {429, 500, 502, 503, 504}


class TTDError(RuntimeError):
    def __init__(self, status: int, message: str, payload: Any = None):
        super().__init__(f"TTD API {status}: {message}")
        self.status = status
        self.payload = payload


class TTDClient:
    """Thin wrapper around the TTD v3 REST API.

    Auth options (in priority order):
      1. ``token`` / env ``TTD_API_TOKEN`` – long-lived API token from the TTD UI (recommended).
      2. ``login`` + ``password`` / env ``TTD_LOGIN`` + ``TTD_PASSWORD`` – exchanged for a
         short-lived token via ``POST /authentication`` and refreshed automatically.
    """

    def __init__(
        self,
        token: str | None = None,
        login: str | None = None,
        password: str | None = None,
        env: str | None = None,
        base_url: str | None = None,
        token_ttl_minutes: int = 1440,
        max_retries: int = 5,
        timeout: float = 60.0,
        session: requests.Session | None = None,
    ):
        env = env or os.getenv("TTD_ENV", "sandbox")
        self.base_url = (base_url or BASE_URLS[env]).rstrip("/")
        self._static_token = token or os.getenv("TTD_API_TOKEN") or None
        self._login = login or os.getenv("TTD_LOGIN")
        self._password = password or os.getenv("TTD_PASSWORD")
        if not self._static_token and not (self._login and self._password):
            raise ValueError("Provide TTD_API_TOKEN, or TTD_LOGIN + TTD_PASSWORD.")
        self.token_ttl_minutes = token_ttl_minutes
        self.max_retries = max_retries
        self.timeout = timeout
        self.session = session or requests.Session()
        self._token: str | None = self._static_token
        self._token_expires_at = float("inf") if self._static_token else 0.0

    # ---------------------------------------------------------------- auth
    def _ensure_token(self) -> str:
        if self._token and time.time() < self._token_expires_at:
            return self._token
        resp = self.session.post(
            f"{self.base_url}/authentication",
            json={
                "Login": self._login,
                "Password": self._password,
                "TokenExpirationInMinutes": self.token_ttl_minutes,
            },
            timeout=self.timeout,
        )
        if resp.status_code != 200:
            raise TTDError(resp.status_code, "authentication failed", _safe_json(resp))
        self._token = resp.json()["Token"]
        # refresh 5 minutes before expiry
        self._token_expires_at = time.time() + max(60, self.token_ttl_minutes * 60 - 300)
        return self._token

    # ------------------------------------------------------------- request
    def request(self, method: str, path: str, json: Any = None, params: dict | None = None) -> Any:
        url = path if path.startswith("http") else f"{self.base_url}/{path.lstrip('/')}"
        for attempt in range(self.max_retries + 1):
            headers = {"TTD-Auth": self._ensure_token(), "Content-Type": "application/json"}
            resp = self.session.request(
                method, url, json=json, params=params, headers=headers, timeout=self.timeout
            )
            if resp.status_code == 401 and not self._static_token and attempt == 0:
                self._token_expires_at = 0  # force re-auth once
                continue
            if resp.status_code in RETRY_STATUSES and attempt < self.max_retries:
                wait = _retry_after(resp) or min(2 ** attempt, 60)
                log.warning("TTD %s %s -> %s, retrying in %.1fs", method, path, resp.status_code, wait)
                time.sleep(wait)
                continue
            if resp.status_code >= 400:
                body = _safe_json(resp)
                msg = body.get("Message", resp.text[:500]) if isinstance(body, dict) else resp.text[:500]
                raise TTDError(resp.status_code, msg, body)
            return _safe_json(resp) if resp.content else None
        raise TTDError(-1, "retries exhausted")

    def get(self, path: str, **kw) -> Any:
        return self.request("GET", path, **kw)

    def post(self, path: str, body: Any = None) -> Any:
        return self.request("POST", path, json=body)

    def put(self, path: str, body: Any = None) -> Any:
        return self.request("PUT", path, json=body)

    def delete(self, path: str) -> Any:
        return self.request("DELETE", path)

    # ---------------------------------------------------------- pagination
    def paginate(self, path: str, body: dict, page_size: int = 100) -> Iterator[dict]:
        """Iterate over TTD ``/query/...`` endpoints (PageStartIndex/PageSize -> Result)."""
        start = 0
        while True:
            page = self.post(path, {**body, "PageStartIndex": start, "PageSize": page_size})
            results = page.get("Result", []) if page else []
            yield from results
            total = page.get("TotalFilteredCount", page.get("ResultCount", 0)) if page else 0
            start += len(results)
            if not results or start >= total:
                break


def _safe_json(resp: requests.Response) -> Any:
    try:
        return resp.json()
    except ValueError:
        return {"raw": resp.text}


def _retry_after(resp: requests.Response) -> float | None:
    value = resp.headers.get("Retry-After")
    try:
        return float(value) if value else None
    except ValueError:
        return None
