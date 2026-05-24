# GitHub JSON Data Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the APK read daily recommendation inputs from a zero-cost GitHub-hosted JSON feed, and add a GitHub Actions data-job skeleton that publishes that feed twice each trading morning.

**Architecture:** Keep the strategy engine inside the APK. GitHub Actions produces `data/today.json` and `data/history/YYYY-MM-DD.json` containing `TradingDayInput` payloads for 8:30 and 9:25. The APK uses a `RemoteJsonDataProvider` to fetch those payloads by stage, validate the JSON shape, and fall back to the local sample provider when the feed is unavailable.

**Tech Stack:** React, TypeScript, Vitest, Vite/Capacitor, Python 3 standard library, GitHub Actions.

---

### Task 1: Remote Feed Contract

**Files:**
- Create: `src/data/remoteJsonDataProvider.test.ts`
- Create: `src/data/remoteJsonDataProvider.ts`
- Modify: `src/domain/dataProvider.ts`

- [ ] **Step 1: Write failing tests**

Test that a feed with `{ tradeDate, preMarketInput, auctionInput }` returns the correct `TradingDayInput` for each stage, rejects wrong dates, reports missing auction data at 9:25, and uses a fallback provider on network failure.

- [ ] **Step 2: Implement provider**

Implement `createRemoteJsonDataProvider({ baseUrl, fallbackProvider, fetcher })`. It should fetch `${baseUrl}/data/today.json`, parse JSON, validate `tradeDate`, and return `SUCCESS`, `FAILED`, or `MISSING_REQUIRED_DATA`.

### Task 2: APK Integration

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Create: `src/data/defaultDataProvider.ts`

- [ ] **Step 1: Write failing UI test**

Test that App can be injected with a remote provider and still shows the data status and recommendations. Keep the default provider testable without requiring live network.

- [ ] **Step 2: Use default provider**

Default to GitHub Pages URL for `shigzhu/MyShareStockData`, then fall back to local sample data.

### Task 3: GitHub Data Job Skeleton

**Files:**
- Create: `data-job/generate_daily_feed.py`
- Create: `data-job/tests/test_generate_daily_feed.py`
- Create: `data-job/fixtures/sample_trading_day.json`
- Create: `.github/workflows/daily-stock-data.yml`
- Create: `data/today.json`

- [ ] **Step 1: Write failing Python tests**

Test that the script writes `data/today.json` and `data/history/YYYY-MM-DD.json`, includes both `preMarketInput` and `auctionInput`, and marks the source as `SAMPLE_BOOTSTRAP` until real adapters are configured.

- [ ] **Step 2: Implement script**

Use only Python standard library. Generate the feed from fixture data now. Leave source metadata explicit so the app and user can tell this is not yet paid/live vendor data.

- [ ] **Step 3: Add GitHub Actions workflow**

Schedule at `00:30` and `01:25` UTC for China 8:30 and 9:25. Add `workflow_dispatch`. Commit generated JSON back to the repository using `GITHUB_TOKEN`.

### Task 4: Verification

**Files:**
- Existing files only.

- [ ] Run `npm test`.
- [ ] Run `python -m unittest discover -s data-job/tests`.
- [ ] Run `npm run build`.
- [ ] Run `npm run android:sync`.
- [ ] Run Android debug APK build with `scripts/android-env.ps1`.

