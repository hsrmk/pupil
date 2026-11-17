/** A hybrid logical clock makes later observed changes win even if a device's
 * wall clock moves backwards. Device ID breaks ties deterministically. */
export type SyncClock = {
  milliseconds: number;
  counter: number;
  deviceId: string;
};

export function compareSyncClocks(a: SyncClock, b: SyncClock): number {
  if (a.milliseconds !== b.milliseconds) return a.milliseconds < b.milliseconds ? -1 : 1;
  if (a.counter !== b.counter) return a.counter < b.counter ? -1 : 1;
  return a.deviceId < b.deviceId ? -1 : a.deviceId > b.deviceId ? 1 : 0;
}

/** Tick after observing a remote clock, or for a local mutation. */
export function nextSyncClock(local: SyncClock, now: number, remote?: SyncClock): SyncClock {
  const milliseconds = Math.max(now, local.milliseconds, remote?.milliseconds ?? 0);
  let counter = 0;
  if (milliseconds === local.milliseconds && milliseconds === remote?.milliseconds) {
    counter = Math.max(local.counter, remote.counter) + 1;
  } else if (milliseconds === local.milliseconds) {
    counter = local.counter + 1;
  } else if (milliseconds === remote?.milliseconds) {
    counter = remote.counter + 1;
  }
  return { milliseconds, counter, deviceId: local.deviceId };
}
