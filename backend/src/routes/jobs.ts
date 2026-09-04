import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import * as jobsController from '../controllers/jobs.controller.js';
import * as payrollController from '../controllers/payroll.controller.js';

const router = Router();

// Rate limiter for upload endpoint: 20 requests per 20 minutes per IP
export const uploadLimiter = rateLimit({
  windowMs: 20 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: 'Too many timesheet upload requests from this IP. Please try again after 20 minutes.',
    },
  },
});

// All jobs routes are protected by authentication and Admin/HR role
router.use(requireAuth);
router.use(requireRole(['ADMIN', 'HR']));

// Multer: memory storage, 50 MB limit, only csv/json accepted
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.csv', '.json'];
    const name = file.originalname.toLowerCase();
    if (allowed.some((ext) => name.endsWith(ext))) {
      cb(null, true);
    } else {
      cb(Object.assign(new Error(`Unsupported file type: ${file.originalname}. Only .csv and .json are accepted.`), { statusCode: 400 }) as unknown as null, false);
    }
  },
});

// POST /api/jobs/upload (rate-limited specifically to 20 requests / 20 mins)
router.post('/upload', uploadLimiter, upload.single('timesheet'), jobsController.upload);

// GET  /api/jobs
router.get('/', jobsController.listJobs);

// GET  /api/jobs/:id
router.get('/:id', jobsController.getJob);

// POST /api/jobs/:id/process  (reprocess)
router.post('/:id/process', jobsController.reprocess);
router.post('/:id/reprocess', jobsController.reprocess);

// ── Payroll sub-routes per job ────────────────────────────────────────────────

// GET  /api/jobs/:id/payroll
router.get('/:id/payroll', payrollController.getPayroll);

// GET  /api/jobs/:id/analytics
router.get('/:id/analytics', payrollController.getAnalytics);

// POST /api/jobs/:id/analytics/generate (regenerate after reprocess)
router.post('/:id/analytics/generate', payrollController.regenerateAnalytics);

// GET  /api/jobs/:id/employees/:employeeCode
router.get('/:id/employees/:employeeCode', payrollController.getEmployeeDetail);

// GET  /api/jobs/:id/export
router.get('/:id/export', payrollController.exportCsv);

export default router;
