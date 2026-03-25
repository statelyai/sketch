import { Play } from 'lucide-react';
import { useSelector } from '@xstate/store/react';
import { appStore, computeSimSnapshot } from '@/lib/store';
import { useEffect, useMemo, useRef } from 'react';

function formatEventType(type: string): string {
  // "xstate.after.2000.trafficLight.yellow" → "after 2000ms"
  const afterMatch = type.match(/^xstate\.after\.(\d+)/);
  if (afterMatch) return `after ${afterMatch[1]}ms`;

  // "xstate.done.state.foo" → "done (foo)"
  const doneMatch = type.match(/^xstate\.done\.state\.(.+)/);
  if (doneMatch) return `done (${doneMatch[1]})`;

  // Strip "xstate." prefix for other internal events
  if (type.startsWith('xstate.')) return type.slice(7);

  return type;
}

export function SimulationPanel() {
  const isSimulating = useSelector(appStore, (s) => s.context.mode === 'sim');
  const simEvents = useSelector(appStore, (s) => s.context.simEvents);
  const simMachine = useSelector(appStore, (s) => s.context.simMachine);
  const bottomRef = useRef<HTMLDivElement>(null);

  const eventStates = useMemo(() => {
    if (!simMachine || simEvents.length === 0) return [];
    return simEvents.map((_, index) => {
      const eventsUpToHere = simEvents.slice(0, index + 1);
      const snapshot = computeSimSnapshot(simMachine, eventsUpToHere);
      return JSON.stringify(snapshot.value);
    });
  }, [simMachine, simEvents]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [simEvents.length]);

  if (!isSimulating) {
    return (
      <div className="flex min-h-full flex-col">
        <div className="border-b border-border px-3 py-2">
          <h3 className="text-xs font-medium text-foreground">Event History</h3>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 text-center">
          <div>
            <button
              type="button"
              onClick={() => appStore.trigger.startSim()}
              className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              aria-label="Start simulation from panel"
            >
              <Play size={14} />
              Start simulation
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (simEvents.length === 0) {
    return (
      <div className="flex min-h-full flex-col">
        <div className="border-b border-border px-3 py-2">
          <h3 className="text-xs font-medium text-foreground">Event History</h3>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 text-center">
          <div>
            <p className="text-sm font-medium text-foreground">
              No simulation events yet
            </p>
            <p className="mt-1 text-[0.75rem] text-muted-foreground">
              Start simulation and trigger transitions to inspect the event stream.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="border-b border-border px-3 py-2">
        <h3 className="text-xs font-medium text-foreground">Event History</h3>
      </div>
      <div data-testid="simulation-event-list" className="flex flex-col gap-2 p-3">
        {simEvents.map((simEvent, index) => (
          <div
            key={`${simEvent.timestamp}-${index}`}
            className="rounded-md border border-border bg-background px-3 py-2"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-foreground">
                {formatEventType(simEvent.event.type)}
              </span>
              <span className="text-[0.625rem] text-muted-foreground">
                {new Date(simEvent.timestamp).toLocaleTimeString([], {
                  hour: 'numeric',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            </div>
            <div className="mt-1 text-[0.6875rem] text-muted-foreground">
              value:{' '}
              <code className="font-mono text-[0.6875rem] text-foreground">
                {eventStates[index] ?? 'null'}
              </code>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
