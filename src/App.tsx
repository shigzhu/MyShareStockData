import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Activity, AlertTriangle, ChevronDown, Clock, ShieldCheck, Trash2, Trophy } from "lucide-react";
import { defaultDataProvider } from "./data/defaultDataProvider";
import type { DataProvider } from "./domain/dataProvider";
import { runIntradayRefresh } from "./domain/intradayJobs";
import { formatLocalDate, isAshareTradingDay } from "./domain/tradingCalendar";
import type {
  CandidatePlan,
  DataRefreshStatus,
  DeleteReason,
  IntradayRefreshState,
  RecommendationDeletion,
  RecommendationJobState,
  StrategyResult,
  TradeStage
} from "./domain/types";

const deleteReasons: DeleteReason[] = ["过热", "不喜欢", "已买过", "风险大", "题材不认可", "其他"];

interface DailyPlan {
  tradeDate: string;
  preMarket?: StrategyResult;
  auction?: StrategyResult;
}

function initialRefreshState(tradeDate: string): IntradayRefreshState {
  return {
    tradeDate,
    preMarket: {
      stage: "PREMARKET_0830",
      tradeDate,
      status: "PENDING",
      message: "等待8:30生成准备名单"
    },
    auction: {
      stage: "AUCTION_0925",
      tradeDate,
      status: "PENDING",
      message: "等待9:25集合竞价确认"
    }
  };
}

function recommendationKey(stage: TradeStage, candidate: CandidatePlan) {
  return `${stage}-${candidate.stock.code}`;
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

function CandidateCard({
  candidate,
  stage,
  onDelete
}: {
  candidate: CandidatePlan;
  stage: TradeStage;
  onDelete: (stage: TradeStage, candidate: CandidatePlan, reason: DeleteReason) => void;
}) {
  const [choosingDelete, setChoosingDelete] = useState(false);
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
            <button key={reason} type="button" onClick={() => onDelete(stage, candidate, reason)}>
              {reason}
            </button>
          ))}
        </div>
      )}

      <div className="score-row">
        <span>{candidate.theme.name}</span>
        <span>总分 {candidate.score}/100</span>
      </div>

      <div className="score-breakdown">
        <span>交易 {candidate.scoreBreakdown.trading}/20</span>
        <span>游资 {candidate.scoreBreakdown.hotMoney}/20</span>
        <span>热度 {candidate.scoreBreakdown.discussion}/30</span>
        <span>量化 {candidate.scoreBreakdown.quant}/30</span>
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
  onDelete
}: {
  title: string;
  candidate?: CandidatePlan;
  stage: TradeStage;
  onDelete: (stage: TradeStage, candidate: CandidatePlan, reason: DeleteReason) => void;
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
      <CandidateCard candidate={candidate} stage={stage} onDelete={onDelete} />
    </section>
  );
}

function PlanSection({
  title,
  result,
  icon,
  hiddenKeys,
  onDelete
}: {
  title: string;
  result: StrategyResult;
  icon: ReactNode;
  hiddenKeys: Set<string>;
  onDelete: (stage: TradeStage, candidate: CandidatePlan, reason: DeleteReason) => void;
}) {
  const visibleCandidates = result.candidates.filter((candidate) => !hiddenKeys.has(recommendationKey(result.stage, candidate)));

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
            onDelete={onDelete}
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
  onDelete
}: {
  title: string;
  result?: StrategyResult;
  hiddenKeys: Set<string>;
  onDelete: (stage: TradeStage, candidate: CandidatePlan, reason: DeleteReason) => void;
}) {
  if (!result) {
    return null;
  }

  const visibleCandidates = result.candidates.filter((candidate) => !hiddenKeys.has(recommendationKey(result.stage, candidate)));

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
            onDelete={onDelete}
          />
        ))}
      </div>
    </details>
  );
}

function HistoryDetails({ initiallyOpen, children }: { initiallyOpen: boolean; children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(initiallyOpen);

  return (
    <details open={isOpen} onToggle={(event) => setIsOpen(event.currentTarget.open)}>
      {children}
    </details>
  );
}

function History({
  dailyPlan,
  hiddenKeys,
  onDelete,
  defaultOpen
}: {
  dailyPlan: DailyPlan;
  hiddenKeys: Set<string>;
  onDelete: (stage: TradeStage, candidate: CandidatePlan, reason: DeleteReason) => void;
  defaultOpen: boolean;
}) {
  return (
    <section className="history">
      <h2>历史推荐</h2>
      <HistoryDetails initiallyOpen={defaultOpen}>
        <summary>
          <ChevronDown size={16} />
          {getMonthLabel(dailyPlan.tradeDate)}
        </summary>
        <HistoryDetails initiallyOpen={defaultOpen}>
          <summary>
            <ChevronDown size={16} />
            {getWeekLabel(dailyPlan.tradeDate)}
          </summary>
          <HistoryDetails initiallyOpen={defaultOpen}>
            <summary>
              <ChevronDown size={16} />
              {dailyPlan.tradeDate}
            </summary>
            <div className="history-day">
              <span>8:30 首推：{dailyPlan.preMarket?.candidates[0]?.stock.name ?? "无"}</span>
              <span>9:25 首推：{dailyPlan.auction?.candidates[0]?.stock.name ?? "无"}</span>
            </div>
            <ArchivedPlanSection
              title="8:30 准备名单"
              result={dailyPlan.preMarket}
              hiddenKeys={hiddenKeys}
              onDelete={onDelete}
            />
            <ArchivedPlanSection
              title="9:25 竞价确认"
              result={dailyPlan.auction}
              hiddenKeys={hiddenKeys}
              onDelete={onDelete}
            />
          </HistoryDetails>
        </HistoryDetails>
      </HistoryDetails>
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
  return stage === "PREMARKET_0830" ? "8:30" : "9:25";
}

function DataStatusPanel({ preMarket, auction }: { preMarket: RecommendationJobState; auction: RecommendationJobState }) {
  return (
    <section className="job-status-panel">
      {[preMarket, auction].map((job) => (
        <div key={job.stage} className={`job-status job-status-${job.status.toLowerCase().replaceAll("_", "-")}`}>
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

export default function App({ today, dataProvider = defaultDataProvider }: { today?: Date; dataProvider?: DataProvider }) {
  const [currentTime, setCurrentTime] = useState(() => today ?? new Date());
  const [refreshState, setRefreshState] = useState(() => initialRefreshState(formatLocalDate(today ?? new Date())));
  const refreshStateRef = useRef(refreshState);
  const [plansByDate, setPlansByDate] = useState<Record<string, DailyPlan>>({});
  const [deletions, setDeletions] = useState<RecommendationDeletion[]>([]);
  const phoneDate = formatLocalDate(currentTime);
  const isTradingDay = isAshareTradingDay(phoneDate);
  const currentGeneratedPlan = refreshState.tradeDate === phoneDate ? planFromRefreshState(refreshState) : undefined;
  const currentPlan = currentGeneratedPlan ?? plansByDate[phoneDate];
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
        previousState: refreshStateRef.current.tradeDate === formatLocalDate(time) ? refreshStateRef.current : undefined
      });
      refreshStateRef.current = nextState;
      setRefreshState(nextState);

      const generatedPlan = planFromRefreshState(nextState);
      if (generatedPlan) {
        setPlansByDate((current) => ({
          ...current,
          [generatedPlan.tradeDate]: mergePlan(current[generatedPlan.tradeDate], generatedPlan)
        }));
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
    () => new Set(deletions.map((deletion) => `${deletion.stage}-${deletion.code}`)),
    [deletions]
  );

  const visiblePrePrimary = preMarket?.candidates.find((candidate) => !hiddenKeys.has(recommendationKey(preMarket.stage, candidate)));
  const visibleAuctionPrimary = auction?.candidates.find((candidate) => !hiddenKeys.has(recommendationKey(auction.stage, candidate)));

  function handleDelete(stage: TradeStage, candidate: CandidatePlan, reason: DeleteReason) {
    setDeletions((current) => [
      ...current,
      {
        code: candidate.stock.code,
        name: candidate.stock.name,
        tradeDate: phoneDate,
        stage,
        role: candidate.role,
        reason,
        deletedAt: new Date().toISOString()
      }
    ]);
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
        <section className="pending-banner">今日计划尚未生成，请等待8:30数据更新。</section>
      )}

      {showTodayTradingPlan && (
        <section className="daily-primary">
          <h2>今日首推</h2>
          <PrimaryStrip title="8:30 首推" candidate={visiblePrePrimary} stage="PREMARKET_0830" onDelete={handleDelete} />
          <PrimaryStrip title="9:25 首推" candidate={visibleAuctionPrimary} stage="AUCTION_0925" onDelete={handleDelete} />
        </section>
      )}

      {deletions.length > 0 && (
        <section className="deletion-log">
          已删除 {deletions.length} 条推荐，最近原因：{deletions[deletions.length - 1].reason}
        </section>
      )}

      {sortedPlans(plansByDate).map((dailyPlan) => (
        <History
          key={`${dailyPlan.tradeDate}-${dailyPlan.tradeDate === phoneDate && showTodayTradingPlan ? "open" : "closed"}`}
          dailyPlan={dailyPlan}
          hiddenKeys={hiddenKeys}
          onDelete={handleDelete}
          defaultOpen={dailyPlan.tradeDate === phoneDate && showTodayTradingPlan}
        />
      ))}

      {showTodayTradingPlan && preMarket && (
        <>
          <PlanSection
            title="8:30 准备名单"
            result={preMarket}
            icon={<Clock size={22} />}
            hiddenKeys={hiddenKeys}
            onDelete={handleDelete}
          />
          {auction && (
            <PlanSection
              title="9:25 竞价确认"
              result={auction}
              icon={<Activity size={22} />}
              hiddenKeys={hiddenKeys}
              onDelete={handleDelete}
            />
          )}
        </>
      )}

      <footer className="disclaimer">
        <AlertTriangle size={18} />
        <span>本工具只做规则化辅助决策，不构成收益承诺或投资建议。</span>
      </footer>
    </main>
  );
}
