from __future__ import annotations

from adapters.retry import retry_call


class AkShareDataError(RuntimeError):
    pass


def _number(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


class AkShareAdapter:
    def __init__(self, akshare_module=None):
        if akshare_module is None:
            try:
                import akshare as akshare_module  # type: ignore
            except Exception as error:
                raise AkShareDataError("AkShare未安装或不可用") from error
        self.akshare = akshare_module

    def fetch_financials(self, codes: list[str]) -> dict:
        result = {}
        for code in codes:
            try:
                frame = retry_call(lambda: self.akshare.stock_financial_analysis_indicator(symbol=code), sleep_seconds=0.2)
            except Exception as error:
                raise AkShareDataError(str(error)) from error

            if frame is None or len(frame) == 0:
                continue

            row = frame.iloc[0] if hasattr(frame, "iloc") else frame[0]
            result[code] = self._map_financial_row(row)
        return result

    def _map_financial_row(self, row) -> dict:
        def pick(*names: str) -> float:
            for name in names:
                try:
                    value = row[name]
                except Exception:
                    continue
                if value not in (None, ""):
                    return _number(value)
            return 0.0

        return {
            "roePct": pick("净资产收益率", "加权净资产收益率", "roe"),
            "grossMarginPct": pick("销售毛利率", "毛利率", "gross_margin"),
            "debtAssetRatioPct": pick("资产负债率", "debt_asset_ratio"),
            "revenueGrowthYoYPct": pick("主营业务收入增长率", "营业收入同比增长率", "revenue_growth"),
            "profitGrowthYoYPct": pick("净利润增长率", "归属母公司股东的净利润增长率", "profit_growth"),
        }
