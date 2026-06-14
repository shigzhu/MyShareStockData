import argparse
import json
import os
import sys
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from adapters.eastmoney import EastMoneyAdapter
from adapters.akshare_adapter import AkShareAdapter, AkShareDataError
from adapters.auction_enrichment import apply_auction_file
from adapters.quant_enrichment import apply_akshare_financials, apply_tushare_daily_basic
from adapters.sentiment_enrichment import apply_discussion_heat_file
from adapters.tushare import TushareAdapter, TushareDataError

BEIJING_TZ = timezone(timedelta(hours=8))
BATCH_STAGES = {"overnight", "sentiment", "premarket-scan"}
PUBLISH_STAGES = {"premarket", "auction"}
ALL_STAGES = sorted(BATCH_STAGES | PUBLISH_STAGES)


def beijing_today(now_utc: str | None = None) -> str:
    return beijing_now(now_utc).date().isoformat()


def next_trading_date(now_utc: str | None = None) -> str:
    current = beijing_now(now_utc).date() + timedelta(days=1)
    for _ in range(370):
        trade_date = current.isoformat()
        if static_trading_status(trade_date)["isTradingDay"]:
            return trade_date
        current += timedelta(days=1)
    raise RuntimeError("无法找到下一个交易日")


def beijing_timestamp(now_utc: str | None = None) -> str:
    return beijing_now(now_utc).replace(microsecond=0).isoformat()


def beijing_now(now_utc: str | None = None) -> datetime:
    if now_utc:
        normalized = now_utc.replace("Z", "+00:00")
        current = datetime.fromisoformat(normalized)
        if current.tzinfo is None:
            current = current.replace(tzinfo=timezone.utc)
    else:
        current = datetime.now(timezone.utc)

    return current.astimezone(BEIJING_TZ)


def is_late_auction_refresh(args: argparse.Namespace) -> bool:
    now = beijing_now(args.now_utc)
    return args.stage == "auction" and (now.hour, now.minute) > (9, 35)


def is_missed_auction_window(args: argparse.Namespace, existing_feed: dict) -> bool:
    return args.stage == "auction" and "auctionInput" not in existing_feed and is_late_auction_refresh(args)


def is_batch_stage(stage: str) -> bool:
    return stage in BATCH_STAGES


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate the GitHub-hosted A-share recommendation feed.")
    parser.add_argument("--trade-date", help="Trade date in YYYY-MM-DD format. Defaults to Asia/Shanghai date.")
    parser.add_argument(
        "--next-trading-date",
        action="store_true",
        help="Use the next A-share trading date. Intended for previous-evening 18:00 and 22:00 batch jobs.",
    )
    parser.add_argument("--now-utc", help="UTC timestamp used only by tests to verify Asia/Shanghai date handling.")
    parser.add_argument(
        "--stage",
        choices=ALL_STAGES,
        default="auction",
        help="Batch stages write cache; premarket publishes 24:00; auction publishes 9:25.",
    )
    parser.add_argument(
        "--fixture",
        default=str(Path(__file__).with_name("fixtures") / "sample_trading_day.json"),
        help="Bootstrap TradingDayInput JSON fixture.",
    )
    parser.add_argument(
        "--source",
        choices=["eastmoney", "fixture"],
        default="eastmoney",
        help="Data source. eastmoney uses public quote APIs; fixture is only for bootstrap/testing.",
    )
    parser.add_argument("--eastmoney-theme-count", type=int, default=3, help="Number of EastMoney concept themes to fetch.")
    parser.add_argument("--eastmoney-stocks-per-theme", type=int, default=8, help="Number of stocks kept per theme.")
    parser.add_argument("--tushare-token", default=os.environ.get("TUSHARE_TOKEN", ""), help="Optional Tushare token.")
    parser.add_argument("--enable-akshare", action="store_true", help="Try AkShare financial enrichment when installed.")
    parser.add_argument(
        "--sentiment-file",
        default=os.environ.get("DISCUSSION_HEAT_FILE", ""),
        help="Optional JSON file exported from iWencai/Guba/Weibo heat collection.",
    )
    parser.add_argument(
        "--auction-file",
        default=os.environ.get("AUCTION_FILE", ""),
        help="Optional 9:25 auction JSON exported from a stable auction/Level-2 provider.",
    )
    parser.add_argument("--output-dir", default="data", help="Output directory for today.json and history files.")
    args = parser.parse_args()
    if not args.trade_date:
        args.trade_date = next_trading_date(args.now_utc) if args.next_trading_date else beijing_today(args.now_utc)
    return args


def load_fixture(path: Path, trade_date: str) -> dict:
    payload = json.loads(path.read_text(encoding="utf-8"))
    payload["tradeDate"] = trade_date
    return payload


def static_trading_status(trade_date: str) -> dict:
    closed_ranges = [
        ("2026-01-01", "2026-01-03"),
        ("2026-02-15", "2026-02-23"),
        ("2026-04-04", "2026-04-06"),
        ("2026-05-01", "2026-05-05"),
        ("2026-06-19", "2026-06-21"),
        ("2026-09-25", "2026-09-27"),
        ("2026-10-01", "2026-10-07"),
    ]
    date = datetime.fromisoformat(trade_date).date()
    is_weekday = date.weekday() < 5
    is_closed = any(start <= trade_date <= end for start, end in closed_ranges)
    is_trading_day = is_weekday and not is_closed
    return {
        "isTradingDay": is_trading_day,
        "message": "交易日历已同步" if is_trading_day else "今日未开市，好好休息！",
        "source": "static_2026",
    }


def load_trading_status(args: argparse.Namespace) -> tuple[dict, str]:
    if args.tushare_token:
        try:
            status = TushareAdapter(args.tushare_token).fetch_trading_status(args.trade_date)
            return {**status, "source": "tushare_trade_cal"}, "tushare_trade_cal"
        except TushareDataError:
            pass

    return static_trading_status(args.trade_date), "static_2026"


def load_cache(output_dir: Path, trade_date: str) -> dict:
    cache_path = output_dir / "cache" / f"{trade_date}.json"
    if not cache_path.exists():
        return {}

    try:
        cache = json.loads(cache_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}

    if cache.get("tradeDate") != trade_date:
        return {}

    return cache


def write_cache(
    output_dir: Path,
    trade_date: str,
    stage: str,
    trading_day_input: dict,
    source: dict,
    generated_at: str,
    existing_cache: dict | None = None,
) -> None:
    cache_dir = output_dir / "cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    existing_cache = existing_cache or {}
    stages = {
        **existing_cache.get("stages", {}),
        stage: {
            "generatedAt": generated_at,
            "sourceMode": source.get("mode"),
            "description": source.get("description"),
        },
    }
    cache = {
        "schemaVersion": 1,
        "tradeDate": trade_date,
        "generatedAt": generated_at,
        "source": source,
        "stages": stages,
        "preMarketInput": deepcopy(trading_day_input),
    }
    (cache_dir / f"{trade_date}.json").write_text(json.dumps(cache, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def source_with_pipeline_metadata(source: dict, stage: str, cache: dict) -> dict:
    return {
        **source,
        "pipelineStage": stage,
        "cacheStages": sorted((cache.get("stages") or {}).keys()),
    }


def source_with_missed_auction_metadata(source: dict) -> dict:
    return {
        **source,
        "mode": "AUCTION_WINDOW_MISSED",
        "description": "当前已过9:35且不存在有效9:25竞价确认，保留24:00准备名单，不用盘中行情补写竞价。",
        "auctionFailureReason": "错过9:25有效竞价采集窗口",
    }


def missing_auction_input_from_pre_market(pre_market_input: dict | None) -> dict | None:
    if not pre_market_input:
        return None

    auction_input = deepcopy(pre_market_input)
    auction_input["dataCompleteness"] = "MISSING"
    auction_input["auctionByCode"] = {}
    return auction_input


def stock_codes_from_input(trading_day_input: dict) -> list[str]:
    return sorted(
        {
            str(stock.get("code"))
            for theme in trading_day_input.get("themes", [])
            for stock in theme.get("stocks", [])
            if stock.get("code")
        }
    )


def enrich_quant_data(args: argparse.Namespace, trading_day_input: dict, source: dict) -> tuple[dict, dict]:
    enriched = trading_day_input
    source = deepcopy(source)
    providers = list(source.get("providers", []))
    limitations = list(source.get("limitations", []))
    codes = stock_codes_from_input(trading_day_input)

    if args.tushare_token and codes:
        try:
            daily_basic = TushareAdapter(args.tushare_token).fetch_daily_basic(args.trade_date, codes)
            enriched = apply_tushare_daily_basic(enriched, daily_basic)
            providers.append("tushare_daily_basic")
        except TushareDataError as error:
            limitations.append(f"Tushare daily_basic增强失败：{error}")

    if args.enable_akshare and codes:
        try:
            financials = AkShareAdapter().fetch_financials(codes)
            enriched = apply_akshare_financials(enriched, financials)
            providers.append("akshare_financial_indicator")
        except AkShareDataError as error:
            limitations.append(f"AkShare财务增强失败：{error}")

    return enriched, {
        **source,
        "providers": sorted(set(providers)),
        "limitations": limitations,
    }


def enrich_discussion_heat(args: argparse.Namespace, trading_day_input: dict, source: dict) -> tuple[dict, dict]:
    if not args.sentiment_file:
        return trading_day_input, source

    sentiment_path = Path(args.sentiment_file)
    if not sentiment_path.exists():
        return trading_day_input, {
            **source,
            "limitations": [*source.get("limitations", []), f"讨论热度文件不存在：{sentiment_path}"],
        }

    return apply_discussion_heat_file(trading_day_input, sentiment_path), {
        **source,
        "providers": sorted(set([*source.get("providers", []), "discussion_heat_file"])),
    }


def enrich_auction(args: argparse.Namespace, trading_day_input: dict, source: dict) -> tuple[dict, dict]:
    if not args.auction_file or args.stage != "auction":
        return trading_day_input, source

    auction_path = Path(args.auction_file)
    if not auction_path.exists():
        return trading_day_input, {
            **source,
            "limitations": [*source.get("limitations", []), f"竞价文件不存在：{auction_path}"],
        }

    return apply_auction_file(trading_day_input, auction_path), {
        **source,
        "providers": sorted(set([*source.get("providers", []), "auction_file"])),
    }


def load_trading_day_input(args: argparse.Namespace, existing_feed: dict) -> tuple[dict, dict]:
    fixture_input = load_fixture(Path(args.fixture), args.trade_date)

    if args.source == "fixture":
        source = {
            "mode": "SAMPLE_BOOTSTRAP",
            "description": "样本启动数据。仅用于本地测试或公开源不可用时的人工验证。",
            "providers": ["fixture"],
        }
        return fixture_input, source

    try:
        if args.eastmoney_theme_count <= 0:
            raise RuntimeError("东方财富题材数量参数必须大于0")

        adapter = EastMoneyAdapter(
            theme_count=args.eastmoney_theme_count,
            stocks_per_theme=args.eastmoney_stocks_per_theme,
        )
        pre_market_input = adapter.fetch_pre_market_input(args.trade_date)
        if not pre_market_input.get("themes"):
            raise RuntimeError("东方财富公开源没有返回可用题材")

        source = {
            "mode": "REAL_PARTIAL",
            "description": "东方财富公开行情生成的部分真实数据；讨论热度、部分量化和竞价字段为公开行情派生估算。",
            "providers": ["eastmoney_public_quote"],
            "limitations": [
                "跨平台讨论热度暂未接入问财/股吧/微博真实榜单",
                "9:25竞价字段来自公开行情快照派生，缺失时会标记为关键数据不足",
                "财务量化字段使用公开行情可得字段派生，后续可接入 Tushare 增强",
            ],
        }
        pre_market_input, source = enrich_quant_data(args, pre_market_input, source)
        pre_market_input, source = enrich_discussion_heat(args, pre_market_input, source)

        if args.stage == "auction" and is_missed_auction_window(args, existing_feed):
            return pre_market_input, source_with_missed_auction_metadata(source)

        if args.stage == "auction" and "auctionInput" in existing_feed and is_late_auction_refresh(args):
            return pre_market_input, {
                **source,
                "mode": "REAL_PARTIAL_AUCTION_PRESERVED",
                "description": "东方财富公开行情已更新24:00准备池；因当前已过9:35，保留既有9:25竞价确认，避免下午行情覆盖竞价判断。",
            }

        if args.stage == "auction":
            auction_input = adapter.fetch_auction_input(args.trade_date, pre_market_input)
            return enrich_auction(args, auction_input, source)

        if "auctionInput" in existing_feed:
            return pre_market_input, source

        return pre_market_input, source
    except Exception as error:
        if args.stage == "auction" and "preMarketInput" in existing_feed:
            return existing_feed["preMarketInput"], {
                "mode": "REAL_PARTIAL_AUCTION_MISSING",
                "description": "24:00准备名单已保留，但9:25竞价公开源拉取失败；APK 应显示9:25缺关键数据。",
                "providers": existing_feed.get("source", {}).get("providers", ["eastmoney_public_quote"]),
                "limitations": existing_feed.get("source", {}).get("limitations", []),
                "auctionFailureReason": str(error),
            }

        fixture_input["dataCompleteness"] = "MISSING"
        return fixture_input, {
            "mode": "SAMPLE_FALLBACK",
            "description": "真实公开源拉取失败，已写入样本兜底数据；APK 应显示缺关键数据，不应按实盘推荐使用。",
            "providers": ["fixture"],
            "fallbackReason": str(error),
        }


def load_existing_feed(output_dir: Path, trade_date: str) -> dict:
    today_path = output_dir / "today.json"

    if not today_path.exists():
        return {}

    try:
        existing = json.loads(today_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}

    if existing.get("tradeDate") != trade_date:
        return {}

    return existing


def build_feed(
    trade_date: str,
    trading_day_input: dict,
    stage: str,
    source: dict,
    generated_at: str,
    trading_status: dict,
    existing_feed: dict | None = None,
) -> dict:
    pre_market_input = deepcopy(trading_day_input)
    auction_input = deepcopy(trading_day_input)
    if source.get("mode") in {"SAMPLE_BOOTSTRAP", "SAMPLE_FALLBACK"}:
        auction_input["dataCompleteness"] = "MANUAL_AUCTION" if source.get("mode") == "SAMPLE_BOOTSTRAP" else "MISSING"
    existing_feed = existing_feed or {}

    feed = {
        "schemaVersion": 1,
        "tradeDate": trade_date,
        "generatedAt": generated_at,
        "source": source,
        "tradingStatus": trading_status,
        "preMarketInput": pre_market_input
    }

    missing_auction_base = existing_feed.get("preMarketInput")
    if source.get("mode") == "AUCTION_WINDOW_MISSED" and source.get("providers") != ["fixture"]:
        missing_auction_base = missing_auction_base or pre_market_input
    missing_auction_input = missing_auction_input_from_pre_market(missing_auction_base)

    if source.get("mode") == "REAL_PARTIAL_AUCTION_PRESERVED" and "auctionInput" in existing_feed:
        feed["auctionInput"] = existing_feed["auctionInput"]
    elif stage == "auction" and source.get("mode") in {"REAL_PARTIAL_AUCTION_MISSING", "AUCTION_WINDOW_MISSED"} and missing_auction_input:
        feed["auctionInput"] = missing_auction_input
    elif stage == "auction" and source.get("mode") not in {"REAL_PARTIAL_AUCTION_MISSING", "AUCTION_WINDOW_MISSED"}:
        feed["auctionInput"] = auction_input
    elif "auctionInput" in existing_feed:
        feed["auctionInput"] = existing_feed["auctionInput"]

    return feed


def build_closed_feed(trade_date: str, stage: str, source: dict, generated_at: str, trading_status: dict) -> dict:
    return {
        "schemaVersion": 1,
        "tradeDate": trade_date,
        "generatedAt": generated_at,
        "source": source,
        "tradingStatus": trading_status,
    }


def write_feed(feed: dict, output_dir: Path) -> None:
    history_dir = output_dir / "history"
    history_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)

    text = json.dumps(feed, ensure_ascii=False, indent=2)
    (output_dir / "today.json").write_text(text + "\n", encoding="utf-8")
    (history_dir / f"{feed['tradeDate']}.json").write_text(text + "\n", encoding="utf-8")


def main() -> None:
    args = parse_args()
    output_dir = Path(args.output_dir)
    existing_feed = load_existing_feed(output_dir, args.trade_date)
    existing_cache = load_cache(output_dir, args.trade_date)
    trading_status, calendar_source = load_trading_status(args)
    trading_day_input, source = load_trading_day_input(args, existing_feed)
    generated_at = beijing_timestamp(args.now_utc)

    source = {
        **source,
        "calendarProvider": calendar_source,
    }

    if is_batch_stage(args.stage):
        write_cache(output_dir, args.trade_date, args.stage, trading_day_input, source, generated_at, existing_cache)
        return

    if existing_cache.get("preMarketInput") and args.stage == "premarket":
        trading_day_input = existing_cache["preMarketInput"]

    fixture_bootstrap_without_existing_feed = source.get("mode") == "SAMPLE_BOOTSTRAP" and not existing_feed
    if is_missed_auction_window(args, existing_feed) and not fixture_bootstrap_without_existing_feed:
        source = source_with_missed_auction_metadata(source)

    source = source_with_pipeline_metadata(source, args.stage, existing_cache)
    if not trading_status.get("isTradingDay", True):
        feed = build_closed_feed(args.trade_date, args.stage, source, generated_at, trading_status)
    else:
        feed = build_feed(args.trade_date, trading_day_input, args.stage, source, generated_at, trading_status, existing_feed)
    write_feed(feed, output_dir)


if __name__ == "__main__":
    main()
