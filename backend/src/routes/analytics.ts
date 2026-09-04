import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import * as payrollController from '../controllers/payroll.controller.js';

const router = Router();
router.use(requireAuth);
router.use(requireRole(['ADMIN', 'HR']));

// GET /api/analytics/overview
router.get('/overview', payrollController.getAnalyticsOverview);

// GET /api/analytics/departments
router.get('/departments', payrollController.getDepartmentAnalytics);

// GET /api/analytics/weekly-trends
router.get('/weekly-trends', payrollController.getWeeklyTrendsAnalytics);

// GET /api/analytics/export/csv
router.get('/export/csv', payrollController.exportLatestCsv);

export default router;
