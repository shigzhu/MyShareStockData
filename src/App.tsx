import type { ReactNode } from "react";
import { Activity, AlertTriangle, Clock, ShieldCheck } from "lucide-react";
import { sampleTradingDay } from "./data/sampleTradingDay";
import { generateAuctionPlan, generatePreMarketPlan } from "./domain/strategyEngine";
import type { CandidatePlan, StrategyResult } from "./domain/types";

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

function PlanSection({ title, result, icon }: { title: string; result: StrategyResult; icon: ReactNode }) {
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
