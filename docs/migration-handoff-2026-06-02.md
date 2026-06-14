# A Share Stock Picker APK Migration Handoff

Updated: 2026-06-02, Asia/Shanghai.

This document is the handoff context for continuing the project from a different Codex/OpenAI account. It intentionally summarizes the long conversation into operational project knowledge.

## Project Identity

- Local repository: `C:\Users\76658\Documents\股神`
- Current working branch: `codex/a-share-stock-picker-apk`
- Remote repository: `https://github.com/shigzhu/MyShareStockData.git`
- GitHub Pages feed: `https://shigzhu.github.io/MyShareStockData/data/today.json`
- History feed pattern: `https://shigzhu.github.io/MyShareStockData/data/history/YYYY-MM-DD.json`
- Latest debug APK: `C:\Users\76658\Documents\股神\android\app\build\outputs\apk\debug\app-debug.apk`
- App type: React + Vite + Capacitor Android APK.
- Data pipeline type: GitHub Actions generates JSON, GitHub Pages hosts it, APK fetches it.

## User Goals

The user wants a daily China A-share stock-picking APK that:

- Runs on Android phone.
- Uses Beijing date and Beijing trading-time semantics.
- Generates a 24:00 premarket preparation list.
- Generates a 9:25 auction confirmation list.
- Recommends fewer stocks when signal quality is weak.
- At 24:00, if the market is tradable, guarantees at least three observation candidates: one primary and two backups.
- At 9:25, only confirms candidates with clear auction volume and price strength; no recommendation and staying in cash is acceptable.
- Keeps history folded by month, week, and day.
- Shows each recommendation's score breakdown, reasons, risks, and deletion controls.
- Avoids fake certainty: data status must distinguish success, failure, missing key data, sample fallback, and no recommendation.

Important user preference:

- Never modify computer drivers, USB devices, audio devices, or hardware-related settings without explicit approval.
- Do not ask for GitHub password. Use token or GitHub login flow if needed.
- The user prefers practical execution, clear status updates, and verification evidence.

## Current User-Facing Behavior

The APK currently:

- Displays the phone date as Beijing date.
- Shows `今日未开市，好好休息！` on weekends and configured holidays.
- Automatically refreshes when opened, focused, or once per minute while open.
- After 24:00, attempts to generate the 24:00 preparation list.
- After 9:25, attempts to generate the 9:25 auction confirmation.
- Saves local recommendation snapshots to browser/App local storage.
- Shows today's 24:00 and 9:25 primary candidates at the top.
- Shows historical recommendations grouped under one `历史推荐` section by month, week, and day.
- Lets the user delete individual recommendation cards with a reason.
- Lets the user record trade logs and export CSV.
- Shows review-learning and rule-suggestion panels from local persisted recommendation outcomes.

## Current Scoring Model

Hard filters are not scored. They remove candidates or mark risk:

- Non-trading date.
- ST/delisting risk.
- Suspension or abnormal trading status.
- Major negative event.
- Severe financial risk.
- Too new listing.
- Insufficient liquidity.
- Overheated short-term position.
- Theme leader weakening.

24:00 premarket score totals 100:

- 25 points: trading logic, including market environment, theme strength, turnover, liquidity, leader attention, not overheated.
- 20 points: hot-money logic, using the six hot-money dimensions discussed with the user.
- 20 points: quant factors, using the six quant dimensions discussed with the user.
- 15 points: cross-platform discussion heat, intended for iWencai, EastMoney Guba, and Weibo finance heat.
- 10 points: official signals, including announcements, exchange/public information, policy catalyst.
- 10 points: review feedback, local strategy learning and post-trade review.

9:25 auction score totals 100:

- 40 points: auction confirmation.
- 20 points: 24:00 score continuation.
- 15 points: theme and leader opening strength.
- 10 points: order-book or volume-price structure.
- 10 points: hot-money relay condition.
- 5 points: risk recheck, including sentiment not overheated and no new official risk.

Execution principle:

- 24:00 must produce at least three observation candidates when market conditions pass.
- 9:25 should stay empty if auction confirmation is not strong.
- The tool is an assistant for disciplined decision-making, not an investment guarantee.

## Data Architecture

The current low-cost architecture is:

1. GitHub Actions runs on a schedule.
2. `data-job/generate_daily_feed.py` generates feed JSON.
3. Generated files are committed into `data/`.
4. GitHub Pages exposes `data/today.json` and `data/history/YYYY-MM-DD.json`.
5. APK fetches JSON through `src/data/remoteJsonDataProvider.ts`.
6. App strategy engine turns raw feed input into 24:00 and 9:25 recommendations.

Scheduled stages in `.github/workflows/daily-stock-data.yml`:

- 18:00 Beijing: `overnight`, writes cache for the next trading date.
- 22:00 Beijing: `sentiment`, writes cache for the next trading date.
- 24:00 Beijing: `premarket`, publishes `today.json` and history JSON for the current Beijing trading date.
- 09:25 Beijing: `auction`, updates auction confirmation.

Cron is in UTC:

- `0 20 * * 0-4`
- `0 22 * * 0-4`
- `0 0 * * 1-5`
- `30 0 * * 1-5`
- `25 1 * * 1-5`

## Data Sources

Implemented or partially implemented:

- EastMoney public quote: default partial real market source.
- Tushare trade calendar: optional when `TUSHARE_TOKEN` exists.
- Tushare `daily_basic`: optional quant enrichment when `TUSHARE_TOKEN` exists.
- AkShare financial indicators: optional when AkShare is installed and `--enable-akshare` is passed.
- Discussion heat JSON file: optional `--sentiment-file` or `DISCUSSION_HEAT_FILE`.
- Auction JSON file: optional `--auction-file` or `AUCTION_FILE`.
- Static 2026 trading calendar fallback.

Current limitations:

- iWencai 2.0, EastMoney Guba, and Weibo finance heat are not yet automatically scraped.
- Auction data is not true stable Level-2 auction data unless an external auction file is supplied.
- EastMoney public quote is partial real data and can be delayed or incomplete.
- If public real source fails, the pipeline may write `SAMPLE_FALLBACK`; APK should treat it as missing/incomplete data, not as confident real recommendation.

## Recent Completed Fixes

Recent working-tree changes as of this handoff include:

- Added 3-attempt retry for APK remote JSON fetches.
- Added 3-attempt retry for EastMoney adapter requests.
- Added 3-attempt retry for Tushare adapter requests.
- Added 3-attempt retry for AkShare financial fetch per stock.
- Added 3-attempt retry for discussion heat file reads.
- Added 3-attempt retry for auction file reads.
- Added 3-attempt retry for GitHub Actions `git push`.
- Fixed duplicate history rendering. The UI now renders one `历史推荐` block and groups all plans by month, week, and day.
- Fixed history details open/closed state so stale days fold after date changes.

Verification already run for those fixes:

- `npm test`: 12 test files, 89 tests passed.
- `python -m unittest discover -s data-job\tests`: 30 tests passed, using bundled Python.
- `npm run android:apk`: build succeeded.

Latest APK after those fixes:

- `C:\Users\76658\Documents\股神\android\app\build\outputs\apk\debug\app-debug.apk`
- Last observed size: 4,289,277 bytes.
- Last observed modified time: 2026-05-31 00:50:36.

## Key Files

Frontend:

- `src/App.tsx`: main UI, refresh orchestration, history grouping, local state.
- `src/data/remoteJsonDataProvider.ts`: GitHub Pages JSON fetch provider.
- `src/data/defaultDataProvider.ts`: default remote feed base URL.
- `src/data/localReviewStore.ts`: local persistence for snapshots, deletions, trade logs, rule suggestions.
- `src/domain/intradayJobs.ts`: 24:00 and 9:25 refresh job orchestration.
- `src/domain/strategyEngine.ts`: recommendation scoring and candidate selection.
- `src/domain/tradingCalendar.ts`: Beijing date and A-share trading-day helpers.
- `src/domain/types.ts`: shared type model.

Frontend tests:

- `src/App.test.tsx`
- `src/data/remoteJsonDataProvider.test.ts`
- `src/domain/*.test.ts`

Data pipeline:

- `data-job/generate_daily_feed.py`: main feed generator.
- `data-job/adapters/eastmoney.py`: EastMoney public quote adapter.
- `data-job/adapters/tushare.py`: Tushare adapter.
- `data-job/adapters/akshare_adapter.py`: AkShare adapter.
- `data-job/adapters/sentiment_enrichment.py`: discussion heat file enrichment.
- `data-job/adapters/auction_enrichment.py`: auction file enrichment.
- `data-job/adapters/retry.py`: shared retry helper.
- `data-job/tests/*.py`: data pipeline tests.

Automation:

- `.github/workflows/daily-stock-data.yml`: scheduled GitHub Actions feed generation and push.

Docs:

- `docs/project-state.md`: older project status snapshot.
- `data-job/README.md`: data-job usage and GitHub Pages setup.
- `docs/migration-handoff-2026-06-02.md`: this handoff.

## Build And Test Commands

Run from:

```powershell
cd C:\Users\76658\Documents\股神
```

Frontend tests:

```powershell
npm test
```

Data pipeline tests with bundled Python:

```powershell
& 'C:\Users\76658\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m unittest discover -s data-job\tests
```

Web build:

```powershell
npm run build
```

APK build:

```powershell
npm run android:apk
```

Data generation examples:

```powershell
python data-job/generate_daily_feed.py --stage premarket --source eastmoney --output-dir data
python data-job/generate_daily_feed.py --stage auction --source eastmoney --output-dir data
python data-job/generate_daily_feed.py --stage auction --source fixture --output-dir data
```

If system `python` is broken, use the bundled Python path shown above.

## Git Commands

Check state:

```powershell
git status --short --branch
git log --oneline -8
```

Commit local changes:

```powershell
git add -A
git commit -m "docs: add migration handoff"
```

Push current branch:

```powershell
git push origin HEAD
```

If normal push has network/proxy trouble, this machine has previously needed:

```powershell
git -c http.proxy=http://localhost:15236 -c https.proxy=http://localhost:15236 push origin HEAD
```

Do not use GitHub account password in terminal. Use Git Credential Manager, browser login, or a token.

## New Account Startup Prompt

When continuing from a new account, start with:

```text
请先阅读 C:\Users\76658\Documents\股神\docs\migration-handoff-2026-06-02.md、
C:\Users\76658\Documents\股神\docs\project-state.md、
C:\Users\76658\Documents\股神\data-job\README.md。
然后检查 git status、运行测试，继续维护这个 A 股 APK 项目。
重要限制：未经我批准，不要修改电脑驱动、USB、音频或任何硬件设备设置。
```

## If GitHub Account Also Changes

To mirror the repository to a new GitHub account:

```powershell
cd C:\Users\76658\Documents
git clone --mirror https://github.com/shigzhu/MyShareStockData.git MyShareStockData.git
cd MyShareStockData.git
git push --mirror https://github.com/NEW_ACCOUNT/NEW_REPO.git
```

After mirroring:

- Enable GitHub Pages on the new repository.
- Use `main` branch and root directory for Pages.
- Enable Actions write permission.
- Recreate secrets such as `TUSHARE_TOKEN`.
- Update `src/data/defaultDataProvider.ts` if the GitHub Pages URL changes.
- Rebuild APK so the phone app points to the new feed URL.

## Important Risks And Gaps

Highest-priority product/data gaps:

- Real iWencai 2.0 heat adapter.
- Real EastMoney Guba heat adapter.
- Real Weibo finance heat adapter.
- Stable 9:25 auction/Level-2 data source.
- More reliable trading calendar beyond static 2026.
- Stronger data provenance display in APK, including generated time, source mode, and source limitations.
- More explicit “not recommended” explanation at 9:25.

Engineering risks:

- GitHub Actions public network access may intermittently fail against Chinese market data sources.
- GitHub scheduled jobs can be delayed, so 24:00 and 9:25 are target times, not hard real-time guarantees.
- Public quote APIs can change fields without warning.
- If `today.json` is stale or missing, APK falls back to history or stale observation logic; this must remain visible to the user.
- Debug APK is unsigned for production distribution; for regular use, consider release signing later.

## Safety And Boundaries

The user explicitly reported prior concern about drivers and USB behavior. Preserve this rule:

- Read-only diagnosis is acceptable.
- Do not install, uninstall, enable, disable, update, roll back, or modify any driver, device, USB controller, audio device, or hardware-related setting without explicit user approval.
- Do not run broad destructive commands such as `git reset --hard`.
- Do not overwrite user changes without checking `git status` and reading relevant diffs.

## Current State At Handoff Creation

At the time this document was created:

- Branch: `codex/a-share-stock-picker-apk`.
- There were uncommitted code changes from the retry and history-grouping work.
- The handoff document itself was newly added.
- Before claiming final migration readiness, run:

```powershell
npm test
& 'C:\Users\76658\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m unittest discover -s data-job\tests
npm run android:apk
git status --short --branch
```


