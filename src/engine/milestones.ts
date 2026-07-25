import { resolve } from '../engine/assumptions';
import { addMonths, effectiveWithdrawalTax, requirementAt } from './projection';
import type { Plan, Projection } from './types';

export interface Milestone {
  key: string;
  name: string;
  blurb: string;
  /** Capital needed, in today's dollars, measured at the moment it is reached. */
  target: number;
  monthsAway: number | null;
  date: Date | null;
  age: number | null;
  reached: boolean;
  /** How far along, 0–1. */
  progress: number;
}

/** Annual part-time income assumed for Barista FI. */
export const BARISTA_INCOME = 22000;

/**
 * The five waypoints the FIRE community navigates by. Each is the same
 * calculation at a different spending level, so they all move together when you
 * change one number. Full FI reuses the projection's own crossing, so the row
 * always agrees with the headline date.
 */
export function milestones(plan: Plan, projection: Projection): Milestone[] {
  const r = resolve(plan);

  /** First month the balance covers a scaled requirement. */
  const findCrossing = (scale: number, offsetIncome = 0) => {
    let lastNeed = 0;
    for (const p of projection.path) {
      const tax = effectiveWithdrawalTax(r, p.buckets);
      const need = Math.max(0, requirementAt(r, p.t, tax).total * scale - offsetIncome / r.swr);
      lastNeed = need;
      if (p.balance >= need) return { months: p.t, target: need };
    }
    return { months: null as number | null, target: lastNeed };
  };

  const mk = (
    key: string,
    name: string,
    blurb: string,
    found: { months: number | null; target: number },
  ): Milestone => ({
    key,
    name,
    blurb,
    target: found.target,
    monthsAway: found.months,
    date: found.months === null ? null : addMonths(new Date(plan.today), found.months),
    age: found.months === null ? null : r.age + found.months / 12,
    reached: found.months === 0,
    progress: found.target > 0 ? Math.min(1, r.investable / found.target) : 1,
  });

  const list: Milestone[] = [
    {
      key: 'coast',
      name: 'Coast FI',
      blurb: `Stop adding a single dollar and growth alone still funds retirement at ${projection.coastRefAge.toFixed(0)}. Work becomes optional in amount, not in fact.`,
      target: projection.coastNumber,
      monthsAway: projection.monthsToCoast,
      date: projection.monthsToCoast === null ? null : addMonths(new Date(plan.today), projection.monthsToCoast),
      age: projection.monthsToCoast === null ? null : r.age + projection.monthsToCoast / 12,
      reached: projection.coastReached,
      progress: projection.coastNumber > 0 ? Math.min(1, r.investable / projection.coastNumber) : 1,
    },
    mk('lean', 'Lean FI', 'Covers 70% of today’s spending. A frugal but workable exit.', findCrossing(0.7)),
    mk(
      'barista',
      'Barista FI',
      `Portfolio plus roughly ${Math.round(BARISTA_INCOME / 1000)}k a year of part-time work.`,
      findCrossing(1, BARISTA_INCOME),
    ),
    {
      key: 'full',
      name: 'Full FI',
      blurb: 'Covers your spending as it stands. This is the date.',
      target: projection.fiNumber ?? projection.requiredToday,
      monthsAway: projection.monthsToFi,
      date: projection.fiDate,
      age: projection.fiAge,
      reached: projection.monthsToFi === 0,
      progress:
        (projection.fiNumber ?? projection.requiredToday) > 0
          ? Math.min(1, r.investable / (projection.fiNumber ?? projection.requiredToday))
          : 1,
    },
    mk('fat', 'Fat FI', 'Covers 150% of today’s spending. Room to be generous.', findCrossing(1.5)),
  ];

  return list.sort((a, b) => (a.monthsAway ?? Infinity) - (b.monthsAway ?? Infinity));
}

/**
 * Can you reach the money before 59½? Pre-tax accounts are locked without a Roth
 * conversion ladder or 72(t) payments, so taxable, Roth and cash have to carry the
 * bridge years. Balances come straight from the projection's own account split.
 */
export interface BridgeCheck {
  needed: boolean;
  years: number;
  /** Spending to fund from reachable accounts before penalty-free age. */
  cost: number;
  accessible: number;
  ok: boolean;
  shortfall: number;
}

const PENALTY_FREE_AGE = 59.5;

export function bridgeCheck(plan: Plan, projection: Projection): BridgeCheck | null {
  const r = resolve(plan);
  if (projection.monthsToFi === null) return null;

  const fiAge = r.age + projection.monthsToFi / 12;
  if (fiAge >= PENALTY_FREE_AGE) {
    return { needed: false, years: 0, cost: 0, accessible: 0, ok: true, shortfall: 0 };
  }

  const at = projection.path[projection.monthsToFi];
  const years = PENALTY_FREE_AGE - fiAge;
  const spend = projection.fiAnnualSpend ?? r.annualExpenses;

  // The bridge only has to cover the shortfall left after other income, and the
  // money spent early keeps earning until it is drawn — value it at the retirement
  // return over the average bridge year.
  let externalPerYear = 0;
  for (const s of plan.incomeStreams) {
    const end = s.endAge ?? r.horizonAge;
    const overlap = Math.max(0, Math.min(end, PENALTY_FREE_AGE) - Math.max(s.startAge, fiAge));
    if (overlap > 0) externalPerYear += (s.annualAmount * overlap) / years;
  }
  const health = r.healthcareAnnual > 0 && fiAge < r.medicareAge ? r.healthcareAnnual : 0;
  const perYear = Math.max(0, spend + health - externalPerYear);
  const disc = Math.max(0.005, r.retireReturn);
  const cost = (perYear * (1 - Math.pow(1 + disc, -years))) / disc;

  const accessible = at.buckets.taxable + at.buckets.roth + at.buckets.cash;

  return {
    needed: true,
    years,
    cost,
    accessible,
    ok: accessible >= cost,
    shortfall: Math.max(0, cost - accessible),
  };
}
