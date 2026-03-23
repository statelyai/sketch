import { getRoots, getChildren, getOutEdges, getRelativeDistance, type GraphNode, type GraphEdge } from '@statelyai/graph';
import { useMemo } from 'react';
import { StateNodeViz } from './StateNodeViz';
import { TransitionViz } from './TransitionViz';
import type { StateNodeData, TransitionData, MachineGraph } from '@/lib/machine';

interface MachineVizProps {
  graph: MachineGraph;
}

export function MachineViz({ graph }: MachineVizProps) {
  const roots = getRoots(graph) as GraphNode<StateNodeData>[];
  if (roots.length === 0) return null;

  const root = roots[0];
  const topLevelStates = getChildren(graph, root.id) as GraphNode<StateNodeData>[];
  const rootEdges = getOutEdges(graph, root.id) as GraphEdge<TransitionData>[];

  const sortedStates = useMemo(() => {
    return [...topLevelStates].sort((a, b) => {
      const da = getRelativeDistance(graph, a.id) ?? Infinity;
      const db = getRelativeDistance(graph, b.id) ?? Infinity;
      return da - db;
    });
  }, [topLevelStates, graph]);

  return (
    <div data-testid="machine-root" className="mx-auto max-w-6xl">
      {/* Root key */}
      <h1 data-testid="machine-name" className="text-2xl font-bold tracking-tight text-foreground">
        {root.data.key}
      </h1>

      {/* Root description */}
      {root.data.description && (
        <p data-testid="root-description" className="mt-1 text-sm text-muted-foreground">
          {root.data.description}
        </p>
      )}

      {/* Root transitions */}
      {rootEdges.length > 0 && (
        <div data-testid="root-transitions" className="mt-3 flex flex-col">
          {rootEdges.map((edge, i) => (
            <TransitionViz
              key={edge.id}
              edge={edge}
              graph={graph}
              sourceId={root.id}
              isFirst={i === 0}
            />
          ))}
        </div>
      )}

      {/* Child states */}
      <div className="mt-4 flex flex-wrap items-start gap-2">
        {sortedStates.map((child) => (
          <StateNodeViz
            key={child.id}
            node={child}
            graph={graph}
            isInitial={root.data.initialId === child.id}
          />
        ))}
      </div>
    </div>
  );
}
