"""MyReports API: create a one-off report schedule, wait for execution, download.

Flow:
  1. POST /myreports/reportschedule            (template + date range + advertiser filter)
  2. POST /myreports/reportexecution/query/advertisers  (poll until Complete/Failed)
  3. GET  ReportDeliveries[0].DownloadURL      (pre-signed, no TTD-Auth header needed)
  4. DELETE /myreports/reportschedule/{id}     (cleanup, optional)

Report templates are built in the TTD UI (My Reports); you need the template ID.
"""
from __future__ import annotations

import csv
import io
import time
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

from .client import TTDClient, TTDError

TERMINAL_OK = {"Complete", "Completed"}
TERMINAL_FAIL = {"Failed", "Error", "Cancelled"}


def _d(value: date | datetime | str) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, datetime):
        value = value.date()
    return value.strftime("%Y-%m-%d")


class ReportingService:
    def __init__(self, client: TTDClient):
        self.c = client

    def list_templates(self, partner_id: str | None = None) -> list[dict]:
        body: dict[str, Any] = {"PageStartIndex": 0, "PageSize": 100}
        if partner_id:
            body["PartnerId"] = partner_id
        return list(self.c.paginate("myreports/reporttemplateheader/query", body))

    def create_schedule(
        self,
        template_id: int,
        advertiser_ids: list[str],
        start: date | str | None = None,
        end_exclusive: date | str | None = None,
        date_range: str | None = None,
        name: str | None = None,
        timezone: str = "UTC",
        extra: dict | None = None,
    ) -> dict:
        """Either pass a named ``date_range`` (e.g. "Yesterday", "Last7Days") or start/end."""
        body: dict[str, Any] = {
            "ReportScheduleName": name or f"api-{template_id}-{int(time.time())}",
            "ReportTemplateId": template_id,
            "ReportFileFormat": "CSV",
            "ReportFrequency": "Once",
            "TimeZone": timezone,
            "ReportDateFormat": "International",
            "ReportNumericFormat": "US",
            "IncludeHeaders": True,
            "AdvertiserFilters": advertiser_ids,
        }
        if date_range:
            body["ReportDateRange"] = date_range
        else:
            if not (start and end_exclusive):
                raise ValueError("pass date_range or both start and end_exclusive")
            body["ReportDateRange"] = "Custom"
            body["ReportStartDateInclusive"] = _d(start)
            body["ReportEndDateExclusive"] = _d(end_exclusive)
        body.update(extra or {})
        return self.c.post("myreports/reportschedule", body)

    def find_execution(self, schedule_id: int, advertiser_ids: list[str]) -> dict | None:
        page = self.c.post(
            "myreports/reportexecution/query/advertisers",
            {
                "AdvertiserIds": advertiser_ids,
                "ReportScheduleIds": [schedule_id],
                "PageStartIndex": 0,
                "PageSize": 10,
            },
        )
        results = (page or {}).get("Result", [])
        return results[0] if results else None

    def wait_for_report(
        self, schedule_id: int, advertiser_ids: list[str], timeout_s: int = 1800, poll_s: int = 20
    ) -> dict:
        deadline = time.time() + timeout_s
        while time.time() < deadline:
            ex = self.find_execution(schedule_id, advertiser_ids)
            state = (ex or {}).get("ReportExecutionState")
            if state in TERMINAL_OK:
                return ex
            if state in TERMINAL_FAIL:
                raise TTDError(-1, f"report execution {state}", ex)
            time.sleep(poll_s)
        raise TimeoutError(f"report schedule {schedule_id} not ready after {timeout_s}s")

    def download(self, execution: dict) -> str:
        deliveries = execution.get("ReportDeliveries") or []
        url = next((d.get("DownloadURL") for d in deliveries if d.get("DownloadURL")), None)
        if not url:
            raise TTDError(-1, "execution has no DownloadURL", execution)
        resp = self.c.session.get(url, timeout=self.c.timeout)
        resp.raise_for_status()
        return resp.content.decode("utf-8-sig")

    def delete_schedule(self, schedule_id: int) -> None:
        self.c.delete(f"myreports/reportschedule/{schedule_id}")

    # ------------------------------------------------------------ one-shot
    def run_report(
        self,
        template_id: int,
        advertiser_ids: list[str],
        start: date | str | None = None,
        end_exclusive: date | str | None = None,
        date_range: str | None = None,
        out_path: str | Path | None = None,
        cleanup: bool = True,
        **kw,
    ) -> list[dict]:
        """Create schedule -> wait -> download -> parse CSV rows (optionally save file)."""
        if not (date_range or start):
            start = date.today() - timedelta(days=7)
            end_exclusive = date.today()
        sched = self.create_schedule(template_id, advertiser_ids, start, end_exclusive, date_range, **kw)
        schedule_id = sched["ReportScheduleId"]
        try:
            ex = self.wait_for_report(schedule_id, advertiser_ids)
            text = self.download(ex)
        finally:
            if cleanup:
                try:
                    self.delete_schedule(schedule_id)
                except TTDError:
                    pass
        if out_path:
            Path(out_path).parent.mkdir(parents=True, exist_ok=True)
            Path(out_path).write_text(text, encoding="utf-8")
        return list(csv.DictReader(io.StringIO(text)))

    @staticmethod
    def to_dataframe(rows: list[dict]):
        import pandas as pd  # optional dependency

        df = pd.DataFrame(rows)
        for col in df.columns:
            converted = pd.to_numeric(df[col].str.replace(",", "", regex=False), errors="coerce")
            if converted.notna().sum() == df[col].replace("", None).notna().sum():
                df[col] = converted
        return df
