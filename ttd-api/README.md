# The Trade Desk API client (Python)

A small Python client for the TTD v3 REST API that handles **reporting** (MyReports) and **campaign/ad group creation**.

## Setup
```bash
pip install -r requirements.txt
cp .env.example .env      # fill TTD_API_TOKEN (or TTD_LOGIN/TTD_PASSWORD), TTD_ENV, IDs
```
- `TTD_ENV=sandbox` → `https://ext-api.sb.thetradedesk.com/v3`, `production` → `https://api.thetradedesk.com/v3`
- Auth: a long-lived API token from the TTD UI is the preferred option. The login/password route uses `POST /authentication`, and the client refreshes that token automatically.

## CLI
```bash
python -m ttd.cli advertisers --partner <PARTNER_ID>
python -m ttd.cli campaigns --advertiser <ADV_ID>
python -m ttd.cli adgroups <CAMPAIGN_ID>
python -m ttd.cli templates
python -m ttd.cli report --template 12345 --advertiser <ADV_ID> --start 2026-10-01 --end 2026-11-01 --out reports/oct.csv
python -m ttd.cli create-campaign examples/campaign_spec.json            # dry run: prints payloads
python -m ttd.cli create-campaign examples/campaign_spec.json --execute  # actually creates
```

## Python
```python
from ttd import TTDClient, CampaignService, ReportingService
c = TTDClient()
cs, rs = CampaignService(c), ReportingService(c)

camp = cs.create_campaign(cs.build_campaign("adv123", "Q4 Prospecting",
        "2026-11-10T00:00:00", "2026-12-31T00:00:00", budget=10000, daily_budget=250,
        extra={"PrimaryChannel": "Display"}))
ag = cs.create_ad_group(cs.build_ad_group(camp["CampaignId"], "Prospecting", 4, 8, daily_budget=125))
cs.set_ad_group_enabled(ag["AdGroupId"], True)   # spend begins only here

rows = rs.run_report(template_id=12345, advertiser_ids=["adv123"], date_range="Last7Days")
df = rs.to_dataframe(rows)
```

## Safety defaults
- `create-campaign` runs as a dry run unless you pass `--execute`.
- New ad groups start with `IsEnabled=false`, so nothing spends until you enable them.
- The client retries 429 and 5xx responses with backoff and honours `Retry-After`.

## Check these against your seat's partner docs before using production
TTD schemas differ by platform version (Kokai vs. legacy), API version and partner config. The builders fill in the common fields. Anything else goes through `extra={...}`, which is deep-merged into the payload. Fields that are commonly required or have changed over time:
- Campaign: `CampaignFlights` vs. legacy `Budget`/`EndDate`, `PrimaryChannel`, `PrimaryGoal`/KPI fields, `CampaignConversionReportingColumns`
- Ad group: budget and flight fields under `RTBAttributes`, `AdGroupCategory`, `AudienceTargeting`, `ROIGoal`, `CreativeIds`
- Reports: the template ID comes from My Reports in the UI. Accepted `ReportDateRange` names can vary.

Test in sandbox first.

## Tests
```bash
python -m pytest -q   # mocked HTTP, no credentials needed
```
