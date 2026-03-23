/**
 * Parser for the Sketch Systems DSL notation.
 * https://sketch.systems/tutorials/five-minute-introduction/
 *
 * Syntax:
 *   - States: bare lines (no `->`)
 *   - Initial state: `*` suffix
 *   - Parallel state: `&` suffix
 *   - Transitions: `event -> target` indented under a state
 *   - Guard transitions: `condition? -> target` (event ends with `?`)
 *   - Nesting: indentation (2 spaces per level)
 *   - Comments: `//` or `#` prefix
 *   - First child is initial if none marked `*`
 *   - Targets are resolved globally by state name (ID-based targeting)
 */

interface SketchState {
  name: string;
  indent: number;
  isInitial: boolean;
  isParallel: boolean;
  children: SketchState[];
  transitions: { event: string; target: string }[];
}

function parseIndent(line: string): number {
  const match = line.match(/^(\s*)/);
  return match ? match[1].length : 0;
}

/**
 * Collect a map of state name -> full ID path for all states in the tree.
 * If multiple states share a name, the last one wins (sketch.systems behavior).
 */
function collectStateIds(
  state: SketchState,
  parentId: string,
  map: Map<string, string>,
) {
  const id = parentId ? `${parentId}.${state.name}` : state.name;
  map.set(state.name, id);
  for (const child of state.children) {
    collectStateIds(child, id, map);
  }
}

function buildConfig(
  state: SketchState,
  stateIds: Map<string, string>,
): Record<string, any> {
  const config: Record<string, any> = {};

  if (state.isParallel) {
    config.type = 'parallel';
  }

  if (state.children.length > 0 && !state.isParallel) {
    // Find initial child
    const initialChild = state.children.find((c) => c.isInitial);
    config.initial = initialChild ? initialChild.name : state.children[0].name;
  }

  if (state.children.length > 0) {
    config.states = {};
    for (const child of state.children) {
      config.states[child.name] = buildConfig(child, stateIds);
    }
  }

  if (state.transitions.length > 0) {
    config.on = {};
    for (const t of state.transitions) {
      // Resolve target by ID: use #fullId so XState resolves globally
      const targetId = stateIds.get(t.target);
      const resolvedTarget = targetId ? `#${targetId}` : t.target;
      config.on[t.event] = resolvedTarget;
    }
  }

  return config;
}

export function parseSketchDSL(text: string): {
  config: Record<string, any>;
  error: string | null;
} {
  try {
    const lines = text.split('\n');
    const root: SketchState = {
      name: '',
      indent: -1,
      isInitial: false,
      isParallel: false,
      children: [],
      transitions: [],
    };

    // Stack tracks the current nesting: [root, topLevel, child, grandchild, ...]
    const stack: SketchState[] = [root];

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];

      // Skip empty lines and comments
      const trimmed = raw.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) continue;

      const indent = parseIndent(raw);

      // Check if this is a transition line (contains ->)
      const arrowMatch = trimmed.match(/^(.+?)\s*->\s*(.+)$/);

      if (arrowMatch) {
        // Transition: event -> target
        const event = arrowMatch[1].trim();
        const target = arrowMatch[2].trim();

        // Find the parent state this transition belongs to
        while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
          stack.pop();
        }
        const parent = stack[stack.length - 1];
        parent.transitions.push({ event, target });
      } else {
        // State definition
        let name = trimmed;
        let isInitial = false;
        let isParallel = false;

        if (name.endsWith('*')) {
          isInitial = true;
          name = name.slice(0, -1).trim();
        }
        if (name.endsWith('&')) {
          isParallel = true;
          name = name.slice(0, -1).trim();
        }
        // Handle both orderings: "State*&" or "State&*"
        if (name.endsWith('*')) {
          isInitial = true;
          name = name.slice(0, -1).trim();
        }
        if (name.endsWith('&')) {
          isParallel = true;
          name = name.slice(0, -1).trim();
        }

        if (!name) continue;

        const state: SketchState = {
          name,
          indent,
          isInitial,
          isParallel,
          children: [],
          transitions: [],
        };

        // Pop stack until we find the parent (whose indent < this indent)
        while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
          stack.pop();
        }

        const parent = stack[stack.length - 1];
        parent.children.push(state);
        stack.push(state);
      }
    }

    if (root.children.length === 0) {
      return { config: {}, error: 'No states found' };
    }

    // If there's a single top-level state, use it as the root machine
    if (root.children.length === 1) {
      const top = root.children[0];
      const stateIds = new Map<string, string>();
      collectStateIds(top, '', stateIds);
      const config = buildConfig(top, stateIds);
      config.id = top.name;
      return { config, error: null };
    }

    // Multiple top-level states: wrap in a root
    const stateIds = new Map<string, string>();
    for (const child of root.children) {
      collectStateIds(child, '', stateIds);
    }
    const config = buildConfig(root, stateIds);
    return { config, error: null };
  } catch (e) {
    return { config: {}, error: String(e) };
  }
}
