# MyShareStockData 数据任务

这个目录用于 GitHub Actions 生成 APK 可读取的零成本 JSON 数据源。

## 输出地址

GitHub Pages 开启后，APK 默认读取：

```text
https://shigzhu.github.io/MyShareStockData/data/today.json
```

历史文件输出到：

```text
data/history/YYYY-MM-DD.json
```

## 当前状态

当前脚本使用 `fixtures/sample_trading_day.json` 生成数据，`source.mode` 会标记为 `SAMPLE_BOOTSTRAP`。这能先跑通“GitHub Actions 定时生成 JSON + APK 拉取 JSON”的完整链路，但还不是实盘数据。

后续接真实数据时，优先替换 `generate_daily_feed.py` 里的数据来源：

- 8:30：昨日收盘后的市场、题材、个股、讨论热度、量化数据。
- 9:25：集合竞价数据，只用于确认 8:30 池子。

## 本地运行

```powershell
python data-job/generate_daily_feed.py --trade-date 2026-05-25 --output-dir data
python -m unittest discover -s data-job/tests
```

## GitHub 设置

1. 把 `.github/workflows/daily-stock-data.yml`、`data-job/`、`data/` 推送到 `shigzhu/MyShareStockData`。
2. 在 GitHub 仓库进入 `Settings -> Pages`。
3. `Build and deployment` 选择 `Deploy from a branch`。
4. Branch 选择 `main`，目录选择 `/ (root)`。
5. 进入 `Actions`，手动运行 `Daily A-share stock data` 一次。

