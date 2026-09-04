import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/signup  — public
router.post('/signup', authController.signup);

// POST /api/auth/login   — public
router.post('/login', authController.login);

// GET  /api/auth/me      — protected: restore session / validate token
router.get('/me', requireAuth, authController.me);

export default router;
