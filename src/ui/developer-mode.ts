/** Developer mode, interface side (docs/development/developer-mode.md).
 *
 * Core keeps Prefs.DevMode in the player's preferences and DebugSettings.godMode
 * in the running game only (godMode is reset to false when the developer mode is
 * turned off). Elsewhere does the same: the switch is a browser preference,
 * never in a save, off by default; god mode lives for the page's lifetime. The
 * Worker holds the matching session flags (sim/dev-session.ts) and refuses every
 * dev command while they are off, so a player who never turns the mode on sees
 * and can do nothing more. */
export const DEVELOPER_MODE_PREFERENCE_KEY = 'elsewhere.developer-mode.v1';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

export function parseDeveloperMode(raw: string | null): boolean {
  try { const value: unknown = raw === null ? undefined : JSON.parse(raw); return value === true || (typeof value === 'object' && value !== null && (value as { enabled?: unknown }).enabled === true); }
  catch { return false; }
}

export interface DeveloperMode {
  enabled(): boolean;
  god(): boolean;
  /** False when the browser could not keep the choice (it still applies now). */
  setEnabled(enabled: boolean): boolean;
  setGod(god: boolean): void;
  subscribe(listener: () => void): () => void;
}

/** `sync` tells the Worker the current flags (client.setDevMode); it is called
 * at creation, so a restarted Worker learns them again, and at each change. */
export function createDeveloperMode(store: Store | undefined, sync: (enabled: boolean, god: boolean) => void): DeveloperMode {
  let enabled = false, god = false;
  const listeners = new Set<() => void>();
  try { enabled = parseDeveloperMode(store?.getItem(DEVELOPER_MODE_PREFERENCE_KEY) ?? null); } catch { enabled = false; }
  const push = (): void => { try { sync(enabled, god); } catch { /* the Worker is not there yet: the next change or start sends it again */ } for (const listener of [...listeners]) listener(); };
  push();
  return {
    enabled: () => enabled,
    god: () => enabled && god,
    setEnabled(value) {
      enabled = value; if (!value) god = false;
      let kept = true;
      try { store?.setItem(DEVELOPER_MODE_PREFERENCE_KEY, JSON.stringify({ enabled })); } catch { kept = false; }
      push(); return kept;
    },
    setGod(value) { god = enabled && value; push(); },
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}
