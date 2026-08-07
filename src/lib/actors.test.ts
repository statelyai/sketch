import { describe, expect, it } from 'vitest';
import { actorForEvent, ballInCourt, hasDeclaredActors } from './actors';

const NEC = 'kite-nec-data-deal-v2';

describe('actorForEvent', () => {
  it('attributes each NEC event to the submitter its doc comment names', () => {
    expect(actorForEvent(NEC, 'SAMPLE_QUOTED')?.id).toBe('seller');
    expect(actorForEvent(NEC, 'DELIVERY_ATTESTED')?.id).toBe('seller');
    expect(actorForEvent(NEC, 'ESCALATE')?.id).toBe('seller');

    expect(actorForEvent(NEC, 'ACTIVATE')?.id).toBe('buyer');
    expect(actorForEvent(NEC, 'DELIVERY_ACCEPTED')?.id).toBe('buyer');
    expect(actorForEvent(NEC, 'DELIVERY_REJECTED')?.id).toBe('buyer');
  });

  /**
   * The seller's human is NOT the seller's agent. It may accept below the agent's mandated floor,
   * which is the entire point of escalation — merging them would hide the only authority the agent
   * never held.
   */
  it('keeps the seller human distinct from the seller agent', () => {
    expect(actorForEvent(NEC, 'SELLER_DECISION')?.id).toBe('seller-human');
    expect(actorForEvent(NEC, 'SELLER_DECISION')?.isParty).toBe(true);
  });

  /** Money advances on observation, not on anybody's turn. */
  it('attributes chain observations to a non-party actor', () => {
    for (const event of ['SETTLEMENT_OBSERVED', 'TIMEOUT_SETTLEMENT_OBSERVED']) {
      const actor = actorForEvent(NEC, event);
      expect(actor?.id).toBe('chain');
      expect(actor?.isParty).toBe(false);
    }
  });

  it('marks the deadline exit as available to anyone, and not a party', () => {
    const actor = actorForEvent(NEC, 'DELIVERY_DEADLINE_MISSED');
    expect(actor?.id).toBe('anyone');
    expect(actor?.isParty).toBe(false);
  });

  it('marks the symmetric negotiation events as either party', () => {
    expect(actorForEvent(NEC, 'OFFER')?.id).toBe('either');
    expect(actorForEvent(NEC, 'OFFER_ACCEPTED')?.id).toBe('either');
    expect(actorForEvent(NEC, 'TERMINATE')?.id).toBe('either');
  });

  it('attributes nothing to internal xstate events', () => {
    expect(actorForEvent(NEC, 'xstate.after(5000).foo')).toBeNull();
    expect(actorForEvent(NEC, '(always)')).toBeNull();
    expect(actorForEvent(NEC, '')).toBeNull();
  });

  /** Guessing an actor puts an authority claim on screen that nothing supports. */
  it('returns null rather than guessing for an unknown machine and event', () => {
    expect(hasDeclaredActors('some-other-machine')).toBe(false);
    expect(actorForEvent('some-other-machine', 'FROBNICATE')).toBeNull();
  });

  it('falls back to conservative name heuristics for undeclared machines', () => {
    expect(actorForEvent('other', 'PAYMENT_OBSERVED')?.id).toBe('chain');
    expect(actorForEvent('other', 'REVIEW_DEADLINE_PASSED')?.id).toBe('anyone');
    expect(actorForEvent('other', 'BUYER_SIGNED')?.id).toBe('buyer');
  });
});

describe('ballInCourt', () => {
  it('separates parties who owe a move from non-party actors', () => {
    const result = ballInCourt([
      actorForEvent(NEC, 'DELIVERY_ACCEPTED'), // buyer
      actorForEvent(NEC, 'DELIVERY_DEADLINE_MISSED'), // anyone
    ]);
    expect(result.waitingOn.map((a) => a.id)).toEqual(['buyer']);
    expect(result.nonParty.map((a) => a.id)).toEqual(['anyone']);
  });

  /**
   * `funding` is the case that matters: its only exit is a chain observation. Nobody is late — the
   * deal is waiting on the world, and the UI must not name a party.
   */
  it('reports nobody waiting when only the chain can move the deal', () => {
    const result = ballInCourt([actorForEvent(NEC, 'SETTLEMENT_OBSERVED')]);
    expect(result.waitingOn).toEqual([]);
    expect(result.nonParty.map((a) => a.id)).toEqual(['chain']);
  });

  it('deduplicates repeated actors', () => {
    const result = ballInCourt([
      actorForEvent(NEC, 'DELIVERY_ACCEPTED'),
      actorForEvent(NEC, 'DELIVERY_REJECTED'),
      null,
    ]);
    expect(result.waitingOn.map((a) => a.id)).toEqual(['buyer']);
  });
});
