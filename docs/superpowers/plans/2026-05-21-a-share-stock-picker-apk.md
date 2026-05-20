# A Share Stock Picker APK Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a phone-runnable Android APK that generates an 08:30 A-share preparation list and a 09:25 call-auction confirmation list from a strict rule-based strategy.

**Architecture:** Use a Vite React mobile web app wrapped with Capacitor for Android. Keep the stock-picking strategy as pure TypeScript modules with deterministic tests, and keep the UI as a thin presentation layer over the strategy output.

**Tech Stack:** TypeScript, Vite, React, Vitest, Testing Library, Capacitor Android, local sample data provider first, free-data provider interfaces for later integration.

---

## File Structure

- `package.json`: npm scripts and dependencies.
- `vite.config.ts`: Vite and Vitest configuration.
- `index.html`: app mount point.
- `src/main.tsx`: React entry point.
- `src/App.tsx`: mobile app shell and screen composition.
- `src/styles.css`: mobile-first trading UI styles.
- `src/domain/types.ts`: strategy input and output types.
- `src/domain/thresholds.ts`: default threshold constants.
- `src/domain/marketGate.ts`: market environment gate.
- `src/domain/themeSelection.ts`: theme scoring and leader validation.
- `src/domain/riskFilters.ts`: stock risk hard filters.
- `src/domain/auctionConfirmation.ts`: 09:25 confirmation and backup ranking.
- `src/domain/strategyEngine.ts`: 08:30 and 09:25 orchestration.
- `src/data/sampleTradingDay.ts`: deterministic sample data for first runnable APK.
- `src/domain/*.test.ts`: unit tests for strategy behavior.
- `src/App.test.tsx`: UI smoke tests.
- `capacitor.config.ts`: Capacitor app metadata.
- `android/`: generated Capacitor Android project.

## Task 1: Scaffold React, TypeScript, And Test Harness

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `src/test/setup.ts`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`

- [ ] **Step 1: Create package metadata and scripts**

```json
{
  "name": "a-share-stock-picker-apk",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "android:init": "cap add android",
    "android:sync": "npm run build && cap sync android",
    "android:apk": "npm run android:sync && cd android && ./gradlew assembleDebug"
  },
  "dependencies": {
    "@capacitor/android": "^7.0.0",
    "@capacitor/core": "^7.0.0",
    "@vitejs/plugin-react": "^5.0.0",
    "lucide-react": "^0.468.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@capacitor/cli": "^7.0.0",
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "jsdom": "^25.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create config files**

`vite.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    css: true
  }
});
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

`tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts", "capacitor.config.ts"]
}
```

- [ ] **Step 3: Create app shell files**

`index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>A股短波段选股</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

`src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

`src/App.tsx`:

```tsx
export default function App() {
  return (
    <main className="app">
      <h1>A股短波段选股</h1>
      <p>策略引擎初始化中</p>
    </main>
  );
}
```

`src/styles.css`:

```css
:root {
  color: #162033;
  background: #f3f5f8;
  font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
}

.app {
  min-height: 100vh;
  padding: 20px;
}
```

- [ ] **Step 4: Install dependencies**

Run: `npm install`

Expected: dependencies install and `package-lock.json` is created.

- [ ] **Step 5: Run baseline checks**

Run: `npm test`

Expected: Vitest starts with no test files or exits cleanly after tests are added in later tasks.

Run: `npm run build`

Expected: production web build succeeds.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json index.html vite.config.ts tsconfig.json tsconfig.node.json src
git commit -m "chore: scaffold mobile stock picker app"
```

## Task 2: Define Domain Types And Thresholds

**Files:**
- Create: `src/domain/types.ts`
- Create: `src/domain/thresholds.ts`
- Create: `src/domain/thresholds.test.ts`

- [ ] **Step 1: Write failing threshold test**

```ts
import { describe, expect, it } from "vitest";
import { defaultThresholds } from "./thresholds";

describe("defaultThresholds", () => {
  it("uses strict auction confirmation defaults", () => {
    expect(defaultThresholds.auction.idealGapPctMin).toBe(3);
    expect(defaultThresholds.auction.idealGapPctMax).toBe(7);
    expect(defaultThresholds.auction.minAuctionTurnoverToYesterdayPct).toBeGreaterThanOrEqual(1);
    expect(defaultThresholds.position.hardStopLossPct).toBe(-8);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/domain/thresholds.test.ts`

Expected: FAIL because `src/domain/thresholds.ts` does not exist.

- [ ] **Step 3: Add types and thresholds**

`src/domain/types.ts`:

```ts
export type TradeStage = "PREMARKET_0830" | "AUCTION_0925";
export type MarketGateStatus = "TRADABLE" | "NO_TRADE";
export type CandidateRole = "PRIMARY" | "CONFIRMED" | "BACKUP" | "REJECTED";
export type DataCompleteness = "FULL" | "PARTIAL" | "MANUAL_AUCTION" | "MISSING";

export interface MarketMood {
  advancingCount: number;
  decliningCount: number;
  limitUpCount: number;
  limitDownCount: number;
  consecutiveLimitHeight: number;
  failedBoardRatioPct: number;
  yesterdayLimitUpAvgReturnPct: number;
}

export interface StockMetrics {
  code: string;
  name: string;
  themeId: string;
  lastClose: number;
  turnoverAmount: number;
  turnoverRatePct: number;
  return5dPct: number;
  return10dPct: number;
  return20dPct: number;
  distanceFromMa5Pct: number;
  distanceFromMa10Pct: number;
  consecutiveLimitUps: number;
  blowOffVolume: boolean;
  weakAcceptanceAfterBlowOff: boolean;
  isSt: boolean;
  isSuspended: boolean;
  listingDays: number;
  severeFinancialRisk: boolean;
  majorNegativeEvent: boolean;
  attentionScore: number;
}

export interface ThemeMetrics {
  id: string;
  name: string;
  recentStrengthScore: number;
  moneyMakingScore: number;
  turnoverHeatScore: number;
  continuationScore: number;
  stocks: StockMetrics[];
}

export interface AuctionMetrics {
  code: string;
  gapPct: number;
  auctionTurnoverAmount: number;
  recentAuctionTurnoverAvg: number;
  yesterdayTurnoverAmount: number;
  nearOnePriceLimitUp: boolean;
  weakToStrongFailed: boolean;
}

export interface TradingDayInput {
  tradeDate: string;
  marketMood: MarketMood;
  themes: ThemeMetrics[];
  auctionByCode?: Record<string, AuctionMetrics>;
  dataCompleteness: DataCompleteness;
}

export interface StrategyThresholds {
  market: {
    minAdvancingDecliningRatio: number;
    minLimitUpCount: number;
    maxLimitDownCount: number;
    minConsecutiveLimitHeight: number;
    maxFailedBoardRatioPct: number;
    minYesterdayLimitUpAvgReturnPct: number;
  };
  theme: {
    maxThemes: number;
    minThemeScore: number;
  };
  stock: {
    minTurnoverAmount: number;
    minTurnoverRatePct: number;
    minListingDays: number;
    maxReturn5dPct: number;
    maxReturn10dPct: number;
    maxReturn20dPct: number;
    maxDistanceFromMa5Pct: number;
    maxDistanceFromMa10Pct: number;
    maxConsecutiveLimitUps: number;
  };
  auction: {
    idealGapPctMin: number;
    idealGapPctMax: number;
    minAuctionTurnoverExpansionMultiple: number;
    minAuctionTurnoverToYesterdayPct: number;
  };
  position: {
    hardStopLossPct: number;
  };
}

export interface Rejection {
  code?: string;
  themeId?: string;
  reason: string;
}

export interface CandidatePlan {
  stock: StockMetrics;
  theme: ThemeMetrics;
  role: CandidateRole;
  score: number;
  reasons: string[];
  risks: string[];
  entryPlan: string;
  noBuyCondition: string;
  stopLoss: string;
  trendExit: string;
}

export interface StrategyResult {
  stage: TradeStage;
  tradeDate: string;
  marketStatus: MarketGateStatus;
  summary: string;
  candidates: CandidatePlan[];
  rejections: Rejection[];
  dataCompleteness: DataCompleteness;
}
```

`src/domain/thresholds.ts`:

```ts
import type { StrategyThresholds } from "./types";

export const defaultThresholds: StrategyThresholds = {
  market: {
    minAdvancingDecliningRatio: 1.15,
    minLimitUpCount: 35,
    maxLimitDownCount: 10,
    minConsecutiveLimitHeight: 3,
    maxFailedBoardRatioPct: 35,
    minYesterdayLimitUpAvgReturnPct: 0
  },
  theme: {
    maxThemes: 2,
    minThemeScore: 68
  },
  stock: {
    minTurnoverAmount: 800_000_000,
    minTurnoverRatePct: 3,
    minListingDays: 120,
    maxReturn5dPct: 18,
    maxReturn10dPct: 28,
    maxReturn20dPct: 45,
    maxDistanceFromMa5Pct: 9,
    maxDistanceFromMa10Pct: 15,
    maxConsecutiveLimitUps: 1
  },
  auction: {
    idealGapPctMin: 3,
    idealGapPctMax: 7,
    minAuctionTurnoverExpansionMultiple: 3,
    minAuctionTurnoverToYesterdayPct: 1
  },
  position: {
    hardStopLossPct: -8
  }
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/domain/thresholds.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/types.ts src/domain/thresholds.ts src/domain/thresholds.test.ts
git commit -m "feat: define stock picker domain thresholds"
```

## Task 3: Implement Market Environment Gate

**Files:**
- Create: `src/domain/marketGate.ts`
- Create: `src/domain/marketGate.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import { evaluateMarketGate } from "./marketGate";
import { defaultThresholds } from "./thresholds";
import type { MarketMood } from "./types";

const strongMood: MarketMood = {
  advancingCount: 3100,
  decliningCount: 1800,
  limitUpCount: 58,
  limitDownCount: 4,
  consecutiveLimitHeight: 5,
  failedBoardRatioPct: 22,
  yesterdayLimitUpAvgReturnPct: 1.8
};

describe("evaluateMarketGate", () => {
  it("allows trading when money-making effect is strong", () => {
    const result = evaluateMarketGate(strongMood, defaultThresholds);

    expect(result.status).toBe("TRADABLE");
    expect(result.reasons).toContain("赚钱效应合格");
  });

  it("blocks trading when limit-down risk is too high", () => {
    const result = evaluateMarketGate(
      { ...strongMood, limitDownCount: 18 },
      defaultThresholds
    );

    expect(result.status).toBe("NO_TRADE");
    expect(result.reasons).toContain("跌停数量过多");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/domain/marketGate.test.ts`

Expected: FAIL because `evaluateMarketGate` does not exist.

- [ ] **Step 3: Implement market gate**

```ts
import type { MarketGateStatus, MarketMood, StrategyThresholds } from "./types";

export interface MarketGateResult {
  status: MarketGateStatus;
  score: number;
  reasons: string[];
}

export function evaluateMarketGate(
  mood: MarketMood,
  thresholds: StrategyThresholds
): MarketGateResult {
  const reasons: string[] = [];
  const advancingDecliningRatio = mood.advancingCount / Math.max(1, mood.decliningCount);
  let score = 0;

  if (advancingDecliningRatio >= thresholds.market.minAdvancingDecliningRatio) {
    score += 20;
  } else {
    reasons.push("上涨家数不足");
  }

  if (mood.limitUpCount >= thresholds.market.minLimitUpCount) {
    score += 20;
  } else {
    reasons.push("涨停数量不足");
  }

  if (mood.limitDownCount <= thresholds.market.maxLimitDownCount) {
    score += 20;
  } else {
    reasons.push("跌停数量过多");
  }

  if (mood.consecutiveLimitHeight >= thresholds.market.minConsecutiveLimitHeight) {
    score += 15;
  } else {
    reasons.push("连板高度不足");
  }

  if (mood.failedBoardRatioPct <= thresholds.market.maxFailedBoardRatioPct) {
    score += 15;
  } else {
    reasons.push("炸板率过高");
  }

  if (mood.yesterdayLimitUpAvgReturnPct >= thresholds.market.minYesterdayLimitUpAvgReturnPct) {
    score += 10;
  } else {
    reasons.push("昨日涨停反馈偏弱");
  }

  const status: MarketGateStatus = reasons.length === 0 ? "TRADABLE" : "NO_TRADE";

  return {
    status,
    score,
    reasons: status === "TRADABLE" ? ["赚钱效应合格"] : reasons
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/domain/marketGate.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/marketGate.ts src/domain/marketGate.test.ts
git commit -m "feat: add market money-making gate"
```

## Task 4: Implement Theme And Leader Selection

**Files:**
- Create: `src/domain/themeSelection.ts`
- Create: `src/domain/themeSelection.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import { selectTradableThemes } from "./themeSelection";
import { defaultThresholds } from "./thresholds";
import type { StockMetrics, ThemeMetrics } from "./types";

function stock(overrides: Partial<StockMetrics>): StockMetrics {
  return {
    code: "000001",
    name: "核心股份",
    themeId: "ai",
    lastClose: 10,
    turnoverAmount: 1_500_000_000,
    turnoverRatePct: 6,
    return5dPct: 8,
    return10dPct: 15,
    return20dPct: 25,
    distanceFromMa5Pct: 4,
    distanceFromMa10Pct: 8,
    consecutiveLimitUps: 0,
    blowOffVolume: false,
    weakAcceptanceAfterBlowOff: false,
    isSt: false,
    isSuspended: false,
    listingDays: 600,
    severeFinancialRisk: false,
    majorNegativeEvent: false,
    attentionScore: 92,
    ...overrides
  };
}

function theme(overrides: Partial<ThemeMetrics>): ThemeMetrics {
  return {
    id: "ai",
    name: "人工智能",
    recentStrengthScore: 85,
    moneyMakingScore: 82,
    turnoverHeatScore: 90,
    continuationScore: 78,
    stocks: [stock({})],
    ...overrides
  };
}

describe("selectTradableThemes", () => {
  it("selects strongest one or two themes with non-overheated attention leaders", () => {
    const result = selectTradableThemes(
      [
        theme({ id: "ai", name: "人工智能" }),
        theme({ id: "robot", name: "机器人", recentStrengthScore: 80 }),
        theme({ id: "weak", name: "弱题材", recentStrengthScore: 45, moneyMakingScore: 40 })
      ],
      defaultThresholds
    );

    expect(result.selected).toHaveLength(2);
    expect(result.selected[0].theme.name).toBe("人工智能");
  });

  it("rejects the whole theme when the attention leader is overheated", () => {
    const result = selectTradableThemes(
      [
        theme({
          stocks: [
            stock({
              code: "300001",
              return10dPct: 45,
              distanceFromMa5Pct: 16,
              attentionScore: 98
            })
          ]
        })
      ],
      defaultThresholds
    );

    expect(result.selected).toHaveLength(0);
    expect(result.rejections[0].reason).toContain("人气龙头过热");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/domain/themeSelection.test.ts`

Expected: FAIL because `selectTradableThemes` does not exist.

- [ ] **Step 3: Implement theme selection**

```ts
import type { Rejection, StockMetrics, StrategyThresholds, ThemeMetrics } from "./types";

export interface SelectedTheme {
  theme: ThemeMetrics;
  leader: StockMetrics;
  score: number;
}

export interface ThemeSelectionResult {
  selected: SelectedTheme[];
  rejections: Rejection[];
}

export function scoreTheme(theme: ThemeMetrics): number {
  return Math.round(
    theme.recentStrengthScore * 0.3 +
      theme.moneyMakingScore * 0.25 +
      theme.turnoverHeatScore * 0.25 +
      theme.continuationScore * 0.2
  );
}

export function findAttentionLeader(stocks: StockMetrics[]): StockMetrics | undefined {
  return [...stocks].sort((a, b) => {
    const bScore = b.attentionScore * 0.55 + b.turnoverAmount / 100_000_000 * 0.3 + b.turnoverRatePct * 0.15;
    const aScore = a.attentionScore * 0.55 + a.turnoverAmount / 100_000_000 * 0.3 + a.turnoverRatePct * 0.15;
    return bScore - aScore;
  })[0];
}

export function isOverheated(stock: StockMetrics, thresholds: StrategyThresholds): boolean {
  return (
    stock.return5dPct > thresholds.stock.maxReturn5dPct ||
    stock.return10dPct > thresholds.stock.maxReturn10dPct ||
    stock.return20dPct > thresholds.stock.maxReturn20dPct ||
    stock.distanceFromMa5Pct > thresholds.stock.maxDistanceFromMa5Pct ||
    stock.distanceFromMa10Pct > thresholds.stock.maxDistanceFromMa10Pct ||
    stock.consecutiveLimitUps > thresholds.stock.maxConsecutiveLimitUps ||
    (stock.blowOffVolume && stock.weakAcceptanceAfterBlowOff)
  );
}

export function selectTradableThemes(
  themes: ThemeMetrics[],
  thresholds: StrategyThresholds
): ThemeSelectionResult {
  const rejections: Rejection[] = [];
  const selected: SelectedTheme[] = [];

  const ranked = [...themes]
    .map((theme) => ({ theme, score: scoreTheme(theme), leader: findAttentionLeader(theme.stocks) }))
    .sort((a, b) => b.score - a.score);

  for (const item of ranked) {
    if (selected.length >= thresholds.theme.maxThemes) {
      break;
    }

    if (item.score < thresholds.theme.minThemeScore) {
      rejections.push({ themeId: item.theme.id, reason: "题材综合强度不足" });
      continue;
    }

    if (!item.leader) {
      rejections.push({ themeId: item.theme.id, reason: "题材缺少可识别人气龙头" });
      continue;
    }

    if (isOverheated(item.leader, thresholds)) {
      rejections.push({ themeId: item.theme.id, code: item.leader.code, reason: "人气龙头过热，放弃整个题材" });
      continue;
    }

    selected.push({ theme: item.theme, leader: item.leader, score: item.score });
  }

  return { selected, rejections };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/domain/themeSelection.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/themeSelection.ts src/domain/themeSelection.test.ts
git commit -m "feat: select hot themes by attention leader"
```

## Task 5: Implement Risk Filters And 08:30 Candidate Plans

**Files:**
- Create: `src/domain/riskFilters.ts`
- Create: `src/domain/strategyEngine.ts`
- Create: `src/domain/strategyEngine.test.ts`

- [ ] **Step 1: Write failing pre-market tests**

```ts
import { describe, expect, it } from "vitest";
import { generatePreMarketPlan } from "./strategyEngine";
import { sampleTradingDay } from "../data/sampleTradingDay";

describe("generatePreMarketPlan", () => {
  it("returns 3 to 5 preparation candidates when market is tradable", () => {
    const result = generatePreMarketPlan(sampleTradingDay);

    expect(result.stage).toBe("PREMARKET_0830");
    expect(result.marketStatus).toBe("TRADABLE");
    expect(result.candidates.length).toBeGreaterThanOrEqual(3);
    expect(result.candidates.length).toBeLessThanOrEqual(5);
    expect(result.candidates[0].entryPlan).toContain("9:25");
  });

  it("returns no candidates when market gate fails", () => {
    const result = generatePreMarketPlan({
      ...sampleTradingDay,
      marketMood: { ...sampleTradingDay.marketMood, limitDownCount: 25 }
    });

    expect(result.marketStatus).toBe("NO_TRADE");
    expect(result.candidates).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/domain/strategyEngine.test.ts`

Expected: FAIL because `strategyEngine` and sample data do not exist.

- [ ] **Step 3: Implement risk filters**

```ts
import type { Rejection, StockMetrics, StrategyThresholds } from "./types";
import { isOverheated } from "./themeSelection";

export function getRiskRejections(stock: StockMetrics, thresholds: StrategyThresholds): Rejection[] {
  const rejections: Rejection[] = [];

  if (stock.isSt) rejections.push({ code: stock.code, reason: "ST或退市风险标识" });
  if (stock.isSuspended) rejections.push({ code: stock.code, reason: "停牌或交易状态异常" });
  if (stock.listingDays < thresholds.stock.minListingDays) rejections.push({ code: stock.code, reason: "上市时间过短" });
  if (stock.turnoverAmount < thresholds.stock.minTurnoverAmount) rejections.push({ code: stock.code, reason: "成交额不足" });
  if (stock.turnoverRatePct < thresholds.stock.minTurnoverRatePct) rejections.push({ code: stock.code, reason: "换手率不足" });
  if (stock.severeFinancialRisk) rejections.push({ code: stock.code, reason: "财务风险过高" });
  if (stock.majorNegativeEvent) rejections.push({ code: stock.code, reason: "重大负面事件" });
  if (isOverheated(stock, thresholds)) rejections.push({ code: stock.code, reason: "短期过热或承接转弱" });

  return rejections;
}
```

- [ ] **Step 4: Implement strategy orchestration and sample data**

`src/domain/strategyEngine.ts`:

```ts
import { evaluateMarketGate } from "./marketGate";
import { getRiskRejections } from "./riskFilters";
import { defaultThresholds } from "./thresholds";
import { selectTradableThemes } from "./themeSelection";
import type { CandidatePlan, StrategyResult, StrategyThresholds, StockMetrics, ThemeMetrics, TradingDayInput } from "./types";

function scoreStock(stock: StockMetrics, themeScore: number): number {
  const liquidityScore = Math.min(30, stock.turnoverAmount / 100_000_000);
  const attention = Math.min(35, stock.attentionScore * 0.35);
  const position = Math.max(0, 20 - stock.return10dPct * 0.4 - stock.distanceFromMa5Pct * 0.6);
  const theme = Math.min(15, themeScore * 0.15);
  return Math.round(liquidityScore + attention + position + theme);
}

function buildCandidatePlan(stock: StockMetrics, theme: ThemeMetrics, score: number): CandidatePlan {
  return {
    stock,
    theme,
    role: "BACKUP",
    score,
    reasons: [
      `属于${theme.name}主线`,
      "成交额和换手率处于题材核心位置",
      "短期位置未触发过热过滤"
    ],
    risks: ["9:25前仍需竞价成交确认", "题材龙头走弱则取消买入"],
    entryPlan: "9:25后只在竞价明显放量且高开3%-7%附近时分批参与",
    noBuyCondition: "竞价无量、高开过热、板块龙头跳水或个股放量滞涨时不买",
    stopLoss: "单只股票硬止损约-8%，逻辑走弱时提前退出",
    trendExit: "持有期间跟踪5日/10日线和题材龙头状态，趋势破坏则退出"
  };
}

export function generatePreMarketPlan(
  input: TradingDayInput,
  thresholds: StrategyThresholds = defaultThresholds
): StrategyResult {
  const marketGate = evaluateMarketGate(input.marketMood, thresholds);

  if (marketGate.status === "NO_TRADE") {
    return {
      stage: "PREMARKET_0830",
      tradeDate: input.tradeDate,
      marketStatus: "NO_TRADE",
      summary: `市场环境不合格：${marketGate.reasons.join("、")}`,
      candidates: [],
      rejections: marketGate.reasons.map((reason) => ({ reason })),
      dataCompleteness: input.dataCompleteness
    };
  }

  const themeSelection = selectTradableThemes(input.themes, thresholds);
  const rejections = [...themeSelection.rejections];
  const candidates: CandidatePlan[] = [];

  for (const selected of themeSelection.selected) {
    for (const stock of selected.theme.stocks) {
      const riskRejections = getRiskRejections(stock, thresholds);
      if (riskRejections.length > 0) {
        rejections.push(...riskRejections);
        continue;
      }

      candidates.push(buildCandidatePlan(stock, selected.theme, scoreStock(stock, selected.score)));
    }
  }

  const ranked = candidates.sort((a, b) => b.score - a.score).slice(0, 5);

  return {
    stage: "PREMARKET_0830",
    tradeDate: input.tradeDate,
    marketStatus: "TRADABLE",
    summary: ranked.length > 0 ? "市场赚钱效应合格，生成8:30准备名单" : "市场合格，但没有通过风险过滤的候选",
    candidates: ranked,
    rejections,
    dataCompleteness: input.dataCompleteness
  };
}
```

`src/data/sampleTradingDay.ts`:

```ts
import type { StockMetrics, TradingDayInput } from "../domain/types";

function stock(overrides: Partial<StockMetrics>): StockMetrics {
  return {
    code: "300750",
    name: "样本科技",
    themeId: "ai",
    lastClose: 20,
    turnoverAmount: 1_800_000_000,
    turnoverRatePct: 6,
    return5dPct: 7,
    return10dPct: 13,
    return20dPct: 24,
    distanceFromMa5Pct: 3.8,
    distanceFromMa10Pct: 7.4,
    consecutiveLimitUps: 0,
    blowOffVolume: false,
    weakAcceptanceAfterBlowOff: false,
    isSt: false,
    isSuspended: false,
    listingDays: 900,
    severeFinancialRisk: false,
    majorNegativeEvent: false,
    attentionScore: 88,
    ...overrides
  };
}

export const sampleTradingDay: TradingDayInput = {
  tradeDate: "2026-05-21",
  dataCompleteness: "PARTIAL",
  marketMood: {
    advancingCount: 3200,
    decliningCount: 1600,
    limitUpCount: 62,
    limitDownCount: 3,
    consecutiveLimitHeight: 5,
    failedBoardRatioPct: 20,
    yesterdayLimitUpAvgReturnPct: 2.1
  },
  themes: [
    {
      id: "ai",
      name: "人工智能",
      recentStrengthScore: 88,
      moneyMakingScore: 84,
      turnoverHeatScore: 91,
      continuationScore: 79,
      stocks: [
        stock({ code: "300750", name: "云算科技", attentionScore: 95, turnoverAmount: 2_600_000_000 }),
        stock({ code: "002230", name: "智联股份", attentionScore: 90, turnoverAmount: 2_100_000_000 }),
        stock({ code: "688256", name: "芯源智能", attentionScore: 84, turnoverAmount: 1_500_000_000 })
      ]
    },
    {
      id: "robot",
      name: "机器人",
      recentStrengthScore: 82,
      moneyMakingScore: 80,
      turnoverHeatScore: 85,
      continuationScore: 76,
      stocks: [
        stock({ code: "300124", name: "机电核心", themeId: "robot", attentionScore: 91, turnoverAmount: 2_300_000_000 }),
        stock({ code: "002527", name: "精密传动", themeId: "robot", attentionScore: 87, turnoverAmount: 1_900_000_000 })
      ]
    }
  ],
  auctionByCode: {
    "300750": {
      code: "300750",
      gapPct: 4.6,
      auctionTurnoverAmount: 42_000_000,
      recentAuctionTurnoverAvg: 10_000_000,
      yesterdayTurnoverAmount: 2_600_000_000,
      nearOnePriceLimitUp: false,
      weakToStrongFailed: false
    },
    "002230": {
      code: "002230",
      gapPct: 2.2,
      auctionTurnoverAmount: 32_000_000,
      recentAuctionTurnoverAvg: 8_000_000,
      yesterdayTurnoverAmount: 2_100_000_000,
      nearOnePriceLimitUp: false,
      weakToStrongFailed: false
    }
  }
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/domain/strategyEngine.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/riskFilters.ts src/domain/strategyEngine.ts src/domain/strategyEngine.test.ts src/data/sampleTradingDay.ts
git commit -m "feat: generate premarket stock plans"
```

## Task 6: Implement 09:25 Auction Confirmation

**Files:**
- Create: `src/domain/auctionConfirmation.ts`
- Modify: `src/domain/strategyEngine.ts`
- Modify: `src/domain/strategyEngine.test.ts`

- [ ] **Step 1: Add failing auction tests**

Append to `src/domain/strategyEngine.test.ts`:

```ts
import { generateAuctionPlan } from "./strategyEngine";

describe("generateAuctionPlan", () => {
  it("ranks the only fully confirmed stock first and fills backups from premarket candidates", () => {
    const premarket = generatePreMarketPlan(sampleTradingDay);
    const result = generateAuctionPlan(sampleTradingDay, premarket);

    expect(result.stage).toBe("AUCTION_0925");
    expect(result.candidates[0].role).toBe("PRIMARY");
    expect(result.candidates[0].stock.code).toBe("300750");
    expect(result.candidates.length).toBeGreaterThanOrEqual(3);
    expect(result.candidates[1].role).toBe("BACKUP");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/domain/strategyEngine.test.ts`

Expected: FAIL because `generateAuctionPlan` does not exist.

- [ ] **Step 3: Implement auction confirmation**

`src/domain/auctionConfirmation.ts`:

```ts
import type { AuctionMetrics, CandidatePlan, StrategyThresholds } from "./types";

export interface AuctionCheck {
  confirmed: boolean;
  score: number;
  reasons: string[];
  risks: string[];
}

export function confirmAuction(
  candidate: CandidatePlan,
  auction: AuctionMetrics | undefined,
  thresholds: StrategyThresholds
): AuctionCheck {
  if (!auction) {
    return {
      confirmed: false,
      score: candidate.score,
      reasons: ["缺少9:25竞价数据"],
      risks: ["只能保留为备选观察"]
    };
  }

  const expansion = auction.auctionTurnoverAmount / Math.max(1, auction.recentAuctionTurnoverAvg);
  const turnoverToYesterdayPct = (auction.auctionTurnoverAmount / Math.max(1, auction.yesterdayTurnoverAmount)) * 100;
  const reasons: string[] = [];
  const risks: string[] = [];
  let score = candidate.score;

  if (expansion >= thresholds.auction.minAuctionTurnoverExpansionMultiple) {
    score += 18;
    reasons.push("竞价成交显著放量");
  } else {
    risks.push("竞价放量不足");
  }

  if (turnoverToYesterdayPct >= thresholds.auction.minAuctionTurnoverToYesterdayPct) {
    score += 12;
    reasons.push("竞价成交占昨日成交比例达标");
  } else {
    risks.push("竞价成交相对昨日成交偏弱");
  }

  if (
    auction.gapPct >= thresholds.auction.idealGapPctMin &&
    auction.gapPct <= thresholds.auction.idealGapPctMax
  ) {
    score += 10;
    reasons.push("高开幅度处于3%-7%强而不过热区间");
  } else {
    risks.push("高开幅度不在理想区间");
  }

  if (auction.nearOnePriceLimitUp) risks.push("接近一字板，买入性价比不足");
  if (auction.weakToStrongFailed) risks.push("竞价弱转强失败");

  const confirmed =
    risks.length === 0 &&
    expansion >= thresholds.auction.minAuctionTurnoverExpansionMultiple &&
    turnoverToYesterdayPct >= thresholds.auction.minAuctionTurnoverToYesterdayPct;

  return { confirmed, score, reasons, risks };
}
```

Update `src/domain/strategyEngine.ts` by adding:

```ts
import { confirmAuction } from "./auctionConfirmation";
```

and appending:

```ts
export function generateAuctionPlan(
  input: TradingDayInput,
  preMarketResult: StrategyResult,
  thresholds: StrategyThresholds = defaultThresholds
): StrategyResult {
  if (preMarketResult.marketStatus === "NO_TRADE") {
    return {
      ...preMarketResult,
      stage: "AUCTION_0925",
      summary: "市场环境不合格，9:25不生成交易名单"
    };
  }

  const checked = preMarketResult.candidates.map((candidate) => {
    const auction = input.auctionByCode?.[candidate.stock.code];
    const check = confirmAuction(candidate, auction, thresholds);
    return {
      ...candidate,
      role: check.confirmed ? "CONFIRMED" as const : "BACKUP" as const,
      score: check.score,
      reasons: [...candidate.reasons, ...check.reasons],
      risks: [...candidate.risks, ...check.risks]
    };
  });

  const confirmed = checked.filter((candidate) => candidate.role === "CONFIRMED").sort((a, b) => b.score - a.score);
  const backups = checked.filter((candidate) => candidate.role !== "CONFIRMED").sort((a, b) => b.score - a.score);
  const ranked = [...confirmed, ...backups].slice(0, confirmed.length <= 2 ? 3 : 5);

  if (ranked[0]) {
    ranked[0] = { ...ranked[0], role: confirmed.length > 0 ? "PRIMARY" : "BACKUP" };
  }

  return {
    stage: "AUCTION_0925",
    tradeDate: input.tradeDate,
    marketStatus: "TRADABLE",
    summary: confirmed.length > 0 ? "9:25竞价确认完成，首推票排在最前" : "9:25无完全确认票，仅保留备选观察",
    candidates: ranked,
    rejections: preMarketResult.rejections,
    dataCompleteness: input.dataCompleteness
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/domain/strategyEngine.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/auctionConfirmation.ts src/domain/strategyEngine.ts src/domain/strategyEngine.test.ts
git commit -m "feat: confirm candidates with auction volume"
```

## Task 7: Build Mobile UI For Daily Plans

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Create: `src/App.test.tsx`

- [ ] **Step 1: Write failing UI tests**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("shows both 8:30 and 9:25 strategy sections", () => {
    render(<App />);

    expect(screen.getByText("8:30 准备名单")).toBeInTheDocument();
    expect(screen.getByText("9:25 竞价确认")).toBeInTheDocument();
    expect(screen.getByText("首推")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/App.test.tsx`

Expected: FAIL because the UI still shows only the placeholder app shell.

- [ ] **Step 3: Implement UI**

```tsx
import { Activity, AlertTriangle, CheckCircle2, Clock, ShieldCheck } from "lucide-react";
import { generateAuctionPlan, generatePreMarketPlan } from "./domain/strategyEngine";
import type { CandidatePlan, StrategyResult } from "./domain/types";
import { sampleTradingDay } from "./data/sampleTradingDay";

function CandidateCard({ candidate }: { candidate: CandidatePlan }) {
  const roleLabel = candidate.role === "PRIMARY" ? "首推" : candidate.role === "CONFIRMED" ? "确认" : "备选";

  return (
    <article className="candidate-card">
      <div className="candidate-head">
        <div>
          <strong>{candidate.stock.name}</strong>
          <span>{candidate.stock.code}</span>
        </div>
        <b>{roleLabel}</b>
      </div>
      <div className="score-row">
        <span>{candidate.theme.name}</span>
        <span>{candidate.score} 分</span>
      </div>
      <section>
        <h3>入选理由</h3>
        <ul>{candidate.reasons.slice(0, 4).map((reason) => <li key={reason}>{reason}</li>)}</ul>
      </section>
      <section>
        <h3>交易计划</h3>
        <p>{candidate.entryPlan}</p>
      </section>
      <section>
        <h3>不买条件</h3>
        <p>{candidate.noBuyCondition}</p>
      </section>
      <section>
        <h3>退出</h3>
        <p>{candidate.stopLoss}</p>
        <p>{candidate.trendExit}</p>
      </section>
      {candidate.risks.length > 0 && (
        <section className="risk">
          <h3>风险点</h3>
          <ul>{candidate.risks.slice(0, 4).map((risk) => <li key={risk}>{risk}</li>)}</ul>
        </section>
      )}
    </article>
  );
}

function PlanSection({ title, result, icon }: { title: string; result: StrategyResult; icon: React.ReactNode }) {
  return (
    <section className="plan-section">
      <div className="section-title">
        {icon}
        <div>
          <h2>{title}</h2>
          <p>{result.summary}</p>
        </div>
      </div>
      <div className="candidate-list">
        {result.candidates.map((candidate) => (
          <CandidateCard key={`${result.stage}-${candidate.stock.code}`} candidate={candidate} />
        ))}
      </div>
    </section>
  );
}

export default function App() {
  const preMarket = generatePreMarketPlan(sampleTradingDay);
  const auction = generateAuctionPlan(sampleTradingDay, preMarket);

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <span className="eyebrow">A股短波段</span>
          <h1>每日选股计划</h1>
        </div>
        <div className="status-pill">
          <ShieldCheck size={18} />
          {auction.marketStatus === "TRADABLE" ? "可交易" : "空仓"}
        </div>
      </header>

      <section className="market-panel">
        <div>
          <span>交易日</span>
          <strong>{sampleTradingDay.tradeDate}</strong>
        </div>
        <div>
          <span>数据状态</span>
          <strong>{sampleTradingDay.dataCompleteness}</strong>
        </div>
        <div>
          <span>硬止损</span>
          <strong>-8%</strong>
        </div>
      </section>

      <PlanSection title="8:30 准备名单" result={preMarket} icon={<Clock size={22} />} />
      <PlanSection title="9:25 竞价确认" result={auction} icon={<Activity size={22} />} />

      <footer className="disclaimer">
        <AlertTriangle size={18} />
        <span>本工具只做规则化辅助决策，不构成收益承诺或投资建议。</span>
      </footer>
    </main>
  );
}
```

Replace `src/styles.css` with a mobile-focused stylesheet that defines `.topbar`, `.status-pill`, `.market-panel`, `.plan-section`, `.candidate-card`, `.candidate-head`, `.score-row`, `.risk`, and `.disclaimer` using dense readable spacing, 8px card radius, high-contrast text, and no decorative gradient orbs.

- [ ] **Step 4: Run UI test**

Run: `npm test -- src/App.test.tsx`

Expected: PASS.

- [ ] **Step 5: Run all checks**

Run: `npm test`

Expected: all tests PASS.

Run: `npm run build`

Expected: production web build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/App.test.tsx src/styles.css
git commit -m "feat: show daily stock plans in mobile UI"
```

## Task 8: Add Capacitor Android Packaging

**Files:**
- Create: `capacitor.config.ts`
- Create/Modify: `android/` generated by Capacitor.

- [ ] **Step 1: Add Capacitor config**

```ts
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.gushen.stockpicker",
  appName: "股神选股",
  webDir: "dist",
  server: {
    androidScheme: "https"
  }
};

export default config;
```

- [ ] **Step 2: Run web build before Android init**

Run: `npm run build`

Expected: `dist/` is created successfully.

- [ ] **Step 3: Generate Android project**

Run: `npx cap add android`

Expected: `android/` is created.

- [ ] **Step 4: Sync Android assets**

Run: `npx cap sync android`

Expected: Capacitor copies `dist/` into the Android project.

- [ ] **Step 5: Commit Android project**

```bash
git add capacitor.config.ts android
git commit -m "feat: add capacitor android project"
```

## Task 9: Prepare Local APK Build Chain

**Files:**
- Create: `scripts/android-env.ps1`
- Modify: `.gitignore`

- [ ] **Step 1: Add ignored local tool directories**

Add to `.gitignore`:

```gitignore
.local-android/
android/.gradle/
android/app/build/
android/build/
```

- [ ] **Step 2: Create local Android environment helper**

`scripts/android-env.ps1`:

```powershell
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$LocalAndroid = Join-Path $Root ".local-android"
$JdkHome = Join-Path $LocalAndroid "jdk"
$SdkRoot = Join-Path $LocalAndroid "sdk"

Write-Host "Set JAVA_HOME=$JdkHome"
Write-Host "Set ANDROID_HOME=$SdkRoot"
Write-Host "Set ANDROID_SDK_ROOT=$SdkRoot"
Write-Host "Add tools to PATH before running Gradle."

$env:JAVA_HOME = $JdkHome
$env:ANDROID_HOME = $SdkRoot
$env:ANDROID_SDK_ROOT = $SdkRoot
$env:Path = "$JdkHome\bin;$SdkRoot\cmdline-tools\latest\bin;$SdkRoot\platform-tools;$env:Path"

java -version
sdkmanager --version
```

- [ ] **Step 3: Install JDK and Android command-line tools locally**

Download a Windows x64 JDK zip into `.local-android/jdk` and Android command-line tools into `.local-android/sdk/cmdline-tools/latest`. Then run:

```powershell
.\scripts\android-env.ps1
sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0"
```

Expected: `java -version`, `sdkmanager --version`, and SDK package installation succeed.

- [ ] **Step 4: Build debug APK**

Run:

```powershell
.\scripts\android-env.ps1
cd android
.\gradlew.bat assembleDebug
```

Expected: `android/app/build/outputs/apk/debug/app-debug.apk` exists.

- [ ] **Step 5: Commit helper files**

```bash
git add .gitignore scripts/android-env.ps1
git commit -m "chore: document local android build environment"
```

## Task 10: Final Verification

**Files:**
- No new files.

- [ ] **Step 1: Run full test suite**

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 2: Run web build**

Run: `npm run build`

Expected: TypeScript and Vite build succeed.

- [ ] **Step 3: Run Android sync**

Run: `npx cap sync android`

Expected: Android project is synced with current web assets.

- [ ] **Step 4: Build APK**

Run from `android/`: `.\gradlew.bat assembleDebug`

Expected: `android/app/build/outputs/apk/debug/app-debug.apk` exists.

- [ ] **Step 5: Report result**

Report the APK path and summarize any missing data-source limitations, especially if live free-data integration or call-auction data is not yet wired.
