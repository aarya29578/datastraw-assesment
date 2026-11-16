import { rosterService } from './roster.service.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';

class RosterController {
  async generateRoster(req, res, next) {
    try {
      const result = await rosterService.generateRoster(req.body);
      return successResponse(res, result, 'Monthly roster generated successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async getAllRosters(req, res, next) {
    try {
      const { rosters, pagination } = await rosterService.getAllRosters(req.query);
      return paginatedResponse(res, rosters, pagination, 'Rosters retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async getRosterById(req, res, next) {
    try {
      const { id } = req.params;
      const roster = await rosterService.getRosterById(id);
      return successResponse(res, roster, 'Roster retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async getRosterEntries(req, res, next) {
    try {
      const { id } = req.params;
      const entriesData = await rosterService.getRosterEntries(id, req.query);
      return successResponse(res, entriesData, 'Roster entries retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async updateRosterEntry(req, res, next) {
    try {
      const { id, entryId } = req.params;
      const updated = await rosterService.updateRosterEntry(id, entryId, req.body);
      return successResponse(res, updated, 'Roster entry updated successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async bulkUpdateEntries(req, res, next) {
    try {
      const { id } = req.params;
      const result = await rosterService.bulkUpdateEntries(id, req.body?.updates || []);
      return successResponse(res, result, 'Roster entries bulk updated successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async updateRosterStatus(req, res, next) {
    try {
      const { id } = req.params;
      const updated = await rosterService.updateRosterStatus(id, req.body?.status);
      return successResponse(res, updated, 'Roster status updated successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async getActiveCycle(req, res, next) {
    try {
      const cycle = await rosterService.getActiveCycle();
      return successResponse(res, cycle, 'Active roster cycle retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }
}

export const rosterController = new RosterController();
export default rosterController;
