import { Verifier, VerifierConfig, VerifierTarget, VerifierType } from '../types/verifier';
import verifiersJson from './verifiers.json';
import aaguidJson from './combined_aaguid.json';

export interface AuthenticatorInfo {
  name: string;
  icon_light?: string | null;
  icon_dark?: string | null;
}

const aaguidData = aaguidJson as Record<string, AuthenticatorInfo>;

const verifierConfig = verifiersJson as VerifierConfig;

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  sessionSecret: process.env.SESSION_SECRET || 'changeme',
  rpName: 'Fun with Flags and Passkeys',
  rpId: process.env.RP_ID || 'localhost',
  origin: process.env.ORIGIN || 'http://localhost:3000',
  mongoUri: process.env.MONGO_URI || '',
  useMongoStorage: process.env.USE_MONGO === 'true',
};

export function getVerifierById(id: number): Verifier | undefined {
  return verifierConfig.verifiers.find((v) => v.id === id);
}

export function getDefaultAuthVerifier(): Verifier {
  const defaultVerifier = getVerifierById(verifierConfig.defaultAuthVerifier);
  if (!defaultVerifier) {
    throw new Error(`Default auth verifier ${verifierConfig.defaultAuthVerifier} not found`);
  }
  return defaultVerifier;
}

export function getDefaultRegVerifier(): Verifier {
  const defaultVerifier = getVerifierById(verifierConfig.defaultRegVerifier);
  if (!defaultVerifier) {
    throw new Error(`Default reg verifier ${verifierConfig.defaultRegVerifier} not found`);
  }
  return defaultVerifier;
}

export function getAllVerifiers(): Verifier[] {
  return verifierConfig.verifiers;
}

export function getVerifiersByTarget(target: VerifierTarget): Verifier[] {
  return verifierConfig.verifiers.filter((v) => v.target === target);
}

export function getVerifiersByTargetAndType(
  target: VerifierTarget,
  type: VerifierType
): Verifier[] {
  return verifierConfig.verifiers.filter((v) => v.target === target && v.type === type);
}

const ALGORITHM_IDS: Record<string, number> = {
  ES256: -7,
  ES384: -35,
  ES512: -36,
  PS256: -37,
  PS384: -38,
  PS512: -39,
  RS256: -257,
  RS384: -258,
  RS512: -259,
  EdDSA: -8,
};

export function getAlgorithmId(algorithm: string): number {
  return ALGORITHM_IDS[algorithm] || -7;
}

export function getAllAlgorithmIds(): number[] {
  // Return in order of preference: ES256 first (most common), then others
  return [-7, -35, -36, -37, -38, -39, -257, -258, -259, -8];
}

export function getAlgorithmIdsExcluding(excludeAlgorithms: string[]): number[] {
  const excludeIds = excludeAlgorithms.map((alg) => ALGORITHM_IDS[alg]).filter((id) => id != null);
  return getAllAlgorithmIds().filter((id) => !excludeIds.includes(id));
}

export function getAuthenticatorInfo(aaguid: string): AuthenticatorInfo | undefined {
  return aaguidData[aaguid];
}
