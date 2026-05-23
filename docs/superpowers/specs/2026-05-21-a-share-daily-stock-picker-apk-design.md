# A Share Daily Stock Picker APK Design

## Goal

Build an Android APK that produces a disciplined daily A-share short-swing stock plan. The app recommends 3-5 candidates before 08:30 from the previous trading day's data, then confirms the same candidates after the 09:25 call auction. The system is a rule-based decision aid, not a guaranteed-profit engine.

## Trading Style

- Market: China A-share stocks.
- Timing: daily trading preparation.
- Holding period: 3-10 trading days.
- Style: hot-theme, high-attention, high-liquidity leaders that have not become overheated.
- Final output: trade-plan style recommendations, not only a plain ranking list.
- Risk posture: strict. Missing a trade is acceptable; stepping into obvious risk is not.

## Two-Stage Daily Workflow

### 08:30 Pre-Market Candidate List

Before 08:30, the app uses data available after the previous trading day to generate 3-5 preparation candidates.

The pre-market flow is:

1. Check whether the previous market environment is tradable.
2. Identify the strongest 1-2 market themes.
3. In each selected theme, identify the real attention leader by turnover, liquidity, and market focus.
4. Reject the whole theme if its attention leader is already overheated.
5. Apply strict stock-level risk filters.
6. Score remaining candidates and output 3-5 trade plans.

The 08:30 list is a preparation list. It must not be treated as an automatic open-buy instruction.

### 09:25 Call-Auction Confirmation

After 09:25, the app checks only the 08:30 candidates. It does not add new stocks from the whole market.

The confirmation flow is:

1. Re-check market mood through call-auction behavior where data is available.
2. Confirm each 08:30 candidate's auction activity.
3. Prefer candidates with very obvious call-auction volume expansion.
4. Prefer strong-but-not-overheated gaps, roughly 3%-7%, only when supported by strong auction volume.
5. Reject high-open candidates with weak auction volume.
6. Rank confirmed candidates first, then fill the 09:25 output with the strongest remaining prepared candidates as backups.

If only one candidate fully passes the 09:25 confirmation, that stock becomes the top recommendation. The app then adds two backup candidates from the 08:30 list by comprehensive score. Backups are observation candidates until their theme leader stays strong and the stock's own turnover expands during the session.

## Market Environment Gate

The system first decides whether the market is tradable. If the market environment is not qualified, the app returns an empty trading signal for the day.

The market gate focuses on money-making effect, not only index direction:

- Advancing stock count versus declining stock count.
- Limit-up count.
- Limit-down count.
- Consecutive limit-up height.
- Failed-board ratio.
- Performance of yesterday's limit-up stocks.
- Whether strong themes show continuation rather than one-day rotation.

The initial product can represent the gate as `TRADABLE` or `NO_TRADE`. Internally it may keep intermediate scores for explanation and later tuning.

## Theme Selection Rules

The app selects the strongest 1-2 themes. It does not spread candidates across many weak themes just to diversify.

Theme strength is scored from:

- Recent theme price strength.
- Theme-level money-making effect.
- Theme turnover and turnover expansion.
- Continuation across multiple sessions.
- Status of the theme's attention leader.

If the clearest theme leader is already overheated, the app rejects the whole theme instead of buying weaker followers.

## Cross-Platform Discussion Heat

The system must include daily market discussion heat as 30% of the stock score. This corrects the first prototype's weakness of relying too heavily on internal sample price and turnover data.

Discussion heat sources for the first scoring model are:

- Tonghuashun / iWencai-style stock attention: 10%.
- East Money Guba discussion and popularity: 10%.
- Weibo finance and stock-super-topic discussion: 10%.

Discussion heat is bidirectional:

- Moderate heat means a stock is being noticed by the market and receives a positive score.
- Cold stocks are downgraded because the app is designed for short-swing attention leaders, not long-term hidden positions.
- Extreme heat is not automatically positive. Low-position, newly launched stocks with extreme heat may remain eligible with a risk label. High-position stocks with extreme heat are rejected or downgraded to observation.

Low-position newly launched status requires all three conditions:

- Price position: recent 10-day return is not excessive and price is not far above the 5-day and 10-day moving averages.
- Heat position: the stock entered discussion rankings during the last 1-3 days and was not already a long-running screen-dominating name.
- Volume-price position: turnover has started to expand, but the stock has not shown consecutive high-level limit-ups, blow-off volume, or weak acceptance.

The output must show an emotion-temperature label such as `冷门`, `升温`, `热门`, `过热`, or `异常刷屏`.

## Theme Leader Definition

Within a theme, the leader is primarily the stock with the highest market attention:

- Large turnover.
- Sufficient turnover rate.
- Repeated market participation.
- High relative attention inside the theme.

Consecutive limit-up height is useful context, but it is not the primary definition of leadership.

## Not-Overheated Definition

A candidate must show early or mid-stage strength without obvious exhaustion. The system evaluates overheat through several dimensions instead of a single return threshold:

- Recent 5/10/20-day return is not excessive.
- Price is not too far above the 5-day and 10-day moving averages.
- No extreme consecutive high-level limit-up pattern.
- No single-day blow-off volume followed by weak acceptance.
- No near-unbuyable one-price limit-up state as a buy signal.

## Risk Filters

Strict filters remove stocks before scoring:

- ST, *ST, delisting-risk, suspended, or recently abnormal trading status.
- Extremely poor liquidity.
- Very new listings without enough trading history.
- Serious loss or clear financial distress when available from free data.
- Major negative announcement, regulatory penalty, severe pledge risk, large planned reduction, or clear performance collapse when available from free data.
- High-level overheat, weak acceptance after blow-off volume, or obvious theme leader failure.

If a risk signal cannot be reliably collected from free data in the first version, the app marks the risk as `UNKNOWN` and does not pretend the check was completed.

## 09:25 Auction Confirmation Rules

The most important confirmation factor is auction turnover activity.

Preferred state:

- Auction turnover is very obviously expanded versus the stock's own recent auction baseline.
- Auction turnover is meaningful relative to yesterday's daily turnover.
- Gap is roughly 3%-7%.
- The gap is supported by real turnover, not a thin or fake high-open.
- The theme leader is stable or stronger.

Reject or downgrade:

- Weak auction turnover.
- High-open without turnover support.
- Near one-price limit-up state as a buy signal.
- Visible weak-to-strong failure.
- Theme leader sharply weakens, dives, or loses acceptance.

## Backup Upgrade Rule

Backup candidates can upgrade to buy candidates during the session only when:

- The theme leader is stable or continues to strengthen.
- The backup stock's own turnover expands at the same time.
- The move is not a thin, isolated price spike.

If the theme leader weakens, backups do not upgrade even if they briefly rise.

## Entry, Positioning, And Exit

The app recommends staged entries rather than a single all-in entry.

Initial structure:

- First entry: only after 09:25 confirmation or backup upgrade conditions are met.
- Add-on entry: only after price and turnover confirm continuation.
- No add-on if the stock shows volume-without-price progress, theme weakness, or broken support.

Risk and exit:

- Hard stop: around -8% maximum single-stock loss.
- Logic stop: exit earlier when theme logic fails, leader weakens, key support breaks, or market money-making effect collapses.
- Profit-taking: trend-based. Hold while the short trend remains intact; exit when 5-day/10-day moving average, key support, or theme logic breaks.
- Time discipline: if the 3-10 trading day logic does not materialize, the position should not be held indefinitely.

## Data Source Policy

Use free data first.

Potential first-version sources:

- Daily stock quotes, turnover, volume, return, moving averages.
- Sector or concept board quotes and constituent stocks.
- Limit-up/limit-down and market-breadth data.
- Call-auction data if available from a free source; otherwise the 09:25 module must expose a manual import or delayed-data fallback.
- Basic risk flags such as ST, suspension, listing age, and common financial risk fields.

The app must be honest about missing data. It should show whether a recommendation was based on fully collected data, partial free data, or user-imported auction data.

## Android Product Shape

The APK should run on a phone and show the daily plan clearly.

Primary screens:

- Home: today's status, current stage, whether trading is allowed, and the daily top recommendations placed first.
- History: recommendations grouped as month > week > day collapsible sections.
- 08:30 Plan: a top recommendation plus 3-5 pre-market candidates with reasons, risks, planned trigger conditions, and discussion-heat labels.
- 09:25 Confirmation: a top recommendation plus confirmed candidates and backups.
- Stock Detail: theme, leader status, scores, auction confirmation, entry plan, stop rules, and invalidation conditions.
- Settings: data-source configuration, thresholds, and refresh behavior.

The interface should be dense, readable, and trading-focused. It should not look like a marketing landing page.

Each recommendation row must support deletion with a required reason. Deletion means the recommendation is hidden from the current list and a feedback record is kept for later model tuning. Reasons include `过热`, `不喜欢`, `已买过`, `风险大`, `题材不认可`, and `其他`. Repeated deletion patterns can later lower a stock, theme, platform heat source, or risk tolerance.

## Non-Goals For The First Version

- No promise of automatic profits.
- No fully automated brokerage trading.
- No paid-data dependency as a first requirement.
- No black-box machine learning model.
- No full backtesting platform unless added in a later phase.
- No intraday high-frequency strategy.

## Success Criteria

- The APK can generate an 08:30 preparation list of up to 3-5 candidates from available previous-day data.
- The APK can run a 09:25 confirmation pass over only the 08:30 candidates.
- The APK shows a clear top recommendation for both 08:30 and 09:25.
- The APK groups recommendation history by month, week, and day with collapsible sections.
- The APK allows each recommendation to be deleted with a recorded reason.
- The APK includes a 30% discussion-heat score and labels extreme heat as an explicit risk.
- Each output stock includes a trade plan with reasons, risks, entry trigger, no-buy condition, stop-loss rule, and trend exit logic.
- If the market gate fails, the app clearly returns no trade signal.
- If required data is missing, the app shows the missing-data state instead of silently fabricating confidence.
