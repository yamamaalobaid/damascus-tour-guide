import express from 'express';
import {
  getPlaces,
  getPlace,
  createPlace,
  updatePlace,
  deletePlace,
} from '../controllers/placeController';
import { protect, authorize } from '../middleware/auth';

const router = express.Router();

router.route('/')
  .get(getPlaces)
  .post(protect, authorize('admin'), createPlace);

router.route('/:id')
  .get(getPlace)
  .put(protect, authorize('admin'), updatePlace)
  .delete(protect, authorize('admin'), deletePlace);

export default router;