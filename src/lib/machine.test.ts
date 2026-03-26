import { describe, expect, it } from 'vitest';
import { detectFormat, parseSketchCode, parseXStateMachineCode } from './machine';

describe('detectFormat', () => {
  it('detects Sketch DSL before any explicit mode selection', () => {
    expect(
      detectFormat(`Fetch App*
  idle*
    FETCH -> loading
  loading`),
    ).toBe('sketch');
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

describe('parseXStateMachineCode', () => {
  const machine = `setup({}).createMachine({
  id: 'test',
  initial: 'idle',
  states: { idle: {} },
})`;

  it.each([
    // xstate imports
    [`import { setup } from 'xstate';\n${machine}`],
    [`import * as xstate from 'xstate';\n${machine}`],
    // export default
    [`export default ${machine}`],
    // export const/let/var/function/class
    [`export const m = ${machine}`],
    [`export function getMachine() { return ${machine} }\ngetMachine()`],
    // export { ... }
    [`const m = ${machine};\nexport { m };`],
    // export * from
    [`export * from 'some-module';\n${machine}`],
  ])('strips imports and exports: %s', (code) => {
    const result = parseXStateMachineCode(code);
    expect(result.error).toBeNull();
    expect(result.machines).toHaveLength(1);
    expect(result.machines[0]?.id).toBe('test');
  });
});
