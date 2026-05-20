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

- Home: today's status, current stage, and whether trading is allowed.
- 08:30 Plan: 3-5 pre-market candidates with reasons, risks, and planned trigger conditions.
- 09:25 Confirmation: top recommendation, confirmed candidates, and backups.
- Stock Detail: theme, leader status, scores, auction confirmation, entry plan, stop rules, and invalidation conditions.
- Settings: data-source configuration, thresholds, and refresh behavior.

The interface should be dense, readable, and trading-focused. It should not look like a marketing landing page.

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
- Each output stock includes a trade plan with reasons, risks, entry trigger, no-buy condition, stop-loss rule, and trend exit logic.
- If the market gate fails, the app clearly returns no trade signal.
- If required data is missing, the app shows the missing-data state instead of silently fabricating confidence.
