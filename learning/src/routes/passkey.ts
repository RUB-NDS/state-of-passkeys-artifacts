import { Router, Request, Response, NextFunction } from 'express';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  VerifiedRegistrationResponse,
  VerifiedAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/types';
import { getDomain } from 'tldts';
import { getStorage } from '../services/storage';
import {
  config,
  getAlgorithmId,
  getAllAlgorithmIds,
  getAlgorithmIdsExcluding,
} from '../config';
import { Passkey, AuthenticatorTransport } from '../types/passkey';
import { FlagReward } from '../types/flag';
import { Verifier, isRegistrationVerifier } from '../types/verifier';
import { requireAuth } from '../middleware/auth';

// Helper to get the site (eTLD+1) of a hostname using the Public Suffix List
function getSite(hostname: string): string | null {
  return getDomain(hostname, { allowPrivateDomains: true });
}

const router = Router();

// Global challenge store for cross-session challenge verification (§7.1.8 / §7.2.8)
// Maps challenge -> { instanceId, timestamp, type: 'registration' | 'authentication', sessionId: string }
const globalChallengeStore = new Map<
  string,
  { instanceId: string; timestamp: number; type: string; sessionId: string }
>();
const CHALLENGE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

// Store a challenge in the global store
function storeGlobalChallenge(
  challenge: string,
  instanceId: string,
  type: 'registration' | 'authentication',
  sessionId: string
) {
  globalChallengeStore.set(challenge, { instanceId, timestamp: Date.now(), type, sessionId });
  // Clean up old challenges periodically
  for (const [key, value] of globalChallengeStore.entries()) {
    if (Date.now() - value.timestamp > CHALLENGE_EXPIRY_MS) {
      globalChallengeStore.delete(key);
    }
  }
}

// Mark a challenge as used (remove from global store and track in session for reuse detection)
// Only tracks challenges that were legitimately issued by the server
function markChallengeUsed(challenge: string, req: Request) {
  // Check if this challenge was legitimately issued (exists in session history or global store)
  const wasIssuedInSession = req.session.challengeHistory?.includes(challenge) ?? false;
  const wasIssuedGlobally = globalChallengeStore.has(challenge);

  // Remove from global store so it can't be used cross-session
  globalChallengeStore.delete(challenge);

  // Only add to used challenges if it was a legitimately issued challenge
  if (wasIssuedInSession || wasIssuedGlobally) {
    if (!req.session.usedChallenges) req.session.usedChallenges = [];
    if (!req.session.usedChallenges.includes(challenge)) {
      req.session.usedChallenges.push(challenge);
    }
  }
}

// Check if a challenge exists in the global store from a DIFFERENT session (for cross-session attack)
// This should only allow unused challenges from other sessions
function isValidCrossSessionChallenge(
  challenge: string,
  type: 'registration' | 'authentication',
  currentSessionId: string
): boolean {
  const entry = globalChallengeStore.get(challenge);
  if (!entry) return false;
  if (entry.type !== type) return false;
  if (entry.sessionId === currentSessionId) return false; // Must be from different session
  return Date.now() - entry.timestamp <= CHALLENGE_EXPIRY_MS;
}

// Helper to find authData offset in CBOR-encoded attestationObject
// The attestationObject is a CBOR map like: { fmt: "...", authData: <bytes>, attStmt: {...} }
// We search for the "authData" key followed by the byte string
function findAuthDataInAttestation(attestationObject: Uint8Array): number {
  // Search for "authData" in the CBOR (it appears as a text string key)
  // In CBOR, "authData" is encoded as: 0x68 (text string of 8 bytes) followed by "authData"
  const authDataKey = Buffer.from([0x68, ...Buffer.from('authData')]);
  for (let i = 0; i < attestationObject.length - authDataKey.length; i++) {
    let found = true;
    for (let j = 0; j < authDataKey.length; j++) {
      if (attestationObject[i + j] !== authDataKey[j]) {
        found = false;
        break;
      }
    }
    if (found) {
      // Found "authData" key, next is the byte string with the actual authData
      // The byte string length is encoded in the next byte(s)
      const afterKey = i + authDataKey.length;
      const typeByte = attestationObject[afterKey];
      if ((typeByte & 0xe0) === 0x40) {
        // Major type 2 (byte string)
        const additionalInfo = typeByte & 0x1f;
        if (additionalInfo < 24) {
          // Length is in the additional info
          return afterKey + 1;
        } else if (additionalInfo === 24) {
          // Length is in next byte
          return afterKey + 2;
        } else if (additionalInfo === 25) {
          // Length is in next 2 bytes
          return afterKey + 3;
        }
      }
    }
  }
  return -1;
}

// Helper to extract algorithm from COSE key (simplified CBOR parsing)
// COSE key is a map with key 3 being the algorithm (negative integer)
function extractAlgorithmFromCoseKey(publicKey: Uint8Array): number {
  // Search for key 3 in the CBOR map
  // In CBOR, 3 is encoded as 0x03 (unsigned integer 3)
  // The value is a negative integer, encoded as major type 1
  for (let i = 0; i < publicKey.length - 2; i++) {
    if (publicKey[i] === 0x03) {
      // Found key 3, next byte should be the algorithm (negative int)
      const nextByte = publicKey[i + 1];
      if ((nextByte & 0xe0) === 0x20) {
        // Major type 1 (negative integer)
        const value = nextByte & 0x1f;
        if (value < 24) {
          return -(value + 1);
        } else if (value === 24) {
          // Value in next byte
          return -(publicKey[i + 2] + 1);
        } else if (value === 25) {
          // Value in next 2 bytes (big-endian)
          return -(((publicKey[i + 2] << 8) | publicKey[i + 3]) + 1);
        }
      }
    }
  }
  return -7; // Default to ES256
}

// Helper to get RP ID based on verifier config
function getRpId(req: Request, verifier: Verifier): string {
  if (isRegistrationVerifier(verifier) && verifier.options.rpIdUpscope) {
    // Try to upscope to eTLD+1 (registrable domain)
    const site = getSite(req.hostname);
    if (site && site !== req.hostname) {
      return site;
    }
  }
  return config.rpId;
}

// Helper to get origin - uses configured origin from environment variable
function getOrigin(_req: Request): string {
  return config.origin;
}

// Helper to check if two origins are same-site (§7.1.9 / §7.2.9)
// Uses eTLD+1 from the Public Suffix List to determine the site
function isSameSiteOrigin(origin1: string, origin2: string): boolean {
  try {
    const url1 = new URL(origin1);
    const url2 = new URL(origin2);
    // Same scheme required for same-site
    if (url1.protocol !== url2.protocol) return false;
    // Compare eTLD+1 (registrable domain / site)
    const site1 = getSite(url1.hostname);
    const site2 = getSite(url2.hostname);
    // Both must have a valid site and they must match
    return site1 !== null && site2 !== null && site1 === site2;
  } catch {
    return false;
  }
}

// Helper to get all valid parent domains up to eTLD+1 (respects Public Suffix List)
function getParentDomainsUpToSite(hostname: string): string[] {
  const site = getSite(hostname);
  if (!site || site === hostname) return [];

  const parents: string[] = [];
  const parts = hostname.split('.');

  // Generate parent domains by removing labels from the left
  // Only include parents that have the same eTLD+1 (site) as the original hostname
  // This respects the PSL - e.g., for app.github.io, github.io is NOT a valid parent
  // because github.io is a public suffix and app.github.io IS the eTLD+1
  for (let i = 1; i < parts.length; i++) {
    const parent = parts.slice(i).join('.');
    const parentSite = getSite(parent);
    // Only include if parent has the same site as original (same-site)
    // and the parent is not shorter than the site itself
    if (parentSite === site) {
      parents.push(parent);
    }
  }

  return parents;
}

// Helper to check if rpIdHash matches same-site rpId (§7.1.14 / §7.2.14)
// Accepts any parent domain up to eTLD+1 as a valid RP ID for same-site
async function isSameSiteRpId(actualRpIdHash: Buffer, expectedRpId: string): Promise<boolean> {
  const crypto = await import('crypto');
  // Check exact match first
  const expectedHash = crypto.createHash('sha256').update(expectedRpId).digest();
  if (expectedHash.equals(actualRpIdHash)) return true;
  // Check all parent domains up to eTLD+1
  const parents = getParentDomainsUpToSite(expectedRpId);
  for (const parent of parents) {
    const parentHash = crypto.createHash('sha256').update(parent).digest();
    if (parentHash.equals(actualRpIdHash)) return true;
  }
  return false;
}

// Helper to get static flag reward based on verifier's embedded rewardFlag
function getStaticFlagReward(verifier: Verifier): FlagReward | null {
  if (!verifier.rewardFlag) return null;

  const reward = verifier.rewardFlag;
  return {
    flagId: 0, // No longer using IDs
    title: reward.title,
    country: reward.country,
    imageUrl: reward.imageUrl,
    description: reward.description,
    message: `Congratulations! You exploited "${verifier.name}" and earned a flag reward!`,
  };
}

// Helper to check if user verification is required
function isUserVerificationRequired(verifier: Verifier): boolean {
  return verifier.options.userVerification === 'required';
}

// POST /api/passkey/registration/options
router.post(
  '/registration/options',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const storage = getStorage();
      const user = await storage.getUserById(req.instanceId, req.session.user!.id);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const verifier = req.regVerifier;
      const rpId = getRpId(req, verifier);
      const verifierOpts = verifier.options;

      // Generate user ID based on verifier config
      // userIdFromUsername: use base64url of username (string)
      // otherwise: use the numeric user ID converted to string
      const userIdString = verifierOpts.userIdFromUsername
        ? Buffer.from(user.username).toString('base64url')
        : String(user.id);

      // Get user's existing passkeys for exclude list
      const userPasskeys = await storage.getPasskeysByUserId(req.instanceId, user.id);

      const options = await generateRegistrationOptions({
        rpName: config.rpName,
        rpID: rpId,
        userID: new TextEncoder().encode(userIdString),
        userName: user.username,
        userDisplayName: user.username,
        attestationType: verifierOpts.attestation,
        excludeCredentials: userPasskeys.map((passkey) => ({
          id: passkey.credentialId,
          transports: passkey.transports as AuthenticatorTransportFuture[],
        })),
        authenticatorSelection: {
          residentKey: verifierOpts.residentKey,
          userVerification: verifierOpts.userVerification,
          authenticatorAttachment: verifierOpts.authenticatorAttachment || undefined,
        },
        supportedAlgorithmIDs:
          verifierOpts.algorithm === 'all'
            ? verifierOpts.excludeAlgorithms?.length
              ? getAlgorithmIdsExcluding(verifierOpts.excludeAlgorithms)
              : getAllAlgorithmIds()
            : [getAlgorithmId(verifierOpts.algorithm)],
        timeout: 600000, // 10 minutes
      });

      // Store challenge in session
      req.session.challenge = options.challenge;
      // Store the actual user ID (number) for lookup purposes
      req.session.passkeyUserId = user.id;
      // Store in global challenge store for cross-session verification (§7.1.8)
      storeGlobalChallenge(options.challenge, req.instanceId, 'registration', req.sessionID);
      // Keep challenge history for reuse detection (§7.1.8)
      if (!req.session.challengeHistory) req.session.challengeHistory = [];
      req.session.challengeHistory.push(options.challenge);

      res.json({
        options,
        verifier: {
          id: verifier.id,
          name: verifier.name,
          algorithm: verifierOpts.algorithm,
          rpId,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/passkey/registration/verify
router.post(
  '/registration/verify',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { credential, name } = req.body as {
        credential: RegistrationResponseJSON;
        name?: string;
      };

      if (!credential) {
        return res.status(400).json({ error: 'Credential is required' });
      }

      const storage = getStorage();
      const user = await storage.getUserById(req.instanceId, req.session.user!.id);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const expectedChallenge = req.session.challenge;
      if (!expectedChallenge) {
        return res.status(400).json({ error: 'No registration challenge found' });
      }

      const verifier = req.regVerifier;
      const rpId = getRpId(req, verifier);
      const origin = getOrigin(req);
      const checks = verifier.checks;

      let verification: VerifiedRegistrationResponse;
      let exploitDetected = false;

      // Parse clientDataJSON outside try block so it's available in catch for exploit detection
      const clientDataJSON = Buffer.from(credential.response.clientDataJSON, 'base64url');
      const clientData = JSON.parse(clientDataJSON.toString('utf-8')) as {
        challenge: string;
        origin: string;
        type: string;
        crossOrigin?: boolean;
        topOrigin?: string;
      };

      try {
        // ══════════════════════════════════════════════════════════════════════
        // §7.1.7: Verify clientData.type is "webauthn.create"
        // ══════════════════════════════════════════════════════════════════════
        // skipTypeVerification: accept any type; allowSwappedType: only accept "webauthn.get"
        if (checks.skipTypeVerification && clientData.type !== 'webauthn.create') {
          exploitDetected = true;
        } else if (checks.allowSwappedType && clientData.type === 'webauthn.get') {
          // Only allow the legitimate swapped type, not arbitrary values
          exploitDetected = true;
        }

        // ══════════════════════════════════════════════════════════════════════
        // §7.1.8: Verify clientData.challenge equals options.challenge
        // ══════════════════════════════════════════════════════════════════════
        // skipChallengeVerification: accept any challenge
        // allowReusedChallenge: accept previously USED challenges from this session (already verified once)
        // allowAnyChallengeFromAnySession: accept UNUSED challenges from OTHER sessions
        let challengeToExpect: string | ((challenge: string) => boolean) = expectedChallenge;
        if (checks.skipChallengeVerification) {
          if (clientData.challenge !== expectedChallenge) {
            exploitDetected = true;
          }
          challengeToExpect = () => true;
        } else if (checks.allowReusedChallenge) {
          // Reuse: accept challenges that were already successfully verified in THIS session
          const usedChallenges = req.session.usedChallenges || [];
          if (
            clientData.challenge !== expectedChallenge &&
            usedChallenges.includes(clientData.challenge)
          ) {
            exploitDetected = true;
            challengeToExpect = clientData.challenge;
          }
        } else if (checks.allowAnyChallengeFromAnySession) {
          // Cross-session: accept unused challenges from OTHER sessions only
          if (
            clientData.challenge !== expectedChallenge &&
            isValidCrossSessionChallenge(clientData.challenge, 'registration', req.sessionID)
          ) {
            exploitDetected = true;
            challengeToExpect = clientData.challenge;
          }
        }

        // ══════════════════════════════════════════════════════════════════════
        // §7.1.9: Verify clientData.origin is valid for this RP
        // ══════════════════════════════════════════════════════════════════════
        // skipOriginVerification: accept any origin; allowSameSiteOrigin: accept same-site origins
        let originToExpect = origin;
        if (checks.skipOriginVerification) {
          originToExpect = clientData.origin;
          if (clientData.origin !== origin) {
            exploitDetected = true;
          }
        } else if (checks.allowSameSiteOrigin) {
          if (clientData.origin !== origin && isSameSiteOrigin(clientData.origin, origin)) {
            originToExpect = clientData.origin;
            exploitDetected = true;
          }
        }

        // ══════════════════════════════════════════════════════════════════════
        // §7.1.10-11: Verify clientData.crossOrigin and topOrigin
        // ══════════════════════════════════════════════════════════════════════
        // Default: crossOrigin must be false/absent, topOrigin must be absent (no framing)
        // skipCrossOriginCheck: accept framed requests where topOrigin is cross-origin
        const isCrossOriginRequest = clientData.crossOrigin === true;
        const hasTopOrigin = clientData.topOrigin !== undefined;
        const isTopOriginCrossOrigin = hasTopOrigin && !isSameSiteOrigin(clientData.topOrigin!, origin);

        if (isCrossOriginRequest || hasTopOrigin) {
          if (checks.skipCrossOriginCheck) {
            // Exploit: must have crossOrigin=true AND topOrigin that is cross-origin
            if (isCrossOriginRequest && hasTopOrigin && isTopOriginCrossOrigin) {
              exploitDetected = true;
            }
          } else {
            // Secure mode: reject any cross-origin or framed request
            return res.status(400).json({
              error: 'Cross-origin or framed requests are not allowed',
              verified: false,
            });
          }
        }

        // ══════════════════════════════════════════════════════════════════════
        // §7.1.20: Algorithm verification
        // ══════════════════════════════════════════════════════════════════════
        // Calculate the requested algorithms (accounting for excludeAlgorithms)
        const requestedAlgorithms =
          verifier.options.algorithm === 'all'
            ? verifier.options.excludeAlgorithms?.length
              ? getAlgorithmIdsExcluding(verifier.options.excludeAlgorithms)
              : getAllAlgorithmIds()
            : [getAlgorithmId(verifier.options.algorithm)];

        // skipAlgorithmVerification: accept any algorithm (pass undefined to library)
        const supportedAlgorithms = checks.skipAlgorithmVerification ? undefined : requestedAlgorithms;

        // ══════════════════════════════════════════════════════════════════════
        // §7.1.14, §7.1.15, §7.1.16: RP ID, UP, UV Verification (via library)
        // ══════════════════════════════════════════════════════════════════════
        verification = await verifyRegistrationResponse({
          response: credential,
          expectedChallenge: challengeToExpect,
          expectedOrigin: originToExpect,
          // §7.1.14: RP ID verification (skip library check if we do our own same-site check)
          expectedRPID: checks.skipRpIdVerification || checks.allowSameSiteRpId ? undefined : rpId,
          // §7.1.16: UV flag verification
          requireUserVerification:
            !checks.skipUserVerifiedCheck && isUserVerificationRequired(verifier),
          // §7.1.15: UP flag verification
          requireUserPresence: !checks.skipUserPresentCheck,
          // §7.1.20: Algorithm verification
          supportedAlgorithmIDs: supportedAlgorithms,
        });

        // ══════════════════════════════════════════════════════════════════════
        // §7.1.14: Detect RP ID bypass
        // ══════════════════════════════════════════════════════════════════════
        if (verification.registrationInfo) {
          const crypto = await import('crypto');
          const expectedRpIdHash = crypto.createHash('sha256').update(rpId).digest();
          const attestationObject = verification.registrationInfo.attestationObject;
          const authDataIndex = findAuthDataInAttestation(attestationObject);
          if (authDataIndex !== -1) {
            const actualRpIdHash = Buffer.from(
              attestationObject.subarray(authDataIndex, authDataIndex + 32)
            );
            if (!expectedRpIdHash.equals(actualRpIdHash)) {
              if (checks.skipRpIdVerification) {
                exploitDetected = true;
              } else if (checks.allowSameSiteRpId) {
                // Check if RP ID is same-site (eTLD+1)
                if (await isSameSiteRpId(actualRpIdHash, rpId)) {
                  exploitDetected = true;
                } else {
                  // Not same-site, reject
                  return res.status(400).json({
                    error: 'Unexpected RP ID hash',
                    verified: false,
                  });
                }
              }
            }
          }
        }

        // ══════════════════════════════════════════════════════════════════════
        // §7.1.15: Detect UP flag bypass
        // ══════════════════════════════════════════════════════════════════════
        if (checks.skipUserPresentCheck && verification.registrationInfo) {
          const attestationObject = verification.registrationInfo.attestationObject;
          const authDataIndex = findAuthDataInAttestation(attestationObject);
          if (authDataIndex !== -1) {
            const flags = attestationObject[authDataIndex + 32];
            const userPresent = (flags & 0x01) !== 0;
            if (!userPresent) {
              exploitDetected = true;
            }
          }
        }

        // ══════════════════════════════════════════════════════════════════════
        // §7.1.16: Detect UV flag bypass
        // ══════════════════════════════════════════════════════════════════════
        if (
          verification.registrationInfo &&
          checks.skipUserVerifiedCheck &&
          isUserVerificationRequired(verifier) &&
          !verification.registrationInfo.userVerified
        ) {
          exploitDetected = true;
        }

        // ══════════════════════════════════════════════════════════════════════
        // §7.1.17: Verify BE/BS backup flags consistency (if BE=0, BS must be 0)
        // ══════════════════════════════════════════════════════════════════════
        if (verification.registrationInfo) {
          const attestationObject = verification.registrationInfo.attestationObject;
          const authDataIndex = findAuthDataInAttestation(attestationObject);
          if (authDataIndex !== -1) {
            const flags = attestationObject[authDataIndex + 32];
            const backupEligible = (flags & 0x08) !== 0;
            const backupState = (flags & 0x10) !== 0;
            if (!backupEligible && backupState) {
              if (checks.skipBackupFlagsCheck) {
                exploitDetected = true;
              } else {
                return res.status(400).json({
                  error: 'Invalid backup flags: BS cannot be set if BE is not set',
                  verified: false,
                });
              }
            }
          }
        }

        // ══════════════════════════════════════════════════════════════════════
        // §7.1.25: Verify credential ID length (must be ≤1023 bytes)
        // ══════════════════════════════════════════════════════════════════════
        const credentialIdLength = Buffer.from(credential.id, 'base64url').length;
        if (credentialIdLength > 1023) {
          if (checks.skipCredentialIdLengthCheck) {
            exploitDetected = true;
          } else {
            return res.status(400).json({
              error: 'Credential ID exceeds maximum length of 1023 bytes',
              verified: false,
            });
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Verification failed';

        // Check if this is an exploitable error based on verifier's skip flags
        const isTypeError =
          errorMessage.toLowerCase().includes('type') ||
          errorMessage.toLowerCase().includes('webauthn.get') ||
          errorMessage.toLowerCase().includes('webauthn.create');

        const isRpIdError =
          errorMessage.toLowerCase().includes('rp') ||
          errorMessage.toLowerCase().includes('relying party') ||
          errorMessage.toLowerCase().includes('rpid');

        // Backup flags error (BE=0 but BS=1) - from library
        const isBackupFlagsError =
          errorMessage.toLowerCase().includes('backed up') ||
          (errorMessage.toLowerCase().includes('backup') &&
            errorMessage.toLowerCase().includes('impossible'));

        // For allowSwappedType, only accept the legitimate swapped type (webauthn.get), not nonsense
        const isValidTypeSwap = checks.allowSwappedType && clientData.type === 'webauthn.get';

        // Determine if this error represents a successful exploit
        const isExploit =
          ((checks.skipTypeVerification || isValidTypeSwap) && isTypeError) ||
          (checks.skipRpIdVerification && isRpIdError) ||
          (checks.skipBackupFlagsCheck && isBackupFlagsError);

        if (isExploit) {
          // Exploit detected! Try to extract credential data and register the passkey
          try {
            const attestationObject = Buffer.from(
              credential.response.attestationObject,
              'base64url'
            );
            const authDataIndex = findAuthDataInAttestation(attestationObject);

            if (authDataIndex !== -1) {
              // Parse authData
              const authData = attestationObject.subarray(authDataIndex);
              const flags = authData[32];
              const signCount = authData.readUInt32BE(33);

              // Check if attested credential data is present (AT flag, bit 6)
              if ((flags & 0x40) !== 0) {
                // Extract AAGUID (bytes 37-52, 16 bytes)
                const aaguidBytes = authData.subarray(37, 53);
                const aaguid = [
                  aaguidBytes.subarray(0, 4).toString('hex'),
                  aaguidBytes.subarray(4, 6).toString('hex'),
                  aaguidBytes.subarray(6, 8).toString('hex'),
                  aaguidBytes.subarray(8, 10).toString('hex'),
                  aaguidBytes.subarray(10, 16).toString('hex'),
                ].join('-');

                // Skip rpIdHash (32) + flags (1) + counter (4) + aaguid (16) = 53
                const credIdLength = authData.readUInt16BE(53);
                const publicKeyStart = 55 + credIdLength;

                // Find end of public key (CBOR map) - use rest of authData
                const publicKey = authData.subarray(publicKeyStart);

                // Extract algorithm from COSE key
                const algorithm = extractAlgorithmFromCoseKey(publicKey);

                // Extract flags
                const backupEligible = (flags & 0x08) !== 0;
                const backupState = (flags & 0x10) !== 0;
                const uvInitialized = (flags & 0x04) !== 0;

                // Get existing passkeys for naming
                const existingPasskeys = await storage.getPasskeysByUserId(req.instanceId, user.id);

                // Create passkey record
                const nextPasskeyId = await storage.getNextPasskeyId(req.instanceId);
                const passkey: Passkey = {
                  id: nextPasskeyId,
                  userId: user.id,
                  credentialId: credential.id,
                  publicKey: publicKey.toString('base64url'),
                  signCount,
                  algorithm,
                  transports: credential.response.transports as AuthenticatorTransport[],
                  aaguid,
                  backupEligible,
                  backupState,
                  uvInitialized,
                  createdAt: new Date().toISOString(),
                  name: name || `Passkey ${existingPasskeys.length + 1}`,
                };

                await storage.createPasskey(req.instanceId, passkey);

                // Mark challenge as used and clear
                markChallengeUsed(clientData.challenge, req);
                delete req.session.challenge;
                delete req.session.passkeyUserId;

                const reward = getStaticFlagReward(verifier);
                return res.json({
                  verified: true,
                  passkey: {
                    id: passkey.id,
                    name: passkey.name || 'Passkey',
                  },
                  reward,
                });
              }
            }
          } catch (parseError) {
            console.error('Failed to parse attestation for exploit:', parseError);
          }

          // Fallback: grant reward without registering passkey
          const reward = getStaticFlagReward(verifier);
          return res.status(400).json({
            error: 'Exploit detected but could not register passkey',
            verified: false,
            reward,
          });
        }

        return res.status(400).json({ error: errorMessage, verified: false });
      }

      if (!verification.verified || !verification.registrationInfo) {
        return res.status(400).json({ error: 'Verification failed', verified: false });
      }

      const {
        credential: registrationCredential,
        credentialDeviceType,
        credentialBackedUp,
        aaguid,
        userVerified,
      } = verification.registrationInfo;

      // ════════════════════════════════════════════════════════════════════════
      // §7.1.26: Verify credential ID is not already registered
      // ════════════════════════════════════════════════════════════════════════
      // allowDuplicateCredentialId: add duplicate (causes database error on login)
      // allowCredentialOverwrite: overwrite existing public key (account takeover)
      // allowCrossAccountCredential: register under wrong account (login confusion)
      const existingCredential = await storage.getPasskeyByCredentialId(
        req.instanceId,
        registrationCredential.id
      );
      if (existingCredential) {
        if (checks.allowDuplicateCredentialId) {
          // Exploit: Add duplicate credential (will cause lookup issues on login)
          exploitDetected = true;
          // Continue to create duplicate credential
        } else if (checks.allowCredentialOverwrite) {
          // Exploit: Overwrite existing credential's public key (account takeover)
          exploitDetected = true;
          existingCredential.passkey.publicKey = Buffer.from(
            registrationCredential.publicKey
          ).toString('base64url');
          existingCredential.passkey.signCount = registrationCredential.counter;
          await storage.updatePasskey(req.instanceId, existingCredential.passkey);

          // Mark challenge as used and clear
          markChallengeUsed(clientData.challenge, req);
          delete req.session.challenge;
          delete req.session.passkeyUserId;

          const reward = getStaticFlagReward(verifier);
          return res.json({
            verified: true,
            passkey: {
              id: existingCredential.passkey.id,
              name: existingCredential.passkey.name || 'Passkey',
            },
            reward,
          });
        } else if (checks.allowCrossAccountCredential) {
          // Exploit: Register victim's credential under attacker's account
          // The victim will be logged into attacker's account when using this credential
          exploitDetected = true;
          // Continue to create credential under current user
        } else {
          // Secure mode: reject duplicate credential ID
          return res.status(400).json({
            error: 'Credential ID already registered',
            verified: false,
          });
        }
      }

      // ════════════════════════════════════════════════════════════════════════
      // Post-verification: Create passkey record
      // ════════════════════════════════════════════════════════════════════════
      const existingPasskeys = await storage.getPasskeysByUserId(req.instanceId, user.id);

      // Determine the actual algorithm used (always extract from COSE key)
      const actualAlgorithm = extractAlgorithmFromCoseKey(registrationCredential.publicKey);

      // ════════════════════════════════════════════════════════════════════════
      // §7.1.20: Detect algorithm bypass exploit
      // ════════════════════════════════════════════════════════════════════════
      if (checks.skipAlgorithmVerification) {
        // Calculate what algorithms were requested
        const requestedAlgos =
          verifier.options.algorithm === 'all'
            ? verifier.options.excludeAlgorithms?.length
              ? getAlgorithmIdsExcluding(verifier.options.excludeAlgorithms)
              : getAllAlgorithmIds()
            : [getAlgorithmId(verifier.options.algorithm)];
        // If actual algorithm is not in requested list, exploit detected
        if (!requestedAlgos.includes(actualAlgorithm)) {
          exploitDetected = true;
        }
      }

      // Create passkey record
      const nextPasskeyId = await storage.getNextPasskeyId(req.instanceId);
      const passkey: Passkey = {
        id: nextPasskeyId,
        userId: user.id,
        credentialId: registrationCredential.id,
        publicKey: Buffer.from(registrationCredential.publicKey).toString('base64url'),
        signCount: registrationCredential.counter,
        algorithm: actualAlgorithm,
        transports: credential.response.transports as AuthenticatorTransport[],
        aaguid,
        backupEligible: credentialDeviceType === 'multiDevice',
        backupState: credentialBackedUp,
        uvInitialized: userVerified,
        createdAt: new Date().toISOString(),
        name: name || `Passkey ${existingPasskeys.length + 1}`,
      };

      await storage.createPasskey(req.instanceId, passkey);

      // Mark challenge as used and clear
      markChallengeUsed(clientData.challenge, req);
      delete req.session.challenge;
      delete req.session.passkeyUserId;

      // Build response
      const response: {
        verified: boolean;
        passkey: { id: number; name: string };
        reward?: FlagReward;
      } = {
        verified: true,
        passkey: {
          id: passkey.id,
          name: passkey.name || 'Passkey',
        },
      };

      // Include flag reward if exploit was detected
      if (exploitDetected && verifier.rewardFlag) {
        const reward = getStaticFlagReward(verifier);
        if (reward) {
          response.reward = reward;
        }
      }

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/passkey/authentication/options
router.post('/authentication/options', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username } = req.body as { username?: string };
    const storage = getStorage();
    const verifier = req.authVerifier;
    const rpId = getRpId(req, verifier);
    const verifierOpts = verifier.options;

    let allowCredentials: { id: string; transports?: AuthenticatorTransportFuture[] }[] = [];
    let userId: number | undefined;

    // For non-discoverable flow, we need the username
    if (verifierOpts.passkeyFlow === 'non-discoverable') {
      if (!username) {
        return res.status(400).json({ error: 'Username is required for this flow' });
      }

      const user = await storage.getUserByUsername(req.instanceId, username);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const userPasskeys = await storage.getPasskeysByUserId(req.instanceId, user.id);
      if (userPasskeys.length === 0) {
        return res.status(400).json({ error: 'User has no passkeys registered' });
      }

      allowCredentials = userPasskeys.map((passkey) => ({
        id: passkey.credentialId,
        transports: passkey.transports as AuthenticatorTransportFuture[],
      }));
      userId = user.id;
    }

    // For 2FA flow, get user from session
    if (verifierOpts.passkeyFlow === '2fa' && req.session.passkeyUserId) {
      const user = await storage.getUserById(req.instanceId, req.session.passkeyUserId);
      if (user) {
        const userPasskeys = await storage.getPasskeysByUserId(req.instanceId, user.id);
        if (userPasskeys.length > 0) {
          allowCredentials = userPasskeys.map((passkey) => ({
            id: passkey.credentialId,
            transports: passkey.transports as AuthenticatorTransportFuture[],
          }));
          userId = user.id;
        }
      }
    }

    const options = await generateAuthenticationOptions({
      rpID: rpId,
      userVerification: verifierOpts.userVerification,
      allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
      timeout: 600000, // 10 minutes
    });

    // Store challenge in session
    req.session.challenge = options.challenge;
    if (userId) {
      req.session.passkeyUserId = userId;
    }
    // Store in global challenge store for cross-session verification (§7.2.8)
    storeGlobalChallenge(options.challenge, req.instanceId, 'authentication', req.sessionID);
    // Keep challenge history for reuse detection (§7.2.8)
    if (!req.session.challengeHistory) req.session.challengeHistory = [];
    req.session.challengeHistory.push(options.challenge);

    res.json({
      options,
      verifier: {
        id: verifier.id,
        name: verifier.name,
        passkeyFlow: verifierOpts.passkeyFlow,
        conditionalUI: verifierOpts.conditionalUI,
        userVerification: verifierOpts.userVerification,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/passkey/authentication/verify
router.post('/authentication/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { credential } = req.body as { credential: AuthenticationResponseJSON };

    if (!credential) {
      return res.status(400).json({ error: 'Credential is required' });
    }

    const storage = getStorage();
    const expectedChallenge = req.session.challenge;
    const preIdentifiedUserId = req.session.passkeyUserId; // For non-discoverable flow

    if (!expectedChallenge) {
      return res.status(400).json({ error: 'No authentication challenge found' });
    }

    // Find the passkey by credential ID
    const result = await storage.getPasskeyByCredentialId(req.instanceId, credential.id);

    if (!result) {
      // Signal unknown credential
      try {
        console.log(`Unknown credential attempted: ${credential.id}`);
      } catch {
        // Ignore errors from signaling
      }
      return res.status(404).json({ error: 'Passkey not found' });
    }

    const { user, passkey } = result;
    const verifier = req.authVerifier;
    const rpId = getRpId(req, verifier);
    const origin = getOrigin(req);
    const checks = verifier.checks;
    const verifierOpts = verifier.options;

    let verification: VerifiedAuthenticationResponse;
    let exploitDetected = false;
    let accountTakeoverUser: { id: number; username: string } | null = null; // For severe account takeover vulnerabilities

    // Parse clientDataJSON outside try block so it's available in catch for exploit detection
    const clientDataJSON = Buffer.from(credential.response.clientDataJSON, 'base64url');
    const clientData = JSON.parse(clientDataJSON.toString('utf-8')) as {
      challenge: string;
      origin: string;
      type: string;
      crossOrigin?: boolean;
      topOrigin?: string;
    };

    // Parse authenticatorData for flag checks
    const authenticatorData = Buffer.from(credential.response.authenticatorData, 'base64url');
    const flags = authenticatorData.length >= 33 ? authenticatorData[32] : 0;
    const userPresent = (flags & 0x01) !== 0;
    const userVerified = (flags & 0x04) !== 0;
    const backupEligible = (flags & 0x08) !== 0;
    const backupState = (flags & 0x10) !== 0;

    // Parse userHandle from response (base64url encoded user ID)
    const userHandle = credential.response.userHandle
      ? Buffer.from(credential.response.userHandle, 'base64url').toString('utf-8')
      : null;

    try {
      // ══════════════════════════════════════════════════════════════════════
      // §7.2.5-6: Credential Binding Verification (Non-Discoverable Flow)
      // ══════════════════════════════════════════════════════════════════════
      // In non-discoverable flow: verify credential.id is in allowCredentials
      // and verify userHandle (if present) matches the pre-identified user
      if (verifierOpts.passkeyFlow === 'non-discoverable' && preIdentifiedUserId) {
        // §7.2.5: If allowCredentials was populated, verify credential.id is in the list
        // The server populated allowCredentials with the pre-identified user's credentials
        // If attacker uses their own credential, it shouldn't match
        if (passkey.userId !== preIdentifiedUserId) {
          if (checks.skipCredentialBindingCheck) {
            // Exploit: attacker used their credential to bypass pre-identification
            exploitDetected = true;

            // Severe variant: login as pre-identified user instead of credential owner
            if (checks.loginAsPreIdentifiedUser) {
              const preIdentifiedUser = await storage.getUserById(req.instanceId, preIdentifiedUserId);
              if (preIdentifiedUser) {
                accountTakeoverUser = { id: preIdentifiedUser.id, username: preIdentifiedUser.username };
              }
            }
          } else {
            return res.status(400).json({
              error: 'Credential does not belong to the identified user',
              verified: false,
            });
          }
        }

        // §7.2.6: If userHandle is present, verify it matches the pre-identified user
        if (userHandle) {
          const expectedUserHandle = preIdentifiedUserId.toString();
          if (userHandle !== expectedUserHandle) {
            if (checks.skipCredentialBindingCheck) {
              // Exploit: userHandle doesn't match pre-identified user
              exploitDetected = true;
            } else {
              return res.status(400).json({
                error: 'User handle does not match identified user',
                verified: false,
              });
            }
          }
        }
      }

      // ══════════════════════════════════════════════════════════════════════
      // §7.2.6: User Handle Verification (Discoverable Flow)
      // ══════════════════════════════════════════════════════════════════════
      // In discoverable flow: verify userHandle is present and matches credential owner
      // The userHandle contains the user.id that the authenticator stored during registration
      if (verifierOpts.passkeyFlow === 'discoverable') {
        const expectedUserHandle = user.id.toString();

        // userHandle must be present in discoverable flow
        if (!userHandle) {
          if (checks.skipUserHandleCheck) {
            exploitDetected = true;
          } else {
            return res.status(400).json({
              error: 'User handle is required in discoverable flow',
              verified: false,
            });
          }
        } else if (userHandle !== expectedUserHandle) {
          // userHandle must match the credential owner
          if (checks.skipUserHandleCheck) {
            // Exploit: userHandle doesn't match credential owner
            // The credential ID was used to lookup the credential, ignoring userHandle
            exploitDetected = true;

            // Severe variant: login as userHandle user instead of credential owner
            if (checks.loginAsUserHandle) {
              const userHandleUserId = parseInt(userHandle, 10);
              if (!isNaN(userHandleUserId)) {
                const userHandleUser = await storage.getUserById(req.instanceId, userHandleUserId);
                if (userHandleUser) {
                  accountTakeoverUser = { id: userHandleUser.id, username: userHandleUser.username };
                }
              }
            }
          } else {
            return res.status(400).json({
              error: 'User handle does not match credential owner',
              verified: false,
            });
          }
        }
      }

      // ══════════════════════════════════════════════════════════════════════
      // §7.2.10: Verify clientData.type is "webauthn.get"
      // ══════════════════════════════════════════════════════════════════════
      // skipTypeVerification: accept any type; allowSwappedType: only accept "webauthn.create"
      if (checks.skipTypeVerification && clientData.type !== 'webauthn.get') {
        exploitDetected = true;
      } else if (checks.allowSwappedType && clientData.type === 'webauthn.create') {
        // Only allow the legitimate swapped type, not arbitrary values
        exploitDetected = true;
      }

      // ══════════════════════════════════════════════════════════════════════
      // §7.2.11: Verify clientData.challenge equals options.challenge
      // ══════════════════════════════════════════════════════════════════════
      // skipChallengeVerification: accept any challenge
      // allowReusedChallenge: accept previously USED challenges from this session (already verified once)
      // allowAnyChallengeFromAnySession: accept UNUSED challenges from OTHER sessions
      let challengeToExpect: string | ((challenge: string) => boolean) = expectedChallenge;
      if (checks.skipChallengeVerification) {
        if (clientData.challenge !== expectedChallenge) {
          exploitDetected = true;
        }
        challengeToExpect = () => true;
      } else if (checks.allowReusedChallenge) {
        // Reuse: accept challenges that were already successfully verified in THIS session
        const usedChallenges = req.session.usedChallenges || [];
        if (clientData.challenge !== expectedChallenge && usedChallenges.includes(clientData.challenge)) {
          exploitDetected = true;
          challengeToExpect = clientData.challenge;
        }
      } else if (checks.allowAnyChallengeFromAnySession) {
        // Cross-session: accept unused challenges from OTHER sessions only
        if (
          clientData.challenge !== expectedChallenge &&
          isValidCrossSessionChallenge(clientData.challenge, 'authentication', req.sessionID)
        ) {
          exploitDetected = true;
          challengeToExpect = clientData.challenge;
        }
      }

      // ══════════════════════════════════════════════════════════════════════
      // §7.2.12: Verify clientData.origin is valid for this RP
      // ══════════════════════════════════════════════════════════════════════
      // skipOriginVerification: accept any origin; allowSameSiteOrigin: accept same-site origins
      let originToExpect = origin;
      if (checks.skipOriginVerification) {
        originToExpect = clientData.origin;
        if (clientData.origin !== origin) {
          exploitDetected = true;
        }
      } else if (checks.allowSameSiteOrigin) {
        if (clientData.origin !== origin && isSameSiteOrigin(clientData.origin, origin)) {
          originToExpect = clientData.origin;
          exploitDetected = true;
        }
      }

      // ══════════════════════════════════════════════════════════════════════
      // §7.2.13-14: Verify clientData.crossOrigin and topOrigin
      // ══════════════════════════════════════════════════════════════════════
      // Default: crossOrigin must be false/absent, topOrigin must be absent (no framing)
      // skipCrossOriginCheck: accept framed requests where topOrigin is cross-origin
      const isCrossOriginRequest = clientData.crossOrigin === true;
      const hasTopOrigin = clientData.topOrigin !== undefined;
      const isTopOriginCrossOrigin = hasTopOrigin && !isSameSiteOrigin(clientData.topOrigin!, origin);

      if (isCrossOriginRequest || hasTopOrigin) {
        if (checks.skipCrossOriginCheck) {
          // Exploit: must have crossOrigin=true AND topOrigin that is cross-origin
          if (isCrossOriginRequest && hasTopOrigin && isTopOriginCrossOrigin) {
            exploitDetected = true;
          }
        } else {
          // Secure mode: reject any cross-origin or framed request
          return res.status(400).json({
            error: 'Cross-origin or framed requests are not allowed',
            verified: false,
          });
        }
      }

      // Prepare the credential for verification
      const credentialPublicKey = Buffer.from(passkey.publicKey, 'base64url');

      // ══════════════════════════════════════════════════════════════════════
      // §7.2.15, §7.2.21: RP ID and Signature Verification (via library)
      // ══════════════════════════════════════════════════════════════════════
      // Build expected RP ID(s) based on verifier config
      let expectedRPIDs: string | string[] = rpId;
      if (checks.allowSameSiteRpId) {
        // Accept exact RP ID and all parent domains up to eTLD+1
        const parents = getParentDomainsUpToSite(rpId);
        expectedRPIDs = parents.length > 0 ? [rpId, ...parents] : rpId;
      }

      verification = await verifyAuthenticationResponse({
        response: credential,
        expectedChallenge: challengeToExpect,
        expectedOrigin: originToExpect,
        // §7.2.15: RP ID verification
        expectedRPID: expectedRPIDs,
        credential: {
          id: passkey.credentialId,
          publicKey: credentialPublicKey,
          counter: passkey.signCount,
        },
        // §7.2.17: UV flag verification
        requireUserVerification:
          !checks.skipUserVerifiedCheck && isUserVerificationRequired(verifier),
        // §7.2.16: UP flag - use advancedFIDOConfig to bypass library's UP check when testing
        // The library throws 'User not present' by default; this allows us to detect the exploit after
        ...(checks.skipUserPresentCheck && { advancedFIDOConfig: { userVerification: 'discouraged' } }),
      });

      // ══════════════════════════════════════════════════════════════════════
      // §7.2.15: Detect RP ID bypass
      // ══════════════════════════════════════════════════════════════════════
      if (verification.authenticationInfo) {
        const crypto = await import('crypto');
        const expectedRpIdHash = crypto.createHash('sha256').update(rpId).digest();
        if (authenticatorData.length >= 32) {
          const actualRpIdHash = authenticatorData.subarray(0, 32);
          if (!expectedRpIdHash.equals(actualRpIdHash)) {
            // RP ID doesn't match exactly - check if it's an allowed bypass
            if (checks.skipRpIdVerification) {
              exploitDetected = true;
            } else if (checks.allowSameSiteRpId) {
              // eTLD+1 was used instead of exact RP ID - this is the exploit
              exploitDetected = true;
            }
          }
        }
      }

      // ══════════════════════════════════════════════════════════════════════
      // §7.2.16: Verify UP flag is set
      // ══════════════════════════════════════════════════════════════════════
      if (checks.skipUserPresentCheck && !userPresent) {
        exploitDetected = true;
      }

      // ══════════════════════════════════════════════════════════════════════
      // §7.2.17: Verify UV flag if user verification was required
      // ══════════════════════════════════════════════════════════════════════
      if (
        verification.authenticationInfo &&
        checks.skipUserVerifiedCheck &&
        isUserVerificationRequired(verifier) &&
        !userVerified
      ) {
        exploitDetected = true;
      }

      // ══════════════════════════════════════════════════════════════════════
      // §7.2.18: Verify BE/BS flag consistency (if BE=0, BS must be 0)
      // ══════════════════════════════════════════════════════════════════════
      if (!backupEligible && backupState) {
        if (checks.skipBackupFlagsCheck) {
          exploitDetected = true;
        } else {
          return res.status(400).json({
            error: 'Invalid backup flags: BS cannot be set if BE is not set',
            verified: false,
          });
        }
      }

      // ══════════════════════════════════════════════════════════════════════
      // §7.2.19: Verify BE flag consistency with stored backupEligible
      // ══════════════════════════════════════════════════════════════════════
      // If stored backupEligible differs from current BE, this is suspicious
      if (passkey.backupEligible !== backupEligible) {
        if (checks.skipBackupEligibilityCheck) {
          exploitDetected = true;
        } else {
          return res.status(400).json({
            error: 'Backup eligibility changed unexpectedly',
            verified: false,
          });
        }
      }

      // ══════════════════════════════════════════════════════════════════════
      // §7.2.22: Verify signature counter
      // ══════════════════════════════════════════════════════════════════════
      if (checks.skipSignatureCounterCheck && verification.authenticationInfo) {
        const newCounter = verification.authenticationInfo.newCounter;
        if (newCounter <= passkey.signCount && passkey.signCount !== 0) {
          exploitDetected = true;
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Verification failed';

      // Check if this is an exploitable error based on verifier's skip flags
      const isTypeError =
        errorMessage.toLowerCase().includes('type') ||
        errorMessage.toLowerCase().includes('webauthn.get') ||
        errorMessage.toLowerCase().includes('webauthn.create');

      const isRpIdError =
        errorMessage.toLowerCase().includes('rp') ||
        errorMessage.toLowerCase().includes('relying party') ||
        errorMessage.toLowerCase().includes('rpid');

      const isSignatureError =
        errorMessage.toLowerCase().includes('signature') ||
        errorMessage.toLowerCase().includes('invalid');

      // Backup flags error (BE=0 but BS=1) - from library
      const isBackupFlagsError =
        errorMessage.toLowerCase().includes('backed up') ||
        (errorMessage.toLowerCase().includes('backup') &&
          errorMessage.toLowerCase().includes('impossible'));

      // Counter error - "Response counter value X was lower than expected Y"
      const isCounterError =
        errorMessage.toLowerCase().includes('counter') &&
        errorMessage.toLowerCase().includes('lower');

      // For allowSwappedType, only accept the legitimate swapped type (webauthn.create), not nonsense
      const isValidTypeSwap = checks.allowSwappedType && clientData.type === 'webauthn.create';

      // Determine if this error represents a successful exploit
      const isExploit =
        ((checks.skipTypeVerification || isValidTypeSwap) && isTypeError) ||
        (checks.skipRpIdVerification && isRpIdError) ||
        (checks.skipSignatureVerification && isSignatureError) ||
        // Backup flags error can occur when testing either impossible state (skipBackupFlagsCheck)
        // or BE consistency (skipBackupEligibilityCheck) if user sets BE=0 with BS=1
        ((checks.skipBackupFlagsCheck || checks.skipBackupEligibilityCheck) && isBackupFlagsError) ||
        (checks.skipSignatureCounterCheck && isCounterError);

      if (isExploit) {
        // Exploit detected! Complete the login and grant reward
        req.session.user = {
          id: user.id,
          username: user.username,
        };

        // Mark challenge as used and clear
        markChallengeUsed(clientData.challenge, req);
        delete req.session.challenge;
        delete req.session.passkeyUserId;

        const reward = getStaticFlagReward(verifier);
        return res.json({
          verified: true,
          user: {
            id: user.id,
            username: user.username,
          },
          reward,
        });
      }

      return res.status(400).json({ error: errorMessage, verified: false });
    }

    if (!verification.verified) {
      // Signature verification failed - check if this is an exploit
      if (checks.skipSignatureVerification) {
        // Exploit detected! Invalid signature was accepted
        exploitDetected = true;
      } else {
        return res.status(400).json({ error: 'Verification failed', verified: false });
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // Post-authentication updates
    // ════════════════════════════════════════════════════════════════════════
    // Only update stored data if verification succeeded (don't trust forged data)
    if (verification.verified && verification.authenticationInfo) {
      // Update signature counter
      passkey.signCount = verification.authenticationInfo.newCounter;

      // Update backup state (BS flag may change between authentications)
      passkey.backupState = backupState;

      // If uvInitialized was false, update it based on current UV flag
      if (!passkey.uvInitialized && userVerified) {
        passkey.uvInitialized = true;
      }

      await storage.updatePasskey(req.instanceId, passkey);
    }

    // Determine which user to log in as
    // Account takeover: if set, login as the attacker's target instead of credential owner
    const loginUser = accountTakeoverUser || { id: user.id, username: user.username };

    // Set session
    req.session.user = {
      id: loginUser.id,
      username: loginUser.username,
    };

    // Mark challenge as used and clear
    markChallengeUsed(clientData.challenge, req);
    delete req.session.challenge;
    delete req.session.passkeyUserId;

    // Signal accepted credentials
    try {
      if (accountTakeoverUser) {
        console.log(`ACCOUNT TAKEOVER: Logged in as ${loginUser.username} using credential from ${user.username}`);
      } else {
        console.log(`Credentials accepted for user: ${loginUser.username}`);
      }
    } catch {
      // Ignore errors from signaling
    }

    // Build response
    const response: {
      verified: boolean;
      user: { id: number; username: string };
      reward?: FlagReward;
    } = {
      verified: true,
      user: {
        id: loginUser.id,
        username: loginUser.username,
      },
    };

    // Include flag reward if exploit was detected
    if (exploitDetected && verifier.rewardFlag) {
      const reward = getStaticFlagReward(verifier);
      if (reward) {
        response.reward = reward;
      }
    }

    res.json(response);
  } catch (error) {
    next(error);
  }
});

export default router;
