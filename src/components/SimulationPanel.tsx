import { Play } from 'lucide-react';
import { useSelector } from '@xstate/store/react';
import { appStore, computeSimSnapshot } from '@/lib/store';
import { useEffect, useMemo, useRef } from 'react';

function formatInspectableValue(value: unknown): string {
  if (value === undefined) return 'undefined';

  const seen = new WeakSet<object>();
  try {
    const formatted = JSON.stringify(
      value,
      (_key, val) => {
        if (typeof val === 'bigint') return `${val}n`;
        if (typeof val === 'function') {
          return `[Function ${val.name || 'anonymous'}]`;
        }
        if (typeof val === 'symbol') return val.toString();
        if (val && typeof val === 'object') {
          if (seen.has(val)) return '[Circular]';
          seen.add(val);
        }
        return val;
      },
      2,
    );

    return formatted ?? String(value);
  } catch {
    return '[Unserializable]';
  }
}

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
  const machine = useSelector(appStore, (s) => s.context.machine);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inspectionMachine = simMachine ?? machine;

  const eventSnapshots = useMemo(() => {
    if (!simMachine || simEvents.length === 0) return [];
    return simEvents.map((_, index) => {
      const eventsUpToHere = simEvents.slice(0, index + 1);
      const snapshot = computeSimSnapshot(simMachine, eventsUpToHere);
      return {
        value: formatInspectableValue(snapshot.value),
        context: formatInspectableValue(snapshot.context),
      };
    });
  }, [simMachine, simEvents]);

  const currentSnapshot = useMemo(() => {
    if (!inspectionMachine) return null;
    return computeSimSnapshot(
      inspectionMachine,
      simMachine ? simEvents : [],
    );
  }, [inspectionMachine, simMachine, simEvents]);

  const currentState = currentSnapshot
    ? formatInspectableValue(currentSnapshot.value)
    : 'null';
  const currentContext = currentSnapshot
    ? formatInspectableValue(currentSnapshot.context)
    : '{}';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [simEvents.length]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border px-3 py-2">
        <h3 className="text-xs font-medium text-foreground">Simulation</h3>
      </div>
      <div
        data-testid="simulation-inspector"
        className="shrink-0 border-b border-border bg-muted/30 p-3"
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <h4 className="text-[0.6875rem] font-medium uppercase text-muted-foreground">
            State / Context
          </h4>
          <span className="text-[0.625rem] text-muted-foreground">current</span>
        </div>
        <div className="grid gap-2">
          <div>
            <div className="mb-1 text-[0.625rem] font-medium uppercase text-muted-foreground">
              State
            </div>
            <pre
              data-testid="simulation-state"
              className="max-h-24 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-background p-2 font-mono text-[0.6875rem] leading-relaxed text-foreground"
            >
              {currentState}
            </pre>
          </div>
          <div>
            <div className="mb-1 text-[0.625rem] font-medium uppercase text-muted-foreground">
              Context
            </div>
            <pre
              data-testid="simulation-context"
              className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-background p-2 font-mono text-[0.6875rem] leading-relaxed text-foreground"
            >
              {currentContext}
            </pre>
          </div>
        </div>
      </div>
      <div
        data-testid="simulation-events-scroll"
        className="min-h-0 flex-1 overflow-auto"
      >
        {!isSimulating ? (
          <div className="flex min-h-full items-center justify-center px-6 text-center">
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
        ) : simEvents.length === 0 ? (
          <div className="flex min-h-full items-center justify-center px-6 text-center">
            <div>
              <p className="text-sm font-medium text-foreground">
                No simulation events yet
              </p>
              <p className="mt-1 text-[0.75rem] text-muted-foreground">
                Trigger transitions to inspect the event stream.
              </p>
            </div>
          </div>
        ) : (
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
                    {eventSnapshots[index]?.value ?? 'null'}
                  </code>
                </div>
                <details className="mt-1">
                  <summary className="cursor-pointer text-[0.6875rem] text-muted-foreground">
                    context after event
                  </summary>
                  <pre className="mt-1 max-h-36 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/40 p-2 font-mono text-[0.6875rem] leading-relaxed text-foreground">
                    {eventSnapshots[index]?.context ?? '{}'}
                  </pre>
                </details>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  );
}
