import { REAL_HISTORY } from '../data/market-history';
import { GUARDRAIL_FLOOR, resolve } from '../engine/assumptions';
import { compact, duration, money, pct } from '../engine/format';
import { isPercentageStrategy, type Lever } from '../engine/monte-carlo';
import type { Plan, Projection, SimResult } from '../engine/types';

export function Confidence({ plan, sim }: { plan: Plan; sim: SimResult }) {
  const r = resolve(plan);
  const cur = plan.currency;
  const s = sim.drawdown;
  const grade = (v: number) => (v >= 0.9 ? 'good' : v >= 0.75 ? 'ok' : 'bad');
  const colour = (v: number) =>
    v >= 0.9 ? 'var(--sage)' : v >= 0.75 ? 'var(--ochre-lit)' : 'var(--coral-lit)';

  const medianTerminal = s.terminal[Math.floor(s.terminal.length / 2)] ?? 0;
  const flexible = plan.swrMode === 'guardrails' || plan.swrMode === 'vpw' || plan.swrMode === 'cape';
  const plannedSpend = r.annualExpenses * r.retirementSpendRatio;

  return (
    <>
      <div className="conf">
        <div className="dial">
          <div className={`dial-num ${grade(s.successRate)}`}>{pct(s.successRate, 0)}</div>
          <div className="dial-bar">
            <i style={{ width: `${s.successRate * 100}%`, background: colour(s.successRate) }} />
          </div>
          <p>
            of {plan.simRuns.toLocaleString()} simulated lives reach the date and still have money at{' '}
            {r.horizonAge}.{' '}
            {isPercentageStrategy(plan.swrMode) && (
              <>
                This strategy takes a share of whatever is there, so it cannot run out — the risk shows up as
                lower spending instead, in the panel to the right.{' '}
              </>
            )}
            {plan.simMethod === 'bootstrap'
              ? `Built by resampling real history in ${plan.blockYears}-year blocks.`
              : plan.simMethod === 'historical'
                ? 'Every actual start year since 1928, in the order it happened.'
                : 'Random draws from normals fitted to the historical record.'}
          </p>
        </div>

        <div className="dial">
          <div className={`dial-num ${grade(sim.historicalSuccess)}`}>{pct(sim.historicalSuccess, 0)}</div>
          <div className="dial-bar">
            <i style={{ width: `${sim.historicalSuccess * 100}%`, background: colour(sim.historicalSuccess) }} />
          </div>
          <p>
            survived on the real sequences, tested against all {REAL_HISTORY.length} start years from 1928 to 2025.
            {sim.historicalWorstStart != null && (
              <>
                {' '}
                The one that broke it worst began in <b>{sim.historicalWorstStart}</b>.
              </>
            )}
          </p>
        </div>

        <div className="dial">
          <div className="dial-num" style={{ color: 'var(--indigo-lit)' }}>
            {compact(medianTerminal, cur)}
          </div>
          <div className="dial-bar">
            <i
              style={{
                width: `${Math.min(100, (medianTerminal / Math.max(1, s.terminal.at(-1) ?? 1)) * 100)}%`,
                background: 'var(--indigo-lit)',
              }}
            />
          </div>
          <p>
            left over at {r.horizonAge} in the median life, in today’s money.{' '}
            {plan.swrMode === 'vpw' ? (
              <>
                Nothing left over is the design: this rule spends the portfolio down to zero exactly at{' '}
                {r.horizonAge}, which is why it can afford to spend more along the way.
              </>
            ) : (
              <>
                The unluckiest {pct(0.05, 0)} end with{' '}
                {compact(s.terminal[Math.floor(s.terminal.length * 0.05)] ?? 0, cur)}.
              </>
            )}
            {s.medianRuinYear != null && (
              <>
                {' '}
                The plans that fail typically run dry around age{' '}
                <b>{Math.round(r.age + s.medianRuinYear)}</b>.
              </>
            )}
          </p>
        </div>

        {flexible && (
          <div className="dial">
            <div className="dial-num" style={{ color: 'var(--ochre-lit)' }}>
              {money(s.medianSpend, cur)}
            </div>
            <div className="dial-bar">
              <i
                style={{
                  width: `${Math.min(100, (s.medianSpend / Math.max(1, plannedSpend * 1.5)) * 100)}%`,
                  background: 'var(--ochre-lit)',
                }}
              />
            </div>
            <p>
              actually spent per year in the median life, against {money(plannedSpend, cur)} planned. This strategy
              cuts spending when markets fall — in the worst 5% you average{' '}
              <b>{money(s.p5Spend, cur)}</b>.
              {plan.swrMode === 'guardrails' && (
                <>
                  {' '}
                  It never cuts below {pct(GUARDRAIL_FLOOR, 0)} of plan, which is the promise you have to be able
                  to keep for the higher starting rate to be safe.
                </>
              )}
            </p>
          </div>
        )}
      </div>

      {s.successRate < 0.85 && (
        <div className="warn bad">
          <b>This plan is thin.</b>
          <span>
            Fewer than 85 of 100 lives make it. Sequence-of-returns risk is the culprit: a bad first decade with
            withdrawals already running is close to unrecoverable. Lower the withdrawal rate, add flexibility with
            the guardrails strategy, or work a little longer — the first two are cheaper than the third.
          </span>
        </div>
      )}
      {s.successRate >= 0.97 && (
        <div className="warn good">
          <b>You may be overshooting.</b>
          <span>
            Above about 95% success the extra years of work buy very little safety and cost real time. A plan that
            fails in the worst 3% of history is a plan that mostly leaves a large estate.
          </span>
        </div>
      )}
    </>
  );
}

export function Levers({ levers, currency }: { levers: Lever[]; currency: string }) {
  void currency;
  const max = Math.max(1, ...levers.map((l) => Math.abs(l.monthsEarlier === -999 ? 0 : l.monthsEarlier)));
  return (
    <div className="levers">
      {levers.map((l) => {
        const v = l.monthsEarlier === -999 ? 0 : l.monthsEarlier;
        const pos = v >= 0;
        return (
          <div className="lever" key={l.key}>
            <div>
              {l.label}
              <div className="nudge">{l.nudge}</div>
            </div>
            <div className="lever-track">
              <i className={pos ? undefined : 'neg'} style={{ width: `${(Math.abs(v) / max) * 100}%` }} />
            </div>
            <div className={`lever-val ${pos ? 'pos' : 'neg'}`}>
              {v === 0 ? 'no change' : `${pos ? '−' : '+'}${duration(Math.abs(v))}`}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DateDistribution({ sim, plan }: { sim: SimResult; plan: Plan }) {
  const h = sim.fi.histogram;
  if (!h.length) return null;
  const max = Math.max(...h.map((b) => b.count));
  const total = h.reduce((a, b) => a + b.count, 0);
  const baseYear = new Date(plan.today).getFullYear();
  const p10Year = sim.fi.p10 != null ? baseYear + Math.floor(sim.fi.p10 / 12) : null;
  const p90Year = sim.fi.p90 != null ? baseYear + Math.floor(sim.fi.p90 / 12) : null;
  const p50Year = sim.fi.p50 != null ? baseYear + Math.floor(sim.fi.p50 / 12) : null;

  return (
    <div>
      <div className="dist">
        {h.map((b) => {
          const inner = p10Year != null && p90Year != null && b.year >= p10Year && b.year <= p90Year;
          const mid = b.year === p50Year;
          return (
            <div
              className={`dist-col${mid ? ' mid' : inner ? ' inner' : ''}`}
              key={b.year}
              style={{ height: `${Math.max(2, (b.count / max) * 100)}%` }}
              title={`${b.year}: ${((b.count / total) * 100).toFixed(1)}% of lives`}
            />
          );
        })}
      </div>
      <div className="dist-axis">
        <span>{h[0].year}</span>
        <span style={{ color: 'var(--ochre-lit)' }}>{p50Year} · median</span>
        <span>{h.at(-1)!.year}</span>
      </div>
      {sim.fi.reached < 0.999 && (
        <div className="warn">
          <b>{pct(1 - sim.fi.reached, 0)} of lives never get there.</b>
          <span>
            In those markets your spending grows faster than the portfolio does, and the target keeps receding.
          </span>
        </div>
      )}
    </div>
  );
}

export function Composition({ plan, projection }: { plan: Plan; projection: Projection }) {
  const r = resolve(plan);
  const cur = plan.currency;
  if (projection.monthsToFi === null) return null;

  const at = projection.path[projection.monthsToFi];
  const start = r.investable;
  const contributed = at.contributed;
  const growth = Math.max(0, at.balance - start - contributed);
  const total = Math.max(1, start + contributed + growth);

  // The month the market's contribution overtakes yours.
  let crossover: number | null = null;
  for (const p of projection.path) {
    if (p.t > projection.monthsToFi) break;
    const g = Math.max(0, p.balance - start - p.contributed);
    if (g >= p.contributed + start) {
      crossover = p.t;
      break;
    }
  }

  const seg = (v: number, colour: string, label: string) => (
    <div style={{ minWidth: 0 }} key={label}>
      <div style={{ height: 10, background: colour, borderRadius: 2 }} />
      <div style={{ fontFamily: 'var(--mono)', fontSize: '0.62rem', marginTop: '0.45rem', color: 'var(--on-ink-mute)' }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: '0.86rem' }}>{compact(v, cur)}</div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: '0.62rem', color: 'var(--on-ink-faint)' }}>
        {pct(v / total, 0)}
      </div>
    </div>
  );

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gap: '0.4rem',
          gridTemplateColumns: [start, contributed, growth]
            .map((v) => `minmax(0, ${Math.max(0.04, v / total)}fr)`)
            .join(' '),
        }}
      >
        {seg(start, 'var(--ink-line)', 'Already yours')}
        {seg(contributed, 'var(--indigo)', 'You will save')}
        {seg(growth, 'var(--indigo-lit)', 'The market adds')}
      </div>
      <p style={{ fontSize: '0.83rem', color: 'var(--on-ink-mute)', marginTop: '1.1rem', maxWidth: '62ch' }}>
        {crossover != null ? (
          <>
            Around <b style={{ color: 'var(--on-ink)' }}>{duration(crossover)}</b> from now the market is
            contributing more than you are. After that point, waiting does more than saving — which is the whole
            argument for starting early rather than saving hard.
          </>
        ) : (
          <>
            Your own contributions still outweigh investment growth on the day you retire. That is normal for short
            timelines, and it means the plan depends more on your savings rate than on market luck.
          </>
        )}
      </p>
    </div>
  );
}
