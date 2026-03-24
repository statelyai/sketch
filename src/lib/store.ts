import { createStore } from '@xstate/store';
import {
  initialTransition,
  transition,
  type AnyStateMachine,
  type AnyMachineSnapshot,
  type AnyEventObject,
} from 'xstate';
import type { UserData } from './api';
import {
  defaultMachineCode,
  getDefaultMachine,
  machineToGraph,
  parseCode,
  detectFormat,
  type MachineGraph,
  type CodeFormat,
} from './machine';


export interface SimEvent {
  timestamp: number;
  event: AnyEventObject;
}

/**
 * Build a sim-ready machine:
 * - Guard implementations check `event['@xstate.guard'] === guardType`
 *   so clicking a specific guarded transition routes correctly.
 * - Delays are left as-is so xstate.raise actions have real delay values
 *   for our setTimeout-based scheduling.
 */
/**
 * Extract leaf guard names from a guard description string.
 * e.g. "and(canRetry, not(isOverLimit))" → {canRetry, isOverLimit}
 */
function collectLeafGuards(guardStr: string, out: Set<string>): void {
  // Remove composed wrappers: and(...), or(...), not(...)
  const stripped = guardStr
    .replace(/\b(and|or|not)\s*\(/g, '')
    .replace(/[(),\s]/g, ' ');
  for (const token of stripped.split(/\s+/)) {
    if (token && token !== 'and' && token !== 'or' && token !== 'not') {
      out.add(token);
    }
  }
}

/**
 * Check if a leaf guard should return true given the @xstate.guard value.
 * For composed guards, a leaf is "positive" if it's NOT wrapped in not().
 */
function guardMatchesLeaf(guardStr: string, leaf: string): boolean {
  // Check if the leaf appears in the guard string
  if (!guardStr.includes(leaf)) return false;
  // Check if it's wrapped in not() — find all occurrences
  const notPattern = new RegExp(
    `not\\(\\s*${leaf.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\)`,
  );
  const isNegated = notPattern.test(guardStr);
  // If it appears both negated and non-negated, prefer non-negated (edge case)
  const plainPattern = new RegExp(
    `(?<!not\\()\\b${leaf.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
  );
  const isPlain = plainPattern.test(guardStr);
  if (isPlain) return true;
  // Only negated — return false so not(false) = true
  if (isNegated) return false;
  return true;
}

function getSimMachine(
  machine: AnyStateMachine,
  graph: MachineGraph,
): AnyStateMachine {
  const guards: Record<
    string,
    ({ event }: { event: AnyEventObject }) => boolean
  > = {};

  // Collect all leaf guard names used in the graph.
  // Track which leaves appear ONLY on always transitions so they
  // can default to true (always transitions fire automatically).
  const leafGuards = new Set<string>();
  const alwaysLeafGuards = new Set<string>();
  const nonAlwaysLeafGuards = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.data.guard) {
      const leaves = new Set<string>();
      collectLeafGuards(edge.data.guard, leaves);
      for (const l of leaves) {
        leafGuards.add(l);
        if (edge.data.eventType === '(always)') {
          alwaysLeafGuards.add(l);
        } else {
          nonAlwaysLeafGuards.add(l);
        }
      }
    }
  }

  for (const name of leafGuards) {
    // Guards used only on always-transitions default to true,
    // so the first guarded always-branch wins automatically.
    const alwaysOnly =
      alwaysLeafGuards.has(name) && !nonAlwaysLeafGuards.has(name);
    guards[name] = ({ event }: { event: AnyEventObject }) => {
      const g = event['@xstate.guard'] as string | undefined;
      if (!g) return alwaysOnly;
      // Exact match for simple guards
      if (g === name) return true;
      // For composed guards, check if this leaf appears as a
      // positive reference (not wrapped in not())
      return guardMatchesLeaf(g, name);
    };
  }

  const implementations: Record<string, any> = {};
  if (Object.keys(guards).length > 0) implementations.guards = guards;

  if (Object.keys(implementations).length === 0) return machine;
  return machine.provide(implementations);
}

function computeSimSnapshot(
  machine: AnyStateMachine,
  events: SimEvent[],
): AnyMachineSnapshot {
  let [state] = initialTransition(machine);
  for (const { event } of events) {
    const [next] = transition(machine, state, event);
    state = next;
  }
  return state;
}

function getActiveIds(snapshot: AnyMachineSnapshot): Set<string> {
  const nodes: Array<{ id: string }> = (snapshot as any)._nodes ?? [];
  return new Set(nodes.map((n) => n.id));
}

/** Map: scheduled event id → { timeoutId, delay, startTime } for progress display */
const scheduledTimerMeta = new Map<
  string,
  { timeoutId: ReturnType<typeof setTimeout>; delay: number; startTime: number }
>();

function clearAllScheduledTimeouts(): void {
  for (const [, meta] of scheduledTimerMeta) {
    clearTimeout(meta.timeoutId);
  }
  scheduledTimerMeta.clear();
}

/**
 * Progress 0–1 for an active timer, or null if not scheduled.
 * Use in UI with a periodic tick to animate the bar.
 */
export function getActiveTimerProgress(timerId: string): number | null {
  const meta = scheduledTimerMeta.get(timerId);
  if (!meta) return null;
  const elapsed = Date.now() - meta.startTime;
  return Math.min(1, elapsed / meta.delay);
}

type SimAction = { type: string; params?: unknown };
type RaiseParams = { event: AnyEventObject; id: string; delay: number };
type CancelParams = { sendId: string };

/**
 * Process xstate.cancel and xstate.raise actions: cancel clears scheduled
 * timeouts by sendId; raise schedules a timeout to simSend the event after delay.
 * Call from enq.effect() so it runs after the state update.
 */
function applySimActions(actions: SimAction[]): void {
  for (const action of actions) {
    if (action.type === 'xstate.cancel' && action.params) {
      const { sendId } = action.params as CancelParams;
      const meta = scheduledTimerMeta.get(sendId);
      if (meta != null) {
        clearTimeout(meta.timeoutId);
        scheduledTimerMeta.delete(sendId);
      }
    }
  }
  for (const action of actions) {
    if (action.type === 'xstate.raise' && action.params) {
      const { event: raisedEvent, id, delay } = action.params as RaiseParams;
      if (id == null || raisedEvent == null || delay == null) continue;
      const timeoutId = setTimeout(() => {
        scheduledTimerMeta.delete(id);
        appStore.trigger.simSend({ event: raisedEvent });
      }, delay);
      scheduledTimerMeta.set(id, {
        timeoutId,
        delay,
        startTime: Date.now(),
      });
    }
  }
}

/**
 * Compute the set of atomic state IDs that would be active
 * if `event` were sent from the current sim state.
 */
export function getNextSimActiveIds(event: AnyEventObject): Set<string> {
  const ctx = appStore.getSnapshot().context;
  if (!ctx.simMachine || ctx.mode !== 'sim') return new Set();
  const currentSnapshot = computeSimSnapshot(ctx.simMachine, ctx.simEvents);
  const [next] = transition(ctx.simMachine, currentSnapshot, event);
  return getActiveIds(next);
}

/**
 * Get all state node IDs (not just atomic) that would be active
 * after sending an event — used for highlighting on hover.
 */
export function getNextSimAllIds(event: AnyEventObject): Set<string> {
  const ctx = appStore.getSnapshot().context;
  if (!ctx.simMachine || ctx.mode !== 'sim') return new Set();
  const currentSnapshot = computeSimSnapshot(ctx.simMachine, ctx.simEvents);
  const [next] = transition(ctx.simMachine, currentSnapshot, event);
  const nodes: Array<{ id: string }> = (next as any)._nodes ?? [];
  return new Set(nodes.map((n) => n.id));
}

export function getCurrentSimValue(): string | null {
  const ctx = appStore.getSnapshot().context;
  if (!ctx.simMachine || ctx.mode !== 'sim') return null;
  const snapshot = computeSimSnapshot(ctx.simMachine, ctx.simEvents);
  return JSON.stringify(snapshot.value);
}

function getInitialContext() {
  try {
    const machine = getDefaultMachine();
    return {
      code: defaultMachineCode,
      machine: machine as AnyStateMachine | null,
      graph: machineToGraph(machine) as MachineGraph | null,
      error: null as string | null,
    };
  } catch (e) {
    return {
      code: defaultMachineCode,
      machine: null as AnyStateMachine | null,
      graph: null as MachineGraph | null,
      error: String(e) as string | null,
    };
  }
}

const initialCtx = getInitialContext();

function readPref<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v != null ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

export const appStore = createStore({
  context: {
    graph: initialCtx.graph,
    code: initialCtx.code,
    error: initialCtx.error,
    drawerOpen: readPref('sketch:panelOpen', true),
    highlights: new Set<string>(),
    dark: readPref('sketch:dark', true),
    format: 'xstate' as CodeFormat,
    sourceFileId: null as string | null,
    sharing: 'idle' as 'idle' | 'saving' | 'copied' | 'error',
    sketchName: '' as string,
    user: null as UserData | null,
    // UI
    mobileTab: 'viz' as string | number,
    editorTab: 'code' as string | number,
    nameModalOpen: false,
    nameInput: '',
    examplesOpen: false,
    // Simulation
    mode: 'view' as 'view' | 'sim',
    machine: initialCtx.machine,
    simMachine: null as AnyStateMachine | null,
    simEvents: [] as SimEvent[],
    simActiveIds: new Set<string>(),
  },
  on: {
    setGraph: (context, event: { graph: MachineGraph | null }) => ({
      ...context,
      graph: event.graph,
    }),
    setCode: (context, event: { code: string }) => ({
      ...context,
      code: event.code,
    }),
    setError: (context, event: { error: string | null }) => ({
      ...context,
      error: event.error,
    }),
    setDrawerOpen: (context, event: { open: boolean }) => ({
      ...context,
      drawerOpen: event.open,
    }),
    setSourceFileId: (context, event: { id: string | null }) => ({
      ...context,
      sourceFileId: event.id,
    }),
    setSharing: (
      context,
      event: { status: 'idle' | 'saving' | 'copied' | 'error' },
    ) => ({
      ...context,
      sharing: event.status,
    }),
    setFormat: (context, event: { format: CodeFormat }) => ({
      ...context,
      format: event.format,
    }),
    setSketchName: (context, event: { name: string }) => ({
      ...context,
      sketchName: event.name,
    }),
    setUser: (context, event: { user: UserData | null }) => ({
      ...context,
      user: event.user,
    }),
    setMachine: (context, event: { machine: AnyStateMachine }) => ({
      ...context,
      machine: event.machine,
    }),
    sourceFileChanged: (context, event: { code: string; id: string; name: string }) => {
      const format = detectFormat(event.code);
      const result = parseCode(event.code, format);

      const base = {
        ...context,
        mode: 'view' as const,
        simMachine: null,
        simEvents: [] as SimEvent[],
        simActiveIds: new Set<string>(),
        code: event.code,
        format,
        sourceFileId: event.id,
        sketchName: event.name,
      };

      if (result.error) {
        return { ...base, error: result.error };
      }

      if (result.machines.length === 0) {
        return { ...base, machine: null, graph: null, error: 'No machine found in code' };
      }

      try {
        const machine = result.machines[0];
        const graph = machineToGraph(machine);
        return { ...base, machine, graph, error: null };
      } catch (e) {
        return { ...base, machine: null, graph: null, error: e instanceof Error ? e.message : String(e) };
      }
    },
    updateFromCode: (context, event: { code: string }) => {
      const format = detectFormat(event.code);
      const result = parseCode(event.code, format);

      if (result.error) {
        return {
          ...context,
          mode: 'view' as const,
          simMachine: null,
          simEvents: [],
          simActiveIds: new Set<string>(),
          code: event.code,
          format,
          error: result.error,
        };
      }

      if (result.machines.length === 0) {
        return {
          ...context,
          mode: 'view' as const,
          simMachine: null,
          simEvents: [],
          simActiveIds: new Set<string>(),
          code: event.code,
          format,
          machine: null,
          graph: null,
          error: 'No machine found in code',
        };
      }

      try {
        const machine = result.machines[0];
        const graph = machineToGraph(machine);
        return {
          ...context,
          mode: 'view' as const,
          simMachine: null,
          simEvents: [],
          simActiveIds: new Set<string>(),
          code: event.code,
          format,
          machine,
          graph,
          error: null,
        };
      } catch (e) {
        return {
          ...context,
          mode: 'view' as const,
          simMachine: null,
          simEvents: [],
          simActiveIds: new Set<string>(),
          code: event.code,
          format,
          machine: null,
          graph: null,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    },
    setMobileTab: (context, event: { tab: string | number }) => ({
      ...context,
      mobileTab: event.tab,
    }),
    setEditorTab: (context, event: { tab: string | number }) => ({
      ...context,
      editorTab: event.tab,
    }),
    setNameModalOpen: (context, event: { open: boolean }) => ({
      ...context,
      nameModalOpen: event.open,
    }),
    setNameInput: (context, event: { input: string }) => ({
      ...context,
      nameInput: event.input,
    }),
    setExamplesOpen: (context, event: { open: boolean }) => ({
      ...context,
      examplesOpen: event.open,
    }),
    toggleDark: (context) => ({
      ...context,
      dark: !context.dark,
    }),
    highlight: (context, event: { ids: string[] }) => ({
      ...context,
      highlights: new Set([...context.highlights, ...event.ids]),
    }),
    unhighlight: (context, event: { ids: string[] }) => {
      const next = new Set(context.highlights);
      for (const id of event.ids) next.delete(id);
      return { ...context, highlights: next };
    },
    // Simulation
    startSim: (context, _event, enq) => {
      if (!context.machine || !context.graph) return context;
      const simMachine = getSimMachine(context.machine, context.graph);
      const [snapshot, actions] = initialTransition(simMachine);
      if (actions.length > 0 && enq) {
        enq.effect(() => applySimActions(actions as SimAction[]));
      }
      return {
        ...context,
        mode: 'sim' as const,
        simMachine,
        simEvents: [],
        simActiveIds: getActiveIds(snapshot),
      };
    },
    stopSim: (context) => {
      clearAllScheduledTimeouts();
      return {
        ...context,
        mode: 'view' as const,
        simMachine: null,
        simEvents: [],
        simActiveIds: new Set<string>(),
      };
    },
    restartSim: (context) => {
      clearAllScheduledTimeouts();
      if (!context.simMachine) return context;
      const snapshot = computeSimSnapshot(context.simMachine, []);
      return {
        ...context,
        simEvents: [],
        simActiveIds: getActiveIds(snapshot),
      };
    },
    simSend: (context, event: { event: AnyEventObject }, enq) => {
      if (!context.simMachine || context.mode !== 'sim') return context;
      const prevSnapshot = computeSimSnapshot(
        context.simMachine,
        context.simEvents,
      );
      const nextEvents = [
        ...context.simEvents,
        { timestamp: Date.now(), event: event.event },
      ];
      const [nextSnapshot, nextActions] = transition(
        context.simMachine,
        prevSnapshot,
        event.event,
      );
      if (nextActions.length > 0) {
        enq.effect(() => applySimActions(nextActions as SimAction[]));
      }
      return {
        ...context,
        simEvents: nextEvents,
        simActiveIds: getActiveIds(nextSnapshot),
      };
    },
  },
});
