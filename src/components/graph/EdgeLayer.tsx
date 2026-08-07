/**
 * The edges, as one SVG under the node layer.
 *
 * ELK returns each edge as an orthogonal polyline. Two details make it read well:
 *
 *   • CORNER ROUNDING. Raw ELK bend points give hard 90° corners, which at this density looks like
 *     a circuit diagram. Each bend is replaced with a small quadratic curve, capped at half the
 *     shorter adjoining segment so a tight jog can never overshoot into the neighbouring segment.
 *
 *   • ARROWHEADS ON THE OUT-LEG ONLY. A transition is drawn as
 *     state → [transition box] → state. Putting a head on both legs implies two hops; the head
 *     belongs where the flow lands, on the leg leaving the box.
 */
import type { RoutedEdge } from '@/lib/layout';

const CORNER = 6;

/** Build a path with rounded corners from an orthogonal polyline. */
function roundedPath(points: Array<{ x: number; y: number }>): string {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  const parts = [`M ${points[0].x} ${points[0].y}`];

  for (let i = 1; i < points.length - 1; i += 1) {
    const previous = points[i - 1];
    const corner = points[i];
    const next = points[i + 1];

    const inLength = Math.hypot(corner.x - previous.x, corner.y - previous.y);
    const outLength = Math.hypot(next.x - corner.x, next.y - corner.y);
    // Never consume more than half of either adjoining segment.
    const radius = Math.min(CORNER, inLength / 2, outLength / 2);

    if (radius < 0.5) {
      parts.push(`L ${corner.x} ${corner.y}`);
      continue;
    }

    const entry = {
      x: corner.x - ((corner.x - previous.x) / inLength) * radius,
      y: corner.y - ((corner.y - previous.y) / inLength) * radius,
    };
    const exit = {
      x: corner.x + ((next.x - corner.x) / outLength) * radius,
      y: corner.y + ((next.y - corner.y) / outLength) * radius,
    };

    parts.push(`L ${entry.x} ${entry.y}`, `Q ${corner.x} ${corner.y} ${exit.x} ${exit.y}`);
  }

  const last = points[points.length - 1];
  parts.push(`L ${last.x} ${last.y}`);
  return parts.join(' ');
}

interface EdgeLayerProps {
  edges: RoutedEdge[];
  width: number;
  height: number;
  /** Transition ids to draw emphasised — the hovered or currently-enabled ones. */
  emphasised: Set<string>;
  /** True while simulating, which dims everything not emphasised. */
  dimUnemphasised: boolean;
}

export function EdgeLayer({ edges, width, height, emphasised, dimUnemphasised }: EdgeLayerProps) {
  return (
    <svg
      className="pointer-events-none absolute left-0 top-0 overflow-visible"
      width={width}
      height={height}
      aria-hidden
    >
      <defs>
        <marker
          id="edge-arrow"
          viewBox="0 0 8 8"
          refX="6"
          refY="4"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 6 4 L 0 7 z" className="fill-muted-foreground" />
        </marker>
        <marker
          id="edge-arrow-active"
          viewBox="0 0 8 8"
          refX="6"
          refY="4"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 6 4 L 0 7 z" className="fill-primary" />
        </marker>
      </defs>

      {edges.map((edge) => {
        const isEmphasised = emphasised.has(edge.transitionId);
        return (
          <path
            key={edge.id}
            d={roundedPath(edge.points)}
            fill="none"
            strokeWidth={isEmphasised ? 1.5 : 1}
            className={
              isEmphasised
                ? 'stroke-primary'
                : dimUnemphasised
                  ? 'stroke-muted-foreground/25'
                  : 'stroke-muted-foreground/60'
            }
            markerEnd={
              edge.leg === 'out'
                ? isEmphasised
                  ? 'url(#edge-arrow-active)'
                  : 'url(#edge-arrow)'
                : undefined
            }
          />
        );
      })}
    </svg>
  );
}
