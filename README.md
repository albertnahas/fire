# Fire

A financial independence calculator that works backwards from what you spend, tells you the date you can stop working, and is honest about how wide that date really is.

Everything runs in your browser. No accounts, no network calls, no data leaves the machine — the plan is saved to `localStorage`.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static bundle in dist/
```

## What it does

**Works in both directions.** Give it your numbers and it finds the date. Or name the date and it solves for the monthly saving, or for the budget, that would get you there.

**Nothing is required.** Every figure can be left blank, and the engine fills it from market history or from the rest of your plan. Blank fields show the engine's value dashed and grey; type over one and it becomes yours; press `reset` to hand it back.

**Simulates 3,000 lives, not one average.** A single average-return line is the standard way retirement maths misleads. Two lives with identical average returns end very differently if one meets its crash early. Withdrawals are taken at the start of each year, before that year's return, which is what makes an early crash so hard to recover from.

**Counts down in weeks.** One square per working week, holidays removed, plus the same number in paychecks, working days and Monday mornings.

**Ranks what actually moves the date.** Each lever is applied on its own and measured in months earlier. Spending nearly always wins, because it shrinks the target and grows the saving at the same time.

## The methods

| | |
|---|---|
| **Block bootstrap** (default) | Resamples contiguous runs of history, so crashes, recoveries and inflation shocks arrive in realistic clusters. Shuffling year by year produces a suspiciously safe world. |
| **Historical** | Every actual start year, 1928–2025, in the order it happened. The Trinity/cFIREsim approach. |
| **Parametric** | Random draws from normals fitted to the record, with a 0.1 stock/bond correlation. |

Five withdrawal strategies: Bengen's horizon-adjusted SAFEMAX, a fixed rate, the CAPE rule, Guyton-Klinger guardrails, and variable percentage withdrawal. Fixed-spend rules are scored on whether the money lasted; percentage-of-portfolio rules cannot run out, so they are scored on how far spending fell instead.

Also modelled: three account types with different tax treatment, the pre-59½ access bridge, employer match, a glidepath to a retirement allocation, real income growth and lifestyle creep, fee drag, pensions and social security, one-off windfalls and costs, and a valuation adjustment that damps early equity returns because today's Shiller CAPE is 41.

## The data

98 calendar years, 1928–2025, deflated by that year's CPI:

- S&P 500 total return, 3-month T-bills and the 10-year Treasury — [Damodaran, NYU Stern](https://pages.stern.nyu.edu/adamodar/New_Home_Page/datafile/histretSP.html)
- CPI (Dec–Dec) — US BLS
- [Shiller CAPE](https://www.multpl.com/shiller-pe), 41.34 as of July 2026

Withdrawal-rate research: [Bengen's 4.7% revision](https://www.advisorperspectives.com/articles/2025/08/29/bill-bengen-boosts-the-4-7) (2025), [ERN's CAPE-based rates](https://earlyretirementnow.com/2022/10/12/dynamic-withdrawal-rates-based-on-the-shiller-cape-swr-series-part-54/), [Guyton-Klinger guardrails](https://www.whitecoatinvestor.com/guyton-klinger-guardrails-approach-for-retirement/).

## What is simplified

Tax is a single effective rate per account type, not a bracket calculation. Rebalancing is assumed free and annual. Property and business equity are not modelled — enter them as a one-off event on the date you expect to realise them.

Nothing here accounts for your jurisdiction's rules, and none of it is advice.

## Layout

```
src/
  data/market-history.ts   98 years of real returns, and the stats derived from them
  engine/
    types.ts               every input is `number | null`; null means "you decide"
    assumptions.ts         defaults, recommendations, and the reasoning behind each
    projection.ts          the central month-by-month path, and the reverse solvers
    monte-carlo.ts         path generation, withdrawal strategies, sensitivity
    milestones.ts          Coast / Lean / Barista / Full / Fat, and the 59½ bridge
    worker.ts              simulation runs off the main thread
  components/
    Crossing.tsx           the chart: canvas fan, SVG annotation, hover readout
    WeeksGrid.tsx          the countdown
    Ledger.tsx             every input
```

The simulation runs in a Web Worker, debounced 220 ms, so the UI stays responsive while you type. A full 3,000-life run takes about 65 ms.
