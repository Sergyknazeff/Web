"""Pull last 7 days for one advertiser into a DataFrame and print a quick summary."""
import os
from datetime import date, timedelta

from ttd import TTDClient, ReportingService

client = TTDClient()  # reads TTD_API_TOKEN / TTD_ENV from environment
rs = ReportingService(client)

rows = rs.run_report(
    template_id=int(os.environ["TTD_REPORT_TEMPLATE_ID"]),
    advertiser_ids=[os.environ["TTD_ADVERTISER_ID"]],
    start=date.today() - timedelta(days=7),
    end_exclusive=date.today(),
    out_path="reports/last7d.csv",
)
df = rs.to_dataframe(rows)
print(df.head())
# Column names depend on your template, e.g.:
# print(df.groupby("Campaign")[["Impressions", "Clicks", "Advertiser Cost (Adv Currency)"]].sum())
