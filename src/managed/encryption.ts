import CryptoJS from 'crypto-js';

/**
 * Generate a random session key
 */
export function generateSessionKey(length: number = 16): string {
  return CryptoJS.lib.WordArray.random(length).toString();
}

/**
 * Encrypt a file using AES-256
 */
export async function encryptFile(file: File, secretKey: string): Promise<File> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const wordArray = CryptoJS.lib.WordArray.create(bytes as any);
  const encrypted = CryptoJS.AES.encrypt(wordArray, secretKey).toString();
  
  return new File([encrypted], file.name + '.enc', { type: 'application/octet-stream' });
}

/**
 * Decrypt an AES-encrypted file back to original
 */
export async function decryptFile(
  encryptedBlob: Blob, 
  secretKey: string, 
  originalName: string
): Promise<File> {
  const text = await encryptedBlob.text();
  const decrypted = CryptoJS.AES.decrypt(text, secretKey);
  const wordArray = decrypted as CryptoJS.lib.WordArray;
  
  const sigBytes = wordArray.sigBytes;
  if (sigBytes <= 0) {
    throw new Error('Decryption failed - invalid key or corrupted data');
  }
  
  const uint8Array = new Uint8Array(sigBytes);
  const cells = wordArray.words;
  
  for (let i = 0; i < sigBytes; i++) {
    const cellIndex = Math.floor(i / 4);
    const byteIndex = i % 4;
    uint8Array[i] = (cells[cellIndex] >> (8 * (3 - byteIndex))) & 0xff;
  }
  
  // Detect original MIME type
  const mimeType = originalName.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream';
  
  // Strip .enc extension if present
  const cleanName = originalName.replace(/\.enc$/, '');
  
  return new File([uint8Array], cleanName, { type: mimeType });
}

/**
 * Upload encrypted file to IPFS via Pinata
 */
export async function uploadToIPFS(file: File): Promise<string> {
  const pinataJWT = import.meta.env.VITE_PINATA_JWT;
  
  if (!pinataJWT) {
    throw new Error('Pinata JWT not configured. Set VITE_PINATA_JWT in .env');
  }
  
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${pinataJWT}`,
    },
    body: formData,
  });
  
  if (!response.ok) {
    throw new Error(`IPFS upload failed: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.IpfsHash;
}

/**
 * Fetch encrypted file from IPFS
 */
export async function fetchFromIPFS(cid: string): Promise<Blob> {
  // Use ipfs.io gateway as fallback
  const gateways = [
    `https://gateway.pinata.cloud/ipfs/${cid}`,
    `https://ipfs.io/ipfs/${cid}`,
  ];
  
  for (const url of gateways) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return await response.blob();
      }
    } catch (e) {
      console.warn(`Failed to fetch from ${url}`, e);
    }
  }
  
  throw new Error('Failed to fetch encrypted file from IPFS');
}
