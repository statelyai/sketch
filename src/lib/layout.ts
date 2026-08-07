/**
 * ════════════════════════════════════════════════════════════════════════════
 * LAYERED LAYOUT — states and transitions as peer nodes, with routed edges
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Sketch's own renderer is deliberately layout-free: it nests state cards with flex-wrap and lists
 * transitions as tree rows that link to their target by name. That is compact and responsive, but it
 * never draws the graph — you cannot see a cycle, and you cannot see that four different states all
 * refund into one place.
 *
 * This module produces the other kind of picture: a top-down layered graph where a TRANSITION IS A
 * NODE. That modelling choice is the whole trick. A transition carries an event name, an optional
 * guard and a list of actions — far too much to sit on an edge label — so instead each transition
 * becomes its own box and the edge is split in two:
 *
 *     [source state] ──▶ [EVENT · guard · actions] ──▶ [target state]
 *
 * ELK then lays out states and transition boxes together and routes every edge orthogonally, which
 * is what makes the result readable at 26 transitions.
 *
 * HIERARCHY. A transition box is placed inside the LOWEST COMMON ANCESTOR of its source and target,
 * not inside the source. Put it in the source and any transition leaving a compound state drags its
 * box inside that state's border, which is both wrong and ugly. For a flat machine the LCA is always
 * the root; for a nested one (sketch's own traffic-light example) this is what keeps a transition out
 * of a box it does not belong to.
 *
 * SIZING. Node sizes are estimated from text metrics rather than measured from the DOM. A measure
 * pass would be exact but needs two renders and a layout thrash; the estimator below is tuned to the
 * actual type scale used by the node components and is accurate to a few pixels, which orthogonal
 * routing absorbs without visible error.
 */
import ELK, { type ElkNode, type ElkExtendedEdge } from 'elkjs/lib/elk.bundled.js';
import { getEventCategory, type MachineGraph, type StateNodeData, type TransitionData } from './machine';

/** A laid-out state box. */
export interface LaidOutState {
  kind: 'state';
  id: string;
  /** Absolute position in canvas space (ELK reports child coords relative to the parent). */
  x: number;
  y: number;
  width: number;
  height: number;
  data: StateNodeData;
  /** Depth in the state hierarchy; 0 is a direct child of the machine root. */
  depth: number;
  isInitial: boolean;
}

/** A laid-out transition box. */
export interface LaidOutTransition {
  kind: 'transition';
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  data: TransitionData;
  sourceId: string;
  targetId: string;
  /** True when the transition has no target — it re-enters its source (a self-loop). */
  isSelf: boolean;
}

export type LaidOutNode = LaidOutState | LaidOutTransition;

/** One routed edge: an orthogonal polyline in canvas space. */
export interface RoutedEdge {
  id: string;
  points: Array<{ x: number; y: number }>;
  /** The transition this edge belongs to, so hover/active styling can follow it. */
  transitionId: string;
  /** `in` runs state → transition; `out` runs transition → state. */
  leg: 'in' | 'out';
}

export interface Layout {
  nodes: LaidOutNode[];
  edges: RoutedEdge[];
  width: number;
  height: number;
}

// ── Text metrics ───────────────────────────────────────────────────────────
// Tuned to the node components: event labels are 11px semibold mono, guards 11px mono, state keys
// 13px semibold sans. Monospace at 11px is ~6.2px per character.
const MONO_11 = 6.2;
const SANS_13 = 7.1;
const BOX_PAD_X = 20;
const ROW_H = 18;
const HEADER_H = 24;
const ICON_W = 14;

const textWidth = (s: string, per: number) => s.length * per;

/**
 * Estimated size of a transition box, from its event, guard, actor label and action list.
 *
 * `actorLabel` is measured rather than allowanced, because the labels differ in length (BUYER vs
 * ANYONE) and a fixed allowance would either clip the long ones or pad every box for the short ones.
 */
function transitionSize(d: TransitionData, actorLabel: string | null): { width: number; height: number } {
  const category = getEventCategory(d.eventType);
  const eventLabel = d.displayEvent || (category === 'always' ? 'always' : d.eventType);

  let headerW = textWidth(eventLabel, MONO_11);
  if (category !== null) headerW += ICON_W; // timer / always / done / error icon
  if (actorLabel) headerW += textWidth(actorLabel, MONO_11) + 10; // actor chip + gap
  if (d.guardPrefix) headerW += textWidth(d.guardPrefix, MONO_11) + 6;
  if (d.guard) headerW += textWidth(d.guard, MONO_11) + ICON_W + 6; // diamond + guard name

  // Each action is its own row, prefixed by an action glyph.
  const actionW = d.actions.reduce((max, a) => Math.max(max, textWidth(a, MONO_11) + ICON_W), 0);

  return {
    width: Math.max(96, Math.ceil(Math.max(headerW, actionW)) + BOX_PAD_X),
    height: HEADER_H + d.actions.length * ROW_H + (d.description ? ROW_H : 0) + 8,
  };
}

/** Estimated size of a leaf state box. Compound states are sized by ELK from their children. */
function stateSize(d: StateNodeData): { width: number; height: number } {
  let w = textWidth(d.key, SANS_13);
  if (d.type === 'final' || d.type === 'parallel' || d.type === 'history') w += ICON_W;
  const extraRows =
    (d.entry.length > 0 || d.exit.length > 0 ? 1 : 0) + (d.invocations.length > 0 ? 1 : 0);
  return {
    width: Math.max(72, Math.ceil(w) + BOX_PAD_X + 12),
    height: HEADER_H + extraRows * ROW_H,
  };
}

// ── Graph shaping ──────────────────────────────────────────────────────────

/** Walk up from `id` collecting ancestor ids, nearest first. */
function ancestorsOf(graph: MachineGraph, id: string): string[] {
  const chain: string[] = [];
  let cursor = graph.nodes.find((n) => n.id === id)?.parentId ?? null;
  while (cursor) {
    chain.push(cursor);
    cursor = graph.nodes.find((n) => n.id === cursor)?.parentId ?? null;
  }
  return chain;
}

/** Does this state have children? Only a compound state may contain a transition box. */
function hasChildren(graph: MachineGraph, id: string): boolean {
  return graph.nodes.some((n) => n.parentId === id);
}

/**
 * The node that should CONTAIN a transition's box.
 *
 * Normally the lowest common ancestor of the two endpoints: put the box in the source and any
 * transition leaving a compound state drags its box inside that state's border.
 *
 * Two cases need care, and getting either wrong puts a box inside a state that cannot hold one —
 * ELK then inflates that state to fit its unexpected child and the renderer draws them stacked:
 *
 *   • A SELF-LOOP has source === target, so the naive LCA is the state itself. It belongs in the
 *     state's PARENT, beside the state it loops on.
 *   • A LEAF chosen as container by any other route is climbed out of, for the same reason. A
 *     compound state legitimately containing the box (a parent transitioning to its own child) is
 *     left alone, because there the nesting is what you want to see.
 */
function containerFor(graph: MachineGraph, sourceId: string, targetId: string, rootId: string): string {
  const parentOf = (id: string) => graph.nodes.find((n) => n.id === id)?.parentId ?? rootId;

  if (sourceId === targetId) return parentOf(sourceId);

  const sourceChain = [sourceId, ...ancestorsOf(graph, sourceId)];
  const targetChain = new Set([targetId, ...ancestorsOf(graph, targetId)]);

  let container = rootId;
  for (const candidate of sourceChain) {
    // Skip the source itself unless it genuinely contains the target.
    if (candidate === sourceId && !targetChain.has(sourceId)) continue;
    if (targetChain.has(candidate)) {
      container = candidate;
      break;
    }
  }

  // Never hand a box to a state that has no children of its own.
  return hasChildren(graph, container) ? container : parentOf(container);
}

const elk = new ELK();

const LAYOUT_OPTIONS: Record<string, string> = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
  'elk.layered.spacing.nodeNodeBetweenLayers': '26',
  'elk.spacing.nodeNode': '22',
  'elk.spacing.edgeNode': '16',
  'elk.spacing.edgeEdge': '10',
  'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
  // Keeps a state and the transition boxes hanging off it from being shuffled arbitrarily.
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
  'elk.padding': '[top=28,left=16,bottom=16,right=16]',
};

/**
 * Lay out a machine graph.
 *
 * Async because ELK is async even in its bundled synchronous-looking form. The caller renders
 * nothing until this resolves, which is fine: layout of a 40-node graph is a few milliseconds.
 */
export async function layoutMachine(
  graph: MachineGraph,
  options: {
    /** Short actor label per event type, so its chip is included in box sizing. */
    actorLabelOf?: (eventType: string) => string | null;
  } = {},
): Promise<Layout> {
  const root = graph.nodes.find((n) => n.parentId === null);
  if (!root) return { nodes: [], edges: [], width: 0, height: 0 };

  // Build one ELK node per state, then attach them into a tree.
  const elkById = new Map<string, ElkNode & { children: ElkNode[]; edges: ElkExtendedEdge[] }>();
  for (const node of graph.nodes) {
    const size = stateSize(node.data);
    elkById.set(node.id, {
      id: node.id,
      ...(node.id === root.id ? {} : size),
      children: [],
      edges: [],
      layoutOptions: node.id === root.id ? LAYOUT_OPTIONS : { 'elk.padding': '[top=26,left=14,bottom=14,right=14]' },
    });
  }
  for (const node of graph.nodes) {
    if (node.parentId) elkById.get(node.parentId)?.children.push(elkById.get(node.id)!);
  }

  // Every transition becomes a node in its LCA, plus an in-leg and an out-leg edge.
  const transitionMeta = new Map<string, { data: TransitionData; sourceId: string; targetId: string; isSelf: boolean }>();
  for (const edge of graph.edges) {
    const data = edge.data as TransitionData;
    const targetId = data.isTargetless ? edge.sourceId : edge.targetId;
    const container = elkById.get(containerFor(graph, edge.sourceId, targetId, root.id))!;
    const boxId = `t:${edge.id}`;
    const size = transitionSize(data, options.actorLabelOf?.(data.eventType) ?? null);

    container.children.push({ id: boxId, ...size });
    container.edges.push(
      { id: `${boxId}:in`, sources: [edge.sourceId], targets: [boxId] },
      { id: `${boxId}:out`, sources: [boxId], targets: [targetId] },
    );
    transitionMeta.set(boxId, { data, sourceId: edge.sourceId, targetId, isSelf: data.isTargetless || edge.sourceId === targetId });
  }

  const laidOut = await elk.layout(elkById.get(root.id)!);

  // ── Flatten to absolute coordinates ──────────────────────────────────────
  const nodes: LaidOutNode[] = [];
  const edges: RoutedEdge[] = [];
  const stateById = new Map(graph.nodes.map((n) => [n.id, n]));

  const walk = (elkNode: ElkNode, originX: number, originY: number, depth: number) => {
    const x = originX + (elkNode.x ?? 0);
    const y = originY + (elkNode.y ?? 0);

    for (const child of elkNode.children ?? []) {
      const meta = transitionMeta.get(child.id);
      if (meta) {
        nodes.push({
          kind: 'transition',
          id: child.id,
          x: x + (child.x ?? 0),
          y: y + (child.y ?? 0),
          width: child.width ?? 0,
          height: child.height ?? 0,
          ...meta,
        });
        continue;
      }
      const state = stateById.get(child.id);
      if (state) {
        const parent = state.parentId ? stateById.get(state.parentId) : undefined;
        nodes.push({
          kind: 'state',
          id: child.id,
          x: x + (child.x ?? 0),
          y: y + (child.y ?? 0),
          width: child.width ?? 0,
          height: child.height ?? 0,
          data: state.data,
          depth,
          isInitial: parent?.data.initialId === child.id,
        });
        walk(child, x, y, depth + 1);
      }
    }

    // ELK reports edge sections relative to the node that OWNS the edge.
    for (const edge of (elkNode.edges ?? []) as ElkExtendedEdge[]) {
      for (const section of edge.sections ?? []) {
        const points = [
          section.startPoint,
          ...(section.bendPoints ?? []),
          section.endPoint,
        ].map((p) => ({ x: x + p.x, y: y + p.y }));
        const [boxId, leg] = [edge.id.slice(0, edge.id.lastIndexOf(':')), edge.id.endsWith(':in') ? 'in' : 'out'] as const;
        edges.push({ id: edge.id, points, transitionId: boxId, leg });
      }
    }
  };

  walk(laidOut, 0, 0, 0);

  return {
    nodes,
    edges,
    width: laidOut.width ?? 0,
    height: laidOut.height ?? 0,
  };
}
