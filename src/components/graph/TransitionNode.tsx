/**
 * A transition, drawn as its own box.
 *
 * The box is the unit a user actually reasons about: "on DELIVERY_ATTESTED, if
 * attestationMatchesCommitment, do recordDelivery". Putting that on an edge label would be
 * unreadable, so it becomes a node with a header row (event + guard) and one row per action.
 *
 * In simulation mode the box is also the control: clicking it sends the event, and it dims when the
 * event is not currently enabled — so the picture doubles as the keyboard for driving the machine.
 */
import { useSelector } from '@xstate/store-react';
import {
  RiTimerLine,
  RiInfinityLine,
  RiCheckboxCircleFill,
  RiCloseCircleFill,
} from '@remixicon/react';
import type { LaidOutTransition } from '@/lib/layout';
import type { Actor, ActorId } from '@/lib/actors';
import { getEventCategory } from '@/lib/machine';
import { appStore, getNextSimAllIds } from '@/lib/store';
import { cn } from '@/lib/utils';
import { useRef } from 'react';

/** The four-point star that marks an action. Matches the guard diamond's visual weight. */
function ActionGlyph() {
  return (
    <svg viewBox="0 0 12 12" className="size-3 shrink-0 text-muted-foreground" aria-hidden>
      <path
        d="M6 0.5 L7.1 4.9 L11.5 6 L7.1 7.1 L6 11.5 L4.9 7.1 L0.5 6 L4.9 4.9 Z"
        fill="currentColor"
      />
    </svg>
  );
}

interface TransitionNodeProps {
  node: LaidOutTransition;
  /** True when the source state is active, so this event could fire right now. */
  isEnabled: boolean;
  /** Who submits this event. `null` when nothing in the model attributes it. */
  actor: Actor | null;
  /** When set, transitions belonging to other actors are dimmed. */
  focusedActor: ActorId | null;
}

export function TransitionNode({ node, isEnabled, actor, focusedActor }: TransitionNodeProps) {
  const { data } = node;
  const mode = useSelector(appStore, (s) => s.context.mode);
  const isSim = mode === 'sim';
  const isHighlighted = useSelector(appStore, (s) => s.context.highlights.has(node.id));
  const highlightedRef = useRef<string[]>([]);

  const category = getEventCategory(data.eventType);
  const eventLabel = data.displayEvent || (category === 'always' ? 'always' : data.eventType);

  const simEvent = {
    type: data.eventType,
    ...(data.guard ? { '@xstate.guard': data.guard } : {}),
  };

  const clickable = isSim && isEnabled && category !== 'always';
  // Actor focus dims everything that is not this actor's move, so one party's obligations can be
  // read off the chart at a glance.
  const outOfFocus = focusedActor !== null && actor?.id !== focusedActor;

  return (
    <div
      data-testid="transition-node"
      data-transition-id={node.id}
      style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
      className={cn(
        'absolute flex flex-col justify-center gap-0.5 rounded-md border bg-card/80 px-2 py-1 backdrop-blur-sm transition-[border-color,opacity,background-color] duration-150',
        'border-border/80 shadow-[0_1px_2px_rgba(0,0,0,0.3)]',
        // A 3px stripe in the actor's colour: readable even when zoomed out past the label.
        actor && `border-l-[3px] ${actor.className.border}`,
        isHighlighted && 'border-primary',
        isSim && !isEnabled && 'opacity-35',
        outOfFocus && 'opacity-20',
        clickable && 'cursor-pointer hover:border-primary hover:bg-primary/10',
      )}
      onClick={() => {
        if (clickable) appStore.trigger.simSend({ event: simEvent });
      }}
      onMouseEnter={() => {
        // Preview: light up whatever this event would make active.
        const ids = isSim && isEnabled ? [...getNextSimAllIds(simEvent)] : [node.targetId];
        highlightedRef.current = ids;
        if (ids.length > 0) appStore.trigger.highlight({ ids });
      }}
      onMouseLeave={() => {
        if (highlightedRef.current.length > 0) {
          appStore.trigger.unhighlight({ ids: highlightedRef.current });
          highlightedRef.current = [];
        }
      }}
    >
      {/* Header: event, then the guard that gates it */}
      <div className="flex items-center gap-1 leading-none">
        {category === 'after' && <RiTimerLine className="size-3 shrink-0 text-muted-foreground" />}
        {category === 'always' && <RiInfinityLine className="size-3 shrink-0 text-muted-foreground" />}
        {category === 'done' && <RiCheckboxCircleFill className="size-3 shrink-0 text-green-500" />}
        {category === 'error' && <RiCloseCircleFill className="size-3 shrink-0 text-red-500" />}

        {actor && (
          <span
            className={cn(
              'shrink-0 rounded-sm px-1 text-[9px] font-bold tracking-wider',
              actor.className.bg,
              actor.className.text,
            )}
            title={actor.label}
          >
            {actor.short}
          </span>
        )}

        <span className="font-mono text-[10px] font-semibold tracking-wide text-foreground">
          {eventLabel}
        </span>

        {(data.guard || data.guardPrefix) && (
          <span className="ml-1 flex items-center gap-1 leading-none">
            <span
              className="inline-block size-2 shrink-0 rotate-45 border border-muted-foreground"
              aria-hidden
            />
            {data.guardPrefix && (
              <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                {data.guardPrefix}
              </span>
            )}
            {data.guard && (
              <span className="font-mono text-[10px] text-primary">{data.guard}</span>
            )}
          </span>
        )}
      </div>

      {data.description && (
        <div className="truncate text-[9px] italic text-muted-foreground">{data.description}</div>
      )}

      {/* One row per action */}
      {data.actions.map((action, i) => (
        <div key={i} className="flex items-center gap-1 leading-none">
          <ActionGlyph />
          <span className="font-mono text-[10px] text-foreground/90">{action}</span>
        </div>
      ))}
    </div>
  );
}
