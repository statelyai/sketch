/**
 * The pan/zoom canvas that hosts the layered graph.
 *
 * Sketch's own view is a scrolling document; a routed graph needs a viewport instead, because the
 * useful gestures are "show me everything" and "get closer to this corner". Layout runs off the main
 * render path (ELK is async), so the canvas holds the result in state and re-runs only when the graph
 * identity changes — not on every simulation step, which would re-lay-out the world on each click.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from '@xstate/store-react';
import { RiAddLine, RiSubtractLine, RiFocus3Line } from '@remixicon/react';
import { layoutMachine, type Layout } from '@/lib/layout';
import type { MachineGraph } from '@/lib/machine';
import { actorForEvent, ballInCourt, type Actor, type ActorId } from '@/lib/actors';
import { appStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { StateNode } from './StateNode';
import { TransitionNode } from './TransitionNode';
import { EdgeLayer } from './EdgeLayer';
import { Button } from '@/components/ui/button';

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 2.5;
const FIT_PADDING = 48;

interface GraphCanvasProps {
  graph: MachineGraph;
  /** Machine id: the frame label, and the key for the declared actor map. */
  title?: string;
  /** Dim everything that is not this actor's move. */
  focusedActor: ActorId | null;
  onFocusActor: (actor: ActorId | null) => void;
}

export function GraphCanvas({ graph, title, focusedActor, onFocusActor }: GraphCanvasProps) {
  const [layout, setLayout] = useState<Layout | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const panState = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);

  const mode = useSelector(appStore, (s) => s.context.mode);
  const simActiveIds = useSelector(appStore, (s) => s.context.simActiveIds);
  const highlights = useSelector(appStore, (s) => s.context.highlights);
  const isSim = mode === 'sim';

  // ── Layout, re-run only when the graph itself changes ────────────────────
  useEffect(() => {
    let cancelled = false;
    setError(null);
    layoutMachine(graph, {
      actorLabelOf: (eventType) => actorForEvent(title, eventType)?.short ?? null,
    })
      .then((result) => {
        if (!cancelled) setLayout(result);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [graph, title]);

  const fit = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || !layout || layout.width === 0) return;
    const { clientWidth, clientHeight } = viewport;
    const scale = Math.min(
      (clientWidth - FIT_PADDING * 2) / layout.width,
      (clientHeight - FIT_PADDING * 2) / layout.height,
      MAX_ZOOM,
    );
    const clamped = Math.max(MIN_ZOOM, scale);
    setTransform({
      x: (clientWidth - layout.width * clamped) / 2,
      y: (clientHeight - layout.height * clamped) / 2,
      scale: clamped,
    });
  }, [layout]);

  // Fit once per layout.
  useEffect(() => {
    fit();
  }, [fit]);

  const zoomBy = (factor: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const { clientWidth, clientHeight } = viewport;
    setTransform((current) => {
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current.scale * factor));
      const ratio = next / current.scale;
      // Zoom about the viewport centre so the thing being looked at stays put.
      return {
        scale: next,
        x: clientWidth / 2 - (clientWidth / 2 - current.x) * ratio,
        y: clientHeight / 2 - (clientHeight / 2 - current.y) * ratio,
      };
    });
  };

  const onWheel = (event: React.WheelEvent) => {
    event.preventDefault();
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;

    setTransform((current) => {
      // Trackpad pinch arrives as ctrlKey+wheel; a plain wheel pans vertically unless zooming.
      if (!event.ctrlKey && !event.metaKey) {
        return { ...current, x: current.x - event.deltaX, y: current.y - event.deltaY };
      }
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current.scale * (1 - event.deltaY * 0.01)));
      const ratio = next / current.scale;
      // Zoom about the cursor: the graph point under the pointer must not move.
      return {
        scale: next,
        x: pointerX - (pointerX - current.x) * ratio,
        y: pointerY - (pointerY - current.y) * ratio,
      };
    });
  };

  const onPointerDown = (event: React.PointerEvent) => {
    // Only drag from empty canvas, so clicking a transition box still sends its event.
    if ((event.target as HTMLElement).closest('[data-transition-id]')) return;
    panState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: transform.x,
      originY: transform.y,
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const pan = panState.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    setTransform((current) => ({
      ...current,
      x: pan.originX + (event.clientX - pan.startX),
      y: pan.originY + (event.clientY - pan.startY),
    }));
  };

  const endPan = (event: React.PointerEvent) => {
    if (panState.current?.pointerId === event.pointerId) panState.current = null;
  };

  /**
   * Which transitions could fire right now.
   *
   * A transition is enabled when its source state is in the active configuration. That is the
   * FSM's own answer, not a guess: `simActiveIds` comes from the running actor's snapshot.
   */
  const enabledTransitionIds = useMemo(() => {
    const enabled = new Set<string>();
    if (!layout) return enabled;
    for (const node of layout.nodes) {
      if (node.kind === 'transition' && simActiveIds.has(node.sourceId)) enabled.add(node.id);
    }
    return enabled;
  }, [layout, simActiveIds]);

  /** Which parties owe a move from each state. */
  const waitingByState = useMemo(() => {
    const byState = new Map<string, Actor[]>();
    for (const node of graph.nodes) {
      const outgoing = graph.edges.filter((e) => e.sourceId === node.id);
      const { waitingOn } = ballInCourt(outgoing.map((e) => actorForEvent(title, e.data.eventType)));
      byState.set(node.id, waitingOn);
    }
    return byState;
  }, [graph, title]);

  /** Actors that actually appear in this machine, for the legend. */
  const presentActors = useMemo(() => {
    const seen = new Map<ActorId, Actor>();
    for (const edge of graph.edges) {
      const actor = actorForEvent(title, edge.data.eventType);
      if (actor) seen.set(actor.id, actor);
    }
    return [...seen.values()];
  }, [graph, title]);

  const emphasisedEdges = useMemo(() => {
    const ids = new Set<string>();
    if (!layout) return ids;
    for (const node of layout.nodes) {
      if (node.kind !== 'transition') continue;
      if (highlights.has(node.id)) ids.add(node.id);
      else if (isSim && enabledTransitionIds.has(node.id)) ids.add(node.id);
    }
    return ids;
  }, [layout, highlights, isSim, enabledTransitionIds]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="max-w-lg font-mono text-xs text-red-500">Layout failed: {error}</p>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden">
      <div
        ref={viewportRef}
        data-testid="graph-viewport"
        className={cn(
          'h-full w-full touch-none select-none',
          panState.current ? 'cursor-grabbing' : 'cursor-grab',
          // The faint grid that gives the canvas depth without competing with the graph.
          '[background-image:radial-gradient(var(--color-border)_1px,transparent_1px)] [background-size:24px_24px]',
        )}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
      >
        {layout && (
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
              width: layout.width,
              height: layout.height,
            }}
          >
            {/* The machine frame, with its id in a bar along the top edge. */}
            <div className="absolute inset-0 rounded-lg border border-border/50" aria-hidden />
            {title && (
              <div className="absolute left-0 top-0 flex h-6 w-full items-center rounded-t-lg bg-muted/30 px-2">
                <span className="font-mono text-[10px] font-semibold tracking-wide text-muted-foreground">
                  {title}
                </span>
              </div>
            )}

            <EdgeLayer
              edges={layout.edges}
              width={layout.width}
              height={layout.height}
              emphasised={emphasisedEdges}
              dimUnemphasised={isSim}
            />

            {layout.nodes.map((node) =>
              node.kind === 'state' ? (
                <StateNode
                  key={node.id}
                  node={node}
                  isActive={simActiveIds.has(node.id)}
                  waitingOn={waitingByState.get(node.id) ?? []}
                />
              ) : (
                <TransitionNode
                  key={node.id}
                  node={node}
                  isEnabled={!isSim || enabledTransitionIds.has(node.id)}
                  actor={actorForEvent(title, node.data.eventType)}
                  focusedActor={focusedActor}
                />
              ),
            )}
          </div>
        )}

        {!layout && (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-muted-foreground">Laying out…</p>
          </div>
        )}
      </div>

      {/* Viewport controls */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1 rounded-md border border-border bg-card/90 p-1 backdrop-blur">
        <Button variant="ghost" size="icon" className="size-7" onClick={() => zoomBy(1.2)} aria-label="Zoom in">
          <RiAddLine className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" className="size-7" onClick={() => zoomBy(1 / 1.2)} aria-label="Zoom out">
          <RiSubtractLine className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" className="size-7" onClick={fit} aria-label="Fit to view">
          <RiFocus3Line className="size-4" />
        </Button>
      </div>

      {/* Actor legend. Click one to isolate that party's moves. */}
      {presentActors.length > 0 && (
        <div className="absolute left-3 top-3 flex flex-col gap-0.5 rounded-md border border-border bg-card/90 p-1.5 backdrop-blur">
          <span className="mb-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            Who acts
          </span>
          {presentActors.map((actor) => (
            <button
              key={actor.id}
              type="button"
              onClick={() => onFocusActor(focusedActor === actor.id ? null : actor.id)}
              className={cn(
                'flex items-center gap-1.5 rounded px-1 py-0.5 text-left text-[10px] transition-colors hover:bg-muted',
                focusedActor === actor.id && 'bg-muted',
                focusedActor !== null && focusedActor !== actor.id && 'opacity-45',
              )}
            >
              <span className={cn('size-2 shrink-0 rounded-full', actor.className.dot)} />
              <span className={cn('font-medium', actor.className.text)}>{actor.label}</span>
              {!actor.isParty && (
                <span className="text-[9px] text-muted-foreground">· not a party</span>
              )}
            </button>
          ))}
          {focusedActor && (
            <button
              type="button"
              onClick={() => onFocusActor(null)}
              className="mt-0.5 text-left text-[9px] text-muted-foreground underline decoration-dotted hover:text-foreground"
            >
              clear focus
            </button>
          )}
        </div>
      )}

      <div className="pointer-events-none absolute bottom-3 left-3 font-mono text-[10px] text-muted-foreground">
        {Math.round(transform.scale * 100)}%
      </div>
    </div>
  );
}
