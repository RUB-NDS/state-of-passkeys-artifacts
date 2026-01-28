import { VerifierRewardFlag } from './flag';

export type VerifierTarget = 'authentication' | 'registration';
export type VerifierType = 'demo' | 'security';

// Backend verification checks - same for both authentication and registration
export interface VerifierChecks {
  // §7.2.5-6: Credential binding verification (authentication only)
  skipCredentialBindingCheck: boolean; // Don't verify credential.id in allowCredentials (non-discoverable)
  loginAsPreIdentifiedUser: boolean; // When binding check skipped, login as pre-identified user (account takeover)
  skipUserHandleCheck: boolean; // Don't verify userHandle matches credential owner (discoverable)
  loginAsUserHandle: boolean; // When userHandle check skipped, login as userHandle user (account takeover)

  // §7.1.7 / §7.2.10: clientData.type verification
  skipTypeVerification: boolean; // Accept any type value
  allowSwappedType: boolean; // Accept swapped type (create↔get)

  // §7.1.8 / §7.2.11: clientData.challenge verification
  skipChallengeVerification: boolean; // Accept any challenge
  allowReusedChallenge: boolean; // Accept old challenge from same session
  allowAnyChallengeFromAnySession: boolean; // Accept challenge from another session

  // §7.1.9 / §7.2.12: clientData.origin verification
  skipOriginVerification: boolean; // Accept any origin
  allowSameSiteOrigin: boolean; // Accept same-site origins (subdomains)

  // §7.1.10-11 / §7.2.13-14: clientData.crossOrigin and topOrigin
  skipCrossOriginCheck: boolean; // Accept cross-origin requests

  // §7.1.14 / §7.2.15: rpIdHash verification
  skipRpIdVerification: boolean; // Accept any rpIdHash
  allowSameSiteRpId: boolean; // Accept same-site rpIdHash

  // §7.1.15 / §7.2.16: UP flag verification
  skipUserPresentCheck: boolean; // Accept UP=0

  // §7.1.16 / §7.2.17: UV flag verification
  skipUserVerifiedCheck: boolean; // Accept UV=0 when required

  // §7.1.17 / §7.2.18: BE/BS backup flags verification
  skipBackupFlagsCheck: boolean; // Accept invalid BE/BS combinations

  // §7.2.19: BE flag consistency verification (authentication only)
  skipBackupEligibilityCheck: boolean; // Don't verify BE matches stored backupEligible

  // §7.1.20: Algorithm verification (registration only)
  skipAlgorithmVerification: boolean; // Accept any algorithm

  // §7.2.21: Signature verification (authentication only)
  skipSignatureVerification: boolean; // Accept invalid signatures

  // §7.2.22: Signature counter verification (authentication only)
  skipSignatureCounterCheck: boolean; // Accept counter rollback

  // §7.1.25: Credential ID length verification (registration only)
  skipCredentialIdLengthCheck: boolean; // Accept credential ID > 1023 bytes

  // §7.1.26: Credential ID uniqueness verification (registration only)
  allowDuplicateCredentialId: boolean; // Add duplicate (causes login error)
  allowCredentialOverwrite: boolean; // Overwrite public key (account takeover)
  allowCrossAccountCredential: boolean; // Register credential under wrong account
}

// Authentication verifier options (WebAuthn API options)
export interface AuthenticationOptions {
  passkeyEnabled: boolean;
  passkeyFlow: 'discoverable' | 'non-discoverable' | '2fa' | 'none';
  conditionalUI: boolean;
  userVerification: 'required' | 'preferred' | 'discouraged';
}

// Authentication verifier UI configuration
export interface AuthenticationUI {
  showPasswordForm: boolean;
  showPasskeyButton: boolean;
  showUsernameFirst: boolean;
  autotriggerPasskey: boolean;
}

// Algorithm names
export type AlgorithmName =
  | 'ES256'
  | 'ES384'
  | 'ES512'
  | 'PS256'
  | 'PS384'
  | 'PS512'
  | 'RS256'
  | 'RS384'
  | 'RS512'
  | 'EdDSA';

// Registration verifier options (WebAuthn API options)
export interface RegistrationOptions {
  algorithm: 'all' | AlgorithmName;
  excludeAlgorithms?: AlgorithmName[]; // Only used when algorithm is 'all'
  rpIdUpscope: boolean;
  authenticatorAttachment: 'platform' | 'cross-platform' | null;
  attestation: 'none' | 'indirect' | 'direct' | 'enterprise';
  userVerification: 'required' | 'preferred' | 'discouraged';
  residentKey: 'required' | 'preferred' | 'discouraged';
  userIdFromUsername: boolean;
}

// Registration verifier UI configuration
// Currently empty - reserved for future UI options
export type RegistrationUI = Record<string, never>;

// Base verifier properties
interface VerifierBase {
  id: number;
  name: string;
  type: VerifierType;
  description: string;
  hint: string;
  rewardFlag: VerifierRewardFlag | null; // Embedded reward flag for security verifiers
  section?: string; // W3C spec section (e.g., "7.1.8") - only for security verifiers
  checks: VerifierChecks;
}

// Authentication verifier
export interface AuthenticationVerifier extends VerifierBase {
  target: 'authentication';
  options: AuthenticationOptions;
  ui: AuthenticationUI;
}

// Registration verifier
export interface RegistrationVerifier extends VerifierBase {
  target: 'registration';
  options: RegistrationOptions;
  ui: RegistrationUI;
}

// Union type for all verifiers
export type Verifier = AuthenticationVerifier | RegistrationVerifier;

// Type guards
export function isAuthenticationVerifier(v: Verifier): v is AuthenticationVerifier {
  return v.target === 'authentication';
}

export function isRegistrationVerifier(v: Verifier): v is RegistrationVerifier {
  return v.target === 'registration';
}

export interface VerifierConfig {
  defaultAuthVerifier: number;
  defaultRegVerifier: number;
  verifiers: Verifier[];
}
