// AuthService adapter wrapping sessionManager
import type { AuthService } from '../types';
import { signInWithSession, signOut as smSignOut, getCurrentProfile } from '@/lib/sessionManager';

export class AuthAdapter implements AuthService {
  async getCurrentUser() {
    return await getCurrentProfile();
  }
  async signIn(email: string, password: string): Promise<void> {
    const res = await signInWithSession(email, password);
    if (res.error || !res.session) throw new Error(res.error || 'Sign-in failed');
  }
  async signOut(): Promise<void> {
    await smSignOut();
  }
}
