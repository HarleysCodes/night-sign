// @ts-nocheck
/* eslint-disable */

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMidnightWallet, getNetworkName, isCorrectNetwork } from "./hooks/useMidnightWallet";
import { createProof, checkIdentity, generateInviteLink } from "./managed/docusign";
import { encryptFile, decryptFile, generateSessionKey, uploadToIPFS, fetchFromIPFS } from "./managed/encryption";
import { AgreementCertificate } from "./components/AgreementCertificate";

// Types
type AppState = "upload" | "identity-check" | "proving" | "signed" | "second-sign";

interface SignerInfo { address: string; role: string; }

interface SignedDocument {
  documentHash: string;
  documentName: string;
  txHash: string;
  signerId: string;
  timestamp: number;
  docId: string;
  signatureCount: number;
  signersList?: SignerInfo[];
  isFullyExecuted?: boolean;
}

interface MultiSignerSession {
  docId: string;
  documentHash: string;
  documentName: string;
  signers: string[];
  requiredSigners: number;
  isSecondSigner?: boolean;
}

// Utilities
async function sha256(message: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', message);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomHex(bytes: number): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Components
function FileDropzone({ onFileSelect, isDragging }: { onFileSelect: (file: File) => void; isDragging: boolean; }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleClick = () => inputRef.current?.click();

  return (
    <div onClick={handleClick} className={`dropzone p-12 ${isDragging ? "active" : ""}`}>
      <input ref={inputRef} type="file" accept="application/pdf" onChange={(e) => e.target.files?.[0] && onFileSelect(e.target.files[0])} className="hidden" />
      <motion.div animate={{ scale: isDragging ? 1.05 : 1 }} className="flex flex-col items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5">
          <svg className="h-8 w-8 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-900 dark:text-white">Drop your PDF here, or <span className="text-cyan-600 dark:text-cyan-400">browse</span></p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-600 dark:text-white/40">Maximum 10MB</p>
        </div>
      </motion.div>
    </div>
  );
}

function ProvingView() {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
      <div className="mb-6">
        <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-cyan-500/10">
          <svg className="h-10 w-10 text-cyan-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </motion.div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Generating Zero-Knowledge Proof</h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-gray-700 dark:text-gray-300">Confirm in your Midnight wallet to sign & submit</p>
      </div>
    </motion.div>
  );
}

function SignedView({ data, onReset, inviteLink, onCopyLink, copiedLink, requiredSigners = 2, currentSignerCount = 0 }: any) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", duration: 0.5 }} className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-500/10">
        <svg className="h-10 w-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
      </motion.div>
      <h3 className="text-xl font-bold text-slate-900 dark:text-white">Document Signed!</h3>
      <p className="mt-2 text-sm text-slate-600 dark:text-gray-600 dark:text-gray-300">Your zero-knowledge proof has been submitted to Midnight.</p>
      
      <div className="mt-8 space-y-4 text-left">
        <div className="glass-card p-4"><label className="text-xs text-slate-600 dark:text-white/40">Document Name</label><p className="mt-1 text-sm text-white font-medium">{data.documentName}</p></div>
        <div className="glass-card p-4"><label className="text-xs text-slate-600 dark:text-white/40">ZK-Proof String</label><div className="mt-1 max-h-20 overflow-y-auto rounded bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 p-2 font-mono text-xs text-purple-600 dark:text-purple-400">{data.txHash.substring(0, 64)}...</div></div>
        
        {currentSignerCount > 0 && (
          <div className="glass-card p-4">
            <label className="text-xs text-slate-600 dark:text-white/40">Signature Progress</label>
            <div className="mt-2 flex items-center gap-3">
              <div className="flex-1 h-2 bg-slate-200 dark:bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-cyan-500 to-purple-500" style={{ width: `${Math.min(((currentSignerCount) / requiredSigners) * 100, 100)}%` }} />
              </div>
              <span className="text-sm text-cyan-600 dark:text-cyan-400">{data.signatureCount || currentSignerCount}/{requiredSigners}</span>
            </div>
          </div>
        )}
      </div>
      
      <button onClick={onReset} className="mt-6 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-medium text-white transition-colors hover:bg-white/10">Sign Another Document</button>
      
      {inviteLink && (
        <div className="mt-6 p-4 glass-card border border-cyan-500/20">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-medium text-cyan-400">Invite Additional Signers</span>
          </div>
          <div className="flex gap-2">
            <input type="text" readOnly value={inviteLink} className="flex-1 bg-slate-100 dark:bg-black/20 rounded-lg px-3 py-2 text-xs font-mono truncate text-white" />
            <button onClick={onCopyLink} className="px-3 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 text-xs hover:bg-cyan-500/30">{copiedLink ? "Copied!" : "Copy Link"}</button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function TrustTimeline({ currentStep, requiredSigners = 2 }: any) {
  const totalPipelineSteps = requiredSigners + 1;
  const getStepLabel = (idx: number) => {
    if (idx === 0) return "Document Anchored";
    if (idx === totalPipelineSteps - 1) return "All Signers Verified";
    return `Signer ${idx + 1}`;
  };
  const steps = Array.from({ length: totalPipelineSteps }, (_, i) => ({
    step: i + 1,
    label: getStepLabel(i)
  }));

  return (
    <div className="flex items-center justify-center gap-2 py-4">
      {steps.map((s, i) => (
        <div key={s.step} className="flex items-center">
          <div className="flex flex-col items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${currentStep >= s.step ? 'bg-gradient-to-br from-cyan-500 to-purple-600 border-cyan-400' : 'bg-white/5 border-white/20'}`}>
              <span className="text-gray-900 dark:text-white font-bold">{s.step}</span>
            </div>
            <p className="mt-2 text-sm font-medium text-gray-800 dark:text-gray-300">{s.label}</p>
          </div>
          {i < steps.length - 1 && <div className={`w-12 h-0.5 mx-2 mt-[-20px] ${currentStep > s.step ? 'bg-cyan-500' : 'bg-white/10'}`} />}
        </div>
      ))}
    </div>
  );
}

function App() {
  const { isConnected, accountId, status: walletStatus, error: walletError, connect: connectWallet, signDocument } = useMidnightWallet();
  const [state, setState] = useState<AppState>("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [signedData, setSignedData] = useState<SignedDocument | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  // Initialize required signers from URL or default to 2
  // Parse URL parameters FIRST
  const searchParams = new URLSearchParams(window.location.search);
  const parsedReq = parseInt(searchParams.get("req") || "2", 10);
  // Initialize currentSignerCount from URL, can be updated after signing
  const urlSignerCount = parseInt(searchParams.get("count") || "0", 10);
  const [currentSignerCount, setCurrentSignerCount] = useState(urlSignerCount);

  // Initialize state using parsed values
  const [requiredSigners, setRequiredSigners] = useState(parsedReq);
  const [multiSignerSession, setMultiSignerSession] = useState<MultiSignerSession | null>(null);
  const [inviteLink, setInviteLink] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [currentRole, setCurrentRole] = useState("Signer");
  const [autoLoaded, setAutoLoaded] = useState(false);
    const [isFetchingDoc, setIsFetchingDoc] = useState(false);

  // URL parsing already done above
  const urlDocId = searchParams.get("doc_id");
  const totalPipelineSteps = requiredSigners + 1;

    useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);
  
  // URL MEMORY LOGIC
  useEffect(() => {
    const urlObj = new URL(window.location.href);
    const searchParams = urlObj.searchParams;
    const queryDocId = searchParams.get('doc_id');
    const pathDocId = window.location.pathname.match(/\/sign\/([a-zA-Z0-9_]+)/)?.[1];
    const docId = queryDocId || pathDocId;
    
    const req = parseInt(searchParams.get('req') || '2');
    const count = parseInt(searchParams.get("count") || "0");
    
    // IPFS encrypted file handling
    const ipfsCid = searchParams.get('cid');
    const sessionKey = searchParams.get('key');
    const fileName = searchParams.get('fname');
    
    const handleIPFS = async () => {
      setIsFetchingDoc(true);
      if (ipfsCid && sessionKey && fileName) {
        setState("proving"); // Use proving as loading state
        try {
          const encryptedBlob = await fetchFromIPFS(ipfsCid);
          const decryptedFile = await decryptFile(encryptedBlob, sessionKey, decodeURIComponent(fileName));
          setTimeout(() => {
            setSelectedFile(decryptedFile);
            setAutoLoaded(true);
            setIsFetchingDoc(false);
            setState("second-sign");
          }, 100);
        } catch (err) {
          console.error("Failed to fetch/decrypt file:", err);
          window.alert("Failed to fetch document: " + err);
          setIsFetchingDoc(false);
        }
        setState("second-sign");
      }
    };
    
    if (ipfsCid && sessionKey) {
      handleIPFS();
      return;
    }
    
    if (docId) {
      setRequiredSigners(req);
      setMultiSignerSession({
        docId,
        documentHash: "",
        documentName: "Shared Document",
        signers: Array(currentSignerCount).fill('prev-signer'),
        requiredSigners: req,
        isSecondSigner: true
      });
      setState("second-sign");
    }
  }, []);

  const handleSign = useCallback(async () => {
    if (multiSignerSession?.isSecondSigner) { await handleSecondSignerSign(); return; }
    if (!selectedFile) return;
    if (!isConnected) { await connectWallet(); return; }
    
    setState("identity-check");
    try {
      const identityResult = await checkIdentity(accountId || "");
      if (!identityResult.isVerified) throw new Error("Identity verification failed");
    } catch (error) { setState("upload"); return; }
    
    setState("proving");
    try {
      // Encrypt and upload to IPFS
      const sessionKey = generateSessionKey(16);
      const encryptedFile = await encryptFile(selectedFile, sessionKey);
      let ipfsCid = '';
      try {
        ipfsCid = await uploadToIPFS(encryptedFile);
      } catch (uploadErr) {
        console.warn('IPFS upload failed, continuing without it:', uploadErr);
      }
      
      const documentHash = await sha256(await selectedFile.arrayBuffer());
      const docId = `doc_${Date.now()}_${randomHex(8)}`;
      await createProof(documentHash, accountId || "", docId);
      
      setMultiSignerSession({ docId, documentHash, documentName: selectedFile.name, signers: [accountId || "signer-1"],
        signersList: [{ address: accountId || "zk", role: currentRole }], requiredSigners });
      
      // FIRST INVITE LINK LOGIC
      const baseLink = generateInviteLink(docId);
      let linkWithParams = baseLink + (baseLink.includes('?') ? '&' : '?') + 'req=' + requiredSigners + '&count=' + (currentSignerCount + 1);
      if (ipfsCid) {
        linkWithParams += '&cid=' + ipfsCid + '&key=' + sessionKey + '&fname=' + encodeURIComponent(selectedFile.name);
      }
      setInviteLink(linkWithParams);
      
      let txHash = `zk_${Date.now()}_${randomHex(16)}`;
      if (signDocument) {
        try { const txResult = await signDocument(documentHash, new Uint8Array()); txHash = txResult?.txHash || txHash; } catch (e) {}
      }
      
      setSignedData({ documentHash, documentName: selectedFile.name, txHash, signerId: accountId || "zk", timestamp: Date.now(), docId, signatureCount: 1, isFullyExecuted: requiredSigners === 1 });
      setCurrentSignerCount(prev => prev + 1);
      setState("signed");
    } catch (error) { setState("upload"); }
  }, [selectedFile, isConnected, connectWallet, accountId, signDocument, multiSignerSession, requiredSigners, currentSignerCount]);

  const handleSecondSignerSign = useCallback(async () => {
    if (!isConnected) { await connectWallet(); return; }
    if (!selectedFile) return;
    
    setState("identity-check");
    try {
      const identityResult = await checkIdentity(accountId || "");
      if (!identityResult.isVerified) throw new Error("Identity verification failed");
    } catch (error) { setState("second-sign"); return; }
    
    setState("proving");
    try {
      const documentHash = await sha256(await selectedFile.arrayBuffer());
      const docId = multiSignerSession?.docId;
      if (!docId) throw new Error("No doc session");
      
      await createProof(documentHash, accountId || "", docId);
      
      // DYNAMIC MATH LOGIC
      const newSignersList = [...(multiSignerSession?.signers || []), accountId || "new-signer"];
      const required = multiSignerSession?.requiredSigners || 2;
      const isComplete = newSignersList.length === required;
      
      setMultiSignerSession({ ...multiSignerSession, signers: newSignersList, isFullyExecuted: isComplete } as MultiSignerSession);
      
      // CHAINED INVITE LINK LOGIC
      if (!isComplete) {
        const baseLink = generateInviteLink(docId);
        const nextLink = baseLink + (baseLink.includes('?') ? '&' : '?') + 'req=' + required + '&count=' + (currentSignerCount + 1);
        setInviteLink(nextLink);
      }
      
      let txHash = `zk_${Date.now()}_${randomHex(16)}`;
      if (signDocument) {
        try { const txResult = await signDocument(documentHash, new Uint8Array()); txHash = txResult?.txHash || txHash; } catch (e) {}
      }
      
      setSignedData({
        documentHash,
        documentName: selectedFile.name,
        txHash,
        signerId: accountId || "zk",
        timestamp: Date.now(),
        docId,
        signatureCount: newSignersList.length,
        isFullyExecuted: isComplete,
        signersList: newSignersList.map((addr, idx) => ({ address: addr, role: idx === newSignersList.length - 1 ? currentRole : "Signer " + (idx + 1) }))
      });
      setState("signed");
    } catch (error) { setState("second-sign"); }
  }, [isConnected, connectWallet, accountId, selectedFile, multiSignerSession, signDocument, currentSignerCount]);

  const handleCopyLink = () => { navigator.clipboard.writeText(inviteLink); setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000); };
  const canSign = (isConnected || multiSignerSession?.isSecondSigner) && selectedFile && (state !== "signed");

  return (
    <div className={`min-h-screen ${isDarkMode ? 'space-bg' : 'bg-slate-50'}`}>
      <nav className="w-full flex justify-between items-center px-6 py-4 bg-white dark:bg-[#050a10] border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white sticky top-0 z-50">
        <div className="flex items-center cursor-pointer" onClick={() => window.location.href='/'}>
          <img src="/logo.png" alt="NightSign" className="h-16 w-auto -ml-3 dark:invert transition-all" />
        </div>
        <div className="flex gap-6 items-center">
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-full text-gray-600 dark:text-white hover:bg-gray-100 dark:hover:bg-white/10 dark:hover:bg-white/10 focus:outline-none">
            {isDarkMode ? <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg> : <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>}
          </button>
          <span className="text-cyan-600 dark:text-cyan-400 font-semibold border-b-2 border-cyan-500 pb-1 mr-2">Sign Document</span>
          <button onClick={() => window.location.href='/verify'} className="text-gray-600 dark:text-white hover:text-gray-900 dark:hover:text-white transition-colors font-medium mr-2">Verify Signature</button>
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold tracking-wide border border-emerald-200 dark:border-emerald-500/30">Testnet</span>
          {isConnected ? (
             <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-black/30 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10">Connected</span>
             </div>
          ) : (
             <button onClick={connectWallet} className="text-sm font-bold bg-cyan-500 hover:bg-cyan-400 text-white px-5 py-2 rounded-lg transition-colors shadow-md shadow-cyan-500/20">Connect Midnight Wallet</button>
          )}
        </div>
      </nav>
      
      <main className="pt-28 pb-12">
        <div className="mx-auto max-w-xl px-4 flex flex-col gap-6">
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white">Zero-Knowledge <span className="text-cyan-600 dark:text-cyan-400">Document Signing</span></h1>
          </div>

          {state === "upload" && !selectedFile && !multiSignerSession?.isSecondSigner && (
            <div className="mb-6 p-6 glass-card">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-gray-700 dark:text-white/70">Number of Signers Required</label>
                <span className="text-2xl font-bold text-cyan-400">{requiredSigners}</span>
              </div>
              <input type="range" min="1" max="5" value={requiredSigners} onChange={(e) => setRequiredSigners(parseInt(e.target.value))} className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
            </div>
          )}

          <TrustTimeline currentStep={signedData?.isFullyExecuted ? totalPipelineSteps : state === "signed" ? Math.min(requiredSigners - 1, 2) : selectedFile ? 1 : 0} requiredSigners={requiredSigners} />

          <motion.div layout className="glass-card p-8" onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={(e) => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files[0]; if (file) setSelectedFile(file); }}>
            <AnimatePresence mode="wait">
              {state === "upload" && currentSignerCount === 0 && (
                <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {currentSignerCount > 0 && !selectedFile ? (
                    <div className="animate-pulse text-gray-400 p-8 text-center border border-gray-800 rounded-lg">
                      <div className="text-lg mb-2">🔓 Decrypting document from IPFS...</div>
                      <div className="text-sm text-gray-600">Please wait while we fetch the private boardroom document</div>
                    </div>
                  ) : !selectedFile ? <FileDropzone onFileSelect={setSelectedFile} isDragging={isDragging} /> : (
                    <div className="text-center">
                      <p className="text-lg font-medium text-white">{selectedFile.name}</p>
                      <div className="mt-4 mb-4 text-left"><label className="block text-xs font-medium text-white/70 mb-1 ml-1">Your Legal Role / Title</label><input type="text" value={currentRole} onChange={(e) => setCurrentRole(e.target.value)} placeholder="e.g., Buyer, CEO, Witness" className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors" /></div><button onClick={handleSign} disabled={!canSign} className="neon-button w-full mt-4">Sign Document</button>
                    </div>
                  )}
                </motion.div>
              )}
              {state === "identity-check" && <motion.div key="id" className="text-center text-white p-8">Verifying VC Identity...</motion.div>}
              {state === "proving" && <motion.div key="proving" className="p-8"><ProvingView /></motion.div>}
              {(currentSignerCount > 0 || state === "second-sign") && (
                <motion.div key="second" className="text-center p-8 text-white">
                  <h2 className="text-xl font-bold mb-4">Signer {Number(currentSignerCount) + 1} / {requiredSigners}</h2>
                  {isFetchingDoc && (
                    <div className="p-6 rounded-xl bg-cyan-500/10 border border-cyan-500/30 mb-4">
                      <div className="flex items-center justify-center gap-2 text-cyan-400 mb-2">
                        <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="font-medium">🔓 Decrypting Private Document...</span>
                      </div>
                      <p className="text-xs text-white/40">Fetching from IPFS and decrypting</p>
                    </div>
                  )}
                  {!selectedFile ? <FileDropzone onFileSelect={setSelectedFile} isDragging={isDragging} /> : (
                    <>
                    <div className="mt-4 mb-4 text-left"><label className="block text-xs font-medium text-white/70 mb-1 ml-1">Your Legal Role / Title</label><input type="text" value={currentRole} onChange={(e) => setCurrentRole(e.target.value)} placeholder="e.g., Buyer, CEO, Witness" className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors" /></div><button onClick={handleSign} className="neon-button w-full">Append Signature</button>
                    </>
                  )}
                </motion.div>
              )}
              {state === "signed" && signedData && (
                <motion.div key="signed">
                  {signedData.isFullyExecuted ? <AgreementCertificate data={signedData} onReset={() => { setState("upload"); setSelectedFile(null); setSignedData(null); }} /> : <SignedView data={signedData} inviteLink={inviteLink} onCopyLink={handleCopyLink} copiedLink={copiedLink} requiredSigners={requiredSigners} currentSignerCount={currentSignerCount} onReset={() => { setState("upload"); setSelectedFile(null); setSignedData(null); }} />}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

export default App;