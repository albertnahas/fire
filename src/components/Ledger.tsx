import { RATIONALE, resolve } from '../engine/assumptions';
import { money, pct, symbolFor } from '../engine/format';
import type { SimMethod, SolveFor, SwrMode } from '../engine/types';
import { usePlan } from '../store/usePlan';
import { AllocationControl, NumberField, PlainField, Section, Segmented, Toggle } from './fields';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CHF', 'CAD', 'AUD', 'SEK', 'AED'];

export function Ledger() {
  const { plan, set, patch, reset, addStream, updateStream, removeStream, addEvent, updateEvent, removeEvent } =
    usePlan();
  const r = resolve(plan);
  const sym = symbolFor(plan.currency);

  return (
    <aside className="ledger">
      <div className="masthead">
        <div className="wordmark">
          <h1>Fire</h1>
          <span className="tag">retire early, honestly</span>
        </div>
        <p>Change anything. Leave anything blank and the engine fills it from market history.</p>
      </div>

      <Section title="You" open>
        <PlainField label="Age today" unit="years" value={plan.age} onChange={(v) => set('age', v)} min={16} max={90} />
        <NumberField
          label="Plan runs to age"
          unit="years"
          value={plan.horizonAge}
          recommended={r.horizonAge}
          onChange={(v) => set('horizonAge', v)}
          hint={RATIONALE.horizonAge}
          min={plan.age + 5}
          max={110}
        />
        <div className="row">
          <div className="row-label">
            <span>Currency</span>
          </div>
          <div className="field">
            <select
              value={plan.currency}
              aria-label="Currency"
              onChange={(e) => set('currency', e.target.value)}
              style={{
                fontFamily: 'var(--mono)',
                fontSize: '0.82rem',
                padding: '0.2rem 0.3rem',
                border: '1px solid var(--rule)',
                borderRadius: 3,
                background: 'var(--paper-sunk)',
              }}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Section>

      <Section title="Spending" count={`${money(r.annualExpenses, plan.currency)}/yr`} open>
        <NumberField
          label="Monthly spending"
          unit={sym}
          value={plan.monthlyExpenses}
          recommended={r.monthlyExpenses}
          onChange={(v) => set('monthlyExpenses', v)}
          hint={RATIONALE.monthlyExpenses}
        />
        <NumberField
          label="Retired spending"
          unit="× today"
          value={plan.retirementSpendRatio}
          recommended={r.retirementSpendRatio}
          onChange={(v) => set('retirementSpendRatio', v)}
          hint={RATIONALE.retirementSpendRatio}
          decimals={2}
          min={0.2}
          max={3}
        />
        <NumberField
          label="Lifestyle creep"
          unit="%/yr real"
          value={plan.realExpenseGrowth}
          recommended={r.realExpenseGrowth * 100}
          onChange={(v) => set('realExpenseGrowth', v)}
          hint={RATIONALE.realExpenseGrowth}
          decimals={2}
          min={-3}
          max={6}
        />
        <NumberField
          label="Health insurance"
          unit={`${sym}/yr`}
          value={plan.healthcareAnnual}
          recommended={r.healthcareAnnual}
          onChange={(v) => set('healthcareAnnual', v)}
          hint={RATIONALE.healthcareAnnual}
        />
        <NumberField
          label="Public cover starts"
          unit="age"
          value={plan.medicareAge}
          recommended={r.medicareAge}
          onChange={(v) => set('medicareAge', v)}
          hint={RATIONALE.medicareAge}
          min={40}
          max={80}
        />
      </Section>

      <Section title="What you have" count={money(r.investable, plan.currency)} open>
        <NumberField
          label="Taxable brokerage"
          unit={sym}
          value={plan.balances.taxable}
          recommended={0}
          onChange={(v) => patch({ balances: { ...plan.balances, taxable: v } })}
        />
        <NumberField
          label="Pre-tax / 401k / pension"
          unit={sym}
          value={plan.balances.taxDeferred}
          recommended={0}
          onChange={(v) => patch({ balances: { ...plan.balances, taxDeferred: v } })}
        />
        <NumberField
          label="Roth / tax-free"
          unit={sym}
          value={plan.balances.roth}
          recommended={0}
          onChange={(v) => patch({ balances: { ...plan.balances, roth: v } })}
        />
        <NumberField
          label="Cash"
          unit={sym}
          value={plan.balances.cash}
          recommended={0}
          onChange={(v) => patch({ balances: { ...plan.balances, cash: v } })}
        />
      </Section>

      <Section title="Earning & saving" count={pct(r.savingsRate, 0)} open>
        <NumberField
          label="Gross income"
          unit={`${sym}/yr`}
          value={plan.annualGrossIncome}
          recommended={r.annualGrossIncome}
          onChange={(v) => set('annualGrossIncome', v)}
          hint={RATIONALE.annualGrossIncome}
        />
        <NumberField
          label="You save"
          unit={`${sym}/mo`}
          value={plan.monthlySavings}
          recommended={r.monthlySavings}
          onChange={(v) => set('monthlySavings', v)}
          hint={RATIONALE.monthlySavings}
        />
        <NumberField
          label="Employer adds"
          unit="% of gross"
          value={plan.employerMatchPct}
          recommended={(r.employerMonthly * 12 * 100) / Math.max(1, r.annualGrossIncome)}
          onChange={(v) => set('employerMatchPct', v)}
          hint={RATIONALE.employerMatchPct}
          decimals={1}
          min={0}
          max={30}
        />
        <NumberField
          label="Real income growth"
          unit="%/yr"
          value={plan.realIncomeGrowth}
          recommended={r.realIncomeGrowth * 100}
          onChange={(v) => set('realIncomeGrowth', v)}
          hint={RATIONALE.realIncomeGrowth}
          decimals={2}
          min={-5}
          max={15}
        />
        <p className="hint" style={{ paddingTop: '0.5rem' }}>
          Saving {money(r.totalMonthlyIn, plan.currency)}/mo including the employer match — a{' '}
          <b>{pct(r.savingsRate, 1)}</b> savings rate.
        </p>
        <div className="row-label" style={{ marginTop: '0.3rem' }}>
          <span className="row-unit">Where new money goes</span>
        </div>
        <div className="mini-card">
          <div className="grid">
            {(['taxable', 'taxDeferred', 'roth'] as const).map((k) => (
              <label key={k}>
                {k === 'taxDeferred' ? 'Pre-tax' : k === 'roth' ? 'Roth' : 'Taxable'}
                <input
                  value={plan.contributionSplit[k]}
                  inputMode="decimal"
                  onChange={(e) =>
                    patch({
                      contributionSplit: {
                        ...plan.contributionSplit,
                        [k]: Math.max(0, Number(e.target.value.replace(/[^0-9.]/g, '')) || 0),
                      },
                    })
                  }
                />
              </label>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Portfolio" count={`${pct(r.accumReturn)} real`}>
        <div className="row-label">
          <span className="row-unit">While working</span>
        </div>
        <AllocationControl value={plan.allocation} onChange={(v) => set('allocation', v)} />
        <div className="row-label" style={{ marginTop: '0.8rem' }}>
          <span className="row-unit">Once retired</span>
        </div>
        <AllocationControl value={plan.retirementAllocation} onChange={(v) => set('retirementAllocation', v)} />
        <div style={{ marginTop: '0.8rem' }}>
          <NumberField
            label="Fees"
            unit="%/yr"
            value={plan.feeDrag}
            recommended={r.feeDrag * 100}
            onChange={(v) => set('feeDrag', v)}
            hint={RATIONALE.feeDrag}
            decimals={2}
            min={0}
            max={4}
          />
        </div>
        <Toggle
          label="Damp early returns for today’s high valuations"
          on={plan.capeAware}
          onChange={(v) => set('capeAware', v)}
        />
        <p className="hint">
          The S&P 500 trades at a Shiller CAPE of 41. When this is on, expected equity returns start near the
          valuation-implied {pct(0.0242 + 0.015)} real and revert to the historical {pct(r.accumReturn + r.feeDrag)}{' '}
          over 12 years.
        </p>
      </Section>

      <Section title="Withdrawing" count={pct(r.swr, 2)}>
        <Segmented<SwrMode>
          value={plan.swrMode}
          onChange={(v) => set('swrMode', v)}
          options={[
            { value: 'bengen', label: 'SAFEMAX', title: 'Bengen’s horizon-adjusted safe rate' },
            { value: 'fixed', label: 'Fixed', title: 'Pick your own rate' },
            { value: 'cape', label: 'CAPE', title: 'Rate tied to market valuation' },
            { value: 'guardrails', label: 'Guardrails', title: 'Guyton-Klinger: spend flexes ±10%' },
            { value: 'vpw', label: 'Variable', title: 'Amortise the portfolio over the horizon' },
          ]}
        />
        <p className="hint">{r.swrLabel} — starting at {pct(r.swr, 2)} of the portfolio.</p>
        {plan.swrMode === 'fixed' && (
          <NumberField
            label="Withdrawal rate"
            unit="%"
            value={plan.fixedSwr}
            recommended={r.fixedSwr * 100}
            onChange={(v) => set('fixedSwr', v)}
            hint={RATIONALE.fixedSwr}
            decimals={2}
            min={1}
            max={12}
          />
        )}
        <NumberField
          label="Tax on pre-tax draws"
          unit="%"
          value={plan.taxRateDeferred}
          recommended={r.taxRateDeferred * 100}
          onChange={(v) => set('taxRateDeferred', v)}
          hint={RATIONALE.taxRateDeferred}
          decimals={1}
          min={0}
          max={60}
        />
        <NumberField
          label="Tax on gains"
          unit="%"
          value={plan.taxRateGains}
          recommended={r.taxRateGains * 100}
          onChange={(v) => set('taxRateGains', v)}
          hint={RATIONALE.taxRateGains}
          decimals={1}
          min={0}
          max={45}
        />
        <NumberField
          label="Taxable held as gain"
          unit="%"
          value={plan.taxableGainFraction}
          recommended={r.taxableGainFraction * 100}
          onChange={(v) => set('taxableGainFraction', v)}
          hint={RATIONALE.taxableGainFraction}
          decimals={0}
          min={0}
          max={100}
        />
      </Section>

      <Section title="Other income" count={plan.incomeStreams.length || 'none'}>
        <p className="hint" style={{ padding: '0 0 0.6rem' }}>
          Pensions, social security, rent, a spouse’s salary, part-time work. Each one shrinks the pile you need.
        </p>
        <div className="card-list">
          {plan.incomeStreams.map((s) => (
            <div className="mini-card" key={s.id}>
              <div className="top">
                <input type="text" value={s.label} onChange={(e) => updateStream(s.id, { label: e.target.value })} />
                <button className="x" onClick={() => removeStream(s.id)} aria-label={`Remove ${s.label}`}>
                  ✕
                </button>
              </div>
              <div className="grid">
                <label>
                  {sym}/yr
                  <input
                    value={s.annualAmount}
                    inputMode="decimal"
                    onChange={(e) =>
                      updateStream(s.id, { annualAmount: Number(e.target.value.replace(/[^0-9.\-]/g, '')) || 0 })
                    }
                  />
                </label>
                <label>
                  From age
                  <input
                    value={s.startAge}
                    inputMode="decimal"
                    onChange={(e) => updateStream(s.id, { startAge: Number(e.target.value.replace(/[^0-9.]/g, '')) || 0 })}
                  />
                </label>
                <label>
                  To age
                  <input
                    value={s.endAge ?? ''}
                    placeholder="life"
                    inputMode="decimal"
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^0-9.]/g, '');
                      updateStream(s.id, { endAge: v === '' ? null : Number(v) });
                    }}
                  />
                </label>
              </div>
              <Toggle
                label="Rises with inflation"
                on={s.inflationLinked}
                onChange={(v) => updateStream(s.id, { inflationLinked: v })}
              />
            </div>
          ))}
        </div>
        <button className="add" onClick={addStream}>
          + Add income
        </button>
      </Section>

      <Section title="One-off events" count={plan.events.length || 'none'}>
        <p className="hint" style={{ padding: '0 0 0.6rem' }}>
          Inheritance, a house sale, a wedding, school fees. Positive is money in, negative is money out.
        </p>
        <div className="card-list">
          {plan.events.map((e) => (
            <div className="mini-card" key={e.id}>
              <div className="top">
                <input type="text" value={e.label} onChange={(ev) => updateEvent(e.id, { label: ev.target.value })} />
                <button className="x" onClick={() => removeEvent(e.id)} aria-label={`Remove ${e.label}`}>
                  ✕
                </button>
              </div>
              <div className="grid" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
                <label>
                  {sym} amount
                  <input
                    value={e.amount}
                    inputMode="decimal"
                    onChange={(ev) => updateEvent(e.id, { amount: Number(ev.target.value.replace(/[^0-9.\-]/g, '')) || 0 })}
                  />
                </label>
                <label>
                  In years
                  <input
                    value={e.inYears}
                    inputMode="decimal"
                    onChange={(ev) => updateEvent(e.id, { inYears: Number(ev.target.value.replace(/[^0-9.]/g, '')) || 0 })}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
        <button className="add" onClick={addEvent}>
          + Add event
        </button>
      </Section>

      <Section title="Working backwards">
        <p className="hint" style={{ padding: '0 0 0.6rem' }}>
          Name the date you want. The engine solves for what it would take.
        </p>
        <Segmented<SolveFor>
          value={plan.solveFor}
          onChange={(v) => set('solveFor', v)}
          options={[
            { value: 'date', label: 'Find my date' },
            { value: 'savings', label: 'Find the saving' },
            { value: 'spending', label: 'Find the budget' },
          ]}
        />
        <NumberField
          label="Target retirement age"
          unit="years"
          value={plan.targetRetireAge}
          recommended={r.targetRetireAge}
          onChange={(v) => set('targetRetireAge', v)}
          hint={RATIONALE.targetRetireAge}
          decimals={1}
          min={plan.age + 0.5}
          max={90}
        />
      </Section>

      <Section title="Simulation" count={`${plan.simRuns.toLocaleString()} runs`}>
        <Segmented<SimMethod>
          value={plan.simMethod}
          onChange={(v) => set('simMethod', v)}
          options={[
            { value: 'bootstrap', label: 'Bootstrap', title: 'Resample real history in contiguous blocks' },
            { value: 'historical', label: 'History', title: 'Every actual start year, 1928 onward' },
            { value: 'parametric', label: 'Normal', title: 'Random draws from fitted normals' },
          ]}
        />
        <PlainField
          label="Runs"
          value={plan.simRuns}
          onChange={(v) => set('simRuns', Math.round(v))}
          min={200}
          max={20000}
        />
        <PlainField
          label="Bootstrap block"
          unit="years"
          value={plan.blockYears}
          onChange={(v) => set('blockYears', Math.round(v))}
          min={1}
          max={20}
        />
        <p className="hint">
          Blocks keep crashes and recoveries together. A block of 1 shuffles years independently and quietly
          understates how bad a real decade can be.
        </p>
      </Section>

      <div className="ledger-foot">
        <button onClick={reset}>Reset everything</button>
      </div>
    </aside>
  );
}
