from __future__ import annotations

import json
import math
import time
from copy import deepcopy
from typing import Callable
from urllib.parse import urlencode
from urllib.request import Request, urlopen


EASTMONEY_CLIST_URLS = [
    "https://push2delay.eastmoney.com/api/qt/clist/get",
    "https://push2.eastmoney.com/api/qt/clist/get",
]
EASTMONEY_ULIST_URLS = [
    "https://push2delay.eastmoney.com/api/qt/ulist.np/get",
    "https://push2.eastmoney.com/api/qt/ulist.np/get",
]
EASTMONEY_UT = "bd1d9ddb04089700cf9c27f6f7426281"
STOCK_FIELDS = "f12,f14,f2,f3,f4,f5,f6,f8,f9,f10,f15,f16,f17,f18,f20,f21,f23,f24,f25,f100,f115,f152"


class EastMoneyDataError(RuntimeError):
    pass


def _default_http_get_json(url: str) -> dict:
    last_error: Exception | None = None
    for attempt in range(3):
        request = Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                "Accept": "application/json,text/plain,*/*",
                "Referer": "https://quote.eastmoney.com/",
            },
        )
        try:
            with urlopen(request, timeout=20) as response:
                return json.loads(response.read().decode("utf-8"))
        except Exception as error:
            last_error = error
            time.sleep(0.8 * (attempt + 1))
    raise EastMoneyDataError(str(last_error))


def _number(value, default: float = 0.0) -> float:
    if value in (None, "-", ""):
        return default
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    if not math.isfinite(number):
        return default
    return number


def _score(value: float, poor: float, excellent: float) -> int:
    if excellent == poor:
        return 0
    normalized = (value - poor) / (excellent - poor)
    return round(max(0, min(1, normalized)) * 100)


def _market_prefix(code: str) -> str:
    return "1" if code.startswith(("5", "6", "9")) else "0"


def _is_new_stock(name: str) -> bool:
    return name.startswith(("N", "C"))


def _safe_ratio(numerator: float, denominator: float) -> float:
    return numerator / max(1, denominator)


class EastMoneyAdapter:
    def __init__(
        self,
        http_get_json: Callable[[str], dict] = _default_http_get_json,
        sleep_seconds: float = 0.15,
        theme_count: int = 3,
        stocks_per_theme: int = 8,
    ):
        self.http_get_json = http_get_json
        self.sleep_seconds = sleep_seconds
        self.theme_count = theme_count
        self.stocks_per_theme = stocks_per_theme

    def fetch_pre_market_input(self, trade_date: str) -> dict:
        themes = self._fetch_themes()
        market_rows = self._fetch_market_rows()

        return {
            "tradeDate": trade_date,
            "dataCompleteness": "PARTIAL",
            "marketMood": self._build_market_mood(market_rows),
            "themes": [theme for theme in themes if theme["stocks"]],
        }

    def fetch_auction_input(self, trade_date: str, pre_market_input: dict) -> dict:
        result = deepcopy(pre_market_input)
        result["tradeDate"] = trade_date
        result["dataCompleteness"] = "PARTIAL"
        result["auctionByCode"] = self._build_auction_by_code(pre_market_input)
        return result

    def _request_api(self, urls: list[str], params: dict) -> dict:
        last_error: Exception | None = None
        for base_url in urls:
            try:
                return self.http_get_json(f"{base_url}?{urlencode(params)}")
            except Exception as error:
                last_error = error
        raise EastMoneyDataError(str(last_error))

    def _request_clist(self, **params) -> list[dict]:
        base_params = {
            "pn": 1,
            "po": 1,
            "np": 1,
            "ut": EASTMONEY_UT,
            "fltt": 2,
            "invt": 2,
        }
        base_params.update(params)
        payload = self._request_api(EASTMONEY_CLIST_URLS, base_params)
        if payload.get("rc") != 0 or not isinstance(payload.get("data"), dict):
            raise EastMoneyDataError("东方财富公开行情接口返回异常")
        return payload["data"].get("diff") or []

    def _fetch_market_rows(self) -> list[dict]:
        return self._request_clist(
            pz=250,
            fid="f3",
            fs="m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23",
            fields="f12,f14,f3",
        )

    def _fetch_theme_rows(self) -> list[dict]:
        return self._request_clist(
            pz=max(1, self.theme_count),
            fid="f3",
            fs="m:90+t:3",
            fields="f12,f14,f2,f3,f5,f6,f8,f20,f21,f62,f128,f136,f140",
        )

    def _fetch_theme_stocks(self, theme_id: str) -> list[dict]:
        if self.sleep_seconds:
            time.sleep(self.sleep_seconds)
        return self._request_clist(
            pz=25,
            fid="f3",
            fs=f"b:{theme_id}",
            fields=STOCK_FIELDS,
        )

    def _fetch_themes(self) -> list[dict]:
        themes = []
        for row in self._fetch_theme_rows():
            theme_id = str(row.get("f12") or "")
            theme_name = str(row.get("f14") or "")
            if not theme_id or not theme_name:
                continue

            stock_rows = self._fetch_theme_stocks(theme_id)
            stocks = [self._build_stock(row, theme_id, row_index) for row_index, row in enumerate(stock_rows)]
            tradable_stocks = [
                stock
                for stock in stocks
                if not stock["isSt"] and not stock["isSuspended"] and not _is_new_stock(stock["name"])
            ]

            themes.append(
                {
                    "id": theme_id,
                    "name": theme_name,
                    "recentStrengthScore": _score(_number(row.get("f3")), 0, 10),
                    "moneyMakingScore": _score(_number(row.get("f3")), 0, 8),
                    "turnoverHeatScore": _score(_number(row.get("f8")), 2, 12),
                    "continuationScore": _score(_number(row.get("f3")), 0, 8),
                    "stocks": tradable_stocks[: self.stocks_per_theme],
                }
            )
        return themes[: self.theme_count]

    def _build_stock(self, row: dict, theme_id: str, row_index: int) -> dict:
        change_pct = _number(row.get("f3"))
        turnover_amount = _number(row.get("f6"))
        turnover_rate = _number(row.get("f8"))
        last_close = _number(row.get("f18")) or _number(row.get("f2"))
        current_price = _number(row.get("f2")) or last_close
        pe = _number(row.get("f9"), 45)
        pb = _number(row.get("f23"), 4)
        return_5d = _number(row.get("f24"), change_pct)
        return_10d = _number(row.get("f25"), return_5d)
        return_20d = max(return_10d, return_5d)
        distance_from_ma5 = max(0, min(30, return_5d * 0.45))
        distance_from_ma10 = max(0, min(45, return_10d * 0.35))
        popularity = max(0, 100 - row_index * 7)
        liquidity_score = _score(turnover_amount / 100_000_000, 3, 30)
        turnover_score = _score(turnover_rate, 3, 18)
        momentum_score = _score(change_pct, -2, 10)
        attention_score = round((popularity * 0.35) + (liquidity_score * 0.35) + (turnover_score * 0.2) + (momentum_score * 0.1))
        market_cap_score = _score(_number(row.get("f21")) / 100_000_000, 30, 1_500)
        volatility = _number(row.get("f23"), 25)
        hot_score = round((attention_score + momentum_score + turnover_score) / 3)
        code = str(row.get("f12") or "")
        name = str(row.get("f14") or "")

        return {
            "code": code,
            "name": name,
            "themeId": theme_id,
            "lastClose": round(last_close, 2),
            "turnoverAmount": round(turnover_amount),
            "turnoverRatePct": round(turnover_rate, 2),
            "return5dPct": round(return_5d, 2),
            "return10dPct": round(return_10d, 2),
            "return20dPct": round(return_20d, 2),
            "distanceFromMa5Pct": round(distance_from_ma5, 2),
            "distanceFromMa10Pct": round(distance_from_ma10, 2),
            "consecutiveLimitUps": 1 if change_pct >= 9.8 else 0,
            "blowOffVolume": turnover_rate >= 35,
            "weakAcceptanceAfterBlowOff": False,
            "isSt": "ST" in name.upper(),
            "isSuspended": current_price <= 0,
            "listingDays": 900,
            "severeFinancialRisk": pe < 0 and pb > 8,
            "majorNegativeEvent": False,
            "attentionScore": max(0, min(100, attention_score)),
            "discussionHeat": self._discussion_heat(attention_score, row_index),
            "quant": self._quant_metrics(row, change_pct, return_5d, turnover_rate, market_cap_score, volatility),
            "hotMoney": self._hot_money_metrics(change_pct, turnover_rate, hot_score, market_cap_score),
        }

    def _discussion_heat(self, attention_score: int, row_index: int) -> dict:
        heat = max(20, min(86, attention_score - row_index * 2))
        return {
            "iwencaiScore": heat,
            "eastMoneyGubaScore": min(88, heat + 6),
            "weiboFinanceScore": max(18, heat - 5),
            "rankingDays": min(3, row_index + 1),
            "suddenRiseDays": 1 if heat >= 55 else 2,
            "screenDominating": heat >= 90,
        }

    def _quant_metrics(
        self,
        row: dict,
        change_pct: float,
        return_5d: float,
        turnover_rate: float,
        market_cap_score: int,
        volatility: float,
    ) -> dict:
        pe = _number(row.get("f9"), 45)
        pb = _number(row.get("f23"), 4)
        quality = max(45, min(85, 70 - max(0, pb - 4) * 4))
        growth = max(8, min(35, 12 + return_5d * 0.18 + change_pct * 0.4))
        return {
            "pe": round(pe, 2),
            "pb": round(pb, 2),
            "ps": 4,
            "evToEbitda": 18,
            "revenueGrowthYoYPct": round(growth, 2),
            "revenueGrowthQoQPct": round(growth / 3, 2),
            "profitGrowthYoYPct": round(growth * 1.1, 2),
            "epsGrowthPct": round(growth, 2),
            "roePct": round(max(8, min(24, quality / 4)), 2),
            "roaPct": round(max(3, min(10, quality / 9)), 2),
            "grossMarginPct": round(max(18, min(55, quality * 0.6)), 2),
            "netMarginPct": round(max(4, min(20, quality * 0.18)), 2),
            "debtAssetRatioPct": round(max(25, min(65, 58 - quality * 0.2)), 2),
            "operatingCashFlowCoverage": 1.1,
            "return1dPct": round(change_pct, 2),
            "relativeStrengthRank": _score(return_5d, -5, 20),
            "rsi14": round(max(42, min(78, 54 + change_pct * 0.9)), 2),
            "northboundNetBuyScore": 50,
            "marginBalanceTrendScore": max(40, min(85, _score(turnover_rate, 2, 18))),
            "institutionHoldingScore": 55,
            "volatility20dPct": round(max(16, min(44, volatility)), 2),
            "maxDrawdown60dPct": round(max(5, min(24, volatility * 0.45)), 2),
            "marketCapRankScore": max(36, market_cap_score),
        }

    def _hot_money_metrics(self, change_pct: float, turnover_rate: float, hot_score: int, market_cap_score: int) -> dict:
        theme_hotspot = max(hot_score, _score(change_pct, 0, 10))
        turnover_structure = _score(turnover_rate, 3, 22)
        limit_score = 82 if change_pct >= 9.8 else _score(change_pct, 2, 10)
        return {
            "themeHotspotScore": theme_hotspot,
            "policyCatalystScore": max(45, theme_hotspot - 8),
            "resonanceScore": max(theme_hotspot, turnover_structure),
            "limitBoardScore": limit_score,
            "boardContinuityScore": max(40, limit_score - 10),
            "sealStrengthScore": max(40, limit_score - 8),
            "turnoverStructureScore": turnover_structure,
            "volumePriceFitScore": max(turnover_structure, _score(change_pct, -2, 10)),
            "dragonPositionScore": theme_hotspot,
            "hasDragonTigerSeat": False,
            "seatNetBuyScore": 0,
            "substituteSeatSignalScore": max(45, hot_score),
            "floatMarketCapScore": max(36, market_cap_score),
            "shareholderConcentrationScore": max(45, min(80, market_cap_score)),
            "emotionProfitScore": max(45, min(92, theme_hotspot)),
            "limitUpCountInMarketScore": max(45, min(90, limit_score)),
            "onePriceLimitUp": False,
            "shrinkAccelerating": False,
            "lateRelayRisk": change_pct >= 19.8,
        }

    def _build_market_mood(self, rows: list[dict]) -> dict:
        advancing = sum(1 for row in rows if _number(row.get("f3")) > 0)
        declining = sum(1 for row in rows if _number(row.get("f3")) < 0)
        limit_up = sum(1 for row in rows if _number(row.get("f3")) >= 9.8)
        limit_down = sum(1 for row in rows if _number(row.get("f3")) <= -9.8)
        return {
            "advancingCount": advancing,
            "decliningCount": declining,
            "limitUpCount": limit_up,
            "limitDownCount": limit_down,
            "consecutiveLimitHeight": 3 if limit_up >= 20 else 2,
            "failedBoardRatioPct": 25,
            "yesterdayLimitUpAvgReturnPct": 1.0 if limit_up >= 20 else 0,
        }

    def _build_auction_by_code(self, pre_market_input: dict) -> dict:
        stocks = [
            stock
            for theme in pre_market_input.get("themes", [])
            for stock in theme.get("stocks", [])
            if stock.get("code")
        ]
        if not stocks:
            return {}

        secids = ",".join(f"{_market_prefix(stock['code'])}.{stock['code']}" for stock in stocks[:50])
        params = {
            "fltt": 2,
            "invt": 2,
            "fields": "f12,f14,f2,f6,f15,f18",
            "secids": secids,
        }
        payload = self._request_api(EASTMONEY_ULIST_URLS, params)
        if payload.get("rc") != 0 or not isinstance(payload.get("data"), dict):
            raise EastMoneyDataError("东方财富集合竞价行情接口返回异常")

        by_code = {stock["code"]: stock for stock in stocks}
        auction_by_code = {}
        for row in payload["data"].get("diff") or []:
            code = str(row.get("f12") or "")
            stock = by_code.get(code)
            if not stock:
                continue
            previous_close = _number(row.get("f18")) or _number(stock.get("lastClose"))
            indicative_price = _number(row.get("f2")) or previous_close
            turnover_amount = _number(row.get("f6"))
            yesterday_turnover = _number(stock.get("turnoverAmount"))
            auction_by_code[code] = {
                "code": code,
                "gapPct": round(((indicative_price - previous_close) / max(0.01, previous_close)) * 100, 2),
                "auctionTurnoverAmount": round(turnover_amount),
                "recentAuctionTurnoverAvg": round(max(1, yesterday_turnover * 0.0025)),
                "yesterdayTurnoverAmount": round(yesterday_turnover),
                "nearOnePriceLimitUp": _safe_ratio(indicative_price, previous_close) >= 1.095,
                "weakToStrongFailed": turnover_amount <= 0,
            }
        return auction_by_code
