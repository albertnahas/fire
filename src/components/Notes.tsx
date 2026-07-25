import { CURRENT_CAPE, MARKET_HISTORY, REAL_STATS } from '../data/market-history';
import { pct } from '../engine/format';

export function Notes() {
  return (
    <div className="notes">
      <p>
        <b>Everything is in today’s money.</b> Returns, spending and balances are inflation-adjusted, so a figure
        shown for 2049 is what it would buy now. This avoids the usual trap of a large nominal number that quietly
        means less.
      </p>
      <p>
        <b>The data.</b> {MARKET_HISTORY.length} calendar years, 1928–2025: S&P 500 total return, 3-month Treasury
        bills and the 10-year Treasury, each deflated by that year’s CPI. Real compound returns over the whole
        record are {pct(REAL_STATS.stocks.cagr)} for stocks, {pct(REAL_STATS.bonds.cagr)} for bonds and{' '}
        {pct(REAL_STATS.bills.cagr)} for cash, with stock volatility of {pct(REAL_STATS.stocks.stdev)}.
      </p>
      <p>
        <b>Why the fan, not a line.</b> A single average return line is the most common way retirement maths
        misleads. Two lives with identical average returns end very differently if one meets its crash early —
        sequence-of-returns risk. Withdrawals are taken at the start of each year, before that year’s return, which
        is what makes an early crash so hard to recover from.
      </p>
      <p>
        <b>Block bootstrap.</b> The default method resamples contiguous runs of history rather than shuffling
        individual years, so crashes, recoveries and inflation shocks stay clustered the way they actually arrive.
        Shuffling year by year produces a suspiciously safe world.
      </p>
      <p>
        <b>The withdrawal rate.</b> SAFEMAX interpolates published research by horizon length: Bengen’s 2025
        revision put the 30-year worst case at 4.7% using a broader asset mix, and longer early-retirement horizons
        push the rate down toward roughly 3.3%. The CAPE rule uses Early Retirement Now’s 1.75% + 0.50 × earnings
        yield. Guardrails follows Guyton-Klinger: hold spending flat in real terms until the current rate drifts 20%
        from where it started, then step 10% and carry on.
      </p>
      <p>
        <b>Valuation.</b> The S&P 500’s Shiller CAPE is {CURRENT_CAPE.toFixed(1)}, against a long-run median near 16.
        With the valuation adjustment on, expected equity returns start near the {pct(1 / CURRENT_CAPE + 0.015)}{' '}
        implied by today’s earnings yield plus real earnings growth, then revert to the historical average over 12
        years. Turn it off and history is applied unmodified.
      </p>
      <p>
        <b>What is simplified.</b> Tax is a single effective rate per account type, not a bracket calculation.
        Rebalancing is assumed free and annual. Property and business equity are not modelled — put them in as a
        one-off event on the date you expect to realise them. Nothing here accounts for your jurisdiction’s rules,
        and none of it is advice.
      </p>
      <p>
        <b>Sources.</b>{' '}
        <a href="https://pages.stern.nyu.edu/adamodar/New_Home_Page/datafile/histretSP.html" target="_blank" rel="noreferrer">
          Damodaran, NYU Stern — historical returns
        </a>
        {' · '}
        <a href="https://www.advisorperspectives.com/articles/2025/08/29/bill-bengen-boosts-the-4-7" target="_blank" rel="noreferrer">
          Bengen’s 4.7% revision
        </a>
        {' · '}
        <a href="https://earlyretirementnow.com/2022/10/12/dynamic-withdrawal-rates-based-on-the-shiller-cape-swr-series-part-54/" target="_blank" rel="noreferrer">
          ERN, CAPE-based rates
        </a>
        {' · '}
        <a href="https://www.whitecoatinvestor.com/guyton-klinger-guardrails-approach-for-retirement/" target="_blank" rel="noreferrer">
          Guyton-Klinger guardrails
        </a>
        {' · '}
        <a href="https://www.multpl.com/shiller-pe" target="_blank" rel="noreferrer">
          Shiller CAPE
        </a>
      </p>
    </div>
  );
}
