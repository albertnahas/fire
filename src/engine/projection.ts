import { capeDrag, mixReturn, resolve } from './assumptions';
import type { Bucket, MonthPoint, Plan, Projection, Resolved } from './types';

export const MAX_MONTHS = 12 * 70;
const m2y = (m: number) => m / 12;
export const monthlyRate = (annual: number) => Math.pow(1 + annual, 1 / 12) - 1;

/** Years over which the portfolio glides from the accumulation mix to the retirement mix. */
const GLIDE_YEARS = 10;

/**
 * Expected real return in year `y` from today. Two effects are layered: today's
 * elevated CAPE damps early equity returns and reverts to the historical average
 * over CAPE_REVERSION_YEARS, and the allocation glides toward the retirement mix
 * as the target date approaches.
 */
export function expectedReturnAt(r: Resolved, yearsFromNow: number, retireYear: number): number {
  const glideStart = Math.max(0, retireYear - GLIDE_YEARS);
  const glide = retireYear <= glideStart ? 1 : Math.min(1, Math.max(0, (yearsFromNow - glideStart) / GLIDE_YEARS));

  const a = r.plan.allocation;
  const b = r.plan.retirementAllocation;
  const mix = {
    stocks: a.stocks + (b.stocks - a.stocks) * glide,
    bonds: a.bonds + (b.bonds - a.bonds) * glide,
    cash: a.cash + (b.cash - a.cash) * glide,
  };

  const sum = mix.stocks + mix.bonds + mix.cash || 1;
  const wStocks = mix.stocks / sum;
  return mixReturn(mix) + wStocks * capeDrag(r.plan, yearsFromNow) - r.feeDrag;
}

/** Effective tax rate on a dollar withdrawn, given the bucket mix of the portfolio. */
export function effectiveWithdrawalTax(r: Resolved, buckets: Record<Bucket, number>): number {
  const total = buckets.taxable + buckets.taxDeferred + buckets.roth + buckets.cash;
  if (total <= 0) return 0;
  const wDef = buckets.taxDeferred / total;
  const wTax = buckets.taxable / total;
  return wDef * r.taxRateDeferred + wTax * r.taxRateGains * r.taxableGainFraction;
}

/** Present value at retirement of a stream paying `annual` from ageFrom to ageTo. */
function pvStream(annual: number, ageFrom: number, ageTo: number, retireAge: number, rate: number): number {
  const start = Math.max(ageFrom, retireAge);
  if (ageTo <= start) return 0;
  let pv = 0;
  for (let a = start; a < ageTo; a++) {
    pv += annual / Math.pow(1 + rate, a - retireAge + 0.5);
  }
  return pv;
}

export interface Requirement {
  /** Capital needed, today's dollars. */
  total: number;
  /** Gross annual spending the portfolio must fund, before other income. */
  grossSpend: number;
  /** Net-of-tax spending need. */
  netSpend: number;
  /** Capital offset from pensions, social security, part-time work. */
  incomeOffset: number;
  /** Extra capital for the pre-Medicare health insurance bridge. */
  healthBridge: number;
  /** Net effect of lump events falling after this retirement date. */
  eventOffset: number;
}

/**
 * Capital required to retire `months` from today, in today's dollars.
 *
 * Spending is grown by real lifestyle creep, grossed up for tax, divided by the
 * withdrawal rate, then reduced by the present value of every other income stream
 * and adjusted for lump events that land after the retirement date.
 */
export function requirementAt(r: Resolved, months: number, taxRate: number): Requirement {
  const years = m2y(months);
  const retireAge = r.age + years;
  const disc = r.retireReturn > 0 ? r.retireReturn : 0.01;

  const netSpend = r.annualExpenses * Math.pow(1 + r.realExpenseGrowth, years) * r.retirementSpendRatio;
  const grossSpend = netSpend / Math.max(0.2, 1 - taxRate);
  const base = grossSpend / r.swr;

  const healthBridge =
    r.healthcareAnnual > 0 && retireAge < r.medicareAge
      ? pvStream(r.healthcareAnnual, retireAge, r.medicareAge, retireAge, disc)
      : 0;

  let incomeOffset = 0;
  for (const s of r.plan.incomeStreams) {
    const end = s.endAge ?? r.horizonAge;
    // A nominal (non-indexed) stream loses purchasing power; approximate with a
    // 2.5% real haircut compounded to its midpoint.
    const midpoint = (Math.max(s.startAge, retireAge) + Math.min(end, r.horizonAge)) / 2;
    const erosion = s.inflationLinked ? 1 : Math.pow(1 / 1.025, Math.max(0, midpoint - r.age));
    incomeOffset += pvStream(s.annualAmount * erosion, s.startAge, Math.min(end, r.horizonAge), retireAge, disc);
  }

  let eventOffset = 0;
  for (const e of r.plan.events) {
    if (e.inYears > years) {
      eventOffset += e.amount / Math.pow(1 + disc, e.inYears - years);
    }
  }

  const total = Math.max(0, base + healthBridge - incomeOffset - eventOffset);
  return { total, grossSpend, netSpend, incomeOffset, healthBridge, eventOffset };
}

/**
 * Month-by-month deterministic projection. Contributions grow with real income
 * growth, returns follow the glidepath, and lump events land on their month.
 */
export function project(plan: Plan, overrides?: { monthlySavings?: number; monthlyExpenses?: number }): Projection {
  const base = resolve(plan);
  const r: Resolved =
    overrides == null
      ? base
      : {
          ...base,
          monthlySavings: overrides.monthlySavings ?? base.monthlySavings,
          monthlyExpenses: overrides.monthlyExpenses ?? base.monthlyExpenses,
          annualExpenses: (overrides.monthlyExpenses ?? base.monthlyExpenses) * 12,
          totalMonthlyIn: (overrides.monthlySavings ?? base.monthlySavings) + base.employerMonthly,
        };

  const buckets: Record<Bucket, number> = { ...r.balances };
  const splitRaw = plan.contributionSplit;
  const splitSum = splitRaw.taxable + splitRaw.taxDeferred + splitRaw.roth || 1;
  const split = {
    taxable: splitRaw.taxable / splitSum,
    taxDeferred: splitRaw.taxDeferred / splitSum,
    roth: splitRaw.roth / splitSum,
  };

  const path: MonthPoint[] = [];
  const retireYearGuess = r.targetRetireAge - r.age;
  const horizonMonths = Math.min(MAX_MONTHS, Math.round((r.horizonAge - r.age) * 12));

  let monthsToFi: number | null = null;
  let fiNumber: number | null = null;
  let fiAnnualSpend: number | null = null;
  let totalContributed = 0;
  let totalGrowth = 0;

  const eventsByMonth = new Map<number, number>();
  for (const e of plan.events) {
    const m = Math.max(0, Math.round(e.inYears * 12));
    eventsByMonth.set(m, (eventsByMonth.get(m) ?? 0) + e.amount);
  }

  let balance = r.investable;
  const requiredToday = requirementAt(r, 0, effectiveWithdrawalTax(r, buckets)).total;

  for (let t = 0; t <= horizonMonths; t++) {
    const years = m2y(t);
    const taxRate = effectiveWithdrawalTax(r, buckets);
    const required = requirementAt(r, t, taxRate).total;

    path.push({
      t,
      year: new Date(plan.today).getFullYear() + years,
      age: r.age + years,
      balance,
      required,
      contributed: totalContributed,
      growth: totalGrowth,
      buckets: { ...buckets },
    });

    if (monthsToFi === null && balance >= required && t > 0) {
      monthsToFi = t;
      fiNumber = required;
      fiAnnualSpend = requirementAt(r, t, taxRate).netSpend;
    }

    if (t === horizonMonths) break;

    // Growth
    const mr = monthlyRate(expectedReturnAt(r, years, retireYearGuess));
    let grew = 0;
    for (const k of ['taxable', 'taxDeferred', 'roth', 'cash'] as Bucket[]) {
      const g = buckets[k] * mr;
      buckets[k] += g;
      grew += g;
    }
    totalGrowth += grew;

    // Contributions, only while still accumulating
    if (monthsToFi === null) {
      const growthFactor = Math.pow(1 + r.realIncomeGrowth, years);
      const contrib = r.totalMonthlyIn * growthFactor;
      buckets.taxable += contrib * split.taxable;
      buckets.taxDeferred += contrib * split.taxDeferred;
      buckets.roth += contrib * split.roth;
      totalContributed += contrib;
    }

    // Lump events
    const ev = eventsByMonth.get(t + 1);
    if (ev) {
      if (ev >= 0) buckets.taxable += ev;
      else {
        // Drain cash first, then taxable, then the rest pro-rata.
        let need = -ev;
        for (const k of ['cash', 'taxable', 'roth', 'taxDeferred'] as Bucket[]) {
          const take = Math.min(buckets[k], need);
          buckets[k] -= take;
          need -= take;
          if (need <= 0) break;
        }
      }
    }

    balance = buckets.taxable + buckets.taxDeferred + buckets.roth + buckets.cash;
  }

  const todayDate = new Date(plan.today);
  const fiDate = monthsToFi === null ? null : addMonths(todayDate, monthsToFi);

  // Coast FI only means something measured against a date later than the one you
  // are already on course for. Use the age you named, or conventional retirement.
  const coastRefAge = Math.min(r.horizonAge - 5, Math.max(r.age + 2, plan.targetRetireAge ?? 65));
  const targetMonths = Math.max(1, Math.round((coastRefAge - r.age) * 12));
  const targetRequirement = requirementAt(r, targetMonths, effectiveWithdrawalTax(r, r.balances)).total;
  const coastGrowth = Math.pow(1 + expectedReturnAt(r, 0, retireYearGuess), m2y(targetMonths));
  const coastNumber = targetRequirement / coastGrowth;

  let monthsToCoast: number | null = null;
  for (const p of path) {
    if (p.t > targetMonths) break;
    const remain = m2y(targetMonths - p.t);
    const need = targetRequirement / Math.pow(1 + expectedReturnAt(r, m2y(p.t), retireYearGuess), remain);
    if (p.balance >= need) {
      monthsToCoast = p.t;
      break;
    }
  }

  return {
    path,
    monthsToFi,
    fiDate,
    fiAge: monthsToFi === null ? null : r.age + m2y(monthsToFi),
    fiNumber,
    fiAnnualSpend,
    requiredToday,
    coastNumber,
    coastRefAge,
    coastReached: r.investable >= coastNumber,
    monthsToCoast,
    totalContributed,
    totalGrowth,
  };
}

export function addMonths(d: Date, months: number): Date {
  const out = new Date(d.getTime());
  out.setMonth(out.getMonth() + Math.round(months));
  return out;
}

/** Monthly saving needed to hit a target retirement age. null = unreachable. */
export function solveSavings(plan: Plan, targetAge: number): number | null {
  const targetMonths = (targetAge - plan.age) * 12;
  if (targetMonths <= 0) return null;
  const hit = (s: number) => {
    const p = project(plan, { monthlySavings: s });
    return p.monthsToFi !== null && p.monthsToFi <= targetMonths;
  };
  if (hit(0)) return 0;
  let lo = 0;
  let hi = Math.max(2000, (plan.monthlyExpenses ?? 4000) * 40);
  if (!hit(hi)) return null;
  for (let i = 0; i < 44; i++) {
    const mid = (lo + hi) / 2;
    if (hit(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

/** Monthly spending that a target retirement age can support. null = unreachable. */
export function solveSpending(plan: Plan, targetAge: number): number | null {
  const targetMonths = (targetAge - plan.age) * 12;
  if (targetMonths <= 0) return null;
  const hit = (e: number) => {
    const p = project(plan, { monthlyExpenses: e });
    return p.monthsToFi !== null && p.monthsToFi <= targetMonths;
  };
  let lo = 1;
  let hi = Math.max(1000, (plan.monthlyExpenses ?? 4000) * 20);
  if (!hit(lo)) return null;
  for (let i = 0; i < 44; i++) {
    const mid = (lo + hi) / 2;
    if (hit(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}
