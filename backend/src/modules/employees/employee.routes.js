import { Router } from 'express';
import { employeeController } from './employee.controller.js';

const router = Router();

/**
 * Employee Management Routes
 * Base path: /api/employees
 */

// POST /api/employees - Create a new employee
router.post('/', (req, res, next) => employeeController.createEmployee(req, res, next));

// GET /api/employees - Retrieve all employees (paginated, searchable, filterable)
router.get('/', (req, res, next) => employeeController.getAllEmployees(req, res, next));

// GET /api/employees/:id/deletion-check - Check deletion eligibility and return historical reference counts
router.get('/:id/deletion-check', (req, res, next) => employeeController.checkDeletionEligibility(req, res, next));

// GET /api/employees/:id - Retrieve employee by ID
router.get('/:id', (req, res, next) => employeeController.getEmployeeById(req, res, next));

// PUT /api/employees/:id - Update employee details
router.put('/:id', (req, res, next) => employeeController.updateEmployee(req, res, next));

// DELETE /api/employees/:id/permanent - Dedicated permanent employee deletion
router.delete('/:id/permanent', (req, res, next) => employeeController.deleteEmployeePermanent(req, res, next));

// DELETE /api/employees/:id - Soft-delete (deactivate) or permanent delete (?permanent=true)
router.delete('/:id', (req, res, next) => employeeController.deleteEmployee(req, res, next));

export default router;
