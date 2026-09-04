import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as payrollController from '../controllers/payroll.controller.js';

const router = Router();
router.use(requireAuth);

// Dashboard analytics (org-scoped, no job id needed)
router.get('/dashboard', payrollController.getDashboard);

export default router;
