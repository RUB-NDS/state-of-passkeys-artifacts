import { Request, Response, NextFunction, CookieOptions } from 'express';
import { getVerifierById, getDefaultAuthVerifier, getDefaultRegVerifier } from '../config';
import { AuthenticationVerifier, RegistrationVerifier } from '../types/verifier';

const AUTH_VERIFIER_COOKIE = 'fwf_verifier_auth';
const REG_VERIFIER_COOKIE = 'fwf_verifier_reg';
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60 * 1000; // 1 year

const cookieOptions: CookieOptions = {
  maxAge: COOKIE_MAX_AGE,
  httpOnly: false, // Allow JS access for UI
  sameSite: 'lax',
};

export function verifierMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Parse auth verifier
  const authIdStr = req.cookies[AUTH_VERIFIER_COOKIE] as string | undefined;
  let authId = authIdStr ? parseInt(authIdStr, 10) : NaN;
  let authVerifier = !isNaN(authId) ? getVerifierById(authId) : undefined;

  if (!authVerifier || authVerifier.target !== 'authentication') {
    authVerifier = getDefaultAuthVerifier();
    authId = authVerifier.id;
    res.cookie(AUTH_VERIFIER_COOKIE, authId.toString(), cookieOptions);
  }

  // Parse reg verifier
  const regIdStr = req.cookies[REG_VERIFIER_COOKIE] as string | undefined;
  let regId = regIdStr ? parseInt(regIdStr, 10) : NaN;
  let regVerifier = !isNaN(regId) ? getVerifierById(regId) : undefined;

  if (!regVerifier || regVerifier.target !== 'registration') {
    regVerifier = getDefaultRegVerifier();
    regId = regVerifier.id;
    res.cookie(REG_VERIFIER_COOKIE, regId.toString(), cookieOptions);
  }

  req.authVerifierId = authId;
  req.regVerifierId = regId;
  req.authVerifier = authVerifier as AuthenticationVerifier;
  req.regVerifier = regVerifier as RegistrationVerifier;
  next();
}
