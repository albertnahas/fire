/// <reference lib="webworker" />
import { sensitivity, simulate, type Lever } from './monte-carlo';
import { project } from './projection';
import type { Plan, SimResult } from './types';

export interface WorkerRequest {
  id: number;
  plan: Plan;
}

export interface WorkerResponse {
  id: number;
  sim: SimResult;
  levers: Lever[];
  ms: number;
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { id, plan } = e.data;
  const started = performance.now();
  const base = project(plan);
  const sim = simulate(plan);
  const levers = sensitivity(plan, base.monthsToFi ?? 0);
  const response: WorkerResponse = { id, sim, levers, ms: performance.now() - started };
  (self as unknown as Worker).postMessage(response);
};
