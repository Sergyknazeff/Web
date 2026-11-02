"""CLI: python -m ttd.cli <command> ...

Write commands are DRY-RUN by default; add --execute to actually call the API.
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from pathlib import Path

from .campaigns import CampaignService
from .client import TTDClient
from .reporting import ReportingService


def _load_dotenv(path: str = ".env") -> None:
    p = Path(path)
    if not p.exists():
        return
    for line in p.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())


def _print(obj) -> None:
    print(json.dumps(obj, indent=2, default=str))


def main(argv: list[str] | None = None) -> int:
    _load_dotenv()
    p = argparse.ArgumentParser(prog="ttd")
    p.add_argument("--env", choices=["sandbox", "production"], default=None)
    p.add_argument("-v", "--verbose", action="store_true")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("advertisers"); s.add_argument("--partner", default=os.getenv("TTD_PARTNER_ID"))
    s = sub.add_parser("campaigns"); s.add_argument("--advertiser", default=os.getenv("TTD_ADVERTISER_ID"))
    s = sub.add_parser("adgroups"); s.add_argument("campaign_id")

    s = sub.add_parser("create-campaign", help="create campaign (+ optional ad groups) from JSON")
    s.add_argument("spec", help="JSON file: {campaign: {...}, ad_groups: [{...}]}")
    s.add_argument("--execute", action="store_true")

    s = sub.add_parser("report", help="run a MyReports template and save CSV")
    s.add_argument("--template", type=int, required=True)
    s.add_argument("--advertiser", action="append", default=None)
    s.add_argument("--start"); s.add_argument("--end", help="exclusive, YYYY-MM-DD")
    s.add_argument("--range", dest="date_range", help='e.g. "Yesterday", "Last7Days"')
    s.add_argument("--out", default="reports/report.csv")

    s = sub.add_parser("templates"); s.add_argument("--partner", default=os.getenv("TTD_PARTNER_ID"))

    a = p.parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if a.verbose else logging.INFO, format="%(levelname)s %(message)s")

    if a.cmd == "create-campaign" and not a.execute:
        spec = json.loads(Path(a.spec).read_text())
        camp = CampaignService.build_campaign(**spec["campaign"])
        print("DRY RUN - campaign payload:"); _print(camp)
        for ag in spec.get("ad_groups", []):
            print("DRY RUN - ad group payload:"); _print(CampaignService.build_ad_group(campaign_id="<new>", **ag))
        print("\nRe-run with --execute to create.")
        return 0

    client = TTDClient(env=a.env)
    cs, rs = CampaignService(client), ReportingService(client)

    if a.cmd == "advertisers":
        for adv in cs.list_advertisers(a.partner):
            print(adv["AdvertiserId"], adv.get("AdvertiserName"), sep="\t")
    elif a.cmd == "campaigns":
        for c in cs.list_campaigns(a.advertiser):
            print(c["CampaignId"], c.get("CampaignName"), c.get("Availability", ""), sep="\t")
    elif a.cmd == "adgroups":
        for g in cs.list_ad_groups(a.campaign_id):
            print(g["AdGroupId"], g.get("AdGroupName"), "enabled" if g.get("IsEnabled") else "paused", sep="\t")
    elif a.cmd == "create-campaign":
        spec = json.loads(Path(a.spec).read_text())
        camp = cs.create_campaign(CampaignService.build_campaign(**spec["campaign"]))
        print(f"campaign created: {camp['CampaignId']}")
        for ag in spec.get("ad_groups", []):
            g = cs.create_ad_group(CampaignService.build_ad_group(campaign_id=camp["CampaignId"], **ag))
            print(f"ad group created (enabled={g.get('IsEnabled')}): {g['AdGroupId']}")
    elif a.cmd == "templates":
        for t in rs.list_templates(a.partner):
            print(t.get("ReportTemplateId"), t.get("Name") or t.get("ReportTemplateName"), sep="\t")
    elif a.cmd == "report":
        advs = a.advertiser or [os.environ["TTD_ADVERTISER_ID"]]
        rows = rs.run_report(a.template, advs, start=a.start, end_exclusive=a.end,
                             date_range=a.date_range, out_path=a.out)
        print(f"{len(rows)} rows -> {a.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
