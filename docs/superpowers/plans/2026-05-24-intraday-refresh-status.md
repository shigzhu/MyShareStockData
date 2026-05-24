# Intraday Refresh Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add APK-side 8:30 and 9:25 recommendation job execution, missed-open compensation refresh, and clear data status display.

**Architecture:** Add a small data-provider boundary and an intraday job runner in `src/domain`. The runner decides which jobs are due from phone time, fetches the required trading-day input asynchronously, generates strategy results, and returns UI-ready job states. The current app will use a sample provider now, with the same interface ready for a backend API later.

**Tech Stack:** React, TypeScript, Vitest, existing strategy engine, Capacitor/Vite build.

---

### Task 1: Define Intraday Job State

**Files:**
- Create: `src/domain/intradayJobs.ts`
- Test: `src/domain/intradayJobs.test.ts`
- Modify: `src/domain/types.ts`

- [ ] **Step 1: Write failing tests**

Cover these behaviors:
- before 8:30 no job is generated;
- at 8:35 the 8:30 preparation job runs successfully;
- at 9:26 the 9:25 auction job runs after using the existing 8:30 pool;
- failed provider fetch produces `FAILED`;
- missing key data produces `MISSING_REQUIRED_DATA`;
- a valid fetch with zero candidates produces `NOT_RECOMMENDED`.

- [ ] **Step 2: Implement minimal job state types**

Add data status values:
- `PENDING`
- `SUCCESS`
- `FAILED`
- `MISSING_REQUIRED_DATA`
- `NOT_RECOMMENDED`

Add a `RecommendationJobState` shape with `stage`, `tradeDate`, `status`, `message`, optional `result`, and optional `updatedAt`.

### Task 2: Add Data Provider Boundary

**Files:**
- Create: `src/domain/dataProvider.ts`
- Create: `src/data/sampleDataProvider.ts`
- Test: `src/domain/intradayJobs.test.ts`

- [ ] **Step 1: Write failing provider-driven tests**

Tests should pass a fake provider with counters so the 9:25 job proves it fetched auction data only after the 8:30 result exists.

- [ ] **Step 2: Implement provider interface**

Expose:
- `fetchPreMarketInput(tradeDate: string)`
- `fetchAuctionInput(tradeDate: string, preMarketResult: StrategyResult)`

Both return `Promise<DataProviderResult<TradingDayInput>>`, where provider status can be `SUCCESS`, `FAILED`, or `MISSING_REQUIRED_DATA`.

### Task 3: Wire App To Async Refresh

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing UI tests**

Cover:
- opening at 8:35 shows the 8:30 result after async refresh;
- opening at 9:26 shows both 8:30 and 9:25 results;
- provider failure shows `失败`;
- missing key data shows `缺关键数据`;
- zero-candidate result shows `不推荐`.

- [ ] **Step 2: Implement UI state**

Replace direct `useMemo(generate...)` with async job state. Re-run refresh on initial mount, on minute tick, on focus, and on visibility change.

- [ ] **Step 3: Implement status presentation**

Show stage-level status rows for 8:30 and 9:25. Keep old plans folded into history when the phone date moves past the plan date.

### Task 4: Verify And Rebuild

**Files:**
- Existing build/test files only.

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `npm run android:sync`.
- [ ] Run `android\gradlew.bat assembleDebug` from `android`.

