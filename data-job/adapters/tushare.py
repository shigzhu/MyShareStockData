from __future__ import annotations

import json
from typing import Callable
from urllib.request import Request, urlopen


TUSHARE_URL = "https://api.tushare.pro"


class TushareDataError(RuntimeError):
    pass


def _default_http_post_json(payload: dict) -> dict:
    request = Request(
        TUSHARE_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def _yyyymmdd(trade_date: str) -> str:
    return trade_date.replace("-", "")


def _code_to_ts_code(code: str) -> str:
    suffix = "SH" if code.startswith(("5", "6", "9")) else "SZ"
    return f"{code}.{suffix}"


def _code_from_ts_code(ts_code: str) -> str:
    return ts_code.split(".")[0]


def _score(value: float, poor: float, excellent: float) -> int:
    if excellent == poor:
        return 0
    normalized = (value - poor) / (excellent - poor)
    return round(max(0, min(1, normalized)) * 100)


class TushareAdapter:
    def __init__(self, token: str, http_post_json: Callable[[dict], dict] = _default_http_post_json):
        self.token = token
        self.http_post_json = http_post_json

    def _call(self, api_name: str, params: dict, fields: str) -> dict:
        payload = {
            "api_name": api_name,
            "token": self.token,
            "params": params,
            "fields": fields,
        }
        response = self.http_post_json(payload)
        if response.get("code") != 0 or not isinstance(response.get("data"), dict):
            raise TushareDataError(str(response.get("msg") or "Tushare接口返回异常"))
        return response["data"]

    def fetch_trading_status(self, trade_date: str) -> dict:
        data = self._call(
            "trade_cal",
            {"exchange": "SSE", "cal_date": _yyyymmdd(trade_date)},
            "cal_date,is_open",
        )
        fields = data.get("fields") or []
        rows = data.get("items") or []
        if not rows:
            raise TushareDataError("Tushare交易日历未返回数据")
        row = dict(zip(fields, rows[0]))
        return {
            "isTradingDay": str(row.get("is_open")) == "1",
            "message": "Tushare交易日历",
        }

    def fetch_daily_basic(self, trade_date: str, codes: list[str]) -> dict:
        if not codes:
            return {}

        data = self._call(
            "daily_basic",
            {"trade_date": _yyyymmdd(trade_date), "ts_code": ",".join(_code_to_ts_code(code) for code in codes)},
            "ts_code,turnover_rate,pe,pb,total_mv,circ_mv",
        )
        fields = data.get("fields") or []
        result = {}
        for item in data.get("items") or []:
            row = dict(zip(fields, item))
            code = _code_from_ts_code(str(row.get("ts_code") or ""))
            total_mv = float(row.get("total_mv") or 0)
            circ_mv = float(row.get("circ_mv") or 0)
            result[code] = {
                "turnoverRatePct": float(row.get("turnover_rate") or 0),
                "pe": float(row.get("pe") or 0),
                "pb": float(row.get("pb") or 0),
                "marketCapRankScore": _score(max(total_mv, circ_mv), 300_000, 9_000_000),
            }
        return result
