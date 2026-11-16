import { workingRuleService } from './workingRule.service.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';

class WorkingRuleController {
  async createWorkingRule(req, res, next) {
    try {
      const created = await workingRuleService.createWorkingRule(req.body);
      return successResponse(res, created, 'Working rule created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async getAllWorkingRules(req, res, next) {
    try {
      const { working_rules, pagination } = await workingRuleService.getAllWorkingRules(req.query);
      return paginatedResponse(res, working_rules, pagination, 'Working rules retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async getWorkingRuleById(req, res, next) {
    try {
      const { id } = req.params;
      const rule = await workingRuleService.getWorkingRuleById(id);
      return successResponse(res, rule, 'Working rule retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async updateWorkingRule(req, res, next) {
    try {
      const { id } = req.params;
      const updated = await workingRuleService.updateWorkingRule(id, req.body);
      return successResponse(res, updated, 'Working rule updated successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async deleteWorkingRule(req, res, next) {
    try {
      const { id } = req.params;
      const deleted = await workingRuleService.deleteWorkingRule(id);
      return successResponse(res, deleted, 'Working rule deleted successfully', 200);
    } catch (error) {
      next(error);
    }
  }
}

export const workingRuleController = new WorkingRuleController();
export default workingRuleController;
