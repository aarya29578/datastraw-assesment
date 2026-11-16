import { exportService } from './export.service.js';

class ExportController {
  async exportRosterCSV(req, res, next) {
    try {
      const { id } = req.params;
      const { csvContent, filename } = await exportService.exportRosterToCSV(id);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.status(200).send(csvContent);
    } catch (error) {
      next(error);
    }
  }

  async exportConflictsCSV(req, res, next) {
    try {
      const { csvContent, filename } = await exportService.exportConflictsToCSV(req.query);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.status(200).send(csvContent);
    } catch (error) {
      next(error);
    }
  }

  async exportAssignmentsCSV(req, res, next) {
    try {
      const { csvContent, filename } = await exportService.exportAssignmentsToCSV(req.query);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.status(200).send(csvContent);
    } catch (error) {
      next(error);
    }
  }
}

export const exportController = new ExportController();
export default exportController;
