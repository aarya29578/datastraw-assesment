import { processRepository } from './process.repository.js';
import { AppError } from '../../utils/appError.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_STATUSES = ['ACTIVE', 'INACTIVE'];

class ProcessService {
  /**
   * Validate UUID string format
   * @param {string} id
   * @returns {boolean}
   */
  validateUUID(id) {
    return typeof id === 'string' && UUID_REGEX.test(id.trim());
  }

  /**
   * Create a new process
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async createProcess(data) {
    const { code, name, description, status = 'ACTIVE', brand_id } = data;

    // 1. Mandatory validations
    if (!code || typeof code !== 'string' || code.trim() === '') {
      throw new AppError('Process code is required', 400);
    }
    if (!name || typeof name !== 'string' || name.trim() === '') {
      throw new AppError('Process name is required', 400);
    }

    const trimmedCode = code.trim().toUpperCase();
    if (trimmedCode.length > 20) {
      throw new AppError('Process code cannot exceed 20 characters', 400);
    }

    const trimmedName = name.trim();
    if (trimmedName.length > 100) {
      throw new AppError('Process name cannot exceed 100 characters', 400);
    }

    // 2. Prevent duplicate process code
    const existingCode = await processRepository.findByCode(trimmedCode);
    if (existingCode.data) {
      throw new AppError(`Process with code '${trimmedCode}' already exists`, 409);
    }

    // 3. Validate brand reference if provided by client
    if (brand_id) {
      if (!this.validateUUID(brand_id)) {
        throw new AppError('Invalid brand ID format', 400);
      }
      const brandExists = await processRepository.checkBrandExists(brand_id);
      if (!brandExists) {
        throw new AppError('Referenced brand does not exist', 400);
      }
    }

    // 4. Validate status
    const cleanStatus = typeof status === 'string' ? status.trim().toUpperCase() : 'ACTIVE';
    if (!VALID_STATUSES.includes(cleanStatus)) {
      throw new AppError("Invalid status. Allowed values are 'ACTIVE' or 'INACTIVE'", 400);
    }

    const processPayload = {
      code: trimmedCode,
      name: trimmedName,
      description: description ? description.trim() : null,
      status: cleanStatus,
    };

    const { data: createdProcess, error } = await processRepository.create(processPayload);
    if (error) {
      if (error.code === '23505') {
        throw new AppError(`Process with code '${trimmedCode}' already exists`, 409);
      }
      throw new AppError(`Failed to create process: ${error.message}`, 500);
    }

    return createdProcess;
  }

  /**
   * Retrieve all processes with optional search, status filtering, and pagination
   * @param {Object} query
   * @returns {Promise<{ processes: Array, pagination: Object }>}
   */
  async getAllProcesses(query = {}) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
    const search = query.search ? query.search.trim() : null;

    let status = null;
    if (query.status) {
      const upperStatus = query.status.trim().toUpperCase();
      if (!VALID_STATUSES.includes(upperStatus)) {
        throw new AppError("Invalid status filter. Allowed values: 'ACTIVE', 'INACTIVE'", 400);
      }
      status = upperStatus;
    }

    if (query.brand_id && !this.validateUUID(query.brand_id)) {
      throw new AppError('Invalid brand ID format in query', 400);
    }

    const { data: processes, count, error } = await processRepository.findAll({
      page,
      limit,
      search,
      status,
    });

    if (error) {
      throw new AppError(`Failed to retrieve processes: ${error.message}`, 500);
    }

    const totalPages = Math.ceil(count / limit) || 0;

    return {
      processes,
      pagination: {
        total: count,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * Retrieve a process by ID
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async getProcessById(id) {
    if (!this.validateUUID(id)) {
      throw new AppError('Invalid process ID format', 400);
    }

    const { data: processItem, error } = await processRepository.findById(id);
    if (error) {
      throw new AppError(`Failed to retrieve process: ${error.message}`, 500);
    }
    if (!processItem) {
      throw new AppError('Process not found', 404);
    }

    return processItem;
  }

  /**
   * Update an existing process
   * @param {string} id
   * @param {Object} updateData
   * @returns {Promise<Object>}
   */
  async updateProcess(id, updateData) {
    if (!this.validateUUID(id)) {
      throw new AppError('Invalid process ID format', 400);
    }

    // Verify process exists
    const existingProcess = await this.getProcessById(id);

    const payload = {};

    // 1. Validate code if updated
    if (updateData.code !== undefined) {
      if (!updateData.code || typeof updateData.code !== 'string' || updateData.code.trim() === '') {
        throw new AppError('Process code cannot be empty', 400);
      }
      const trimmedCode = updateData.code.trim().toUpperCase();
      if (trimmedCode.length > 20) {
        throw new AppError('Process code cannot exceed 20 characters', 400);
      }

      // If code is changing, check uniqueness
      if (trimmedCode !== existingProcess.code) {
        const duplicate = await processRepository.findByCode(trimmedCode);
        if (duplicate.data && duplicate.data.id !== id) {
          throw new AppError(`Process with code '${trimmedCode}' is already in use by another process`, 409);
        }
      }
      payload.code = trimmedCode;
    }

    // 2. Validate name if updated
    if (updateData.name !== undefined) {
      if (!updateData.name || typeof updateData.name !== 'string' || updateData.name.trim() === '') {
        throw new AppError('Process name cannot be empty', 400);
      }
      const trimmedName = updateData.name.trim();
      if (trimmedName.length > 100) {
        throw new AppError('Process name cannot exceed 100 characters', 400);
      }
      payload.name = trimmedName;
    }

    // 3. Validate description if updated
    if (updateData.description !== undefined) {
      payload.description = updateData.description ? updateData.description.trim() : null;
    }

    // 4. Validate status if updated
    if (updateData.status !== undefined) {
      const upperStatus = typeof updateData.status === 'string' ? updateData.status.trim().toUpperCase() : '';
      if (!VALID_STATUSES.includes(upperStatus)) {
        throw new AppError("Invalid status. Allowed values: 'ACTIVE', 'INACTIVE'", 400);
      }
      payload.status = upperStatus;
    }

    // 5. Validate brand_id if passed
    if (updateData.brand_id !== undefined && updateData.brand_id !== null) {
      if (!this.validateUUID(updateData.brand_id)) {
        throw new AppError('Invalid brand ID format', 400);
      }
      const brandExists = await processRepository.checkBrandExists(updateData.brand_id);
      if (!brandExists) {
        throw new AppError('Referenced brand does not exist', 400);
      }
    }

    if (Object.keys(payload).length === 0) {
      return existingProcess;
    }

    const { data: updatedProcess, error } = await processRepository.update(id, payload);
    if (error) {
      if (error.code === '23505') {
        throw new AppError('Process code already exists', 409);
      }
      throw new AppError(`Failed to update process: ${error.message}`, 500);
    }

    return updatedProcess;
  }

  /**
   * Delete or deactivate a process
   * If permanent is true, or if process is already INACTIVE with no dependent records, permanently removes it.
   * Otherwise, sets status to INACTIVE. Prevents action if active assignments or working rules exist.
   * @param {string} id
   * @param {Object} [options]
   * @param {boolean} [options.permanent=false]
   * @returns {Promise<Object>}
   */
  async deleteProcess(id, { permanent = false } = {}) {
    if (!this.validateUUID(id)) {
      throw new AppError('Invalid process ID format', 400);
    }

    // Verify process exists
    const processItem = await this.getProcessById(id);

    // Check active assignments and working rules
    const activeAssignments = await processRepository.countActiveAssignments(id);
    const activeWorkingRules = await processRepository.countActiveWorkingRules(id);

    // If permanent deletion requested
    if (permanent) {
      if (activeAssignments > 0 || activeWorkingRules > 0) {
        const reasons = [];
        if (activeAssignments > 0) reasons.push(`${activeAssignments} active employee assignment(s)`);
        if (activeWorkingRules > 0) reasons.push(`${activeWorkingRules} active working rule(s)`);
        throw new AppError(
          `Cannot permanently delete process '${processItem.name}'. It is referenced by ${reasons.join(' and ')}. Reassign employees or remove working rules first.`,
          409,
          {
            code: 'PROCESS_HAS_ACTIVE_DEPENDENCIES',
            details: { processId: id, activeAssignments, activeWorkingRules },
            suggestion: `Reassign or remove dependent assignments and working rules before deleting this process.`,
          }
        );
      }

      // Safe to permanently delete
      const { error } = await processRepository.delete(id);
      if (error) {
        throw new AppError(`Failed to permanently delete process: ${error.message}`, 500);
      }

      return {
        id,
        code: processItem.code,
        name: processItem.name,
        deleted: true,
        permanent: true,
      };
    }

    // Standard soft-deactivation (permanent === false)
    if (processItem.status === 'INACTIVE') {
      throw new AppError('Process is already inactive', 409, {
        code: 'ALREADY_INACTIVE',
        details: { processId: id, currentStatus: 'INACTIVE' },
        suggestion: 'This process is already inactive. No further action is required.',
      });
    }

    // Standard soft-deactivation for ACTIVE processes
    if (activeAssignments > 0) {
      throw new AppError(
        `Cannot deactivate process '${processItem.name}'. It is referenced by ${activeAssignments} active employee assignment(s). Reassign employees before deactivating.`,
        409,
        {
          code: 'PROCESS_HAS_ACTIVE_ASSIGNMENTS',
          details: { activeAssignmentsCount: activeAssignments },
          suggestion: `Reassign or remove the ${activeAssignments} active employee assignment(s) before deactivating this process.`,
        }
      );
    }

    if (activeWorkingRules > 0) {
      throw new AppError(
        `Cannot deactivate process '${processItem.name}'. It is referenced by ${activeWorkingRules} active working rule(s). Archive or reconfigure rules first.`,
        409,
        {
          code: 'PROCESS_HAS_ACTIVE_WORKING_RULES',
          details: { activeWorkingRulesCount: activeWorkingRules },
          suggestion: `Deactivate or reconfigure the ${activeWorkingRules} associated working rule(s) before deactivating this process.`,
        }
      );
    }

    const { data: deactivatedProcess, error } = await processRepository.update(id, {
      status: 'INACTIVE',
    });

    if (error) {
      throw new AppError(`Failed to deactivate process: ${error.message}`, 500);
    }

    return deactivatedProcess;
  }

  /**
   * Reactivate an inactive process
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async activateProcess(id) {
    return this.updateProcess(id, { status: 'ACTIVE' });
  }

  /**
   * Alias for backwards compatibility
   */
  async deactivateProcess(id, options = {}) {
    return this.deleteProcess(id, options);
  }
}

export const processService = new ProcessService();
export default processService;
