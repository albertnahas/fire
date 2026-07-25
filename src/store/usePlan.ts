import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_PLAN } from '../engine/assumptions';
import type { IncomeStream, LumpEvent, Plan } from '../engine/types';

export interface Scenario {
  id: string;
  name: string;
  plan: Plan;
}

interface State {
  plan: Plan;
  /** Saved comparisons, so you can hold two futures side by side. */
  scenarios: Scenario[];
  /** Show figures in future nominal dollars rather than today's. */
  nominalView: boolean;
  set: <K extends keyof Plan>(key: K, value: Plan[K]) => void;
  patch: (partial: Partial<Plan>) => void;
  reset: () => void;
  addStream: () => void;
  updateStream: (id: string, patch: Partial<IncomeStream>) => void;
  removeStream: (id: string) => void;
  addEvent: () => void;
  updateEvent: (id: string, patch: Partial<LumpEvent>) => void;
  removeEvent: (id: string) => void;
  saveScenario: (name: string) => void;
  loadScenario: (id: string) => void;
  removeScenario: (id: string) => void;
  toggleNominal: () => void;
}

const uid = () => Math.random().toString(36).slice(2, 9);

export const usePlan = create<State>()(
  persist(
    (set, get) => ({
      plan: DEFAULT_PLAN,
      scenarios: [],
      nominalView: false,

      set: (key, value) => set((s) => ({ plan: { ...s.plan, [key]: value } })),
      patch: (partial) => set((s) => ({ plan: { ...s.plan, ...partial } })),
      reset: () => set({ plan: { ...DEFAULT_PLAN, today: new Date().toISOString().slice(0, 10) } }),

      addStream: () =>
        set((s) => ({
          plan: {
            ...s.plan,
            incomeStreams: [
              ...s.plan.incomeStreams,
              {
                id: uid(),
                label: 'Social Security',
                annualAmount: 24000,
                startAge: 67,
                endAge: null,
                inflationLinked: true,
              },
            ],
          },
        })),
      updateStream: (id, patch) =>
        set((s) => ({
          plan: {
            ...s.plan,
            incomeStreams: s.plan.incomeStreams.map((x) => (x.id === id ? { ...x, ...patch } : x)),
          },
        })),
      removeStream: (id) =>
        set((s) => ({
          plan: { ...s.plan, incomeStreams: s.plan.incomeStreams.filter((x) => x.id !== id) },
        })),

      addEvent: () =>
        set((s) => ({
          plan: {
            ...s.plan,
            events: [...s.plan.events, { id: uid(), label: 'One-off', amount: -25000, inYears: 5 }],
          },
        })),
      updateEvent: (id, patch) =>
        set((s) => ({
          plan: { ...s.plan, events: s.plan.events.map((x) => (x.id === id ? { ...x, ...patch } : x)) },
        })),
      removeEvent: (id) =>
        set((s) => ({ plan: { ...s.plan, events: s.plan.events.filter((x) => x.id !== id) } })),

      saveScenario: (name) =>
        set((s) => ({
          scenarios: [...s.scenarios.slice(-5), { id: uid(), name, plan: structuredClone(s.plan) }],
        })),
      loadScenario: (id) => {
        const found = get().scenarios.find((x) => x.id === id);
        if (found) set({ plan: structuredClone(found.plan) });
      },
      removeScenario: (id) => set((s) => ({ scenarios: s.scenarios.filter((x) => x.id !== id) })),

      toggleNominal: () => set((s) => ({ nominalView: !s.nominalView })),
    }),
    { name: 'fire.plan.v1' },
  ),
);
