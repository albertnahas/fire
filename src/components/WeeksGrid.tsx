import { countdown } from '../engine/format';

/**
 * The countdown, one square per working week. Squares shade from cold to indigo
 * as the years pass, and the last one is ochre. It is the same number as the
 * date above, in the only unit that is felt weekly.
 */
export function WeeksGrid({ months }: { months: number }) {
  const c = countdown(months);
  const total = Math.min(c.workWeeks, 2600);
  const truncated = c.workWeeks > total;

  return (
    <div className="weeks">
      <div className="weeks-grid" aria-hidden>
        {Array.from({ length: total }, (_, i) => {
          const q = Math.floor((i / total) * 4);
          const cls = i === total - 1 && !truncated ? 'last' : `q${q + 1}`;
          return (
            <i
              key={i}
              className={cls}
              style={{ animationDelay: `${Math.min(900, i * 0.55)}ms` }}
            />
          );
        })}
      </div>

      <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--on-ink-mute)' }}>
        {truncated && <>Showing the first {total.toLocaleString()} of {c.workWeeks.toLocaleString()}. </>}
        Each square is one working week, holidays already removed.
      </p>

      <div className="weeks-units">
        <Unit k="Work weeks" v={c.workWeeks} />
        <Unit k="Calendar weeks" v={c.weeks} />
        <Unit k="Working days" v={c.workDays} />
        <Unit k="Paychecks" v={c.paychecks} n="twice monthly" />
        <Unit k="Months" v={c.months} />
        <Unit k="Monday mornings" v={c.mondays} />
      </div>
    </div>
  );
}

function Unit({ k, v, n }: { k: string; v: number; n?: string }) {
  return (
    <div className="stat">
      <div className="k">{k}</div>
      <div className="v">{v.toLocaleString()}</div>
      {n && <div className="n">{n}</div>}
    </div>
  );
}
