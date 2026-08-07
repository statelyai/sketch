/**
 * ════════════════════════════════════════════════════════════════════════════
 * WHO ACTS — attributing every transition to the party that submits it
 * ════════════════════════════════════════════════════════════════════════════
 *
 * A statechart says what may happen next. It does not say WHOSE move it is, and for a two-party
 * agreement that is the first thing a reader needs: "whose turn is it, and what may they do?"
 *
 * THE HONEST COMPLICATION. A buyer/seller deal does not have two submitters — it has five, and
 * collapsing them into two would misrepresent authority in the one place it matters most:
 *
 *   • BUYER agent and SELLER agent      — the two parties, the primary lanes
 *   • SELLER'S HUMAN                    — a DIFFERENT actor from the seller's agent. It may accept
 *                                         below the agent's mandated floor, which is the whole
 *                                         point of escalation. Painting it "seller" would hide the
 *                                         only authority the agent never held.
 *   • the CHAIN (watcher)               — not a party at all. Money advances only when an
 *                                         observation says it did; the observation is untrusted
 *                                         input, not somebody's turn.
 *   • ANYONE, after a deadline          — the permissionless fallback that stops funds stranding.
 *
 * So this module models five, and the UI shows BUYER and SELLER as the two lanes while marking the
 * other three as what they are. A tool that labelled a chain observation "seller's turn" would be
 * lying about who can make the deal move.
 *
 * WHERE THE ATTRIBUTION COMES FROM. A machine definition does not carry it — and in the NEC machine
 * the field that used to assert it (`by: "BUYER" | "SELLER"`) was caller-supplied, which is exactly
 * the defect its own PRD records as P0-2: a seller could claim to be the buyer and skip the floor
 * check. So attribution here is a DECLARED MAP, keyed by machine id, sourced from the doc comment on
 * each event in the machine itself. It is display metadata, never a security claim — the real answer
 * has to be derived from signed terms at commit time, in the runtime, not inferred in a viewer.
 */

export type ActorId = 'buyer' | 'seller' | 'seller-human' | 'chain' | 'anyone' | 'either';

export interface Actor {
  id: ActorId;
  /** Short label for a transition box, where space is tight. */
  short: string;
  /** Full label for the legend and the stepper. */
  label: string;
  /** True for the two principals. The others are shown, but never as "whose turn". */
  isParty: boolean;
  /** Tailwind classes: text, border and background accents. */
  className: { text: string; border: string; bg: string; dot: string };
}

export const ACTORS: Record<ActorId, Actor> = {
  buyer: {
    id: 'buyer',
    short: 'BUYER',
    label: 'Buyer agent',
    isParty: true,
    className: {
      text: 'text-sky-300',
      border: 'border-l-sky-400',
      bg: 'bg-sky-400/10',
      dot: 'bg-sky-400',
    },
  },
  seller: {
    id: 'seller',
    short: 'SELLER',
    label: 'Seller agent',
    isParty: true,
    className: {
      text: 'text-amber-300',
      border: 'border-l-amber-400',
      bg: 'bg-amber-400/10',
      dot: 'bg-amber-400',
    },
  },
  'seller-human': {
    id: 'seller-human',
    short: 'HUMAN',
    label: "Seller's human",
    isParty: true,
    className: {
      text: 'text-fuchsia-300',
      border: 'border-l-fuchsia-400',
      bg: 'bg-fuchsia-400/10',
      dot: 'bg-fuchsia-400',
    },
  },
  chain: {
    id: 'chain',
    short: 'CHAIN',
    label: 'Chain observation (not a party)',
    isParty: false,
    className: {
      text: 'text-emerald-300',
      border: 'border-l-emerald-400',
      bg: 'bg-emerald-400/10',
      dot: 'bg-emerald-400',
    },
  },
  anyone: {
    id: 'anyone',
    short: 'ANYONE',
    label: 'Anyone, after the deadline',
    isParty: false,
    className: {
      text: 'text-zinc-300',
      border: 'border-l-zinc-400',
      bg: 'bg-zinc-400/10',
      dot: 'bg-zinc-400',
    },
  },
  either: {
    id: 'either',
    short: 'EITHER',
    label: 'Either party',
    isParty: true,
    className: {
      text: 'text-violet-300',
      border: 'border-l-violet-400',
      bg: 'bg-violet-400/10',
      dot: 'bg-violet-400',
    },
  },
};

/**
 * Declared attribution for the NEC data deal, quoting the machine's own event doc comments.
 *
 * `either` is not vagueness on my part — the machine genuinely permits both sides to offer, accept
 * and terminate, and it is that symmetry which made the caller-supplied `by` field load-bearing and
 * therefore exploitable.
 */
const NEC_DATA_DEAL: Record<string, ActorId> = {
  // "Seller answers the buyer's query: sample, statistics commitment, and opening price."
  SAMPLE_QUOTED: 'seller',
  // "Either side puts a price on the table."
  OFFER: 'either',
  // "Either side accepts the other's price."
  OFFER_ACCEPTED: 'either',
  // "The seller agent hit the edge of its authority and is asking its human."
  ESCALATE: 'seller',
  // "The seller's HUMAN resolves an escalation. The only human-in-the-loop event."
  SELLER_DECISION: 'seller-human',
  // "Negotiation ended with no agreement (e.g. the buyer's ceiling was exceeded)."
  WALK_AWAY: 'buyer',
  // "Both sides signed; ask the money plane to escrow the funds." Funding is the buyer's to authorize.
  ACTIVATE: 'buyer',
  // "A chain watcher reports an on-chain event. UNTRUSTED."
  SETTLEMENT_OBSERVED: 'chain',
  // The escrow's permissionless timeout paths — nothing we signed caused it.
  TIMEOUT_SETTLEMENT_OBSERVED: 'chain',
  // "Seller attests the delivered artifact by hash."
  DELIVERY_ATTESTED: 'seller',
  // "Buyer verified the artifact and accepts it."
  DELIVERY_ACCEPTED: 'buyer',
  // "Buyer verified the artifact and rejects it for cause."
  DELIVERY_REJECTED: 'buyer',
  // "The delivery window elapsed" — a deadline, so whoever notices.
  DELIVERY_DEADLINE_MISSED: 'anyone',
  // "Abandon the deal before any money is escrowed."
  TERMINATE: 'either',
};

/** Declared maps, keyed by machine id. */
const DECLARED: Record<string, Record<string, ActorId>> = {
  'kite-nec-data-deal-v2': NEC_DATA_DEAL,
};

/**
 * Fallback for a machine with no declared map.
 *
 * Deliberately conservative: it only claims an actor where the event name states one outright, and
 * returns `null` otherwise. Guessing "probably the buyer" from an unfamiliar event name would put an
 * authority claim on screen that nothing supports.
 */
function heuristicActor(eventType: string): ActorId | null {
  const name = eventType.toUpperCase();
  if (name.includes('OBSERVED') || name.includes('ONCHAIN') || name.includes('ON_CHAIN')) return 'chain';
  if (name.includes('DEADLINE') || name.includes('TIMEOUT') || name.includes('EXPIRED')) return 'anyone';
  if (name.includes('HUMAN') || name.includes('APPROVAL')) return 'seller-human';
  if (name.startsWith('BUYER_')) return 'buyer';
  if (name.startsWith('SELLER_')) return 'seller';
  return null;
}

/**
 * Who submits this event? `null` means unattributed, and the UI shows nothing rather than a guess.
 *
 * Internal XState events (`xstate.after(…)`, `xstate.done.*`) are attributed to no one: a delay
 * elapsing is not an actor's move.
 */
export function actorForEvent(machineId: string | undefined, eventType: string): Actor | null {
  if (!eventType || eventType === '(always)' || eventType.startsWith('xstate.')) return null;
  const declared = machineId ? DECLARED[machineId]?.[eventType] : undefined;
  const id = declared ?? heuristicActor(eventType);
  return id ? ACTORS[id] : null;
}

/** Does this machine have a hand-declared actor map, or is it running on heuristics? */
export function hasDeclaredActors(machineId: string | undefined): boolean {
  return Boolean(machineId && DECLARED[machineId]);
}

/**
 * Who owes the next move, given the events currently available.
 *
 * "Ball in court" counts only the PARTIES. If the only thing that can happen is a chain observation
 * or a deadline, nobody owes a move — the deal is waiting on the world, not on a person, and saying
 * "seller's turn" there would be wrong. That distinction is the difference between "they are late"
 * and "we are waiting".
 */
export function ballInCourt(actors: Array<Actor | null>): {
  waitingOn: Actor[];
  nonParty: Actor[];
} {
  const seen = new Map<ActorId, Actor>();
  for (const actor of actors) {
    if (actor) seen.set(actor.id, actor);
  }
  const all = [...seen.values()];
  return {
    waitingOn: all.filter((a) => a.isParty),
    nonParty: all.filter((a) => !a.isParty),
  };
}
