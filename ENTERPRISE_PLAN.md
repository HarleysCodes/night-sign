# NightSign Enterprise SaaS - Implementation Plan
## Deep Audit & 4-Phase Implementation Roadmap

---

## Executive Summary

**Current State:** Single-page React app with client-side ZK proof generation
**Target State:** Enterprise-grade full-stack SaaS with Midnight Network integration
**Timeline:** 4 Phases over 12-16 weeks

---

## Current Codebase Analysis

### Technical Debt Identified:

| Issue | Severity | Location |
|-------|----------|----------|
| No backend persistence | Critical | Entire app |
| Hardcoded proof server URL | High | `src/managed/contracts/index.ts` |
| Wallet state not persisted | High | `useMidnightWallet.ts` |
| No RBAC / Auth | Critical | All files |
| IPFS assumed available | Medium | `App.tsx` |
| No error boundaries | Medium | `App.tsx` |
| Monolithic App.tsx (505 lines) | High | `App.tsx` |
| No TypeScript strict mode | Medium | `tsconfig.json` |
| Mixed mock/production code | High | `contracts/index.ts` |

---

## Phase 1: Foundation (Weeks 1-4)

### Goals:
- Migrate to Next.js 16 with App Router
- Set up Supabase for metadata storage
- Implement authentication

### Tasks:

1. **Initialize Next.js 16 Project**
   ```bash
   npx create-next-app@16 night-sign-enterprise --typescript --app --tailwind
   cd night-sign-enterprise
   npm install @midnight-ntwrk/dapp-connector-api @midnight-ntwrk/wallet
   ```

2. **Create Supabase Schema**
   ```sql
   -- Documents table (metadata only - NEVER raw PDFs)
   CREATE TABLE documents (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     doc_hash VARCHAR(64) NOT NULL UNIQUE,  -- SHA-256
     name VARCHAR(255) NOT NULL,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     created_by VARCHAR(64),  -- Bech32m address
     status VARCHAR(20) DEFAULT 'pending',
     required_signers INT DEFAULT 2,
     ipfs_cid VARCHAR(64)  -- Reference to encrypted file
   );

   -- Signatures table
   CREATE TABLE signatures (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     document_id UUID REFERENCES documents(id),
     signer_address VARCHAR(64) NOT NULL,  -- Bech32m
     role VARCHAR(100),
     proof_hash VARCHAR(128),  -- ZK proof hash
     signed_at TIMESTAMPTZ DEFAULT NOW(),
     verification_level VARCHAR(20) DEFAULT 'full'
   );

   -- Enable RLS
   ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
   ALTER TABLE signatures ENABLE ROW LEVEL SECURITY;
   ```

3. **Extract Wallet Hook to Shared Lib**
   - Move `useMidnightWallet.ts` to `/lib/wallet/`
   - Add persistence via Supabase

4. **Create Auth Middleware**
   ```typescript
   // middleware.ts
   import { NextResponse } from 'next/server';
   import type { NextRequest } from 'next/server';

   export function middleware(request: NextRequest) {
     const walletAddr = request.cookies.get('wallet_address');
     if (!walletAddr && request.nextUrl.pathname.startsWith('/dashboard')) {
       return NextResponse.redirect(new URL('/?auth-required', request.url));
     }
     return NextResponse.next();
   }
   ```

5. **Split Monolithic App.tsx**
   - Create `/app/sign/page.tsx`
   - Create `/app/verify/page.tsx`
   - Create `/components/SignFlow/`
   - Create `/components/VerifyFlow/`

---

## Phase 2: Enterprise Security & RBAC (Weeks 5-8)

### Goals:
- Implement Role-Based Access Control
- Add Midnight Selective Disclosure
- Audit logging

### Tasks:

1. **Define RBAC Roles**
   ```typescript
   type Role = 'admin' | 'signer' | 'auditor' | 'viewer';
   
   interface AccessPolicy {
     role: Role;
     canSign: boolean;
     canVerify: boolean;
     canViewDocument: boolean;
     canViewProof: boolean;
     selectiveDisclosure: string[];  // Fields visible to auditor
   }
   ```

2. **Implement Selective Disclosure Circuit**
   ```typescript
   // In contract (Compact v0.28.0)
   export circuit verify_signature(
     docHash: Bytes<32>,
     proof: Bytes<64>,
     discloseFields: Bool  // Controls what auditor sees
   ): [] {
     // Full verification for signers
     // Minimal disclosure for auditors (proof exists, not content)
     const verified = verify(proof, docHash);
     if (discloseFields) {
       disclose(verified);  // Full details
     } else {
       disclose(true);  // Just "valid"
     }
   }
   ```

3. **Create Audit Log Table**
   ```sql
   CREATE TABLE audit_logs (
     id UUID PRIMARY KEY,
     action VARCHAR(50) NOT NULL,
     user_address VARCHAR(64),
     document_id UUID,
     ip_address INET,
     timestamp TIMESTAMPTZ DEFAULT NOW(),
     metadata JSONB
   );
   ```

4. **Add Rate Limiting**
   ```typescript
   // lib/rate-limit.ts
   import { Redis } from '@upstash/redis';
   
   const redis = new Redis({
     url: process.env.UPSTASH_REDIS_REST_URL,
     token: process.env.UPSTASH_REDIS_REST_TOKEN,
   });
   
   export async function rateLimit(key: string, limit: number = 10) {
     const current = await redis.incr(key);
     if (current > limit) throw new Error('Rate limit exceeded');
   }
   ```

---

## Phase 3: Hybrid Proving Infrastructure (Weeks 9-12)

### Goals:
- Move complex ZK proofs to backend workers
- Implement proof caching
- Add multi-party signature support

### Tasks:

1. **Create Proof Worker Service**
   ```typescript
   // app/api/proof-worker/route.ts
   import { Worker } from 'worker_threads';
   
   export async function POST(request: Request) {
     const { circuit, input, priority } = await request.json();
     
     // Queue to Redis
     await redis.lpush('proof-queue', JSON.stringify({
       jobId: crypto.randomUUID(),
       circuit,
       input,
       priority
     }));
     
     return Response.json({ status: 'queued' });
   }
   ```

2. **Implement Proof Caching**
   ```sql
   CREATE TABLE proof_cache (
     input_hash VARCHAR(64) PRIMARY KEY,
     proof BYTEA,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours'
   );
   ```

3. **Multi-Party Signature Flow**
   ```typescript
   // lib/multi-signer.ts
   interface MultiPartySession {
     documentId: string;
     requiredSigners: number;
     currentSignatures: Signature[];
     threshold: number;  // For threshold signatures
     deadline: Date;
   }
   
   export async function createMPSession(docHash: string, threshold: number) {
     // Initialize threshold BLS scheme
     // Generate shares for each signer
     // Store encrypted shares in Supabase
   }
   ```

4. **Add WebSocket for Real-time Updates**
   ```typescript
   // lib/websocket.ts
   import { Server } from 'socket.io';
   
   export function initializeWS(server: http.Server) {
     const io = new Server(server);
     
     io.on('connection', (socket) => {
       socket.on('subscribe-doc', (docId) => {
         socket.join(`doc:${docId}`);
       });
     });
     
     return io;
   }
   ```

---

## Phase 4: Scale & Enterprise Features (Weeks 13-16)

### Goals:
- Multi-tenancy
- API for enterprise integrations
- Compliance features (GDPR, SOC2)

### Tasks:

1. **Multi-Tenant Architecture**
   ```sql
   CREATE TABLE organizations (
     id UUID PRIMARY KEY,
     name VARCHAR(255),
     tier VARCHAR(20),  -- 'free' | 'pro' | 'enterprise'
     settings JSONB DEFAULT '{}',
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   
   -- Add org_id to documents
   ALTER TABLE documents ADD COLUMN organization_id UUID REFERENCES organizations(id);
   ```

2. **Enterprise API**
   ```typescript
   // app/api/v1/documents/route.ts
   export async function GET(request: Request) {
     const apiKey = request.headers.get('x-api-key');
     const org = await verifyApiKey(apiKey);
     
     return Response.json({
       documents: await getOrgDocuments(org.id),
       _pagination: { cursor: '...' }
     });
   }
   ```

3. **Compliance Dashboard**
   - GDPR data export
   - Data retention policies
   - SOC2 audit trails

4. **CDN for Static Assets**
   - Move to Vercel Edge
   - Add Cloudflare for DDoS protection

---

## Immediate Action Items (Next 5 Tasks)

| # | Task | File | Change |
|---|------|------|--------|
| 1 | Add error boundary | `App.tsx` | Wrap in `<ErrorBoundary>` |
| 2 | Extract constants | `App.tsx` | Create `/lib/constants.ts` |
| 3 | TypeScript strict | `tsconfig.json` | Enable `strict: true` |
| 4 | Environment vars | `.env.example` | Document all env vars |
| 5 | Health check endpoint | New file | `/api/health` |

---

## Recommended Team Structure

- 1 Lead Architect
- 2 Frontend Engineers (Next.js + Midnight)
- 1 Backend Engineer (Node.js + ZK)
- 1 DevOps (Docker + Kubernetes)
- 1 Security Auditor

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Midnight API changes | Abstract wallet logic, use adapter pattern |
| ZK proof complexity | Start with simple 2-of-3 multisig |
| Data privacy | Zero-knowledge architecture from day 1 |
| Regulatory | Build compliance into Phase 1 |

---

*Generated: March 2026 | NightSign Enterprise Architecture*
