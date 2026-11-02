"""Minimal client for The Trade Desk REST API (v3): campaign management + MyReports."""
from .client import TTDClient, TTDError
from .campaigns import CampaignService
from .reporting import ReportingService

__all__ = ["TTDClient", "TTDError", "CampaignService", "ReportingService"]
