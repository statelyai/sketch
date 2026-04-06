import * as xstate from 'xstate';
import type { AnyStateMachine } from 'xstate';
import tsBlankSpace from 'ts-blank-space';
import { createGraph, addNode, addEdge, type Graph } from '@statelyai/graph';
import {
  fromMermaidState,
  fromMermaidFlowchart,
} from '@statelyai/graph/mermaid';
import { parseSketchDSL } from './sketch-parser';
import YAML from 'yaml';

// Types for node/edge data used in our graph
export interface StateNodeData {
  key: string;
  description?: string;
  type: 'compound' | 'parallel' | 'atomic' | 'final' | 'history' | null;
  historyType?: 'shallow' | 'deep';
  entry: string[];
  exit: string[];
  invocations: string[];
  initialId: string | null;
}

export interface TransitionData {
  eventType: string;
  displayEvent: string; // Cleaned event name for display
  guard: string | null;
  guardPrefix: '' | 'if' | 'else if' | 'else'; // computed from sibling transitions
  description?: string;
  actions: string[];
  isTargetless: boolean;
}

export type MachineGraph = Graph<StateNodeData, TransitionData>;

/** Clean up XState internal event types for display */
function displayEventType(eventType: string): string {
  if (!eventType) return '';

  // xstate.after(DELAY).stateId → just the delay value
  const afterMatch = eventType.match(/^xstate\.after\((\d+)\)\./);
  if (afterMatch) return `${afterMatch[1]}ms`;
  const afterNamedMatch = eventType.match(/^xstate\.after\(([^)]+)\)\./);
  if (afterNamedMatch) return afterNamedMatch[1];
  // xstate.after.DELAY.stateId → just the delay value
  const afterDotMatch = eventType.match(/^xstate\.after\.([^.]+)\./);
  if (afterDotMatch) return afterDotMatch[1];

  // xstate.done.state.stateId → done
  if (eventType.startsWith('xstate.done.state.')) return 'done';
  // xstate.done.actor.actorId → actor name
  const doneActorMatch = eventType.match(/^xstate\.done\.actor\.(.+)$/);
  if (doneActorMatch) return doneActorMatch[1];

  // xstate.error.actor.actorId → actor name
  const errorMatch = eventType.match(/^xstate\.error\.actor\.(.+)$/);
  if (errorMatch) return errorMatch[1];

  return eventType;
}

/** Categorize event type for icon display */
export function getEventCategory(
  eventType: string,
): 'after' | 'always' | 'done' | 'error' | null {
  if (!eventType || eventType === '(always)') return 'always';
  if (eventType.startsWith('xstate.after')) return 'after';
  if (eventType.startsWith('xstate.done')) return 'done';
  if (eventType.startsWith('xstate.error')) return 'error';
  return null;
}

/**
 * Convert an XState machine into our graph representation
 */
export function machineToGraph(machine: AnyStateMachine): MachineGraph {
  const graph = createGraph<StateNodeData, TransitionData>();

  // Pass 1: Add all nodes
  function addNodes(stateNode: any) {
    const stateType = stateNode.type as string;
    const initialChildId = stateNode.initial?.target?.[0]?.id ?? null;
    addNode(graph, {
      id: stateNode.id,
      parentId: stateNode.parent?.id ?? null,
      initialNodeId: initialChildId ?? undefined,
      label: stateNode.key,
      data: {
        key: stateNode.key,
        description: stateNode.description,
        type:
          stateType === 'compound'
            ? 'compound'
            : stateType === 'parallel'
              ? 'parallel'
              : stateType === 'final'
                ? 'final'
                : stateType === 'history'
                  ? 'history'
                  : stateNode.states && Object.keys(stateNode.states).length > 0
                    ? 'compound'
                    : 'atomic',
        historyType:
          stateType === 'history'
            ? stateNode.history === 'deep'
              ? 'deep'
              : 'shallow'
            : undefined,
        entry:
          stateNode.entry
            ?.map((a: any) =>
              typeof a === 'string'
                ? a
                : typeof a === 'object' && a?.type
                  ? a.type
                  : null,
            )
            .filter((x: any) => x !== null && !x.startsWith('xstate.')) ?? [],
        exit:
          stateNode.exit
            ?.map((a: any) =>
              typeof a === 'string'
                ? a
                : typeof a === 'object' && a?.type
                  ? a.type
                  : null,
            )
            .filter((x: any) => x !== null && !x.startsWith('xstate.')) ?? [],
        invocations:
          stateNode.invoke?.map((inv: any) =>
            typeof inv === 'string' ? inv : (inv?.src ?? inv?.id ?? 'invoke'),
          ) ?? [],
        initialId: initialChildId,
      },
    });

    for (const child of Object.values(stateNode.states ?? {})) {
      addNodes(child);
    }
  }

  function composedGuardName(guard: any): string {
    // Use check.name (checkAnd/checkOr/checkNot) which is stable across bundlers
    const checkName = guard.check?.name;
    if (checkName === 'checkAnd') return 'and';
    if (checkName === 'checkOr') return 'or';
    if (checkName === 'checkNot') return 'not';
    return 'guard';
  }

  function describeGuard(guard: any): string {
    if (!guard) return '';
    if (typeof guard === 'string') return guard;
    if (typeof guard === 'function') {
      // Composed guard: and/or/not with .guards array
      if (guard.guards) {
        const name = composedGuardName(guard);
        const inner = guard.guards.map((g: any) => describeGuard(g)).join(', ');
        return `${name}(${inner})`;
      }
      return guard.name || 'guard';
    }
    if (guard.type) return guard.type;
    return 'guard';
  }

  function resolveGuard(transition: any): string | null {
    if (!transition.guard) return null;
    if (typeof transition.guard === 'string') return transition.guard;
    if (typeof transition.guard === 'function') {
      // Composed/inline guard — generate a descriptive name
      if (transition.guard.guards) {
        return describeGuard(transition.guard);
      }
      return transition.guard.name || null;
    }
    return transition.guard?.type ?? null;
  }

  /**
   * Compute guard prefix for a transition within its group.
   * - group size 1: no prefix
   * - group size >1, index 0: "if"
   * - group size >1, not last: "else if"
   * - group size >1, last: "else"
   */
  function guardPrefix(
    groupSize: number,
    index: number,
  ): TransitionData['guardPrefix'] {
    if (groupSize <= 1) return '';
    if (index === 0) return 'if';
    if (index === groupSize - 1) return 'else';
    return 'else if';
  }

  function addTransitionGroup(
    stateNode: any,
    eventType: string,
    transitions: any[],
  ) {
    const size = transitions.length;
    transitions.forEach((transition: any, i: number) => {
      const transitionId = `${stateNode.id}:${eventType || 'always'}:${i}`;
      addEdge(graph, {
        id: transitionId,
        sourceId: stateNode.id,
        targetId: transition.target?.[0]?.id ?? stateNode.id,
        label: eventType || '(always)',
        data: {
          eventType: eventType || '(always)',
          displayEvent: displayEventType(eventType),
          guard: resolveGuard(transition),
          guardPrefix: guardPrefix(size, i),
          description: transition.description,
          actions:
            transition.actions
              ?.map((a: any) =>
                typeof a === 'string'
                  ? a
                  : typeof a === 'object' && a?.type
                    ? a.type
                    : null,
              )
              .filter((x: any) => x !== null && !x.startsWith('xstate.')) ?? [],
          isTargetless: !transition.target,
        },
      });
    });
  }

  // Pass 2: Add all edges (all nodes exist now)
  function addEdges(stateNode: any) {
    for (const [eventType, transitions] of stateNode.transitions) {
      if (!Array.isArray(transitions) || transitions.length === 0) continue;
      addTransitionGroup(stateNode, eventType, transitions);
    }

    if (stateNode.always?.length) {
      addTransitionGroup(stateNode, '', stateNode.always);
    }

    for (const child of Object.values(stateNode.states ?? {})) {
      addEdges(child);
    }
  }

  addNodes(machine.root);
  addEdges(machine.root);
  return graph;
}

/**
 * Get relative target key for display.
 * If target is sibling, just show key. If descendant of sibling, show relative path.
 * Otherwise show full "#id".
 */
export function getRelativeTarget(
  sourceId: string,
  targetId: string,
  graph: MachineGraph,
): string {
  if (sourceId === targetId) return '(self)';

  // Get source parent
  const sourceNode = graph.nodes.find((n) => n.id === sourceId);
  const targetNode = graph.nodes.find((n) => n.id === targetId);
  if (!sourceNode || !targetNode) return targetId;

  // Same parent = sibling
  if (sourceNode.parentId === targetNode.parentId) {
    return targetNode.data.key;
  }

  // Target is descendant of a sibling
  if (sourceNode.parentId) {
    const siblings = graph.nodes.filter(
      (n) => n.parentId === sourceNode.parentId,
    );
    for (const sibling of siblings) {
      if (targetId.startsWith(sibling.id + '.')) {
        const relativePath = targetId.slice(
          sibling.id.length - sibling.data.key.length,
        );
        return relativePath;
      }
    }
  }

  // Check if target is a child/descendant of source
  if (targetId.startsWith(sourceId + '.')) {
    return '.' + targetId.slice(sourceId.length + 1);
  }

  return '#' + targetId;
}

const MAX_MACHINES = 10;

// Xstate exports to inject as function parameters
const XSTATE_PARAM_NAMES = [
  'createMachine',
  'setup',
  'assign',
  'raise',
  'sendTo',
  'sendParent',
  'forwardTo',
  'cancel',
  'emit',
  'enqueueActions',
  'log',
  'stop',
  'stopChild',
  'spawnChild',
  'and',
  'or',
  'not',
  'stateIn',
  'fromPromise',
  'fromCallback',
  'fromObservable',
  'fromEventObservable',
  'fromTransition',
  'assertEvent',
  'matchesState',
] as const;

/**
 * Strip xstate imports (we inject bindings as fn params) and ESM export syntax
 * so code can be evaluated via `new Function()`.
 */
function stripImportsAndExports(code: string): string {
  return code
    // import { ... } from 'xstate'
    .replace(/import\s*\{[^}]*\}\s*from\s*['"]xstate['"]\s*;?/g, '')
    // import * as x from 'xstate'
    .replace(/import\s*\*\s*as\s+\w+\s*from\s*['"]xstate['"]\s*;?/g, '')
    // export default ...
    .replace(/^\s*export\s+default\s+/gm, '')
    // export const/let/var/function/class
    .replace(/^\s*export\s+(const|let|var|function|class)\b/gm, '$1')
    // export { ... }
    .replace(/^\s*export\s*\{[^}]*\}\s*;?\s*$/gm, '')
    // export * from '...'
    .replace(/^\s*export\s*\*\s*from\s*['"][^'"]+['"]\s*;?\s*$/gm, '');
}

/**
 * Parse user XState code by evaluating it with `new Function()`.
 * Wraps `createMachine` and `setup().createMachine` to capture machines.
 */
export function parseXStateMachineCode(code: string): {
  machines: AnyStateMachine[];
  error: string | null;
} {
  try {
    const captured: AnyStateMachine[] = [];

    const wrappedCreateMachine: typeof xstate.createMachine = function (
      config: any,
      implementations?: any,
    ) {
      const machine = xstate.createMachine(config, implementations);
      if (captured.length < MAX_MACHINES) captured.push(machine);
      return machine;
    } as any;

    const wrappedSetup: typeof xstate.setup = function (config: any) {
      const result = xstate.setup(config);
      const originalCreate = result.createMachine.bind(result);
      return {
        ...result,
        createMachine(machineConfig: any) {
          const machine = originalCreate(machineConfig);
          if (captured.length < MAX_MACHINES) captured.push(machine);
          return machine;
        },
      };
    } as any;

    const jsCode = tsBlankSpace(code);
    const strippedCode = stripImportsAndExports(jsCode);
    const fn = new Function(...XSTATE_PARAM_NAMES, strippedCode);

    fn(
      wrappedCreateMachine,
      wrappedSetup,
      xstate.assign,
      xstate.raise,
      xstate.sendTo,
      xstate.sendParent,
      xstate.forwardTo,
      xstate.cancel,
      xstate.emit,
      xstate.enqueueActions,
      xstate.log,
      xstate.stop,
      xstate.stopChild,
      xstate.spawnChild,
      xstate.and,
      xstate.or,
      xstate.not,
      xstate.stateIn,
      xstate.fromPromise,
      xstate.fromCallback,
      xstate.fromObservable,
      xstate.fromEventObservable,
      xstate.fromTransition,
      xstate.assertEvent,
      xstate.matchesState,
    );

    if (captured.length === 0) {
      return { machines: [], error: 'No machine found in code' };
    }

    return { machines: captured, error: null };
  } catch (e) {
    return { machines: [], error: String(e) };
  }
}

export type CodeFormat = 'xstate' | 'json' | 'yaml' | 'mermaid';

/**
 * Auto-detect the format of the code string.
 */
export function detectFormat(code: string): CodeFormat | null {
  const trimmed = code.trim();
  if (!trimmed) return null;

  // Mermaid: starts with stateDiagram, flowchart, or graph direction
  if (
    /^\s*(stateDiagram(-v2)?|flowchart(\s+(TD|TB|BT|RL|LR))?|graph\s+(TD|TB|BT|RL|LR))\b/m.test(
      trimmed,
    )
  )
    return 'mermaid';

  // XState JS/TS: contains createMachine/setup calls or import statements
  if (/\b(createMachine|setup)\s*\(/.test(trimmed)) return 'xstate';
  if (/\bimport\s/.test(trimmed)) return 'xstate';

  // JSON: starts with { or [
  if (trimmed[0] === '{' || trimmed[0] === '[') return 'json';

  // YAML: key-value pairs with colons (but not sketch's `->` transitions)
  // YAML typically has lines like `key: value` or starts with `---`
  if (trimmed.startsWith('---')) return 'yaml';
  // If lines have `key:` patterns and no `->` transitions, likely YAML
  const lines = trimmed.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#'));
  const hasColonKeys = lines.some((l) => /^\s*[\w-]+\s*:/.test(l));
  const hasArrows = lines.some((l) => /->/.test(l));
  if (hasColonKeys && !hasArrows) return 'yaml';

  // Default: sketch DSL
  return null;
}

/**
 * Parse sketch systems DSL into XState machines.
 */
export function parseSketchCode(code: string): {
  machines: AnyStateMachine[];
  error: string | null;
} {
  const { config, error } = parseSketchDSL(code);
  if (error) return { machines: [], error };
  try {
    const machine = xstate.createMachine(config as any);
    return { machines: [machine], error: null };
  } catch (e) {
    return { machines: [], error: String(e) };
  }
}

/**
 * Parse JSON machine config into XState machines.
 */
export function parseJSONCode(code: string): {
  machines: AnyStateMachine[];
  error: string | null;
} {
  try {
    const config = JSON.parse(code);
    const machine = xstate.createMachine(config);
    return { machines: [machine], error: null };
  } catch (e) {
    return { machines: [], error: String(e) };
  }
}

/**
 * Parse YAML machine config into XState machines.
 */
export function parseYAMLCode(code: string): {
  machines: AnyStateMachine[];
  error: string | null;
} {
  try {
    const config = YAML.parse(code);
    const machine = xstate.createMachine(config);
    return { machines: [machine], error: null };
  } catch (e) {
    return { machines: [], error: String(e) };
  }
}

/**
 * Convert a mermaid state diagram graph into an XState machine config.
 */
function mermaidStateToConfig(code: string): any {
  const graph = fromMermaidState(code);

  const startNodeIds = new Set(
    graph.nodes.filter((n) => n.data?.isStart).map((n) => n.id),
  );
  const endNodeIds = new Set(
    graph.nodes.filter((n) => n.data?.isEnd).map((n) => n.id),
  );

  // Track choice/fork/join nodes
  const choiceNodeIds = new Set(
    graph.nodes
      .filter((n) => n.data?.stateType === 'choice')
      .map((n) => n.id),
  );

  // Map node ID → state key (label)
  const nodeIdToKey = new Map<string, string>();
  for (const node of graph.nodes) {
    if (!startNodeIds.has(node.id) && !endNodeIds.has(node.id)) {
      nodeIdToKey.set(node.id, node.label || node.id);
    }
  }

  function findInitial(parentId: string | null): string | undefined {
    const startNode = graph.nodes.find(
      (n) => n.data?.isStart && n.parentId === parentId,
    );
    if (!startNode) return undefined;
    const edge = graph.edges.find((e) => e.sourceId === startNode.id);
    if (!edge) return undefined;
    return nodeIdToKey.get(edge.targetId);
  }

  function buildStates(
    parentId: string | null,
  ): Record<string, any> | undefined {
    const children = graph.nodes.filter(
      (n) =>
        n.parentId === parentId &&
        !startNodeIds.has(n.id) &&
        !endNodeIds.has(n.id),
    );
    if (children.length === 0) return undefined;

    const states: Record<string, any> = {};

    for (const child of children) {
      const key = nodeIdToKey.get(child.id)!;
      const config: any = {};

      const hasEndEdge = graph.edges.some(
        (e) => e.sourceId === child.id && endNodeIds.has(e.targetId),
      );
      const outEdges = graph.edges.filter(
        (e) =>
          e.sourceId === child.id &&
          !endNodeIds.has(e.targetId) &&
          !startNodeIds.has(e.targetId),
      );

      // Only mark final if no other outgoing transitions
      if (hasEndEdge && outEdges.length === 0) {
        config.type = 'final';
      }

      if (outEdges.length > 0) {
        if (choiceNodeIds.has(child.id)) {
          // Choice node: edge labels become guards on always transitions
          config.always = outEdges.map((edge) => {
            const targetKey = nodeIdToKey.get(edge.targetId);
            const label = (edge.label || '').replace(/^if\s+/i, '').trim();
            return {
              target: targetKey,
              ...(label ? { guard: label } : {}),
            };
          });
        } else {
          const on: Record<string, string> = {};
          for (const edge of outEdges) {
            const targetKey = nodeIdToKey.get(edge.targetId);
            if (!targetKey) continue;
            on[edge.label || '*'] = targetKey;
          }
          if (Object.keys(on).length > 0) config.on = on;
        }
      }

      // Nested states
      const nested = buildStates(child.id);
      if (nested) {
        config.states = nested;
        const nestedInitial = findInitial(child.id);
        if (nestedInitial) config.initial = nestedInitial;
      }

      if (child.data?.description) config.description = child.data.description;

      states[key] = config;
    }

    return Object.keys(states).length > 0 ? states : undefined;
  }

  const states = buildStates(null);
  const initial = findInitial(null);

  // Fallback: use first root state as initial
  const firstRoot = graph.nodes.find(
    (n) =>
      n.parentId === null &&
      !startNodeIds.has(n.id) &&
      !endNodeIds.has(n.id),
  );

  return {
    id: 'machine',
    initial: initial || (firstRoot ? nodeIdToKey.get(firstRoot.id) : undefined),
    states: states || {},
  };
}

/**
 * Convert a mermaid flowchart graph into an XState machine config.
 */
function mermaidFlowchartToConfig(code: string): any {
  const graph = fromMermaidFlowchart(code);

  const nodeIdToKey = new Map<string, string>();
  for (const node of graph.nodes) {
    nodeIdToKey.set(node.id, node.label || node.id);
  }

  function buildStates(
    parentId: string | null,
  ): Record<string, any> | undefined {
    const children = graph.nodes.filter((n) => n.parentId === parentId);
    if (children.length === 0) return undefined;

    const states: Record<string, any> = {};

    for (const child of children) {
      const key = nodeIdToKey.get(child.id)!;
      const config: any = {};

      const outEdges = graph.edges.filter((e) => e.sourceId === child.id);

      if (outEdges.length === 0) {
        config.type = 'final';
      } else {
        const on: Record<string, string> = {};
        for (const edge of outEdges) {
          const targetKey = nodeIdToKey.get(edge.targetId);
          if (!targetKey) continue;
          on[edge.label || '*'] = targetKey;
        }
        if (Object.keys(on).length > 0) config.on = on;
      }

      // Subgraph nesting
      const nested = buildStates(child.id);
      if (nested) {
        delete config.type;
        config.states = nested;
        const nestedChildren = graph.nodes.filter(
          (n) => n.parentId === child.id,
        );
        const nestedIds = new Set(nestedChildren.map((n) => n.id));
        const withInternalIncoming = new Set<string>();
        for (const e of graph.edges) {
          if (nestedIds.has(e.targetId) && nestedIds.has(e.sourceId)) {
            withInternalIncoming.add(e.targetId);
          }
        }
        const initialChild = nestedChildren.find(
          (n) => !withInternalIncoming.has(n.id),
        );
        if (initialChild) config.initial = nodeIdToKey.get(initialChild.id);
      }

      states[key] = config;
    }

    return Object.keys(states).length > 0 ? states : undefined;
  }

  const states = buildStates(null);

  // Find initial state: root node with no incoming edges from other root nodes
  const rootNodes = graph.nodes.filter((n) => n.parentId === null);
  const rootIds = new Set(rootNodes.map((n) => n.id));
  const withRootIncoming = new Set<string>();
  for (const e of graph.edges) {
    if (rootIds.has(e.targetId) && rootIds.has(e.sourceId)) {
      withRootIncoming.add(e.targetId);
    }
  }
  const initialNode =
    rootNodes.find((n) => !withRootIncoming.has(n.id)) || rootNodes[0];
  const initial = initialNode
    ? nodeIdToKey.get(initialNode.id)
    : undefined;

  return {
    id: 'machine',
    initial,
    states: states || {},
  };
}

/**
 * Parse mermaid diagram code into XState machines.
 */
export function parseMermaidCode(code: string): {
  machines: AnyStateMachine[];
  error: string | null;
} {
  try {
    const trimmed = code.trim();
    const isStateDiagram = /^\s*stateDiagram/m.test(trimmed);

    const config = isStateDiagram
      ? mermaidStateToConfig(code)
      : mermaidFlowchartToConfig(code);

    const machine = xstate.createMachine(config);
    return { machines: [machine], error: null };
  } catch (e) {
    return { machines: [], error: String(e) };
  }
}

/**
 * Parse code in any supported format.
 */
export function parseCode(code: string, format?: CodeFormat | null): {
  machines: AnyStateMachine[];
  error: string | null;
} {
  const fmt = format ?? detectFormat(code);
  switch (fmt) {
    case 'json':
      return parseJSONCode(code);
    case 'yaml':
      return parseYAMLCode(code);
    case 'xstate':
      return parseXStateMachineCode(code);
    case 'mermaid':
      return parseMermaidCode(code);
    default:
      return parseSketchCode(code);
  }
}

export const defaultSketchCode = `Fetch App*
  idle*
    FETCH -> loading
  loading
    success -> processing
    error -> failed
    CANCEL -> idle
  processing
    done -> success
    fail -> failed
  success
    FETCH -> loading
  failed
    RETRY -> loading
`;

export function getDefaultMachine(): AnyStateMachine {
  const result = parseXStateMachineCode(defaultMachineCode);
  if (result.error || result.machines.length === 0) {
    throw new Error(result.error ?? 'No machine found in default code');
  }
  return result.machines[0];
}

export const defaultMachineCode = `import { setup } from 'xstate';

const machine = setup({
  types: {
    events: {} as
      | { type: 'NEXT' }
      | { type: 'PEDESTRIAN_REQUEST' }
      | { type: 'EMERGENCY' }
      | { type: 'RESET' },
  },
}).createMachine({
  id: 'trafficLight',
  initial: 'green',
  states: {
    green: {
      after: { 5000: { target: 'yellow' } },
      on: {
        NEXT: { target: 'yellow' },
        EMERGENCY: { target: 'red.flash' },
      },
    },
    yellow: {
      after: { 2000: { target: 'red' } },
      on: {
        NEXT: { target: 'red' },
        EMERGENCY: { target: 'red.flash' },
      },
    },
    red: {
      initial: 'waiting',
      on: {
        EMERGENCY: { target: '.flash' },
      },
      states: {
        waiting: {
          on: {
            PEDESTRIAN_REQUEST: { target: 'pedestrianCrossing' },
          },
          after: { 3000: { target: 'turnArrow' } },
        },
        pedestrianCrossing: {
          after: { 4000: { target: 'turnArrow' } },
        },
        turnArrow: {
          after: { 3000: { target: 'clearance' } },
        },
        clearance: {
          after: { 1000: { target: '#trafficLight.green' } },
        },
        flash: {
          on: {
            RESET: { target: '#trafficLight.green' },
          },
        },
      },
    },
  },
});
`;
