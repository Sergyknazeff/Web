"""Advertisers, campaigns, ad groups.

Payload builders cover the common required fields. TTD schemas differ by account
(Kokai vs. Solimar, API version, partner config), so every builder accepts ``extra``
which is deep-merged into the payload. Verify field names against the partner
API docs for your seat before going live.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Iterator

from .client import TTDClient


def _iso(dt: datetime | str) -> str:
    if isinstance(dt, str):
        return dt
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")


def _money(amount: float, currency: str) -> dict:
    return {"Amount": round(float(amount), 2), "CurrencyCode": currency}


def deep_merge(base: dict, extra: dict | None) -> dict:
    out = dict(base)
    for k, v in (extra or {}).items():
        out[k] = deep_merge(out[k], v) if isinstance(v, dict) and isinstance(out.get(k), dict) else v
    return out


class CampaignService:
    def __init__(self, client: TTDClient):
        self.c = client

    # ---------------------------------------------------------- advertisers
    def list_advertisers(self, partner_id: str) -> Iterator[dict]:
        return self.c.paginate("advertiser/query/partner", {"PartnerId": partner_id})

    def get_advertiser(self, advertiser_id: str) -> dict:
        return self.c.get(f"advertiser/{advertiser_id}")

    # ------------------------------------------------------------ campaigns
    def list_campaigns(self, advertiser_id: str, **filters) -> Iterator[dict]:
        return self.c.paginate("campaign/query/advertiser", {"AdvertiserId": advertiser_id, **filters})

    def get_campaign(self, campaign_id: str) -> dict:
        return self.c.get(f"campaign/{campaign_id}")

    @staticmethod
    def build_campaign(
        advertiser_id: str,
        name: str,
        start: datetime | str,
        end: datetime | str,
        budget: float,
        currency: str = "USD",
        daily_budget: float | None = None,
        pacing_mode: str = "PaceEvenly",
        extra: dict | None = None,
    ) -> dict:
        flight: dict[str, Any] = {
            "StartDateInclusiveUTC": _iso(start),
            "EndDateExclusiveUTC": _iso(end),
            "BudgetInAdvertiserCurrency": round(float(budget), 2),
        }
        if daily_budget:
            flight["DailyTargetInAdvertiserCurrency"] = round(float(daily_budget), 2)
        payload = {
            "AdvertiserId": advertiser_id,
            "CampaignName": name,
            "StartDate": _iso(start),
            "PacingMode": pacing_mode,
            "CampaignFlights": [flight],
        }
        return deep_merge(payload, extra)

    def create_campaign(self, payload: dict) -> dict:
        _require(payload, "AdvertiserId", "CampaignName")
        return self.c.post("campaign", payload)

    def update_campaign(self, campaign_id: str, changes: dict) -> dict:
        """PUT is partial in TTD v3: send CampaignId + only the fields to change."""
        return self.c.put("campaign", {"CampaignId": campaign_id, **changes})

    # ------------------------------------------------------------ ad groups
    def list_ad_groups(self, campaign_id: str, **filters) -> Iterator[dict]:
        return self.c.paginate("adgroup/query/campaign", {"CampaignId": campaign_id, **filters})

    def get_ad_group(self, ad_group_id: str) -> dict:
        return self.c.get(f"adgroup/{ad_group_id}")

    @staticmethod
    def build_ad_group(
        campaign_id: str,
        name: str,
        base_bid_cpm: float,
        max_bid_cpm: float,
        currency: str = "USD",
        budget: float | None = None,
        daily_budget: float | None = None,
        category_id: int | None = None,
        audience_id: str | None = None,
        creative_ids: list[str] | None = None,
        enabled: bool = False,
        extra: dict | None = None,
    ) -> dict:
        rtb: dict[str, Any] = {
            "BaseBidCPM": _money(base_bid_cpm, currency),
            "MaxBidCPM": _money(max_bid_cpm, currency),
        }
        if budget is not None or daily_budget is not None:
            bs: dict[str, Any] = {}
            if budget is not None:
                bs["Budget"] = _money(budget, currency)
            if daily_budget is not None:
                bs["DailyBudget"] = _money(daily_budget, currency)
            rtb["BudgetSettings"] = bs
        if audience_id:
            rtb["AudienceTargeting"] = {"AudienceId": audience_id}
        if creative_ids:
            rtb["CreativeIds"] = creative_ids
        payload: dict[str, Any] = {
            "CampaignId": campaign_id,
            "AdGroupName": name,
            "IsEnabled": enabled,  # default OFF: nothing spends until you flip it
            "RTBAttributes": rtb,
        }
        if category_id is not None:
            payload["AdGroupCategory"] = {"CategoryId": category_id}
        return deep_merge(payload, extra)

    def create_ad_group(self, payload: dict) -> dict:
        _require(payload, "CampaignId", "AdGroupName")
        return self.c.post("adgroup", payload)

    def update_ad_group(self, ad_group_id: str, changes: dict) -> dict:
        return self.c.put("adgroup", {"AdGroupId": ad_group_id, **changes})

    def set_ad_group_enabled(self, ad_group_id: str, enabled: bool) -> dict:
        return self.update_ad_group(ad_group_id, {"IsEnabled": enabled})


def _require(payload: dict, *keys: str) -> None:
    missing = [k for k in keys if not payload.get(k)]
    if missing:
        raise ValueError(f"payload missing required fields: {', '.join(missing)}")
