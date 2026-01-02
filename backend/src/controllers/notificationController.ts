import { Request, Response } from 'express';
import notificationService from '../services/notificationService';

// الحصول على إشعارات المستخدم
export const getUserNotifications = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, unreadOnly } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    
    const result = await notificationService.getUserNotifications(
      userId,
      parseInt(limit as string),
      offset
    );

    // تصفية الإشعارات غير المقروءة فقط إذا طُلب ذلك
    let filteredNotifications = result.notifications;
    if (unreadOnly === 'true') {
      filteredNotifications = result.notifications.filter((n: any) => !n.isRead);
    }

    res.json({
      success: true,
      data: {
        notifications: filteredNotifications,
        total: result.total,
        unreadCount: result.unreadCount,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          totalPages: Math.ceil(result.total / parseInt(limit as string)),
        },
      },
    });
  } catch (error: any) {
    console.error('Get user notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء جلب الإشعارات',
    });
  }
};

// تحديث الإشعار كمقروء
export const markAsRead = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notification = await notificationService.markAsRead(
      parseInt(id),
      userId
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'الإشعار غير موجود',
      });
    }

    res.json({
      success: true,
      message: 'تم تحديث حالة الإشعار',
      data: notification,
    });
  } catch (error: any) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء تحديث الإشعار',
    });
  }
};

// تحديث جميع الإشعارات كمقروءة
export const markAllAsRead = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;

    await notificationService.markAllAsRead(userId);

    res.json({
      success: true,
      message: 'تم تحديث جميع الإشعارات كمقروءة',
    });
  } catch (error: any) {
    console.error('Mark all as read error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء تحديث الإشعارات',
    });
  }
};

// الحصول على عدد الإشعارات غير المقروءة
export const getUnreadCount = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;

    const count = await notificationService.getUnreadCount(userId);

    res.json({
      success: true,
      data: { count },
    });
  } catch (error: any) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء جلب عدد الإشعارات',
    });
  }
};

// حذف إشعار
export const deleteNotification = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await notificationService.deleteNotification(
      parseInt(id),
      userId
    );

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: 'الإشعار غير موجود',
      });
    }

    res.json({
      success: true,
      message: 'تم حذف الإشعار',
    });
  } catch (error: any) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء حذف الإشعار',
    });
  }
};

// حذف جميع الإشعارات المقروءة
export const deleteReadNotifications = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;

    const result = await notificationService.deleteReadNotifications(userId);

    res.json({
      success: true,
      message: `تم حذف ${result.deletedCount} إشعار`,
      data: result,
    });
  } catch (error: any) {
    console.error('Delete read notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء حذف الإشعارات',
    });
  }
};

// إرسال إشعار تجريبي (للتطوير فقط)
export const sendTestNotification = async (req: any, res: Response) => {
  try {
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({
        success: false,
        message: 'هذه الميزة متاحة فقط في بيئة التطوير',
      });
    }

    const userId = req.user.id;
    const { type, titleAr, messageAr } = req.body;

    const notification = await notificationService.createAndSendNotification(
      userId,
      type || 'system',
      titleAr || 'إشعار تجريبي',
      'Test Notification',
      messageAr || 'هذا إشعار تجريبي لاختبار النظام',
      'This is a test notification',
      {
        test: true,
        timestamp: new Date().toISOString(),
        actionUrl: '/notifications',
      },
      true
    );

    res.json({
      success: true,
      message: 'تم إرسال الإشعار التجريبي',
      data: notification,
    });
  } catch (error: any) {
    console.error('Send test notification error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء إرسال الإشعار التجريبي',
    });
  }
};