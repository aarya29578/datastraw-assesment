import { workingRuleRepository } from './workingRule.repository.js';
import { AppError } from '../../utils/appError.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAY_MAP = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

class WorkingRuleService {
  validateUUID(id) {
    return typeof id === 'string' && UUID_REGEX.test(id.trim());
  }

  validateDate(dateStr) {
    return typeof dateStr === 'string' && DATE_REGEX.test(dateStr.trim());
  }

  /**
   * Normalize operating days array: converts string names or ints to sorted unique smallint[]
   * @param {Array} days
   * @returns {Array<number>}
   */
  normalizeOperatingDays(days) {
    if (!Array.isArray(days) || days.length === 0) {
      throw new AppError('Operating days must be a non-empty array', 400);
    }

    const intSet = new Set();
    for (const item of days) {
      if (typeof item === 'number' && Number.isInteger(item) && item >= 0 && item <= 6) {
        intSet.add(item);
      } else if (typeof item === 'string') {
        const clean = item.trim().toLowerCase();
        if (WEEKDAY_MAP[clean] !== undefined) {
          intSet.add(WEEKDAY_MAP[clean]);
        } else {
          const parsed = parseInt(clean, 10);
          if (!isNaN(parsed) && parsed >= 0 && parsed <= 6) {
            intSet.add(parsed);
          } else {
            throw new AppError(`Invalid weekday value: '${item}'. Use 0-6 or Day names ('Monday', etc.)`, 400);
          }
        }
      } else {
        throw new AppError(`Invalid weekday entry: ${item}`, 400);
      }
    }

    if (intSet.size === 0) {
      throw new AppError('At least one valid operating day (0-6) is required', 400);
    }

    return Array.from(intSet).sort((a, b) => a - b);
  }

  /**
   * Formats rule record by adding operating_day_names for frontend ease
   */
  formatRuleResponse(rule) {
    if (!rule) return null;
    const dayNames = (rule.operating_days || []).map((d) => WEEKDAY_NAMES[d] || `Day ${d}`);
    return {
      ...rule,
      operating_day_names: dayNames,
    };
  }

  /**
   * Create a new working rule
   */
  async createWorkingRule(data) {
    const {
      brand_id,
      process_id,
      operating_days,
      operates_on_public_holidays = false,
      required_staff_count = 1,
      effective_from,
      effective_to,
      is_active = true,
    } = data;

    // 1. Validate brand & process UUIDs
    if (!brand_id || !this.validateUUID(brand_id)) {
      throw new AppError('Valid brand ID is required', 400);
    }
    if (!process_id || !this.validateUUID(process_id)) {
      throw new AppError('Valid process ID is required', 400);
    }

    const { data: brand } = await workingRuleRepository.checkBrandExists(brand_id);
    if (!brand) throw new AppError('Referenced brand does not exist', 400);

    const { data: proc } = await workingRuleRepository.checkProcessExists(process_id);
    if (!proc) throw new AppError('Referenced process does not exist', 400);

    // 2. Validate operating days
    const normalizedDays = this.normalizeOperatingDays(operating_days);

    // 3. Validate staff count
    const staffCount = parseInt(required_staff_count, 10);
    if (isNaN(staffCount) || staffCount <= 0) {
      throw new AppError('Required staff count must be an integer greater than 0', 400, {
        code: 'INVALID_STAFF_COUNT',
        suggestion: 'Please specify a positive headcount requirement (1 or more staff members).',
      });
    }

    // 4. Validate effective dates
    const effectiveFromDate = effective_from ? effective_from.trim() : new Date().toISOString().split('T')[0];
    if (!this.validateDate(effectiveFromDate)) {
      throw new AppError('Effective from date must be in YYYY-MM-DD format', 400, {
        code: 'INVALID_DATE_FORMAT',
        suggestion: 'Please use the YYYY-MM-DD calendar date format.',
      });
    }

    let effectiveToDate = null;
    if (effective_to) {
      effectiveToDate = effective_to.trim();
      if (!this.validateDate(effectiveToDate)) {
        throw new AppError('Effective to date must be in YYYY-MM-DD format', 400, {
          code: 'INVALID_DATE_FORMAT',
          suggestion: 'Please use the YYYY-MM-DD calendar date format.',
        });
      }
      if (effectiveToDate < effectiveFromDate) {
        throw new AppError('Effective to date cannot be earlier than effective from date', 400, {
          code: 'INVALID_DATE_RANGE',
          details: { effective_from: effectiveFromDate, effective_to: effectiveToDate },
          suggestion: 'Ensure the rule end date occurs after or on the start date.',
        });
      }
    }

    const rulePayload = {
      brand_id,
      process_id,
      operating_days: normalizedDays,
      operates_on_public_holidays: Boolean(operates_on_public_holidays),
      required_staff_count: staffCount,
      effective_from: effectiveFromDate,
      effective_to: effectiveToDate,
      is_active: Boolean(is_active),
    };

    const { data: created, error } = await workingRuleRepository.create(rulePayload);
    if (error) {
      throw new AppError(`Failed to create working rule: ${error.message}`, 500);
    }

    return this.formatRuleResponse(created);
  }

  /**
   * Retrieve all working rules with filtering and pagination
   */
  async getAllWorkingRules(query = {}) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));

    const { brand_id, process_id, is_active, target_date } = query;

    if (brand_id && !this.validateUUID(brand_id)) throw new AppError('Invalid brand ID format', 400);
    if (process_id && !this.validateUUID(process_id)) throw new AppError('Invalid process ID format', 400);
    if (target_date && !this.validateDate(target_date)) throw new AppError('Invalid target date format', 400);

    let activeFilter = null;
    if (is_active !== undefined) {
      activeFilter = is_active === 'true' || is_active === true;
    }

    const { data: rules, count, error } = await workingRuleRepository.findAll({
      page,
      limit,
      brand_id,
      process_id,
      is_active: activeFilter,
      target_date,
    });

    if (error) throw new AppError(`Failed to retrieve working rules: ${error.message}`, 500);

    const formattedRules = (rules || []).map((r) => this.formatRuleResponse(r));
    const totalPages = Math.ceil(count / limit) || 0;

    return {
      working_rules: formattedRules,
      pagination: {
        total: count,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * Retrieve working rule by ID
   */
  async getWorkingRuleById(id) {
    if (!this.validateUUID(id)) throw new AppError('Invalid working rule ID format', 400);

    const { data: rule, error } = await workingRuleRepository.findById(id);
    if (error) throw new AppError(`Failed to retrieve working rule: ${error.message}`, 500);
    if (!rule) throw new AppError('Working rule not found', 404);

    return this.formatRuleResponse(rule);
  }

  /**
   * Update working rule details
   */
  async updateWorkingRule(id, updateData) {
    if (!this.validateUUID(id)) throw new AppError('Invalid working rule ID format', 400);
    const existing = await this.getWorkingRuleById(id);

    const payload = {};

    if (updateData.operating_days !== undefined) {
      payload.operating_days = this.normalizeOperatingDays(updateData.operating_days);
    }

    if (updateData.required_staff_count !== undefined) {
      const staffCount = parseInt(updateData.required_staff_count, 10);
      if (isNaN(staffCount) || staffCount <= 0) {
        throw new AppError('Required staff count must be greater than 0', 400);
      }
      payload.required_staff_count = staffCount;
    }

    if (updateData.operates_on_public_holidays !== undefined) {
      payload.operates_on_public_holidays = Boolean(updateData.operates_on_public_holidays);
    }

    if (updateData.effective_from !== undefined) {
      if (!this.validateDate(updateData.effective_from)) throw new AppError('Invalid effective_from date', 400);
      payload.effective_from = updateData.effective_from;
    }

    if (updateData.effective_to !== undefined) {
      if (updateData.effective_to === null || updateData.effective_to === '') {
        payload.effective_to = null;
      } else {
        if (!this.validateDate(updateData.effective_to)) throw new AppError('Invalid effective_to date', 400);
        const fromDate = payload.effective_from || existing.effective_from;
        if (updateData.effective_to < fromDate) {
          throw new AppError('Effective to date cannot be earlier than effective from date', 400);
        }
        payload.effective_to = updateData.effective_to;
      }
    }

    if (updateData.is_active !== undefined) {
      payload.is_active = Boolean(updateData.is_active);
    }

    const { data: updated, error } = await workingRuleRepository.update(id, payload);
    if (error) throw new AppError(`Failed to update working rule: ${error.message}`, 500);

    return this.formatRuleResponse(updated);
  }

  /**
   * Delete or soft-deactivate working rule
   */
  async deleteWorkingRule(id) {
    if (!this.validateUUID(id)) throw new AppError('Invalid working rule ID format', 400);
    await this.getWorkingRuleById(id);

    const { data: deleted, error } = await workingRuleRepository.delete(id);
    if (error) throw new AppError(`Failed to delete working rule: ${error.message}`, 500);

    return deleted || { id, message: 'Working rule deleted successfully' };
  }
}

export const workingRuleService = new WorkingRuleService();
export default workingRuleService;
