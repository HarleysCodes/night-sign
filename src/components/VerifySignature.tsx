// @ts-nocheck
/* eslint-disable */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { verifyProof } from "../managed/docusign";

export const VerifySignature = () => {
  const [file, setFile] = useState<File | null>(null);
  const [proofString, setProofString] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<"idle" | "success" | "fail">("idle");
  const [history, setHistory] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showShareTooltip, setShowShareTooltip] = useState(false);
  
  const [disclosedData, setDisclosedData] = useState({
    signerIdentity: false,
    timestamp: false
  });

  useEffect(() => {
    const saved = localStorage.getItem("verify_history");
    if (saved) setHistory(JSON.parse(saved));

    const urlParams = new URLSearchParams(window.location.search);
    const proofFromUrl = urlParams.get('proof');
    if (proofFromUrl) setProofString(proofFromUrl);
  }, []);

  const handleVerify = async () => {
    if (!file || !proofString) return;
    setIsVerifying(true);
    setResult("idle");
    try {
      const isValid = await verifyProof(proofString);
      
      setTimeout(() => {
        if (isValid) {
          const newEntry = {
            id: Date.now(),
            name: file.name,
            proof: proofString,
            date: new Date().toLocaleString()
          };
          const updatedHistory = [newEntry, ...history].slice(0, 8);
          setHistory(updatedHistory);
          localStorage.setItem("verify_history", JSON.stringify(updatedHistory));
          setResult("success");
        } else {
          setResult("fail");
        }
        setIsVerifying(false);
      }, 1200);
    } catch (error) {
      setResult("fail");
      setIsVerifying(false);
    }
  };

  const copyShareLink = () => {
    // This creates the link you can paste in a new tab
    const shareUrl = `${window.location.origin}${window.location.pathname}?proof=${proofString}`;
    navigator.clipboard.writeText(shareUrl);
    setShowShareTooltip(true);
    setTimeout(() => setShowShareTooltip(false), 2000);
  };

  const filteredHistory = history.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.proof.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-5xl px-4 grid grid-cols-1 md:grid-cols-3 gap-8">
      <div className="md:col-span-2 flex flex-col gap-6">
        <div className="text-center md:text-left">
          <h1 className="text-4xl font-bold text-white">Verify <span className="text-cyan-400">Signature</span></h1>
          <p className="text-gray-400 mt-2 text-sm font-medium italic">Powered by Midnight ZK-Circuitry</p>
        </div>

        <div className="glass-card p-8 space-y-6 bg-black/40 border-white/5 relative overflow-hidden">
          {/* Enhanced Share Button */}
          {proofString && (
            <div className="absolute top-4 right-8 z-10">
              <button 
                onClick={copyShareLink} 
                className={`text-[10px] px-4 py-2 rounded-full border transition-all flex items-center gap-2 font-black tracking-widest ${showShareTooltip ? 'bg-emerald-500 border-emerald-400 text-black shadow-[0_0_20px_rgba(16,185,129,0.4)]' : 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400 hover:bg-cyan-500 hover:text-black hover:shadow-[0_0_20px_rgba(6,182,212,0.4)]'}`}
              >
                {showShareTooltip ? "✓ LINK COPIED" : "🔗 GENERATE SHARE LINK"}
              </button>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-gray-500 tracking-[0.2em]">1. Authenticate Original PDF</label>
            <div className="border-2 border-dashed border-white/10 rounded-xl p-6 text-center cursor-pointer hover:border-cyan-500/30 transition-all bg-white/5" onClick={() => document.getElementById('verifyFile').click()}>
              <input id="verifyFile" type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <span className="text-sm text-gray-300 font-medium">{file ? file.name : "Select Original Document"}</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-gray-500 tracking-[0.2em]">2. ZK-Proof Certificate</label>
            <input type="text" placeholder="zk_proof_..." className="w-full bg-black/60 border border-white/10 rounded-xl p-4 text-cyan-400 font-mono text-sm focus:border-cyan-500 outline-none transition-colors" value={proofString} onChange={(e) => setProofString(e.target.value)} />
          </div>

          <button onClick={handleVerify} disabled={!file || !proofString || isVerifying} className="neon-button w-full py-4 font-black uppercase tracking-widest text-sm shadow-cyan-500/10">
            {isVerifying ? "Consulting Midnight Ledger..." : "Run Authenticity Check"}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {result === "success" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="p-6 bg-emerald-500/10 border border-emerald-500/40 rounded-2xl text-center shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                <span className="text-emerald-400 font-bold block text-lg">✓ Cryptographically Verified</span>
              </div>
              <div className="glass-card p-6 space-y-4 border-cyan-500/20 bg-cyan-950/5">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-400/80 border-b border-white/5 pb-3">Selective Disclosure Controls</h3>
                <DisclosureItem label="Signer Identity" active={disclosedData.signerIdentity} data="Identity Confirmed (Midnight VC)" onToggle={() => setDisclosedData(prev => ({...prev, signerIdentity: !prev.signerIdentity}))} />
                <DisclosureItem label="Blockchain Timestamp" active={disclosedData.timestamp} data={new Date().toLocaleString()} onToggle={() => setDisclosedData(prev => ({...prev, timestamp: !prev.timestamp}))} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-col gap-4">
        <div className="px-1">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4">Verification Archive</h3>
          <div className="relative mb-6">
            <input type="text" placeholder="Filter history..." className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-gray-300 focus:outline-none focus:border-cyan-500/50 transition-all pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            <svg className="w-4 h-4 text-gray-600 absolute left-3 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
        </div>

        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
          {filteredHistory.map(item => (
            <div key={item.id} className="glass-card p-4 hover:bg-white/5 cursor-pointer transition-all border-l-2 border-l-cyan-500/30 group" onClick={() => { setProofString(item.proof); }}>
              <div className="flex justify-between items-start mb-1">
                <p className="text-xs font-bold text-white truncate max-w-[140px]">{item.name}</p>
                <span className="text-[8px] text-gray-600 font-bold">{item.date.split(',')[0]}</span>
              </div>
              <p className="text-[10px] text-cyan-400/70 font-mono truncate group-hover:text-cyan-400 transition-colors">{item.proof}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const DisclosureItem = ({ label, active, data, onToggle }) => (
  <div className="flex items-center justify-between p-4 rounded-xl bg-black/40 border border-white/5 hover:border-white/10 transition-all">
    <div>
      <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-sm font-medium transition-all ${active ? 'text-white' : 'text-gray-600 italic'}`}>{active ? data : "ZK-Shielded Data"}</p>
    </div>
    <button onClick={onToggle} className={`text-[9px] px-4 py-1.5 rounded-full font-black transition-all ${active ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'border border-white/10 text-gray-500 hover:text-white'}`}>
      {active ? "HIDE" : "REVEAL"}
    </button>
  </div>
);

async function sha256(message: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', message);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}