import { CURRENT_CAPE, REAL_STATS } from '../data/market-history';
import type { Allocation, Plan, Resolved, SwrMode } from './types';

export const DEFAULT_PLAN: Plan = {
  today: new Date().toISOString().slice(0, 10),
  currency: 'USD',
  age: 34,

  balances: { taxable: 60000, taxDeferred: 95000, roth: 25000, cash: 15000 },

  annualGrossIncome: 145000,
  monthlySavings: null,
  employerMatchPct: null,
  realIncomeGrowth: null,
  contributionSplit: { taxable: 45, taxDeferred: 40, roth: 15 },

  monthlyExpenses: 4600,
  retirementSpendRatio: null,
  realExpenseGrowth: null,
  healthcareAnnual: null,
  medicareAge: null,

  allocation: { stocks: 90, bonds: 10, cash: 0 },
  retirementAllocation: { stocks: 70, bonds: 25, cash: 5 },
  feeDrag: null,

  swrMode: 'bengen',
  fixedSwr: null,
  horizonAge: null,

  taxRateDeferred: null,
  taxRateGains: null,
  taxableGainFraction: null,

  incomeStreams: [],
  events: [],

  targetRetireAge: null,
  solveFor: 'date',

  simMethod: 'bootstrap',
  simRuns: 3000,
  blockYears: 5,
  capeAware: true,
};

/**
 * Real earnings growth added to the cyclically-adjusted earnings yield to get a
 * forward-looking real equity return. 1.5% is the long-run US real EPS growth rate.
 */
const REAL_EPS_GROWTH = 0.015;

/** The guardrails strategy never cuts real spending below this share of plan. */
export const GUARDRAIL_FLOOR = 0.65;

/** Years over which a CAPE-implied return reverts to the historical average. */
export const CAPE_REVERSION_YEARS = 12;

/** Forward-looking real equity return implied by today's valuation. */
export const CAPE_IMPLIED_STOCK_RETURN = 1 / CURRENT_CAPE + REAL_EPS_GROWTH;

/**
 * Safe withdrawal rate as a function of horizon length, anchored on the published
 * research: Bengen's 2025 "Universal SAFEMAX" of 4.7% over 30 years, falling toward
 * the perpetual rate as the horizon lengthens.
 */
export function safemaxForHorizon(years: number): number {
  const table: [number, number][] = [
    [10, 0.089],
    [20, 0.056],
    [30, 0.047],
    [40, 0.04],
    [50, 0.036],
    [60, 0.034],
    [70, 0.033],
  ];
  if (years <= table[0][0]) return table[0][1];
  const last = table[table.length - 1];
  if (years >= last[0]) return last[1];
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i - 1];
    const [x2, y2] = table[i];
    if (years <= x2) return y1 + ((years - x1) / (x2 - x1)) * (y2 - y1);
  }
  return last[1];
}

/** Initial withdrawal rate for each strategy, given a horizon and expected return. */
export function initialSwr(
  mode: SwrMode,
  horizonYears: number,
  expectedReturn: number,
  fixed: number,
): { rate: number; label: string } {
  switch (mode) {
    case 'fixed':
      return { rate: fixed, label: `Fixed ${(fixed * 100).toFixed(2)}%` };
    case 'bengen':
      return {
        rate: safemaxForHorizon(horizonYears),
        label: `Bengen SAFEMAX, ${Math.round(horizonYears)}-year horizon`,
      };
    case 'cape':
      // Early Retirement Now's preferred CAPE rule: WR = 1.75% + 0.50 × CAEY.
      return {
        rate: 0.0175 + 0.5 * (1 / CURRENT_CAPE),
        label: `CAPE rule at ${CURRENT_CAPE.toFixed(1)}`,
      };
    case 'guardrails':
      // Guyton-Klinger starts high because spending flexes by ±10% at the guardrails.
      return { rate: 0.052, label: 'Guyton-Klinger guardrails' };
    case 'vpw': {
      // Amortise the portfolio over the horizon at the expected real return.
      const r = Math.max(expectedReturn, 0.0001);
      const n = Math.max(horizonYears, 1);
      const rate = r / (1 - Math.pow(1 + r, -n));
      return { rate, label: `Variable percentage, ${Math.round(n)} years` };
    }
  }
}

/**
 * Additive haircut on expected equity returns in year `y`, because today's CAPE of
 * 41 sits far above its historical median. Fades to zero over CAPE_REVERSION_YEARS
 * so the long run still reflects the full historical record. Used identically by
 * the deterministic projection and by every simulated path, so the two agree.
 */
export function capeDrag(plan: Plan, yearsFromNow: number): number {
  if (!plan.capeAware) return 0;
  const w = Math.max(0, 1 - yearsFromNow / CAPE_REVERSION_YEARS);
  return (CAPE_IMPLIED_STOCK_RETURN - REAL_STATS.stocks.cagr) * w;
}

const norm = (a: Allocation) => {
  const sum = a.stocks + a.bonds + a.cash || 1;
  return { stocks: a.stocks / sum, bonds: a.bonds / sum, cash: a.cash / sum };
};

/** Expected real return of a mix, before fees, using long-run historical CAGRs. */
export function mixReturn(a: Allocation): number {
  const w = norm(a);
  return w.stocks * REAL_STATS.stocks.cagr + w.bonds * REAL_STATS.bonds.cagr + w.cash * REAL_STATS.bills.cagr;
}

/** The same mix priced off today's CAPE instead of history. */
export function mixReturnCapeAware(a: Allocation): number {
  const w = norm(a);
  return w.stocks * CAPE_IMPLIED_STOCK_RETURN + w.bonds * REAL_STATS.bonds.cagr + w.cash * REAL_STATS.bills.cagr;
}

/** Portfolio volatility, assuming a 0.1 stock/bond correlation and no cash volatility. */
export function mixVol(a: Allocation): number {
  const w = norm(a);
  const ss = REAL_STATS.stocks.stdev;
  const bb = REAL_STATS.bonds.stdev;
  const cc = REAL_STATS.bills.stdev;
  const variance =
    (w.stocks * ss) ** 2 +
    (w.bonds * bb) ** 2 +
    (w.cash * cc) ** 2 +
    2 * 0.1 * w.stocks * ss * w.bonds * bb;
  return Math.sqrt(variance);
}

/** Human-readable rationale for every recommended value, shown in the ledger. */
export const RATIONALE: Record<string, string> = {
  monthlySavings: 'Income minus spending, if you told me your income. Otherwise 25% of what you spend.',
  employerMatchPct: '4% of gross is the most common US employer match.',
  realIncomeGrowth: '1%/yr above inflation — the long-run US real wage trend.',
  retirementSpendRatio: 'Unchanged. Commuting and work clothes fall away; time to spend money rises.',
  realExpenseGrowth: '0.5%/yr of lifestyle creep above inflation while you are still working.',
  healthcareAnnual: 'Zero. Set this if you lose employer coverage — a US benchmark is ~$7,500/yr per adult.',
  medicareAge: 'US Medicare eligibility is 65.',
  feeDrag: '0.15%/yr — broad index funds with no advisor.',
  fixedSwr: 'Derived from your horizon length using published SAFEMAX research.',
  horizonAge: 'Age 95. Roughly the 90th percentile of lifespan for someone healthy today.',
  taxRateDeferred: '12% effective. Retirement income is usually taxed far below working income.',
  taxRateGains: '5% effective. Much of a modest retirement sits in the 0% capital gains bracket.',
  taxableGainFraction: '35% of the taxable balance is unrealised gain.',
  targetRetireAge: '12 years from now, capped at 60.',
  annualGrossIncome: 'Spending divided by 0.55, assuming average tax and a 20% savings rate.',
  monthlyExpenses: 'Set this. It is the only number that decides the size of your target.',
};

export function resolve(plan: Plan): Resolved {
  const age = plan.age;
  const balances = {
    taxable: plan.balances.taxable ?? 0,
    taxDeferred: plan.balances.taxDeferred ?? 0,
    roth: plan.balances.roth ?? 0,
    cash: plan.balances.cash ?? 0,
  };
  const investable = balances.taxable + balances.taxDeferred + balances.roth + balances.cash;

  const monthlyExpenses = plan.monthlyExpenses ?? 4000;
  const annualExpenses = monthlyExpenses * 12;
  const annualGrossIncome = plan.annualGrossIncome ?? annualExpenses / 0.55;

  const monthlySavings =
    plan.monthlySavings ??
    (plan.annualGrossIncome != null
      ? Math.max(0, (plan.annualGrossIncome * 0.72) / 12 - monthlyExpenses)
      : monthlyExpenses * 0.25);

  const employerMatchPct = plan.employerMatchPct ?? 4;
  const employerMonthly = (annualGrossIncome * (employerMatchPct / 100)) / 12;
  const totalMonthlyIn = monthlySavings + employerMonthly;

  const realIncomeGrowth = (plan.realIncomeGrowth ?? 1) / 100;
  const retirementSpendRatio = plan.retirementSpendRatio ?? 1;
  const realExpenseGrowth = (plan.realExpenseGrowth ?? 0.5) / 100;
  const healthcareAnnual = plan.healthcareAnnual ?? 0;
  const medicareAge = plan.medicareAge ?? 65;
  const feeDrag = (plan.feeDrag ?? 0.15) / 100;
  const horizonAge = plan.horizonAge ?? 95;
  const targetRetireAge = plan.targetRetireAge ?? Math.min(60, age + 12);

  const accumReturn = mixReturn(plan.allocation) - feeDrag;
  const retireReturn = mixReturn(plan.retirementAllocation) - feeDrag;

  // Horizon used to pick the withdrawal rate: from the target retirement age to
  // the plan's end. Early retirement means a long horizon and a lower safe rate.
  const horizonYears = Math.max(5, horizonAge - targetRetireAge);
  const fixedSwr = plan.fixedSwr != null ? plan.fixedSwr / 100 : safemaxForHorizon(horizonYears);
  const { rate: swr, label: swrLabel } = initialSwr(plan.swrMode, horizonYears, retireReturn, fixedSwr);

  return {
    plan,
    age,
    balances,
    investable,
    annualGrossIncome,
    monthlySavings,
    employerMonthly,
    totalMonthlyIn,
    savingsRate: annualGrossIncome > 0 ? (totalMonthlyIn * 12) / annualGrossIncome : 0,
    realIncomeGrowth,
    monthlyExpenses,
    annualExpenses,
    retirementSpendRatio,
    realExpenseGrowth,
    healthcareAnnual,
    medicareAge,
    feeDrag,
    horizonAge,
    accumReturn,
    retireReturn,
    accumVol: mixVol(plan.allocation),
    retireVol: mixVol(plan.retirementAllocation),
    swr,
    swrLabel,
    taxRateDeferred: (plan.taxRateDeferred ?? 12) / 100,
    taxRateGains: (plan.taxRateGains ?? 5) / 100,
    taxableGainFraction: (plan.taxableGainFraction ?? 35) / 100,
    targetRetireAge,
    fixedSwr,
  };
}
