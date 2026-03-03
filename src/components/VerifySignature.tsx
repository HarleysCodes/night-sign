import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMidnightWallet, getNetworkName, isCorrectNetwork } from "../hooks/useMidnightWallet";
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
  const { isConnected, connect: connectWallet, accountId, status: walletStatus, networkId, error: walletError, clearError } = useMidnightWallet();
  
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
          
          setVerifyState({
            status: "verified",
            result,
            error: null
          });
        } catch (err: any) {
          setVerifyState({
            status: "error",
            result: null,
            error: err.message || "Auto-verification failed"
          });
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
    if (!selectedFile && !proofString) {
      setVerifyState(prev => ({
        ...prev,
        status: "error",
        error: "Please provide both the document and proof string"
      }));
      return;
    }

    setVerifyState({ status: "verifying", result: null, error: null });

    try {
      let documentHash = "";
      
      if (selectedFile) {
        const fileBuffer = await selectedFile.arrayBuffer();
        documentHash = await sha256(fileBuffer);
      }
      
      const proof: ZKProof = {
        proof: new TextEncoder().encode(proofString),
        publicSignals: [new TextEncoder().encode(documentHash)]
      };

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
    <div className={`min-h-screen ${isDarkMode ? 'space-bg' : 'bg-slate-50'}`}>
      {/* Navbar - Exact clone from App.tsx */}
      <nav className={`fixed top-0 left-0 right-0 z-50 h-20 border-b ${isDarkMode ? 'border-white/10 bg-black/60' : 'border-slate-200 bg-white/80'} backdrop-blur-md`}>
        <div className="mx-auto flex h-full max-w-4xl items-center justify-between px-4">
          <div className="flex items-center" style={{ marginLeft: '-12px' }}>
            <img 
              src="/logo.png" 
              alt="NightSign" 
              className="w-auto"
              style={{ 
                height: '72px',
                filter: isDarkMode 
                  ? 'brightness(0) invert(1) drop-shadow(0 0 8px rgba(255, 255, 255, 0.2))'
                  : 'drop-shadow(0 0 4px rgba(0, 0, 0, 0.15))'
              }}
            />
          </div>
          
          <div className="flex items-center gap-4">
            {/* Theme Toggle */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDarkMode ? (
                <svg className="w-5 h-5 text-slate-700 dark:text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            
            {/* Sign Link - Inactive */}
            <a 
              href="/" 
              className="text-sm text-slate-600 dark:text-white/50 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors font-medium"
            >
              Sign
            </a>
            
            {/* Verify - Active */}
            <span className="text-cyan-600 dark:text-cyan-400 font-semibold border-b-2 border-cyan-500 pb-1">
              Verify
            </span>
            
            {/* Error toast */}
            {walletError && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-1.5"
              >
                <span className="text-xs text-red-400">{walletError}</span>
                <button onClick={clearError} className="text-slate-400 dark:text-white/50 hover:text-white">
                  ✕
                </button>
              </motion.div>
            )}
            
            {isConnected && accountId && networkId && (
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded ${
                  isCorrectNetwork(networkId) 
                    ? "bg-emerald-500/10 text-emerald-400" 
                    : "bg-yellow-500/10 text-yellow-400"
                }`}>
                  {getNetworkName(networkId)}
                </span>
                <span className="text-xs text-slate-600 dark:text-white/50">
                  {accountId.slice(0, 8)}...
                </span>
              </div>
            )}
            
            {isConnected ? (
              <button 
                onClick={() => window.location.reload()}
                className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-3 py-1.5 text-xs text-slate-700 dark:text-white/70 hover:bg-slate-200 dark:hover:bg-white/10"
              >
                Disconnect
              </button>
            ) : (
              <button 
                onClick={connectWallet}
                disabled={walletStatus === "connecting"}
                className="neon-button text-xs"
              >
                {walletStatus === "connecting" ? "Connecting..." : "Connect Midnight Wallet"}
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="pt-28 mx-auto max-w-2xl px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-3">
            Verify Signature
          </h1>
          <p className="text-slate-600 dark:text-white/50">
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
              <div className="glass-card p-6">
                <div className="flex items-center gap-3 mb-6">
                  {verifyState.result.isValid ? (
                    <>
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                        <svg className="h-6 w-6 text-emerald-400" fill="currentColor" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Signature Verified</h3>
                        <p className="text-sm text-slate-500 dark:text-white/50">Zero-knowledge proof is valid</p>
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
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Invalid Signature</h3>
                        <p className="text-sm text-slate-500 dark:text-white/50">Proof verification failed</p>
                      </div>
                    </>
                  )}
                </div>

                <div className="space-y-3">
                  <div className={`flex items-center gap-3 p-3 rounded-lg border ${
                    verifyState.result.disclosures.documentIntegrity 
                      ? "bg-emerald-500/5 border-emerald-500/20" 
                      : "bg-red-500/5 border-red-500/20"
                  }`}>
                    <div className={`flex h-6 w-6 items-center justify-center rounded-full ${
                      verifyState.result.disclosures.documentIntegrity ? "bg-emerald-500/10" : "bg-red-500/10"
                    }`}>
                      {verifyState.result.disclosures.documentIntegrity ? (
                        <svg className="h-4 w-4 text-emerald-400" fill="currentColor" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${verifyState.result.disclosures.documentIntegrity ? "text-emerald-400" : "text-red-400"}`}>
                        Document Integrity
                      </p>
                      <p className="text-xs text-slate-500 dark:text-white/50">{verifyState.result.details.documentMatch}</p>
                    </div>
                  </div>
                  
                  <div className={`flex items-center gap-3 p-3 rounded-lg border ${
                    verifyState.result.disclosures.signerAuthenticity 
                      ? "bg-emerald-500/5 border-emerald-500/20" 
                      : "bg-red-500/5 border-red-500/20"
                  }`}>
                    <div className={`flex h-6 w-6 items-center justify-center rounded-full ${
                      verifyState.result.disclosures.signerAuthenticity ? "bg-emerald-500/10" : "bg-red-500/10"
                    }`}>
                      {verifyState.result.disclosures.signerAuthenticity ? (
                        <svg className="h-4 w-4 text-emerald-400" fill="currentColor" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${verifyState.result.disclosures.signerAuthenticity ? "text-emerald-400" : "text-red-400"}`}>
                        Signer Authenticity
                      </p>
                      <p className="text-xs text-slate-500 dark:text-white/50">{verifyState.result.details.signerValid}</p>
                    </div>
                  </div>
                  
                  <div className={`flex items-center gap-3 p-3 rounded-lg border ${
                    verifyState.result.disclosures.timestampDisclosure 
                      ? "bg-emerald-500/5 border-emerald-500/20" 
                      : "bg-slate-500/5 border-slate-500/20"
                  }`}>
                    <div className={`flex h-6 w-6 items-center justify-center rounded-full ${
                      verifyState.result.disclosures.timestampDisclosure ? "bg-emerald-500/10" : "bg-slate-500/10"
                    }`}>
                      {verifyState.result.disclosures.timestampDisclosure ? (
                        <svg className="h-4 w-4 text-emerald-400" fill="currentColor" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${verifyState.result.disclosures.timestampDisclosure ? "text-emerald-400" : "text-slate-400"}`}>
                        Timestamp Disclosure
                      </p>
                      <p className="text-xs text-slate-500 dark:text-white/50">
                        {verifyState.result.details.signedAt || "No timestamp available"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={handleReset}
                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 font-medium text-slate-900 dark:text-white transition-colors hover:bg-slate-50 dark:hover:bg-white/10"
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
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileDrop}
                className={`glass-card flex flex-col items-center justify-center p-8 transition-all ${
                  isDragging ? "border-cyan-500/50 bg-cyan-500/5" : selectedFile ? "border-emerald-500/30" : ""
                }`}
              >
                {selectedFile ? (
                  <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-medium">{selectedFile.name}</span>
                  </div>
                ) : (
                  <>
                    <svg className="h-12 w-12 text-slate-300 dark:text-white/20 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-slate-600 dark:text-white/60 mb-2">Drop your document here</p>
                    <label className="cursor-pointer text-sm text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 dark:hover:text-cyan-300">
                      or browse files
                      <input type="file" className="hidden" onChange={handleFileSelect} />
                    </label>
                  </>
                )}
              </div>

              <div className="glass-card p-4">
                <label className="block text-xs text-slate-600 dark:text-white/40 mb-2">
                  ZK-Proof String
                </label>
                <textarea
                  value={proofString}
                  onChange={(e) => setProofString(e.target.value)}
                  placeholder="Paste the proof string from the signature..."
                  className="w-full p-4 bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500 placeholder-slate-400 dark:placeholder-slate-500 resize-none h-24"
                />
              </div>

              {verifyState.error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400"
                >
                  {verifyState.error}
                </motion.div>
              )}

              <button
                onClick={handleVerify}
                disabled={verifyState.status === "verifying" || (!selectedFile && !proofString)}
                className="w-full neon-button py-4 text-lg"
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

export default VerifySignature;
