import { Notification, User } from '../models';
import emailService from './emailService';

class NotificationService {
  // إنشاء وإرسال إشعار
  async createAndSendNotification(
    userId: number,
    type: string,
    titleAr: string,
    titleEn: string,
    messageAr: string,
    messageEn: string,
    data?: any,
    sendPush: boolean = true
  ) {
    try {
      // حفظ الإشعار في قاعدة البيانات
      const notification = await Notification.create({
        userId,
        type,
        titleAr,
        titleEn,
        messageAr,
        messageEn,
        data: data || null, // استخدم JSON مباشرة
        isRead: false,
      });

      // إرسال إشعار push إذا كان مطلوباً
      if (sendPush) {
        await this.sendPushNotification(
          userId,
          titleAr,
          messageAr,
          data,
          type
        );
      }

      // إرسال بريد إلكتروني إذا كان النوع مهماً
      if (this.shouldSendEmail(type)) {
        await this.sendNotificationEmail(
          userId,
          titleAr,
          messageAr,
          data
        );
      }

      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  // إرسال إشعار push (محاكاة - في الإنتاج استخدم Firebase)
  private async sendPushNotification(
    userId: number,
    title: string,
    body: string,
    data?: any,
    type?: string
  ) {
    try {
      // في الوقت الحالي، فقط تسجيل الإشعار
      console.log(`📱 Push Notification for User ${userId}:`, {
        title,
        body,
        data,
        type,
        timestamp: new Date().toISOString(),
      });

      // في الإنتاج، استخدم هذا:
      // const devices = await UserDevice.findAll({ where: { userId } });
      // const tokens = devices.map(device => device.deviceToken);
      // if (tokens.length > 0) {
      //   await fcmService.sendToDevices(tokens, { title, body, data });
      // }
      
      return true;
    } catch (error) {
      console.error('Error sending push notification:', error);
      return false;
    }
  }

  // إرسال بريد إلكتروني للإشعار
  private async sendNotificationEmail(
    userId: number,
    title: string,
    message: string,
    data?: any
  ) {
    try {
      const user = await User.findByPk(userId);
      if (!user || !user.email) {
        return false;
      }

      await emailService.sendNotificationEmail(
        user.email,
        title,
        message,
        data?.actionUrl
      );

      return true;
    } catch (error) {
      console.error('Error sending notification email:', error);
      return false;
    }
  }

  // تحديد ما إذا كان يجب إرسال بريد إلكتروني
  private shouldSendEmail(type: string): boolean {
    const emailTypes = [
      'booking_confirmation',
      'booking_cancellation',
      'payment_success',
      'payment_failed',
      'account_verification',
      'password_reset',
      'important_alert'
    ];
    return emailTypes.includes(type);
  }

  // إرسال إشعارات جماعية
  async sendBulkNotifications(
    userIds: number[],
    type: string,
    titleAr: string,
    titleEn: string,
    messageAr: string,
    messageEn: string,
    data?: any
  ) {
    try {
      const notifications = [];
      
      for (const userId of userIds) {
        const notification = await this.createAndSendNotification(
          userId,
          type,
          titleAr,
          titleEn,
          messageAr,
          messageEn,
          data,
          true
        );
        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      console.error('Error sending bulk notifications:', error);
      throw error;
    }
  }

  // الحصول على إشعارات المستخدم
  async getUserNotifications(userId: number, limit: number = 20, offset: number = 0) {
    try {
      const { count, rows } = await Notification.findAndCountAll({
        where: { userId },
        order: [['createdAt', 'DESC']],
        limit,
        offset,
      });

      return {
        notifications: rows,
        total: count,
        unreadCount: await Notification.count({
          where: { userId, isRead: false },
        }),
      };
    } catch (error) {
      console.error('Error getting user notifications:', error);
      throw error;
    }
  }

  // تحديث حالة القراءة
  async markAsRead(notificationId: number, userId: number) {
    try {
      const notification = await Notification.findOne({
        where: { id: notificationId, userId },
      });

      if (notification && !notification.isRead) {
        await notification.update({
          isRead: true,
          readAt: new Date(),
        });
      }

      return notification;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  // تحديث جميع الإشعارات كمقروءة
  async markAllAsRead(userId: number) {
    try {
      await Notification.update(
        {
          isRead: true,
          readAt: new Date(),
        },
        {
          where: {
            userId,
            isRead: false,
          },
        }
      );

      return { success: true };
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  // إرسال إشعار تأكيد الحجز
  async sendBookingConfirmation(userId: number, bookingData: any) {
    return this.createAndSendNotification(
      userId,
      'booking',
      'تم تأكيد حجزك! ✅',
      'Booking Confirmed! ✅',
      `تم تأكيد حجزك رقم ${bookingData.bookingNumber} في ${bookingData.placeName}`,
      `Your booking ${bookingData.bookingNumber} at ${bookingData.placeName} has been confirmed`,
      {
        bookingId: bookingData.id,
        bookingNumber: bookingData.bookingNumber,
        placeName: bookingData.placeName,
        bookingDate: bookingData.bookingDate,
        totalAmount: bookingData.totalAmount,
        type: 'booking_confirmation',
        actionUrl: `/bookings/${bookingData.id}`,
      },
      true
    );
  }

  // إرسال إشعار انخفاض السعر
  async sendPriceAlert(userId: number, placeId: number, placeName: string, oldPrice: number, newPrice: number) {
    const priceDrop = ((oldPrice - newPrice) / oldPrice) * 100;
    
    return this.createAndSendNotification(
      userId,
      'alert',
      'انخفاض في الأسعار! 📉',
      'Price Drop Alert! 📉',
      `انخفض سعر ${placeName} من ${oldPrice} إلى ${newPrice} (${priceDrop.toFixed(1)}%)`,
      `Price for ${placeName} dropped from ${oldPrice} to ${newPrice} (${priceDrop.toFixed(1)}%)`,
      {
        placeId,
        placeName,
        oldPrice,
        newPrice,
        percentage: priceDrop,
        type: 'price_alert',
        actionUrl: `/places/${placeId}`,
      },
      true
    );
  }

  // إرسال إشعار تذكير بالحجز
  async sendBookingReminder(userId: number, bookingId: number, placeName: string, date: Date) {
    const daysUntil = Math.ceil((date.getTime() - new Date().getTime()) / (1000 * 3600 * 24));
    
    return this.createAndSendNotification(
      userId,
      'alert',
      'تذكير بالحجز ⏰',
      'Booking Reminder ⏰',
      `حجزك في ${placeName} بعد ${daysUntil} أيام`,
      `Your booking at ${placeName} is in ${daysUntil} days`,
      {
        bookingId,
        placeName,
        date: date.toISOString(),
        daysUntil,
        type: 'booking_reminder',
        actionUrl: `/bookings/${bookingId}`,
      },
      true
    );
  }

  // إرسال إشعار رسالة جديدة
  async sendNewMessageNotification(userId: number, senderName: string, messagePreview: string, chatId: number) {
    return this.createAndSendNotification(
      userId,
      'message',
      'رسالة جديدة 💬',
      'New Message 💬',
      `${senderName}: ${messagePreview}`,
      `${senderName}: ${messagePreview}`,
      {
        chatId,
        senderName,
        messagePreview,
        type: 'new_message',
        actionUrl: `/chats/${chatId}`,
      },
      true
    );
  }

  // إرسال إشعار مراجعة جديدة
  async sendNewReviewOnFavorite(userId: number, placeName: string, reviewerName: string, rating: number, placeId: number) {
    return this.createAndSendNotification(
      userId,
      'review',
      'مراجعة جديدة على مكانك المفضل ⭐',
      'New Review on Your Favorite Place ⭐',
      `${reviewerName} قام بتقييم ${placeName} ب ${rating} نجوم`,
      `${reviewerName} rated ${placeName} with ${rating} stars`,
      {
        placeId,
        placeName,
        reviewerName,
        rating,
        type: 'new_review',
        actionUrl: `/places/${placeId}#reviews`,
      },
      true
    );
  }

  // حذف إشعار
  async deleteNotification(notificationId: number, userId: number) {
    try {
      const result = await Notification.destroy({
        where: { id: notificationId, userId },
      });

      return { success: result > 0 };
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }

  // حذف جميع الإشعارات المقروءة
  async deleteReadNotifications(userId: number) {
    try {
      const result = await Notification.destroy({
        where: { userId, isRead: true },
      });

      return { success: true, deletedCount: result };
    } catch (error) {
      console.error('Error deleting read notifications:', error);
      throw error;
    }
  }

  // الحصول على عدد الإشعارات غير المقروءة
  async getUnreadCount(userId: number) {
    try {
      const count = await Notification.count({
        where: { userId, isRead: false },
      });

      return count;
    } catch (error) {
      console.error('Error getting unread count:', error);
      throw error;
    }
  }
}

export default new NotificationService();