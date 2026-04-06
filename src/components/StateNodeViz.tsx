import {
  getChildren,
  getOutEdges,
  getRelativeDistance,
  type GraphNode,
  type GraphEdge,
} from '@statelyai/graph';
import { useMemo } from 'react';
import { useSelector } from '@xstate/store-react';
import {
  RiCornerDownRightLine,
  RiLayoutColumnLine,
  RiTargetLine,
} from '@remixicon/react';
import { TransitionViz } from './TransitionViz';
import type {
  StateNodeData,
  TransitionData,
  MachineGraph,
} from '@/lib/machine';
import { getEventCategory } from '@/lib/machine';
import { appStore } from '@/lib/store';
import { cn } from '@/lib/utils';

interface StateNodeVizProps {
  node: GraphNode<StateNodeData>;
  graph: MachineGraph;
  isInitial?: boolean;
  isRegion?: boolean;
}

export function StateNodeViz({ node, graph, isInitial, isRegion }: StateNodeVizProps) {
  const children = getChildren(graph, node.id) as GraphNode<StateNodeData>[];
  const outEdges = getOutEdges(graph, node.id) as GraphEdge<TransitionData>[];
  const { data } = node;
  const isHighlighted = useSelector(appStore, (s) =>
    s.context.highlights.has(node.id),
  );
  const isSimActive = useSelector(appStore, (s) =>
    s.context.simActiveIds.has(node.id),
  );

  const isAtomic = data.type === 'atomic' || data.type === null;
  const isFinal = data.type === 'final';
  const isParallel = data.type === 'parallel';
  const isHistory = data.type === 'history';
  const isChoice =
    isAtomic &&
    data.invocations.length === 0 &&
    outEdges.length > 1 &&
    outEdges.every(
      (e) =>
        getEventCategory(e.data.eventType) === 'always' && e.data.guard,
    );

  const sortedChildren = useMemo(() => {
    if (isParallel) return children; // parallel regions don't have ordering
    return [...children].sort((a, b) => {
      const da = getRelativeDistance(graph, a.id) ?? Infinity;
      const db = getRelativeDistance(graph, b.id) ?? Infinity;
      return da - db;
    });
  }, [children, graph, isParallel]);

  return (
    <div
      id={node.id}
      data-state-id={node.id}
      className="flex min-w-40 flex-col text-[0.8125rem]"
    >
      {/* Node card */}
      <div
        data-testid="state-card"
        data-sim-active={isSimActive && (isAtomic || isFinal) ? '' : undefined}
        className={cn(
          'flex flex-col rounded-md border-2 border-border bg-card shadow-sm transition-[border-color,box-shadow,background-color] duration-150',
          isFinal && 'border-double border-[3px]',
          isRegion && 'border-dashed',
          isHighlighted &&
            'border-primary shadow-[0_0_0_1px_var(--color-primary)]',
          isSimActive && (isAtomic || isFinal) && 'border-primary bg-primary/10',
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5">
          <span className="flex items-center gap-1 text-lg font-semibold">
            {isInitial && (
              <RiCornerDownRightLine className="size-3.5 shrink-0 text-muted-foreground" />
            )}
            {isParallel && (
              <RiLayoutColumnLine className="size-3.5 shrink-0 text-muted-foreground" />
            )}
            {isFinal && (
              <RiTargetLine className="size-3.5 shrink-0 text-muted-foreground" />
            )}
            {isChoice && (
              <span className="inline-block size-3 shrink-0 rotate-45 border-2 border-muted-foreground" />
            )}
            {isHistory && (
              <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-sm border border-muted-foreground text-[0.5rem] font-bold leading-none text-muted-foreground">
                {data.historyType === 'deep' ? 'H*' : 'H'}
              </span>
            )}
            {data.key}
          </span>
        </div>

        {/* Description */}
        {data.description && (
          <div data-testid="state-description" className="border-t border-border px-2.5 py-1 text-xs italic text-muted-foreground">
            {data.description}
          </div>
        )}

        {/* Invocations */}
        {data.invocations.length > 0 && (
          <div data-testid="state-invocations" className="flex flex-wrap items-center gap-1 border-t border-border px-2.5 py-1">
            <span className="mr-0.5 text-[0.625rem] font-semibold uppercase tracking-wider text-muted-foreground">
              invoke
            </span>
            {data.invocations.map((inv, i) => (
              <span
                key={i}
                className="rounded-sm bg-muted px-1 font-mono text-[0.6875rem] text-foreground"
              >
                {inv}
              </span>
            ))}
          </div>
        )}

        {/* Entry / Exit actions */}
        {(data.entry.length > 0 || data.exit.length > 0) && (
          <div data-testid="state-actions" className="flex flex-wrap border-t border-border">
            {data.entry.length > 0 && (
              <div data-testid="state-entry" className="flex min-w-0 flex-1 flex-wrap items-center gap-1 px-2.5 py-1">
                <span className="mr-0.5 text-[0.625rem] font-semibold uppercase tracking-wider text-muted-foreground">
                  entry
                </span>
                {data.entry.map((a, i) => (
                  <span
                    key={i}
                    className="rounded-sm bg-muted px-1 font-mono text-[0.6875rem] text-foreground"
                  >
                    {a}
                  </span>
                ))}
              </div>
            )}
            {data.exit.length > 0 && (
              <div
                data-testid="state-exit"
                className={cn(
                  'flex min-w-0 flex-1 flex-wrap items-center gap-1 px-2.5 py-1',
                  data.entry.length > 0 && 'border-l border-border',
                )}
              >
                <span className="mr-0.5 text-[0.625rem] font-semibold uppercase tracking-wider text-muted-foreground">
                  exit
                </span>
                {data.exit.map((a, i) => (
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
        )}

        {/* Child states */}
        {children.length > 0 && (
          <div
            className={cn(
              'gap-2 p-2',
              !isParallel && 'border-t border-border',
              'flex flex-wrap items-start',
              '[&>div>[data-testid=state-card]]:shadow-[0_1px_3px_0_rgba(0,0,0,0.08)]',
            )}
          >
            {sortedChildren.map((child) => (
              <StateNodeViz
                key={child.id}
                node={child}
                graph={graph}
                isInitial={data.initialId === child.id}
                isRegion={isParallel}
              />
            ))}
          </div>
        )}
      </div>

      {/* Transitions — visually outside the card, tree-style connectors */}
      {outEdges.length > 0 && (
        <div className="ml-4">
          {outEdges.map((edge) => (
            <div key={edge.id} className="tree-edge">
              <TransitionViz
                edge={edge}
                graph={graph}
                sourceId={node.id}
                isFirst={false}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
