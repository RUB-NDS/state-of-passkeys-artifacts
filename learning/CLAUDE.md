# Claude Code Project Guide

## Project Overview

Fun with Flags and Passkeys is a WebAuthn/Passkey learning platform. It provides:
- Demo verifiers showing correct passkey implementations
- Security verifiers with intentional vulnerabilities (CTF-style)
- Isolated instances per browser session
- Configurable credentials and reward flags to prevent cheating in public deployments

## Tech Stack

- **Backend**: Node.js, TypeScript, Express
- **Templates**: Nunjucks
- **Frontend**: Vanilla JS, Bootstrap 5, Bootstrap Icons
- **WebAuthn**: @simplewebauthn/server + @simplewebauthn/browser
- **Storage**: JSON files (file-based, per-instance)
- **Testing**: Playwright (91 tests covering all 61 verifiers + core features)

## Project Structure

```
fun-with-flags-and-passkeys/
├── src/
│   ├── app.ts                    # Express app setup
│   ├── server.ts                 # Server entry point
│   ├── config/
│   │   ├── index.ts              # Configuration, helpers, reward flag shuffling
│   │   ├── defaults-loader.ts    # Env-var overrides for defaults.json
│   │   ├── verifiers.json        # All verifier definitions
│   │   └── combined_aaguid.json  # Authenticator metadata (AAGUIDs)
│   ├── middleware/
│   │   ├── auth.ts               # Authentication middleware
│   │   ├── error.ts              # Error handling middleware
│   │   ├── instance.ts           # Instance UUID middleware
│   │   └── verifier.ts           # Verifier loading middleware
│   ├── routes/
│   │   ├── index.ts              # Route aggregator
│   │   ├── auth.ts               # Login/logout/register routes
│   │   ├── flags.ts              # Flag CRUD routes
│   │   ├── comments.ts           # Flag comments routes
│   │   ├── ratings.ts            # Flag ratings routes
│   │   ├── instance.ts           # Instance management routes
│   │   ├── passkey.ts            # WebAuthn registration/authentication
│   │   ├── settings.ts           # User settings, passkey management
│   │   └── verifiers.ts          # Verifier switching
│   ├── services/
│   │   └── storage/
│   │       ├── index.ts          # Storage interface
│   │       ├── json-storage.ts   # JSON file storage (uses defaults-loader)
│   │       └── mongo-storage.ts  # MongoDB storage implementation
│   └── types/
│       ├── index.ts              # Express type extensions
│       ├── flag.ts               # Flag interface
│       ├── instance.ts           # Instance interface
│       ├── passkey.ts            # Passkey interface
│       ├── user.ts               # User interface
│       └── verifier.ts           # Verifier types and interfaces
├── views/                        # Nunjucks templates
├── public/                       # Static assets (CSS, JS)
├── data/
│   ├── defaults.json             # Default instance data (base values)
│   └── instances/                # Per-instance JSON files
├── scripts/
│   └── generate-env.js           # Generate randomized .env for production
├── tests/
│   ├── helpers/
│   │   ├── webauthn.ts           # WebAuthn emulator (COSE, signatures, etc.)
│   │   └── api.ts                # Session-aware API client
│   ├── core.spec.ts              # 30 core feature tests
│   ├── auth-demo.spec.ts         # 8 auth demo verifier tests (IDs 1-8)
│   ├── auth-security.spec.ts     # 20 auth security verifier tests (IDs 9-28)
│   ├── reg-demo.spec.ts          # 15 reg demo verifier tests (IDs 29-43)
│   └── reg-security.spec.ts      # 18 reg security verifier tests (IDs 44-61)
├── playwright.config.ts          # Playwright test configuration
└── dist/                         # Compiled JavaScript output
```

## Configuration System

All default user credentials and reward flag assignments are configurable via `.env` to support public repositories without enabling cheating.

### How It Works

1. **`data/defaults.json`** contains base default values (users, passkeys, flags)
2. **`src/config/defaults-loader.ts`** reads env vars at startup and overrides defaults:
   - `USER_<NAME>_PASSWORD` → bcrypt-hashed and replaces stored passwordHash
   - `USER_<NAME>_SECURITY_QUESTION` / `USER_<NAME>_SECURITY_ANSWER` → replaces Q&A
   - `PASSKEY_KEYS` → base64-encoded JSON of `{ id, publicKey, credentialId }` overrides
3. **`src/config/index.ts`** reads `REWARD_FLAG_ORDER` and permutes reward flags across security verifiers
4. **`src/services/storage/json-storage.ts`** uses `getEffectiveDefaults()` instead of raw defaults.json

### Environment Variables

| Variable | Description |
|----------|-------------|
| `USER_SHELDON_PASSWORD`, etc. | Plaintext passwords (bcrypt-hashed at startup) |
| `USER_SHELDON_SECURITY_QUESTION`, etc. | Security question text |
| `USER_SHELDON_SECURITY_ANSWER`, etc. | Security answer text |
| `PASSKEY_KEYS` | Base64-encoded JSON array of passkey key overrides |
| `REWARD_FLAG_ORDER` | Comma-separated 1-38 permutation (maps verifier position to flag index) |

### Generate Script

`node scripts/generate-env.js` produces a `.env` with randomized values and a `passkey-private-keys.json` with the corresponding JWK private keys.

## Verifier System

### Structure (src/config/verifiers.json)

61 verifiers total:
- **IDs 1-8**: Authentication demo verifiers (8 total, no rewards)
- **IDs 9-28**: Authentication security verifiers (20 total, §7.2.x)
- **IDs 29-43**: Registration demo verifiers (15 total, no rewards)
- **IDs 44-61**: Registration security verifiers (18 total, §7.1.x)

Each security verifier has an embedded `rewardFlag` object containing the flag details (country, title, description, imageUrl). At startup, `REWARD_FLAG_ORDER` can permute which flag goes to which verifier.

Default verifiers: Authentication = 2 (Discoverable), Registration = 29 (All Algorithms).

### VerifierChecks Interface (src/types/verifier.ts)

```typescript
interface VerifierChecks {
  // §7.2.5-6: Credential binding (auth only)
  skipCredentialBindingCheck: boolean;
  loginAsPreIdentifiedUser: boolean;  // Account takeover variant
  skipUserHandleCheck: boolean;
  loginAsUserHandle: boolean;         // Account takeover variant

  // §7.1.7 / §7.2.10: Type verification
  skipTypeVerification: boolean;
  allowSwappedType: boolean;

  // §7.1.8 / §7.2.11: Challenge verification
  skipChallengeVerification: boolean;
  allowReusedChallenge: boolean;
  allowAnyChallengeFromAnySession: boolean;

  // §7.1.9 / §7.2.12: Origin verification
  skipOriginVerification: boolean;
  allowSameSiteOrigin: boolean;

  // §7.1.10-11 / §7.2.13-14: Cross-origin
  skipCrossOriginCheck: boolean;

  // §7.1.14 / §7.2.15: RP ID verification
  skipRpIdVerification: boolean;
  allowSameSiteRpId: boolean;

  // §7.1.15 / §7.2.16: UP flag
  skipUserPresentCheck: boolean;

  // §7.1.16 / §7.2.17: UV flag
  skipUserVerifiedCheck: boolean;

  // §7.1.17 / §7.2.18: BE/BS backup flags
  skipBackupFlagsCheck: boolean;

  // §7.2.19: BE consistency (auth only)
  skipBackupEligibilityCheck: boolean;

  // §7.1.20: Algorithm (reg only)
  skipAlgorithmVerification: boolean;

  // §7.2.21: Signature (auth only)
  skipSignatureVerification: boolean;

  // §7.2.22: Counter (auth only)
  skipSignatureCounterCheck: boolean;

  // §7.1.25: Credential ID length (reg only)
  skipCredentialIdLengthCheck: boolean;

  // §7.1.26: Credential uniqueness (reg only)
  allowDuplicateCredentialId: boolean;
  allowCredentialOverwrite: boolean;
  allowCrossAccountCredential: boolean;
}
```

## Key Files for WebAuthn Logic

### src/routes/passkey.ts

Main WebAuthn implementation with section-commented verification steps:
- Registration: Lines ~268-691
- Authentication: Lines ~776-1150

Each verification step has comment blocks like:
```typescript
// ══════════════════════════════════════════════════════════════════════
// §7.2.11: Verify clientData.challenge equals options.challenge
// ══════════════════════════════════════════════════════════════════════
```

### Challenge Store

Global challenge store for cross-session verification:
```typescript
const globalChallengeStore = new Map<string, { instanceId: string; timestamp: number; type: string }>();
```

Session challenge history for reuse detection:
```typescript
req.session.challengeHistory: string[]
```

## Instance System

- Each browser gets a UUID stored in cookie
- Instance data stored in `data/instances/{uuid}.json`
- Middleware in `src/middleware/instance.ts` handles instance resolution
- Default data loaded via `getEffectiveDefaults()` (from `src/config/defaults-loader.ts`) on new instance creation

## Default Users

These are the default values (from `.env.example`). All are overridable via env vars.

| Username | Password | Passkeys | Algorithms | Reference |
|----------|----------|----------|------------|-----------|
| sheldon | `Bazinga73` | 2 | ES256, RS256 | Catchphrase + favorite number |
| leonard | `Physicist4Ever` | 1 | ES256 | His profession |
| penny | `CheesecakeFactory` | 0 | - | Where she worked |
| howard | `Astronaut2012` | 1 | PS384 | Year he went to space |
| raj | `CinnamonDog` | 0 | - | His dog's name |
| bernadette | `HalleyAndNeil` | 1 | EdDSA | Her children's names |
| amy | `Shamy4Life` | 3 | ES256, ES256, RS256 | Ship name + wordplay |

### Passkey AAGUIDs

| User | Passkey Name | AAGUID | Authenticator |
|------|--------------|--------|---------------|
| sheldon | MacBook Touch ID | `adce0002-35bc-c60a-648b-0b25f1f05503` | Apple Touch ID (Mac) |
| sheldon | YubiKey 5 | `cb69481e-8ff7-4039-93ec-0a2729a154a8` | YubiKey 5 Series |
| leonard | iPhone Passkey | `fbfc3007-154e-4ecc-8c0b-6e020557d7bd` | Apple iCloud Keychain |
| howard | Security Key | `0ea242b4-43c4-4a1b-8b17-dd6d0b6baec6` | Feitian ePass |
| bernadette | Windows Hello | `08987058-cadc-4b81-b6e1-30de50dcbe96` | Windows Hello |
| amy | MacBook Touch ID | `adce0002-35bc-c60a-648b-0b25f1f05503` | Apple Touch ID (Mac) |
| amy | iPhone Passkey | `fbfc3007-154e-4ecc-8c0b-6e020557d7bd` | Apple iCloud Keychain |
| amy | YubiKey Backup | `cb69481e-8ff7-4039-93ec-0a2729a154a8` | YubiKey 5 Series |

## Rewards System

- Reward flags are embedded directly in security verifiers (no separate IDs)
- Each security verifier has a `rewardFlag` object with: `country`, `title`, `description`, `imageUrl`
- Demo verifiers have `rewardFlag: null`
- Reward granted when exploit detected during verification
- `REWARD_FLAG_ORDER` env var permutes which flag goes to which verifier (anti-cheat)

## Testing

### Test Suite (91 tests)

| File | Tests | Coverage |
|------|-------|----------|
| `tests/core.spec.ts` | 30 | Login, registration, logout, instance management, verifier switching, flag CRUD |
| `tests/auth-demo.spec.ts` | 8 | Auth demo verifiers 1-8 (password, discoverable, non-discoverable, conditional UI, 2FA) |
| `tests/auth-security.spec.ts` | 20 | Auth security verifiers 9-28 (all 20 exploits) |
| `tests/reg-demo.spec.ts` | 15 | Reg demo verifiers 29-43 (all algorithms, RP ID upscope, platform/cross-platform, attestation) |
| `tests/reg-security.spec.ts` | 18 | Reg security verifiers 44-61 (all 18 exploits) |

### Test Helpers

- **`tests/helpers/webauthn.ts`** — Full WebAuthn response emulator:
  - COSE key encoding (ES256, RS256, PS384, EdDSA, and more)
  - AuthenticatorData construction with configurable flags (UP, UV, BE, BS, AT)
  - ClientDataJSON construction with configurable type, challenge, origin, crossOrigin, topOrigin
  - Attestation object (registration) and assertion (authentication) building
  - Signature generation with correct algorithms
  - Invalid signature generation (for skipSignatureVerification exploits)
  - Default key loading from hardcoded JWK values (sheldon, leonard, howard, bernadette, amy)

- **`tests/helpers/api.ts`** — Session-aware HTTP client:
  - Automatic instance creation and isolation
  - Cookie management for session and verifier state
  - Typed methods: login, register, logout, switchVerifier, getRegistrationOptions, verifyRegistration, getAuthenticationOptions, verifyAuthentication, resetInstance, deleteInstance

### Running Tests

```bash
npx playwright install chromium  # First time only
npm test                          # Run all 91 tests
npx playwright test <file>        # Run specific test file
```

### Writing New Tests

For security verifier tests, the pattern is:
1. Create API client → fresh isolated instance
2. Login (if needed for registration verifiers)
3. Switch to target verifier
4. Get options (challenge)
5. Build manipulated WebAuthn response using helpers
6. Verify and assert reward flag is returned
7. Cleanup via `client.dispose()`

Key detail: sheldon's ES256 passkey has `signCount: 42` in defaults, so authentication responses must use `signCount >= 43` to avoid counter errors (unless testing the counter bypass itself).

## UI Color Scheme

- **Authentication**: Blue (primary)
- **Registration**: Green (success)
- **Security/Vulnerabilities**: Red (danger) icons

## Common Development Tasks

### Add a New Security Verifier

1. **Add check flag** to `src/types/verifier.ts` VerifierChecks interface (if needed)

2. **Add verifier entry** to `src/config/verifiers.json`:
   ```json
   {
     "id": 62,
     "name": "No Example Check",
     "target": "authentication",
     "type": "security",
     "section": "7.2.x",
     "description": "Description of the vulnerability",
     "hint": "Hint for exploiting this vulnerability",
     "rewardFlag": {
       "country": "CountryName",
       "title": "Flag of CountryName",
       "description": "Interesting fact about this flag...",
       "imageUrl": "https://flagcdn.com/w320/xx.png"
     },
     "options": { ... },
     "ui": { ... },
     "checks": { ... }
   }
   ```

3. **Implement the check** in `src/routes/passkey.ts` with section comment

4. **Update `REWARD_FLAG_ORDER`** in `.env.example` to include the new flag index (39th entry)

5. **Add a test** in the appropriate test file

6. **Run build and tests**: `npm run build && npm test`

### Add a New Demo Verifier

Same as above but:
- Set `"type": "demo"` instead of `"security"`
- Set `"rewardFlag": null`
- No need to add check logic (demos use secure defaults)
- No REWARD_FLAG_ORDER update needed

### Modify Verification Logic

All verification happens in `src/routes/passkey.ts`:
- Registration verify: `/registration/verify` handler
- Authentication verify: `/authentication/verify` handler

Look for section comments (§7.x.x) to find specific checks.

## Scripts

```bash
npm run dev           # Development with hot reload
npm run build         # Compile TypeScript
npm start             # Production server
npm test              # Run Playwright test suite (91 tests)
npm run generate-env  # Generate randomized .env for production
npm run lint          # ESLint check
npm run format        # Prettier format
```
