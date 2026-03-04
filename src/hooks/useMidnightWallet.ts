import { useState, useCallback } from 'react';

export const useMidnightWallet = () => {
  const [accountId, setAccountId] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState("idle");

  const connect = useCallback(async () => {
    setStatus("connecting");
    try {
      const midnight = (window as any).midnight;
      const lace = midnight.lace || Object.values(midnight)[0];
      const api = await lace.connect('preprod');

      if (!api) throw new Error("Wallet refused connection.");

      // UNWRAPPER: This fixes the "slice" crash!
      const result = await api.getShieldedAddresses();
      let finalAddr = "";
      
      if (Array.isArray(result)) {
        const first = result[0];
        finalAddr = typeof first === 'string' ? first : (first?.address || first?.shieldedAddress || "");
      } else if (typeof result === 'object' && result !== null) {
        finalAddr = result.address || result.shieldedAddress || "";
      } else {
        finalAddr = result;
      }
      
      setAccountId(finalAddr);
      setIsConnected(true);
      setStatus("connected");
    } catch (err: any) {
      console.error("Connection failed:", err);
      setStatus("error");
    }
  }, []);

  return { accountId, isConnected, status, connect };
};