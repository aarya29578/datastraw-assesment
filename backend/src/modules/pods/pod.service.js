import { podRepository } from './pod.repository.js';
import { AppError } from '../../utils/appError.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class PodService {
  /**
   * Validate UUID string format
   * @param {string} id
   * @returns {boolean}
   */
  validateUUID(id) {
    return typeof id === 'string' && UUID_REGEX.test(id.trim());
  }

  /**
   * Create a new pod
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async createPod(data) {
    const { name, description, lead_employee_id } = data;

    // 1. Mandatory validation
    if (!name || typeof name !== 'string' || name.trim() === '') {
      throw new AppError('Pod name is required', 400, {
        code: 'POD_NAME_REQUIRED',
        suggestion: 'Please provide a descriptive name for the operational pod.',
      });
    }

    const trimmedName = name.trim();
    if (trimmedName.length > 100) {
      throw new AppError('Pod name cannot exceed 100 characters', 400, {
        code: 'POD_NAME_TOO_LONG',
        suggestion: 'Shorten the pod name to under 100 characters.',
      });
    }

    // 2. Prevent duplicate pod names
    const existingPod = await podRepository.findByName(trimmedName);
    if (existingPod.data) {
      throw new AppError(`Pod with name '${trimmedName}' already exists`, 409, {
        code: 'DUPLICATE_POD_NAME',
        details: { podName: trimmedName },
        suggestion: 'Please choose a distinct name for this operational pod.',
      });
    }

    // 3. Validate lead employee reference if provided
    let cleanLeadId = null;
    if (lead_employee_id) {
      if (!this.validateUUID(lead_employee_id)) {
        throw new AppError('Invalid lead employee ID format', 400, {
          code: 'INVALID_LEAD_ID_FORMAT',
          suggestion: 'Select a valid employee from the directory.',
        });
      }

      const { exists, employee } = await podRepository.checkEmployeeExists(lead_employee_id);
      if (!exists) {
        throw new AppError('Lead employee does not exist', 400, {
          code: 'LEAD_NOT_FOUND',
          suggestion: 'The selected lead employee no longer exists in the directory.',
        });
      }
      if (employee.employment_status !== 'ACTIVE') {
        throw new AppError('Cannot assign an inactive employee as pod lead', 400, {
          code: 'INACTIVE_LEAD_EMPLOYEE',
          suggestion: 'Only active team members may be designated as pod leads.',
        });
      }

      cleanLeadId = lead_employee_id.trim();
    }

    const podPayload = {
      name: trimmedName,
      description: description ? description.trim() : null,
      lead_employee_id: cleanLeadId,
    };

    const { data: createdPod, error } = await podRepository.create(podPayload);
    if (error) {
      if (error.code === '23505') {
        throw new AppError(`Pod with name '${trimmedName}' already exists`, 409);
      }
      throw new AppError(`Failed to create pod: ${error.message}`, 500);
    }

    // Ensure lead employee's pod_id points to this newly created pod and clear previous lead references
    if (cleanLeadId && createdPod?.id) {
      await podRepository.assignEmployeeToPod(cleanLeadId, createdPod.id);
      await podRepository.clearOtherPodLeads(cleanLeadId, createdPod.id);
    }

    return this.formatPodResponse(createdPod);
  }

  /**
   * Derive associated active brands, processes, and distinct assigned employee count for a pod
   * @param {Object} pod
   * @returns {Object}
   */
  formatPodResponse(pod) {
    if (!pod) return null;

    const brandMap = new Map();
    const rawEmployees = pod.employees || [];
    const activeEmployees = rawEmployees.filter(
      (e) => !e.employment_status || e.employment_status === 'ACTIVE'
    );

    for (const emp of activeEmployees) {
      const assignments = emp.employee_assignments || [];
      for (const assign of assignments) {
        const brand = assign.brand;
        const process = assign.process;
        if (!brand || brand.status !== 'ACTIVE') continue;
        if (!process || process.status !== 'ACTIVE') continue;

        if (!brandMap.has(brand.id)) {
          brandMap.set(brand.id, {
            id: brand.id,
            name: brand.name,
            status: brand.status,
            employeeIds: new Set(),
            processMap: new Map(),
          });
        }

        const bEntry = brandMap.get(brand.id);
        bEntry.employeeIds.add(emp.id);

        if (!bEntry.processMap.has(process.id)) {
          bEntry.processMap.set(process.id, {
            id: process.id,
            code: process.code,
            name: process.name,
          });
        }
      }
    }

    const brands = Array.from(brandMap.values())
      .map((b) => {
        const processes = Array.from(b.processMap.values());
        return {
          id: b.id,
          name: b.name,
          status: b.status,
          employee_count: b.employeeIds.size,
          processes,
          process_names: processes.map((p) => p.name),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const cleanedEmployees = rawEmployees.map((e) => {
      const { employee_assignments, ...rest } = e;
      return rest;
    });

    return {
      ...pod,
      employee_count: activeEmployees.length,
      brands_count: brands.length,
      brands,
      employees: cleanedEmployees,
    };
  }

  /**
   * Retrieve all pods with optional search and pagination
   * @param {Object} query
   * @returns {Promise<{ pods: Array, pagination: Object }>}
   */
  async getAllPods(query = {}) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
    const search = query.search ? query.search.trim() : null;

    const { data: pods, count, error } = await podRepository.findAll({
      page,
      limit,
      search,
    });

    if (error) {
      throw new AppError(`Failed to retrieve pods: ${error.message}`, 500);
    }

    const totalPages = Math.ceil(count / limit) || 0;
    const formattedPods = pods.map((p) => this.formatPodResponse(p));

    return {
      pods: formattedPods,
      pagination: {
        total: count,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * Retrieve a pod by ID
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async getPodById(id) {
    if (!this.validateUUID(id)) {
      throw new AppError('Invalid pod ID format', 400);
    }

    const { data: pod, error } = await podRepository.findById(id);
    if (error) {
      throw new AppError(`Failed to retrieve pod: ${error.message}`, 500);
    }
    if (!pod) {
      throw new AppError('Pod not found', 404);
    }

    return this.formatPodResponse(pod);
  }

  /**
   * Update an existing pod
   * @param {string} id
   * @param {Object} updateData
   * @returns {Promise<Object>}
   */
  async updatePod(id, updateData) {
    if (!this.validateUUID(id)) {
      throw new AppError('Invalid pod ID format', 400);
    }

    // Verify pod exists
    const existingPod = await this.getPodById(id);

    const payload = {};

    // 1. Validate name if updated
    if (updateData.name !== undefined) {
      if (!updateData.name || typeof updateData.name !== 'string' || updateData.name.trim() === '') {
        throw new AppError('Pod name cannot be empty', 400);
      }
      const trimmedName = updateData.name.trim();
      if (trimmedName.length > 100) {
        throw new AppError('Pod name cannot exceed 100 characters', 400);
      }

      // If name is changing, check uniqueness
      if (trimmedName.toLowerCase() !== existingPod.name.toLowerCase()) {
        const duplicate = await podRepository.findByName(trimmedName);
        if (duplicate.data && duplicate.data.id !== id) {
          throw new AppError(`Pod with name '${trimmedName}' already exists`, 409);
        }
      }
      payload.name = trimmedName;
    }

    // 2. Validate description if updated
    if (updateData.description !== undefined) {
      payload.description = updateData.description ? updateData.description.trim() : null;
    }

    // 3. Validate lead_employee_id if updated
    if (updateData.lead_employee_id !== undefined) {
      if (updateData.lead_employee_id === null || updateData.lead_employee_id === '') {
        payload.lead_employee_id = null;
      } else {
        if (!this.validateUUID(updateData.lead_employee_id)) {
          throw new AppError('Invalid lead employee ID format', 400);
        }

        const { exists, employee } = await podRepository.checkEmployeeExists(updateData.lead_employee_id);
        if (!exists) {
          throw new AppError('Lead employee does not exist', 400);
        }
        if (employee.employment_status !== 'ACTIVE') {
          throw new AppError('Cannot assign an inactive employee as pod lead', 400);
        }
        payload.lead_employee_id = updateData.lead_employee_id.trim();
      }
    }

    if (Object.keys(payload).length === 0) {
      return existingPod;
    }

    const { data: updatedPod, error } = await podRepository.update(id, payload);
    if (error) {
      if (error.code === '23505') {
        throw new AppError('Pod name already exists', 409);
      }
      throw new AppError(`Failed to update pod: ${error.message}`, 500);
    }

    // Ensure lead employee's pod_id points to this pod and clear previous lead references
    if (payload.lead_employee_id) {
      await podRepository.assignEmployeeToPod(payload.lead_employee_id, id);
      await podRepository.clearOtherPodLeads(payload.lead_employee_id, id);
    }

    return this.formatPodResponse(updatedPod);
  }

  /**
   * Delete or deactivate a pod
   * Prevents deletion if ACTIVE employees are assigned to this pod
   * Allows deletion if pod has only inactive employees (safely unassigns them without deleting employee records)
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async deletePod(id) {
    if (!this.validateUUID(id)) {
      throw new AppError('Invalid pod ID format', 400);
    }

    // 1. Verify pod exists
    const pod = await this.getPodById(id);

    // 2. Check if any ACTIVE employees belong to this pod
    const activeCount = await podRepository.countActiveEmployees(id);
    if (activeCount > 0) {
      throw new AppError(
        `Cannot delete pod '${pod.name}'. It has ${activeCount} active assigned employee(s). Reassign or remove employees first.`,
        409,
        {
          code: 'POD_HAS_ACTIVE_EMPLOYEES',
          details: { activeEmployeeCount: activeCount, podId: id, podName: pod.name },
          suggestion: `Reassign the ${activeCount} active employee(s) to another operational pod or set them to Unassigned before deleting this pod.`,
        }
      );
    }

    // 3. Pod has only inactive employees (or 0 employees).
    // Safely unassign inactive employees so their records and historical rosters are completely preserved
    await podRepository.unassignInactiveEmployees(id);

    // 4. Safely clear lead_employee_id reference before deleting the pod
    await podRepository.clearPodLead(id);

    // 5. Delete the pod
    const { data: deletedPod, error } = await podRepository.delete(id);
    if (error) {
      if (error.code === '23503') {
        throw new AppError(`Cannot delete pod: foreign key constraint violation (${error.message})`, 409);
      }
      throw new AppError(`Failed to delete pod: ${error.message}`, 500);
    }

    return deletedPod || { id, name: pod.name };
  }
}

export const podService = new PodService();
export default podService;
