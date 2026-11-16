import { supabase } from '../config/supabase.js';
import { AppError } from '../utils/appError.js';

/**
 * Authentication Middleware
 * Validates Supabase JWT Bearer token on incoming requests.
 * Attaches authenticated user object to req.user.
 */
export const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  // If no auth header provided
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // In development or if REQUIRE_AUTH is not explicitly 'true', allow development fallback
    if (process.env.REQUIRE_AUTH === 'true') {
      return next(new AppError('Authentication required. Missing Bearer token.', 401));
    }
    // Default development system user
    req.user = {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'dev.admin@datastraw.com',
      role: 'admin',
    };
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      if (process.env.REQUIRE_AUTH === 'true') {
        return next(new AppError('Invalid or expired authentication session.', 401));
      }
      req.user = {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'dev.admin@datastraw.com',
        role: 'admin',
      };
      return next();
    }

    req.user = {
      id: data.user.id,
      email: data.user.email,
      role: data.user.user_metadata?.role || 'admin',
      metadata: data.user.user_metadata,
    };
    next();
  } catch (err) {
    if (process.env.REQUIRE_AUTH === 'true') {
      return next(new AppError('Authentication failed.', 401));
    }
    req.user = {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'dev.admin@datastraw.com',
      role: 'admin',
    };
    next();
  }
};

/**
 * Role-Based Access Control (RBAC) Middleware
 * Restricts sensitive operations (e.g. publishing roster, deactivations) to specified roles.
 */
export const requireRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required.', 401));
    }

    const userRole = req.user.role || 'manager';
    if (!allowedRoles.includes(userRole) && userRole !== 'admin') {
      return next(new AppError(`Forbidden. Action requires one of: ${allowedRoles.join(', ')}`, 403));
    }
    next();
  };
};
