import { authService } from './auth.service.js';
import { successResponse } from '../../utils/response.js';

class AuthController {
  async login(req, res, next) {
    try {
      const data = await authService.login(req.body);
      return successResponse(res, data, 'Login successful', 200);
    } catch (error) {
      next(error);
    }
  }

  async register(req, res, next) {
    try {
      const data = await authService.register(req.body);
      return successResponse(res, data, 'Registration successful', 201);
    } catch (error) {
      next(error);
    }
  }

  async getMe(req, res, next) {
    try {
      const profile = await authService.getProfile(req.user);
      return successResponse(res, profile, 'Profile retrieved', 200);
    } catch (error) {
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      return successResponse(res, null, 'Logged out successfully', 200);
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
export default authController;
