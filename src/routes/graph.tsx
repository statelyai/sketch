/**
 * The layered-graph view, over a machine loaded from a real file on disk.
 *
 * A separate route rather than a mode inside `AppLayout`, for two reasons: this clone tracks
 * `statelyai/sketch` upstream, so keeping new work in new files means a future `git pull` conflicts
 * in nothing; and the two views want different chrome — the built-in view is a scrolling document
 * with a code editor, this one is a viewport with a stepper.
 */
import { createFileRoute, Link } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';
import { useSelector } from '@xstate/store-react';
import { RiFolderOpenLine, RiLoader4Line } from '@remixicon/react';
import { GraphCanvas } from '@/components/graph/GraphCanvas';
import { SimulationStepper } from '@/components/graph/SimulationStepper';
import { machineToGraph, type MachineGraph } from '@/lib/machine';
import { loadLocalMachine, NEC_DATA_DEAL_PATH } from '@/lib/loadLocalMachine';
import { appStore } from '@/lib/store';
import type { ActorId } from '@/lib/actors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const Route = createFileRoute('/graph')({
  component: GraphRoute,
});

/**
 * A starting context for the NEC data-deal machine.
 *
 * That machine declares `context: ({ input }) => input`, so it cannot be simulated without one — the
 * first action to touch `context.commands` fails otherwise. These are the same fields
 * `initialContext()` fills in the source repo: the money plane at rest, no commands, no observations.
 *
 * Only a convenience default, matching the convenience default path. Any other machine starts with an
 * empty input and the panel offers a box to paste one.
 */
const NEC_SEED_INPUT = JSON.stringify(
  {
    dealId: 'deal-demo-1',
    chainId: '1337',
    contractAddress: '0xescrow0000000000000000000000000000000001',
    criteriaHash: 'sha256:demo-criteria',
    columns: ['DIABETES', 'BPHIGH'],
    tractCount: 254,
    deliverableRowCount: 1000,
    statsCommitment: 'sha256:demo-stats',
    listAmount: { amount: '3000000', asset: 'USDC', decimals: 6, network: 'eip155:2368' },
    floorAmount: { amount: '2100000', asset: 'USDC', decimals: 6, network: 'eip155:2368' },
    offerRounds: 0,
    money: 'AUTHORIZED',
    commands: [],
    observations: {},
    nextCommandSeq: 1,
  },
  null,
  2,
);

function GraphRoute() {
  const [path, setPath] = useState(NEC_DATA_DEAL_PATH);
  const [graph, setGraph] = useState<MachineGraph | null>(null);
  const [title, setTitle] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ states: number; transitions: number } | null>(null);
  // Seeded for the default target; cleared when another file is loaded, since the seed is
  // specific to this machine's context shape and would be misleading anywhere else.
  const [inputJson, setInputJson] = useState(NEC_SEED_INPUT);
  const [focusedActor, setFocusedActor] = useState<ActorId | null>(null);
  const mode = useSelector(appStore, (s) => s.context.mode);

  const load = useCallback(async (target: string) => {
    setStatus('loading');
    setError(null);
    // Leaving simulation first: the old machine's scheduled timers must not outlive it.
    if (appStore.getSnapshot().context.mode === 'sim') appStore.trigger.stopSim();

    setInputJson(target === NEC_DATA_DEAL_PATH ? NEC_SEED_INPUT : '');
    const result = await loadLocalMachine(target);
    if (result.error || result.machines.length === 0) {
      setStatus('error');
      setError(result.error ?? 'No machine found.');
      return;
    }

    const { machine } = result.machines[0];
    const nextGraph = machineToGraph(machine);
    setGraph(nextGraph);
    setTitle(machine.id);
    setStats({
      states: nextGraph.nodes.filter((n) => n.parentId !== null).length,
      transitions: nextGraph.edges.length,
    });
    // Hand the machine to the shared store so the simulation engine can build its sim machine.
    appStore.trigger.setMachine({ machine });
    appStore.trigger.setGraph({ graph: nextGraph });
    setStatus('idle');
  }, []);

  // Load the default target once on mount.
  useEffect(() => {
    void load(NEC_DATA_DEAL_PATH);
  }, [load]);

  return (
    <main className="flex h-screen min-h-0 flex-col bg-background text-foreground">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border px-3">
        <Link to="/" className="shrink-0 text-sm font-semibold">
          Sketch
        </Link>
        <span className="shrink-0 text-xs text-muted-foreground">Graph</span>

        <form
          className="flex min-w-0 flex-1 items-center gap-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            void load(path);
          }}
        >
          <Input
            value={path}
            onChange={(event) => setPath(event.target.value)}
            spellCheck={false}
            placeholder="/absolute/path/to/machine.ts"
            className="h-7 min-w-0 flex-1 font-mono text-[11px]"
            aria-label="Machine file path"
          />
          <Button type="submit" size="sm" variant="outline" className="h-7 shrink-0 gap-1.5">
            {status === 'loading' ? (
              <RiLoader4Line className="size-3.5 animate-spin" />
            ) : (
              <RiFolderOpenLine className="size-3.5" />
            )}
            Load
          </Button>
        </form>

        {stats && (
          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
            {stats.states} states · {stats.transitions} transitions
          </span>
        )}
      </header>

      {error && (
        <div className="shrink-0 border-b border-red-500/30 bg-red-500/10 px-3 py-2">
          <p className="font-mono text-[11px] text-red-400">{error}</p>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-h-0">
          {graph ? (
            <GraphCanvas
              graph={graph}
              title={title}
              focusedActor={focusedActor}
              onFocusActor={setFocusedActor}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-xs text-muted-foreground">
                {status === 'loading' ? 'Loading machine…' : 'No machine loaded.'}
              </p>
            </div>
          )}
        </section>
        <aside className="min-h-0 border-l border-border">
          {graph ? (
            <SimulationStepper
              graph={graph}
              machineId={title}
              inputJson={inputJson}
              onInputJsonChange={setInputJson}
            />
          ) : (
            <div className="p-3 text-xs text-muted-foreground">Load a machine to simulate it.</div>
          )}
        </aside>
      </div>

      <footer className="flex h-7 shrink-0 items-center gap-3 border-t border-border px-3 font-mono text-[10px] text-muted-foreground">
        <span>{mode === 'sim' ? 'simulating' : 'viewing'}</span>
        <span>drag to pan · ⌘/ctrl + scroll to zoom · scroll to move</span>
      </footer>
    </main>
  );
}
