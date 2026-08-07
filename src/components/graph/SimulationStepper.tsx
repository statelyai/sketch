/**
 * Step-by-step control for the simulation.
 *
 * Two ways to drive the machine, and they share one trace:
 *
 *   1. Click a transition box on the canvas.
 *   2. Click an event in the "can happen now" list here.
 *
 * Either way the step is appended to the trace below, and because the simulation is event-sourced
 * you can step backwards through it — the snapshot is recomputed from a truncated log rather than
 * inverted, which matters because `assign` actions are not invertible.
 *
 * WHAT THE SIMULATION DOES AND DOES NOT PROVE. Sketch replaces guard implementations with stubs that
 * match on the clicked transition, so every branch is reachable regardless of context. That is the
 * right behaviour for exploring a chart — you can walk the refund path without first constructing a
 * finalized chain observation — but it means a green step here is NOT evidence that the real guard
 * would pass. The banner says so, because a tool that silently implies otherwise is worse than one
 * that cannot simulate at all.
 */
import { useMemo, useState } from 'react';
import { useSelector } from '@xstate/store-react';
import {
  RiPlayLine,
  RiRestartLine,
  RiSkipBackLine,
  RiStopLine,
  RiArrowRightLine,
  RiInformationLine,
  RiBracesLine,
} from '@remixicon/react';
import { getEventCategory, type MachineGraph, type TransitionData } from '@/lib/machine';
import { actorForEvent, ballInCourt, type Actor } from '@/lib/actors';
import { appStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** One event the machine will accept from its current configuration. */
interface Step {
  key: string;
  eventType: string;
  label: string;
  guard: string | null;
  guardPrefix: string;
  actions: string[];
  targetKey: string;
  sourceKey: string;
  /** Who submits it. */
  actor: Actor | null;
}

interface SimulationStepperProps {
  graph: MachineGraph;
  /** Machine id — the key for the declared actor map. */
  machineId?: string;
  /**
   * Starting `input` for the machine, as JSON text.
   *
   * Required by any machine declaring `context: ({ input }) => input` — this one does. Held as text
   * rather than a parsed object so an in-progress edit is not destroyed by a parse failure.
   */
  inputJson: string;
  onInputJsonChange: (next: string) => void;
}

export function SimulationStepper({
  graph,
  machineId,
  inputJson,
  onInputJsonChange,
}: SimulationStepperProps) {
  const mode = useSelector(appStore, (s) => s.context.mode);
  const simEvents = useSelector(appStore, (s) => s.context.simEvents);
  const simActiveIds = useSelector(appStore, (s) => s.context.simActiveIds);
  const simError = useSelector(appStore, (s) => s.context.simError);
  const [inputOpen, setInputOpen] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [composing, setComposing] = useState<{ step: Step; json: string } | null>(null);
  const [composeError, setComposeError] = useState<string | null>(null);
  const isSim = mode === 'sim';

  /** Parse the input box and start. Refuses to start on malformed JSON rather than passing junk. */
  const start = () => {
    const text = inputJson.trim();
    if (!text) {
      setParseError(null);
      appStore.trigger.startSim({ input: undefined });
      return;
    }
    try {
      const parsed = JSON.parse(text) as unknown;
      setParseError(null);
      appStore.trigger.startSim({ input: parsed });
    } catch (e) {
      setParseError(e instanceof Error ? e.message : String(e));
      setInputOpen(true);
    }
  };

  const keyById = useMemo(
    () => new Map(graph.nodes.map((n) => [n.id, n.data.key])),
    [graph],
  );

  /** The events available from the active configuration, in declaration order. */
  const availableSteps = useMemo<Step[]>(() => {
    if (!isSim) return [];
    return graph.edges
      .filter((edge) => simActiveIds.has(edge.sourceId))
      .map((edge) => {
        const data = edge.data as TransitionData;
        const category = getEventCategory(data.eventType);
        return {
          key: edge.id,
          eventType: data.eventType,
          label: data.displayEvent || (category === 'always' ? 'always' : data.eventType),
          guard: data.guard,
          guardPrefix: data.guardPrefix,
          actions: data.actions,
          actor: actorForEvent(machineId, data.eventType),
          sourceKey: keyById.get(edge.sourceId) ?? edge.sourceId,
          targetKey: data.isTargetless
            ? (keyById.get(edge.sourceId) ?? '(self)')
            : (keyById.get(edge.targetId) ?? edge.targetId),
        };
      });
  }, [graph, simActiveIds, isSim, keyById, machineId]);

  /**
   * Whose move it is now.
   *
   * Parties only. If the only things available are a chain observation or a deadline, nobody owes a
   * move — the deal waits on the world, and claiming "seller's turn" there would be false.
   */
  const turn = useMemo(
    () => ballInCourt(availableSteps.map((s) => s.actor)),
    [availableSteps],
  );

  /** Everything sent so far, minus the synthetic init entry, with its actor resolved. */
  const trace = useMemo(
    () =>
      simEvents.slice(1).map((entry) => ({
        ...entry,
        actor: actorForEvent(machineId, entry.event.type),
      })),
    [simEvents, machineId],
  );

  const activeStateKeys = useMemo(() => {
    // Leaf states only — showing every ancestor turns "where am I" into a list.
    const leafIds = [...simActiveIds].filter(
      (id) => !graph.nodes.some((n) => n.parentId === id),
    );
    return leafIds.map((id) => keyById.get(id) ?? id);
  }, [simActiveIds, graph, keyById]);

  /** The bare event for a step: type, plus the guard tag that routes to this specific branch. */
  const bareEvent = (step: Step) => ({
    type: step.eventType,
    ...(step.guard ? { '@xstate.guard': step.guard } : {}),
  });

  /**
   * Send a step.
   *
   * Optimistic: most events carry no payload, so try the bare event first. If an action reaches for a
   * field the bare event does not have, the store reports it rather than throwing — and we open the
   * composer prefilled with that event, so the failure hands the user the thing that fixes it.
   */
  const send = (step: Step) => {
    appStore.trigger.simSend({ event: bareEvent(step) });
    if (appStore.getSnapshot().context.simError) openComposer(step);
  };

  const openComposer = (step: Step) => {
    setComposing({ step, json: JSON.stringify(bareEvent(step), null, 2) });
    setComposeError(null);
  };

  /** Send the composed event verbatim, so payload-carrying events are reachable. */
  const sendComposed = () => {
    if (!composing) return;
    try {
      const parsed = JSON.parse(composing.json) as { type?: string };
      if (!parsed.type) {
        setComposeError('The event needs a "type" field.');
        return;
      }
      appStore.trigger.simSend({ event: parsed as never });
      if (!appStore.getSnapshot().context.simError) setComposing(null);
      setComposeError(null);
    } catch (e) {
      setComposeError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3 text-xs">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-1.5">
        {!isSim ? (
          <>
            <Button size="sm" className="h-7 gap-1.5" onClick={start}>
              <RiPlayLine className="size-3.5" />
              Start simulation
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5"
              onClick={() => setInputOpen((open) => !open)}
            >
              <RiBracesLine className="size-3.5" />
              Input
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5"
              disabled={trace.length === 0}
              onClick={() => appStore.trigger.simRewind({ count: 1 })}
            >
              <RiSkipBackLine className="size-3.5" />
              Step back
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5"
              onClick={() => appStore.trigger.restartSim()}
            >
              <RiRestartLine className="size-3.5" />
              Restart
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5"
              onClick={() => appStore.trigger.stopSim()}
            >
              <RiStopLine className="size-3.5" />
              Exit
            </Button>
          </>
        )}
      </div>

      {(inputOpen || parseError) && (
        <div className="flex flex-col gap-1">
          <label
            htmlFor="sim-input"
            className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Initial input (JSON)
          </label>
          <p className="text-[11px] text-muted-foreground">
            This machine builds its context from <code className="font-mono">input</code>, so it needs
            one. Leave blank for machines that don&apos;t.
          </p>
          <textarea
            id="sim-input"
            value={inputJson}
            onChange={(event) => onInputJsonChange(event.target.value)}
            spellCheck={false}
            rows={10}
            className="w-full resize-y rounded-md border border-border bg-background p-2 font-mono text-[10px] leading-relaxed"
          />
          {parseError && <p className="font-mono text-[10px] text-red-400">{parseError}</p>}
        </div>
      )}

      {simError && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 p-2">
          <p className="font-mono text-[10px] text-red-400">{simError}</p>
        </div>
      )}

      {composing && (
        <div className="flex flex-col gap-1 rounded-md border border-primary/50 bg-primary/5 p-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] font-semibold">{composing.step.label}</span>
            <button
              type="button"
              className="text-[10px] text-muted-foreground underline decoration-dotted hover:text-foreground"
              onClick={() => setComposing(null)}
            >
              cancel
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            This event&apos;s actions read fields the bare event doesn&apos;t carry. Fill them in and
            send.
          </p>
          <textarea
            value={composing.json}
            onChange={(event) =>
              setComposing((current) => (current ? { ...current, json: event.target.value } : current))
            }
            spellCheck={false}
            rows={8}
            className="w-full resize-y rounded-md border border-border bg-background p-2 font-mono text-[10px] leading-relaxed"
          />
          {composeError && <p className="font-mono text-[10px] text-red-400">{composeError}</p>}
          <Button size="sm" className="h-6 w-fit gap-1" onClick={sendComposed}>
            Send event
          </Button>
        </div>
      )}

      {!isSim && (
        <p className="text-muted-foreground">
          Start the simulation to step through the machine. Then click a transition box on the canvas,
          or an event below.
        </p>
      )}

      {isSim && (
        <>
          <div className="flex items-start gap-1.5 rounded-md border border-border/60 bg-muted/20 p-2 text-[11px] text-muted-foreground">
            <RiInformationLine className="mt-px size-3.5 shrink-0" />
            <span>
              Guards are stubbed so every branch is explorable. A step taken here is not proof the
              real guard would pass.
            </span>
          </div>

          {/* Where we are */}
          <div>
            <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Current state
            </h3>
            <div className="flex flex-wrap gap-1">
              {activeStateKeys.length === 0 ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                activeStateKeys.map((key) => (
                  <span
                    key={key}
                    className="rounded-sm border border-primary bg-primary/15 px-1.5 py-0.5 font-mono text-[11px] text-foreground"
                  >
                    {key}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Whose move */}
          <div>
            <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Whose turn
            </h3>
            {turn.waitingOn.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1">
                {turn.waitingOn.map((actor) => (
                  <span
                    key={actor.id}
                    className={cn(
                      'flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-medium',
                      actor.className.bg,
                      actor.className.text,
                    )}
                  >
                    <span className={cn('size-1.5 rounded-full', actor.className.dot)} />
                    {actor.label}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                {availableSteps.length === 0
                  ? 'Nobody — terminal state.'
                  : 'Nobody. Waiting on the chain or a deadline, not on a party.'}
              </p>
            )}
            {turn.nonParty.length > 0 && (
              <p className="mt-1 text-[10px] text-muted-foreground">
                Also possible without a party acting:{' '}
                {turn.nonParty.map((a) => a.label).join(', ')}.
              </p>
            )}
          </div>

          {/* What can happen next */}
          <div>
            <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Can happen now ({availableSteps.length})
            </h3>
            {availableSteps.length === 0 ? (
              <p className="text-muted-foreground">
                Nothing. This is a terminal state — restart to go again.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {availableSteps.map((step) => (
                  <li key={step.key} className="relative">
                    {/* Compose the payload before sending, for events that carry one. */}
                    <button
                      type="button"
                      aria-label={`Edit ${step.label} payload`}
                      title="Edit payload before sending"
                      className="absolute right-1 top-1 z-10 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      onClick={(event) => {
                        event.stopPropagation();
                        openComposer(step);
                      }}
                    >
                      <RiBracesLine className="size-3" />
                    </button>
                    <button
                      type="button"
                      className={cn(
                        'group flex w-full flex-col gap-0.5 rounded-md border border-border/70 bg-card px-2 py-1.5 pr-6 text-left',
                        'transition-colors hover:border-primary hover:bg-primary/10',
                      )}
                      onClick={() => send(step)}
                      onMouseEnter={() => appStore.trigger.highlight({ ids: [step.key] })}
                      onMouseLeave={() => appStore.trigger.unhighlight({ ids: [step.key] })}
                    >
                      <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                        {step.actor && (
                          <span
                            className={cn(
                              'shrink-0 rounded-sm px-1 text-[9px] font-bold tracking-wider',
                              step.actor.className.bg,
                              step.actor.className.text,
                            )}
                            title={step.actor.label}
                          >
                            {step.actor.short}
                          </span>
                        )}
                        <span className="font-mono text-[11px] font-semibold">{step.label}</span>
                        {step.guard && (
                          <>
                            <span className="inline-block size-2 rotate-45 border border-muted-foreground" />
                            {step.guardPrefix && (
                              <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                                {step.guardPrefix}
                              </span>
                            )}
                            <span className="min-w-0 break-all font-mono text-[10px] text-primary">
                              {step.guard}
                            </span>
                          </>
                        )}
                      </span>
                      <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                        {step.sourceKey}
                        <RiArrowRightLine className="size-3" />
                        {step.targetKey}
                        {step.actions.length > 0 && (
                          <span className="ml-1 text-foreground/70">
                            · {step.actions.join(', ')}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Where we've been */}
          <div>
            <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Trace ({trace.length})
            </h3>
            {trace.length === 0 ? (
              <p className="text-muted-foreground">No steps yet.</p>
            ) : (
              <ol className="flex flex-col gap-0.5">
                {trace.map((entry, i) => (
                  <li
                    key={`${i}-${entry.timestamp}`}
                    className="flex items-center gap-2 rounded-sm px-1 py-0.5 font-mono text-[10px]"
                  >
                    <span className="w-4 shrink-0 text-right text-muted-foreground">{i + 1}</span>
                    {entry.actor ? (
                      <span
                        className={cn(
                          'w-14 shrink-0 rounded-sm px-1 text-center text-[9px] font-bold tracking-wider',
                          entry.actor.className.bg,
                          entry.actor.className.text,
                        )}
                        title={entry.actor.label}
                      >
                        {entry.actor.short}
                      </span>
                    ) : (
                      <span className="w-14 shrink-0" />
                    )}
                    <span className="truncate text-foreground">{entry.event.type}</span>
                    {i === trace.length - 1 && (
                      <button
                        type="button"
                        className="ml-auto shrink-0 text-muted-foreground underline decoration-dotted hover:text-foreground"
                        onClick={() => appStore.trigger.simRewind({ count: 1 })}
                      >
                        undo
                      </button>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </>
      )}
    </div>
  );
}
