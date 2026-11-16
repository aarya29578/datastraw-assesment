import { assignmentRepository } from './assignment.repository.js';
import { AppError } from '../../utils/appError.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class AssignmentService {
  validateUUID(id) {
    return typeof id === 'string' && UUID_REGEX.test(id.trim());
  }

  /**
   * Create assignment(s) with fan-out support for multiple processes
   * @param {Object} data
   * @returns {Promise<Object|Array>}
   */
  async createAssignment(data) {
    const { employee_id, brand_id, process_id, process_ids, is_primary = false } = data;

    // 1. Validate employee
    if (!employee_id || !this.validateUUID(employee_id)) {
      throw new AppError('Valid employee ID is required', 400);
    }
    const { data: employee, error: empErr } = await assignmentRepository.getEmployee(employee_id);
    if (empErr || !employee) {
      throw new AppError('Referenced employee does not exist', 400);
    }
    if (employee.employment_status !== 'ACTIVE') {
      throw new AppError('Cannot create assignments for an inactive employee', 400);
    }

    // 2. Validate brand
    if (!brand_id || !this.validateUUID(brand_id)) {
      throw new AppError('Valid brand ID is required', 400);
    }
    const { data: brand, error: brandErr } = await assignmentRepository.getBrand(brand_id);
    if (brandErr || !brand) {
      throw new AppError('Referenced brand does not exist', 400);
    }
    if (brand.status !== 'ACTIVE') {
      throw new AppError(`Cannot assign to an inactive brand (${brand.name})`, 400);
    }

    // 3. Normalize processes (support single process_id or multiple process_ids)
    let targetProcessIds = [];
    if (Array.isArray(process_ids) && process_ids.length > 0) {
      targetProcessIds = process_ids;
    } else if (process_id) {
      targetProcessIds = [process_id];
    } else {
      throw new AppError('At least one process ID is required', 400);
    }

    // 4. Validate and verify each process
    const verifiedProcessIds = [];
    for (const procId of targetProcessIds) {
      if (!this.validateUUID(procId)) {
        throw new AppError(`Invalid process ID format: ${procId}`, 400);
      }
      const { data: proc, error: procErr } = await assignmentRepository.getProcess(procId);
      if (procErr || !proc) {
        throw new AppError(`Referenced process does not exist (${procId})`, 400);
      }
      if (proc.status !== 'ACTIVE') {
        throw new AppError(`Cannot assign to an inactive process (${proc.name})`, 400);
      }
      verifiedProcessIds.push(procId);
    }

    // 5. Check duplicate assignments
    const assignmentsToCreate = [];
    for (const procId of verifiedProcessIds) {
      const existing = await assignmentRepository.findExisting(employee_id, brand_id, procId);
      if (existing.data) {
        if (verifiedProcessIds.length === 1) {
          throw new AppError('This employee is already assigned to this brand and process', 409);
        }
        // If multi-process fan-out, skip already existing to avoid partial failure
        continue;
      }
      assignmentsToCreate.push({
        employee_id,
        brand_id,
        process_id: procId,
        is_primary: Boolean(is_primary),
      });
    }

    if (assignmentsToCreate.length === 0) {
      throw new AppError('All specified assignments already exist for this employee', 409);
    }

    if (assignmentsToCreate.length === 1) {
      const { data: created, error } = await assignmentRepository.create(assignmentsToCreate[0]);
      if (error) throw new AppError(`Failed to create assignment: ${error.message}`, 500);
      return created;
    } else {
      const { data: createdBulk, error } = await assignmentRepository.createBulk(assignmentsToCreate);
      if (error) throw new AppError(`Failed to create assignments in bulk: ${error.message}`, 500);
      return createdBulk;
    }
  }

  /**
   * Retrieve assignments with search, filtering, and pagination
   */
  async getAllAssignments(query = {}) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));

    const { employee_id, brand_id, process_id, pod_id, search } = query;

    if (employee_id && !this.validateUUID(employee_id)) {
      throw new AppError('Invalid employee ID format in filter', 400);
    }
    if (brand_id && !this.validateUUID(brand_id)) {
      throw new AppError('Invalid brand ID format in filter', 400);
    }
    if (process_id && !this.validateUUID(process_id)) {
      throw new AppError('Invalid process ID format in filter', 400);
    }
    if (pod_id && !this.validateUUID(pod_id)) {
      throw new AppError('Invalid pod ID format in filter', 400);
    }

    const { data: assignments, count, error } = await assignmentRepository.findAll({
      page,
      limit,
      employee_id,
      brand_id,
      process_id,
      pod_id,
      search,
    });

    if (error) throw new AppError(`Failed to retrieve assignments: ${error.message}`, 500);

    const totalPages = Math.ceil(count / limit) || 0;
    return {
      assignments,
      pagination: {
        total: count,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * Get an assignment by ID
   */
  async getAssignmentById(id) {
    if (!this.validateUUID(id)) {
      throw new AppError('Invalid assignment ID format', 400);
    }
    const { data: assignment, error } = await assignmentRepository.findById(id);
    if (error) throw new AppError(`Failed to retrieve assignment: ${error.message}`, 500);
    if (!assignment) throw new AppError('Assignment not found', 404);
    return assignment;
  }

  /**
   * Update assignment details
   */
  async updateAssignment(id, updateData) {
    if (!this.validateUUID(id)) {
      throw new AppError('Invalid assignment ID format', 400);
    }
    const existing = await this.getAssignmentById(id);

    const payload = {};
    if (updateData.is_primary !== undefined) {
      payload.is_primary = Boolean(updateData.is_primary);
    }

    if (updateData.brand_id && updateData.brand_id !== existing.brand_id) {
      if (!this.validateUUID(updateData.brand_id)) throw new AppError('Invalid brand ID format', 400);
      const { data: brand } = await assignmentRepository.getBrand(updateData.brand_id);
      if (!brand || brand.status !== 'ACTIVE') throw new AppError('Brand must be active', 400);
      payload.brand_id = updateData.brand_id;
    }

    if (updateData.process_id && updateData.process_id !== existing.process_id) {
      if (!this.validateUUID(updateData.process_id)) throw new AppError('Invalid process ID format', 400);
      const { data: proc } = await assignmentRepository.getProcess(updateData.process_id);
      if (!proc || proc.status !== 'ACTIVE') throw new AppError('Process must be active', 400);
      payload.process_id = updateData.process_id;
    }

    if (payload.brand_id || payload.process_id) {
      const checkBrand = payload.brand_id || existing.brand_id;
      const checkProc = payload.process_id || existing.process_id;
      const duplicate = await assignmentRepository.findExisting(existing.employee_id, checkBrand, checkProc);
      if (duplicate.data && duplicate.data.id !== id) {
        throw new AppError('This employee already has an assignment for the specified brand and process', 409);
      }
    }

    const { data: updated, error } = await assignmentRepository.update(id, payload);
    if (error) throw new AppError(`Failed to update assignment: ${error.message}`, 500);
    return updated;
  }

  /**
   * Delete an assignment
   */
  async deleteAssignment(id) {
    if (!this.validateUUID(id)) {
      throw new AppError('Invalid assignment ID format', 400);
    }
    const existing = await this.getAssignmentById(id);

    const rosterCount = await assignmentRepository.countRosterEntries(id);
    if (rosterCount > 0) {
      throw new AppError(
        `Cannot delete assignment. It is referenced by ${rosterCount} historical roster shift(s).`,
        409,
        {
          code: 'ASSIGNMENT_HAS_ROSTER_ENTRIES',
          details: { rosterCount, assignmentId: id },
          suggestion: `This assignment has ${rosterCount} associated roster shifts. Remove or adjust historical shifts before deleting.`,
        }
      );
    }

    const { data: deleted, error } = await assignmentRepository.delete(id);
    if (error) throw new AppError(`Failed to delete assignment: ${error.message}`, 500);
    return deleted || { id, message: 'Assignment deleted successfully' };
  }
}

export const assignmentService = new AssignmentService();
export default assignmentService;
