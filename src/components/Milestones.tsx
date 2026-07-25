import { duration, longDate, money } from '../engine/format';
import { bridgeCheck, milestones } from '../engine/milestones';
import type { Plan, Projection } from '../engine/types';

export function Milestones({ plan, projection }: { plan: Plan; projection: Projection }) {
  const list = milestones(plan, projection);
  const bridge = bridgeCheck(plan, projection);
  const cur = plan.currency;

  return (
    <>
      <div className="milestones">
        {list.map((m) => (
          <div className={`ms${m.reached ? ' done' : ''}`} key={m.key}>
            <div>
              <div className="ms-name">{m.name}</div>
              <div className="ms-meter">
                <i style={{ width: `${Math.round(m.progress * 100)}%` }} />
              </div>
            </div>
            <div className="ms-blurb">{m.blurb}</div>
            <div className="ms-num">
              {money(m.target, cur)}
              <small>{m.reached ? 'reached' : `${Math.round(m.progress * 100)}% there`}</small>
            </div>
            <div className="ms-when">
              {m.reached ? 'now' : m.monthsAway === null ? '—' : longDate(m.date!)}
              {!m.reached && m.monthsAway !== null && (
                <small style={{ display: 'block', color: 'var(--on-ink-faint)' }}>{duration(m.monthsAway)}</small>
              )}
            </div>
          </div>
        ))}
      </div>

      {bridge?.needed && (
        <div className={`warn${bridge.ok ? '' : ' bad'}`}>
          <b>
            {bridge.ok ? 'The bridge holds.' : `The bridge is short by ${money(bridge.shortfall, cur)}.`}
          </b>
          <span>
            Retiring at {(projection.fiAge ?? 0).toFixed(1)} leaves {bridge.years.toFixed(1)} years before
            pre-tax accounts open at 59½, costing {money(bridge.cost, cur)}. Your taxable, Roth and cash balances
            should reach about {money(bridge.accessible, cur)} by then.
            {bridge.ok
              ? ' Roth earnings are still locked until 59½, so the taxable account should carry most of it.'
              : ' Shift contributions toward taxable and Roth, or plan a Roth conversion ladder — five years of conversions, started five years before you need the money.'}
          </span>
        </div>
      )}
    </>
  );
}
