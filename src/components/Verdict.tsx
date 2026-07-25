import { resolve } from '../engine/assumptions';
import { countdown, duration, longDate, money, pct } from '../engine/format';
import { addMonths, solveSavings, solveSpending } from '../engine/projection';
import type { Plan, Projection, SimResult } from '../engine/types';

export function Verdict({
  plan,
  projection,
  sim,
}: {
  plan: Plan;
  projection: Projection;
  sim: SimResult | null;
}) {
  const r = resolve(plan);
  const cur = plan.currency;

  if (plan.solveFor !== 'date') return <SolveBackwards plan={plan} projection={projection} />;

  if (projection.monthsToFi === null) {
    const needSaving = solveSavings(plan, r.targetRetireAge);
    return (
      <section className="verdict verdict-unreachable">
        <p className="eyebrow">On these numbers</p>
        <h2 className="verdict-date">Never, as it stands.</h2>
        <p className="verdict-sub">
          Spending is growing at least as fast as the portfolio, so the target keeps moving out of reach. The
          fastest fixes are below — or{' '}
          {needSaving != null ? (
            <>
              save <b>{money(needSaving, cur)}/mo</b> to retire at {Math.round(r.targetRetireAge)}.
            </>
          ) : (
            <>lower your spending, which moves the target itself.</>
          )}
        </p>
      </section>
    );
  }

  const m = projection.monthsToFi;
  const c = countdown(m);
  const date = projection.fiDate!;
  const success = sim?.drawdown.successRate ?? null;
  const p10 = sim?.fi.p10;
  const p90 = sim?.fi.p90;

  return (
    <section className="verdict">
      <p className="eyebrow">Your last day of work, if markets behave as they have</p>
      <h2 className="verdict-date">
        {longDate(date)}
        {'. '}
        <em>{c.workWeeks.toLocaleString()} work weeks.</em>
      </h2>
      <p className="verdict-sub">
        That is <b>{duration(m)}</b> from now — <b>{c.paychecks.toLocaleString()} more paychecks</b> — at which point
        you will need <b>{money(projection.fiNumber!, cur)}</b> to fund{' '}
        {money(projection.fiAnnualSpend!, cur)} a year at a {pct(r.swr, 2)} withdrawal rate.
        {p10 != null && p90 != null && (
          <>
            {' '}
            Luck moves it: {longDate(addMonths(new Date(plan.today), p10))} if markets are kind,{' '}
            {longDate(addMonths(new Date(plan.today), p90))} if they are not.
          </>
        )}
      </p>

      <div className="stat-strip">
        <Stat k="Retire at age" v={projection.fiAge!.toFixed(1)} n={`plan runs to ${r.horizonAge}`} />
        <Stat k="Target" v={money(projection.fiNumber!, cur)} n={`${(1 / r.swr).toFixed(1)}× spending`} />
        <Stat k="If you stopped today" v={money(projection.requiredToday, cur)} n={`you have ${money(r.investable, cur)}`} />
        <Stat k="Savings rate" v={pct(r.savingsRate, 1)} n={`${money(r.totalMonthlyIn, cur)}/mo`} />
        {success != null && (
          <Stat
            k="Money outlasts you"
            v={pct(success, 0)}
            n={`${plan.simRuns.toLocaleString()} simulated lives`}
          />
        )}
      </div>
    </section>
  );
}

function SolveBackwards({ plan, projection }: { plan: Plan; projection: Projection }) {
  const r = resolve(plan);
  const cur = plan.currency;
  const targetAge = r.targetRetireAge;
  const months = Math.round((targetAge - r.age) * 12);
  const c = countdown(months);
  const date = addMonths(new Date(plan.today), months);

  if (plan.solveFor === 'savings') {
    const need = solveSavings(plan, targetAge);
    const gap = need == null ? null : need - r.monthlySavings;
    return (
      <section className={`verdict${need == null ? ' verdict-unreachable' : ''}`}>
        <p className="eyebrow">To stop working in {longDate(date)}, at age {targetAge.toFixed(0)}</p>
        <h2 className="verdict-date">
          {need == null ? 'Not with saving alone.' : <>{money(need, cur)}<em>/month</em></>}
        </h2>
        <p className="verdict-sub">
          {need == null ? (
            <>
              No monthly saving reaches that date, because spending growth outruns the portfolio. Cut spending or
              push the date out.
            </>
          ) : gap != null && gap > 1 ? (
            <>
              That is <b>{money(gap, cur)}/mo more</b> than the {money(r.monthlySavings, cur)} you save now — a
              savings rate of <b>{pct(((need + r.employerMonthly) * 12) / r.annualGrossIncome, 1)}</b> instead of{' '}
              {pct(r.savingsRate, 1)}. {c.workWeeks.toLocaleString()} work weeks to go.
            </>
          ) : (
            <>
              You already save more than that. On your current plan the date arrives{' '}
              {projection.monthsToFi != null ? <b>{longDate(projection.fiDate!)}</b> : 'later'} instead.
            </>
          )}
        </p>
        <div className="stat-strip">
          <Stat k="Target date" v={longDate(date)} n={`${c.workWeeks.toLocaleString()} work weeks`} />
          <Stat k="You save now" v={`${money(r.monthlySavings, cur)}/mo`} n={pct(r.savingsRate, 1)} />
          {need != null && (
            <Stat k="Required" v={`${money(need, cur)}/mo`} n={`plus ${money(r.employerMonthly, cur)} from your employer`} />
          )}
        </div>
      </section>
    );
  }

  const budget = solveSpending(plan, targetAge);
  return (
    <section className={`verdict${budget == null ? ' verdict-unreachable' : ''}`}>
      <p className="eyebrow">To stop working in {longDate(date)}, at age {targetAge.toFixed(0)}</p>
      <h2 className="verdict-date">
        {budget == null ? 'No budget works.' : <>{money(budget, cur)}<em>/month</em></>}
      </h2>
      <p className="verdict-sub">
        {budget == null ? (
          <>Even at minimal spending the date is out of reach. Save more, or move the date.</>
        ) : (
          <>
            Spend that much and the date holds. You spend <b>{money(r.monthlyExpenses, cur)}/mo</b> today, so this
            is a <b>{pct(Math.abs(budget / r.monthlyExpenses - 1), 0)}</b>{' '}
            {budget < r.monthlyExpenses ? 'cut' : 'increase'}. Lower spending shrinks the target and grows the
            saving at the same time, which is why it moves the date faster than anything else.
          </>
        )}
      </p>
      <div className="stat-strip">
        <Stat k="Target date" v={longDate(date)} n={`${c.workWeeks.toLocaleString()} work weeks`} />
        <Stat k="You spend now" v={`${money(r.monthlyExpenses, cur)}/mo`} n={money(r.annualExpenses, cur) + '/yr'} />
        {budget != null && (
          <Stat k="Affordable" v={`${money(budget, cur)}/mo`} n={money(budget * 12, cur) + '/yr'} />
        )}
      </div>
    </section>
  );
}

function Stat({ k, v, n }: { k: string; v: string; n?: string }) {
  return (
    <div className="stat">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
      {n && <div className="n">{n}</div>}
    </div>
  );
}
