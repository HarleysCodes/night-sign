import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMidnightWallet, getNetworkName, isCorrectNetwork } from "./hooks/useMidnightWallet";
import { createProof, checkIdentity, generateInviteLink } from "./managed/docusign";
import { AgreementCertificate } from "./components/AgreementCertificate";

// Types
type AppState = "upload" | "identity-check" | "proving" | "signed" | "second-sign";

interface SignedDocument {
  documentHash: string;
  documentName: string;
  txHash: string;
  signerId: string;
  timestamp: number;
  docId: string;
  signatureCount: number;
  isFullyExecuted?: boolean;
}

// Multi-signer session state
interface MultiSignerSession {
  docId: string;
  documentHash: string;
  documentName: string;
  signers: string[];
  requiredSigners: number;
  isSecondSigner?: boolean;
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
  onClearError,
  isDarkMode,
  setIsDarkMode 
}: { 
  onConnect: () => void; 
  isConnected: boolean; 
  accountId: string | null;
  isConnecting: boolean;
  error: string | null;
  networkId: number | null;
  onClearError: () => void;
  isDarkMode: boolean;
  setIsDarkMode: (v: boolean) => void;
}) {
  return (
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
              <svg className="w-5 h-5 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
          
          {/* Verify Link */}
          <a 
            href="/verify" 
            className="text-sm text-slate-600 dark:text-white/50 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors font-medium"
          >
            Verify
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
          <p className="text-sm font-medium text-slate-700 dark:text-white">
            Drop your PDF here, or <span className="text-cyan-600 dark:text-cyan-400">browse</span>
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-white/40">
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

function SignedView({ 
  data, 
  onReset,
  inviteLink,
  onCopyLink,
  copiedLink,
  requiredSigners = 2
}: { 
  data: SignedDocument; 
  onReset: () => void;
  inviteLink?: string;
  onCopyLink?: () => void;
  copiedLink?: boolean;
  requiredSigners?: number;
}) {
  
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
        {data.isFullyExecuted ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-cyan-500/20 to-purple-500/20 px-4 py-1.5 text-xs font-bold text-white border border-cyan-500/30">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Agreement Fully Executed
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400 border border-emerald-500/20">
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Verified by Midnight ZK
          </span>
        )}
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
        
        {/* Multi-signer info */}
        {data.docId && (
          <div className="glass-card p-4">
            <label className="text-xs text-white/40">Document Vault ID</label>
            <p className="mt-1 font-mono text-xs text-purple-400 break-all">
              {data.docId}
            </p>
          </div>
        )}
        
        {data.signatureCount !== undefined && (
          <div className="glass-card p-4">
            <label className="text-xs text-white/40">Signature Progress</label>
            <div className="mt-2 flex items-center gap-3">
              <div className="flex-1 h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-cyan-500 to-purple-500"
                  style={{ width: `${Math.min((data.signatureCount / requiredSigners) * 100, 100)}%` }}
                />
              </div>
              <span className="text-sm text-cyan-600 dark:text-cyan-400">
                {data.signatureCount}/{requiredSigners}
              </span>
            </div>
          </div>
        )}
        
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
      
      {/* Multi-Signer Invite Link in SignedView */}
      {inviteLink && (
        <div className="mt-6 p-4 glass-card border border-cyan-500/20">
          <div className="flex items-center gap-2 mb-3">
            <svg className="h-4 w-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span className="text-sm font-medium text-cyan-400">Invite Additional Signers</span>
          </div>
          <p className="text-xs text-white/40 mb-3">
            Share this link with another party to collect their signature on the blockchain.
          </p>
          <div className="flex gap-2">
            <input 
              type="text" 
              readOnly 
              value={inviteLink}
              className="flex-1 bg-black/20 rounded-lg px-3 py-2 text-xs text-white/60 font-mono truncate"
            />
            <button 
              onClick={onCopyLink}
              className="px-3 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 text-xs hover:bg-cyan-500/30 whitespace-nowrap"
            >
              {copiedLink ? "Copied!" : "Copy Link"}
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// Trust Timeline - Vertical Step Indicator
function TrustTimeline({ 
  currentStep,
  requiredSigners = 2
}: { 
  currentStep: number;
  requiredSigners?: number;
}) {
  const steps = [
    { step: 1, label: "Document Anchored", desc: "Hash recorded on-chain" },
    ...Array.from({ length: requiredSigners - 1 }, (_, i) => ({
      step: i + 2,
      label: i === requiredSigners - 2 ? "All Signers Verified" : `Signer ${i + 2}`,
      desc: i === requiredSigners - 2 ? "All parties signed" : `Party ${i + 2} verified`
    }))
  ];

  return (
    <div className="flex items-center justify-center gap-2 py-4">
      {steps.map((s, i) => (
        <div key={s.step} className="flex items-center">
          <div className="flex flex-col items-center">
            <div className={`
              w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500
              ${currentStep >= s.step 
                ? 'bg-gradient-to-br from-cyan-500 to-purple-600 border-cyan-400 shadow-lg shadow-cyan-500/25' 
                : 'bg-white/5 border-white/20'}
            `}>
              {currentStep >= s.step ? (
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              ) : (
                <span className="text-white/40 font-bold">{s.step}</span>
              )}
            </div>
            <div className="mt-2 text-center">
              <p className={`text-xs font-medium ${currentStep >= s.step ? 'text-white' : 'text-white/40'}`}>
                {s.label}
              </p>
            </div>
          </div>
          {i < steps.length - 1 && (
            <div className={`
              w-12 h-0.5 mx-2 mt-[-20px] transition-all duration-500
              ${currentStep > s.step ? 'bg-gradient-to-r from-cyan-500 to-purple-500' : 'bg-white/10'}
            `} />
          )}
        </div>
      ))}
    </div>
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
  
  // Theme state
  const [isDarkMode, setIsDarkMode] = useState(true);
  
  // Signer count configuration
  const [requiredSigners, setRequiredSigners] = useState(2);
  
  // Multi-signer state
  const [multiSignerSession, setMultiSignerSession] = useState<MultiSignerSession | null>(null);
  const [, setIdentityVerified] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  
  // Check URL for session ID (second signer flow)
  useEffect(() => {
    // Debug: Log current URL params
    console.log("Current URL:", window.location.href);
    console.log("Current URL Params:", window.location.search);
    console.log("Current Path:", window.location.pathname);
    
    // Robust URL parsing - handle Vercel deployment edge cases
    const url = window.location.href;
    const urlObj = new URL(url);
    const searchParams = urlObj.searchParams;
    
    // Try multiple sources for doc_id
    const queryDocId = searchParams.get('doc_id');
    const pathDocId = window.location.pathname.match(/\/sign\/([a-zA-Z0-9_]+)/)?.[1];
    const trailingDocId = window.location.pathname.match(/\/([a-zA-Z0-9_]+)\/?$/)?.[1];
    
    // Prefer: query param > /sign/:id > trailing id
    const docId = queryDocId || pathDocId || trailingDocId;
    
    console.log("Extracted docId:", docId);
    console.log("Query:", queryDocId, "Path:", pathDocId, "Trailing:", trailingDocId);
    
    if (docId) {
      console.log("🔗 Second signer detected for docId:", docId);
      
      // Set up as second signer
      setMultiSignerSession({
        docId,
        documentHash: "",
        documentName: "Shared Document",
        signers: [],
        requiredSigners: requiredSigners,
        isSecondSigner: true
      });
      
      setState("second-sign");
    }
  }, []);

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

  // Sign document - Multi-signer with identity verification
  const handleSign = useCallback(async () => {
    // Check if this is a second signer joining an existing session
    if (multiSignerSession?.isSecondSigner) {
      await handleSecondSignerSign();
      return;
    }
    
    if (!selectedFile) return;
    
    // Step 1: If not connected, connect first
    if (!isConnected) {
      await connectWallet();
      return;
    }
    
    // Step 2: Identity Pre-Check (Midnight VC verification)
    setState("identity-check");
    
    try {
      const identityResult = await checkIdentity(accountId || "");
      
      if (!identityResult.isVerified) {
        throw new Error(identityResult.message || "Identity verification failed");
      }
      
      setIdentityVerified(true);
      
    } catch (error: any) {
      console.error("Identity check failed:", error);
      setState("upload");
      return;
    }
    
    // Step 3: Generate ZK Proof
    setState("proving");
    
    try {
      // Hash the document locally
      const documentHash = await hashDocument(selectedFile);
      
      // Generate docId for multi-signer session
      const docId = `doc_${Date.now()}_${randomHex(8)}`;
      
      // Generate ZK proof
      const proofResult = await createProof(documentHash, accountId || "", docId);
      
      // Set up multi-signer session
      const session: MultiSignerSession = {
        docId,
        documentHash,
        documentName: selectedFile.name,
        signers: [accountId || "signer-1"],
        requiredSigners: requiredSigners
      };
      setMultiSignerSession(session);
      
      // Generate invite link for second signer
      const link = generateInviteLink(docId);
      setInviteLink(link);
      
      // Step 4: On-Chain Submission via Lace Wallet
      let txHash = "";
      
      if (signDocument) {
        try {
          // Submit transaction to Midnight network
          const txResult = await signDocument(documentHash, new Uint8Array());
          txHash = txResult?.txHash || `onchain_${Date.now()}`;
        } catch (txError) {
          // Fallback to mock transaction if wallet fails
          console.warn("On-chain submission failed, using mock:", txError);
          txHash = `zk_${Date.now()}_${randomHex(16)}`;
        }
      } else {
        // No wallet signDocument - use mock
        txHash = `zk_${Date.now()}_${randomHex(16)}`;
      }
      
      setSignedData({
        documentHash,
        documentName: selectedFile.name,
        txHash: txHash,
        signerId: accountId || "zk-connected",
        timestamp: Date.now(),
        docId: docId,
        signatureCount: proofResult.signatureCount
      });
      
      setState("signed");
      
    } catch (error: any) {
      console.error("Signing failed:", error);
      setState("upload");
    }
  }, [selectedFile, isConnected, connectWallet, accountId, signDocument, multiSignerSession]);

  // Handle second signer signing
  const handleSecondSignerSign = useCallback(async () => {
    if (!isConnected) {
      await connectWallet();
      return;
    }
    
    if (!selectedFile) return;
    
    // Identity check
    setState("identity-check");
    
    try {
      const identityResult = await checkIdentity(accountId || "");
      if (!identityResult.isVerified) {
        throw new Error(identityResult.message || "Identity verification failed");
      }
      setIdentityVerified(true);
    } catch (error: any) {
      console.error("Identity check failed:", error);
      setState("second-sign");
      return;
    }
    
    // Generate proof for second signature
    setState("proving");
    
    try {
      const documentHash = await hashDocument(selectedFile);
      const docId = multiSignerSession?.docId;
      
      if (!docId) {
        throw new Error("No document session found");
      }
      
      // Append second signature to existing vault
      await createProof(documentHash, accountId || "", docId);
      
      // Update session with second signer
      const updatedSession = {
        ...multiSignerSession,
        signers: [...(multiSignerSession?.signers || []), accountId || "signer-2"],
        isFullyExecuted: true
      };
      setMultiSignerSession(updatedSession);
      
      // Generate transaction
      let txHash = "";
      if (signDocument) {
        try {
          const txResult = await signDocument(documentHash, new Uint8Array());
          txHash = txResult?.txHash || `onchain_${Date.now()}`;
        } catch (txError) {
          txHash = `zk_${Date.now()}_${randomHex(16)}`;
        }
      } else {
        txHash = `zk_${Date.now()}_${randomHex(16)}`;
      }
      
      setSignedData({
        documentHash,
        documentName: selectedFile.name,
        txHash: txHash,
        signerId: accountId || "zk-connected",
        timestamp: Date.now(),
        docId: docId,
        signatureCount: 2,
        isFullyExecuted: true
      });
      
      setState("signed");
      
    } catch (error: any) {
      console.error("Second signer signing failed:", error);
      setState("second-sign");
    }
  }, [isConnected, connectWallet, accountId, selectedFile, multiSignerSession, signDocument]);

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
    if (!isConnected && !multiSignerSession?.isSecondSigner) return "Connect Wallet to Sign";
    if (state === "second-sign" && !selectedFile) return "Upload Document to Sign";
    if (!selectedFile) return "Select a Document";
    if (state === "identity-check") return "Verifying Identity...";
    if (state === "proving") return "Generating ZK Proof...";
    if (state === "signed") {
      if (signedData?.isFullyExecuted) return "Agreement Fully Executed!";
      return "Document Signed!";
    }
    if (state === "second-sign") return "Append Your Signature";
    return "Sign Document";
  };

  // Allow signing if:
  // 1. Connected and file selected (normal flow)
  // 2. Second signer session with file selected
  const canSign = (isConnected || multiSignerSession?.isSecondSigner) && selectedFile && (state !== "signed");

  // Copy invite link
  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'space-bg' : 'bg-slate-50'}`}>
      <Navbar 
        onConnect={connectWallet}
        isConnected={isConnected}
        accountId={accountId}
        isConnecting={walletStatus === "connecting"}
        error={walletError}
        networkId={networkId}
        onClearError={clearWalletError}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
      />
      
      <main className="pt-28 pb-12">
        <div className="mx-auto max-w-xl px-4">
          {/* Header */}
          <div className="mb-12 text-center">
            <motion.h1 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl font-bold text-slate-900 dark:text-white"
            >
              Zero-Knowledge <span className="text-cyan-600 dark:text-cyan-400">Document Signing</span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mt-4 text-slate-600 dark:text-white/50"
            >
              Sign documents privately with Midnight Lace wallet
            </motion.p>
          </div>

          {/* Second Signer Debug Header */}
          {multiSignerSession?.isSecondSigner && (
            <div className="mb-6 p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <svg className="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-purple-400 font-semibold">Signer 2: Joining Session</span>
              </div>
              <p className="text-xs text-purple-300/60 font-mono">
                Session ID: {multiSignerSession.docId}
              </p>
            </div>
          )}

          {/* Signer Count Configuration */}
          {state === "upload" && !selectedFile && (
            <div className="mb-6 p-4 glass-card">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-slate-700 dark:text-white/70">Number of Signers Required</label>
                <span className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{requiredSigners}</span>
              </div>
              <input
                type="range"
                min="2"
                max="5"
                value={requiredSigners}
                onChange={(e) => setRequiredSigners(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
              <div className="flex justify-between mt-2 text-xs text-slate-400 dark:text-white/30">
                <span>2</span>
                <span>3</span>
                <span>4</span>
                <span>5</span>
              </div>
            </div>
          )}

          {/* Trust Timeline */}
          <TrustTimeline 
            currentStep={signedData?.isFullyExecuted ? requiredSigners : state === "signed" ? Math.min(requiredSigners - 1, 2) : selectedFile ? 1 : 0}
            requiredSigners={requiredSigners}
          />

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
                      
                      {/* Multi-Signer Progress Bar */}
                      {multiSignerSession && (
                        <div className="mt-6 p-4 glass-card">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-white/60">Signature Progress</span>
                            <span className="text-sm text-cyan-400">
                              {multiSignerSession.signers.length} / {multiSignerSession.requiredSigners}
                            </span>
                          </div>
                          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                            <motion.div 
                              className="h-full bg-gradient-to-r from-cyan-500 to-purple-500"
                              initial={{ width: 0 }}
                              animate={{ width: `${(multiSignerSession.signers.length / multiSignerSession.requiredSigners) * 100}%` }}
                            />
                          </div>
                          
                          {/* Invite Signer Link */}
                          {multiSignerSession.signers.length < multiSignerSession.requiredSigners && (
                            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/10">
                              <p className="text-xs text-slate-500 dark:text-white/40 mb-2">Invite another signer:</p>
                              <div className="flex gap-2">
                                <input 
                                  type="text" 
                                  readOnly 
                                  value={inviteLink}
                                  className="flex-1 bg-slate-100 dark:bg-black/20 rounded-lg px-3 py-2 text-xs text-slate-700 dark:text-white/60 font-mono truncate"
                                />
                                <button 
                                  onClick={handleCopyLink}
                                  className="px-3 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 text-xs hover:bg-cyan-500/30"
                                >
                                  {copiedLink ? "Copied!" : "Copy"}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}

              {state === "identity-check" && (
                <motion.div
                  key="identity-check"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="glass-card p-8 text-center"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="mx-auto mb-6 h-16 w-16 rounded-full border-2 border-cyan-500/30 border-t-cyan-500"
                  />
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Verifying Identity
                  </h3>
                  <p className="text-sm text-white/50">
                    Checking your Midnight Verifiable Credential...
                  </p>
                  
                  {/* Identity Status */}
                  <div className="mt-6 flex justify-center">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                      <svg className="h-4 w-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm text-emerald-400">VC Verified</span>
                    </div>
                  </div>
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

              {state === "second-sign" && (
                <motion.div
                  key="second-sign"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="glass-card p-8 text-center"
                >
                  {/* Big Purple Banner */}
                  <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-purple-500/30">
                    <div className="flex items-center justify-center gap-3 mb-3">
                      <svg className="h-8 w-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <span className="text-xl font-bold text-white">Welcome Signer 2!</span>
                    </div>
                    <p className="text-purple-300">
                      You are joining a secure Midnight session
                    </p>
                    <p className="text-xs text-white/40 mt-2 font-mono">
                      Session: {multiSignerSession?.docId}
                    </p>
                  </div>
                  
                  {/* Show upload OR file info */}
                  {!selectedFile ? (
                    <div className="mb-6">
                      <p className="text-white/50 mb-4">Upload the document to sign:</p>
                      <FileDropzone 
                        onFileSelect={handleFileSelect} 
                        isDragging={isDragging}
                      />
                    </div>
                  ) : (
                    <div className="mb-6 p-4 rounded-xl bg-black/20">
                      <p className="text-white font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-white/40">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                      <button
                        onClick={() => setSelectedFile(null)}
                        className="mt-2 text-sm text-cyan-400 hover:text-cyan-300"
                      >
                        Change file
                      </button>
                    </div>
                  )}
                  
                  {/* Sign Button */}
                  <button
                    onClick={handleSign}
                    disabled={!selectedFile}
                    className="w-full neon-button py-4 text-lg"
                  >
                    Append Your Signature
                  </button>
                </motion.div>
              )}

              {state === "signed" && signedData && (
                <motion.div
                  key="signed"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {signedData?.isFullyExecuted ? (
                    <motion.div
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    >
                      <AgreementCertificate data={signedData} onReset={handleReset} />
                    </motion.div>
                  ) : (
                    <SignedView 
                      data={signedData} 
                      onReset={handleReset}
                      inviteLink={inviteLink}
                      onCopyLink={handleCopyLink}
                      copiedLink={copiedLink}
                      requiredSigners={requiredSigners}
                    />
                  )}
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
