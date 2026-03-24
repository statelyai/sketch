import type { GraphEdge } from '@statelyai/graph';
import { useSelector } from '@xstate/store-react';
import {
  RiTimerLine,
  RiInfinityLine,
  RiCheckboxCircleFill,
  RiCloseCircleFill,
} from '@remixicon/react';
import type { TransitionData, MachineGraph } from '@/lib/machine';
import { getRelativeTarget, getEventCategory } from '@/lib/machine';
import {
  appStore,
  getNextSimAllIds,
  getActiveTimerProgress,
} from '@/lib/store';
import { cn } from '@/lib/utils';
import { useRef } from 'react';
import { useTick } from '@/lib/useTick';

interface TransitionVizProps {
  edge: GraphEdge<TransitionData>;
  graph: MachineGraph;
  sourceId: string;
  isFirst?: boolean;
}

export function TransitionViz({
  edge,
  graph,
  sourceId,
  isFirst,
}: TransitionVizProps) {
  const { data } = edge;
  const mode = useSelector(appStore, (s) => s.context.mode);
  const isSim = mode === 'sim';
  const isActive = useSelector(appStore, (s) =>
    s.context.simActiveIds.has(sourceId),
  );
  const targetDisplay = data.isTargetless
    ? null
    : getRelativeTarget(sourceId, edge.targetId, graph);

  const prefix = data.guardPrefix;
  const eventCategory = getEventCategory(data.eventType);
  const highlightedIdsRef = useRef<string[]>([]);

  // Tick to animate progress bar for active after-timers
  useTick(isSim && eventCategory === 'after');

  const timerProgress =
    isSim && eventCategory === 'after'
      ? getActiveTimerProgress(data.eventType)
      : null;

  const simEvent = {
    type: data.eventType,
    ...(data.guard ? { '@xstate.guard': data.guard } : {}),
  };

  return (
    <div
      data-testid="transition"
      className={cn(
        'relative flex flex-col gap-0.5 px-2.5 py-1.5 text-xs transition-colors hover:bg-primary/5',
        !isFirst && 'border-t border-dashed border-border',
        isSim && 'cursor-pointer hover:bg-primary/10',
        isSim && !isActive && 'opacity-40',
      )}
      onClick={() => {
        if (isSim && data.eventType && eventCategory !== 'always') {
          appStore.trigger.simSend({ event: simEvent });
        }
      }}
      onMouseEnter={() => {
        if (isSim) {
          // Highlight what would become active if this event were sent
          const nextIds = [...getNextSimAllIds(simEvent)];
          highlightedIdsRef.current = nextIds;
          if (nextIds.length > 0) {
            appStore.trigger.highlight({ ids: nextIds });
          }
        } else if (!data.isTargetless) {
          highlightedIdsRef.current = [edge.targetId];
          appStore.trigger.highlight({ ids: [edge.targetId] });
        }
      }}
      onMouseLeave={() => {
        if (highlightedIdsRef.current.length > 0) {
          appStore.trigger.unhighlight({ ids: highlightedIdsRef.current });
          highlightedIdsRef.current = [];
        }
      }}
    >
      {/* Progress bar for active after-timers */}
      {timerProgress !== null && (
        <div
          data-testid="timer-progress"
          className="pointer-events-none absolute inset-0 rounded-sm"
          aria-hidden
          style={{
            background: `linear-gradient(to right, rgba(59, 130, 246, 0.5) 0%, rgba(59, 130, 246, 0.5) ${timerProgress * 100}%, transparent ${timerProgress * 100}%)`,
          }}
        />
      )}

      {data.guard && prefix && (
        <div className="flex items-center gap-1 text-[0.6875rem]">
          <span className="font-semibold italic text-muted-foreground">
            {prefix}
          </span>
          <span className="font-mono text-primary">{data.guard}</span>
        </div>
      )}
      {data.guard && !prefix && (
        <div className="flex items-center gap-1 text-[0.6875rem]">
          <span className="font-mono text-primary">{data.guard}</span>
        </div>
      )}
      {!data.guard && prefix === 'else' && (
        <div className="flex items-center gap-1 text-[0.6875rem]">
          <span className="font-semibold italic text-muted-foreground">
            else
          </span>
        </div>
      )}

      <div className="flex items-center gap-1.5">
        {eventCategory === 'after' && (
          <RiTimerLine className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        {eventCategory === 'always' && (
          <RiInfinityLine className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        {eventCategory === 'done' && (
          <RiCheckboxCircleFill className="size-3.5 shrink-0 text-green-500" />
        )}
        {eventCategory === 'error' && (
          <RiCloseCircleFill className="size-3.5 shrink-0 text-red-500" />
        )}
        {data.displayEvent && (
          <span data-testid="transition-event" className="font-mono text-xs font-semibold">
            {data.displayEvent}
          </span>
        )}
        {targetDisplay && (
          <>
            <span className="text-muted-foreground">&rarr;</span>
            {isSim ? (
              <span className="font-mono text-xs text-primary">
                {targetDisplay}
              </span>
            ) : (
              <a
                href={`#${edge.targetId}`}
                className="font-mono text-xs text-primary underline decoration-primary/30 hover:decoration-primary"
                onClick={(e) => e.stopPropagation()}
              >
                {targetDisplay}
              </a>
            )}
          </>
        )}
      </div>

      {data.description && (
        <div className="text-[0.6875rem] italic text-muted-foreground">
          {data.description}
        </div>
      )}

      {data.actions.length > 0 && (
        <div data-testid="transition-actions" className="flex flex-wrap gap-1">
          {data.actions.map((a, i) => (
            <span
              key={i}
              className="rounded-sm bg-muted px-1 font-mono text-[0.6875rem] text-foreground"
            >
              {a}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
