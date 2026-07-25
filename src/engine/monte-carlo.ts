import { GUARDRAIL_FLOOR, capeDrag, mixReturn, resolve } from './assumptions';
import { REAL_HISTORY, REAL_STATS } from '../data/market-history';
import { effectiveWithdrawalTax, monthlyRate, project, requirementAt } from './projection';
import type { Allocation, Plan, Resolved, SimResult, SwrMode } from './types';

/** Deterministic RNG so the same plan always produces the same picture. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller standard normal. */
function normal(rnd: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rnd();
  while (v === 0) v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const GLIDE_YEARS = 10;

function glidedMix(r: Resolved, yearsFromNow: number, retireYears: number): Allocation {
  const glideStart = Math.max(0, retireYears - GLIDE_YEARS);
  const g = yearsFromNow >= retireYears ? 1 : Math.min(1, Math.max(0, (yearsFromNow - glideStart) / GLIDE_YEARS));
  const a = r.plan.allocation;
  const b = r.plan.retirementAllocation;
  return {
    stocks: a.stocks + (b.stocks - a.stocks) * g,
    bonds: a.bonds + (b.bonds - a.bonds) * g,
    cash: a.cash + (b.cash - a.cash) * g,
  };
}

interface YearReturns {
  stocks: number;
  bonds: number;
  bills: number;
  /** That year's inflation, needed by rules that skip a cost-of-living raise. */
  cpi: number;
}

/** One sequence of `years` annual real returns, per the chosen method. */
function buildSequence(plan: Plan, years: number, rnd: () => number, startIndex?: number): YearReturns[] {
  const H = REAL_HISTORY;
  const out: YearReturns[] = [];

  if (plan.simMethod === 'historical' && startIndex != null) {
    for (let y = 0; y < years; y++) {
      out.push(H[(startIndex + y) % H.length]);
    }
    return out;
  }

  if (plan.simMethod === 'parametric') {
    const sMu = REAL_STATS.stocks.cagr;
    const sSd = REAL_STATS.stocks.stdev;
    const bMu = REAL_STATS.bonds.cagr;
    const bSd = REAL_STATS.bonds.stdev;
    for (let y = 0; y < years; y++) {
      const z1 = normal(rnd);
      const z2 = normal(rnd);
      // 0.1 correlation between stocks and bonds via Cholesky.
      const zb = 0.1 * z1 + Math.sqrt(1 - 0.01) * z2;
      out.push({
        stocks: sMu + sSd * z1,
        bonds: bMu + bSd * zb,
        bills: REAL_STATS.bills.cagr,
        cpi: REAL_STATS.inflation,
      });
    }
    return out;
  }

  // Block bootstrap: resample contiguous runs of history so that crashes,
  // recoveries and inflation shocks arrive in realistic clusters.
  const block = Math.max(1, plan.blockYears);
  while (out.length < years) {
    const start = Math.floor(rnd() * H.length);
    for (let k = 0; k < block && out.length < years; k++) {
      out.push(H[(start + k) % H.length]);
    }
  }
  return out;
}

/**
 * Strategies split into two kinds, and they have to be accounted for differently.
 *
 * Fixed-spend rules name an amount and ask the portfolio for it, so running short
 * is a failure. Percentage-of-portfolio rules take a share of whatever is there, so
 * they can never run short — they can only leave you living on very little. Scoring
 * the second kind on depletion would call a working strategy a total failure.
 */
export const isPercentageStrategy = (mode: SwrMode) => mode === 'cape' || mode === 'vpw';

/** Fraction of the portfolio a percentage rule withdraws this year, gross of tax. */
function withdrawalRate(mode: SwrMode, initialRate: number, yearsLeft: number, expectedReturn: number): number {
  if (mode === 'vpw') {
    const r = Math.max(expectedReturn, 0.0001);
    const n = Math.max(yearsLeft, 1);
    return Math.min(1, r / (1 - Math.pow(1 + r, -n)));
  }
  // CAPE rule: a constant share of the current balance, recomputed each year.
  return Math.min(1, initialRate);
}

/** Target spending for one retirement year under a fixed-spend strategy. */
function withdrawalFor(
  mode: SwrMode,
  balance: number,
  initialSpend: number,
  initialRate: number,
  currentSpend: number,
  /** Last year's real portfolio return and inflation, for the no-raise rule. */
  lastReturn: number,
  lastInflation: number,
): number {
  switch (mode) {
    case 'fixed':
    case 'bengen':
    case 'cape':
    case 'vpw':
      return initialSpend;

    case 'guardrails': {
      // Guyton-Klinger, three of the four decision rules.
      //
      // Portfolio management rule: after a losing year the cost-of-living raise is
      // skipped, which in real terms is a cut equal to that year's inflation.
      let next = lastReturn < 0 ? currentSpend / (1 + Math.max(0, lastInflation)) : currentSpend;

      // Capital preservation: cut 10% once the current rate runs 20% hot.
      // Prosperity: raise 10% once it runs 20% cold.
      const wr = balance > 0 ? next / balance : Infinity;
      if (wr > initialRate * 1.2) next *= 0.9;
      else if (wr < initialRate * 0.8) next *= 1.1;

      return Math.min(Math.max(next, initialSpend * GUARDRAIL_FLOOR), initialSpend * 1.5);
    }
  }
}

/** Other income and the health-insurance bridge, in real dollars, at a given age. */
function externalCashflow(r: Resolved, age: number): number {
  let net = 0;
  for (const s of r.plan.incomeStreams) {
    const end = s.endAge ?? r.horizonAge;
    if (age >= s.startAge && age < end) {
      const erosion = s.inflationLinked ? 1 : Math.pow(1 / 1.025, age - r.age);
      net += s.annualAmount * erosion;
    }
  }
  if (r.healthcareAnnual > 0 && age < r.medicareAge) net -= r.healthcareAnnual;
  return net;
}

interface PathOutcome {
  fiMonth: number | null;
  ruinMonth: number | null;
  terminal: number;
  spendSum: number;
  spendYears: number;
  minSpend: number;
}

const PERCENTILES = [0.05, 0.25, 0.5, 0.75, 0.95] as const;

function quantile(sorted: number[] | Float64Array, q: number): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const i = (n - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

export function simulate(plan: Plan): SimResult {
  const r = resolve(plan);
  const horizonYears = Math.max(5, Math.round(r.horizonAge - r.age));
  const months = horizonYears * 12;
  const retireYearsGuess = r.targetRetireAge - r.age;

  // Requirement curve is deterministic — spending growth and the withdrawal rate
  // do not depend on market luck. Precompute it once.
  const required = new Float32Array(months + 1);
  const netSpendAt = new Float32Array(months + 1);
  const staticTax = effectiveWithdrawalTax(r, r.balances);
  for (let t = 0; t <= months; t++) {
    const req = requirementAt(r, t, staticTax);
    required[t] = req.total;
    netSpendAt[t] = req.netSpend;
  }

  const isHistorical = plan.simMethod === 'historical';
  const validStarts = Math.max(1, REAL_HISTORY.length - horizonYears + 1);
  const runs = isHistorical ? validStarts : Math.max(200, plan.simRuns);

  const outcomes: PathOutcome[] = [];
  const sample: { balance: Float32Array; fiMonth: number | null; ruined: boolean }[] = [];
  const SAMPLE_N = Math.min(160, runs);
  const sampleStride = Math.max(1, Math.floor(runs / SAMPLE_N));

  // Yearly balance snapshots for percentile bands.
  const yearCols: Float64Array[] = [];
  for (let y = 0; y <= horizonYears; y++) yearCols.push(new Float64Array(runs));

  const rnd = mulberry32(0x1f12e);
  let historicalFailures = 0;
  let worstStart: number | null = null;
  let worstRuin = Infinity;

  for (let run = 0; run < runs; run++) {
    const seq = buildSequence(plan, horizonYears + 1, rnd, isHistorical ? run : undefined);
    const keep = run % sampleStride === 0 && sample.length < SAMPLE_N;
    const track = keep ? new Float32Array(months + 1) : null;

    let balance = r.investable;
    let fiMonth: number | null = null;
    let ruinMonth: number | null = null;
    let currentSpend = 0;
    let initialSpend = 0;
    let spendSum = 0;
    let spendYears = 0;
    let minSpend = Infinity;
    let lastReturn = 0;
    let lastInflation = 0;

    for (let y = 0; y <= horizonYears; y++) {
      const age = r.age + y;
      const mix = glidedMix(r, y, fiMonth === null ? retireYearsGuess : fiMonth / 12);
      const sum = mix.stocks + mix.bonds + mix.cash || 1;
      const w = { s: mix.stocks / sum, b: mix.bonds / sum, c: mix.cash / sum };
      const yr = seq[y];
      const annual =
        w.s * (yr.stocks + capeDrag(plan, y)) + w.b * yr.bonds + w.c * yr.bills - r.feeDrag;
      const mr = monthlyRate(Math.max(-0.95, annual));

      yearCols[y][run] = balance;

      // Retired: take the year's spending up front. Sequence-of-returns risk is
      // exactly this — withdrawing before a bad year, not after.
      if (fiMonth !== null) {
        const external = externalCashflow(r, age);
        const netTax = Math.max(0.2, 1 - staticTax);
        let gross: number;
        let want: number;

        if (isPercentageStrategy(plan.swrMode)) {
          // Take a share of what is actually there, then pay tax out of it.
          const rate = withdrawalRate(plan.swrMode, r.swr, horizonYears - y, mixReturn(mix) - r.feeDrag);
          gross = Math.max(0, balance) * rate;
          want = gross * netTax + external;
        } else {
          want = withdrawalFor(plan.swrMode, balance, initialSpend, r.swr, currentSpend, lastReturn, lastInflation);
          gross = Math.max(0, want - external) / netTax;
        }

        currentSpend = want;
        const realised = Math.min(gross, Math.max(0, balance));
        balance -= realised;
        const spent = Math.max(0, external + realised * netTax);
        spendSum += spent;
        spendYears += 1;
        minSpend = Math.min(minSpend, spent);

        // Failure means the portfolio could not deliver the spending the strategy
        // asked for, with a year still left to live. Deliberate depletion in the
        // final year is the plan working, not the plan breaking.
        if (ruinMonth === null && y < horizonYears && realised < gross - 1) ruinMonth = y * 12;
      }

      for (let m = 0; m < 12; m++) {
        const t = y * 12 + m;
        if (t > months) break;
        if (track) track[t] = balance;

        if (fiMonth === null) {
          if (balance >= required[t] && t > 0) {
            fiMonth = t;
            initialSpend = netSpendAt[t];
            currentSpend = initialSpend;
          } else {
            const growthFactor = Math.pow(1 + r.realIncomeGrowth, t / 12);
            balance += r.totalMonthlyIn * growthFactor;
            for (const e of plan.events) {
              if (Math.round(e.inYears * 12) === t + 1) balance = Math.max(0, balance + e.amount);
            }
          }
        }
        balance *= 1 + mr;
      }

      lastReturn = annual;
      lastInflation = yr.cpi;
    }

    if (track) sample.push({ balance: track, fiMonth, ruined: ruinMonth !== null || fiMonth === null });
    outcomes.push({
      fiMonth,
      ruinMonth,
      terminal: Math.max(0, balance),
      spendSum,
      spendYears,
      minSpend: minSpend === Infinity ? 0 : minSpend,
    });

    if (isHistorical) {
      if (ruinMonth !== null || fiMonth === null) {
        historicalFailures++;
        const ruinAt = ruinMonth ?? Infinity;
        if (ruinAt < worstRuin) {
          worstRuin = ruinAt;
          worstStart = REAL_HISTORY[run]?.year ?? null;
        }
      }
    }
  }

  // FI date distribution
  const fiMonths = outcomes.map((o) => o.fiMonth).filter((v): v is number => v !== null);
  fiMonths.sort((a, b) => a - b);
  const reached = fiMonths.length / runs;
  const pick = (q: number) => (fiMonths.length ? Math.round(quantile(fiMonths, q)) : null);

  const histMap = new Map<number, number>();
  const baseYear = new Date(plan.today).getFullYear();
  for (const m of fiMonths) {
    const y = baseYear + Math.floor(m / 12);
    histMap.set(y, (histMap.get(y) ?? 0) + 1);
  }
  const histogram = [...histMap.entries()].sort((a, b) => a[0] - b[0]).map(([year, count]) => ({ year, count }));

  // Percentile bands
  const bands = yearCols.map((col, y) => {
    const arr = Float64Array.from(col).sort();
    const [p5, p25, p50, p75, p95] = PERCENTILES.map((q) => quantile(arr, q));
    return { t: y * 12, p5, p25, p50, p75, p95 };
  });

  const failures = outcomes.filter((o) => o.ruinMonth !== null || o.fiMonth === null).length;
  const ruins = outcomes.map((o) => o.ruinMonth).filter((v): v is number => v !== null).sort((a, b) => a - b);
  const terminal = outcomes.map((o) => o.terminal).sort((a, b) => a - b);
  const avgSpends = outcomes
    .filter((o) => o.spendYears > 0)
    .map((o) => o.spendSum / o.spendYears)
    .sort((a, b) => a - b);

  // Cross-check against real history regardless of the chosen method.
  let historicalSuccess = 1 - failures / runs;
  let historicalWorstStart = worstStart;
  if (!isHistorical) {
    const hist = simulate({ ...plan, simMethod: 'historical' });
    historicalSuccess = hist.historicalSuccess;
    historicalWorstStart = hist.historicalWorstStart;
  }

  return {
    fi: {
      p10: pick(0.1),
      p25: pick(0.25),
      p50: pick(0.5),
      p75: pick(0.75),
      p90: pick(0.9),
      reached,
      histogram,
      sample,
      required,
    },
    drawdown: {
      successRate: 1 - failures / runs,
      terminal,
      bands,
      medianRuinYear: ruins.length ? quantile(ruins, 0.5) / 12 : null,
      medianSpend: avgSpends.length ? quantile(avgSpends, 0.5) : 0,
      p5Spend: avgSpends.length ? quantile(avgSpends, 0.05) : 0,
    },
    historicalSuccess: isHistorical ? 1 - failures / runs : historicalSuccess,
    historicalWorstStart,
  };
}

/**
 * How many months the FI date moves when one assumption is nudged. Drives the
 * sensitivity ranking — the honest answer to "what actually matters here".
 */
export interface Lever {
  key: string;
  label: string;
  nudge: string;
  monthsEarlier: number;
}

export function sensitivity(plan: Plan, baseMonths: number): Lever[] {
  const test = (label: string, key: string, nudge: string, mutate: (p: Plan) => Plan): Lever => {
    const p = project(mutate(structuredClone(plan)));
    return {
      key,
      label,
      nudge,
      monthsEarlier: p.monthsToFi === null ? -999 : baseMonths - p.monthsToFi,
    };
  };
  const r = resolve(plan);

  return [
    test('Spend less', 'expenses', '−10% monthly spending', (p) => {
      p.monthlyExpenses = r.monthlyExpenses * 0.9;
      return p;
    }),
    test('Save more', 'savings', '+10% monthly saving', (p) => {
      p.monthlySavings = r.monthlySavings * 1.1;
      return p;
    }),
    test('Cut fees', 'fees', 'Fees to 0.03%', (p) => {
      p.feeDrag = 0.03;
      return p;
    }),
    test('Hold more equity', 'allocation', '+10pp stocks', (p) => {
      p.allocation = {
        stocks: Math.min(100, p.allocation.stocks + 10),
        bonds: Math.max(0, p.allocation.bonds - 10),
        cash: p.allocation.cash,
      };
      return p;
    }),
    test('Accept a higher rate', 'swr', '+0.5pp withdrawal rate', (p) => {
      p.swrMode = 'fixed';
      p.fixedSwr = (r.swr + 0.005) * 100;
      return p;
    }),
    test('Stop lifestyle creep', 'creep', 'Real spending growth to 0%', (p) => {
      p.realExpenseGrowth = 0;
      return p;
    }),
    test('One more raise', 'income', '+3% real income growth', (p) => {
      p.realIncomeGrowth = (r.realIncomeGrowth + 0.03) * 100;
      return p;
    }),
  ].sort((a, b) => b.monthsEarlier - a.monthsEarlier);
}
