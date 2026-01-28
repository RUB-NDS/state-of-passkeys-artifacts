import { Router, Request, Response, CookieOptions } from 'express';
import {
  getAllVerifiers,
  getVerifiersByTarget,
  getVerifiersByTargetAndType,
  getVerifierById,
} from '../config';
import { VerifierTarget } from '../types/verifier';

const router = Router();
const AUTH_VERIFIER_COOKIE = 'fwf_verifier_auth';
const REG_VERIFIER_COOKIE = 'fwf_verifier_reg';
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60 * 1000; // 1 year

const cookieOptions: CookieOptions = {
  maxAge: COOKIE_MAX_AGE,
  httpOnly: false,
  sameSite: 'lax',
};

// GET /verifiers - Verifiers overview page
router.get('/', (req: Request, res: Response) => {
  const authenticationDemo = getVerifiersByTargetAndType('authentication', 'demo');
  const registrationDemo = getVerifiersByTargetAndType('registration', 'demo');
  const authenticationSecurity = getVerifiersByTargetAndType('authentication', 'security');
  const registrationSecurity = getVerifiersByTargetAndType('registration', 'security');

  res.render('pages/verifiers.njk', {
    title: 'Verifiers - Fun with Flags and Passkeys',
    authenticationDemo,
    registrationDemo,
    authenticationSecurity,
    registrationSecurity,
    currentAuthVerifier: req.authVerifier,
    currentRegVerifier: req.regVerifier,
  });
});

// GET /verifiers/api/list - Get all verifiers (API)
// Query params:
//   target=authentication - Only authentication verifiers
//   target=registration   - Only registration verifiers
router.get('/api/list', (req: Request, res: Response) => {
  const { target } = req.query as { target?: VerifierTarget };

  let verifiers = getAllVerifiers();

  // Filter by target if specified
  if (target === 'authentication' || target === 'registration') {
    verifiers = getVerifiersByTarget(target);
  }

  // Don't expose flags in API response
  const sanitizedVerifiers = verifiers.map((v) => ({
    id: v.id,
    name: v.name,
    target: v.target,
    type: v.type,
    section: v.section,
    description: v.description,
    hint: v.hint,
    hasReward: v.rewardFlag !== null,
  }));

  res.json({
    currentAuthVerifier: req.authVerifierId,
    currentRegVerifier: req.regVerifierId,
    verifiers: sanitizedVerifiers,
  });
});

// POST /verifiers/api/switch - Switch to a different verifier
router.post('/api/switch', (req: Request, res: Response) => {
  const { verifierId, target } = req.body as { verifierId: number; target: VerifierTarget };

  if (typeof verifierId !== 'number') {
    return res.status(400).json({ error: 'Verifier ID must be a number' });
  }

  if (!target || (target !== 'authentication' && target !== 'registration')) {
    return res.status(400).json({ error: 'Target must be "authentication" or "registration"' });
  }

  const verifier = getVerifierById(verifierId);
  if (!verifier) {
    return res.status(404).json({ error: 'Verifier not found' });
  }

  if (verifier.target !== target) {
    return res.status(400).json({ error: `Verifier ${verifierId} is not a ${target} verifier` });
  }

  const cookieName = target === 'authentication' ? AUTH_VERIFIER_COOKIE : REG_VERIFIER_COOKIE;
  res.cookie(cookieName, verifierId.toString(), cookieOptions);

  res.json({
    success: true,
    verifier: {
      id: verifier.id,
      name: verifier.name,
      target: verifier.target,
      type: verifier.type,
      description: verifier.description,
    },
  });
});

export default router;
