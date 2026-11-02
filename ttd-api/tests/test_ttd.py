import json

import pytest

from ttd import CampaignService, ReportingService, TTDClient, TTDError
import ttd.client as client_mod
import ttd.reporting as reporting_mod


class FakeResp:
    def __init__(self, status=200, body=None, headers=None, text=None):
        self.status_code = status
        self._body = body
        self.headers = headers or {}
        self.text = text if text is not None else json.dumps(body)
        self.content = self.text.encode()

    def json(self):
        if self._body is None:
            raise ValueError
        return self._body

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(self.status_code)


class FakeSession:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def _next(self, method, url, **kw):
        self.calls.append((method, url, kw))
        return self.responses.pop(0)

    def request(self, method, url, **kw):
        return self._next(method, url, **kw)

    def post(self, url, **kw):
        return self._next("POST", url, **kw)

    def get(self, url, **kw):
        return self._next("GET", url, **kw)


@pytest.fixture(autouse=True)
def no_sleep(monkeypatch):
    monkeypatch.setattr(client_mod.time, "sleep", lambda s: None)
    monkeypatch.setattr(reporting_mod.time, "sleep", lambda s: None)


def test_static_token_header_and_sandbox_url():
    s = FakeSession([FakeResp(body={"CampaignId": "c1"})])
    c = TTDClient(token="tok", env="sandbox", session=s)
    c.get("campaign/c1")
    method, url, kw = s.calls[0]
    assert url == "https://ext-api.sb.thetradedesk.com/v3/campaign/c1"
    assert kw["headers"]["TTD-Auth"] == "tok"


def test_login_flow_gets_token():
    s = FakeSession([FakeResp(body={"Token": "short"}), FakeResp(body={})])
    c = TTDClient(login="u", password="p", env="production", session=s)
    c.get("advertiser/a1")
    assert s.calls[0][1].endswith("/authentication")
    assert s.calls[1][2]["headers"]["TTD-Auth"] == "short"


def test_retries_on_429_then_succeeds():
    s = FakeSession([FakeResp(429, {"Message": "slow"}, {"Retry-After": "1"}), FakeResp(body={"ok": 1})])
    c = TTDClient(token="t", session=s)
    assert c.get("x") == {"ok": 1}
    assert len(s.calls) == 2


def test_error_raises_with_message():
    s = FakeSession([FakeResp(400, {"Message": "bad field"})])
    with pytest.raises(TTDError, match="bad field"):
        TTDClient(token="t", session=s).post("campaign", {})


def test_pagination():
    s = FakeSession([
        FakeResp(body={"Result": [{"id": 1}, {"id": 2}], "TotalFilteredCount": 3}),
        FakeResp(body={"Result": [{"id": 3}], "TotalFilteredCount": 3}),
    ])
    c = TTDClient(token="t", session=s)
    assert [r["id"] for r in c.paginate("campaign/query/advertiser", {"AdvertiserId": "a"}, 2)] == [1, 2, 3]
    assert s.calls[1][2]["json"]["PageStartIndex"] == 2


def test_build_campaign_and_adgroup_defaults():
    camp = CampaignService.build_campaign("adv", "n", "2026-11-10T00:00:00", "2026-12-01T00:00:00",
                                          1000, daily_budget=50, extra={"PrimaryChannel": "Display"})
    assert camp["CampaignFlights"][0]["BudgetInAdvertiserCurrency"] == 1000
    assert camp["PrimaryChannel"] == "Display"
    ag = CampaignService.build_ad_group("c1", "ag", 3, 6, daily_budget=20)
    assert ag["IsEnabled"] is False
    assert ag["RTBAttributes"]["BaseBidCPM"] == {"Amount": 3.0, "CurrencyCode": "USD"}


def test_create_campaign_validates():
    cs = CampaignService(TTDClient(token="t", session=FakeSession([])))
    with pytest.raises(ValueError):
        cs.create_campaign({"CampaignName": "x"})


def test_run_report_end_to_end(tmp_path):
    csv_text = "﻿Campaign,Impressions\nA,\"1,000\"\nB,500\n"
    s = FakeSession([
        FakeResp(body={"ReportScheduleId": 42}),                                       # create
        FakeResp(body={"Result": [{"ReportExecutionState": "Pending"}]}),              # poll
        FakeResp(body={"Result": [{"ReportExecutionState": "Complete",
                                   "ReportDeliveries": [{"DownloadURL": "https://dl/x.csv"}]}]}),
        FakeResp(text=csv_text),                                                        # download
        FakeResp(text=""),                                                              # delete
    ])
    rs = ReportingService(TTDClient(token="t", session=s))
    rows = rs.run_report(7, ["adv"], start="2026-10-01", end_exclusive="2026-10-08",
                         out_path=tmp_path / "r.csv")
    assert rows == [{"Campaign": "A", "Impressions": "1,000"}, {"Campaign": "B", "Impressions": "500"}]
    body = s.calls[0][2]["json"]
    assert body["ReportDateRange"] == "Custom" and body["AdvertiserFilters"] == ["adv"]
    assert s.calls[-1][0] == "DELETE"
