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

当前脚本默认使用东方财富公开行情接口生成部分真实数据，`source.mode` 会标记为 `REAL_PARTIAL`。

目前已经覆盖：

- 8:30：市场涨跌家数、热门概念、概念内个股行情、成交额、换手率、涨跌幅、代码名称匹配。
- 9:25：只对 8:30 池子拉取公开行情快照，派生竞价确认字段。

仍需后续增强：

- 问财 2.0、东方财富股吧、微博财经的真实跨平台讨论热度。
- Tushare 或其它授权源的财务量化字段。
- 更稳定的 9:25 集合竞价专用数据源。

如果公开源失败，脚本会写入样本兜底数据并标记为 `SAMPLE_FALLBACK`，同时把输入数据完整性标为 `MISSING`。APK 应展示缺关键数据，不应把它当实盘推荐。

## 本地运行

```powershell
python data-job/generate_daily_feed.py --trade-date 2026-05-25 --stage premarket --source eastmoney --output-dir data
python data-job/generate_daily_feed.py --trade-date 2026-05-25 --stage auction --source eastmoney --output-dir data
python -m unittest discover -s data-job/tests
```

测试或离线验证时可使用 fixture：

```powershell
python data-job/generate_daily_feed.py --trade-date 2026-05-25 --stage auction --source fixture --output-dir data
```

## GitHub 设置

1. 把 `.github/workflows/daily-stock-data.yml`、`data-job/`、`data/` 推送到 `shigzhu/MyShareStockData`。
2. 在 GitHub 仓库进入 `Settings -> Pages`。
3. `Build and deployment` 选择 `Deploy from a branch`。
4. Branch 选择 `main`，目录选择 `/ (root)`。
5. 进入 `Actions`，手动运行 `Daily A-share stock data` 一次。
