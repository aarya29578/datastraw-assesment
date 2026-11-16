import { brandService } from './brand.service.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';

class BrandController {
  /**
   * POST /api/brands
   * Create a new brand
   */
  async createBrand(req, res, next) {
    try {
      const createdBrand = await brandService.createBrand(req.body);
      return successResponse(res, createdBrand, 'Brand created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/brands
   * Retrieve all brands with optional search, status filter, and pagination
   */
  async getAllBrands(req, res, next) {
    try {
      const { brands, pagination } = await brandService.getAllBrands(req.query);
      return paginatedResponse(res, brands, pagination, 'Brands retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/brands/:id
   * Retrieve a brand by ID
   */
  async getBrandById(req, res, next) {
    try {
      const { id } = req.params;
      const brand = await brandService.getBrandById(id);
      return successResponse(res, brand, 'Brand retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/brands/:id
   * Update brand details
   */
  async updateBrand(req, res, next) {
    try {
      const { id } = req.params;
      const updatedBrand = await brandService.updateBrand(id, req.body);
      return successResponse(res, updatedBrand, 'Brand updated successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/brands/:id
   * Soft-deactivate or permanently delete a brand
   */
  async deactivateBrand(req, res, next) {
    try {
      const { id } = req.params;
      const permanent = req.query.permanent === 'true';
      const result = await brandService.deleteBrand(id, { permanent });
      const message = result?.deleted
        ? `Brand '${result.name}' permanently deleted successfully`
        : 'Brand deactivated successfully';
      return successResponse(res, result, message, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/brands/:id - alias for deactivateBrand
   */
  async deleteBrand(req, res, next) {
    return this.deactivateBrand(req, res, next);
  }
}

export const brandController = new BrandController();
export default brandController;
