import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Activity, AlertTriangle, ChevronDown, Clock, ShieldCheck, Trash2, Trophy } from "lucide-react";
import { defaultDataProvider } from "./data/defaultDataProvider";
import { createLocalReviewStore } from "./data/localReviewStore";
import type { DataProvider } from "./domain/dataProvider";
import { runIntradayRefresh } from "./domain/intradayJobs";
import {
  buildCandidateReview,
  buildRecommendationSnapshot,
  buildRuleSuggestions,
  getHomeFocus,
  getPrimaryCandidate,
  summarizeReviewOutcome
} from "./domain/reviewEngine";
import { formatBeijingDate, formatBeijingDateTime, formatLocalDate, isAshareTradingDay } from "./domain/tradingCalendar";
import type {
  CandidatePlan,
  DataRefreshStatus,
  DeleteReason,
  CandidateReview,
  HomeFocus,
  IntradayRefreshState,
  RecommendationDeletion,
  RecommendationJobState,
  RuleSuggestion,
  RuleSuggestionStatus,
  StrategyResult,
  TradeExecutionOutcome,
  TradeLogEntry,
  TradeReason,
  TradeStage
} from "./domain/types";

const deleteReasons: DeleteReason[] = ["过热", "不喜欢", "已买过", "风险大", "题材不认可", "其他"];
const tradeReasons: TradeReason[] = ["按计划执行", "追高", "低吸", "打板", "止损", "止盈", "情绪冲动", "临盘放弃", "未达到买点"];
const reviewStore = createLocalReviewStore();

interface DailyPlan {
  tradeDate: string;
  preMarket?: StrategyResult;
  auction?: StrategyResult;
}

function ReviewLearningPanel({ items, focus }: { items: CandidateReview[]; focus: HomeFocus }) {
  const title =
    focus === "INTRADAY_REVIEW" ? "盘中观察" : focus === "THIRD_DAY_FOLLOW_UP" ? "第三天补充" : "复盘学习";

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

function ruleSuggestionStatusLabel(status: RuleSuggestionStatus) {
  switch (status) {
    case "PENDING":
      return "待确认";
    case "APPROVED":
      return "已确认";
    case "REJECTED":
      return "已驳回";
    case "DEFERRED":
      return "暂缓";
  }
}

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
                <b>{ruleSuggestionStatusLabel(suggestion.status)}</b>
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

function initialRefreshState(tradeDate: string): IntradayRefreshState {
  return {
    tradeDate,
    preMarket: {
      stage: "PREMARKET_0830",
      tradeDate,
      status: "PENDING",
      message: "等待24:00生成准备名单"
    },
    auction: {
      stage: "AUCTION_0925",
      tradeDate,
      status: "PENDING",
      message: "等待9:25集合竞价确认"
    }
  };
}

function recommendationKey(tradeDate: string, stage: TradeStage, candidate: CandidatePlan) {
  return `${tradeDate}-${stage}-${candidate.stock.code}`;
}

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

function getMonthLabel(tradeDate: string) {
  const [year, month] = tradeDate.split("-");
  return `${year}年${month}月`;
}

function getWeekLabel(tradeDate: string) {
  const [year, month, day] = tradeDate.split("-").map(Number);
  const firstDayOfMonth = new Date(year, month - 1, 1);
  const mondayBasedOffset = (firstDayOfMonth.getDay() + 6) % 7;
  return `第${Math.ceil((mondayBasedOffset + day) / 7)}周`;
}

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
    const now = localTimestamp(new Date());
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

function CandidateCard({
  candidate,
  stage,
  tradeDate,
  tradeLog,
  onDelete,
  onSaveTrade
}: {
  candidate: CandidatePlan;
  stage: TradeStage;
  tradeDate: string;
  tradeLog?: TradeLogEntry;
  onDelete: (tradeDate: string, stage: TradeStage, candidate: CandidatePlan, reason: DeleteReason) => void;
  onSaveTrade: (entry: TradeLogEntry) => void;
}) {
  const [choosingDelete, setChoosingDelete] = useState(false);
  const [showTradeForm, setShowTradeForm] = useState(false);
  const roleLabel = candidate.role === "PRIMARY" ? "首推" : candidate.role === "CONFIRMED" ? "确认" : "备选";

  return (
    <article className="candidate-card">
      <div className="candidate-head">
        <div>
          <strong>{candidate.stock.name}</strong>
          <span>{candidate.stock.code}</span>
        </div>
        <div className="candidate-actions">
          <b>{roleLabel}</b>
          <button
            aria-label={`删除${candidate.stock.name}`}
            className="icon-button"
            type="button"
            onClick={() => setChoosingDelete((value) => !value)}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {choosingDelete && (
        <div className="delete-reasons">
          {deleteReasons.map((reason) => (
            <button key={reason} type="button" onClick={() => onDelete(tradeDate, stage, candidate, reason)}>
              {reason}
            </button>
          ))}
        </div>
      )}

      <button className="secondary-action" type="button" onClick={() => setShowTradeForm((value) => !value)}>
        记录交易
      </button>
      {tradeLog && <div className="trade-log-summary">真实交易：{tradeOutcomeLabel(tradeLog.outcome)}</div>}
      {showTradeForm && <TradeLogForm candidate={candidate} stage={stage} tradeDate={tradeDate} onSave={onSaveTrade} />}

      <div className="score-row">
        <span>{candidate.theme.name}</span>
        <span>总分 {candidate.score}/100</span>
      </div>

      <div className="score-breakdown">
        {stage === "AUCTION_0925" ? (
          <>
            <span>竞价 {candidate.scoreBreakdown.auction}/40</span>
            <span>24:00 {candidate.scoreBreakdown.premarket}/20</span>
            <span>题材 {candidate.scoreBreakdown.themeOpen}/15</span>
            <span>盘口 {candidate.scoreBreakdown.orderBook}/10</span>
            <span>接力 {candidate.scoreBreakdown.hotMoneyRelay}/10</span>
            <span>复核 {candidate.scoreBreakdown.riskRecheck}/5</span>
          </>
        ) : (
          <>
            <span>交易 {candidate.scoreBreakdown.trading}/25</span>
            <span>游资 {candidate.scoreBreakdown.hotMoney}/20</span>
            <span>量化 {candidate.scoreBreakdown.quant}/20</span>
            <span>热度 {candidate.scoreBreakdown.discussion}/15</span>
            <span>官方 {candidate.scoreBreakdown.official}/10</span>
            <span>复盘 {candidate.scoreBreakdown.review}/10</span>
          </>
        )}
      </div>

      <div className="heat-row">
        <span>情绪温度：{candidate.heat.temperature}</span>
        <span>讨论热度 {candidate.heat.rawScore}</span>
      </div>

      <section>
        <h3>入选理由</h3>
        <ul>
          {candidate.reasons.slice(0, 8).map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
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
          <ul>
            {candidate.risks.slice(0, 4).map((risk) => (
              <li key={risk}>{risk}</li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

function PrimaryStrip({
  title,
  candidate,
  stage,
  tradeDate,
  tradeLog,
  onDelete,
  onSaveTrade
}: {
  title: string;
  candidate?: CandidatePlan;
  stage: TradeStage;
  tradeDate: string;
  tradeLog?: TradeLogEntry;
  onDelete: (tradeDate: string, stage: TradeStage, candidate: CandidatePlan, reason: DeleteReason) => void;
  onSaveTrade: (entry: TradeLogEntry) => void;
}) {
  if (!candidate) {
    return null;
  }

  return (
    <section className="primary-strip">
      <div className="primary-title">
        <Trophy size={18} />
        <span>{title}</span>
      </div>
      <CandidateCard
        candidate={candidate}
        stage={stage}
        tradeDate={tradeDate}
        tradeLog={tradeLog}
        onDelete={onDelete}
        onSaveTrade={onSaveTrade}
      />
    </section>
  );
}

function PlanSection({
  title,
  result,
  icon,
  hiddenKeys,
  tradeDate,
  getTradeLog,
  onDelete,
  onSaveTrade
}: {
  title: string;
  result: StrategyResult;
  icon: ReactNode;
  hiddenKeys: Set<string>;
  tradeDate: string;
  getTradeLog: (tradeDate: string, stage: TradeStage, candidate: CandidatePlan) => TradeLogEntry | undefined;
  onDelete: (tradeDate: string, stage: TradeStage, candidate: CandidatePlan, reason: DeleteReason) => void;
  onSaveTrade: (entry: TradeLogEntry) => void;
}) {
  const visibleCandidates = result.candidates.filter((candidate) => !hiddenKeys.has(recommendationKey(tradeDate, result.stage, candidate)));

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
        {visibleCandidates.map((candidate) => (
          <CandidateCard
            key={`${result.stage}-${candidate.stock.code}`}
            candidate={candidate}
            stage={result.stage}
            tradeDate={tradeDate}
            tradeLog={getTradeLog(tradeDate, result.stage, candidate)}
            onDelete={onDelete}
            onSaveTrade={onSaveTrade}
          />
        ))}
      </div>
    </section>
  );
}

function ArchivedPlanSection({
  title,
  result,
  hiddenKeys,
  tradeDate,
  getTradeLog,
  onDelete,
  onSaveTrade
}: {
  title: string;
  result?: StrategyResult;
  hiddenKeys: Set<string>;
  tradeDate: string;
  getTradeLog: (tradeDate: string, stage: TradeStage, candidate: CandidatePlan) => TradeLogEntry | undefined;
  onDelete: (tradeDate: string, stage: TradeStage, candidate: CandidatePlan, reason: DeleteReason) => void;
  onSaveTrade: (entry: TradeLogEntry) => void;
}) {
  if (!result) {
    return null;
  }

  const visibleCandidates = result.candidates.filter((candidate) => !hiddenKeys.has(recommendationKey(tradeDate, result.stage, candidate)));

  return (
    <details>
      <summary>
        <ChevronDown size={16} />
        {title}
      </summary>
      <div className="archived-list">
        {visibleCandidates.map((candidate) => (
          <CandidateCard
            key={`archive-${result.stage}-${candidate.stock.code}`}
            candidate={candidate}
            stage={result.stage}
            tradeDate={tradeDate}
            tradeLog={getTradeLog(tradeDate, result.stage, candidate)}
            onDelete={onDelete}
            onSaveTrade={onSaveTrade}
          />
        ))}
      </div>
    </details>
  );
}

function HistoryDetails({ initiallyOpen, children }: { initiallyOpen: boolean; children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(initiallyOpen);

  useEffect(() => {
    setIsOpen(initiallyOpen);
  }, [initiallyOpen]);

  return (
    <details open={isOpen} onToggle={(event) => setIsOpen(event.currentTarget.open)}>
      {children}
    </details>
  );
}

interface HistoryWeekGroup {
  weekLabel: string;
  plans: DailyPlan[];
}

interface HistoryMonthGroup {
  monthLabel: string;
  weeks: HistoryWeekGroup[];
}

function groupPlansByMonthAndWeek(plans: DailyPlan[]): HistoryMonthGroup[] {
  const months = new Map<string, Map<string, DailyPlan[]>>();

  for (const plan of plans) {
    const monthLabel = getMonthLabel(plan.tradeDate);
    const weekLabel = getWeekLabel(plan.tradeDate);
    const weeks = months.get(monthLabel) ?? new Map<string, DailyPlan[]>();
    const weekPlans = weeks.get(weekLabel) ?? [];
    weekPlans.push(plan);
    weeks.set(weekLabel, weekPlans);
    months.set(monthLabel, weeks);
  }

  return Array.from(months.entries()).map(([monthLabel, weeks]) => ({
    monthLabel,
    weeks: Array.from(weeks.entries()).map(([weekLabel, weekPlans]) => ({
      weekLabel,
      plans: weekPlans
    }))
  }));
}

function HistoryDay({
  dailyPlan,
  hiddenKeys,
  onDelete,
  getTradeLog,
  onSaveTrade,
  defaultOpen
}: {
  dailyPlan: DailyPlan;
  hiddenKeys: Set<string>;
  onDelete: (tradeDate: string, stage: TradeStage, candidate: CandidatePlan, reason: DeleteReason) => void;
  getTradeLog: (tradeDate: string, stage: TradeStage, candidate: CandidatePlan) => TradeLogEntry | undefined;
  onSaveTrade: (entry: TradeLogEntry) => void;
  defaultOpen: boolean;
}) {
  return (
    <HistoryDetails initiallyOpen={defaultOpen}>
      <summary>
        <ChevronDown size={16} />
        {dailyPlan.tradeDate}
      </summary>
      <div className="history-day">
        <span>24:00 首推：{dailyPlan.preMarket?.candidates[0]?.stock.name ?? "无"}</span>
        <span>9:25 首推：{dailyPlan.auction?.candidates[0]?.stock.name ?? "无"}</span>
      </div>
      <ArchivedPlanSection
        title="24:00 准备名单"
        result={dailyPlan.preMarket}
        hiddenKeys={hiddenKeys}
        tradeDate={dailyPlan.tradeDate}
        getTradeLog={getTradeLog}
        onDelete={onDelete}
        onSaveTrade={onSaveTrade}
      />
      <ArchivedPlanSection
        title="9:25 竞价确认"
        result={dailyPlan.auction}
        hiddenKeys={hiddenKeys}
        tradeDate={dailyPlan.tradeDate}
        getTradeLog={getTradeLog}
        onDelete={onDelete}
        onSaveTrade={onSaveTrade}
      />
    </HistoryDetails>
  );
}

function History({
  dailyPlans,
  hiddenKeys,
  onDelete,
  getTradeLog,
  onSaveTrade,
  phoneDate,
  showTodayTradingPlan
}: {
  dailyPlans: DailyPlan[];
  hiddenKeys: Set<string>;
  onDelete: (tradeDate: string, stage: TradeStage, candidate: CandidatePlan, reason: DeleteReason) => void;
  getTradeLog: (tradeDate: string, stage: TradeStage, candidate: CandidatePlan) => TradeLogEntry | undefined;
  onSaveTrade: (entry: TradeLogEntry) => void;
  phoneDate: string;
  showTodayTradingPlan: boolean;
}) {
  const groups = groupPlansByMonthAndWeek(dailyPlans);

  if (groups.length === 0) {
    return null;
  }

  return (
    <section className="history">
      <h2>历史推荐</h2>
      {groups.map((month) => (
        <HistoryDetails key={month.monthLabel} initiallyOpen={month.weeks.some((week) => week.plans.some((plan) => plan.tradeDate === phoneDate && showTodayTradingPlan))}>
        <summary>
          <ChevronDown size={16} />
          {month.monthLabel}
        </summary>
        {month.weeks.map((week) => (
          <HistoryDetails key={`${month.monthLabel}-${week.weekLabel}`} initiallyOpen={week.plans.some((plan) => plan.tradeDate === phoneDate && showTodayTradingPlan)}>
          <summary>
            <ChevronDown size={16} />
            {week.weekLabel}
          </summary>
          {week.plans.map((dailyPlan) => (
            <HistoryDay
              key={dailyPlan.tradeDate}
              dailyPlan={dailyPlan}
              hiddenKeys={hiddenKeys}
              onDelete={onDelete}
              getTradeLog={getTradeLog}
              onSaveTrade={onSaveTrade}
              defaultOpen={dailyPlan.tradeDate === phoneDate && showTodayTradingPlan}
            />
          ))}
        </HistoryDetails>
        ))}
      </HistoryDetails>
      ))}
    </section>
  );
}

function getStatusLabel(isTradingDay: boolean, hasCurrentDayPlan: boolean) {
  if (!isTradingDay) {
    return "休市";
  }

  return hasCurrentDayPlan ? "可交易" : "待更新";
}

function getDataRefreshLabel(status: DataRefreshStatus) {
  switch (status) {
    case "SUCCESS":
      return "成功";
    case "FAILED":
      return "失败";
    case "MISSING_REQUIRED_DATA":
      return "缺关键数据";
    case "NOT_RECOMMENDED":
      return "不推荐";
    case "PENDING":
    default:
      return "待更新";
  }
}

function stageShortLabel(stage: TradeStage) {
  return stage === "PREMARKET_0830" ? "24:00" : "9:25";
}

function statusClassName(status: DataRefreshStatus) {
  return `job-status job-status-${status.toLowerCase().replace(/_/g, "-")}`;
}

function DataStatusPanel({ preMarket, auction }: { preMarket: RecommendationJobState; auction: RecommendationJobState }) {
  return (
    <section className="job-status-panel">
      {[preMarket, auction].map((job) => (
        <div key={job.stage} className={statusClassName(job.status)}>
          <strong>
            {stageShortLabel(job.stage)} {getDataRefreshLabel(job.status)}
          </strong>
          <p>{job.message}</p>
          {job.updatedAt && <span>更新：{new Date(job.updatedAt).toLocaleTimeString("zh-CN", { hour12: false })}</span>}
        </div>
      ))}
    </section>
  );
}

function planFromRefreshState(state: IntradayRefreshState): DailyPlan | undefined {
  if (!state.preMarket.result && !state.auction.result) {
    return undefined;
  }

  return {
    tradeDate: state.tradeDate,
    preMarket: state.preMarket.result,
    auction: state.auction.result
  };
}

function mergePlan(existing: DailyPlan | undefined, incoming: DailyPlan): DailyPlan {
  return {
    tradeDate: incoming.tradeDate,
    preMarket: incoming.preMarket ?? existing?.preMarket,
    auction: incoming.auction ?? existing?.auction
  };
}

function sortedPlans(plansByDate: Record<string, DailyPlan>) {
  return Object.values(plansByDate).sort((a, b) => b.tradeDate.localeCompare(a.tradeDate));
}

function localTimestamp(date: Date) {
  return formatBeijingDateTime(date);
}

export default function App({ today, dataProvider = defaultDataProvider }: { today?: Date; dataProvider?: DataProvider }) {
  const [currentTime, setCurrentTime] = useState(() => today ?? new Date());
  const [refreshState, setRefreshState] = useState(() => initialRefreshState(formatBeijingDate(today ?? new Date())));
  const refreshStateRef = useRef(refreshState);
  const [plansByDate, setPlansByDate] = useState<Record<string, DailyPlan>>(() => reviewStore.loadDailyPlans());
  const [deletions, setDeletions] = useState<RecommendationDeletion[]>(() => reviewStore.loadDeletions());
  const [tradeLogs, setTradeLogs] = useState<TradeLogEntry[]>(() => reviewStore.loadTradeLogs());
  const [ruleSuggestions, setRuleSuggestions] = useState<RuleSuggestion[]>(() => reviewStore.loadRuleSuggestions());
  const [csvExport, setCsvExport] = useState("");
  const [remoteTradingDayByDate, setRemoteTradingDayByDate] = useState<Record<string, boolean | undefined>>({});
  const phoneDate = formatBeijingDate(currentTime);
  const isTradingDay = remoteTradingDayByDate[phoneDate] ?? isAshareTradingDay(phoneDate);
  const currentGeneratedPlan = refreshState.tradeDate === phoneDate ? planFromRefreshState(refreshState) : undefined;
  const currentPlan = currentGeneratedPlan ?? plansByDate[phoneDate];
  const hasPriorPlan = sortedPlans(plansByDate).some((plan) => plan.tradeDate < phoneDate);
  const homeFocus = getHomeFocus(currentTime, isTradingDay, { preferFollowUpBeforeOpen: hasPriorPlan && !currentPlan });
  const preMarket = currentPlan?.preMarket;
  const auction = currentPlan?.auction;
  const hasCurrentDayPlan = Boolean(currentPlan);
  const showTodayTradingPlan = isTradingDay && hasCurrentDayPlan;
  const statusLabel = getStatusLabel(isTradingDay, hasCurrentDayPlan);
  const dataCompleteness = auction?.dataCompleteness ?? preMarket?.dataCompleteness ?? getDataRefreshLabel(refreshState.preMarket.status);

  const refreshForTime = useCallback(
    async (time: Date) => {
      setCurrentTime(time);
      const nextState = await runIntradayRefresh({
        now: time,
        provider: dataProvider,
        previousState: refreshStateRef.current.tradeDate === formatBeijingDate(time) ? refreshStateRef.current : undefined
      });
      if (dataProvider.fetchTradingStatus) {
        const status = await dataProvider.fetchTradingStatus(formatBeijingDate(time));
        if (status.status === "SUCCESS") {
          setRemoteTradingDayByDate((current) => ({
            ...current,
            [formatBeijingDate(time)]: status.input.isTradingDay
          }));
        }
      }
      refreshStateRef.current = nextState;
      setRefreshState(nextState);

      const generatedPlan = planFromRefreshState(nextState);
      if (generatedPlan) {
        const updatedAt = nextState.auction.updatedAt ?? nextState.preMarket.updatedAt ?? localTimestamp(time);
        if (nextState.preMarket.result) {
          reviewStore.saveSnapshot(buildRecommendationSnapshot(nextState.preMarket.result, updatedAt));
        }
        if (nextState.auction.result) {
          reviewStore.saveSnapshot(buildRecommendationSnapshot(nextState.auction.result, updatedAt));
        }
        setPlansByDate((current) => {
          const merged = {
            ...current,
            [generatedPlan.tradeDate]: mergePlan(current[generatedPlan.tradeDate], generatedPlan)
          };
          return {
            ...merged,
            ...reviewStore.loadDailyPlans()
          };
        });
      }
    },
    [dataProvider]
  );

  useEffect(() => {
    const refreshCurrentTime = () => {
      void refreshForTime(today ?? new Date());
    };

    refreshCurrentTime();

    if (today) {
      return undefined;
    }

    const intervalId = window.setInterval(refreshCurrentTime, 60_000);
    window.addEventListener("focus", refreshCurrentTime);
    document.addEventListener("visibilitychange", refreshCurrentTime);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshCurrentTime);
      document.removeEventListener("visibilitychange", refreshCurrentTime);
    };
  }, [refreshForTime, today]);

  const hiddenKeys = useMemo(
    () => new Set(deletions.map((deletion) => `${deletion.tradeDate}-${deletion.stage}-${deletion.code}`)),
    [deletions]
  );

  const visiblePrePrimary = preMarket?.candidates.find((candidate) =>
    !hiddenKeys.has(recommendationKey(currentPlan?.tradeDate ?? phoneDate, preMarket.stage, candidate))
  );
  const visibleAuctionPrimary = auction?.candidates.find((candidate) =>
    (candidate.role === "PRIMARY" || candidate.role === "CONFIRMED") &&
    !hiddenKeys.has(recommendationKey(currentPlan?.tradeDate ?? phoneDate, auction.stage, candidate))
  );
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
          localTimestamp(currentTime)
        )
      );
    }
    return items;
  }, [currentTime, phoneDate, plansByDate]);

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
        localTimestamp(currentTime)
      );
      generated.push(...buildRuleSuggestions(result, primary, review, "样本不足阶段"));
    }

    reviewStore.upsertRuleSuggestions(generated);
    setRuleSuggestions(reviewStore.loadRuleSuggestions());
  }, [currentTime, phoneDate, plansByDate]);

  function getTradeLog(tradeDate: string, stage: TradeStage, candidate: CandidatePlan) {
    return tradeLogs.find(
      (entry) => entry.recommendationTradeDate === tradeDate && entry.stage === stage && entry.code === candidate.stock.code
    );
  }

  function handleDelete(tradeDate: string, stage: TradeStage, candidate: CandidatePlan, reason: DeleteReason) {
    const deletion: RecommendationDeletion = {
      code: candidate.stock.code,
      name: candidate.stock.name,
      tradeDate,
      stage,
      role: candidate.role,
      reason,
      deletedAt: localTimestamp(new Date())
    };
    reviewStore.saveDeletion(deletion);
    setDeletions(reviewStore.loadDeletions());
  }

  function handleSaveTrade(entry: TradeLogEntry) {
    reviewStore.upsertTradeLog(entry);
    setTradeLogs(reviewStore.loadTradeLogs());
  }

  function handleRuleSuggestionStatus(id: string, status: RuleSuggestionStatus) {
    reviewStore.updateRuleSuggestionStatus(id, status);
    setRuleSuggestions(reviewStore.loadRuleSuggestions());
  }

  function handleExportCsv() {
    setCsvExport(reviewStore.exportTradeLogsCsv());
  }

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <span className="eyebrow">A股短波段</span>
          <h1>每日选股计划</h1>
        </div>
        <div className="status-pill">
          <ShieldCheck size={18} />
          {statusLabel}
        </div>
      </header>

      <section className="market-panel">
        <div>
          <span>交易日</span>
          <strong>{phoneDate}</strong>
        </div>
        <div>
          <span>数据状态</span>
          <strong>{dataCompleteness}</strong>
        </div>
        <div>
          <span>硬止损</span>
          <strong>-8%</strong>
        </div>
      </section>

      {isTradingDay && <DataStatusPanel preMarket={refreshState.preMarket} auction={refreshState.auction} />}

      {!isTradingDay && <section className="closed-banner">今日未开市，好好休息！</section>}
      {isTradingDay && !hasCurrentDayPlan && refreshState.preMarket.status === "PENDING" && (
        <section className="pending-banner">今日计划尚未生成，请等待24:00数据更新。</section>
      )}

      {showTodayTradingPlan && (
        <section className="daily-primary">
          <h2>今日首推</h2>
          <PrimaryStrip
            title="24:00 首推"
            candidate={visiblePrePrimary}
            stage="PREMARKET_0830"
            tradeDate={phoneDate}
            tradeLog={visiblePrePrimary ? getTradeLog(phoneDate, "PREMARKET_0830", visiblePrePrimary) : undefined}
            onDelete={handleDelete}
            onSaveTrade={handleSaveTrade}
          />
          <PrimaryStrip
            title="9:25 首推"
            candidate={visibleAuctionPrimary}
            stage="AUCTION_0925"
            tradeDate={phoneDate}
            tradeLog={visibleAuctionPrimary ? getTradeLog(phoneDate, "AUCTION_0925", visibleAuctionPrimary) : undefined}
            onDelete={handleDelete}
            onSaveTrade={handleSaveTrade}
          />
        </section>
      )}

      {(homeFocus === "INTRADAY_REVIEW" || homeFocus === "CLOSE_REVIEW" || homeFocus === "THIRD_DAY_FOLLOW_UP") && (
        <ReviewLearningPanel items={reviewItems} focus={homeFocus} />
      )}

      <RuleSuggestionPanel suggestions={ruleSuggestions} onChangeStatus={handleRuleSuggestionStatus} />

      {deletions.length > 0 && (
        <section className="deletion-log">
          已删除 {deletions.length} 条推荐，最近原因：{deletions[deletions.length - 1].reason}
        </section>
      )}

      <History
        dailyPlans={sortedPlans(plansByDate)}
        hiddenKeys={hiddenKeys}
        onDelete={handleDelete}
        getTradeLog={getTradeLog}
        onSaveTrade={handleSaveTrade}
        phoneDate={phoneDate}
        showTodayTradingPlan={showTodayTradingPlan}
      />

      {showTodayTradingPlan && preMarket && (
        <>
          <PlanSection
            title="24:00 准备名单"
            result={preMarket}
            icon={<Clock size={22} />}
            hiddenKeys={hiddenKeys}
            tradeDate={phoneDate}
            getTradeLog={getTradeLog}
            onDelete={handleDelete}
            onSaveTrade={handleSaveTrade}
          />
          {auction && (
            <PlanSection
              title="9:25 竞价确认"
              result={auction}
              icon={<Activity size={22} />}
              hiddenKeys={hiddenKeys}
              tradeDate={phoneDate}
              getTradeLog={getTradeLog}
              onDelete={handleDelete}
              onSaveTrade={handleSaveTrade}
            />
          )}
        </>
      )}

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

      <footer className="disclaimer">
        <AlertTriangle size={18} />
        <span>本工具只做规则化辅助决策，不构成收益承诺或投资建议。</span>
      </footer>
    </main>
  );
}
