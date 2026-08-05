import { describe, expect, it } from 'vitest';
import { layoutMachine } from './layout';
import { getDefaultMachine, machineToGraph, parseXStateMachineCode } from './machine';

/** Do two boxes overlap? Touching edges are fine; overlapping interiors are not. */
function overlaps(a: { x: number; y: number; width: number; height: number }, b: typeof a): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

describe('layoutMachine', () => {
  it('lays out the nested traffic-light machine with transitions as nodes', async () => {
    const graph = machineToGraph(getDefaultMachine());
    const layout = await layoutMachine(graph);

    const states = layout.nodes.filter((n) => n.kind === 'state');
    const transitions = layout.nodes.filter((n) => n.kind === 'transition');

    // 8 states (green, yellow, red + red's 5 children); one box per transition.
    expect(states.length).toBe(8);
    expect(transitions.length).toBe(graph.edges.length);

    // Every box has a real position and size.
    for (const node of layout.nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
      expect(node.width).toBeGreaterThan(0);
      expect(node.height).toBeGreaterThan(0);
    }

    expect(layout.width).toBeGreaterThan(0);
    expect(layout.height).toBeGreaterThan(0);
  });

  it('routes every transition with an in-leg and an out-leg polyline', async () => {
    const graph = machineToGraph(getDefaultMachine());
    const layout = await layoutMachine(graph);

    for (const transition of layout.nodes.filter((n) => n.kind === 'transition')) {
      const legs = layout.edges.filter((e) => e.transitionId === transition.id);
      expect(legs.map((l) => l.leg).sort()).toEqual(['in', 'out']);
      for (const leg of legs) {
        expect(leg.points.length).toBeGreaterThanOrEqual(2);
        for (const point of leg.points) {
          expect(Number.isFinite(point.x)).toBe(true);
          expect(Number.isFinite(point.y)).toBe(true);
        }
      }
    }
  });

  it('does not overlap leaf boxes', async () => {
    const graph = machineToGraph(getDefaultMachine());
    const layout = await layoutMachine(graph);

    // Compound states legitimately contain their children, so compare only leaves and transitions.
    const compoundIds = new Set(
      layout.nodes.filter((n) => n.kind === 'state' && n.data.type === 'compound').map((n) => n.id),
    );
    const leaves = layout.nodes.filter((n) => !compoundIds.has(n.id));

    for (let i = 0; i < leaves.length; i += 1) {
      for (let j = i + 1; j < leaves.length; j += 1) {
        expect(
          overlaps(leaves[i], leaves[j]),
          `${leaves[i].id} overlaps ${leaves[j].id}`,
        ).toBe(false);
      }
    }
  });

  it('keeps a self-loop as its own box pointing back at its source', async () => {
    const { machines } = parseXStateMachineCode(`
      import { createMachine } from 'xstate';
      const m = createMachine({
        id: 'loop',
        initial: 'idle',
        states: { idle: { on: { PING: { actions: 'count' } } } },
      });
    `);
    const layout = await layoutMachine(machineToGraph(machines[0]));
    const self = layout.nodes.find((n) => n.kind === 'transition');
    expect(self).toBeDefined();
    if (self?.kind !== 'transition') throw new Error('expected a transition node');
    expect(self.isSelf).toBe(true);
    expect(self.sourceId).toBe(self.targetId);
  });

  /**
   * Regression: a self-loop's box was parented INSIDE its own source state, because the naive
   * lowest-common-ancestor of (x, x) is x. ELK then inflated that leaf to contain its unexpected
   * child and the renderer drew the box on top of the state. Geometry is the assertion that
   * catches it — the identity test above passed throughout.
   */
  it('does not place a self-loop box inside or on top of a leaf state', async () => {
    const { machines } = parseXStateMachineCode(`
      import { createMachine } from 'xstate';
      const m = createMachine({
        id: 'negotiation',
        initial: 'quoted',
        states: {
          quoted: { on: { OFFER: { target: 'negotiating' } } },
          negotiating: {
            on: {
              OFFER: { actions: 'recordOffer' },
              ACCEPTED: { target: 'agreed' },
            },
          },
          agreed: { type: 'final' },
        },
      });
    `);
    const layout = await layoutMachine(machineToGraph(machines[0]));

    const negotiating = layout.nodes.find((n) => n.id.endsWith('.negotiating'));
    const selfLoop = layout.nodes.find((n) => n.kind === 'transition' && n.isSelf);
    expect(negotiating).toBeDefined();
    expect(selfLoop).toBeDefined();

    // The leaf must stay leaf-sized — an inflated box is the signature of the bug.
    expect(negotiating!.height).toBeLessThan(48);
    expect(overlaps(negotiating!, selfLoop!)).toBe(false);
  });
});
