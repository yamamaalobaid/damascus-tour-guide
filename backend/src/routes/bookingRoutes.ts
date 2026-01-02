import express from 'express';
import { protect } from '../middleware/auth';
import {
  createBooking,
  getUserBookings,
  getBookingById,
  cancelBooking,
} from '../controllers/bookingController';

const router = express.Router();

router.use(protect);

router.get('/', getUserBookings);
router.get('/:id', getBookingById);
router.post('/', createBooking);
router.put('/:id/cancel', cancelBooking);

export default router;