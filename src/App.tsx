import { useEffect, useMemo, useRef, useState } from 'react';
import { Crossing } from './components/Crossing';
import { Composition, Confidence, DateDistribution, Levers } from './components/Insights';
import { Ledger } from './components/Ledger';
import { Milestones } from './components/Milestones';
import { Notes } from './components/Notes';
import { Verdict } from './components/Verdict';
import { WeeksGrid } from './components/WeeksGrid';
import { duration, longDate, money } from './engine/format';
import type { Lever } from './engine/monte-carlo';
import { project } from './engine/projection';
import type { Plan, SimResult } from './engine/types';
import type { WorkerResponse } from './engine/worker';
import { usePlan } from './store/usePlan';

/** Runs the simulation off the main thread, debounced so typing stays smooth. */
function useSimulation(plan: Plan) {
  const [sim, setSim] = useState<SimResult | null>(null);
  const [levers, setLevers] = useState<Lever[]>([]);
  const [busy, setBusy] = useState(true);
  const [ms, setMs] = useState(0);
  const worker = useRef<Worker | null>(null);
  const nextId = useRef(0);
  const latest = useRef(0);

  useEffect(() => {
    const w = new Worker(new URL('./engine/worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<WorkerResponse>) => {
      if (e.data.id !== latest.current) return;
      setSim(e.data.sim);
      setLevers(e.data.levers);
      setMs(e.data.ms);
      setBusy(false);
    };
    worker.current = w;
    return () => w.terminate();
  }, []);

  useEffect(() => {
    setBusy(true);
    const handle = setTimeout(() => {
      const id = ++nextId.current;
      latest.current = id;
      worker.current?.postMessage({ id, plan });
    }, 220);
    return () => clearTimeout(handle);
  }, [plan]);

  return { sim, levers, busy, ms };
}

export default function App() {
  const { plan, scenarios, saveScenario, loadScenario, removeScenario } = usePlan();
  const projection = useMemo(() => project(plan), [plan]);
  const { sim, levers, busy, ms } = useSimulation(plan);
  const [logScale, setLogScale] = useState(true);

  const monthsForCountdown =
    plan.solveFor === 'date'
      ? projection.monthsToFi
      : Math.round(((plan.targetRetireAge ?? plan.age + 12) - plan.age) * 12);

  return (
    <div className="shell">
      <Ledger />

      <main className="stage">
        <Verdict plan={plan} projection={projection} sim={sim} />

        <section className="block">
          <header>
            <div>
              <h2>The Crossing</h2>
              <p>
                Every faint thread is one possible life — the same plan, a different sequence of markets. The dashed
                line is the capital your spending demands, and it keeps rising.
              </p>
            </div>
            <span className="busy">
              {busy ? 'simulating…' : `${plan.simRuns.toLocaleString()} lives · ${ms.toFixed(0)} ms`}
            </span>
          </header>
          <Crossing
            projection={projection}
            sim={sim}
            currency={plan.currency}
            today={plan.today}
            logScale={logScale}
            onToggleScale={() => setLogScale((v) => !v)}
          />
        </section>

        {monthsForCountdown != null && monthsForCountdown > 0 && (
          <section className="block">
            <header>
              <div>
                <h2>What is left to work</h2>
                <p>The same answer, in the unit a working life is actually measured in.</p>
              </div>
            </header>
            <WeeksGrid months={monthsForCountdown} />
          </section>
        )}

        <section className="block">
          <header>
            <div>
              <h2>Waypoints</h2>
              <p>Full independence is one of five thresholds, and it is not the first one that changes your life.</p>
            </div>
          </header>
          <Milestones plan={plan} projection={projection} />
        </section>

        {sim && (
          <section className="block">
            <header>
              <div>
                <h2>Does the money last?</h2>
                <p>
                  Reaching the number is the easy half. The hard half is the thirty or fifty years of withdrawals
                  that follow.
                </p>
              </div>
            </header>
            <Confidence plan={plan} sim={sim} />
          </section>
        )}

        {levers.length > 0 && (
          <section className="block">
            <header>
              <div>
                <h2>What actually moves the date</h2>
                <p>
                  Each row is one change, applied on its own, measured in how much sooner you stop working. Ranked
                  by effect, not by how often the advice gets repeated.
                </p>
              </div>
            </header>
            <Levers levers={levers} currency={plan.currency} />
          </section>
        )}

        {sim && sim.fi.histogram.length > 1 && (
          <section className="block">
            <header>
              <div>
                <h2>How wide is the date?</h2>
                <p>
                  Where the finish line lands across every simulated life. The indigo span holds the middle 80%. A
                  single confident date is a fiction, and this is the honest width of it.
                </p>
              </div>
            </header>
            <DateDistribution sim={sim} plan={plan} />
          </section>
        )}

        {projection.monthsToFi !== null && (
          <section className="block">
            <header>
              <div>
                <h2>Whose money gets you there</h2>
                <p>Your contributions against compound growth, at the moment you retire.</p>
              </div>
            </header>
            <Composition plan={plan} projection={projection} />
          </section>
        )}

        <section className="block">
          <header>
            <div>
              <h2>Compare futures</h2>
              <p>Save the plan as it stands, change something, and hold the two side by side.</p>
            </div>
          </header>
          <div className="chips">
            <button
              className="chip"
              style={{ borderColor: 'var(--indigo-lit)', color: 'var(--on-ink)' }}
              onClick={() => saveScenario(defaultName(plan, projection.monthsToFi))}
            >
              + Save this plan
            </button>
            {scenarios.map((s) => {
              const p = project(s.plan);
              return (
                <span className="chip" key={s.id}>
                  <button onClick={() => loadScenario(s.id)} title="Load this plan">
                    {s.name}
                  </button>
                  <span style={{ color: 'var(--ochre-lit)' }}>{p.fiDate ? longDate(p.fiDate) : 'never'}</span>
                  {p.monthsToFi != null && projection.monthsToFi != null && (
                    <span style={{ color: 'var(--on-ink-faint)' }}>
                      {p.monthsToFi === projection.monthsToFi
                        ? 'same'
                        : `${p.monthsToFi < projection.monthsToFi ? '−' : '+'}${duration(
                            Math.abs(p.monthsToFi - projection.monthsToFi),
                          )}`}
                    </span>
                  )}
                  <button className="x" onClick={() => removeScenario(s.id)} aria-label={`Delete ${s.name}`}>
                    ✕
                  </button>
                </span>
              );
            })}
          </div>
        </section>

        <section className="block" style={{ borderBottom: 0 }}>
          <header>
            <div>
              <h2>How this is calculated</h2>
              <p>Every assumption, stated plainly, so you can disagree with it.</p>
            </div>
          </header>
          <Notes />
        </section>
      </main>
    </div>
  );
}

function defaultName(plan: Plan, months: number | null): string {
  const spend = money(plan.monthlyExpenses ?? 0, plan.currency);
  return months === null ? `${spend}/mo · never` : `${spend}/mo · ${duration(months)}`;
}
