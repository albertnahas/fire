/**
 * Every number a person can set is `number | null`. `null` means "you decide" —
 * the engine fills it from a recommendation derived from market history or from
 * the rest of the plan. Nothing is required except an age and a spending level,
 * and even those have fallbacks.
 */
export type Opt = number | null;

export type Bucket = 'taxable' | 'taxDeferred' | 'roth' | 'cash';

export type SwrMode = 'fixed' | 'bengen' | 'cape' | 'guardrails' | 'vpw';
export type SimMethod = 'bootstrap' | 'historical' | 'parametric';
export type SolveFor = 'date' | 'savings' | 'spending';

export interface IncomeStream {
  id: string;
  label: string;
  /** Today's dollars per year. */
  annualAmount: number;
  startAge: number;
  /** null = for life */
  endAge: number | null;
  /** Does it keep pace with inflation? */
  inflationLinked: boolean;
}

export interface LumpEvent {
  id: string;
  label: string;
  /** Positive = money in (inheritance, house sale). Negative = money out (college, wedding). */
  amount: number;
  /** Years from today. Fractional allowed. */
  inYears: number;
}

export interface Allocation {
  stocks: number;
  bonds: number;
  cash: number;
}

export interface Plan {
  /** ISO date the plan is anchored to. */
  today: string;

  currency: string;
  age: number;

  balances: Record<Bucket, Opt>;

  annualGrossIncome: Opt;
  /** Monthly saving in today's dollars. */
  monthlySavings: Opt;
  /** Employer match, % of gross income. */
  employerMatchPct: Opt;
  /** Real (above-inflation) income growth, % per year. */
  realIncomeGrowth: Opt;
  /** Where new savings land, as weights that get normalised. */
  contributionSplit: Record<Exclude<Bucket, 'cash'>, number>;

  /** Monthly spending in today's dollars. The single most important input. */
  monthlyExpenses: Opt;
  /** Multiplier on spending once retired (commute gone, travel up). */
  retirementSpendRatio: Opt;
  /** Real lifestyle creep, % per year, applied until retirement. */
  realExpenseGrowth: Opt;
  /** Extra annual health insurance cost from retirement until Medicare age. */
  healthcareAnnual: Opt;
  medicareAge: Opt;

  allocation: Allocation;
  /** Allocation once retired. Portfolio glides here over the final 10 years. */
  retirementAllocation: Allocation;
  /** Total expense ratio + advisory fees, % per year. */
  feeDrag: Opt;

  swrMode: SwrMode;
  /** Used when swrMode is 'fixed'. */
  fixedSwr: Opt;
  /** Plan runs to this age. */
  horizonAge: Opt;

  /** Blended effective tax on tax-deferred withdrawals, %. */
  taxRateDeferred: Opt;
  /** Long-term capital gains rate on taxable withdrawals, %. */
  taxRateGains: Opt;
  /** Share of the taxable balance that is unrealised gain, %. */
  taxableGainFraction: Opt;

  incomeStreams: IncomeStream[];
  events: LumpEvent[];

  /** Target retirement age when solving for required savings. */
  targetRetireAge: Opt;
  solveFor: SolveFor;

  simMethod: SimMethod;
  simRuns: number;
  /** Block length in years for the block bootstrap. */
  blockYears: number;
  /** Damp early returns because today's CAPE is high. */
  capeAware: boolean;
}

/** A plan with every `null` replaced, plus the derived quantities it implies. */
export interface Resolved {
  plan: Plan;
  age: number;
  balances: Record<Bucket, number>;
  investable: number;
  annualGrossIncome: number;
  monthlySavings: number;
  employerMonthly: number;
  totalMonthlyIn: number;
  savingsRate: number;
  realIncomeGrowth: number;
  monthlyExpenses: number;
  annualExpenses: number;
  retirementSpendRatio: number;
  realExpenseGrowth: number;
  healthcareAnnual: number;
  medicareAge: number;
  feeDrag: number;
  horizonAge: number;
  /** Expected real return per year, net of fees, from the accumulation allocation. */
  accumReturn: number;
  retireReturn: number;
  accumVol: number;
  retireVol: number;
  swr: number;
  swrLabel: string;
  taxRateDeferred: number;
  taxRateGains: number;
  taxableGainFraction: number;
  targetRetireAge: number;
  fixedSwr: number;
}

export interface MonthPoint {
  /** Months from today. */
  t: number;
  /** Calendar year, fractional. */
  year: number;
  age: number;
  balance: number;
  /** FI number required at this moment, in today's dollars. */
  required: number;
  contributed: number;
  growth: number;
  /** Balance split by account type, so account-access rules can be checked. */
  buckets: Record<Bucket, number>;
}

export interface Projection {
  path: MonthPoint[];
  /** Months until the balance first covers the requirement. null = not within horizon. */
  monthsToFi: number | null;
  fiDate: Date | null;
  fiAge: number | null;
  fiNumber: number | null;
  /** Spending in today's dollars at the moment of retirement. */
  fiAnnualSpend: number | null;
  /** Requirement today, if you wanted to stop now. */
  requiredToday: number;
  /** Coast FI: the balance today that grows into the target with zero further saving. */
  coastNumber: number;
  /** The age Coast FI is measured against. */
  coastRefAge: number;
  coastReached: boolean;
  /** Months until the current balance alone would coast to target by targetRetireAge. */
  monthsToCoast: number | null;
  totalContributed: number;
  totalGrowth: number;
}

export interface DrawdownResult {
  /** Fraction of paths that never ran out before the horizon. */
  successRate: number;
  /** Real terminal balances, sorted ascending. */
  terminal: number[];
  /** Percentile bands of the balance path, in today's dollars. */
  bands: { t: number; p5: number; p25: number; p50: number; p75: number; p95: number }[];
  /** Median year of depletion among failing paths, as years after retirement. */
  medianRuinYear: number | null;
  /** Median realised spending per year across paths, for variable strategies. */
  medianSpend: number;
  /** Worst 5% of realised spending, for variable strategies. */
  p5Spend: number;
}

export interface FiDateDistribution {
  /** Months to FI at each percentile. */
  p10: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
  /** Share of paths that reached FI inside the horizon. */
  reached: number;
  /** Histogram of FI month, bucketed by year. */
  histogram: { year: number; count: number }[];
  /** Sample of paths for drawing, in today's dollars. */
  sample: { balance: Float32Array; fiMonth: number | null; ruined: boolean }[];
  /** The requirement curve those paths were racing. */
  required: Float32Array;
}

export interface SimResult {
  fi: FiDateDistribution;
  drawdown: DrawdownResult;
  /** Same drawdown test run on real historical sequences, for cross-checking. */
  historicalSuccess: number;
  historicalWorstStart: number | null;
}
