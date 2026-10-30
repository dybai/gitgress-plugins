import { describe, expect, it, vi } from 'vitest';
import { BusyIndicator } from '../../../src/views/commits/BusyIndicator';

describe('BusyIndicator', () => {
  it('is idle when constructed', () => {
    expect(new BusyIndicator().getActive()).toBe(false);
  });

  it('becomes active while a handle is held and idle after release', () => {
    const busy = new BusyIndicator();
    const release = busy.acquire();
    expect(busy.getActive()).toBe(true);
    release();
    expect(busy.getActive()).toBe(false);
  });

  it('notifies only on idle-active transitions, not on count changes', () => {
    const busy = new BusyIndicator();
    const listener = vi.fn();
    busy.subscribe(listener);

    const releaseA = busy.acquire();
    const releaseB = busy.acquire();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith(true);

    releaseA();
    expect(listener).toHaveBeenCalledTimes(1);

    releaseB();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenLastCalledWith(false);
  });

  it('keeps the indicator active while any concurrent handle is held', () => {
    const busy = new BusyIndicator();
    const releaseA = busy.acquire();
    const releaseB = busy.acquire();

    releaseA();
    expect(busy.getActive()).toBe(true);

    releaseB();
    expect(busy.getActive()).toBe(false);
  });

  it('treats a double release as a single release', () => {
    const busy = new BusyIndicator();
    const listener = vi.fn();
    busy.subscribe(listener);
    const release = busy.acquire();

    release();
    release();

    expect(busy.getActive()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('stops notifying after unsubscribe', () => {
    const busy = new BusyIndicator();
    const listener = vi.fn();
    const unsubscribe = busy.subscribe(listener);
    unsubscribe();

    busy.acquire()();

    expect(listener).not.toHaveBeenCalled();
  });
});
