/**
 * VerifySignature.tsx
 * 
 * Page for verifying ZK-signed documents with selective disclosure.
 */

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { verifyWithDisclosure, VerificationResult, ZKProof } from "../managed/docusign";
import { sha256 } from "../lib/utils";

interface VerifyState {
  status: "idle" | "verifying" | "verified" | "error";
  result: VerificationResult | null;
  error: string | null;
}

export function VerifySignature() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [proofString, setProofString] = useState("");
  const [verifyState, setVerifyState] = useState<VerifyState>({
    status: "idle",
    result: null,
    error: null,
  });
  const [isDragging, setIsDragging] = useState(false);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) setSelectedFile(file);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  }, []);

  const handleVerify = useCallback(async () => {
    if (!selectedFile || !proofString) {
      setVerifyState(prev => ({
        ...prev,
        status: "error",
        error: "Please provide both the document and proof string"
      }));
      return;
    }

    setVerifyState({ status: "verifying", result: null, error: null });

    try {
      // Hash the uploaded document
      const fileBuffer = await selectedFile.arrayBuffer();
      const documentHash = await sha256(fileBuffer);
      
      // Create mock proof object from the proof string
      const proof: ZKProof = {
        proof: new TextEncoder().encode(proofString),
        publicSignals: [new TextEncoder().encode(documentHash)]
      };

      // Verify with selective disclosure
      const result = await verifyWithDisclosure(proof, documentHash);
      
      setVerifyState({
        status: "verified",
        result,
        error: null
      });
    } catch (err: any) {
      setVerifyState({
        status: "error",
        result: null,
        error: err.message || "Verification failed"
      });
    }
  }, [selectedFile, proofString]);

  const handleReset = useCallback(() => {
    setSelectedFile(null);
    setProofString("");
    setVerifyState({ status: "idle", result: null, error: null });
  }, []);

  return (
    <div className="space-bg min-h-screen">
      {/* Header */}
      <header className="border-b border-white/5 bg-midnight-900/50 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <a href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="text-lg font-bold text-white">NightSign</span>
          </a>
          <nav className="flex items-center gap-6">
            <a href="/" className="text-sm text-white/60 hover:text-white transition-colors">
              Sign Document
            </a>
            <span className="text-sm text-cyan-400">Verify Signature</span>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-3xl font-bold text-white mb-3">
            Verify Signature
          </h1>
          <p className="text-white/50">
            Verify a zero-knowledge proof with selective disclosure
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {verifyState.status === "verified" && verifyState.result ? (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              {/* Verification Result Card */}
              <div className="glass-card p-6">
                <div className="flex items-center gap-3 mb-6">
                  {verifyState.result.isValid ? (
                    <>
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                        <svg className="h-6 w-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">Signature Verified</h3>
                        <p className="text-sm text-white/50">Zero-knowledge proof is valid</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
                        <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">Invalid Signature</h3>
                        <p className="text-sm text-white/50">Proof verification failed</p>
                      </div>
                    </>
                  )}
                </div>

                {/* Selective Disclosure Cards */}
                <div className="space-y-3">
                  <DisclosureCard
                    label="Document Integrity"
                    verified={verifyState.result.disclosures.documentIntegrity}
                    description={verifyState.result.details.documentMatch}
                  />
                  <DisclosureCard
                    label="Signer Authenticity"
                    verified={verifyState.result.disclosures.signerAuthenticity}
                    description={verifyState.result.details.signerValid}
                  />
                  <DisclosureCard
                    label="Timestamp Disclosure"
                    verified={verifyState.result.disclosures.timestampDisclosure}
                    description={verifyState.result.details.signedAt 
                      ? `Signed at: ${verifyState.result.details.signedAt}` 
                      : "No timestamp available"}
                  />
                </div>
              </div>

              <button
                onClick={handleReset}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-medium text-white transition-colors hover:bg-white/10"
              >
                Verify Another Document
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* File Drop Zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileDrop}
                className={`glass-card flex flex-col items-center justify-center p-8 transition-all ${
                  isDragging ? "border-cyan-500/50 bg-cyan-500/5" : ""
                } ${selectedFile ? "border-emerald-500/30" : ""}`}
              >
                {selectedFile ? (
                  <div className="flex items-center gap-3 text-emerald-400">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-medium">{selectedFile.name}</span>
                  </div>
                ) : (
                  <>
                    <svg className="h-12 w-12 text-white/20 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-white/60 mb-2">Drop your document here</p>
                    <label className="cursor-pointer text-sm text-cyan-400 hover:text-cyan-300">
                      or browse files
                      <input type="file" className="hidden" onChange={handleFileSelect} />
                    </label>
                  </>
                )}
              </div>

              {/* Proof String Input */}
              <div className="glass-card p-4">
                <label className="block text-xs text-white/40 mb-2">
                  ZK-Proof String
                </label>
                <textarea
                  value={proofString}
                  onChange={(e) => setProofString(e.target.value)}
                  placeholder="Paste the proof string from the signature..."
                  className="w-full bg-black/20 rounded-lg p-3 text-sm text-white placeholder-white/30 font-mono resize-none h-24 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                />
              </div>

              {/* Error Message */}
              {verifyState.error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400"
                >
                  {verifyState.error}
                </motion.div>
              )}

              {/* Verify Button */}
              <button
                onClick={handleVerify}
                disabled={verifyState.status === "verifying" || !selectedFile || !proofString}
                className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 px-4 py-4 font-semibold text-white transition-all hover:from-cyan-400 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {verifyState.status === "verifying" ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Verifying...
                  </span>
                ) : (
                  "Verify Signature"
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// Disclosure Card Component
function DisclosureCard({ 
  label, 
  verified, 
  description 
}: { 
  label: string; 
  verified: boolean; 
  description: string;
}) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${
      verified 
        ? "bg-emerald-500/5 border-emerald-500/20" 
        : "bg-red-500/5 border-red-500/20"
    }`}>
      <div className={`flex h-6 w-6 items-center justify-center rounded-full ${
        verified ? "bg-emerald-500/10" : "bg-red-500/10"
      }`}>
        {verified ? (
          <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </div>
      <div>
        <p className={`text-sm font-medium ${verified ? "text-emerald-400" : "text-red-400"}`}>
          {label}
        </p>
        <p className="text-xs text-white/50">{description}</p>
      </div>
    </div>
  );
}

export default VerifySignature;
