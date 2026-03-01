# NightSign: Zero-Knowledge Document Signing

<p align="center">
  <img src="https://img.shields.io/badge/Midnight-Network-purple" alt="Midnight Network">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
  <img src="https://img.shields.io/badge/TypeScript-5.0-blue" alt="TypeScript">
</p>

NightSign is a privacy-preserving document signing dApp built on the Midnight Network. It uses Zero-Knowledge Proofs (ZKPs) to verify document signatures without revealing the signer's identity or the document contents.

## ✨ Features

- 🔒 **Privacy-First**: Documents are hashed locally; only the proof hits the blockchain
- ⚡ **Zero-Knowledge**: Prove document integrity without revealing the signer's identity
- 🌙 **Midnight Network**: Built on Midnight's privacy-preserving blockchain
- 💎 **Lace Wallet**: Native integration with the Midnight Lace wallet
- 🎨 **Aerodrome-Inspired UI**: Modern dark theme with neon accents

## 🚀 Prerequisites

- [Lace Beta Wallet](https://www.lace.io/) browser extension installed
- Midnight Preprod Network configured in Lace
- Node.js 18+ 

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/night-sign.git
cd night-sign

# Install dependencies
npm install

# Start development server
npm run dev
```

## 🔧 Configuration

### Setting Up Lace Wallet

1. Install the Lace browser extension
2. Create or import a wallet
3. Switch to the **Preprod** network:
   - Open Lace settings
   - Navigate to Networks
   - Select "Preprod"

### Environment Variables (Optional)

Create a `.env` file for custom configuration:

```env
VITE_PROOF_SERVER_URL=http://localhost:6300
VITE_MIDNIGHT_NETWORK=preprod
```

## 🧩 How It Works

### Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   User      │────▶│   NightSign  │────▶│   Midnight  │
│  uploads    │     │  (Frontend)  │     │   Network   │
│  document   │     └──────────────┘     └─────────────┘
└─────────────┘            │
                           ▼
                  ┌─────────────────┐
                  │  Compact ZK    │
                  │  Circuit       │
                  │ (signDocument)│
                  └─────────────────┘
```

### The Signing Flow

1. **Document Upload**: User selects a file (PDF, contract, etc.)
2. **Local Hashing**: SHA-256 hash computed in-browser (document never leaves the device)
3. **ZK Proof Generation**: The Compact circuit generates a zero-knowledge proof
4. **Shielded Submission**: Proof submitted to Midnight network (no identity reveal)
5. **Verification**: Anyone can verify the signature without knowing the signer or document

### Privacy Guarantees

- **Document Privacy**: Only the hash is computed; original file stays local
- **Identity Privacy**: ZK proofs verify the signer without revealing their address
- **Transaction Privacy**: Midnight's shielded transactions hide all metadata

## 🔍 How to Verify

NightSign supports **Selective Disclosure** - verifiers can check specific attributes without revealing the full proof.

### For Auditors

To verify a signed document, you need:

1 original. **The PDF/document** - The file that was signed
2. **The ZK-Proof String** - Provided by the signer (found in the signature receipt)

### Verification Process

1. Navigate to the **Verify a Document** page
2. Drop the original document file into the upload zone
3. Paste the ZK-Proof String into the text area
4. Click **Verify Signature**

### What Gets Disclosed

The verification reveals only what the proof certifies:

| Disclosure | Shows |
|------------|-------|
| Document Integrity | ✅ Whether the file matches the signed hash |
| Signer Authenticity | ✅ Whether signed by a valid Midnight wallet |
| Timestamp | ✅ When the signature was created |

**What stays private:**
- The signer's full address (only shows truncated)
- The document contents (only hash is verified)
- Transaction details

### Receipt Download

Signers can download a `.txt` receipt containing:
- Document name and hash
- Signer address (truncated)
- ZK-Proof string
- Timestamp
- Mock transaction ID

## 🛠️ Development

### Running Tests

```bash
npm run test
```

### Building for Production

```bash
npm run build
```

### Project Structure

```
night-sign/
├── src/
│   ├── components/     # React components
│   ├── hooks/          # Custom hooks (wallet, etc.)
│   ├── managed/        # Compiled ZK artifacts
│   │   └── docusign/  # Circuit output
│   ├── App.tsx        # Main application
│   └── main.tsx       # Entry point
├── public/             # Static assets
├── index.html          # HTML template
└── package.json        # Dependencies
```

## 🔐 Security

- All document hashing happens client-side
- Zero-knowledge proofs ensure signers cannot be deanonymized
- The Midnight network provides additional privacy guarantees

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## 📜 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- [Midnight Network](https://midnight.network/) - Privacy-preserving blockchain
- [Lace Wallet](https://www.lace.io/) - Midnight's official wallet
- [Aerodrome Finance](https://aerodrome.finance/) - UI inspiration
