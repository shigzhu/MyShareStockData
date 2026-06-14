# Quant And Hot Money Scoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the confirmed 20/20/30/30 scoring architecture: trading logic, hot-money logic, discussion heat, and quant factors.

**Architecture:** Keep the existing rule-based strategy engine, but split scoring into focused domain modules. `quantFactors.ts` performs strict quant data and risk/quality gating, `hotMoney.ts` scores speculative short-term participation logic, and `strategyEngine.ts` combines the four components into a 100-point candidate score.

**Tech Stack:** Vite, React, TypeScript, Vitest, Capacitor Android.

---

### Task 1: Extend Domain Types

**Files:**
- Modify: `src/domain/types.ts`

- [ ] **Step 1: Write failing type-driven tests**

Add tests in `src/domain/strategyEngine.test.ts` that assert candidates expose `scoreBreakdown`, `quant`, and `hotMoney` fields.

- [ ] **Step 2: Implement minimal types**

Add score summary interfaces:

```ts
export interface ScoreBreakdown {
  trading: number;
  hotMoney: number;
  discussion: number;
  quant: number;
  total: number;
}

export interface QuantScore {
  total: number;
  valuation: number;
  growth: number;
  quality: number;
  momentum: number;
  capital: number;
  riskControl: number;
  passed: boolean;
  reasons: string[];
  risks: string[];
  missingRequiredData: string[];
}

export interface HotMoneyScore {
  total: number;
  themeMatch: number;
  limitBoard: number;
  turnoverStructure: number;
  seatSignal: number;
  floatSize: number;
  emotionEffect: number;
  eligibleForPrimary: boolean;
  overheated: boolean;
  reasons: string[];
  risks: string[];
}
```

Extend `StockMetrics` with `quant` and `hotMoney` metrics, then extend `CandidatePlan`.

### Task 2: Quant Factor Module

**Files:**
- Create: `src/domain/quantFactors.ts`
- Create: `src/domain/quantFactors.test.ts`

- [ ] **Step 1: Write failing tests**

Cover strict missing-data rejection, quality/risk rejection, and valid 30-point scoring.

- [ ] **Step 2: Implement quant scoring**

Implement `scoreQuantFactors(stock)`:

- reject when required quant data is missing
- reject when quality or risk control fails
- score `30` points across valuation, growth, quality, momentum, capital, and risk control
- valuation is light additive
- growth rewards improving trend
- momentum prefers low-position launch and short-term strength
- capital blends institutional/background and short-term active capital

### Task 3: Hot Money Module

**Files:**
- Create: `src/domain/hotMoney.ts`
- Create: `src/domain/hotMoney.test.ts`

- [ ] **Step 1: Write failing tests**

Cover 8:30 and 9:25 different weights, substitute seat signals, no-primary rule, and strict overheat rejection.

- [ ] **Step 2: Implement hot-money scoring**

Implement `scoreHotMoney(stock, stage)`:

- `PREMARKET_0830` weights: theme 5, board 4, seat 4, turnover 3, float 2, emotion 2
- `AUCTION_0925` weights: turnover 5, emotion 4, board 4, theme 3, seat 2, float 2
- no clear hot-money logic means `eligibleForPrimary = false`
- high board, one-price, blow-off, extreme emotion, or late relay means rejected as overheated

### Task 4: Strategy Engine Integration

**Files:**
- Modify: `src/domain/strategyEngine.ts`
- Modify: `src/domain/strategyEngine.test.ts`

- [ ] **Step 1: Write failing integration tests**

Assert total score uses `20/20/30/30`, missing quant data rejects, and a non-hot-money candidate cannot become primary.

- [ ] **Step 2: Integrate scoring**

Replace existing `scoreStock` composition with:

- trading score normalized to `20`
- hot money score to `20`
- discussion heat normalized to `30`
- quant score to `30`
- total = sum of the four parts

### Task 5: Sample Data And UI

**Files:**
- Modify: `src/data/sampleTradingDay.ts`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Write failing UI tests**

Assert cards show total score plus four score parts, and details expose quant/hot-money reason labels.

- [ ] **Step 2: Add sample metrics**

Populate each sample stock with quant and hot-money metrics.

- [ ] **Step 3: Update recommendation cards**

Show total score and four compact components on the home card. Include quant and hot-money reasons in the existing reason/risk sections.

### Task 6: Verification And APK

**Files:**
- Android generated outputs

- [ ] **Step 1: Run all tests**

Run: `npm test`

- [ ] **Step 2: Build web app**

Run: `npm run build`

- [ ] **Step 3: Sync Android**

Run: `npm run android:sync`

- [ ] **Step 4: Build APK**

Run from `android`: `..\scripts\android-env.ps1; .\gradlew.bat assembleDebug`

- [ ] **Step 5: Verify APK exists**

Run: `Get-Item android\app\build\outputs\apk\debug\app-debug.apk`
