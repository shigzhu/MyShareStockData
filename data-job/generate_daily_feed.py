import argparse
import json
import sys
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from adapters.eastmoney import EastMoneyAdapter

BEIJING_TZ = timezone(timedelta(hours=8))


def beijing_today(now_utc: str | None = None) -> str:
    return beijing_now(now_utc).date().isoformat()


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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate the GitHub-hosted A-share recommendation feed.")
    parser.add_argument("--trade-date", help="Trade date in YYYY-MM-DD format. Defaults to Asia/Shanghai date.")
    parser.add_argument("--now-utc", help="UTC timestamp used only by tests to verify Asia/Shanghai date handling.")
    parser.add_argument(
        "--stage",
        choices=["premarket", "auction"],
        default="auction",
        help="premarket writes only 8:30 data; auction also writes 9:25 data.",
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
    parser.add_argument("--output-dir", default="data", help="Output directory for today.json and history files.")
    args = parser.parse_args()
    if not args.trade_date:
        args.trade_date = beijing_today(args.now_utc)
    return args


def load_fixture(path: Path, trade_date: str) -> dict:
    payload = json.loads(path.read_text(encoding="utf-8"))
    payload["tradeDate"] = trade_date
    return payload


def load_trading_day_input(args: argparse.Namespace, existing_feed: dict) -> tuple[dict, dict]:
    fixture_input = load_fixture(Path(args.fixture), args.trade_date)

    if args.source == "fixture":
        return fixture_input, {
            "mode": "SAMPLE_BOOTSTRAP",
            "description": "样本启动数据。仅用于本地测试或公开源不可用时的人工验证。",
            "providers": ["fixture"],
        }

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

        if args.stage == "auction" and "auctionInput" in existing_feed and is_late_auction_refresh(args):
            return pre_market_input, {
                **source,
                "mode": "REAL_PARTIAL_AUCTION_PRESERVED",
                "description": "东方财富公开行情已更新8:30准备池；因当前已过9:35，保留既有9:25竞价确认，避免下午行情覆盖竞价判断。",
            }

        if args.stage == "auction":
            return adapter.fetch_auction_input(args.trade_date, pre_market_input), source

        if "auctionInput" in existing_feed:
            return pre_market_input, source

        return pre_market_input, source
    except Exception as error:
        if args.stage == "auction" and "preMarketInput" in existing_feed:
            return existing_feed["preMarketInput"], {
                "mode": "REAL_PARTIAL_AUCTION_MISSING",
                "description": "8:30准备名单已保留，但9:25竞价公开源拉取失败；APK 应显示9:25缺关键数据。",
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
        "preMarketInput": pre_market_input
    }

    if source.get("mode") == "REAL_PARTIAL_AUCTION_PRESERVED" and "auctionInput" in existing_feed:
        feed["auctionInput"] = existing_feed["auctionInput"]
    elif stage == "auction" and source.get("mode") != "REAL_PARTIAL_AUCTION_MISSING":
        feed["auctionInput"] = auction_input
    elif "auctionInput" in existing_feed:
        feed["auctionInput"] = existing_feed["auctionInput"]

    return feed


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
    trading_day_input, source = load_trading_day_input(args, existing_feed)
    feed = build_feed(args.trade_date, trading_day_input, args.stage, source, beijing_timestamp(args.now_utc), existing_feed)
    write_feed(feed, output_dir)


if __name__ == "__main__":
    main()
