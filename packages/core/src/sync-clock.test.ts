import { describe, expect, it } from "vitest";
import { compareSyncClocks, nextSyncClock } from "./sync-clock";

describe("sync clocks", () => {
  it("continues increasing when the local clock goes backwards", () => {
    const previous = { milliseconds: 100, counter: 2, deviceId: "a" };
    expect(compareSyncClocks(nextSyncClock(previous, 50), previous)).toBeGreaterThan(0);
  });

  it("orders a local change after an observed remote change", () => {
    const local = { milliseconds: 100, counter: 0, deviceId: "a" };
    const remote = { milliseconds: 200, counter: 4, deviceId: "b" };
    expect(compareSyncClocks(nextSyncClock(local, 150, remote), remote)).toBeGreaterThan(0);
  });

  it("breaks concurrent ties consistently across devices", () => {
    const a = { milliseconds: 100, counter: 0, deviceId: "a" };
    const b = { milliseconds: 100, counter: 0, deviceId: "b" };
    expect(compareSyncClocks(a, b)).toBeLessThan(0);
    expect(compareSyncClocks(b, a)).toBeGreaterThan(0);
  });
});
