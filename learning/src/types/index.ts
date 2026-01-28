import 'express-session';

export * from './user';
export * from './passkey';
export * from './flag';
export * from './instance';
export * from './verifier';

// Extend Express types
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      instanceId: string;
      authVerifierId: number;
      regVerifierId: number;
      authVerifier: import('./verifier').AuthenticationVerifier;
      regVerifier: import('./verifier').RegistrationVerifier;
    }
  }
}

declare module 'express-session' {
  interface SessionData {
    user?: {
      id: number;
      username: string;
    };
    challenge?: string;
    passkeyUserId?: number;
    challengeHistory?: string[]; // All issued challenges in this session
    usedChallenges?: string[]; // Challenges that were successfully verified (for reuse detection)
  }
}
