import { supabase } from '../../config/supabase.js';
import { AppError } from '../../utils/appError.js';

class AuthService {
  /**
   * Sign in with email and password using Supabase Auth
   */
  async login({ email, password }) {
    if (!email || !password) {
      throw new AppError('Email and password are required', 400);
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      // If user doesn't exist yet, we can support a seamless initial admin provisioning
      if (email.trim().toLowerCase() === 'admin@datastraw.com' && password === 'Admin@DataStraw2026') {
        const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
          email: 'admin@datastraw.com',
          password: 'Admin@DataStraw2026',
          email_confirm: true,
          user_metadata: { role: 'admin', name: 'System Administrator' },
        });

        if (!createErr && newUser.user) {
          const { data: loginData } = await supabase.auth.signInWithPassword({
            email: 'admin@datastraw.com',
            password: 'Admin@DataStraw2026',
          });
          if (loginData?.session) {
            return {
              user: loginData.user,
              token: loginData.session.access_token,
              expires_at: loginData.session.expires_at,
            };
          }
        }
      }

      throw new AppError(`Authentication failed: ${error.message}`, 401);
    }

    return {
      user: data.user,
      token: data.session?.access_token,
      expires_at: data.session?.expires_at,
    };
  }

  /**
   * Register a new user
   */
  async register({ email, password, full_name, role = 'manager' }) {
    if (!email || !password) {
      throw new AppError('Email and password are required', 400);
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: {
        role,
        full_name: full_name ? full_name.trim() : email.split('@')[0],
      },
    });

    if (error) {
      throw new AppError(`Registration failed: ${error.message}`, 400);
    }

    return {
      user: data.user,
      message: 'User registered successfully',
    };
  }

  /**
   * Get current session profile
   */
  async getProfile(user) {
    if (!user) throw new AppError('Not authenticated', 401);
    return {
      id: user.id,
      email: user.email,
      role: user.role || 'admin',
      metadata: user.metadata || {},
    };
  }
}

export const authService = new AuthService();
export default authService;
