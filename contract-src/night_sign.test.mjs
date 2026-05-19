// =====================================================================
// NightSign circuit tests
//
// Exercises the compiled contract against the in-process compact-runtime.
// Tests circuit LOGIC (state transitions, asserts) — proof generation
// itself is skipped because the contract was compiled with --skip-zk.
// To test proving, recompile with `npm run compact:zk` and add proof
// assertions.
//
// Run: node --test contract/src/night_sign.test.mjs
// =====================================================================

import { test } from "node:test";
import { strict as assert } from "node:assert";

import {
  Contract,
  ledger,
} from "../src/managed/night_sign/contract/index.js";
import {
  createConstructorContext,
  createCircuitContext,
  dummyContractAddress,
} from "@midnight-ntwrk/compact-runtime";

// ---------- fixtures ----------

const EMPTY_PRIVATE_STATE = Object.freeze({});
const TEST_COIN_PK = "0".repeat(64);

const secretBytes = (seed) => new Uint8Array(32).fill(seed);
const docHash = (seed) => new Uint8Array(32).fill(seed);

const makeContract = (secret) =>
  new Contract({
    signer_secret: (ctx) => [ctx.privateState, secret],
  });

function deploy(docHashBytes, requiredSigners, secret) {
  const contract = makeContract(secret);
  const ctorCtx = createConstructorContext(
    EMPTY_PRIVATE_STATE,
    TEST_COIN_PK,
  );
  const initResult = contract.initialState(
    ctorCtx,
    docHashBytes,
    requiredSigners,
  );
  return { contract, state: initResult };
}

function callSign(contract, state, docId) {
  const circuitCtx = createCircuitContext(
    dummyContractAddress(),
    TEST_COIN_PK,
    state.currentContractState,
    state.currentPrivateState,
  );
  return contract.impureCircuits.sign_document(circuitCtx, docId);
}

// Pulls the high-level Ledger view out of a circuit/constructor result.
const ledgerOf = (s) => ledger(s.currentContractState.data);
const ledgerAfter = (result) =>
  ledger(result.context.currentQueryContext.state);

// ---------- tests ----------

test("happy path: single sign flips is_executed", () => {
  const dh = docHash(0xaa);
  const { contract, state } = deploy(dh, 1n, secretBytes(0x01));

  const before = ledgerOf(state);
  assert.equal(before.is_executed, false);
  assert.equal(before.signature_count, 0n);
  assert.equal(before.required_signers, 1n);

  const signed = callSign(contract, state, dh);
  const after = ledgerAfter(signed);

  assert.equal(after.signature_count, 1n);
  assert.equal(after.is_executed, true);
});

test("wrong doc_id rejected", () => {
  const dh = docHash(0xaa);
  const wrong = docHash(0xbb);
  const { contract, state } = deploy(dh, 1n, secretBytes(0x01));

  assert.throws(
    () => callSign(contract, state, wrong),
    /document hash mismatch/i,
  );
});

test("double-sign with same secret blocked by nullifier set", () => {
  const dh = docHash(0xcc);
  const { contract, state } = deploy(dh, 2n, secretBytes(0x07));

  const firstSign = callSign(contract, state, dh);
  const afterFirst = ledgerAfter(firstSign);
  assert.equal(afterFirst.signature_count, 1n);
  assert.equal(afterFirst.is_executed, false);

  // Carry state forward into a second call. Same contract instance
  // means same witness secret, which means same derived pk → nullifier
  // hit on the second insert.
  const nextState = {
    currentContractState: firstSign.context.currentQueryContext.state,
    currentPrivateState: firstSign.context.currentPrivateState,
  };
  assert.throws(
    () => callSign(contract, nextState, dh),
    /already signed/i,
  );
});

test("threshold respected: 1 of 2 signs doesn't trigger execution", () => {
  const dh = docHash(0xdd);
  const { contract, state } = deploy(dh, 2n, secretBytes(0x42));

  const signed = callSign(contract, state, dh);
  const after = ledgerAfter(signed);

  assert.equal(after.signature_count, 1n);
  assert.equal(
    after.is_executed,
    false,
    "single sig must not flip execution when threshold=2",
  );
});

test("threshold met: two distinct signers flip is_executed", () => {
  const dh = docHash(0xee);
  const signerA = secretBytes(0x10);
  const signerB = secretBytes(0x20);

  // Signer A
  const { contract: contractA, state } = deploy(dh, 2n, signerA);
  const afterA = callSign(contractA, state, dh);
  assert.equal(ledgerAfter(afterA).signature_count, 1n);
  assert.equal(ledgerAfter(afterA).is_executed, false);

  // Signer B picks up the state and signs with a different secret.
  // Different secret → different persistentHash → different pk → not
  // in nullifier set → accepted.
  const contractB = makeContract(signerB);
  const stateB = {
    currentContractState: afterA.context.currentQueryContext.state,
    currentPrivateState: afterA.context.currentPrivateState,
  };
  const afterB = callSign(contractB, stateB, dh);
  const finalLedger = ledgerAfter(afterB);

  assert.equal(finalLedger.signature_count, 2n);
  assert.equal(finalLedger.is_executed, true);
});

test("post-execution: further signatures rejected", () => {
  const dh = docHash(0xff);
  const { contract, state } = deploy(dh, 1n, secretBytes(0x55));

  const signed = callSign(contract, state, dh);
  assert.equal(ledgerAfter(signed).is_executed, true);

  // A different signer trying after execution: blocked by the
  // !is_executed pre-condition.
  const contractC = makeContract(secretBytes(0x66));
  const stateAfter = {
    currentContractState: signed.context.currentQueryContext.state,
    currentPrivateState: signed.context.currentPrivateState,
  };
  assert.throws(
    () => callSign(contractC, stateAfter, dh),
    /already executed/i,
  );
});
