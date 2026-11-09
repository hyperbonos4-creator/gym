import { randomUUID } from "crypto";

type JobState = "pending" | "claimed" | "done";

type Job = {
  id: string;
  ip: string;
  token: string;
  expiresAt: number;
  state: JobState;
};

const jobs = new Map<string, Job>();
const pending: string[] = [];
const results = new Map<string, (ok: boolean) => void>();

const OPEN_WAIT_MS = 12000;
const CLAIM_MARGIN_MS = 6000;

function dropPending(id: string) {
  const index = pending.indexOf(id);
  if (index >= 0) pending.splice(index, 1);
}

function expireStale(now: number) {
  for (let i = pending.length - 1; i >= 0; i--) {
    const job = jobs.get(pending[i]);
    if (!job || job.state !== "pending" || job.expiresAt - now < CLAIM_MARGIN_MS) {
      pending.splice(i, 1);
      if (job && job.state === "pending") {
        job.state = "done";
        const done = results.get(job.id);
        results.delete(job.id);
        if (done) done(false);
      }
    }
  }
}

/** El computador del gimnasio ya no retira órdenes. Las toma el propio torniquete. */
export function takeJob(waitMs: number): Promise<null> {
  return new Promise((resolve) => setTimeout(() => resolve(null), Math.min(waitMs, 1000)));
}

/** Publica una orden para ese torniquete y espera a que él confirme la secuencia eléctrica. */
export function requestOpen(ip: string, token: string, waitMs = OPEN_WAIT_MS): Promise<boolean> {
  const job: Job = {
    id: randomUUID(),
    ip,
    token,
    expiresAt: Date.now() + waitMs,
    state: "pending",
  };
  jobs.set(job.id, job);
  pending.push(job.id);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (job.state === "done") return;
      job.state = "done";
      dropPending(job.id);
      results.delete(job.id);
      resolve(false);
    }, waitMs);
    results.set(job.id, (ok) => {
      clearTimeout(timer);
      job.state = "done";
      dropPending(job.id);
      results.delete(job.id);
      resolve(ok);
    });
  });
}

/** La toma el ESP32, una sola vez, y solo si todavía le queda tiempo de ejecutarla. */
export function claimFor(token: string): Job | null {
  if (token.length < 8) return null;
  const now = Date.now();
  expireStale(now);
  const index = pending.findIndex((id) => jobs.get(id)?.token === token && jobs.get(id)?.state === "pending");
  if (index < 0) return null;
  const job = jobs.get(pending[index]);
  if (!job || job.expiresAt - now < CLAIM_MARGIN_MS) return null;
  pending.splice(index, 1);
  job.state = "claimed";
  return job;
}

/** La confirmación vale si la envía el torniquete de esa orden. No prueba que el brazo se movió. */
export function finishJob(id: string, ok: boolean, token: string): boolean {
  const job = jobs.get(id);
  if (!job || token.length < 8 || token !== job.token) return false;
  if (job.state === "done") return true;
  job.state = "done";
  dropPending(job.id);
  const done = results.get(id);
  results.delete(id);
  if (done) done(ok);
  return true;
}
