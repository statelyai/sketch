import { describe, expect, it } from 'vitest';
import { detectFormat, parseSketchCode, parseMermaidCode, machineToGraph, getEventCategory } from './machine';

describe('detectFormat', () => {
  it('detects Sketch DSL before any explicit mode selection', () => {
    expect(
      detectFormat(`Fetch App*
  idle*
    FETCH -> loading
  loading`),
    ).toBeNull();
  });

  it('detects Mermaid diagrams', () => {
    expect(
      detectFormat(`stateDiagram-v2
[*] --> idle
idle --> loading: FETCH`),
    ).toBe('mermaid');
  });
});

describe('parseSketchCode', () => {
  it('creates a machine from sketch DSL', () => {
    const result = parseSketchCode(`Fetch App*
  idle*
    FETCH -> loading
  loading`);

    expect(result.error).toBeNull();
    expect(result.machines).toHaveLength(1);
    expect(result.machines[0]?.id).toBe('Fetch App');
  });
});

describe('parseMermaidCode', () => {
  it('converts <<choice>> nodes to always transitions with guards', () => {
    const result = parseMermaidCode(`stateDiagram-v2
    state if_state <<choice>>
    [*] --> IsPositive
    IsPositive --> if_state
    if_state --> False: if n < 0
    if_state --> True : if n >= 0`);

    expect(result.error).toBeNull();
    expect(result.machines).toHaveLength(1);

    const graph = machineToGraph(result.machines[0]);
    const choiceNode = graph.nodes.find((n) => n.data.key === 'if_state');
    expect(choiceNode).toBeDefined();

    const choiceEdges = graph.edges.filter((e) => e.sourceId === choiceNode!.id);
    expect(choiceEdges).toHaveLength(2);

    // All edges should be always transitions
    for (const edge of choiceEdges) {
      expect(getEventCategory(edge.data.eventType)).toBe('always');
    }

    // Guards should have "if " prefix stripped
    const guards = choiceEdges.map((e) => e.data.guard).sort();
    expect(guards).toEqual(['n < 0', 'n >= 0']);
  });
});
