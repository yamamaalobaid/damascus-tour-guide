import { Request, Response } from 'express';
import { Itinerary, ItineraryDay, ItineraryItem, Place, User } from '../models';
import { Op } from 'sequelize';

// =============================================
// دوال مساعدة لإنشاء السجلات
// =============================================

/**
 * دالة مساعدة لإنشاء مسار سياحي
 */
const createItineraryRecord = async (itineraryData: {
  userId: number;
  titleAr: string;
  titleEn?: string | null;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  startDate: Date;
  endDate: Date;
  isPublic?: boolean;
}): Promise<Itinerary> => {
  const fullItineraryData = {
    ...itineraryData,
    likesCount: 0,
    viewsCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  return await Itinerary.create(fullItineraryData as any);
};

/**
 * دالة مساعدة لإنشاء يوم في المسار
 */
const createItineraryDayRecord = async (dayData: {
  itineraryId: number;
  dayNumber: number;
  date: Date;
  titleAr?: string | null;
  titleEn?: string | null;
  notes?: string | null;
}): Promise<ItineraryDay> => {
  const fullDayData = {
    ...dayData,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  return await ItineraryDay.create(fullDayData as any);
};

/**
 * دالة مساعدة لإنشاء عنصر في يوم المسار
 */
const createItineraryItemRecord = async (itemData: {
  itineraryDayId: number;
  placeId: number;
  startTime?: Date | null;
  endTime?: Date | null;
  transportMode?: string | null;
  notes?: string | null;
  orderIndex?: number;
}): Promise<ItineraryItem> => {
  const fullItemData = {
    ...itemData,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  return await ItineraryItem.create(fullItemData as any);
};

// =============================================
// دوال التحكم
// =============================================

// إنشاء مسار سياحي
export const createItinerary = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const { titleAr, titleEn, descriptionAr, descriptionEn, startDate, endDate, isPublic, days } = req.body;

    // التحقق من الحقول المطلوبة
    if (!titleAr || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'العنوان وتواريخ البداية والنهاية مطلوبة',
      });
    }

    // التحقق من صحة التواريخ
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    
    if (startDateObj > endDateObj) {
      return res.status(400).json({
        success: false,
        message: 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية',
      });
    }

    // إنشاء المسار باستخدام الدالة المساعدة
    const itinerary = await createItineraryRecord({
      userId,
      titleAr,
      titleEn: titleEn || null,
      descriptionAr: descriptionAr || null,
      descriptionEn: descriptionEn || null,
      startDate: startDateObj,
      endDate: endDateObj,
      isPublic: isPublic || false,
    });

    // إنشاء أيام المسار إذا تم توفيرها
    if (days && Array.isArray(days)) {
      for (const dayData of days) {
        const dayDate = dayData.date 
          ? new Date(dayData.date)
          : new Date(startDateObj.getTime() + (dayData.dayNumber - 1) * 24 * 60 * 60 * 1000);
        
        // إنشاء اليوم باستخدام الدالة المساعدة
        const day = await createItineraryDayRecord({
          itineraryId: itinerary.id,
          dayNumber: dayData.dayNumber,
          date: dayDate,
          titleAr: dayData.titleAr || null,
          titleEn: dayData.titleEn || null,
          notes: dayData.notes || null,
        });

        // إنشاء عناصر اليوم إذا تم توفيرها
        if (dayData.items && Array.isArray(dayData.items)) {
          for (const itemData of dayData.items) {
            await createItineraryItemRecord({
              itineraryDayId: day.id,
              placeId: itemData.placeId,
              startTime: itemData.startTime ? new Date(itemData.startTime) : null,
              endTime: itemData.endTime ? new Date(itemData.endTime) : null,
              transportMode: itemData.transportMode || null,
              notes: itemData.notes || null,
              orderIndex: itemData.orderIndex || 0,
            });
          }
        }
      }
    }

    // جلب المسار مع بياناته الكاملة
    const fullItinerary = await Itinerary.findByPk(itinerary.id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'avatarUrl']
        },
        {
          model: ItineraryDay,
          as: 'days',
          include: [{
            model: ItineraryItem,
            as: 'items',
            include: [{
              model: Place,
              as: 'place',
              attributes: ['id', 'nameAr', 'nameEn', 'category']
            }]
          }]
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'تم إنشاء المسار السياحي بنجاح',
      data: fullItinerary,
    });
  } catch (error: any) {
    console.error('Create itinerary error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء إنشاء المسار السياحي',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// الحصول على مسارات المستخدم
export const getUserItineraries = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, isPublic } = req.query;

    const where: any = { userId };
    if (isPublic !== undefined) {
      where.isPublic = isPublic === 'true';
    }

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const { count, rows: itineraries } = await Itinerary.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'avatarUrl']
        },
        {
          model: ItineraryDay,
          as: 'days',
          include: [{
            model: ItineraryItem,
            as: 'items',
            include: [{
              model: Place,
              as: 'place',
              attributes: ['id', 'nameAr', 'nameEn', 'category']
            }]
          }]
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit as string),
      offset,
    });

    res.json({
      success: true,
      count,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        totalPages: Math.ceil(count / parseInt(limit as string)),
      },
      data: itineraries,
    });
  } catch (error: any) {
    console.error('Get user itineraries error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء جلب المسارات',
    });
  }
};

// الحصول على مسارات عامة
export const getPublicItineraries = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, search } = req.query;

    const where: any = { isPublic: true };
    if (search) {
      where[Op.or] = [
        { titleAr: { [Op.like]: `%${search}%` } },
        { titleEn: { [Op.like]: `%${search}%` } },
        { descriptionAr: { [Op.like]: `%${search}%` } },
        { descriptionEn: { [Op.like]: `%${search}%` } },
      ];
    }

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const { count, rows: itineraries } = await Itinerary.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'avatarUrl']
        },
        {
          model: ItineraryDay,
          as: 'days',
          limit: 1,
          order: [['dayNumber', 'ASC']],
          separate: true,
        }
      ],
      order: [['likesCount', 'DESC'], ['viewsCount', 'DESC']],
      limit: parseInt(limit as string),
      offset,
    });

    res.json({
      success: true,
      count,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        totalPages: Math.ceil(count / parseInt(limit as string)),
      },
      data: itineraries,
    });
  } catch (error: any) {
    console.error('Get public itineraries error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء جلب المسارات العامة',
    });
  }
};

// الحصول على مسار محدد
export const getItinerary = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const itinerary = await Itinerary.findByPk(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'avatarUrl']
        },
        {
          model: ItineraryDay,
          as: 'days',
          include: [{
            model: ItineraryItem,
            as: 'items',
            include: [{
              model: Place,
              as: 'place',
              attributes: ['id', 'nameAr', 'nameEn', 'category', 'address', 'latitude', 'longitude']
            }],
            order: [['orderIndex', 'ASC']]
          }],
          order: [['dayNumber', 'ASC']]
        }
      ]
    });

    if (!itinerary) {
      return res.status(404).json({
        success: false,
        message: 'المسار غير موجود',
      });
    }

    // زيادة عدد المشاهدات إذا كان المسار عاماً
    if (itinerary.isPublic) {
      await itinerary.update({ viewsCount: (itinerary.viewsCount || 0) + 1 });
    }

    res.json({
      success: true,
      data: itinerary,
    });
  } catch (error: any) {
    console.error('Get itinerary error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء جلب المسار',
    });
  }
};

// تحديث مسار
export const updateItinerary = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const updateData = req.body;

    const itinerary = await Itinerary.findOne({
      where: {
        id,
        userId,
      },
    });

    if (!itinerary) {
      return res.status(404).json({
        success: false,
        message: 'المسار غير موجود أو ليس لديك صلاحية التعديل',
      });
    }

    // التحقق من التواريخ إذا تم تحديثها
    if (updateData.startDate || updateData.endDate) {
      const startDate = updateData.startDate ? new Date(updateData.startDate) : itinerary.startDate;
      const endDate = updateData.endDate ? new Date(updateData.endDate) : itinerary.endDate;
      
      if (startDate > endDate) {
        return res.status(400).json({
          success: false,
          message: 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية',
        });
      }
    }

    await itinerary.update(updateData);

    res.json({
      success: true,
      message: 'تم تحديث المسار بنجاح',
      data: itinerary,
    });
  } catch (error: any) {
    console.error('Update itinerary error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء تحديث المسار',
    });
  }
};

// حذف مسار
export const deleteItinerary = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const itinerary = await Itinerary.findOne({
      where: {
        id,
        userId,
      },
    });

    if (!itinerary) {
      return res.status(404).json({
        success: false,
        message: 'المسار غير موجود أو ليس لديك صلاحية الحذف',
      });
    }

    await itinerary.destroy();

    res.json({
      success: true,
      message: 'تم حذف المسار بنجاح',
    });
  } catch (error: any) {
    console.error('Delete itinerary error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء حذف المسار',
    });
  }
};

// زيادة عدد الإعجابات
export const likeItinerary = async (req: any, res: Response) => {
  try {
    const { id } = req.params;

    const itinerary = await Itinerary.findByPk(id);

    if (!itinerary) {
      return res.status(404).json({
        success: false,
        message: 'المسار غير موجود',
      });
    }

    if (!itinerary.isPublic) {
      return res.status(403).json({
        success: false,
        message: 'لا يمكن الإعجاب بمسار خاص',
      });
    }

    await itinerary.update({
      likesCount: (itinerary.likesCount || 0) + 1,
    });

    res.json({
      success: true,
      message: 'تم تسجيل إعجابك بالمسار',
      data: { likesCount: itinerary.likesCount + 1 },
    });
  } catch (error: any) {
    console.error('Like itinerary error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء تسجيل الإعجاب',
    });
  }
};

// إضافة يوم إلى مسار
export const addDayToItinerary = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { dayNumber, date, titleAr, titleEn, notes } = req.body;

    // التحقق من وجود المسار وصلاحية المستخدم
    const itinerary = await Itinerary.findOne({
      where: {
        id,
        userId,
      },
    });

    if (!itinerary) {
      return res.status(404).json({
        success: false,
        message: 'المسار غير موجود أو ليس لديك صلاحية التعديل',
      });
    }

    // إنشاء اليوم الجديد باستخدام الدالة المساعدة
    const day = await createItineraryDayRecord({
      itineraryId: parseInt(id),
      dayNumber,
      date: date ? new Date(date) : new Date(itinerary.startDate.getTime() + (dayNumber - 1) * 24 * 60 * 60 * 1000),
      titleAr: titleAr || null,
      titleEn: titleEn || null,
      notes: notes || null,
    });

    res.status(201).json({
      success: true,
      message: 'تم إضافة اليوم إلى المسار',
      data: day,
    });
  } catch (error: any) {
    console.error('Add day error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء إضافة اليوم',
    });
  }
};

// إضافة عنصر إلى يوم المسار
export const addItemToDay = async (req: any, res: Response) => {
  try {
    const { dayId } = req.params;
    const userId = req.user.id;
    const { placeId, startTime, endTime, transportMode, notes, orderIndex } = req.body;

    // التحقق من وجود اليوم وصلاحية المستخدم
    const day = await ItineraryDay.findByPk(dayId, {
      include: [{
        model: Itinerary,
        as: 'itinerary',
        where: { userId }
      }]
    });

    if (!day) {
      return res.status(404).json({
        success: false,
        message: 'اليوم غير موجود أو ليس لديك صلاحية التعديل',
      });
    }

    // إنشاء العنصر الجديد باستخدام الدالة المساعدة
    const item = await createItineraryItemRecord({
      itineraryDayId: parseInt(dayId),
      placeId,
      startTime: startTime ? new Date(startTime) : null,
      endTime: endTime ? new Date(endTime) : null,
      transportMode: transportMode || null,
      notes: notes || null,
      orderIndex: orderIndex || 0,
    });

    res.status(201).json({
      success: true,
      message: 'تم إضافة العنصر إلى اليوم',
      data: item,
    });
  } catch (error: any) {
    console.error('Add item error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء إضافة العنصر',
    });
  }
};