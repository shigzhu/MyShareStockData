# A股荐股 APK 项目状态

更新时间：2026-05-27，北京时间。

## 项目位置

- 本地仓库：`C:\Users\76658\Documents\股神`
- 当前分支：`codex/a-share-stock-picker-apk`
- 远程仓库：`https://github.com/shigzhu/MyShareStockData.git`
- GitHub Pages 数据地址：`https://shigzhu.github.io/MyShareStockData/data/today.json`
- 历史数据地址格式：`https://shigzhu.github.io/MyShareStockData/data/history/YYYY-MM-DD.json`
- 最新调试 APK：`C:\Users\76658\Documents\股神\android\app\build\outputs\apk\debug\app-debug.apk`

## 已完成的关键行为

- App 日期和交易日逻辑按北京时间当天计算。
- 8:30 打开或补偿刷新时，拉取昨日收盘后的市场、题材、个股、讨论热度、量化和游资数据，生成准备名单。
- 市场可交易但严格过滤后无票时，8:30 至少生成 1 只“保底观察首推”。
- 9:25 打开或补偿刷新时，结合集合竞价数据，只对 8:30 池子重新确认排名。
- 9:25 可以接受“不推荐、保持空仓”，不会因为 8:30 池子为空直接报失败。
- 远程 `today.json` 过期时，会追加缓存破坏参数并回退读取 `data/history/YYYY-MM-DD.json`。
- 数据状态需要清楚展示：成功、失败、缺关键数据、不推荐。
- 每日首推优先显示；过期日期下的首推和准备名单全部折叠。
- 每条推荐名单都有删除入口。

## 当前线上数据状态

- 2026-05-27 已验证线上 `today.json` 和 `data/history/2026-05-27.json` 可访问。
- 已验证模拟北京时间 2026-05-27 08:35 时，默认远程 provider 产生：
  - `8:30 SUCCESS`
  - `candidateCount: 1`
  - 首推：`002185 华天科技`
- 当前数据模式仍是 `REAL_PARTIAL`，不是完整实盘数据源闭环。

## 打分逻辑

- 硬过滤不占分：开市日期、ST/退市/停牌、重大利空公告、监管问询或处罚、减持解禁、财务爆雷、流动性过低、题材龙头明显走弱。
- 8:30 预选采用 100 分：25% 交易主逻辑，20% 游资逻辑，20% 量化维度，15% 跨平台讨论热度，10% 官方公告/交易所公开信息/政策催化，10% 历史复盘胜率和个人策略反馈。
- 9:25 确认采用 100 分：40% 集合竞价确认，20% 8:30 原始综合分延续，15% 题材和龙头开盘状态，10% 个股盘口/量价结构，10% 游资接力条件，5% 舆情不过热和公告风险复核。
- 核心执行原则：8:30 至少给 1 只观察首推；9:25 必须竞价强确认，否则宁可空仓。

## 数据源和后端策略

- 短期采用低成本方案：GitHub Actions 定时生成 JSON，GitHub Pages 托管，APK 每天按北京时间读取远程 JSON。
- 手机安装 APK 后不需要每天手动进入 GitHub 启动；只要 GitHub Actions 定时任务和 Pages 正常，APK 打开时会自动读取当天数据并补偿刷新。
- 数据任务拆成 5 个北京时间阶段：04:00 `overnight` 写慢变量缓存，06:00 `sentiment` 写热度缓存，08:00 `premarket-scan` 写题材和候选池缓存，08:30 `premarket` 汇总发布准备名单，09:25 `auction` 只对 8:30 池子做竞价确认。
- 04:00/06:00/08:00 批次写入 `data/cache/YYYY-MM-DD.json`，8:30 再发布 `data/today.json` 和 `data/history/YYYY-MM-DD.json`，避免 8:30 从零抓全量数据。
- 仍需持续完善的数据源适配器包括：AkShare、Tushare、东方财富行情、讨论热度、9:25 集合竞价。
- 还应优先补充：交易所公开信息/龙虎榜/融资融券、巨潮资讯公告风险、真实 Level-2 或稳定竞价数据、雪球/淘股吧/财联社等舆情源、复盘胜率数据闭环。

## 构建和验证命令

- 前端测试：`npm test`
- 前端构建：`npm run build`
- Android 同步：`npm run android:sync`
- APK 构建：`npm run android:apk`
- 数据任务测试：进入 `data-job` 后运行对应 Python 测试。

## Git 注意事项

- 推送 GitHub 在本机常需要代理：
  `git -c http.proxy=http://localhost:15236 -c https.proxy=http://localhost:15236 push origin HEAD:main`
- 已知主功能修复提交：`d4d91a5 fix: harden daily refresh timing`
- 已知 GitHub Pages 数据提交：`96311ad data: update daily stock feed`

## 长期安全规则

- 未经用户明确批准，禁止修改电脑驱动、设备驱动、USB 控制器、音频驱动或任何硬件设备状态。
- 禁止在未获批准前安装、卸载、更新、回滚、禁用、启用驱动，或删除设备实例。
- 只读诊断可以执行；涉及驱动或设备状态变更时必须先询问用户。

## 本机 MCP 配置

- Filesystem MCP：只允许访问 `C:\Users\76658\Documents\股神`。
- Git MCP：只绑定本仓库 `C:\Users\76658\Documents\股神`。
- GitHub MCP：使用 GitHub 官方远程地址 `https://api.githubcopilot.com/mcp/`，读取环境变量 `GITHUB_PAT_TOKEN`。
- Memory MCP：持久化文件为 `C:\Users\76658\.codex\mcp-memory\memory.jsonl`。
- Time MCP：本地时区固定为 `Asia/Shanghai`。
- GitHub MCP 需要用户自行生成并设置 `GITHUB_PAT_TOKEN`，不要在对话里发送 GitHub 密码。

## 后续优先事项

- 补全真实数据源适配器，并区分真实、样本、部分真实数据。
- 增强 8:30 和 9:25 的异常解释，让“不推荐”能说明原因。
- 给 APK 增加更明显的数据日期、数据来源、生成时间和远程状态提示。
- 保留轻量复盘数据，用实际表现反向调整权重和过滤阈值。
