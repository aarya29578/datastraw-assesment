import { brandRepository } from './brand.repository.js';
import { AppError } from '../../utils/appError.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_STATUSES = ['ACTIVE', 'INACTIVE'];

class BrandService {
  /**
   * Validate UUID string format
   * @param {string} id
   * @returns {boolean}
   */
  validateUUID(id) {
    return typeof id === 'string' && UUID_REGEX.test(id.trim());
  }

  /**
   * Format raw database brand row into structured response with derived and/or designated operational pods and processes
   * @param {Object} brand
   * @returns {Promise<Object>}
   */
  async formatBrandResponse(brand) {
    if (!brand) return null;

    // 1. Extract designated pod ID & process IDs from metadata tags in description (or fields if present)
    let designatedPodId = brand.pod_id || null;
    let designatedProcessIds = [];
    let cleanDescription = brand.description || null;

    if (cleanDescription && typeof cleanDescription === 'string') {
      const podMatch = cleanDescription.match(/<!--pod_id:([a-f0-9-]+)-->/i);
      if (podMatch) {
        if (!designatedPodId) designatedPodId = podMatch[1];
      }
      const procMatch = cleanDescription.match(/<!--process_ids:([a-f0-9-,]+)-->/i);
      if (procMatch && procMatch[1]) {
        designatedProcessIds = procMatch[1].split(',').map((id) => id.trim()).filter(Boolean);
      }
      cleanDescription = cleanDescription
        .replace(/\s*<!--pod_id:[a-f0-9-]+-->/i, '')
        .replace(/\s*<!--process_ids:[a-f0-9-,]+-->/i, '')
        .trim() || null;
    }

    // Also load from brand_processes table if provisioned
    const tableBrandProcs = await brandRepository.getBrandProcessesFromTable(brand.id);
    tableBrandProcs.forEach((tp) => {
      if (tp.process_id) designatedProcessIds.push(tp.process_id);
    });

    // 2. Extract operational pods from active employee assignments
    const activeAssignments = (brand.employee_assignments || []).filter(
      (a) => a.employee && a.employee.employment_status === 'ACTIVE'
    );

    const podMap = new Map();
    const assignedEmployeeIds = new Set();

    activeAssignments.forEach((asgn) => {
      const emp = asgn.employee;
      if (!emp) return;
      assignedEmployeeIds.add(emp.id);

      const pod = emp.pod;
      if (pod && pod.id) {
        if (!podMap.has(pod.id)) {
          podMap.set(pod.id, {
            id: pod.id,
            name: pod.name,
            employee_count: 0,
            employee_ids: new Set(),
          });
        }
        const podEntry = podMap.get(pod.id);
        if (!podEntry.employee_ids.has(emp.id)) {
          podEntry.employee_ids.add(emp.id);
          podEntry.employee_count += 1;
        }
      }
    });

    // 3. If a designated pod is configured, ensure it is included
    if (designatedPodId) {
      if (!podMap.has(designatedPodId)) {
        const { data: podRecord } = await brandRepository.findPodById(designatedPodId);
        if (podRecord) {
          podMap.set(designatedPodId, {
            id: podRecord.id,
            name: podRecord.name,
            employee_count: 0,
            employee_ids: new Set(),
          });
        }
      }
    }

    const pods = Array.from(podMap.values()).map((p) => ({
      id: p.id,
      name: p.name,
      employee_count: p.employee_count,
    }));

    // Determine primary pod: designatedPod first, else pod with most employees, else first pod
    let primaryPod = null;
    if (designatedPodId && podMap.has(designatedPodId)) {
      primaryPod = { id: designatedPodId, name: podMap.get(designatedPodId).name };
    } else if (pods.length > 0) {
      const sorted = [...pods].sort((a, b) => b.employee_count - a.employee_count);
      primaryPod = { id: sorted[0].id, name: sorted[0].name };
    }

    const podNames = pods.map((p) => p.name);

    // 4. Resolve associated processes (designated + working_rules + assignments)
    const procIdSet = new Set(designatedProcessIds);
    (brand.working_rules || []).forEach((r) => {
      if (r.process_id) procIdSet.add(r.process_id);
    });
    (brand.employee_assignments || []).forEach((a) => {
      if (a.process_id) procIdSet.add(a.process_id);
    });

    const uniqueProcessIds = Array.from(procIdSet);
    let processObjects = [];
    if (uniqueProcessIds.length > 0) {
      const { data: procs } = await brandRepository.getProcessesByIds(uniqueProcessIds);
      processObjects = procs || [];
    }

    return {
      id: brand.id,
      name: brand.name,
      description: cleanDescription,
      status: brand.status,
      pod_id: designatedPodId || primaryPod?.id || null,
      primary_pod: primaryPod,
      pods,
      pod_names: podNames,
      is_multi_pod: pods.length > 1,
      employee_count: assignedEmployeeIds.size,
      working_rules: brand.working_rules || [],
      assigned_processes: uniqueProcessIds,
      assignedProcesses: uniqueProcessIds,
      process_ids: uniqueProcessIds,
      processes: processObjects,
      created_at: brand.created_at,
      updated_at: brand.updated_at,
    };
  }

  /**
   * Create a new brand
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async createBrand(data) {
    const {
      name,
      description,
      status = 'ACTIVE',
      pod_id,
      assigned_processes,
      process_ids,
      assignedProcesses,
    } = data;

    // 1. Mandatory validation
    if (!name || typeof name !== 'string' || name.trim() === '') {
      throw new AppError('Brand name is required', 400);
    }

    const trimmedName = name.trim();
    if (trimmedName.length > 150) {
      throw new AppError('Brand name cannot exceed 150 characters', 400);
    }

    // 2. Prevent duplicate brand names
    const existingBrand = await brandRepository.findByName(trimmedName);
    if (existingBrand.data) {
      throw new AppError(`Brand with name '${trimmedName}' already exists`, 409);
    }

    // 3. Validate pod reference if provided by client
    let validatedPodId = null;
    if (pod_id) {
      if (!this.validateUUID(pod_id)) {
        throw new AppError('Invalid pod ID format', 400);
      }
      const podExists = await brandRepository.checkPodExists(pod_id);
      if (!podExists) {
        throw new AppError('Referenced pod does not exist', 400);
      }
      validatedPodId = pod_id;
    }

    // 4. Validate process IDs if provided
    const rawProcessIds = assigned_processes || process_ids || assignedProcesses || [];
    let validatedProcessIds = [];
    if (Array.isArray(rawProcessIds) && rawProcessIds.length > 0) {
      for (const pid of rawProcessIds) {
        if (!this.validateUUID(pid)) {
          throw new AppError(`Invalid process ID format: '${pid}'`, 400);
        }
        const proc = await brandRepository.checkProcessExists(pid);
        if (!proc) {
          throw new AppError(`Referenced process '${pid}' does not exist`, 400);
        }
        validatedProcessIds.push(pid);
      }
      validatedProcessIds = Array.from(new Set(validatedProcessIds));
    }

    // 5. Validate status
    const cleanStatus = typeof status === 'string' ? status.trim().toUpperCase() : 'ACTIVE';
    if (!VALID_STATUSES.includes(cleanStatus)) {
      throw new AppError("Invalid status. Allowed values are 'ACTIVE' or 'INACTIVE'", 400);
    }

    let cleanDesc = description ? description.trim() : '';
    cleanDesc = cleanDesc
      .replace(/\s*<!--pod_id:[a-f0-9-]+-->/i, '')
      .replace(/\s*<!--process_ids:[a-f0-9-,]+-->/i, '')
      .trim();

    const tags = [];
    if (validatedPodId) tags.push(`<!--pod_id:${validatedPodId}-->`);
    if (validatedProcessIds.length > 0) tags.push(`<!--process_ids:${validatedProcessIds.join(',')}-->`);

    const finalDescription = tags.length > 0
      ? (cleanDesc ? `${cleanDesc} ${tags.join(' ')}` : tags.join(' '))
      : (cleanDesc || null);

    const brandPayload = {
      name: trimmedName,
      description: finalDescription,
      status: cleanStatus,
    };

    const { data: createdBrand, error } = await brandRepository.create(brandPayload);
    if (error) {
      if (error.code === '23505') {
        throw new AppError(`Brand with name '${trimmedName}' already exists`, 409);
      }
      throw new AppError(`Failed to create brand: ${error.message}`, 500);
    }

    if (validatedProcessIds.length > 0) {
      await brandRepository.syncBrandProcessesTable(createdBrand.id, validatedProcessIds);
    }

    return this.formatBrandResponse(createdBrand);
  }

  /**
   * Retrieve all brands with optional search, status filtering, and pagination
   * @param {Object} query
   * @returns {Promise<{ brands: Array, pagination: Object }>}
   */
  async getAllBrands(query = {}) {
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

    if (query.pod_id && !this.validateUUID(query.pod_id)) {
      throw new AppError('Invalid pod ID format in query', 400);
    }

    const { data: brands, count, error } = await brandRepository.findAll({
      page,
      limit,
      search,
      status,
    });

    if (error) {
      throw new AppError(`Failed to retrieve brands: ${error.message}`, 500);
    }

    const formattedBrands = await Promise.all(
      brands.map((b) => this.formatBrandResponse(b))
    );

    let filteredList = formattedBrands;
    if (query.pod_id) {
      filteredList = formattedBrands.filter((b) =>
        b.pods.some((p) => p.id === query.pod_id) || b.pod_id === query.pod_id
      );
    }

    const totalCount = query.pod_id ? filteredList.length : count;
    const totalPages = Math.ceil(totalCount / limit) || 0;

    return {
      brands: filteredList,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * Retrieve a brand by ID
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async getBrandById(id) {
    if (!this.validateUUID(id)) {
      throw new AppError('Invalid brand ID format', 400);
    }

    const { data: brand, error } = await brandRepository.findById(id);
    if (error) {
      throw new AppError(`Failed to retrieve brand: ${error.message}`, 500);
    }
    if (!brand) {
      throw new AppError('Brand not found', 404);
    }

    return this.formatBrandResponse(brand);
  }

  /**
   * Update an existing brand
   * @param {string} id
   * @param {Object} updateData
   * @returns {Promise<Object>}
   */
  async updateBrand(id, updateData) {
    if (!this.validateUUID(id)) {
      throw new AppError('Invalid brand ID format', 400);
    }

    // Verify brand exists
    const existingBrandResult = await brandRepository.findById(id);
    if (existingBrandResult.error) {
      throw new AppError(`Failed to retrieve brand: ${existingBrandResult.error.message}`, 500);
    }
    if (!existingBrandResult.data) {
      throw new AppError('Brand not found', 404);
    }
    const existingBrand = existingBrandResult.data;

    const payload = {};

    // 1. Validate name if updated
    if (updateData.name !== undefined) {
      if (!updateData.name || typeof updateData.name !== 'string' || updateData.name.trim() === '') {
        throw new AppError('Brand name cannot be empty', 400);
      }
      const trimmedName = updateData.name.trim();
      if (trimmedName.length > 150) {
        throw new AppError('Brand name cannot exceed 150 characters', 400);
      }

      // If name is changing, check uniqueness
      if (trimmedName.toLowerCase() !== existingBrand.name.toLowerCase()) {
        const duplicate = await brandRepository.findByName(trimmedName);
        if (duplicate.data && duplicate.data.id !== id) {
          throw new AppError(`Brand with name '${trimmedName}' already exists`, 409);
        }
      }
      payload.name = trimmedName;
    }

    // 2. Validate status if updated
    if (updateData.status !== undefined) {
      const upperStatus = typeof updateData.status === 'string' ? updateData.status.trim().toUpperCase() : '';
      if (!VALID_STATUSES.includes(upperStatus)) {
        throw new AppError("Invalid status. Allowed values: 'ACTIVE', 'INACTIVE'", 400);
      }
      payload.status = upperStatus;
    }

    // 3. Handle pod_id
    let newPodId = undefined;
    if (updateData.pod_id !== undefined) {
      if (updateData.pod_id !== null && updateData.pod_id !== '') {
        if (!this.validateUUID(updateData.pod_id)) {
          throw new AppError('Invalid pod ID format', 400);
        }
        const podExists = await brandRepository.checkPodExists(updateData.pod_id);
        if (!podExists) {
          throw new AppError('Referenced pod does not exist', 400);
        }
        newPodId = updateData.pod_id;
      } else {
        newPodId = null; // explicit removal
      }
    }

    // 4. Handle process associations (assigned_processes, process_ids, or assignedProcesses)
    const rawProcessIds = updateData.assigned_processes !== undefined
      ? updateData.assigned_processes
      : (updateData.process_ids !== undefined
        ? updateData.process_ids
        : updateData.assignedProcesses);

    let validatedProcessIds = undefined;

    if (rawProcessIds !== undefined) {
      if (!Array.isArray(rawProcessIds)) {
        throw new AppError('Process associations must be an array of process IDs', 400);
      }

      const tempIds = [];
      for (const pid of rawProcessIds) {
        if (!this.validateUUID(pid)) {
          throw new AppError(`Invalid process ID format: '${pid}'`, 400);
        }
        const proc = await brandRepository.checkProcessExists(pid);
        if (!proc) {
          throw new AppError(`Referenced process '${pid}' does not exist`, 400);
        }
        tempIds.push(pid);
      }
      validatedProcessIds = Array.from(new Set(tempIds));

      // Check for removed / deselected processes that have dependent records!
      const currentAssociatedSet = new Set();
      const existingProcMatch = (existingBrand.description || '').match(/<!--process_ids:([a-f0-9-,]+)-->/i);
      if (existingProcMatch && existingProcMatch[1]) {
        existingProcMatch[1].split(',').filter(Boolean).forEach((pid) => currentAssociatedSet.add(pid.trim()));
      }
      (existingBrand.working_rules || []).forEach((r) => r.process_id && currentAssociatedSet.add(r.process_id));
      (existingBrand.employee_assignments || []).forEach((a) => a.process_id && currentAssociatedSet.add(a.process_id));

      const newProcessSet = new Set(validatedProcessIds);

      for (const oldProcId of currentAssociatedSet) {
        if (!newProcessSet.has(oldProcId)) {
          // Attempting to remove oldProcId: check if active assignments or working rules exist!
          const asgnCount = await brandRepository.countActiveAssignmentsForProcess(id, oldProcId);
          const ruleCount = await brandRepository.countActiveWorkingRulesForProcess(id, oldProcId);

          if (asgnCount > 0 || ruleCount > 0) {
            const procInfo = await brandRepository.checkProcessExists(oldProcId);
            const procName = procInfo?.name || oldProcId;
            const reasons = [];
            if (asgnCount > 0) reasons.push(`${asgnCount} active employee assignment(s)`);
            if (ruleCount > 0) reasons.push(`${ruleCount} active working rule(s)`);
            throw new AppError(
              `Cannot remove process '${procName}' from brand '${existingBrand.name}'. It is referenced by ${reasons.join(' and ')}. Reassign employees or remove working rules before unlinking this process.`,
              409,
              {
                code: 'PROCESS_HAS_DEPENDENT_RECORDS',
                brand_id: id,
                process_id: oldProcId,
                active_assignments: asgnCount,
                active_rules: ruleCount,
                suggestion: 'Reassign active specialists or decommission working rules before removing this process association.',
              }
            );
          }
        }
      }
    }

    // 5. Build description with metadata tags
    let currentDesc = updateData.description !== undefined
      ? (updateData.description ? updateData.description.trim() : '')
      : (existingBrand.description || '');

    currentDesc = currentDesc
      .replace(/\s*<!--pod_id:[a-f0-9-]+-->/i, '')
      .replace(/\s*<!--process_ids:[a-f0-9-,]+-->/i, '')
      .trim();

    // Determine effective pod_id
    let effectivePodId = null;
    if (newPodId !== undefined) {
      effectivePodId = newPodId;
    } else {
      const existingPodMatch = (existingBrand.description || '').match(/<!--pod_id:([a-f0-9-]+)-->/i);
      effectivePodId = existingPodMatch ? existingPodMatch[1] : null;
    }

    // Determine effective process_ids
    let effectiveProcessIds = [];
    if (validatedProcessIds !== undefined) {
      effectiveProcessIds = validatedProcessIds;
    } else {
      const existingProcMatch = (existingBrand.description || '').match(/<!--process_ids:([a-f0-9-,]+)-->/i);
      if (existingProcMatch && existingProcMatch[1]) {
        effectiveProcessIds = existingProcMatch[1].split(',').map((p) => p.trim()).filter(Boolean);
      } else {
        const set = new Set();
        (existingBrand.working_rules || []).forEach((r) => r.process_id && set.add(r.process_id));
        (existingBrand.employee_assignments || []).forEach((a) => a.process_id && set.add(a.process_id));
        effectiveProcessIds = Array.from(set);
      }
    }

    const tags = [];
    if (effectivePodId) tags.push(`<!--pod_id:${effectivePodId}-->`);
    if (effectiveProcessIds.length > 0) tags.push(`<!--process_ids:${effectiveProcessIds.join(',')}-->`);

    if (tags.length > 0) {
      payload.description = currentDesc ? `${currentDesc} ${tags.join(' ')}` : tags.join(' ');
    } else {
      payload.description = currentDesc || null;
    }

    const { data: updatedBrand, error } = await brandRepository.update(id, payload);
    if (error) {
      if (error.code === '23505') {
        throw new AppError('Brand name already exists', 409);
      }
      throw new AppError(`Failed to update brand: ${error.message}`, 500);
    }

    if (validatedProcessIds !== undefined) {
      await brandRepository.syncBrandProcessesTable(id, effectiveProcessIds);
    }

    return this.formatBrandResponse(updatedBrand);
  }

  /**
   * Delete or deactivate a brand
   * If permanent is true, or if brand is already INACTIVE with no dependent records, permanently removes it.
   * Otherwise, sets status to INACTIVE. Prevents action if active assignments or working rules exist.
   * @param {string} id
   * @param {Object} [options]
   * @param {boolean} [options.permanent=false]
   * @returns {Promise<Object>}
   */
  async deleteBrand(id, { permanent = false } = {}) {
    if (!this.validateUUID(id)) {
      throw new AppError('Invalid brand ID format', 400);
    }

    // Verify brand exists
    const brand = await this.getBrandById(id);

    // Check active assignments and working rules
    const activeAssignments = await brandRepository.countActiveAssignments(id);
    const activeWorkingRules = await brandRepository.countActiveWorkingRules(id);

    // If permanent deletion requested
    if (permanent) {
      if (activeAssignments > 0 || activeWorkingRules > 0) {
        const reasons = [];
        if (activeAssignments > 0) reasons.push(`${activeAssignments} active employee assignment(s)`);
        if (activeWorkingRules > 0) reasons.push(`${activeWorkingRules} active working rule(s)`);
        throw new AppError(
          `Cannot permanently delete brand '${brand.name}'. It is referenced by ${reasons.join(' and ')}. Reassign employees or remove working rules first.`,
          409,
          {
            code: 'BRAND_HAS_ACTIVE_DEPENDENCIES',
            details: { brandId: id, activeAssignments, activeWorkingRules },
            suggestion: `Reassign or remove dependent assignments and working rules before deleting this brand.`,
          }
        );
      }

      // Safe to permanently delete
      try {
        await brandRepository.syncBrandProcessesTable(id, []);
      } catch {
        // non-blocking
      }

      const { error } = await brandRepository.delete(id);
      if (error) {
        throw new AppError(`Failed to permanently delete brand: ${error.message}`, 500);
      }

      return {
        id,
        name: brand.name,
        deleted: true,
        permanent: true,
      };
    }

    // Standard soft-deactivation (permanent === false)
    if (brand.status === 'INACTIVE') {
      throw new AppError('Brand is already inactive', 409, {
        code: 'ALREADY_INACTIVE',
        details: { brandId: id, currentStatus: 'INACTIVE' },
        suggestion: 'This brand is already inactive. No further action is required.',
      });
    }

    // Standard soft-deactivation for ACTIVE brands
    if (activeAssignments > 0) {
      throw new AppError(
        `Cannot deactivate brand '${brand.name}'. It has ${activeAssignments} active employee assignment(s). Reassign employees before deactivating.`,
        409,
        {
          code: 'BRAND_HAS_ACTIVE_ASSIGNMENTS',
          details: { activeAssignmentsCount: activeAssignments },
          suggestion: `Reassign or remove the ${activeAssignments} active employee assignment(s) before deactivating this brand.`,
        }
      );
    }

    if (activeWorkingRules > 0) {
      throw new AppError(
        `Cannot deactivate brand '${brand.name}'. It has ${activeWorkingRules} active working rule(s). Archive or reconfigure rules first.`,
        409,
        {
          code: 'BRAND_HAS_ACTIVE_WORKING_RULES',
          details: { activeWorkingRulesCount: activeWorkingRules },
          suggestion: `Deactivate or reconfigure the ${activeWorkingRules} associated working rule(s) before deactivating this brand.`,
        }
      );
    }

    const { data: deactivatedBrand, error } = await brandRepository.update(id, {
      status: 'INACTIVE',
    });

    if (error) {
      throw new AppError(`Failed to deactivate brand: ${error.message}`, 500);
    }

    return this.formatBrandResponse(deactivatedBrand);
  }

  /**
   * Alias for backwards compatibility
   */
  async deactivateBrand(id, options = {}) {
    return this.deleteBrand(id, options);
  }
}

export const brandService = new BrandService();
export default brandService;
