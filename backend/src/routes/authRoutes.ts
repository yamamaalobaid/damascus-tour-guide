import express from 'express';
import {
  register,
  login,
  getMe,
  updateDetails,
  forgotPassword,
} from '../controllers/authController';
import { protect } from '../middleware/auth';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.put('/updatedetails', protect, updateDetails);
router.post('/forgotpassword', forgotPassword);

export default router;