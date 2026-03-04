import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Document = { signatureCount: bigint; isFullyExecuted: boolean };

export type Witnesses<PS> = {
}

export type ImpureCircuits<PS> = {
  sign_document(context: __compactRuntime.CircuitContext<PS>, docHash_0: string): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  sign_document(context: __compactRuntime.CircuitContext<PS>, docHash_0: string): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  documentVault: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: string): boolean;
    lookup(key_0: string): Document;
    [Symbol.iterator](): Iterator<[string, Document]>
  };
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
