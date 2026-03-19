# Fun with Flags and Passkeys - Passkey Learning Platform

A Big Bang Theory themed platform for learning WebAuthn/Passkeys through interactive demos and CTF-style vulnerability exploitation.

## Development Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:3000

## Production Deployment

For production, generate randomized credentials and reward flag ordering to prevent students from cheating by reading the source code:

```bash
node scripts/generate-env.js
# Edit .env for production (set RP_ID, ORIGIN, SESSION_SECRET, etc.)
```

Alternatively, to use the default (development) values:

```bash
cp .env.example .env
# Edit .env for production
```

### Docker Run

```bash
docker run -d \
  --name fun-with-flags-and-passkeys \
  -p 3000:3000 \
  --env-file .env \
  -v fun-with-flags-and-passkeys-data:/app/data/instances \
  ghcr.io/lonetis/fun-with-flags-and-passkeys:latest
```

### Docker Compose

```yaml
services:
  fun-with-flags-and-passkeys:
    image: ghcr.io/lonetis/fun-with-flags-and-passkeys:latest
    restart: unless-stopped
    env_file: .env
    expose:
      - "3000"
    volumes:
      - instance-data:/app/data/instances
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.funwithflags.rule=Host(`YOUR_DOMAIN`)"
      - "traefik.http.routers.funwithflags.entrypoints=websecure"
      - "traefik.http.routers.funwithflags.tls.certresolver=letsencrypt"
      - "traefik.http.services.funwithflags.loadbalancer.server.port=3000"

  mongo:
    image: mongo:7
    restart: unless-stopped
    volumes:
      - mongo-data:/data/db

  traefik:
    image: traefik:v3.2
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    environment:
      - TRAEFIK_PROVIDERS_DOCKER=true
      - TRAEFIK_PROVIDERS_DOCKER_EXPOSEDBYDEFAULT=false
      - TRAEFIK_ENTRYPOINTS_WEB_ADDRESS=:80
      - TRAEFIK_ENTRYPOINTS_WEBSECURE_ADDRESS=:443
      - TRAEFIK_CERTIFICATESRESOLVERS_LETSENCRYPT_ACME_EMAIL=YOUR_EMAIL
      - TRAEFIK_CERTIFICATESRESOLVERS_LETSENCRYPT_ACME_STORAGE=/letsencrypt/acme.json
      - TRAEFIK_CERTIFICATESRESOLVERS_LETSENCRYPT_ACME_HTTPCHALLENGE_ENTRYPOINT=web
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - letsencrypt-data:/letsencrypt

volumes:
  instance-data:
  mongo-data:
  letsencrypt-data:
```

## Configuration

All default user credentials, passkey keys, and reward flag assignments are configurable via environment variables in `.env`. This allows the repository to remain public while preventing students from cheating by reading hardcoded values.

### Environment Variables

See `.env.example` for the full list. Key categories:

| Category | Variables | Description |
|----------|-----------|-------------|
| Server | `PORT`, `NODE_ENV`, `SESSION_SECRET` | Basic server config |
| WebAuthn | `RP_ID`, `ORIGIN` | Relying party settings |
| User Passwords | `USER_SHELDON_PASSWORD`, ... | Plaintext passwords (bcrypt-hashed at startup) |
| Security Q&A | `USER_SHELDON_SECURITY_QUESTION`, `USER_SHELDON_SECURITY_ANSWER`, ... | Per-user security questions and answers |
| Passkey Keys | `PASSKEY_KEYS` | Base64-encoded JSON of passkey key overrides |
| Reward Flags | `REWARD_FLAG_ORDER` | Comma-separated permutation (1-38) mapping verifiers to flags |
| Storage | `USE_MONGO`, `MONGO_URI` | Optional MongoDB backend |
| Cleanup | `INSTANCE_MAX_AGE_MS`, `CLEANUP_INTERVAL_MS` | Instance auto-cleanup timings |

### Generating Random Values

Run the generate script to create a `.env` with randomized passwords, security questions, passkey key pairs, and a shuffled reward flag order:

```bash
node scripts/generate-env.js
```

This also outputs `passkey-private-keys.json` containing the JWK private keys needed for testing. Both files are in `.gitignore`.

## Default Users

These are the default values (used when `cp .env.example .env`). When `generate-env.js` is used, all passwords, security questions, and passkey keys are randomized.

| Username | Password | Passkeys | Algorithms |
|----------|----------|----------|------------|
| sheldon | `Bazinga73` | 2 | ES256, RS256 |
| leonard | `Physicist4Ever` | 1 | ES256 |
| penny | `CheesecakeFactory` | 0 | - |
| howard | `Astronaut2012` | 1 | PS384 |
| raj | `CinnamonDog` | 0 | - |
| bernadette | `HalleyAndNeil` | 1 | EdDSA |
| amy | `Shamy4Life` | 3 | ES256, ES256, RS256 |

### Default Security Questions

| Username | Question | Answer |
|----------|----------|--------|
| sheldon | What is the name of my favorite spot on the couch? | 0,0,0,0 |
| leonard | What is the name of my inhaler brand? | Primatene Mist |
| penny | What is my apartment number? | 4B |
| howard | What is the name of the space station I visited? | International Space Station |
| raj | What is the name of my dog? | Cinnamon |
| bernadette | What is my daughter's name? | Halley |
| amy | What is the name of my pet monkey? | Ricky |

## Verifiers

Verifiers are configurations that control how the server handles passkey registration and authentication. Each verifier defines:
- Which WebAuthn options to use (algorithms, user verification, etc.)
- Which security checks to perform or skip
- UI behavior (password form, passkey button, etc.)

### How Verifiers Work

1. **Select a Verifier**: Navigate to `/verifiers` and choose an authentication or registration verifier
2. **Verifier Applies**: All subsequent passkey operations use that verifier's configuration
3. **Separate Selection**: Authentication and registration verifiers are selected independently

### Verifier Types

**Demo Verifiers**: Demonstrate different passkey flows with proper security:
- Various authentication modes (discoverable, non-discoverable, conditional UI, 2FA)
- Different registration options (algorithms, RP ID scoping, attestation)

**Security Verifiers**: Intentionally vulnerable implementations for learning:
- Each skips or weakens a specific WebAuthn verification step
- Mapped to W3C WebAuthn spec sections (§7.1.x for registration, §7.2.x for authentication)
- Successfully exploiting a vulnerability rewards you with a collectible flag

### Reward Flag Ordering

By default, reward flags are assigned sequentially to security verifiers (verifier 1 gets flag 1, etc.). In production, set `REWARD_FLAG_ORDER` to a shuffled permutation so students cannot determine which flag belongs to which verifier from the source code. The `generate-env.js` script does this automatically.

## Instance System

Each browser session operates in an isolated instance, allowing multiple users to learn simultaneously without interference.

### How Instances Work

1. **Automatic Creation**: First visit generates a unique instance UUID stored in your browser cookie
2. **Complete Isolation**: Each instance has its own users, passkeys, flags, and rewards
3. **Default Data**: New instances are populated with default users and sample data

### Instance Management

Access the Instance dropdown in the navbar to:

| Action | Description |
|--------|-------------|
| **Copy UUID** | Copy your instance ID to share or save |
| **Switch** | Enter another UUID to access that instance |
| **New** | Create a fresh instance with default data |
| **Reset** | Restore current instance to default state |
| **Delete** | Remove current instance and create a new one |

### Use Cases

- **Teaching**: Each student gets their own instance by default
- **Collaboration**: Share your UUID with others to work in the same instance
- **Fresh Start**: Reset or create new instance to start over

## Testing

The project includes a comprehensive Playwright test suite covering all 61 verifiers and core platform features.

### Running Tests

```bash
# Install Playwright browsers (first time only)
npx playwright install chromium

# Run all tests
npm test

# Run specific test file
npx playwright test auth-security.spec.ts

# Run with verbose output
npx playwright test --reporter=line
```

### Test Structure

| File | Tests | Coverage |
|------|-------|----------|
| `tests/core.spec.ts` | 30 | Login, registration, logout, instance management, verifier switching, flag CRUD |
| `tests/auth-demo.spec.ts` | 8 | Authentication demo verifiers (IDs 1-8) |
| `tests/auth-security.spec.ts` | 20 | Authentication security verifiers (IDs 9-28) |
| `tests/reg-demo.spec.ts` | 15 | Registration demo verifiers (IDs 29-43) |
| `tests/reg-security.spec.ts` | 18 | Registration security verifiers (IDs 44-61) |

### Test Helpers

- `tests/helpers/webauthn.ts` — WebAuthn emulator for crafting valid and manipulated attestation/assertion responses (COSE key encoding, signature generation, field manipulation)
- `tests/helpers/api.ts` — Session-aware API client with automatic instance isolation

Each test creates its own isolated instance and cleans up afterwards. Tests run in parallel for speed.

## Default User Passkey Keys

These are the JWK (JSON Web Key) representations of the default passkeys. When `generate-env.js` is used, new key pairs are generated and the private keys are written to `passkey-private-keys.json`.

<details>
<summary>Click to expand default JWK keys</summary>

```json
{
  "keys": [
    {
      "passkeyId": 1,
      "credentialId": "c2hlbGRvbi1jcmVkLTE",
      "userId": 1,
      "name": "MacBook Touch ID",
      "algorithm": -7,
      "privateKey": {
        "kty": "EC",
        "crv": "P-256",
        "alg": "ES256",
        "x": "LgXqG5n52e_-vPeXFszuYHAIymuJ2dzssHiZ1Unv-kw",
        "y": "KEIruNvIexnk5HQnS_H9QOGDf47J0BneGNgOYzJhDVg",
        "d": "ze-LcPCeInDzOwouNTy3i-HCd6DT5CBEDk8ZU2QlGUU"
      },
      "publicKey": {
        "kty": "EC",
        "crv": "P-256",
        "alg": "ES256",
        "x": "LgXqG5n52e_-vPeXFszuYHAIymuJ2dzssHiZ1Unv-kw",
        "y": "KEIruNvIexnk5HQnS_H9QOGDf47J0BneGNgOYzJhDVg"
      }
    },
    {
      "passkeyId": 2,
      "credentialId": "c2hlbGRvbi1jcmVkLTI",
      "userId": 1,
      "name": "YubiKey 5",
      "algorithm": -257,
      "privateKey": {
        "kty": "RSA",
        "alg": "RS256",
        "n": "251ZOi6qFFWMfGTzZwLnVTmM7z2M01FXjvGQe0mm2KFIDSC53L83HtyFkI9VgOYntxvfAksFX_xVIg1SXUO1E8uYUBKf0nje-ZUgr4j0YMYt5Qr4qDNDVrVGYJqUTe3wMza44B2zT11J28C9AoJhwcKksHajyqsl6vRWLCScvTbgL5Cz17aEqRLaTiw4lPfcRysSiqI30K6IZQdXpLJqY0Xq55x7p3ybGqKTXisjFXcYr0n9XI-rDQV7hjWx97-61BIMLwh_CNwr9kv9Wu0H4fJE4Xq3VSNzC6QAUnkrWxIQ5XAB3l761Bnn_xFqnXSugErhOAn8GyGJA9OV5wmwMw",
        "e": "AQAB",
        "d": "Bf2PyS-BV4FR417EPkNtA1JzjrRoxVGLCDd8pRry4HvdwZs_6_k8oVc16Xs6GNmuVvyn-PcKPtOyOss5kO5fim-w8uuJzS2bihv67UQuGP8EPM2Ez4m-b3y4XmWOYBB6edsnRdhpjg5Rt8XVIgljw0DyScH4C8zerD8H-WJHnZL3BlpbBQGU96B1qWUi8gcRwLjRfZP-m5iR6-suHc3z0p95qe6vMEnbWTOKa3LwEjLGBM2OZsI_lMkAwGTXYiR9x7M58CQFXeB1vugXJN8hDSdvh8U4MRdCQ_qz7Bel58FcPHVbf_hgE7kg_3wEQv88tC0xeZFc642ZJsgUqpTmaQ",
        "p": "7WijCGfla7hCFBzXqJ3U_ulQXMHxsNBot3hSzVt2Ep__C86wJLd_l7OlI2kX85QRwu58LD3iwUfsjP5ooRR3AvzsllmsrUwrPru4Sgn4yJ6W3V2mT0cjLPPJ0Kxl_vUoSQ89rHTrxtj5MBL5__N1rmoPXp6EWU5wQvK5JwJJJY0",
        "q": "7M_9wCZEbX8NBYJpkIPChS7ltNH53l22G-Sr2PRm1Qf4yNerBYGepYARA9cYH4rq0TUZKQyiXOaSMik_5jcr5cgDejhdp--yRQH8wbzLfi8w6wqq7j1WPYO8mteKpzV48AHiVi0t4sVA-qmkmpZmuPNy4mOnK88-XxKxZqLYXL8",
        "dp": "DUE5UP_T_EamUc8mb0CYor7OAM_HObL5Fb0_Cj4gAnwyVittBC_GjOa3wplcf_n1X-fGwQWXgmkMmPafStcEqgMLBn3tOSO2imMar--Ml07bZ3KSFX0IRrs5uk_Vxf1UCXgzXkyM2WZFy1xT3ult2ZYMU6EQDJhnhiVdFwN2qAU",
        "dq": "MetaS0IF1KsenJW0GRGdVKPhKi_FI1nPxKt8ijxi3O9UQ0orM_rx7WNEsvGJlUScYUN3LU8Lftff45EMdkQVDdgO25m8LGV7x842cMSShOP_xNw30ga-AjOd82oSQVMlTjqncpENhiscmnpeR3QC7WPsSMrG95Y1SKdRHBih0VM",
        "qi": "HlFfqrcxerRhJPLclnTCkr2_1HavWlJ26GWqPi7Z_hYEOgI06k6V5dz9XxqdtRVIuZj0AzZbLVk-zmNlSLPs74KZxadGtyjShpqrphGhQJJjaBmphYmFgN8bEr6BL4n7xJJnTYSNxamx8sxXMWdJUpwC5olvSB_CLAPZauhXkRI"
      },
      "publicKey": {
        "kty": "RSA",
        "alg": "RS256",
        "n": "251ZOi6qFFWMfGTzZwLnVTmM7z2M01FXjvGQe0mm2KFIDSC53L83HtyFkI9VgOYntxvfAksFX_xVIg1SXUO1E8uYUBKf0nje-ZUgr4j0YMYt5Qr4qDNDVrVGYJqUTe3wMza44B2zT11J28C9AoJhwcKksHajyqsl6vRWLCScvTbgL5Cz17aEqRLaTiw4lPfcRysSiqI30K6IZQdXpLJqY0Xq55x7p3ybGqKTXisjFXcYr0n9XI-rDQV7hjWx97-61BIMLwh_CNwr9kv9Wu0H4fJE4Xq3VSNzC6QAUnkrWxIQ5XAB3l761Bnn_xFqnXSugErhOAn8GyGJA9OV5wmwMw",
        "e": "AQAB"
      }
    },
    {
      "passkeyId": 3,
      "credentialId": "bGVvbmFyZC1jcmVkLTE",
      "userId": 2,
      "name": "iPhone Passkey",
      "algorithm": -7,
      "privateKey": {
        "kty": "EC",
        "crv": "P-256",
        "alg": "ES256",
        "x": "xR9wtCQbXzwUAJYamFkEY6Yb3-Mei43UOQytiLgv-VA",
        "y": "LO91gxbTJqz3BwjFKzYvoG4dVlmo3pFnnS6vcA1QAQY",
        "d": "74nYZG3EwBo-o2QLRknXqPjRWcs84sLFp4ykDLefSs8"
      },
      "publicKey": {
        "kty": "EC",
        "crv": "P-256",
        "alg": "ES256",
        "x": "xR9wtCQbXzwUAJYamFkEY6Yb3-Mei43UOQytiLgv-VA",
        "y": "LO91gxbTJqz3BwjFKzYvoG4dVlmo3pFnnS6vcA1QAQY"
      }
    },
    {
      "passkeyId": 4,
      "credentialId": "aG93YXJkLWNyZWQtMQ",
      "userId": 4,
      "name": "Security Key",
      "algorithm": -38,
      "privateKey": {
        "kty": "RSA",
        "alg": "PS384",
        "n": "u6iUlq1JEjAlPiyGwAEjibQDOj9HECiutZ7T0s6AXXOHib1G3GPn7YCvZVIz0gk7Vbf53qCGxLJ8qbALgaCqaOcJB-9cbVohgwXefS5tIjPn2TnoI2KyaWBO1bxGLFChf_tde5KRL5dE2jpYwAPUHXljNdog9cLX8zbPucGKlGR88AwB-rHTM8gdGwwGfGstKeopZlw4TQHjujY2iIh1Ga-oiyCN5M0F2-E3bN4_JcVGGyRfjWKjpZ44fBifyNihRujc6G43Qo3lyFigRE26Y-3Jpk4nm1cpfMU-nn8t6WEl5UEXwPDJjYWxt3g9nNdh6XuBLNHi0CuBZ9P9USvNfw",
        "e": "AQAB",
        "d": "U9FATOypLo6Ck_qfVTMtBFx69JE-1GDXaBfA1O-XNiZb65G3DMky1kocDU1iB_ZHoknCOUXJ7CEsvT38ZbG1a5WF2x12UwFm5nbAoXkTFavJaqUKooN63MY_cAff7_szp05GuuMEJhWSk0ZsTZdoLqIBRhRflGWqvt9EeNuRYiWcC21wyPVX58HJrZqZgd3wRYrPCoCz5EUYsqqazcxl61I_-V_-HZE_LDVYX5wsAhLrK6sdlj0aT3tV0coean8KBMoxaYfbnjUDcaNBUZ4KdSjscT0_T6yVLHyV0V6_aba_o7VVWnEFZ_5Pcbys-JIPTiTCAxUNRfv_FfZ9ZbO8QQ",
        "p": "5Q9S-_fGe5qad5AxfN7_Tc3hs2wuFaHp86o7yRtCDrah9s2x18A8zbkO-pt0EDeNxURAheCfUDc195T9vjtbn2eNZO88BHxZulI1K8G-sO1o34kLiuR9WPK7Uu0jTJyU9v1YdAQD76QqkbOQKxfIcmjQ7CC9Cwyb67BrsDlXsYs",
        "q": "0bq4E70Kie2cUWFltGTlGitPkxsivskZgOQU5WmS6JfgDHPCmnVO1L0flAU3_LYdXFSPrAvSOTl2-DwcxK_c9YZ3MLeO7RtGaoLiJwRHSamQTgEwjnfrMYAoi4JxWjHOsKsi1zva3yZnBiDEDUvn5X7zn67lnRts1o5t8Fp-ql0",
        "dp": "WzuySseSl7KpaYvWGi1btKqXBfbFmDooS7P3Ig-oTOHzOrEM76kSzsGxtKFsJfVqkzKvHGOuMK384cLHGhjcUm5VQ-mBlyvMNUj_ApGlmSTGS5pzLXv6bQ4pDEuFbsNDFeksbPEYfD9_8Q57Ep7jaKZU6GfVw-vewo4_Ji6Avic",
        "dq": "VaFM4xI-KU6QklGX-u1u9R5V4RQlPYxSE2QMfBZ82uaXnb3t6K6YvxdwuzjeQRoCJt6HwpEZBjBGONgiTtQW_VAnfgaUHo8SUw6ZU6DVkmfe-VpW_vRLXOycoUljCpZnc46MLSDNHmtJiSD7qwog5nzM75ezPFAkQf3pOUdZjCk",
        "qi": "NgGYqLUAh9Qrwmldr0ZEgMTmEuA_W3UvYQGjo-UxfX2D9akq3GFLUf3NElEeKzxjWU7rzdRq97S5wvpiykceI4dvhITVEIWT0YiQadNd8PGjBBYYHEHwJwnvgNMXLchLx1jPe9VJb_oVlF57hSTmCJr_2jX4HJfE_puvzYn5n-4"
      },
      "publicKey": {
        "kty": "RSA",
        "alg": "PS384",
        "n": "u6iUlq1JEjAlPiyGwAEjibQDOj9HECiutZ7T0s6AXXOHib1G3GPn7YCvZVIz0gk7Vbf53qCGxLJ8qbALgaCqaOcJB-9cbVohgwXefS5tIjPn2TnoI2KyaWBO1bxGLFChf_tde5KRL5dE2jpYwAPUHXljNdog9cLX8zbPucGKlGR88AwB-rHTM8gdGwwGfGstKeopZlw4TQHjujY2iIh1Ga-oiyCN5M0F2-E3bN4_JcVGGyRfjWKjpZ44fBifyNihRujc6G43Qo3lyFigRE26Y-3Jpk4nm1cpfMU-nn8t6WEl5UEXwPDJjYWxt3g9nNdh6XuBLNHi0CuBZ9P9USvNfw",
        "e": "AQAB"
      }
    },
    {
      "passkeyId": 5,
      "credentialId": "YmVybmFkZXR0ZS1jcmVkLTE",
      "userId": 6,
      "name": "Windows Hello",
      "algorithm": -8,
      "privateKey": {
        "kty": "OKP",
        "crv": "Ed25519",
        "alg": "EdDSA",
        "x": "z9y3n-lSSQNz5GOlAtFgFiepFPP93sX165FNsMsmrSY",
        "d": "DstImboPcqp2pTHWGUzSgZl2XS33r8phOSu9n_6VAC0"
      },
      "publicKey": {
        "kty": "OKP",
        "crv": "Ed25519",
        "alg": "EdDSA",
        "x": "z9y3n-lSSQNz5GOlAtFgFiepFPP93sX165FNsMsmrSY"
      }
    },
    {
      "passkeyId": 6,
      "credentialId": "YW15LWNyZWQtMQ",
      "userId": 7,
      "name": "MacBook Touch ID",
      "algorithm": -7,
      "privateKey": {
        "kty": "EC",
        "crv": "P-256",
        "alg": "ES256",
        "x": "UWwNyic8Vz5Kbbzh6wPgU0OxK558OHG0gRAj0Aq6N18",
        "y": "SKJefPMpnSRresyhlrQ4SPVppGK4OYIweNxGNh_aoqc",
        "d": "hSqyjWG4J2N99G1hBMh93t_KD3DwxhH_UbomFpQ2Ico"
      },
      "publicKey": {
        "kty": "EC",
        "crv": "P-256",
        "alg": "ES256",
        "x": "UWwNyic8Vz5Kbbzh6wPgU0OxK558OHG0gRAj0Aq6N18",
        "y": "SKJefPMpnSRresyhlrQ4SPVppGK4OYIweNxGNh_aoqc"
      }
    },
    {
      "passkeyId": 7,
      "credentialId": "YW15LWNyZWQtMg",
      "userId": 7,
      "name": "iPhone Passkey",
      "algorithm": -7,
      "privateKey": {
        "kty": "EC",
        "crv": "P-256",
        "alg": "ES256",
        "x": "F3iyua1apQimS19-fTdeITJyPfflPJKuZTpcUC5Z-Lw",
        "y": "l_ZIy-OxX_xLrFYEakfDT22cBLhhjLnuDeRy_BuMe0Y",
        "d": "SYXuCp3zsWqlMgFcjjbfTPyt38Qkd5czyQki19NB7Ls"
      },
      "publicKey": {
        "kty": "EC",
        "crv": "P-256",
        "alg": "ES256",
        "x": "F3iyua1apQimS19-fTdeITJyPfflPJKuZTpcUC5Z-Lw",
        "y": "l_ZIy-OxX_xLrFYEakfDT22cBLhhjLnuDeRy_BuMe0Y"
      }
    },
    {
      "passkeyId": 8,
      "credentialId": "YW15LWNyZWQtMw",
      "userId": 7,
      "name": "YubiKey Backup",
      "algorithm": -257,
      "privateKey": {
        "kty": "RSA",
        "alg": "RS256",
        "n": "06Z2QSNZ0Xl5cDVYdgecXSxaXB1sdpxZ5PXQ2ZcI2kkmLUn7Jy9dZT-xOG85ORC8S40eUvX4Htfpagmv4ZZl_gu7W5LCeFehfLoltL_nHtV-xtA6WZJzO7gMF3Z3DNxIzRTof6wmlt91DTKxZlVGFhx3k_r-T5H0ssj8vmc7fbD0L59eOrwVl0n5oCjaM92-JFXQevoYMTD010Ol0zjYA5LCmIVwyth4lljdWMzs_DDBd2MKUHgdUCSH5Yi5Cabf1Yy6lmLdk1cg5VLO0FGMUXdPCNsSjYK-Q1ljMJJ_S9nn-_hdvhnAaGhVpxsMHxmLz6ad1utypGTK3V65tLbkfQ",
        "e": "AQAB",
        "d": "Gquu2i18u4ddtLScNZ9m5lzY9COnD9lLAK2zSEAelvdBztI0Sm9PCxu4Ft75LIY93B1n1Vd2kVhu6vRWjAxaROWwke0QAX81c9S3PKw0ETAhHieOOsxYJg3exDQi82Vs7R7132TPphJ5mxSowzb6sn2a2fR2iIthdQgbxViX6BIiPsMUINLziS-opYpYZupz2nq7btzWfkC9kW_oEP47F53Q7CgcYoGmnKW7Ae3u1Ln74prk39407dOePTBHVptEjKSRK5OMWkP6WskuARxUI5wqCcEEFK3eDLnBZEvyd_yAH3XnEpuTWe9W8G8RCy6lyUkeIhhOf9jyckOIVSWnFw",
        "p": "7MkNCts9fJcz8GPge2JO_mMbSSXwD4rmwpq46-CKwAxRKWRvp8GnXIzBhlnbSzQveC9710s9SY_fSx7xAWtZlYW9uQXWJt4i64hbzr05ZIreFhZ8jj8LCrOz7jaZ7gS5bmlILVci4BK0wa50z07DFlxQbBZ5H1Y6Ag7e0J160K8",
        "q": "5NNB33ExLv9GKo1zwR8umWl0QBRaSwOmUDzGcdFg66iN4lxGAID74bRtlInFmzBtwvZSgDK_lX1j2KQ6_BzhZUh5USIMmYNdI1hMbDwAevovl0b-Obvgv248ckMxsHLhyvXd4S-A8b1ydFBAJSeDw42QdVJTpkx2wJXltMaD8JM",
        "dp": "wfMYtMjJ_3CWgZQ9vrLSw3oIUo05qnF6_PHhAIxm-lHcdQwojP-Jh7xflB2sC1iOfWJfjQS7CbNIEm8gt6nnshrfQVtvg1y2u7hwgtHp3doFeZAnrBglgjmZ60hcI2NJRBAGp-TU0zdfSboNQfVgxMMOuMpbofhuAVuO1M_5Vk8",
        "dq": "RDNG5d7pxtUkx5gDUSMHE4hfsp2eT89VqYKDrva1yWciar4PyySmbh4FrwjlEZz8ieg6rKTzfw2xTaedQPkmoLZaGjlowfRqNRejJ3s2tXCN8KujJ_f8Q3IKqA-o5qtG6uQe7nfnGaXaUBp_E9PULNurm5we_Gi72CiVHy0vs-s",
        "qi": "T1Q-SrHrZI2UFr6Gjh1TFrRK1wKqL6VaIhrmInbdZsgsz7k-bN4Rw7-GT_hKtCWFDUI6QMak7aRfm1yj9WbKLrZKbE3tQCcXZKOTGEtE9K_5FIpa7_1gg7jqCESpAzYJ8xOpI649Q1CpLp7hpONWWfAdLd54Da1soP8upx-fBA"
      },
      "publicKey": {
        "kty": "RSA",
        "alg": "RS256",
        "n": "06Z2QSNZ0Xl5cDVYdgecXSxaXB1sdpxZ5PXQ2ZcI2kkmLUn7Jy9dZT-xOG85ORC8S40eUvX4Htfpagmv4ZZl_gu7W5LCeFehfLoltL_nHtV-xtA6WZJzO7gMF3Z3DNxIzRTof6wmlt91DTKxZlVGFhx3k_r-T5H0ssj8vmc7fbD0L59eOrwVl0n5oCjaM92-JFXQevoYMTD010Ol0zjYA5LCmIVwyth4lljdWMzs_DDBd2MKUHgdUCSH5Yi5Cabf1Yy6lmLdk1cg5VLO0FGMUXdPCNsSjYK-Q1ljMJJ_S9nn-_hdvhnAaGhVpxsMHxmLz6ad1utypGTK3V65tLbkfQ",
        "e": "AQAB"
      }
    }
  ]
}
```

</details>

## License

MIT

---

*"Hello, I'm Dr. Sheldon Cooper, and welcome to Fun with Flags!"*
