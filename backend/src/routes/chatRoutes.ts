import express from 'express';
import { protect, authorize } from '../middleware/auth';
import {
  getUserChats,
  getChat,
  startChat,
  closeChat,
  getSupportChats,
  acceptSupportChat,
} from '../controllers/chatController';

const router = express.Router();

router.use(protect);

// محادثات المستخدم العادي
router.get('/', getUserChats);
router.get('/support', authorize('admin', 'agent'), getSupportChats);
router.get('/:id', getChat);
router.post('/', startChat);
router.put('/:id/close', closeChat);
router.put('/support/:id/accept', authorize('admin', 'agent'), acceptSupportChat);

export default router;