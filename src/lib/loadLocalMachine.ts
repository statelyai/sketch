/**
 * Load a machine from a real file on disk, with its imports intact.
 *
 * Sketch's built-in parser evaluates a single self-contained string with `new Function()` and strips
 * `xstate` imports. That cannot load a project file: `dataDealMachine.ts` imports `../domain/money.js`
 * and `./guards.js`, and inlining those by hand is how you end up with two copies of your money
 * arithmetic drifting apart.
 *
 * The trick is that Vite is already a module server. `/@fs/<absolute path>` makes it transform any
 * file on disk — TypeScript stripped, relative imports resolved, `xstate` deduped against the copy
 * this app already has — and hand back a real ES module. So the browser gets the ACTUAL machine
 * object, which means:
 *
 *   • guards and actions are the real functions, so simulation exercises real logic;
 *   • `machineToGraph` sees real guard names instead of the string "guard";
 *   • editing the file on disk and reloading shows the change.
 *
 * DEV ONLY, and deliberately so: `/@fs` exists in Vite's dev server, not in a production build, and
 * a hosted app that could read arbitrary paths off its host would be a file-disclosure hole. The
 * import is wrapped so a production build fails loudly rather than silently reading nothing.
 *
 * SAFETY NOTE ON THE MODULE ITSELF: importing a file executes it. That is fine for a machine
 * definition, which is a pure value, but this is not a sandbox — do not point it at a file with side
 * effects you would not run.
 */
import type { AnyStateMachine } from 'xstate';

export interface LoadedMachine {
  /** The export name the machine was found under, e.g. `dataDealMachine`. */
  exportName: string;
  machine: AnyStateMachine;
}

export interface LoadResult {
  machines: LoadedMachine[];
  /** Absolute path that was loaded, echoed back for display. */
  path: string;
  error: string | null;
}

/** Is this value an XState v5 machine? Duck-typed, because instanceof fails across module copies. */
function isStateMachine(value: unknown): value is AnyStateMachine {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.transition === 'function' &&
    typeof candidate.getInitialSnapshot === 'function' &&
    typeof candidate.root === 'object'
  );
}

/**
 * Import an absolute path through Vite and return every machine it exports.
 *
 * `@vite-ignore` is required because the specifier is a runtime value: without it Vite tries to
 * analyse and pre-bundle the import at build time, which cannot work for a path the user types.
 */
export async function loadLocalMachine(path: string): Promise<LoadResult> {
  const trimmed = path.trim();
  if (!trimmed) return { machines: [], path: trimmed, error: 'Enter a file path.' };
  if (!trimmed.startsWith('/')) {
    return { machines: [], path: trimmed, error: 'Use an absolute path, e.g. /Users/you/repo/src/machine.ts' };
  }
  if (!import.meta.env.DEV) {
    return { machines: [], path: trimmed, error: 'Loading local files requires the dev server.' };
  }

  try {
    const loaded: Record<string, unknown> = await import(/* @vite-ignore */ `/@fs${trimmed}`);

    const machines: LoadedMachine[] = [];
    for (const [exportName, value] of Object.entries(loaded)) {
      if (isStateMachine(value)) machines.push({ exportName, machine: value });
    }

    if (machines.length === 0) {
      const names = Object.keys(loaded).join(', ') || 'nothing';
      return {
        machines: [],
        path: trimmed,
        error: `No XState machine exported from this file. Found: ${names}. The machine must be exported (e.g. \`export const myMachine = setup({…}).createMachine({…})\`).`,
      };
    }

    return { machines, path: trimmed, error: null };
  } catch (e) {
    return { machines: [], path: trimmed, error: e instanceof Error ? e.message : String(e) };
  }
}

/** The path this tool was built for, offered as a one-click default. */
export const NEC_DATA_DEAL_PATH =
  '/Users/Qian/kite/passport/nec-data-agent/src/agreement/dataDealMachine.ts';
