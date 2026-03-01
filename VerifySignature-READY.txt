/**
 * VerifySignature.tsx
 * * Page for verifying ZK-signed documents with selective disclosure.
 */

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMidnightWallet } from "../hooks/useMidnightWallet";
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

  // Wallet hook
  const { isConnected, connect: connectWallet, accountId, status: walletStatus } = useMidnightWallet();
  
  // Theme state
  const [isDarkMode, setIsDarkMode] = useState(true);
  
  // Sync dark mode with documentElement
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Auto-verify from QR code URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const docId = urlParams.get('doc_id');
    const proof = urlParams.get('proof');
    
    if (docId && proof) {
      console.log("🔗 Auto-verifying from QR code...");
      setProofString(decodeURIComponent(proof));
      
      setTimeout(async () => {
        setVerifyState({ status: "verifying", result: null, error: null });
        try {
          const proofObj: ZKProof = {
            proof: new TextEncoder().encode(decodeURIComponent(proof)),
            publicSignals: [new TextEncoder().encode(docId)]
          };
          const result = await verifyWithDisclosure(proofObj, docId);
          setVerifyState({ status: "verified", result, error: null });
        } catch (err: any) {
          setVerifyState({ status: "error", result: null, error: err.message || "Auto-verification failed" });
        }
      }, 500);
    }
  }, []);

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
      setVerifyState(prev => ({ ...prev, status: "error", error: "Please provide both the document and proof string" }));
      return;
    }
    setVerifyState({ status: "verifying", result: null, error: null });
    try {
      const fileBuffer = await selectedFile.arrayBuffer();
      const documentHash = await sha256(fileBuffer);
      const proof: ZKProof = {
        proof: new TextEncoder().encode(proofString),
        publicSignals: [new TextEncoder().encode(documentHash)]
      };
      const result = await verifyWithDisclosure(proof, documentHash);
      setVerifyState({ status: "verified", result, error: null });
    } catch (err: any) {
      setVerifyState({ status: "error", result: null, error: err.message || "Verification failed" });
    }
  }, [selectedFile, proofString]);

  const handleReset = useCallback(() => {
    setSelectedFile(null);
    setProofString("");
    setVerifyState({ status: "idle", result: null, error: null });
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020617] transition-colors duration-300">
      {/* Premium Navbar */}
      <nav className="w-full flex justify-between items-center px-6 py-4 bg-white/80 dark:bg-white/5 backdrop-blur-md border-b border-slate-200 dark:border-white/10 transition-colors duration-300 sticky top-0 z-50">
        <div className="flex items-center cursor-pointer" onClick={() => window.location.href='/'}>
          <img src="/logo.png" alt="NightSign" className="h-14 -ml-3 dark:invert drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.2)] transition-all" />
        </div>
        <div className="flex gap-4 items-center">
          {/* Wallet Status / Connect */}
          {isConnected ? (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {accountId?.substring(0, 8)}...
            </span>
          ) : (
            <button 
              onClick={() => connectWallet()}
              className="text-xs px-3 py-1.5 rounded-lg bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/20 dark:hover:bg-cyan-500/30 transition-colors"
            >
              {walletStatus === 'connecting' ? 'Connecting...' : 'Connect'}
            </button>
          )}
          
          {/* Theme Toggle */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
          >
            {isDarkMode ? (
              <svg className="w-5 h-5 text-slate-600 dark:text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
          <button onClick={() => window.location.href='/'} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors font-medium">Sign Document</button>
          <span className="text-cyan-600 dark:text-cyan-400 font-semibold border-b-2 border-cyan-500 pb-1">Verify Signature</span>
        </div>
      </nav>

      <main className="pt-16 mx-auto max-w-2xl px-4 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">Verify Signature</h1>
          <p className="text-slate-600 dark:text-slate-400">Verify a zero-knowledge proof with selective disclosure</p>
        </motion.div>

        <AnimatePresence mode="wait">
          {verifyState.status === "verified" && verifyState.result ? (
            <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
              
              <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/10 shadow-xl dark:shadow-none rounded-2xl p-8">
                <div className="flex items-center gap-4 mb-8 border-b border-slate-100 dark:border-white/5 pb-6">
                  {verifyState.result.isValid ? (
                    <>
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/20 ring-4 ring-emerald-50 dark:ring-emerald-500/10">
                        <svg className="h-7 w-7 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Signature Verified</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Zero-knowledge proof is cryptographically valid</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/20 ring-4 ring-red-50 dark:ring-red-500/10">
                        <svg className="h-7 w-7 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Invalid Signature</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Proof verification completely failed</p>
                      </div>
                    </>
                  )}
                </div>

                <div className="space-y-4">
                  <DisclosureCard label="Document Integrity" verified={verifyState.result.disclosures.documentIntegrity} description={verifyState.result.details.documentMatch} />
                  <DisclosureCard label="Signer Authenticity" verified={verifyState.result.disclosures.signerAuthenticity} description={verifyState.result.details.signerValid} />
                  <DisclosureCard label="Timestamp Disclosure" verified={verifyState.result.disclosures.timestampDisclosure} description={verifyState.result.details.signedAt ? `Signed at: ${verifyState.result.details.signedAt}` : "No timestamp available"} />
                </div>
              </div>

              <button onClick={handleReset} className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-4 font-medium text-slate-700 dark:text-white transition-all hover:bg-slate-50 dark:hover:bg-white/10 shadow-sm">
                Verify Another Document
              </button>
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              
              {/* Premium File Dropzone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileDrop}
                className={`bg-white dark:bg-[#0f172a] border-2 border-dashed ${isDragging ? "border-cyan-500 bg-cyan-50 dark:bg-cyan-500/10" : selectedFile ? "border-emerald-500/50 bg-emerald-50 dark:bg-emerald-500/5" : "border-slate-300 dark:border-white/20"} rounded-2xl flex flex-col items-center justify-center p-10 transition-all shadow-xl dark:shadow-none cursor-pointer hover:border-cyan-400`}
              >
                {selectedFile ? (
                  <div className="flex flex-col items-center gap-3 text-emerald-600 dark:text-emerald-400">
                    <div className="p-3 bg-emerald-100 dark:bg-emerald-500/20 rounded-full">
                       <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <span className="font-semibold text-lg text-slate-800 dark:text-emerald-200">{selectedFile.name}</span>
                    <span className="text-xs text-slate-500 dark:text-emerald-400/60">Ready to verify</span>
                  </div>
                ) : (
                  <>
                    <div className="p-4 bg-slate-100 dark:bg-white/5 rounded-full mb-4 group-hover:bg-cyan-50 dark:group-hover:bg-cyan-500/10 transition-colors">
                      <svg className="h-10 w-10 text-slate-400 dark:text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                    </div>
                    <p className="text-slate-700 dark:text-white/80 font-medium mb-1">Drop your original document here</p>
                    <label className="cursor-pointer text-sm text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 font-medium">
                      or click to browse files
                      <input type="file" className="hidden" onChange={handleFileSelect} />
                    </label>
                  </>
                )}
              </div>

              {/* Premium Proof Input */}
              <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/10 shadow-xl dark:shadow-none rounded-2xl p-6">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                  Zero-Knowledge Proof String
                </label>
                <textarea
                  value={proofString}
                  onChange={(e) => setProofString(e.target.value)}
                  placeholder="Paste the 'onchain_...' proof string here..."
                  className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 font-mono text-sm resize-none h-32 p-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
                />
              </div>

              {verifyState.error && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-4 text-sm text-red-600 dark:text-red-400 font-medium flex items-center gap-2">
                  <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {verifyState.error}
                </motion.div>
              )}

              <button
                onClick={handleVerify}
                disabled={verifyState.status === "verifying" || !selectedFile || !proofString}
                className="w-full rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 dark:from-cyan-600 dark:to-purple-600 px-4 py-4 font-bold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                {verifyState.status === "verifying" ? (
                  <span className="flex items-center justify-center gap-3">
                    <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                    Executing ZK Verification...
                  </span>
                ) : (
                  "Verify Authenticity"
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
function DisclosureCard({ label, verified, description }: { label: string; verified: boolean; description: string; }) {
  return (
    <div className={`flex items-start gap-4 p-4 rounded-xl border ${verified ? "bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20" : "bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-500/20"}`}>
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full mt-0.5 ${verified ? "bg-emerald-100 dark:bg-emerald-500/20" : "bg-red-100 dark:bg-red-500/20"}`}>
        {verified ? (
           <svg className="h-5 w-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
        ) : (
           <svg className="h-5 w-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
        )}
      </div>
      <div>
        <p className={`text-base font-bold mb-0.5 ${verified ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>{label}</p>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

export default VerifySignature;