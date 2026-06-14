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
        const existingById = new Map(state.ruleSuggestions.map((item) => [item.id, item]));
        const preserved = state.ruleSuggestions.filter((item) => !incomingById.has(item.id));
        const mergedIncoming = suggestions.map((item) => {
          const existing = existingById.get(item.id);
          return existing ? { ...item, status: existing.status } : item;
        });
        return {
          ...state,
          ruleSuggestions: [...preserved, ...mergedIncoming].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
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
        entry.stage === "PREMARKET_0830" ? "24:00" : "9:25",
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
      const header = [
        "推荐日期",
        "阶段",
        "代码",
        "名称",
        "是否买入",
        "买入价",
        "卖出价",
        "仓位",
        "买入时间",
        "卖出时间",
        "原因",
        "结果",
        "备注"
      ];
      return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    },

    clear(): void {
      writeState(storageKey, cloneDefaultState());
    }
  };
}

export type LocalReviewStore = ReturnType<typeof createLocalReviewStore>;
