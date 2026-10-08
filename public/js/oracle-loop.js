// The second orb's scheduler: one generation in flight, a rest between
// completed generations, bounded back-off when one fails, and a set of
// "holds" (the visitor's pause, a hidden tab, another tab owning the stream)
// any one of which keeps it still. Knows nothing about models or the page;
// `think` does the work, so the spec can drive it with a test double.

/**
 * @param {{
 *   think: () => Promise<{ status?: string }>,
 *   interval?: number,
 *   backoff?: number[],
 *   onState?: (state: string, detail?: unknown) => void,
 *   sleep?: (ms: number, signal?: AbortSignal) => Promise<unknown>,
 * }} options
 */
export function createLoop({
  think,
  interval = 4000,
  backoff = [2000, 4000, 8000, 16000, 32000],
  onState = () => {},
  sleep = defaultSleep,
}) {
  const holds = new Set();
  let running = false;
  let stopped = false;
  let failures = 0;
  let inFlight = 0;
  let maxInFlight = 0;
  let wake = null; // aborts the current rest, so a resume doesn't wait out the old interval
  let resumed = null;

  const held = () => holds.size > 0;

  function waitForRelease() {
    return new Promise((done) => (resumed = done));
  }

  async function run() {
    while (!stopped) {
      if (held()) {
        onState("held", [...holds]);
        await waitForRelease();
        continue;
      }
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      let outcome;
      try {
        onState("thinking");
        outcome = await think();
        failures = 0;
      } catch (err) {
        failures++;
        outcome = { error: err };
      } finally {
        inFlight--;
      }
      if (stopped) break;
      if (outcome.error) {
        if (failures > backoff.length) {
          onState("failed", outcome.error);
          stopped = true;
          break;
        }
        onState("retrying", { error: outcome.error, failures, delay: backoff[failures - 1] });
        await rest(backoff[failures - 1]);
        continue;
      }
      onState(outcome.status ?? "rested", outcome);
      await rest(outcome.status === "waiting" ? interval * 2 : interval);
    }
    running = false;
  }

  async function rest(ms) {
    wake = new AbortController();
    try {
      await sleep(ms, wake.signal);
    } catch {
      // woken early
    }
    wake = null;
  }

  return {
    start() {
      if (running || stopped) return;
      running = true;
      run();
    },
    hold(reason) {
      holds.add(reason);
    },
    release(reason) {
      holds.delete(reason);
      if (!held()) {
        resumed?.();
        resumed = null;
      }
    },
    /** Skips the rest of the current wait, e.g. when a new human comment arrives. */
    nudge() {
      wake?.abort();
    },
    stop() {
      stopped = true;
      wake?.abort();
      resumed?.();
    },
    get holds() {
      return [...holds];
    },
    get running() {
      return running;
    },
    get stats() {
      return { inFlight, maxInFlight, failures };
    },
  };
}

function defaultSleep(ms, signal) {
  return new Promise((done, fail) => {
    const id = setTimeout(done, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(id);
      fail(new Error("woken"));
    });
  });
}
