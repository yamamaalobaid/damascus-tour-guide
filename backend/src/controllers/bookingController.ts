import { Request, Response } from 'express';
import { Booking, Place, User, PlaceImage } from '../models';
import emailService from '../services/emailService';
import { Op } from 'sequelize';

// إنشاء حجز جديد
export const createBooking = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const { placeId, serviceType, bookingDate, numberOfGuests, specialRequests } = req.body;

    // التحقق من الحقول المطلوبة
    if (!placeId || !serviceType || !bookingDate) {
      return res.status(400).json({
        success: false,
        message: 'المكان ونوع الخدمة وتاريخ الحجز مطلوبون',
      });
    }

    // التحقق من وجود المكان
    const place = await Place.findByPk(placeId);
    if (!place) {
      return res.status(404).json({
        success: false,
        message: 'المكان غير موجود',
      });
    }

    // التحقق من تاريخ الحجز
    const bookingDateObj = new Date(bookingDate);
    if (bookingDateObj < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'لا يمكن الحجز في تاريخ ماضي',
      });
    }

    // إنشاء رقم حجز فريد
    const bookingNumber = `DAM-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // حساب السعر
    let totalAmount = place.entryFee || 0;
    if (serviceType === 'hotel') {
      totalAmount = (place.entryFee || 10000) * (numberOfGuests || 1);
    }

    // إنشاء الحجز
    const bookingData: any = {
      bookingNumber,
      userId,
      placeId,
      serviceType,
      bookingDate: bookingDateObj,
      numberOfGuests: numberOfGuests || 1,
      totalAmount,
      currency: 'SYP',
      status: 'pending',
      paymentStatus: 'pending',
      specialRequests: specialRequests || null,
    };

    const booking = await Booking.create(bookingData);

    // إرسال بريد التأكيد
    try {
      // استخدم as any للوصول إلى الدالة
      const emailSvc = emailService as any;
      if (emailSvc.sendBookingConfirmationEmail) {
        await emailSvc.sendBookingConfirmationEmail(req.user.email, {
          bookingNumber: booking.bookingNumber,
          placeName: place.nameAr,
          bookingDate: booking.bookingDate,
          totalAmount: booking.totalAmount,
          currency: booking.currency,
          serviceType: booking.serviceType,
        });
      } else {
        // استخدم البديل
        await emailService.sendNotificationEmail(
          req.user.email,
          'تم تأكيد حجزك! ✅',
          `شكراً لحجزك في ${place.nameAr}. رقم حجزك هو ${booking.bookingNumber}.`,
          `/bookings/${booking.id}`
        );
      }
    } catch (emailError) {
      console.error('Failed to send booking confirmation email:', emailError);
    }

    res.status(201).json({
      success: true,
      message: 'تم إنشاء الحجز بنجاح',
      data: booking,
    });
  } catch (error: any) {
    console.error('Create booking error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء إنشاء الحجز',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// الحصول على حجوزات المستخدم
export const getUserBookings = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;

    const where: any = { userId };
    if (status) {
      where.status = status;
    }

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 10;
    const offset = (pageNum - 1) * limitNum;

    const { count, rows: bookings } = await Booking.findAndCountAll({
      where,
      include: [
        {
          model: Place,
          as: 'place',
          attributes: ['id', 'nameAr', 'nameEn', 'category', 'addressAr', 'addressEn', 'featuredImage'],
          include: [{
            model: PlaceImage,
            as: 'images',
            where: { isPrimary: true },
            required: false,
            limit: 1,
            attributes: ['id', 'imageUrl', 'captionAr', 'captionEn'],
          }]
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: limitNum,
      offset,
      distinct: true,
    });

    // تنسيق البيانات المرتجعة
    const formattedBookings = bookings.map(booking => {
      const bookingData = booking.toJSON() as any; // استخدم as any
      const place = bookingData.place;
      
      return {
        id: bookingData.id,
        bookingNumber: bookingData.bookingNumber,
        serviceType: bookingData.serviceType,
        bookingDate: bookingData.bookingDate,
        numberOfGuests: bookingData.numberOfGuests,
        totalAmount: bookingData.totalAmount,
        currency: bookingData.currency,
        status: bookingData.status,
        paymentStatus: bookingData.paymentStatus,
        specialRequests: bookingData.specialRequests,
        createdAt: bookingData.createdAt,
        place: {
          id: place?.id,
          nameAr: place?.nameAr,
          nameEn: place?.nameEn,
          category: place?.category,
          addressAr: place?.addressAr,
          addressEn: place?.addressEn,
          featuredImage: place?.featuredImage,
          mainImage: place?.images && place.images.length > 0 ? place.images[0] : null,
        }
      };
    });

    res.json({
      success: true,
      count,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(count / limitNum),
        hasNextPage: pageNum < Math.ceil(count / limitNum),
        hasPrevPage: pageNum > 1,
      },
      data: formattedBookings,
    });
  } catch (error: any) {
    console.error('Get user bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء جلب الحجوزات',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// الحصول على حجز محدد
export const getBookingById = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const booking = await Booking.findOne({
      where: { id, userId },
      include: [
        {
          model: Place,
          as: 'place',
          attributes: ['id', 'nameAr', 'nameEn', 'category', 'addressAr', 'addressEn', 
                      'latitude', 'longitude', 'contactPhone', 'contactEmail', 'website'],
          include: [
            {
              model: PlaceImage,
              as: 'images',
              attributes: ['id', 'imageUrl', 'captionAr', 'captionEn', 'isPrimary', 'displayOrder'],
              order: [['isPrimary', 'DESC'], ['displayOrder', 'ASC']],
              limit: 10,
            }
          ]
        }
      ],
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'الحجز غير موجود',
      });
    }

    res.json({
      success: true,
      data: booking,
    });
  } catch (error: any) {
    console.error('Get booking by id error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء جلب تفاصيل الحجز',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// تحديث الحجز (للمستخدم)
export const updateBooking = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { numberOfGuests, specialRequests } = req.body;

    const booking = await Booking.findOne({
      where: { 
        id, 
        userId,
        status: 'pending' // يمكن تحديث الحجوزات المعلقة فقط
      },
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'الحجز غير موجود أو غير قابل للتعديل',
      });
    }

    // التحقق من وقت التعديل (قبل 48 ساعة على الأقل)
    const bookingDate = new Date(booking.bookingDate);
    const now = new Date();
    const hoursUntilBooking = (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilBooking < 48) {
      return res.status(400).json({
        success: false,
        message: 'لا يمكن تعديل الحجز قبل أقل من 48 ساعة من الموعد',
      });
    }

    // تحديث البيانات
    const updateData: any = {};
    if (numberOfGuests !== undefined) {
      updateData.numberOfGuests = numberOfGuests;
      
      // إعادة حساب السعر إذا تغير عدد الضيوف
      if (booking.serviceType === 'hotel') {
        const place = await Place.findByPk(booking.placeId);
        if (place) {
          updateData.totalAmount = (place.entryFee || 10000) * numberOfGuests;
        }
      }
    }
    
    if (specialRequests !== undefined) {
      updateData.specialRequests = specialRequests || null;
    }

    await booking.update(updateData);

    res.json({
      success: true,
      message: 'تم تحديث الحجز بنجاح',
      data: booking,
    });
  } catch (error: any) {
    console.error('Update booking error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء تحديث الحجز',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// إلغاء الحجز
export const cancelBooking = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { cancellationReason } = req.body;

    const booking = await Booking.findOne({
      where: { 
        id, 
        userId, 
        status: { [Op.in]: ['pending', 'confirmed'] } 
      },
      include: [{
        model: Place,
        as: 'place',
        attributes: ['nameAr', 'nameEn']
      }]
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'الحجز غير موجود أو غير قابل للإلغاء',
      });
    }

    // التحقق من وقت الإلغاء (قبل 24 ساعة على الأقل)
    const bookingDate = new Date(booking.bookingDate);
    const now = new Date();
    const hoursUntilBooking = (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilBooking < 24) {
      return res.status(400).json({
        success: false,
        message: 'لا يمكن إلغاء الحجز قبل أقل من 24 ساعة من الموعد',
      });
    }

    // إلغاء الحجز
    const updateData: any = {
      status: 'cancelled',
      cancellationReason: cancellationReason || null,
      cancelledAt: new Date(),
    };

    await booking.update(updateData);

    // إرسال بريد إلغاء الحجز
    try {
      // استخدم as any للوصول إلى place
      const bookingWithPlace = booking as any;
      await emailService.sendNotificationEmail(
        req.user.email,
        'تم إلغاء حجزك 🚫',
        `تم إلغاء حجزك رقم ${booking.bookingNumber} في ${bookingWithPlace.place?.nameAr || 'المكان'}.`,
        `/bookings/${booking.id}`
      );
    } catch (emailError) {
      console.error('Failed to send cancellation email:', emailError);
    }

    res.json({
      success: true,
      message: 'تم إلغاء الحجز بنجاح',
      data: booking,
    });
  } catch (error: any) {
    console.error('Cancel booking error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء إلغاء الحجز',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// تأكيد الحجز (للمسؤولين أو عند الدفع)
export const confirmBooking = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { paymentMethod, transactionId } = req.body;

    const booking = await Booking.findByPk(id, {
      include: [{
        model: User,
        as: 'user',
        attributes: ['email', 'firstName', 'lastName']
      }]
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'الحجز غير موجود',
      });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'الحجز غير قابل للتأكيد',
      });
    }

    // تأكيد الحجز
    const updateData: any = {
      status: 'confirmed',
      paymentStatus: 'paid',
      paymentMethod: paymentMethod || 'cash',
      transactionId: transactionId || null,
      confirmedAt: new Date(),
    };

    await booking.update(updateData);

    // إرسال بريد التأكيد
    try {
      const place = await Place.findByPk(booking.placeId);
      // استخدم as any للوصول إلى user
      const bookingWithUser = booking as any;
      if (place && bookingWithUser.user?.email) {
        await emailService.sendNotificationEmail(
          bookingWithUser.user.email,
          'تم تأكيد حجزك! ✅',
          `تم تأكيد حجزك رقم ${booking.bookingNumber} في ${place.nameAr}.`,
          `/bookings/${booking.id}`
        );
      }
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
    }

    res.json({
      success: true,
      message: 'تم تأكيد الحجز بنجاح',
      data: booking,
    });
  } catch (error: any) {
    console.error('Confirm booking error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء تأكيد الحجز',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// إتمام الحجز (بعد الزيارة)
export const completeBooking = async (req: any, res: Response) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findByPk(id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'الحجز غير موجود',
      });
    }

    if (booking.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        message: 'الحجز غير قابل للإتمام',
      });
    }

    // التحقق من أن تاريخ الحجز قد مضى
    const bookingDate = new Date(booking.bookingDate);
    const now = new Date();
    
    if (bookingDate > now) {
      return res.status(400).json({
        success: false,
        message: 'لا يمكن إتمام الحجز قبل تاريخه',
      });
    }

    // إتمام الحجز - استخدم as any لتجاوز مشكلة TypeScript
    const updateData: any = {
      status: 'completed',
      completedAt: new Date(),
    };

    await booking.update(updateData);

    res.json({
      success: true,
      message: 'تم إتمام الحجز بنجاح',
      data: booking,
    });
  } catch (error: any) {
    console.error('Complete booking error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء إتمام الحجز',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// الحصول على جميع الحجوزات (للمسؤولين)
export const getAllBookings = async (req: any, res: Response) => {
  try {
    const { 
      status, 
      page = 1, 
      limit = 20, 
      startDate, 
      endDate,
      userId,
      placeId 
    } = req.query;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (userId) {
      where.userId = userId;
    }

    if (placeId) {
      where.placeId = placeId;
    }

    // فلترة حسب التاريخ
    if (startDate || endDate) {
      where.bookingDate = {};
      if (startDate) {
        where.bookingDate[Op.gte] = new Date(startDate as string);
      }
      if (endDate) {
        where.bookingDate[Op.lte] = new Date(endDate as string);
      }
    }

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const offset = (pageNum - 1) * limitNum;

    const { count, rows: bookings } = await Booking.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'firstName', 'lastName', 'phone']
        },
        {
          model: Place,
          as: 'place',
          attributes: ['id', 'nameAr', 'nameEn', 'category']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: limitNum,
      offset,
      distinct: true,
    });

    // الإحصائيات
    const stats = {
      total: await Booking.count(),
      pending: await Booking.count({ where: { status: 'pending' } }),
      confirmed: await Booking.count({ where: { status: 'confirmed' } }),
      completed: await Booking.count({ where: { status: 'completed' } }),
      cancelled: await Booking.count({ where: { status: 'cancelled' } }),
      totalRevenue: await Booking.sum('totalAmount', { 
        where: { 
          status: 'confirmed', 
          paymentStatus: 'paid' 
        } 
      }) || 0,
    };

    res.json({
      success: true,
      count,
      stats,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(count / limitNum),
      },
      data: bookings,
    });
  } catch (error: any) {
    console.error('Get all bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء جلب الحجوزات',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};