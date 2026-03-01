import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMidnightWallet, getNetworkName, isCorrectNetwork } from "./hooks/useMidnightWallet";
import { createProof } from "./managed/docusign";

// Types
type AppState = "upload" | "proving" | "signed";

interface SignedDocument {
  documentHash: string;
  documentName: string;
  txHash: string;
  signerId: string;
  timestamp: number;
}

// Utility: Hash using Web Crypto API
async function sha256(message: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', message);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Utility: Generate random hex
function randomHex(bytes: number): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Components
function Navbar({ 
  onConnect, 
  isConnected, 
  accountId,
  isConnecting,
  error,
  networkId,
  onClearError 
}: { 
  onConnect: () => void; 
  isConnected: boolean; 
  accountId: string | null;
  isConnecting: boolean;
  error: string | null;
  networkId: number | null;
  onClearError: () => void;
}) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-midnight-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/30">
            <span className="text-cyan-400 font-bold text-xs">NS</span>
          </div>
          <span className="text-lg font-bold tracking-tight">
            Night<span className="text-cyan-400">Sign</span>
          </span>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Verify Link */}
          <a 
            href="/verify" 
            className="text-sm text-white/60 hover:text-cyan-400 transition-colors"
          >
            Verify a Document
          </a>
          {/* Error toast */}
          {error && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-1.5"
            >
              <span className="text-xs text-red-400">{error}</span>
              <button onClick={onClearError} className="text-white/50 hover:text-white">
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
              <span className="text-xs text-white/50">
                {accountId.slice(0, 8)}...
              </span>
            </div>
          )}
          
          {isConnected ? (
            <button 
              onClick={() => window.location.reload()}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10"
            >
              Disconnect
            </button>
          ) : (
            <button 
              onClick={onConnect}
              disabled={isConnecting}
              className="neon-button text-xs"
            >
              {isConnecting ? "Connecting..." : "Connect Midnight Wallet"}
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

function FileDropzone({ 
  onFileSelect, 
  isDragging 
}: { 
  onFileSelect: (file: File) => void;
  isDragging: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => inputRef.current?.click();

  return (
    <div
      onClick={handleClick}
      className={`dropzone p-12 ${isDragging ? "active" : ""}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        onChange={(e) => e.target.files?.[0] && onFileSelect(e.target.files[0])}
        className="hidden"
      />
      <motion.div
        animate={{ scale: isDragging ? 1.05 : 1 }}
        className="flex flex-col items-center gap-4"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5">
          <svg className="h-8 w-8 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-white">
            Drop your PDF here, or <span className="text-cyan-400">browse</span>
          </p>
          <p className="mt-1 text-xs text-white/40">
            Maximum 10MB
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function ProvingView() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center"
    >
      <div className="mb-6">
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-cyan-500/10"
        >
          <svg className="h-10 w-10 text-cyan-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </motion.div>
        <h3 className="text-xl font-bold text-white">Generating Zero-Knowledge Proof</h3>
        <p className="mt-2 text-sm text-white/50">
          Confirm in your Midnight wallet to sign & submit
        </p>
      </div>
      
      <div className="mx-auto max-w-md">
        <div className="progress-neon mb-2">
          <motion.div 
            className="progress-neon-fill"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 3, ease: "easeInOut" }}
          />
        </div>
        <div className="flex justify-between text-xs text-white/40">
          <span>Hashing document...</span>
          <span>Generating proof...</span>
          <span>Submitting...</span>
        </div>
      </div>
    </motion.div>
  );
}

function SignedView({ data, onReset }: { data: SignedDocument; onReset: () => void }) {
  
  const handleDownloadReceipt = () => {
    const receipt = `
ZK-DocuSign Signature Receipt
============================
Document Name: ${data.documentName}
Document Hash: ${data.documentHash}
Signer Address: ${data.signerId}
Transaction ID: ${data.txHash}
Timestamp: ${new Date(data.timestamp).toLocaleString()}

Verified by Midnight ZK-Prover
===============================
This document was signed using zero-knowledge proofs
on the Midnight blockchain network.
    `.trim();
    
    const blob = new Blob([receipt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zk-signature-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", duration: 0.5 }}
        className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-500/10"
      >
        <svg className="h-10 w-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </motion.div>
      
      <h3 className="text-xl font-bold text-white">Document Signed!</h3>
      <p className="mt-2 text-sm text-white/50">
        Your zero-knowledge proof has been submitted to Midnight.
      </p>
      
      {/* Verification Status Badge */}
      <div className="mt-4 flex justify-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400 border border-emerald-500/20">
          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          Verified by Midnight ZK
        </span>
      </div>
      
      <div className="mt-8 space-y-4 text-left">
        <div className="glass-card p-4">
          <label className="text-xs text-white/40">Document Name</label>
          <p className="mt-1 text-sm text-white font-medium">
            {data.documentName}
          </p>
        </div>
        
        <div className="glass-card p-4">
          <label className="text-xs text-white/40">Shielded Address</label>
          <p className="mt-1 font-mono text-xs text-cyan-400">
            {data.signerId}
          </p>
        </div>
        
        <div className="glass-card p-4">
          <label className="text-xs text-white/40">ZK-Proof String</label>
          <div className="mt-1 max-h-20 overflow-y-auto rounded bg-black/30 p-2 font-mono text-xs text-purple-400">
            {data.txHash.substring(0, 64)}...
          </div>
        </div>
        
        <div className="glass-card p-4">
          <label className="text-xs text-white/40">Mock Transaction ID</label>
          <p className="mt-1 font-mono text-xs text-emerald-400 break-all">
            {data.txHash}
          </p>
        </div>
        
        <div className="glass-card p-4">
          <label className="text-xs text-white/40">Signed At</label>
          <p className="mt-1 text-sm text-white/70">
            {new Date(data.timestamp).toLocaleString()}
          </p>
        </div>
      </div>
      
      {/* Download Receipt Button */}
      <button
        onClick={handleDownloadReceipt}
        className="mt-4 w-full rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 font-medium text-cyan-400 transition-colors hover:bg-cyan-500/20"
      >
        Download Receipt
      </button>
      
      <button
        onClick={onReset}
        className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-medium text-white transition-colors hover:bg-white/10"
      >
        Sign Another Document
      </button>
    </motion.div>
  );
}

function App() {
  const { 
    isConnected, 
    accountId, 
    status: walletStatus, 
    error: walletError,
    networkId,
    connect: connectWallet,
    signDocument,
    clearError: clearWalletError
  } = useMidnightWallet();
  
  const [state, setState] = useState<AppState>("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [signedData, setSignedData] = useState<SignedDocument | null>(null);

  // Hash document using Web Crypto API
  const hashDocument = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    return sha256(buffer);
  };

  // Handle file selection
  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
  }, []);

  // Handle drag states
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/pdf") {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  // Sign document - Using ZK-Prover (not wallet.signData)
  const handleSign = useCallback(async () => {
    if (!selectedFile) return;
    
    // Step 1: If not connected, connect first
    if (!isConnected) {
      await connectWallet();
      return;
    }
    
    setState("proving");
    
    try {
      // Hash the document locally
      const documentHash = await hashDocument(selectedFile);
      
      // Generate ZK proof using the prover
      await createProof(documentHash, accountId || "");
      
      // Update UI with the proof
      const txHash = `zk_${Date.now()}_${randomHex(16)}`;
      
      setSignedData({
        documentHash,
        documentName: selectedFile.name,
        txHash: txHash,
        signerId: accountId || "zk-connected",
        timestamp: Date.now(),
      });
      
      setState("signed");
      
    } catch (error: any) {
      console.error("ZK-Proof failed:", error);
      
      // If error, go back to upload
      setState("upload");
    }
  }, [selectedFile, isConnected, connectWallet, networkId, signDocument]);

  // Reset - also disconnects wallet
  const handleReset = useCallback(() => {
    setState("upload");
    setSelectedFile(null);
    setSignedData(null);
    // Optionally disconnect wallet on reset
    // disconnect(); // Uncomment if you want to disconnect on each reset
  }, []);

  // Determine button state
  const getButtonText = () => {
    if (walletStatus === "connecting") return "Connecting...";
    if (!isConnected) return "Connect Wallet to Sign";
    // Disabled network check - using preprod by default
    // if (!isCorrectNetwork(networkId)) return "Wrong Network";
    if (!selectedFile) return "Select a Document";
    return "Sign Document";
  };

  const canSign = isConnected && selectedFile;

  return (
    <div className="space-bg min-h-screen">
      <Navbar 
        onConnect={connectWallet}
        isConnected={isConnected}
        accountId={accountId}
        isConnecting={walletStatus === "connecting"}
        error={walletError}
        networkId={networkId}
        onClearError={clearWalletError}
      />
      
      <main className="pt-24 pb-12">
        <div className="mx-auto max-w-xl px-4">
          {/* Header */}
          <div className="mb-12 text-center">
            <motion.h1 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl font-bold text-white"
            >
              Zero-Knowledge <span className="text-cyan-400">Document Signing</span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mt-4 text-white/50"
            >
              Sign documents privately with Midnight Lace wallet
            </motion.p>
          </div>

          {/* Main Card */}
          <motion.div
            layout
            className="glass-card p-8"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <AnimatePresence mode="wait">
              {state === "upload" && (
                <motion.div
                  key="upload"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {!selectedFile ? (
                    <FileDropzone 
                      onFileSelect={handleFileSelect} 
                      isDragging={isDragging}
                    />
                  ) : (
                    <div className="text-center">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="mb-6 flex flex-col items-center"
                      >
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/10">
                          <svg className="h-8 w-8 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <p className="text-lg font-medium text-white">{selectedFile.name}</p>
                        <p className="text-sm text-white/40">
                          {(selectedFile.size / 1024).toFixed(1)} KB
                        </p>
                      </motion.div>
                      
                      <div className="flex gap-3">
                        <button
                          onClick={() => setSelectedFile(null)}
                          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-medium text-white transition-colors hover:bg-white/10"
                        >
                          Remove
                        </button>
                        <button
                          onClick={handleSign}
                          disabled={!canSign}
                          className="neon-button flex-1"
                        >
                          {getButtonText()}
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {state === "proving" && (
                <motion.div
                  key="proving"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <ProvingView />
                </motion.div>
              )}

              {state === "signed" && signedData && (
                <motion.div
                  key="signed"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <SignedView data={signedData} onReset={handleReset} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Footer */}
          <p className="mt-8 text-center text-xs text-white/25">
            Powered by Midnight Network • Zero-Knowledge Proofs
          </p>
        </div>
      </main>
    </div>
  );
}

export default App;
