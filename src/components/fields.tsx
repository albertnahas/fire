import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Opt } from '../engine/types';

/**
 * Selects the whole value when a field is entered, so typing replaces the number
 * instead of landing inside its thousands separators. Focus alone is not enough:
 * the click that granted focus collapses the caret afterwards, so the first
 * mouse-up has to be suppressed.
 */
function useSelectOnEntry() {
  const pending = useRef(false);

  return {
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
      pending.current = true;
      e.target.select();
    },
    onMouseUp: (e: React.MouseEvent<HTMLInputElement>) => {
      if (!pending.current) return;
      pending.current = false;
      e.preventDefault();
      e.currentTarget.select();
    },
    onBlur: () => {
      pending.current = false;
    },
  };
}

/**
 * A ledger line. Every value shows either what you typed or what the engine
 * recommends — dashed and grey when it is the engine's, solid when it is yours.
 * Clearing the box hands the decision back to the engine.
 */
export function NumberField({
  label,
  unit,
  value,
  recommended,
  onChange,
  hint,
  decimals = 0,
  min,
  max,
}: {
  label: string;
  unit?: string;
  value: Opt;
  recommended: number;
  onChange: (v: Opt) => void;
  hint?: string;
  decimals?: number;
  min?: number;
  max?: number;
}) {
  const isAuto = value === null;
  const shown = isAuto ? recommended : value;
  const [buffer, setBuffer] = useState(() => fmt(shown, decimals));
  const [editing, setEditing] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const entry = useSelectOnEntry();

  useEffect(() => {
    if (!editing) setBuffer(fmt(shown, decimals));
  }, [shown, decimals, editing]);

  const commit = (raw: string) => {
    const cleaned = raw.replace(/[^0-9.\-]/g, '');
    if (cleaned === '' || cleaned === '-') {
      onChange(null);
      return;
    }
    let n = Number(cleaned);
    if (!Number.isFinite(n)) {
      onChange(null);
      return;
    }
    if (min != null) n = Math.max(min, n);
    if (max != null) n = Math.min(max, n);
    onChange(n);
  };

  return (
    <>
      <div className="row">
        <div className="row-label">
          <span>
            {hint ? (
              <button
                type="button"
                onClick={() => setShowHint((v) => !v)}
                style={{ textAlign: 'left', textDecoration: showHint ? 'underline' : undefined }}
                aria-expanded={showHint}
              >
                {label}
              </button>
            ) : (
              label
            )}
          </span>
          {unit && <span className="row-unit">{unit}</span>}
        </div>
        <div className="field">
          {!isAuto && (
            <button className="revert" onClick={() => onChange(null)} title="Hand this figure back to the engine">
              reset
            </button>
          )}
          {isAuto && <span className="auto-badge">auto</span>}
          <input
            value={buffer}
            inputMode="decimal"
            aria-label={label}
            className={isAuto ? 'auto' : undefined}
            onFocus={(e) => {
              setEditing(true);
              entry.onFocus(e);
            }}
            onMouseUp={entry.onMouseUp}
            onChange={(e) => {
              setBuffer(e.target.value);
              commit(e.target.value);
            }}
            onBlur={() => {
              entry.onBlur();
              setEditing(false);
              setBuffer(fmt(isAuto ? recommended : value ?? recommended, decimals));
            }}
          />
        </div>
      </div>
      {showHint && hint && <p className="hint">{hint}</p>}
    </>
  );
}

function fmt(v: number, decimals: number): string {
  if (!Number.isFinite(v)) return '';
  return decimals > 0
    ? v.toFixed(decimals)
    : Math.round(v).toLocaleString('en-US');
}

/** A plain required number — no auto state, because the engine cannot guess it. */
export function PlainField({
  label,
  unit,
  value,
  onChange,
  decimals = 0,
  min,
  max,
}: {
  label: string;
  unit?: string;
  value: number;
  onChange: (v: number) => void;
  decimals?: number;
  min?: number;
  max?: number;
}) {
  const [buffer, setBuffer] = useState(() => fmt(value, decimals));
  const [editing, setEditing] = useState(false);
  const entry = useSelectOnEntry();

  useEffect(() => {
    if (!editing) setBuffer(fmt(value, decimals));
  }, [value, decimals, editing]);

  return (
    <div className="row">
      <div className="row-label">
        <span>{label}</span>
        {unit && <span className="row-unit">{unit}</span>}
      </div>
      <div className="field">
        <input
          value={buffer}
          inputMode="decimal"
          aria-label={label}
          onFocus={(e) => {
            setEditing(true);
            entry.onFocus(e);
          }}
          onMouseUp={entry.onMouseUp}
          onChange={(e) => {
            setBuffer(e.target.value);
            const cleaned = e.target.value.replace(/[^0-9.\-]/g, '');
            if (cleaned === '') return;
            let n = Number(cleaned);
            if (!Number.isFinite(n)) return;
            if (min != null) n = Math.max(min, n);
            if (max != null) n = Math.min(max, n);
            onChange(n);
          }}
          onBlur={() => {
            entry.onBlur();
            setEditing(false);
            setBuffer(fmt(value, decimals));
          }}
        />
      </div>
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; title?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented" role="group">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="toggle-row">
      <span>{label}</span>
      <button className="switch" aria-pressed={on} aria-label={label} onClick={() => onChange(!on)} />
    </div>
  );
}

export function Section({
  title,
  count,
  children,
  open,
}: {
  title: string;
  count?: ReactNode;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details className="section" open={open}>
      <summary>
        {title}
        {count != null && <span className="count">{count}</span>}
      </summary>
      <div className="section-body">{children}</div>
    </details>
  );
}

/**
 * Allocation across stocks, bonds and cash. Two sliders, because the third is
 * always whatever is left over.
 */
export function AllocationControl({
  value,
  onChange,
}: {
  value: { stocks: number; bonds: number; cash: number };
  onChange: (v: { stocks: number; bonds: number; cash: number }) => void;
}) {
  const total = value.stocks + value.bonds + value.cash || 1;
  const p = {
    stocks: (value.stocks / total) * 100,
    bonds: (value.bonds / total) * 100,
    cash: (value.cash / total) * 100,
  };

  return (
    <div className="alloc">
      <div className="alloc-bar">
        <i style={{ width: `${p.stocks}%`, background: 'var(--indigo)' }} />
        <i style={{ width: `${p.bonds}%`, background: '#8a8fb8' }} />
        <i style={{ width: `${p.cash}%`, background: 'var(--rule-strong)' }} />
      </div>
      <div className="alloc-legend">
        <span style={{ color: 'var(--indigo)' }}>Stocks {Math.round(p.stocks)}%</span>
        <span style={{ color: '#7076a0' }}>Bonds {Math.round(p.bonds)}%</span>
        <span style={{ color: 'var(--on-paper-mute)' }}>Cash {Math.round(p.cash)}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={Math.round(p.stocks)}
        aria-label="Stocks percentage"
        onChange={(e) => {
          const s = Number(e.target.value);
          const rest = 100 - s;
          const oldRest = p.bonds + p.cash || 1;
          onChange({
            stocks: s,
            bonds: (p.bonds / oldRest) * rest,
            cash: (p.cash / oldRest) * rest,
          });
        }}
      />
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={Math.round(p.cash)}
        aria-label="Cash percentage"
        onChange={(e) => {
          const c = Math.min(Number(e.target.value), 100 - p.stocks);
          onChange({ stocks: p.stocks, bonds: 100 - p.stocks - c, cash: c });
        }}
      />
    </div>
  );
}
