# Claude Code Project Guide

## Project Overview

Fun with Flags and Passkeys is a WebAuthn/Passkey learning platform. It provides:
- Demo verifiers showing correct passkey implementations
- Security verifiers with intentional vulnerabilities (CTF-style)
- Isolated instances per browser session

## Tech Stack

- **Backend**: Node.js, TypeScript, Express
- **Templates**: Nunjucks
- **Frontend**: Vanilla JS, Bootstrap 5, Bootstrap Icons
- **WebAuthn**: @simplewebauthn/server + @simplewebauthn/browser
- **Storage**: JSON files (file-based, per-instance)

## Project Structure

```
fun-with-flags-and-passkeys/
├── src/
│   ├── app.ts                    # Express app setup
│   ├── server.ts                 # Server entry point
│   ├── config/
│   │   ├── index.ts              # Configuration and helpers
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
│   │       ├── json-storage.ts   # JSON file storage implementation
│   │       └── mongo-storage.ts  # MongoDB storage implementation
│   └── types/
│       ├── index.ts              # Express type extensions
│       ├── flag.ts               # Flag interface
│       ├── instance.ts           # Instance interface
│       ├── passkey.ts            # Passkey interface
│       ├── user.ts               # User interface
│       └── verifier.ts           # Verifier types and interfaces
├── views/
│   ├── layouts/
│   │   └── base.njk              # Base template
│   ├── pages/
│   │   ├── home.njk              # Flags feed page
│   │   ├── login.njk             # Login page
│   │   ├── login-2fa.njk         # 2FA login page
│   │   ├── register.njk          # Registration page
│   │   ├── settings.njk          # User settings page
│   │   ├── verifiers.njk         # Verifiers selection page
│   │   ├── flag-detail.njk       # Single flag view
│   │   ├── flag-create.njk       # Create flag form
│   │   ├── flag-edit.njk         # Edit flag form
│   │   └── error.njk             # Error page
│   └── partials/
│       ├── navbar.njk            # Navigation bar
│       ├── flag-card.njk         # Flag card component
│       ├── passkey-scripts.njk   # WebAuthn JS helpers
│       └── reward-modal.njk      # Reward popup modal
├── public/                       # Static assets (CSS, JS)
├── data/
│   ├── defaults.json             # Default instance data
│   └── instances/                # Per-instance JSON files
└── dist/                         # Compiled JavaScript output
```

## Verifier System

### Structure (src/config/verifiers.json)

60 verifiers total:
- **IDs 1-7**: Authentication demo verifiers (7 total, no rewards)
- **IDs 8-27**: Authentication security verifiers (20 total, §7.2.x)
- **IDs 28-42**: Registration demo verifiers (15 total, no rewards)
- **IDs 43-60**: Registration security verifiers (18 total, §7.1.x)

Each security verifier has an embedded `rewardFlag` object containing the flag details (country, title, description, imageUrl).

Default verifiers: Authentication = 2 (Discoverable), Registration = 28 (All Algorithms).

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
- Default data loaded from `data/defaults.json` on new instance creation

## Default Users

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
     "id": 61,
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
     "options": {
       "passkeyEnabled": true,
       "passkeyFlow": "discoverable",
       "conditionalUI": false,
       "userVerification": "required"
     },
     "ui": {
       "showPasswordForm": true,
       "showPasskeyButton": true,
       "showUsernameFirst": false,
       "autotriggerPasskey": false
     },
     "checks": {
       "skipCredentialBindingCheck": false,
       "loginAsPreIdentifiedUser": false,
       "skipUserHandleCheck": false,
       "loginAsUserHandle": false,
       "skipTypeVerification": false,
       "allowSwappedType": false,
       "skipChallengeVerification": false,
       "allowReusedChallenge": false,
       "allowAnyChallengeFromAnySession": false,
       "skipOriginVerification": false,
       "allowSameSiteOrigin": false,
       "skipCrossOriginCheck": false,
       "skipRpIdVerification": false,
       "allowSameSiteRpId": false,
       "skipUserPresentCheck": false,
       "skipUserVerifiedCheck": false,
       "skipBackupFlagsCheck": false,
       "skipBackupEligibilityCheck": false,
       "skipAlgorithmVerification": false,
       "skipSignatureVerification": false,
       "skipSignatureCounterCheck": false,
       "skipCredentialIdLengthCheck": false,
       "allowDuplicateCredentialId": false,
       "allowCredentialOverwrite": false,
       "allowCrossAccountCredential": false
     }
   }
   ```

3. **Implement the check** in `src/routes/passkey.ts` with section comment:
   ```typescript
   // ══════════════════════════════════════════════════════════════════════
   // §7.2.x: Description of what this check does
   // ══════════════════════════════════════════════════════════════════════
   if (checks.skipExampleCheck) {
     // Bypass the check, mark exploit detected
     exploitDetected = true;
   } else {
     // Normal secure verification
     if (!validCondition) {
       return res.status(400).json({ error: 'Verification failed', verified: false });
     }
   }
   ```

4. **Run build**: `npm run build`

### Add a New Demo Verifier

Same as above but:
- Set `"type": "demo"` instead of `"security"`
- Set `"rewardFlag": null`
- No need to add check logic (demos use secure defaults)

### Modify Verification Logic

All verification happens in `src/routes/passkey.ts`:
- Registration verify: `/registration/verify` handler
- Authentication verify: `/authentication/verify` handler

Look for section comments (§7.x.x) to find specific checks.

## Scripts

```bash
npm run dev      # Development with hot reload
npm run build    # Compile TypeScript
npm start        # Production server
npm run lint     # ESLint check
npm run format   # Prettier format
```
