import { describe, expect, it } from 'vitest';
import { detectFormat, parseSketchCode } from './machine';

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
