import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import * as jobsController from '../controllers/jobs.controller.js';
import * as payrollController from '../controllers/payroll.controller.js';

const router = Router();

// All jobs routes are protected
router.use(requireAuth);

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

// POST /api/jobs/upload
router.post('/upload', upload.single('timesheet'), jobsController.upload);

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
