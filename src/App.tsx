import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Activity, AlertTriangle, ChevronDown, Clock, ShieldCheck, Trash2, Trophy } from "lucide-react";
import { sampleTradingDay } from "./data/sampleTradingDay";
import { generateAuctionPlan, generatePreMarketPlan } from "./domain/strategyEngine";
import type { CandidatePlan, DeleteReason, RecommendationDeletion, StrategyResult, TradeStage } from "./domain/types";

const deleteReasons: DeleteReason[] = ["过热", "不喜欢", "已买过", "风险大", "题材不认可", "其他"];

interface DailyPlan {
  tradeDate: string;
  preMarket: StrategyResult;
  auction: StrategyResult;
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
        <span>{candidate.score} 分</span>
      </div>

      <div className="heat-row">
        <span>情绪温度：{candidate.heat.temperature}</span>
        <span>讨论热度 {candidate.heat.rawScore}</span>
      </div>

      <section>
        <h3>入选理由</h3>
        <ul>
          {candidate.reasons.slice(0, 4).map((reason) => (
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

function History({ dailyPlan }: { dailyPlan: DailyPlan }) {
  return (
    <section className="history">
      <h2>历史推荐</h2>
      <details open>
        <summary>
          <ChevronDown size={16} />
          {getMonthLabel(dailyPlan.tradeDate)}
        </summary>
        <details open>
          <summary>
            <ChevronDown size={16} />
            {getWeekLabel(dailyPlan.tradeDate)}
          </summary>
          <details open>
            <summary>
              <ChevronDown size={16} />
              {dailyPlan.tradeDate}
            </summary>
            <div className="history-day">
              <span>8:30 首推：{dailyPlan.preMarket.candidates[0]?.stock.name ?? "无"}</span>
              <span>9:25 首推：{dailyPlan.auction.candidates[0]?.stock.name ?? "无"}</span>
            </div>
          </details>
        </details>
      </details>
    </section>
  );
}

export default function App() {
  const preMarket = useMemo(() => generatePreMarketPlan(sampleTradingDay), []);
  const auction = useMemo(() => generateAuctionPlan(sampleTradingDay, preMarket), [preMarket]);
  const [deletions, setDeletions] = useState<RecommendationDeletion[]>([]);

  const hiddenKeys = useMemo(
    () => new Set(deletions.map((deletion) => `${deletion.stage}-${deletion.code}`)),
    [deletions]
  );

  const visiblePrePrimary = preMarket.candidates.find((candidate) => !hiddenKeys.has(recommendationKey(preMarket.stage, candidate)));
  const visibleAuctionPrimary = auction.candidates.find((candidate) => !hiddenKeys.has(recommendationKey(auction.stage, candidate)));

  function handleDelete(stage: TradeStage, candidate: CandidatePlan, reason: DeleteReason) {
    setDeletions((current) => [
      ...current,
      {
        code: candidate.stock.code,
        name: candidate.stock.name,
        tradeDate: sampleTradingDay.tradeDate,
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

      <section className="daily-primary">
        <h2>今日首推</h2>
        <PrimaryStrip title="8:30 首推" candidate={visiblePrePrimary} stage={preMarket.stage} onDelete={handleDelete} />
        <PrimaryStrip title="9:25 首推" candidate={visibleAuctionPrimary} stage={auction.stage} onDelete={handleDelete} />
      </section>

      {deletions.length > 0 && (
        <section className="deletion-log">
          已删除 {deletions.length} 条推荐，最近原因：{deletions[deletions.length - 1].reason}
        </section>
      )}

      <History dailyPlan={{ tradeDate: sampleTradingDay.tradeDate, preMarket, auction }} />

      <PlanSection
        title="8:30 准备名单"
        result={preMarket}
        icon={<Clock size={22} />}
        hiddenKeys={hiddenKeys}
        onDelete={handleDelete}
      />
      <PlanSection
        title="9:25 竞价确认"
        result={auction}
        icon={<Activity size={22} />}
        hiddenKeys={hiddenKeys}
        onDelete={handleDelete}
      />

      <footer className="disclaimer">
        <AlertTriangle size={18} />
        <span>本工具只做规则化辅助决策，不构成收益承诺或投资建议。</span>
      </footer>
    </main>
  );
}
