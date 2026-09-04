import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import * as payrollController from '../controllers/payroll.controller.js';

const router = Router();
router.use(requireAuth);

// Employee self endpoints (accessible by authenticated users/employees)
router.get('/me', payrollController.getMyPayroll);
router.get('/me/dashboard', payrollController.getMyDashboard);

// Dashboard analytics (Admin/HR only, org-scoped, no job id needed)
router.get('/dashboard', requireRole(['ADMIN', 'HR']), payrollController.getDashboard);

export default router;

