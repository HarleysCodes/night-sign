// =====================================================================
// NightSign Prover — TypeScript interface
//
// Runs in the user's browser / wallet context. Responsibilities:
//   1. Hash the document locally (SHA-256, never uploaded).
//   2. Supply the signer's secret as a witness to the Compact circuit.
//   3. Hand the resulting proof + public inputs to a submitter.
//
// Non-Custodial Mandate (PRINCIPLES §1):
//   - signer_secret MUST NOT be persisted, logged, or transmitted.
//   - The Prover is a transient holder; the secret leaves scope as
//     soon as proof generation returns.
// =====================================================================

import type {
  Witnesses,
  Ledger,
} from "../managed/night_sign/contract/index.js";
import type { WitnessContext } from "@midnight-ntwrk/compact-runtime";

/**
 * Private state for the NightSign contract. The circuit doesn't read
 * persistent private state today (the witness sources its secret from
 * the SecretUnlocker each call), so PrivateState is empty. Reserved
 * for future use (e.g., signature history cache, derivation seeds).
 */
export type NightSignPrivateState = Record<string, never>;
export const initialPrivateState: NightSignPrivateState = Object.freeze({});

/**
 * Opaque handle to a freshly generated ZK proof. The shape is defined
 * by the Midnight runtime; we never inspect its bytes here.
 */
export type NightSignProof = {
  proof: Uint8Array;
  publicInputs: {
    /** SHA-256 of the document being signed. Matches sealed ledger state. */
    docId: Uint8Array;
  };
};

/**
 * Unlocks the signer's secret material. Async because real
 * implementations will prompt the user (passphrase, biometric,
 * hardware-key tap). The returned bytes must be zeroed by the
 * caller after the witness has consumed them.
 */
export interface SecretUnlocker {
  unlock(): Promise<Uint8Array>;
}

/**
 * Builds the Witnesses<PS> object the Compact runtime expects. The
 * shape — `signer_secret(ctx) => [PS, Uint8Array]` — is dictated by
 * the emitted bindings; do not change it without re-checking
 * `src/managed/night_sign/contract/index.d.ts`.
 *
 * The witness call is SYNCHRONOUS (the runtime collects all witnesses
 * inside circuit execution), so the secret must already be in memory
 * before the prover invokes `sign_document`. Use `SecretUnlocker` to
 * fetch it async, then close over it here.
 */
export function buildWitnesses(
  secret: Uint8Array,
): Witnesses<NightSignPrivateState> {
  return {
    signer_secret(
      ctx: WitnessContext<Ledger, NightSignPrivateState>,
    ): [NightSignPrivateState, Uint8Array] {
      return [ctx.privateState, secret];
    },
  };
}

/**
 * The deployed NightSign contract address + minimal metadata the
 * prover needs to construct a valid call.
 */
export interface NightSignContract {
  address: string;
  /** Sealed at deployment — used to short-circuit obvious mismatches client-side. */
  documentHash: Uint8Array;
}

export interface NightSignProver {
  /**
   * Hash the document locally using Web Crypto SHA-256.
   * The document bytes are not retained.
   */
  hashDocument(document: ArrayBuffer | Uint8Array): Promise<Uint8Array>;

  /**
   * Generate a ZK proof attesting that the holder of signer_secret
   * has signed the document identified by docId.
   *
   * Throws if docId !== contract.documentHash (caught client-side
   * before round-tripping to the verifier).
   */
  proveSignature(
    contract: NightSignContract,
    docId: Uint8Array,
    unlocker: SecretUnlocker,
  ): Promise<NightSignProof>;
}

/**
 * Local SHA-256 of a document via Web Crypto. Exported separately
 * so the UI can display the hash before any prover state is touched
 * (Honesty Posture — CLAUDE.md "render the document hash being signed").
 */
export async function sha256(
  data: ArrayBuffer | Uint8Array,
): Promise<Uint8Array> {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return new Uint8Array(digest);
}
