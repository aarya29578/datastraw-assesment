import { Router } from 'express';
import { availabilityController } from './availability.controller.js';

const router = Router();

// ==========================================
// 1. Weekly Offs (/api/availability/weekly-offs)
// ==========================================
router.post('/weekly-offs', (req, res, next) => availabilityController.createWeeklyOff(req, res, next));
router.get('/weekly-offs', (req, res, next) => availabilityController.getAllWeeklyOffs(req, res, next));
router.get('/weekly-offs/:id', (req, res, next) => availabilityController.getWeeklyOffById(req, res, next));
router.put('/weekly-offs/:id', (req, res, next) => availabilityController.updateWeeklyOff(req, res, next));
router.delete('/weekly-offs/:id', (req, res, next) => availabilityController.deleteWeeklyOff(req, res, next));

// ==========================================
// 2. Leaves (/api/availability/leaves)
// ==========================================
router.post('/leaves', (req, res, next) => availabilityController.createLeave(req, res, next));
router.get('/leaves', (req, res, next) => availabilityController.getAllLeaves(req, res, next));
router.get('/leaves/:id', (req, res, next) => availabilityController.getLeaveById(req, res, next));
router.put('/leaves/:id', (req, res, next) => availabilityController.updateLeave(req, res, next));
router.patch('/leaves/:id/approve', (req, res, next) => availabilityController.approveLeave(req, res, next));
router.patch('/leaves/:id/reject', (req, res, next) => availabilityController.rejectLeave(req, res, next));
router.patch('/leaves/:id/cancel', (req, res, next) => availabilityController.cancelLeave(req, res, next));

// ==========================================
// 3. Comp-Offs (/api/availability/comp-offs)
// ==========================================
router.post('/comp-offs', (req, res, next) => availabilityController.createCompOff(req, res, next));
router.get('/comp-offs', (req, res, next) => availabilityController.getAllCompOffs(req, res, next));
router.get('/comp-offs/:id', (req, res, next) => availabilityController.getCompOffById(req, res, next));
router.put('/comp-offs/:id', (req, res, next) => availabilityController.updateCompOff(req, res, next));
router.patch('/comp-offs/:id/approve', (req, res, next) => availabilityController.approveCompOff(req, res, next));
router.patch('/comp-offs/:id/reject', (req, res, next) => availabilityController.rejectCompOff(req, res, next));

// ==========================================
// 4. Public Holidays (/api/availability/holidays)
// ==========================================
router.post('/holidays', (req, res, next) => availabilityController.createHoliday(req, res, next));
router.get('/holidays', (req, res, next) => availabilityController.getAllHolidays(req, res, next));
router.get('/holidays/:id', (req, res, next) => availabilityController.getHolidayById(req, res, next));
router.put('/holidays/:id', (req, res, next) => availabilityController.updateHoliday(req, res, next));
router.delete('/holidays/:id', (req, res, next) => availabilityController.deleteHoliday(req, res, next));

export default router;
