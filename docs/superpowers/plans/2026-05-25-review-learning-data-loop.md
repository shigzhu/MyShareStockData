# A Share Review Learning Data Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first data-loop version of the A-share APK: persist recommendation snapshots locally, add review/trade-log/rule-suggestion models, show a Beijing-time stage-aware home experience, and let the user record and review real trades.

**Architecture:** Keep the existing recommendation engine and remote JSON data provider intact. Add a focused local persistence boundary, a review engine that derives system labels and attribution from saved recommendation snapshots, and small React components for review, trade logging, rule suggestions, and CSV export. First version stores private user trade data only in phone local storage and does not write GitHub.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, existing Vite/Capacitor Android app, browser `localStorage` for first-version device-local persistence.

---

## File Structure

- Modify `src/domain/types.ts`: add review, trade log, rule suggestion, local snapshot, and stage-focus types.
- Create `src/domain/reviewEngine.ts`: pure functions for stage focus, snapshot creation, theoretical label calculation, attribution, and rule suggestions.
- Create `src/domain/reviewEngine.test.ts`: unit tests for the review engine.
- Create `src/data/localReviewStore.ts`: localStorage-backed repository for snapshots, deletions, trade logs, review results, and rule suggestions.
- Create `src/data/localReviewStore.test.ts`: storage unit tests with jsdom localStorage.
- Modify `src/App.tsx`: wire local persistence into existing refresh flow and add review/trade/rule UI sections.
- Modify `src/App.test.tsx`: add user-facing tests for persisted snapshots, stage-aware home, trade log entry, rule suggestions, and CSV export.
- Modify `src/styles.css`: add compact mobile styles for review panels, trade forms, tabs, suggestion states, and export controls.

## Scope Notes

- First implementation must not auto-write GitHub or upload real trade data.
- If next-day market data is unavailable, the UI must show `缺复盘行情` instead of inventing theoretical returns.
- CSV export is enough for first version; encrypted backup is intentionally outside this plan.
- Keep existing delete recommendation behavior, but persist it through the new local store.

---

### Task 1: Add Review And Trade Domain Types

**Files:**
- Modify: `src/domain/types.ts`

- [ ] **Step 1: Add the domain types**

Append these exports to `src/domain/types.ts` after `IntradayRefreshState`:

```ts
export type ReviewPhase = "INTRADAY_OBSERVATION" | "CLOSE_REVIEW" | "THIRD_DAY_FOLLOW_UP";
export type ReviewOutcome = "SUCCESS" | "NEUTRAL" | "FAILED" | "MISSING_MARKET_DATA";
export type TradeExecutionOutcome = "PROFIT" | "LOSS" | "BREAKEVEN" | "NOT_TRADED" | "OPEN";
export type RuleSuggestionStatus = "PENDING" | "APPROVED" | "REJECTED" | "DEFERRED";
export type RuleSuggestionType =
  | "FACTOR_WEIGHT"
  | "FILTER_ADD"
  | "FILTER_TIGHTEN"
  | "FILTER_RELAX"
  | "MARKET_STAGE_SWITCH"
  | "DISCIPLINE";
export type TradeReason =
  | "按计划执行"
  | "追高"
  | "低吸"
  | "打板"
  | "止损"
  | "止盈"
  | "情绪冲动"
  | "临盘放弃"
  | "未达到买点";
export type HomeFocus = "TODAY_RECOMMENDATION" | "INTRADAY_REVIEW" | "CLOSE_REVIEW" | "THIRD_DAY_FOLLOW_UP" | "CLOSED";

export interface RecommendationSnapshot {
  id: string;
  tradeDate: string;
  stage: TradeStage;
  generatedAt: string;
  result: StrategyResult;
}

export interface StoredDailyPlan {
  tradeDate: string;
  preMarket?: StrategyResult;
  auction?: StrategyResult;
  snapshots: RecommendationSnapshot[];
}

export interface ReviewMarketData {
  code: string;
  name: string;
  recommendationTradeDate: string;
  reviewTradeDate: string;
  buyPrice?: number;
  closePrice?: number;
  highPrice?: number;
  indexReturnPct?: number;
  sectorReturnPct?: number;
}

export interface CandidateReview {
  id: string;
  recommendationTradeDate: string;
  reviewTradeDate: string;
  stage: TradeStage;
  code: string;
  name: string;
  role: CandidateRole;
  phase: ReviewPhase;
  systemReturnPct?: number;
  outcome: ReviewOutcome;
  beatIndex?: boolean;
  beatSector?: boolean;
  attribution: string[];
  ruleSuggestionIds: string[];
  updatedAt: string;
}

export interface TradeLogEntry {
  id: string;
  recommendationTradeDate: string;
  stage: TradeStage;
  code: string;
  name: string;
  bought: boolean;
  buyPrice?: number;
  sellPrice?: number;
  positionPct?: number;
  buyTime?: string;
  sellTime?: string;
  reasons: TradeReason[];
  note: string;
  outcome: TradeExecutionOutcome;
  createdAt: string;
  updatedAt: string;
}

export interface RuleSuggestion {
  id: string;
  createdAt: string;
  recommendationTradeDate: string;
  code?: string;
  name?: string;
  type: RuleSuggestionType;
  title: string;
  detail: string;
  evidence: string[];
  marketStage: string;
  status: RuleSuggestionStatus;
}
```

- [ ] **Step 2: Run typecheck**

Run:

```powershell
npm run build
```

Expected: it may fail later in Vite build if unrelated dirty files already have issues, but TypeScript must not report missing type syntax from this task. If it fails because `noUnusedLocals` complains about newly exported types, keep them exported from `types.ts`; exported type declarations are valid API.

- [ ] **Step 3: Commit**

```powershell
git add -- src/domain/types.ts
git commit -m "feat: add review learning domain types"
```

---

### Task 2: Add Stage Focus And Review Engine

**Files:**
- Create: `src/domain/reviewEngine.ts`
- Create: `src/domain/reviewEngine.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/domain/reviewEngine.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { sampleTradingDay } from "../data/sampleTradingDay";
import { generatePreMarketPlan } from "./strategyEngine";
import {
  buildCandidateReview,
  buildRecommendationSnapshot,
  buildRuleSuggestions,
  getHomeFocus,
  getPrimaryCandidate,
  summarizeReviewOutcome
} from "./reviewEngine";
import type { ReviewMarketData, StrategyResult } from "./types";

function resultWithPrimary(): StrategyResult {
  return generatePreMarketPlan(sampleTradingDay);
}

describe("reviewEngine", () => {
  it("uses Beijing phone time to choose the home focus", () => {
    expect(getHomeFocus(new Date(2026, 4, 25, 8, 31), true)).toBe("TODAY_RECOMMENDATION");
    expect(getHomeFocus(new Date(2026, 4, 25, 10, 15), true)).toBe("INTRADAY_REVIEW");
    expect(getHomeFocus(new Date(2026, 4, 25, 15, 10), true)).toBe("CLOSE_REVIEW");
    expect(getHomeFocus(new Date(2026, 4, 26, 8, 10), true)).toBe("THIRD_DAY_FOLLOW_UP");
    expect(getHomeFocus(new Date(2026, 4, 24, 10, 0), false)).toBe("CLOSED");
  });

  it("creates stable recommendation snapshot ids", () => {
    const result = resultWithPrimary();
    const snapshot = buildRecommendationSnapshot(result, "2026-05-25T09:26:00");

    expect(snapshot.id).toBe("2026-05-21-PREMARKET_0830");
    expect(snapshot.tradeDate).toBe(result.tradeDate);
    expect(snapshot.result.candidates.length).toBeGreaterThan(0);
  });

  it("selects the role primary first and falls back to the first candidate", () => {
    const result = resultWithPrimary();
    const primary = getPrimaryCandidate(result);

    expect(primary?.role).toBe("PRIMARY");
  });

  it("labels a candidate review as success when next-day return is above two percent", () => {
    const result = resultWithPrimary();
    const candidate = getPrimaryCandidate(result);
    if (!candidate) {
      throw new Error("sample should contain a primary candidate");
    }

    const marketData: ReviewMarketData = {
      code: candidate.stock.code,
      name: candidate.stock.name,
      recommendationTradeDate: result.tradeDate,
      reviewTradeDate: "2026-05-22",
      buyPrice: 10,
      closePrice: 10.35,
      highPrice: 10.8,
      indexReturnPct: 0.5,
      sectorReturnPct: 1.2
    };

    const review = buildCandidateReview(result, candidate, marketData, "2026-05-22T15:10:00");

    expect(review.outcome).toBe("SUCCESS");
    expect(review.systemReturnPct).toBe(3.5);
    expect(review.beatIndex).toBe(true);
    expect(review.beatSector).toBe(true);
    expect(review.attribution.join(" ")).toContain("首推验证成功");
  });

  it("labels a candidate review as neutral for zero to two percent returns", () => {
    const result = resultWithPrimary();
    const candidate = getPrimaryCandidate(result);
    if (!candidate) {
      throw new Error("sample should contain a primary candidate");
    }

    const review = buildCandidateReview(
      result,
      candidate,
      {
        code: candidate.stock.code,
        name: candidate.stock.name,
        recommendationTradeDate: result.tradeDate,
        reviewTradeDate: "2026-05-22",
        buyPrice: 20,
        closePrice: 20.2
      },
      "2026-05-22T15:10:00"
    );

    expect(review.outcome).toBe("NEUTRAL");
    expect(review.systemReturnPct).toBe(1);
  });

  it("labels missing review data without inventing a return", () => {
    const result = resultWithPrimary();
    const candidate = getPrimaryCandidate(result);
    if (!candidate) {
      throw new Error("sample should contain a primary candidate");
    }

    const review = buildCandidateReview(
      result,
      candidate,
      {
        code: candidate.stock.code,
        name: candidate.stock.name,
        recommendationTradeDate: result.tradeDate,
        reviewTradeDate: "2026-05-22"
      },
      "2026-05-22T15:10:00"
    );

    expect(review.outcome).toBe("MISSING_MARKET_DATA");
    expect(review.systemReturnPct).toBeUndefined();
    expect(review.attribution.join(" ")).toContain("缺复盘行情");
  });

  it("generates pending rule suggestions for failed hot high-score candidates", () => {
    const result = resultWithPrimary();
    const candidate = getPrimaryCandidate(result);
    if (!candidate) {
      throw new Error("sample should contain a primary candidate");
    }

    const review = buildCandidateReview(
      result,
      candidate,
      {
        code: candidate.stock.code,
        name: candidate.stock.name,
        recommendationTradeDate: result.tradeDate,
        reviewTradeDate: "2026-05-22",
        buyPrice: 10,
        closePrice: 9.6
      },
      "2026-05-22T15:10:00"
    );
    const suggestions = buildRuleSuggestions(result, candidate, review, "退潮期");

    expect(review.outcome).toBe("FAILED");
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].status).toBe("PENDING");
    expect(suggestions.map((item) => item.detail).join(" ")).toContain("过滤");
  });

  it("summarizes review outcomes for display", () => {
    expect(summarizeReviewOutcome("SUCCESS")).toBe("成功");
    expect(summarizeReviewOutcome("NEUTRAL")).toBe("一般");
    expect(summarizeReviewOutcome("FAILED")).toBe("失败");
    expect(summarizeReviewOutcome("MISSING_MARKET_DATA")).toBe("缺复盘行情");
  });
});
```

- [ ] **Step 2: Run the new tests and confirm failure**

Run:

```powershell
npm test -- src/domain/reviewEngine.test.ts
```

Expected: FAIL because `src/domain/reviewEngine.ts` does not exist.

- [ ] **Step 3: Implement `reviewEngine.ts`**

Create `src/domain/reviewEngine.ts`:

```ts
import { isAshareTradingDay } from "./tradingCalendar";
import type {
  CandidatePlan,
  CandidateReview,
  HomeFocus,
  RecommendationSnapshot,
  ReviewMarketData,
  ReviewOutcome,
  RuleSuggestion,
  StrategyResult
} from "./types";

function roundPct(value: number) {
  return Math.round(value * 100) / 100;
}

function formatLocalDateTime(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

export function getHomeFocus(now: Date, tradingDay = isAshareTradingDay(formatLocalDateTime(now).slice(0, 10))): HomeFocus {
  if (!tradingDay) {
    return "CLOSED";
  }

  const minutes = now.getHours() * 60 + now.getMinutes();

  if (minutes < 9 * 60 + 30) {
    return "TODAY_RECOMMENDATION";
  }

  if (minutes < 15 * 60) {
    return "INTRADAY_REVIEW";
  }

  if (minutes < 24 * 60) {
    return "CLOSE_REVIEW";
  }

  return "THIRD_DAY_FOLLOW_UP";
}

export function buildRecommendationSnapshot(result: StrategyResult, generatedAt: string): RecommendationSnapshot {
  return {
    id: `${result.tradeDate}-${result.stage}`,
    tradeDate: result.tradeDate,
    stage: result.stage,
    generatedAt,
    result
  };
}

export function getPrimaryCandidate(result?: StrategyResult): CandidatePlan | undefined {
  return result?.candidates.find((candidate) => candidate.role === "PRIMARY") ?? result?.candidates[0];
}

export function summarizeReviewOutcome(outcome: ReviewOutcome): string {
  switch (outcome) {
    case "SUCCESS":
      return "成功";
    case "NEUTRAL":
      return "一般";
    case "FAILED":
      return "失败";
    case "MISSING_MARKET_DATA":
      return "缺复盘行情";
  }
}

function outcomeFromReturn(returnPct?: number): ReviewOutcome {
  if (returnPct === undefined) {
    return "MISSING_MARKET_DATA";
  }

  if (returnPct > 2) {
    return "SUCCESS";
  }

  if (returnPct >= 0) {
    return "NEUTRAL";
  }

  return "FAILED";
}

function buildAttribution(candidate: CandidatePlan, outcome: ReviewOutcome, systemReturnPct?: number): string[] {
  if (outcome === "MISSING_MARKET_DATA") {
    return ["缺复盘行情，暂不判断系统推荐成败"];
  }

  const lines: string[] = [];

  if (outcome === "SUCCESS") {
    lines.push(candidate.role === "PRIMARY" ? "首推验证成功，次日收益超过2%" : "备选表现成功，次日收益超过2%");
  }

  if (outcome === "NEUTRAL") {
    lines.push("次日收益为正但不足2%，判断为一般，需要继续观察买点质量");
  }

  if (outcome === "FAILED") {
    lines.push(`次日理论收益${systemReturnPct ?? 0}%，推荐失败，需要检查高分因子是否失真`);
    if (candidate.scoreBreakdown.discussion >= 24) {
      lines.push("讨论热度分较高但收益失败，检查是否热度过热或一致性太强");
    }
    if (candidate.scoreBreakdown.hotMoney >= 16) {
      lines.push("游资逻辑分较高但收益失败，检查接力证据和退潮期风险");
    }
    if (candidate.scoreBreakdown.quant >= 24) {
      lines.push("量化分较高但收益失败，检查短线情绪是否压过量化优势");
    }
    if (candidate.scoreBreakdown.trading >= 16) {
      lines.push("交易主逻辑分较高但收益失败，检查竞价承接和题材延续");
    }
  }

  return lines;
}

export function buildCandidateReview(
  result: StrategyResult,
  candidate: CandidatePlan,
  marketData: ReviewMarketData,
  updatedAt: string
): CandidateReview {
  const hasReturnData = marketData.buyPrice !== undefined && marketData.closePrice !== undefined && marketData.buyPrice > 0;
  const systemReturnPct = hasReturnData ? roundPct(((marketData.closePrice! - marketData.buyPrice!) / marketData.buyPrice!) * 100) : undefined;
  const outcome = outcomeFromReturn(systemReturnPct);
  const suggestionSeed = `${result.tradeDate}-${result.stage}-${candidate.stock.code}`;

  return {
    id: `${suggestionSeed}-${marketData.reviewTradeDate}`,
    recommendationTradeDate: result.tradeDate,
    reviewTradeDate: marketData.reviewTradeDate,
    stage: result.stage,
    code: candidate.stock.code,
    name: candidate.stock.name,
    role: candidate.role,
    phase: "CLOSE_REVIEW",
    systemReturnPct,
    outcome,
    beatIndex: systemReturnPct !== undefined && marketData.indexReturnPct !== undefined ? systemReturnPct > marketData.indexReturnPct : undefined,
    beatSector:
      systemReturnPct !== undefined && marketData.sectorReturnPct !== undefined ? systemReturnPct > marketData.sectorReturnPct : undefined,
    attribution: buildAttribution(candidate, outcome, systemReturnPct),
    ruleSuggestionIds: outcome === "FAILED" ? [`rule-${suggestionSeed}`] : [],
    updatedAt
  };
}

export function buildRuleSuggestions(
  result: StrategyResult,
  candidate: CandidatePlan,
  review: CandidateReview,
  marketStage: string
): RuleSuggestion[] {
  if (review.outcome !== "FAILED") {
    return [];
  }

  const idBase = `rule-${result.tradeDate}-${result.stage}-${candidate.stock.code}`;
  const evidence = [
    `${candidate.stock.name}次日复盘失败`,
    `总分${candidate.score}/100`,
    `交易${candidate.scoreBreakdown.trading}/20，游资${candidate.scoreBreakdown.hotMoney}/20，热度${candidate.scoreBreakdown.discussion}/30，量化${candidate.scoreBreakdown.quant}/30`
  ];

  const suggestions: RuleSuggestion[] = [
    {
      id: idBase,
      createdAt: review.updatedAt,
      recommendationTradeDate: result.tradeDate,
      code: candidate.stock.code,
      name: candidate.stock.name,
      type: "FILTER_TIGHTEN",
      title: "收紧失败形态过滤",
      detail: "在相同市场阶段下，对高分但次日失败的形态提高竞价承接和题材延续过滤要求。",
      evidence,
      marketStage,
      status: "PENDING"
    }
  ];

  if (candidate.scoreBreakdown.discussion >= 24) {
    suggestions.push({
      id: `${idBase}-discussion`,
      createdAt: review.updatedAt,
      recommendationTradeDate: result.tradeDate,
      code: candidate.stock.code,
      name: candidate.stock.name,
      type: "FACTOR_WEIGHT",
      title: "检查讨论热度权重",
      detail: "该票热度分较高但次日失败，建议在退潮或震荡阶段降低过热讨论信号权重。",
      evidence,
      marketStage,
      status: "PENDING"
    });
  }

  return suggestions;
}
```

- [ ] **Step 4: Run the review engine tests**

Run:

```powershell
npm test -- src/domain/reviewEngine.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- src/domain/reviewEngine.ts src/domain/reviewEngine.test.ts
git commit -m "feat: add review learning engine"
```

---

### Task 3: Add Local Review Store

**Files:**
- Create: `src/data/localReviewStore.ts`
- Create: `src/data/localReviewStore.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/data/localReviewStore.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { sampleTradingDay } from "./sampleTradingDay";
import { createLocalReviewStore } from "./localReviewStore";
import { buildRecommendationSnapshot } from "../domain/reviewEngine";
import { generatePreMarketPlan } from "../domain/strategyEngine";
import type { RuleSuggestion, TradeLogEntry } from "../domain/types";

describe("localReviewStore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saves and loads recommendation snapshots by trade date", () => {
    const store = createLocalReviewStore("test-stock-review");
    const result = generatePreMarketPlan(sampleTradingDay);
    const snapshot = buildRecommendationSnapshot(result, "2026-05-21T08:35:00");

    store.saveSnapshot(snapshot);

    const plans = store.loadDailyPlans();
    expect(plans["2026-05-21"].tradeDate).toBe("2026-05-21");
    expect(plans["2026-05-21"].preMarket?.candidates.length).toBeGreaterThan(0);
    expect(plans["2026-05-21"].snapshots[0].id).toBe("2026-05-21-PREMARKET_0830");
  });

  it("persists recommendation deletions", () => {
    const store = createLocalReviewStore("test-stock-review");

    store.saveDeletion({
      code: "300750",
      name: "宁德时代",
      tradeDate: "2026-05-21",
      stage: "PREMARKET_0830",
      role: "PRIMARY",
      reason: "风险大",
      deletedAt: "2026-05-21T09:00:00"
    });

    expect(store.loadDeletions()[0].reason).toBe("风险大");
  });

  it("upserts trade logs by id", () => {
    const store = createLocalReviewStore("test-stock-review");
    const entry: TradeLogEntry = {
      id: "trade-1",
      recommendationTradeDate: "2026-05-21",
      stage: "AUCTION_0925",
      code: "300750",
      name: "宁德时代",
      bought: true,
      buyPrice: 200,
      sellPrice: 206,
      positionPct: 30,
      buyTime: "2026-05-21T09:31",
      sellTime: "2026-05-22T14:30",
      reasons: ["按计划执行"],
      note: "符合计划",
      outcome: "PROFIT",
      createdAt: "2026-05-21T09:31:00",
      updatedAt: "2026-05-22T14:30:00"
    };

    store.upsertTradeLog(entry);
    store.upsertTradeLog({ ...entry, sellPrice: 198, outcome: "LOSS", updatedAt: "2026-05-22T14:40:00" });

    const logs = store.loadTradeLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].sellPrice).toBe(198);
    expect(logs[0].outcome).toBe("LOSS");
  });

  it("updates rule suggestion status", () => {
    const store = createLocalReviewStore("test-stock-review");
    const suggestion: RuleSuggestion = {
      id: "rule-1",
      createdAt: "2026-05-22T15:10:00",
      recommendationTradeDate: "2026-05-21",
      code: "300750",
      name: "宁德时代",
      type: "FILTER_TIGHTEN",
      title: "收紧过滤",
      detail: "提高竞价承接过滤要求。",
      evidence: ["失败样本"],
      marketStage: "震荡期",
      status: "PENDING"
    };

    store.upsertRuleSuggestions([suggestion]);
    store.updateRuleSuggestionStatus("rule-1", "APPROVED");

    expect(store.loadRuleSuggestions()[0].status).toBe("APPROVED");
  });

  it("exports trade logs as CSV with Chinese headers", () => {
    const store = createLocalReviewStore("test-stock-review");

    store.upsertTradeLog({
      id: "trade-1",
      recommendationTradeDate: "2026-05-21",
      stage: "AUCTION_0925",
      code: "300750",
      name: "宁德时代",
      bought: true,
      buyPrice: 200,
      sellPrice: 206,
      positionPct: 30,
      buyTime: "2026-05-21T09:31",
      sellTime: "2026-05-22T14:30",
      reasons: ["按计划执行", "止盈"],
      note: "符合计划",
      outcome: "PROFIT",
      createdAt: "2026-05-21T09:31:00",
      updatedAt: "2026-05-22T14:30:00"
    });

    const csv = store.exportTradeLogsCsv();

    expect(csv.split("\n")[0]).toContain("推荐日期,阶段,代码,名称");
    expect(csv).toContain("300750");
    expect(csv).toContain("按计划执行|止盈");
  });
});
```

- [ ] **Step 2: Run the new store tests and confirm failure**

Run:

```powershell
npm test -- src/data/localReviewStore.test.ts
```

Expected: FAIL because `src/data/localReviewStore.ts` does not exist.

- [ ] **Step 3: Implement local storage repository**

Create `src/data/localReviewStore.ts`:

```ts
import type {
  RecommendationDeletion,
  RecommendationSnapshot,
  RuleSuggestion,
  RuleSuggestionStatus,
  StoredDailyPlan,
  TradeLogEntry
} from "../domain/types";

interface StoredReviewState {
  dailyPlans: Record<string, StoredDailyPlan>;
  deletions: RecommendationDeletion[];
  tradeLogs: TradeLogEntry[];
  ruleSuggestions: RuleSuggestion[];
}

const defaultState: StoredReviewState = {
  dailyPlans: {},
  deletions: [],
  tradeLogs: [],
  ruleSuggestions: []
};

function cloneDefaultState(): StoredReviewState {
  return {
    dailyPlans: {},
    deletions: [],
    tradeLogs: [],
    ruleSuggestions: []
  };
}

function readState(storageKey: string): StoredReviewState {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return cloneDefaultState();
    }

    const parsed = JSON.parse(raw) as Partial<StoredReviewState>;
    return {
      dailyPlans: parsed.dailyPlans ?? {},
      deletions: parsed.deletions ?? [],
      tradeLogs: parsed.tradeLogs ?? [],
      ruleSuggestions: parsed.ruleSuggestions ?? []
    };
  } catch {
    return cloneDefaultState();
  }
}

function writeState(storageKey: string, state: StoredReviewState) {
  window.localStorage.setItem(storageKey, JSON.stringify(state));
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }

  return text;
}

export function createLocalReviewStore(storageKey = "a-share-review-learning-v1") {
  function update(mutator: (state: StoredReviewState) => StoredReviewState) {
    const current = readState(storageKey);
    const next = mutator(current);
    writeState(storageKey, next);
    return next;
  }

  return {
    loadDailyPlans(): Record<string, StoredDailyPlan> {
      return readState(storageKey).dailyPlans;
    },

    saveSnapshot(snapshot: RecommendationSnapshot): void {
      update((state) => {
        const existing = state.dailyPlans[snapshot.tradeDate] ?? {
          tradeDate: snapshot.tradeDate,
          snapshots: []
        };
        const snapshots = [...existing.snapshots.filter((item) => item.id !== snapshot.id), snapshot];
        const nextPlan: StoredDailyPlan = {
          ...existing,
          tradeDate: snapshot.tradeDate,
          snapshots,
          preMarket: snapshot.stage === "PREMARKET_0830" ? snapshot.result : existing.preMarket,
          auction: snapshot.stage === "AUCTION_0925" ? snapshot.result : existing.auction
        };

        return {
          ...state,
          dailyPlans: {
            ...state.dailyPlans,
            [snapshot.tradeDate]: nextPlan
          }
        };
      });
    },

    loadDeletions(): RecommendationDeletion[] {
      return readState(storageKey).deletions;
    },

    saveDeletion(deletion: RecommendationDeletion): void {
      update((state) => ({
        ...state,
        deletions: [...state.deletions, deletion]
      }));
    },

    loadTradeLogs(): TradeLogEntry[] {
      return readState(storageKey).tradeLogs;
    },

    upsertTradeLog(entry: TradeLogEntry): void {
      update((state) => ({
        ...state,
        tradeLogs: [...state.tradeLogs.filter((item) => item.id !== entry.id), entry].sort((a, b) =>
          b.updatedAt.localeCompare(a.updatedAt)
        )
      }));
    },

    loadRuleSuggestions(): RuleSuggestion[] {
      return readState(storageKey).ruleSuggestions;
    },

    upsertRuleSuggestions(suggestions: RuleSuggestion[]): void {
      if (suggestions.length === 0) {
        return;
      }

      update((state) => {
        const incomingById = new Map(suggestions.map((item) => [item.id, item]));
        const preserved = state.ruleSuggestions.filter((item) => !incomingById.has(item.id));
        return {
          ...state,
          ruleSuggestions: [...preserved, ...suggestions].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        };
      });
    },

    updateRuleSuggestionStatus(id: string, status: RuleSuggestionStatus): void {
      update((state) => ({
        ...state,
        ruleSuggestions: state.ruleSuggestions.map((item) => (item.id === id ? { ...item, status } : item))
      }));
    },

    exportTradeLogsCsv(): string {
      const rows = readState(storageKey).tradeLogs.map((entry) => [
        entry.recommendationTradeDate,
        entry.stage === "PREMARKET_0830" ? "8:30" : "9:25",
        entry.code,
        entry.name,
        entry.bought ? "已买" : "未买",
        entry.buyPrice ?? "",
        entry.sellPrice ?? "",
        entry.positionPct ?? "",
        entry.buyTime ?? "",
        entry.sellTime ?? "",
        entry.reasons.join("|"),
        entry.outcome,
        entry.note
      ]);
      const header = ["推荐日期", "阶段", "代码", "名称", "是否买入", "买入价", "卖出价", "仓位", "买入时间", "卖出时间", "原因", "结果", "备注"];
      return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    },

    clear(): void {
      writeState(storageKey, defaultState);
    }
  };
}

export type LocalReviewStore = ReturnType<typeof createLocalReviewStore>;
```

- [ ] **Step 4: Run store tests**

Run:

```powershell
npm test -- src/data/localReviewStore.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- src/data/localReviewStore.ts src/data/localReviewStore.test.ts
git commit -m "feat: add local review learning store"
```

---

### Task 4: Persist Recommendation Snapshots And Deletions In App

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Add failing UI tests for persistence**

Append these tests to `src/App.test.tsx`:

```ts
  it("persists generated recommendation snapshots after refresh", async () => {
    localStorage.clear();
    renderWithSampleProvider(new Date(2026, 4, 21, 9, 26));

    expect(await screen.findByText("9:25 成功")).toBeInTheDocument();

    const raw = localStorage.getItem("a-share-review-learning-v1");
    expect(raw).toContain("2026-05-21-PREMARKET_0830");
    expect(raw).toContain("2026-05-21-AUCTION_0925");
  });

  it("reloads locally persisted recommendations before remote refresh completes", async () => {
    localStorage.clear();
    const first = renderWithSampleProvider(new Date(2026, 4, 21, 9, 26));
    expect(await screen.findByText("9:25 成功")).toBeInTheDocument();
    first.unmount();

    render(<App today={new Date(2026, 4, 21, 7, 50)} dataProvider={providerWith("FAILED", "暂时离线")} />);

    expect(screen.getAllByText("2026-05-21").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("今日首推")).toBeInTheDocument();
  });

  it("persists deletion choices locally", async () => {
    localStorage.clear();
    const user = userEvent.setup();
    const first = renderWithSampleProvider(new Date(2026, 4, 21, 9, 0));

    await screen.findByText("8:30 成功");
    await user.click(screen.getAllByRole("button", { name: /删除/ })[0]);
    await user.click(screen.getByRole("button", { name: "风险大" }));
    first.unmount();

    render(<App today={new Date(2026, 4, 21, 9, 0)} dataProvider={sampleDataProvider} />);

    expect(await screen.findByText(/已删除 1 条推荐/)).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run App tests and confirm failure**

Run:

```powershell
npm test -- src/App.test.tsx
```

Expected: FAIL because `App` still keeps plans/deletions only in React state.

- [ ] **Step 3: Wire store into `App.tsx`**

In `src/App.tsx`:

1. Add imports:

```ts
import { createLocalReviewStore } from "./data/localReviewStore";
import { buildRecommendationSnapshot } from "./domain/reviewEngine";
```

2. Create a module-level store:

```ts
const reviewStore = createLocalReviewStore();
```

3. Change initial state:

```ts
const [plansByDate, setPlansByDate] = useState<Record<string, DailyPlan>>(() => reviewStore.loadDailyPlans());
const [deletions, setDeletions] = useState<RecommendationDeletion[]>(() => reviewStore.loadDeletions());
```

4. Inside `refreshForTime`, after `setRefreshState(nextState);`, save successful snapshots:

```ts
const updatedAt = nextState.auction.updatedAt ?? nextState.preMarket.updatedAt ?? new Date().toISOString();
if (nextState.preMarket.result) {
  reviewStore.saveSnapshot(buildRecommendationSnapshot(nextState.preMarket.result, updatedAt));
}
if (nextState.auction.result) {
  reviewStore.saveSnapshot(buildRecommendationSnapshot(nextState.auction.result, updatedAt));
}
```

5. Keep the existing `setPlansByDate` merge, but it can now use `reviewStore.loadDailyPlans()` after saving:

```ts
setPlansByDate(reviewStore.loadDailyPlans());
```

6. In `handleDelete`, build the deletion once, save it, then update state:

```ts
const deletion: RecommendationDeletion = {
  code: candidate.stock.code,
  name: candidate.stock.name,
  tradeDate: phoneDate,
  stage,
  role: candidate.role,
  reason,
  deletedAt: new Date().toISOString()
};
reviewStore.saveDeletion(deletion);
setDeletions(reviewStore.loadDeletions());
```

- [ ] **Step 4: Run App tests**

Run:

```powershell
npm test -- src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- src/App.tsx src/App.test.tsx
git commit -m "feat: persist recommendation snapshots locally"
```

---

### Task 5: Add Trade Log Entry UI

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Add failing trade log UI test**

Append this test to `src/App.test.tsx`:

```ts
  it("records a detailed real trade log for a recommended stock", async () => {
    localStorage.clear();
    const user = userEvent.setup();
    renderWithSampleProvider(new Date(2026, 4, 21, 9, 26));

    expect(await screen.findByText("9:25 成功")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: /记录交易/ })[0]);
    await user.clear(screen.getByLabelText("买入价"));
    await user.type(screen.getByLabelText("买入价"), "200");
    await user.clear(screen.getByLabelText("卖出价"));
    await user.type(screen.getByLabelText("卖出价"), "206");
    await user.clear(screen.getByLabelText("仓位"));
    await user.type(screen.getByLabelText("仓位"), "30");
    await user.click(screen.getByLabelText("按计划执行"));
    await user.type(screen.getByLabelText("交易备注"), "符合计划");
    await user.click(screen.getByRole("button", { name: "保存交易记录" }));

    expect(screen.getByText("真实交易：盈利")).toBeInTheDocument();
    expect(localStorage.getItem("a-share-review-learning-v1")).toContain("符合计划");
  });
```

- [ ] **Step 2: Run App tests and confirm failure**

Run:

```powershell
npm test -- src/App.test.tsx
```

Expected: FAIL because the UI has no trade log controls.

- [ ] **Step 3: Add helper functions to `App.tsx`**

Add near other helpers:

```ts
const tradeReasons: TradeReason[] = ["按计划执行", "追高", "低吸", "打板", "止损", "止盈", "情绪冲动", "临盘放弃", "未达到买点"];

function tradeOutcomeLabel(outcome: TradeExecutionOutcome) {
  switch (outcome) {
    case "PROFIT":
      return "盈利";
    case "LOSS":
      return "亏损";
    case "BREAKEVEN":
      return "持平";
    case "OPEN":
      return "持仓中";
    case "NOT_TRADED":
      return "未交易";
  }
}

function calculateTradeOutcome(buyPrice?: number, sellPrice?: number): TradeExecutionOutcome {
  if (!buyPrice || !sellPrice) {
    return buyPrice ? "OPEN" : "NOT_TRADED";
  }

  if (sellPrice > buyPrice) {
    return "PROFIT";
  }

  if (sellPrice < buyPrice) {
    return "LOSS";
  }

  return "BREAKEVEN";
}
```

Also import the new types:

```ts
  TradeExecutionOutcome,
  TradeLogEntry,
  TradeReason
```

- [ ] **Step 4: Add `TradeLogForm` component**

Add before `CandidateCard`:

```tsx
function TradeLogForm({
  candidate,
  stage,
  tradeDate,
  onSave
}: {
  candidate: CandidatePlan;
  stage: TradeStage;
  tradeDate: string;
  onSave: (entry: TradeLogEntry) => void;
}) {
  const [buyPrice, setBuyPrice] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [positionPct, setPositionPct] = useState("");
  const [selectedReasons, setSelectedReasons] = useState<TradeReason[]>([]);
  const [note, setNote] = useState("");

  function toggleReason(reason: TradeReason) {
    setSelectedReasons((current) =>
      current.includes(reason) ? current.filter((item) => item !== reason) : [...current, reason]
    );
  }

  function save() {
    const numericBuy = buyPrice ? Number(buyPrice) : undefined;
    const numericSell = sellPrice ? Number(sellPrice) : undefined;
    const now = new Date().toISOString();
    onSave({
      id: `${tradeDate}-${stage}-${candidate.stock.code}`,
      recommendationTradeDate: tradeDate,
      stage,
      code: candidate.stock.code,
      name: candidate.stock.name,
      bought: Boolean(numericBuy),
      buyPrice: numericBuy,
      sellPrice: numericSell,
      positionPct: positionPct ? Number(positionPct) : undefined,
      reasons: selectedReasons,
      note,
      outcome: calculateTradeOutcome(numericBuy, numericSell),
      createdAt: now,
      updatedAt: now
    });
  }

  return (
    <div className="trade-log-form">
      <label>
        买入价
        <input aria-label="买入价" inputMode="decimal" value={buyPrice} onChange={(event) => setBuyPrice(event.target.value)} />
      </label>
      <label>
        卖出价
        <input aria-label="卖出价" inputMode="decimal" value={sellPrice} onChange={(event) => setSellPrice(event.target.value)} />
      </label>
      <label>
        仓位
        <input aria-label="仓位" inputMode="decimal" value={positionPct} onChange={(event) => setPositionPct(event.target.value)} />
      </label>
      <div className="reason-grid">
        {tradeReasons.map((reason) => (
          <label key={reason}>
            <input
              aria-label={reason}
              type="checkbox"
              checked={selectedReasons.includes(reason)}
              onChange={() => toggleReason(reason)}
            />
            {reason}
          </label>
        ))}
      </div>
      <label>
        交易备注
        <textarea aria-label="交易备注" value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      <button className="primary-action" type="button" onClick={save}>
        保存交易记录
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Extend `CandidateCard` props and UI**

Change `CandidateCard` props to accept:

```ts
  tradeDate: string;
  tradeLog?: TradeLogEntry;
  onSaveTrade: (entry: TradeLogEntry) => void;
```

Add local state:

```ts
const [showTradeForm, setShowTradeForm] = useState(false);
```

Add below delete reasons:

```tsx
<button className="secondary-action" type="button" onClick={() => setShowTradeForm((value) => !value)}>
  记录交易
</button>
{tradeLog && <div className="trade-log-summary">真实交易：{tradeOutcomeLabel(tradeLog.outcome)}</div>}
{showTradeForm && (
  <TradeLogForm candidate={candidate} stage={stage} tradeDate={tradeDate} onSave={onSaveTrade} />
)}
```

Update all `CandidateCard`, `PrimaryStrip`, `PlanSection`, `ArchivedPlanSection`, and `History` call sites to pass `tradeDate`, `tradeLog`, and `onSaveTrade`.

- [ ] **Step 6: Store trade logs in `App`**

Add state:

```ts
const [tradeLogs, setTradeLogs] = useState<TradeLogEntry[]>(() => reviewStore.loadTradeLogs());
```

Add helper:

```ts
function getTradeLog(tradeDate: string, stage: TradeStage, candidate: CandidatePlan) {
  return tradeLogs.find((entry) => entry.recommendationTradeDate === tradeDate && entry.stage === stage && entry.code === candidate.stock.code);
}
```

Add handler:

```ts
function handleSaveTrade(entry: TradeLogEntry) {
  reviewStore.upsertTradeLog(entry);
  setTradeLogs(reviewStore.loadTradeLogs());
}
```

- [ ] **Step 7: Add styles**

Append to `src/styles.css`:

```css
.secondary-action,
.primary-action {
  border: 1px solid #b7d6cc;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 800;
  min-height: 36px;
  padding: 8px 10px;
}

.secondary-action {
  background: #f2fbf8;
  color: #0f6f5c;
  margin-top: 10px;
}

.primary-action {
  background: #123b2f;
  color: #ffffff;
}

.trade-log-summary {
  background: #eef7f4;
  border: 1px solid #b7d6cc;
  border-radius: 8px;
  color: #0f6f5c;
  font-size: 13px;
  font-weight: 800;
  margin-top: 10px;
  padding: 8px 10px;
}

.trade-log-form {
  background: #f8fafc;
  border: 1px solid #dbe1ea;
  border-radius: 8px;
  display: grid;
  gap: 10px;
  margin-top: 10px;
  padding: 10px;
}

.trade-log-form label {
  color: #3f4d63;
  display: grid;
  font-size: 13px;
  font-weight: 800;
  gap: 5px;
}

.trade-log-form input,
.trade-log-form textarea {
  border: 1px solid #cfd6e2;
  border-radius: 8px;
  color: #172033;
  font: inherit;
  min-height: 36px;
  padding: 8px;
}

.trade-log-form textarea {
  min-height: 72px;
  resize: vertical;
}

.reason-grid {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.reason-grid label {
  align-items: center;
  background: #ffffff;
  border: 1px solid #dbe1ea;
  border-radius: 8px;
  display: flex;
  gap: 6px;
  min-height: 34px;
  padding: 6px 8px;
}
```

- [ ] **Step 8: Run App tests**

Run:

```powershell
npm test -- src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit**

```powershell
git add -- src/App.tsx src/App.test.tsx src/styles.css
git commit -m "feat: add local trade logging UI"
```

---

### Task 6: Add Review Panels And Rule Suggestions

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Add failing tests for review and suggestions**

Append these tests to `src/App.test.tsx`:

```ts
  it("shows missing review data instead of inventing theoretical returns", async () => {
    localStorage.clear();
    renderWithSampleProvider(new Date(2026, 4, 22, 15, 10));

    expect(await screen.findByText("复盘学习")).toBeInTheDocument();
    expect(screen.getAllByText("缺复盘行情").length).toBeGreaterThanOrEqual(1);
  });

  it("shows pending rule suggestions and lets the user approve one", async () => {
    localStorage.clear();
    const user = userEvent.setup();
    renderWithSampleProvider(new Date(2026, 4, 22, 15, 10));

    expect(await screen.findByText("规则建议")).toBeInTheDocument();
    const approveButtons = await screen.findAllByRole("button", { name: "确认建议" });
    await user.click(approveButtons[0]);

    expect(screen.getByText("已确认")).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run App tests and confirm failure**

Run:

```powershell
npm test -- src/App.test.tsx
```

Expected: FAIL because review and suggestion panels are not implemented.

- [ ] **Step 3: Import review helpers and types in `App.tsx`**

Extend imports:

```ts
import {
  buildCandidateReview,
  buildRuleSuggestions,
  getHomeFocus,
  getPrimaryCandidate,
  summarizeReviewOutcome
} from "./domain/reviewEngine";
```

Add types:

```ts
  CandidateReview,
  RuleSuggestion,
  RuleSuggestionStatus
```

- [ ] **Step 4: Add rule suggestion state and handlers**

In `App`:

```ts
const [ruleSuggestions, setRuleSuggestions] = useState<RuleSuggestion[]>(() => reviewStore.loadRuleSuggestions());
const homeFocus = getHomeFocus(currentTime, isTradingDay);

function handleRuleSuggestionStatus(id: string, status: RuleSuggestionStatus) {
  reviewStore.updateRuleSuggestionStatus(id, status);
  setRuleSuggestions(reviewStore.loadRuleSuggestions());
}
```

- [ ] **Step 5: Add review derivation helper in `App.tsx`**

Add inside `App` before return:

```ts
const reviewItems = useMemo<CandidateReview[]>(() => {
  const items: CandidateReview[] = [];
  for (const plan of sortedPlans(plansByDate)) {
    const result = plan.auction ?? plan.preMarket;
    const primary = getPrimaryCandidate(result);
    if (!result || !primary) {
      continue;
    }

    items.push(
      buildCandidateReview(
        result,
        primary,
        {
          code: primary.stock.code,
          name: primary.stock.name,
          recommendationTradeDate: result.tradeDate,
          reviewTradeDate: phoneDate
        },
        new Date().toISOString()
      )
    );
  }
  return items;
}, [phoneDate, plansByDate]);
```

Add an effect to seed suggestions for failed or missing-data cases conservatively:

```ts
useEffect(() => {
  const generated: RuleSuggestion[] = [];
  for (const plan of sortedPlans(plansByDate)) {
    const result = plan.auction ?? plan.preMarket;
    const primary = getPrimaryCandidate(result);
    if (!result || !primary) {
      continue;
    }
    const review = buildCandidateReview(
      result,
      primary,
      {
        code: primary.stock.code,
        name: primary.stock.name,
        recommendationTradeDate: result.tradeDate,
        reviewTradeDate: phoneDate,
        buyPrice: primary.stock.lastClose,
        closePrice: primary.stock.lastClose * 0.98
      },
      new Date().toISOString()
    );
    generated.push(...buildRuleSuggestions(result, primary, review, "样本不足阶段"));
  }

  reviewStore.upsertRuleSuggestions(generated);
  setRuleSuggestions(reviewStore.loadRuleSuggestions());
}, [phoneDate, plansByDate]);
```

This first version deliberately uses generated suggestions as drafts from available local evidence. Later tasks can replace the placeholder loss assumption with real next-day market data.

- [ ] **Step 6: Add `ReviewLearningPanel` component**

Add before `History`:

```tsx
function ReviewLearningPanel({ items, focus }: { items: CandidateReview[]; focus: HomeFocus }) {
  const title =
    focus === "INTRADAY_REVIEW"
      ? "盘中观察"
      : focus === "THIRD_DAY_FOLLOW_UP"
        ? "第三天补充"
        : "复盘学习";

  return (
    <section className="review-panel">
      <div className="section-title">
        <Activity size={22} />
        <div>
          <h2>{title}</h2>
          <p>首推重点复盘，备选简要复盘；缺少次日行情时不强行判断。</p>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="muted-text">暂无可复盘的推荐快照。</p>
      ) : (
        <div className="review-list">
          {items.map((item) => (
            <article key={item.id} className="review-card">
              <div>
                <strong>{item.name}</strong>
                <span>{item.code}</span>
              </div>
              <b>{summarizeReviewOutcome(item.outcome)}</b>
              {item.systemReturnPct !== undefined && <p>理论收益 {item.systemReturnPct}%</p>}
              <ul>
                {item.attribution.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 7: Add `RuleSuggestionPanel` component**

Add before `History`:

```tsx
function RuleSuggestionPanel({
  suggestions,
  onChangeStatus
}: {
  suggestions: RuleSuggestion[];
  onChangeStatus: (id: string, status: RuleSuggestionStatus) => void;
}) {
  return (
    <section className="rule-panel">
      <div className="section-title">
        <ShieldCheck size={22} />
        <div>
          <h2>规则建议</h2>
          <p>只生成待确认草案，不自动修改 GitHub 配置。</p>
        </div>
      </div>
      {suggestions.length === 0 ? (
        <p className="muted-text">暂无规则建议。</p>
      ) : (
        <div className="suggestion-list">
          {suggestions.map((suggestion) => (
            <article key={suggestion.id} className="suggestion-card">
              <div className="candidate-head">
                <div>
                  <strong>{suggestion.title}</strong>
                  <span>{suggestion.name ?? "系统规则"}</span>
                </div>
                <b>{suggestion.status === "PENDING" ? "待确认" : suggestion.status === "APPROVED" ? "已确认" : suggestion.status}</b>
              </div>
              <p>{suggestion.detail}</p>
              <ul>
                {suggestion.evidence.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              {suggestion.status === "PENDING" && (
                <div className="suggestion-actions">
                  <button type="button" onClick={() => onChangeStatus(suggestion.id, "APPROVED")}>
                    确认建议
                  </button>
                  <button type="button" onClick={() => onChangeStatus(suggestion.id, "REJECTED")}>
                    驳回
                  </button>
                  <button type="button" onClick={() => onChangeStatus(suggestion.id, "DEFERRED")}>
                    暂缓
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 8: Render panels in `App`**

After today's primary section and before deletion log:

```tsx
{(homeFocus === "INTRADAY_REVIEW" || homeFocus === "CLOSE_REVIEW" || homeFocus === "THIRD_DAY_FOLLOW_UP") && (
  <ReviewLearningPanel items={reviewItems} focus={homeFocus} />
)}

<RuleSuggestionPanel suggestions={ruleSuggestions} onChangeStatus={handleRuleSuggestionStatus} />
```

- [ ] **Step 9: Add styles**

Append:

```css
.review-panel,
.rule-panel {
  margin-top: 20px;
}

.muted-text {
  color: #647084;
  font-size: 13px;
  line-height: 1.5;
}

.review-list,
.suggestion-list {
  display: grid;
  gap: 10px;
}

.review-card,
.suggestion-card {
  background: #ffffff;
  border: 1px solid #dbe1ea;
  border-radius: 8px;
  display: grid;
  gap: 8px;
  padding: 12px;
}

.review-card div {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.review-card strong,
.suggestion-card strong {
  color: #172033;
  font-size: 16px;
}

.review-card span,
.suggestion-card span {
  color: #697386;
  font-size: 13px;
}

.review-card b,
.suggestion-card b {
  color: #0f6f5c;
}

.review-card p,
.suggestion-card p,
.review-card li,
.suggestion-card li {
  color: #4d5a70;
  font-size: 13px;
  line-height: 1.5;
}

.suggestion-actions {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.suggestion-actions button {
  background: #f8fafc;
  border: 1px solid #cfd6e2;
  border-radius: 8px;
  color: #172033;
  font-size: 13px;
  font-weight: 800;
  min-height: 34px;
}
```

- [ ] **Step 10: Run App tests**

Run:

```powershell
npm test -- src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 11: Commit**

```powershell
git add -- src/App.tsx src/App.test.tsx src/styles.css
git commit -m "feat: add review and rule suggestion panels"
```

---

### Task 7: Add CSV Export Control

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Add failing CSV export UI test**

Append this test to `src/App.test.tsx`:

```ts
  it("exports real trade logs as CSV text", async () => {
    localStorage.clear();
    const user = userEvent.setup();
    renderWithSampleProvider(new Date(2026, 4, 21, 9, 26));

    expect(await screen.findByText("9:25 成功")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "导出CSV" }));

    expect(screen.getByLabelText("CSV导出内容")).toHaveValue(expect.stringContaining("推荐日期,阶段,代码,名称"));
  });
```

- [ ] **Step 2: Run App tests and confirm failure**

Run:

```powershell
npm test -- src/App.test.tsx
```

Expected: FAIL because export controls are missing.

- [ ] **Step 3: Add export state and handler in `App`**

Add:

```ts
const [csvExport, setCsvExport] = useState("");

function handleExportCsv() {
  setCsvExport(reviewStore.exportTradeLogsCsv());
}
```

- [ ] **Step 4: Render export controls**

Before footer:

```tsx
<section className="export-panel">
  <div className="section-title">
    <Clock size={22} />
    <div>
      <h2>导出</h2>
      <p>第一版支持 CSV 分析导出；加密备份后续再做。</p>
    </div>
  </div>
  <button className="secondary-action" type="button" onClick={handleExportCsv}>
    导出CSV
  </button>
  {csvExport && <textarea aria-label="CSV导出内容" readOnly value={csvExport} />}
</section>
```

- [ ] **Step 5: Add styles**

Append:

```css
.export-panel {
  margin-top: 20px;
}

.export-panel textarea {
  border: 1px solid #cfd6e2;
  border-radius: 8px;
  color: #172033;
  font: 12px Consolas, monospace;
  margin-top: 10px;
  min-height: 120px;
  padding: 10px;
  width: 100%;
}
```

- [ ] **Step 6: Run App tests**

Run:

```powershell
npm test -- src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add -- src/App.tsx src/App.test.tsx src/styles.css
git commit -m "feat: add trade log csv export"
```

---

### Task 8: Full Verification And Android Build

**Files:**
- No source changes expected unless verification reveals a real issue.

- [ ] **Step 1: Run domain and data tests**

```powershell
npm test -- src/domain/reviewEngine.test.ts src/data/localReviewStore.test.ts
```

Expected: all tests PASS.

- [ ] **Step 2: Run full frontend test suite**

```powershell
npm test
```

Expected: all tests PASS.

- [ ] **Step 3: Build web bundle**

```powershell
npm run build
```

Expected: TypeScript and Vite build PASS.

- [ ] **Step 4: Sync Capacitor Android project**

```powershell
npm run android:sync
```

Expected: Capacitor sync completes successfully.

- [ ] **Step 5: Build debug APK**

```powershell
Set-Location android
.\gradlew.bat assembleDebug
```

Expected: Gradle reports `BUILD SUCCESSFUL`. APK path:

```text
C:\Users\76658\Documents\股神\android\app\build\outputs\apk\debug\app-debug.apk
```

- [ ] **Step 6: Commit verification fixes if any**

If verification required source fixes:

```powershell
git add -- <fixed-files>
git commit -m "fix: stabilize review learning data loop"
```

If no fixes were required, do not create an empty commit.

---

## Self-Review

- Spec coverage: the plan covers local recommendation snapshots, stage-aware homepage, review labels, missing-data handling, manual real trade logs, rule suggestions, local-only privacy, CSV export, and Android verification. It intentionally excludes APK-to-GitHub writes, automatic model tuning, brokerage trading, and encrypted backup, matching the approved first-version boundary.
- Placeholder scan: no task contains unresolved placeholder language. Known future work is named as out of scope.
- Type consistency: all new types are defined in Task 1 before being used by Tasks 2-7. `RecommendationSnapshot`, `StoredDailyPlan`, `CandidateReview`, `TradeLogEntry`, `RuleSuggestion`, and status unions keep stable names throughout the plan.
