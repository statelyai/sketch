/**
 * A state, drawn as a box.
 *
 * Deliberately spare: in a layered graph the state is a waypoint, and the detail that matters
 * (events, guards, actions) lives in the transition boxes between them. A compound state renders as
 * a labelled container that ELK has already sized around its children.
 */
import { useSelector } from '@xstate/store-react';
import { RiLayoutColumnLine, RiStopCircleLine } from '@remixicon/react';
import type { LaidOutState } from '@/lib/layout';
import { appStore } from '@/lib/store';
import { cn } from '@/lib/utils';

interface StateNodeProps {
  node: LaidOutState;
  /** True when this state is part of the simulated active configuration. */
  isActive: boolean;
}

export function StateNode({ node, isActive }: StateNodeProps) {
  const { data } = node;
  const isHighlighted = useSelector(appStore, (s) => s.context.highlights.has(node.id));

  const isCompound = data.type === 'compound' || data.type === 'parallel';
  const isFinal = data.type === 'final';

  return (
    <div
      data-testid="state-node"
      data-state-id={node.id}
      data-active={isActive ? '' : undefined}
      style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
      className={cn(
        'absolute rounded-md border transition-[border-color,background-color,box-shadow] duration-150',
        isCompound
          ? 'border-border/60 bg-muted/10'
          : 'border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.35)]',
        isFinal && 'border-double border-[3px]',
        isHighlighted && 'border-primary',
        isActive && 'border-primary bg-primary/15 shadow-[0_0_0_1px_var(--color-primary)]',
      )}
    >
      {/* The initial-state marker: a filled dot with a stub arrow into the box. */}
      {node.isInitial && (
        <span
          className="absolute -left-[18px] top-1/2 flex -translate-y-1/2 items-center"
          aria-label="initial state"
        >
          <span className="size-1.5 rounded-full bg-foreground" />
          <span className="h-px w-3 bg-foreground/60" />
        </span>
      )}

      <div
        className={cn(
          'flex items-center gap-1 px-2 leading-none',
          // A compound state labels its top edge; a leaf centres its label.
          isCompound ? 'h-6 pt-1' : 'h-full',
        )}
      >
        {data.type === 'parallel' && (
          <RiLayoutColumnLine className="size-3 shrink-0 text-muted-foreground" />
        )}
        {isFinal && <RiStopCircleLine className="size-3 shrink-0 text-muted-foreground" />}
        {data.type === 'history' && (
          <span className="inline-flex size-3.5 shrink-0 items-center justify-center rounded-sm border border-muted-foreground text-[7px] font-bold text-muted-foreground">
            {data.historyType === 'deep' ? 'H*' : 'H'}
          </span>
        )}
        <span
          className={cn(
            'truncate font-medium',
            isCompound ? 'text-[10px] uppercase tracking-wider text-muted-foreground' : 'text-[11px] text-foreground',
          )}
        >
          {data.key}
        </span>
      </div>
    </div>
  );
}
