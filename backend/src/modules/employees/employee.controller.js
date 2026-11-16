import { employeeService } from './employee.service.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';

class EmployeeController {
  /**
   * POST /api/employees
   * Create a new employee
   */
  async createEmployee(req, res, next) {
    try {
      const createdEmployee = await employeeService.createEmployee(req.body);
      return successResponse(
        res,
        createdEmployee,
        'Employee created successfully',
        201
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/employees
   * Retrieve all employees with pagination, search, and filters
   */
  async getAllEmployees(req, res, next) {
    try {
      const { employees, pagination } = await employeeService.getAllEmployees(req.query);
      return paginatedResponse(
        res,
        employees,
        pagination,
        'Employees retrieved successfully',
        200
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/employees/:id
   * Retrieve employee by ID
   */
  async getEmployeeById(req, res, next) {
    try {
      const { id } = req.params;
      const employee = await employeeService.getEmployeeById(id);
      return successResponse(
        res,
        employee,
        'Employee retrieved successfully',
        200
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/employees/:id
   * Update employee details
   */
  async updateEmployee(req, res, next) {
    try {
      const { id } = req.params;
      const updatedEmployee = await employeeService.updateEmployee(id, req.body);
      return successResponse(
        res,
        updatedEmployee,
        'Employee updated successfully',
        200
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/employees/:id
   * Soft delete (deactivate) or permanent delete if ?permanent=true
   */
  async deleteEmployee(req, res, next) {
    try {
      const { id } = req.params;
      const isPermanent = req.query.permanent === 'true';

      if (isPermanent) {
        const result = await employeeService.deleteEmployee(id, { permanent: true });
        return successResponse(
          res,
          result.deletedEmployee,
          result.message,
          200
        );
      } else {
        const deactivatedEmployee = await employeeService.deactivateEmployee(id);
        return successResponse(
          res,
          deactivatedEmployee,
          'Employee deactivated successfully',
          200
        );
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/employees/:id/deletion-check
   * Check deletion eligibility and return historical reference counts
   */
  async checkDeletionEligibility(req, res, next) {
    try {
      const { id } = req.params;
      const eligibility = await employeeService.checkDeletionEligibility(id);
      return successResponse(
        res,
        eligibility,
        'Employee deletion eligibility retrieved successfully',
        200
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/employees/:id/permanent
   * Dedicated endpoint for permanent employee deletion with validation
   */
  async deleteEmployeePermanent(req, res, next) {
    try {
      const { id } = req.params;
      const result = await employeeService.deleteEmployee(id, { permanent: true });
      return successResponse(
        res,
        result.deletedEmployee,
        result.message,
        200
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Legacy deactivate alias
   */
  async deactivateEmployee(req, res, next) {
    return this.deleteEmployee(req, res, next);
  }
}

export const employeeController = new EmployeeController();
export default employeeController;
