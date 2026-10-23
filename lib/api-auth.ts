import { NextRequest } from 'next/server';
import { SafeUserAccount } from './types';
import { verifySessionToken } from './server-db';

export function getAuthenticatedUser(req: NextRequest): SafeUserAccount | null {
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const user = verifySessionToken(token);
    if (user) return user;
  }

  const cookieToken = req.cookies.get('mvp_rms_session')?.value;
  if (cookieToken) {
    const user = verifySessionToken(cookieToken);
    if (user) return user;
  }

  return null;
}
