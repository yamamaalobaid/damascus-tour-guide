import { Request, Response } from 'express';
import { Op, Sequelize } from 'sequelize';
import { Place, Review, Favorite, PlaceImage, User, Booking } from '../models';
import notificationService from '../services/notificationService';

// الحصول على جميع الأماكن مع التصفية
export const getPlaces = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      search,
      minRating,
      latitude,
      longitude,
      radius = 10,
      sortBy = 'rating',
      sortOrder = 'DESC',
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const where: any = { isActive: true };

    // تصفية حسب الفئة
    if (category) {
      const categories = (category as string).split(',');
      where.category = { [Op.in]: categories };
    }

    // تصفية حسب التقييم
    if (minRating) {
      where.averageRating = { [Op.gte]: parseFloat(minRating as string) };
    }

    // بحث نصي
    if (search) {
      where[Op.or] = [
        { nameAr: { [Op.like]: `%${search}%` } },
        { nameEn: { [Op.like]: `%${search}%` } },
        { descriptionAr: { [Op.like]: `%${search}%` } },
        { descriptionEn: { [Op.like]: `%${search}%` } },
        { addressAr: { [Op.like]: `%${search}%` } },
        { addressEn: { [Op.like]: `%${search}%` } },
      ];
    }

    let order: any[] = [];
    let having: any;

    // تصفية حسب الموقع والمسافة
    if (latitude && longitude) {
      const lat = parseFloat(latitude as string);
      const lng = parseFloat(longitude as string);
      const radiusKm = parseFloat(radius as string);

      // حساب المسافة باستخدام Haversine formula
      having = Sequelize.literal(`
        6371 * ACOS(
          COS(RADIANS(${lat})) * COS(RADIANS(latitude)) *
          COS(RADIANS(longitude) - RADIANS(${lng})) +
          SIN(RADIANS(${lat})) * SIN(RADIANS(latitude))
        ) <= ${radiusKm}
      `);

      order.push([
        Sequelize.literal(`
          6371 * ACOS(
            COS(RADIANS(${lat})) * COS(RADIANS(latitude)) *
            COS(RADIANS(longitude) - RADIANS(${lng})) +
            SIN(RADIANS(${lat})) * SIN(RADIANS(latitude))
          )
        `),
        'ASC',
      ]);
    }

    // الترتيب حسب الخيار المحدد
    if (order.length === 0) {
      switch (sortBy) {
        case 'rating':
          order = [['averageRating', sortOrder], ['totalReviews', 'DESC']];
          break;
        case 'popular':
          order = [['totalReviews', sortOrder]];
          break;
        case 'name':
          order = [['nameAr', sortOrder === 'DESC' ? 'DESC' : 'ASC']];
          break;
        case 'newest':
          order = [['createdAt', sortOrder]];
          break;
        default:
          order = [['averageRating', 'DESC'], ['totalReviews', 'DESC']];
      }
    }

    const { count, rows } = await Place.findAndCountAll({
      where,
      having,
      limit: limitNum,
      offset,
      order,
      include: [
        {
          model: PlaceImage,
          as: 'images',
          where: { isPrimary: true },
          required: false,
          limit: 1,
        },
      ],
      distinct: true,
    });

    // حساب المسافة لكل مكان إذا كانت الإحداثيات موجودة
    const placesWithDistance = rows.map(place => {
      const placeData = place.toJSON();
      
      if (latitude && longitude && place.latitude && place.longitude) {
        const lat = parseFloat(latitude as string);
        const lng = parseFloat(longitude as string);
        const placeLat = parseFloat(place.latitude as any);
        const placeLng = parseFloat(place.longitude as any);
        
        // حساب المسافة
        const R = 6371; // نصف قطر الأرض بالكيلومتر
        const dLat = (placeLat - lat) * Math.PI / 180;
        const dLon = (placeLng - lng) * Math.PI / 180;
        const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat * Math.PI / 180) * Math.cos(placeLat * Math.PI / 180) * 
          Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;
        
        return { 
          ...placeData, 
          distance: parseFloat(distance.toFixed(2))
        };
      }
      
      return placeData;
    });

    res.json({
      success: true,
      count,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(count / limitNum),
        hasNext: pageNum < Math.ceil(count / limitNum),
        hasPrev: pageNum > 1,
      },
      data: placesWithDistance,
    });
  } catch (error: any) {
    console.error('Get places error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء جلب الأماكن',
    });
  }
};

// الحصول على مكان محدد
export const getPlaceById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    const place = await Place.findByPk(id, {
      include: [
        {
          model: PlaceImage,
          as: 'images',
          order: [['isPrimary', 'DESC'], ['displayOrder', 'ASC']],
          separate: true,
        },
        {
          model: Review,
          as: 'reviews',
          limit: 10,
          order: [['createdAt', 'DESC']],
          include: [{
            model: User,
            as: 'user',
            attributes: ['id', 'firstName', 'lastName', 'avatarUrl']
          }],
          separate: true,
        },
        {
          model: Booking,
          as: 'bookings',
          where: {
            status: { [Op.in]: ['confirmed', 'completed'] },
            bookingDate: { [Op.gte]: new Date(new Date().setDate(new Date().getDate() - 30)) }
          },
          attributes: ['id', 'bookingDate', 'numberOfGuests'],
          required: false,
          separate: true,
          limit: 5,
        }
      ],
    });

    if (!place) {
      return res.status(404).json({
        success: false,
        message: 'المكان غير موجود',
      });
    }

    // التحقق مما إذا كان المكان في المفضلة للمستخدم
    let isFavorite = false;
    if (userId) {
      const favorite = await Favorite.findOne({
        where: { placeId: id, userId }
      });
      isFavorite = !!favorite;
    }

    // الحصول على مراجعة المستخدم إذا كان مسجلاً
    let userReview = null;
    if (userId) {
      userReview = await Review.findOne({
        where: { placeId: id, userId },
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'avatarUrl']
        }]
      });
    }

    // الحصول على إحصائيات المراجعات
    const reviewStats = await Review.findAll({
      where: { placeId: id },
      attributes: [
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'total'],
        [Sequelize.fn('AVG', Sequelize.col('rating')), 'average'],
        [Sequelize.literal('SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END)'), 'fiveStar'],
        [Sequelize.literal('SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END)'), 'fourStar'],
        [Sequelize.literal('SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END)'), 'threeStar'],
        [Sequelize.literal('SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END)'), 'twoStar'],
        [Sequelize.literal('SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END)'), 'oneStar'],
      ],
      group: ['placeId'],
      raw: true,
    });

    // الحصول على أماكن مشابهة
    const similarPlaces = await Place.findAll({
      where: {
        id: { [Op.ne]: id },
        category: place.category,
        isActive: true,
      },
      include: [{
        model: PlaceImage,
        as: 'images',
        where: { isPrimary: true },
        required: false,
        limit: 1,
      }],
      order: [['averageRating', 'DESC']],
      limit: 4,
    });

    // زيادة عدد المشاهدات
    await place.increment('viewsCount');

    res.json({
      success: true,
      data: {
        ...place.toJSON(),
        isFavorite,
        userReview,
        reviewStats: reviewStats[0] || {
          total: 0,
          average: 0,
          fiveStar: 0,
          fourStar: 0,
          threeStar: 0,
          twoStar: 0,
          oneStar: 0,
        },
        similarPlaces,
      },
    });
  } catch (error: any) {
    console.error('Get place by id error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء جلب تفاصيل المكان',
    });
  }
};

// إنشاء مكان جديد (للمسؤولين)
export const createPlace = async (req: any, res: Response) => {
  try {
    const {
      nameAr,
      nameEn,
      descriptionAr,
      descriptionEn,
      category,
      addressAr,
      addressEn,
      latitude,
      longitude,
      openingHours,
      entryFee,
      contactPhone,
      contactEmail,
      website,
      images,
    } = req.body;

    // التحقق من الحقول المطلوبة
    if (!nameAr || !nameEn || !category) {
      return res.status(400).json({
        success: false,
        message: 'الاسم العربي والإنكليزي والفئة مطلوبة',
      });
    }

    // إنشاء المكان
    const place = await Place.create({
      nameAr,
      nameEn,
      descriptionAr,
      descriptionEn,
      category,
      addressAr,
      addressEn,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      openingHours,
      entryFee: entryFee ? parseFloat(entryFee) : 0,
      contactPhone,
      contactEmail,
      website,
      featuredImage: images?.[0]?.url || null,
    });

    // حفظ الصور إذا وجدت
    if (images && Array.isArray(images)) {
      const placeImages = images.map((image: any, index: number) => ({
        placeId: place.id,
        imageUrl: image.url,
        captionAr: image.captionAr,
        captionEn: image.captionEn,
        isPrimary: index === 0,
        displayOrder: index,
        uploadedBy: req.user.id,
      }));
      
      await PlaceImage.bulkCreate(placeImages);
    }

    res.status(201).json({
      success: true,
      message: 'تم إنشاء المكان بنجاح',
      data: place,
    });
  } catch (error: any) {
    console.error('Create place error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء إنشاء المكان',
    });
  }
};

// تحديث مكان
export const updatePlace = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const place = await Place.findByPk(id);
    if (!place) {
      return res.status(404).json({
        success: false,
        message: 'المكان غير موجود',
      });
    }

    // تحديث البيانات
    await place.update(updateData);

    res.json({
      success: true,
      message: 'تم تحديث المكان بنجاح',
      data: place,
    });
  } catch (error: any) {
    console.error('Update place error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء تحديث المكان',
    });
  }
};

// حذف مكان (للمسؤولين)
export const deletePlace = async (req: any, res: Response) => {
  try {
    const { id } = req.params;

    const place = await Place.findByPk(id);
    if (!place) {
      return res.status(404).json({
        success: false,
        message: 'المكان غير موجود',
      });
    }

    await place.update({ isActive: false });

    res.json({
      success: true,
      message: 'تم حذف المكان بنجاح',
    });
  } catch (error: any) {
    console.error('Delete place error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء حذف المكان',
    });
  }
};

// إضافة مراجعة
export const addReview = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { rating, commentAr, commentEn, visitDate, images } = req.body;

    // التحقق من الحقول المطلوبة
    if (!rating) {
      return res.status(400).json({
        success: false,
        message: 'التقييم مطلوب',
      });
    }

    // التحقق من وجود المكان
    const place = await Place.findByPk(id);
    if (!place) {
      return res.status(404).json({
        success: false,
        message: 'المكان غير موجود',
      });
    }

    // التحقق من وجود مراجعة سابقة
    const existingReview = await Review.findOne({
      where: { placeId: id, userId },
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'لديك مراجعة سابقة لهذا المكان',
      });
    }

    // إنشاء المراجعة
    const review = await Review.create({
      placeId: id,
      userId,
      rating: parseFloat(rating),
      commentAr,
      commentEn,
      images: images || [],
      visitDate: visitDate ? new Date(visitDate) : null,
      isVerifiedVisit: false, // يمكن التحقق لاحقاً من خلال الحجوزات
    });

    res.status(201).json({
      success: true,
      message: 'تم إضافة المراجعة بنجاح',
      data: review,
    });
  } catch (error: any) {
    console.error('Add review error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء إضافة المراجعة',
    });
  }
};

// تحديث مراجعة
export const updateReview = async (req: any, res: Response) => {
  try {
    const { id, reviewId } = req.params;
    const userId = req.user.id;
    const updateData = req.body;

    // التحقق من وجود المراجعة
    const review = await Review.findOne({
      where: { id: reviewId, placeId: id, userId },
    });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'المراجعة غير موجودة',
      });
    }

    // تحديث المراجعة
    await review.update(updateData);

    res.json({
      success: true,
      message: 'تم تحديث المراجعة بنجاح',
      data: review,
    });
  } catch (error: any) {
    console.error('Update review error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء تحديث المراجعة',
    });
  }
};

// حذف مراجعة
export const deleteReview = async (req: any, res: Response) => {
  try {
    const { id, reviewId } = req.params;
    const userId = req.user.id;

    // التحقق من وجود المراجعة
    const review = await Review.findOne({
      where: { id: reviewId, placeId: id, userId },
    });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'المراجعة غير موجودة',
      });
    }

    // حذف المراجعة
    await review.destroy();

    res.json({
      success: true,
      message: 'تم حذف المراجعة بنجاح',
    });
  } catch (error: any) {
    console.error('Delete review error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء حذف المراجعة',
    });
  }
};

// إضافة إلى المفضلة
export const addToFavorites = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { category, notes } = req.body;

    // التحقق من وجود المكان
    const place = await Place.findByPk(id);
    if (!place) {
      return res.status(404).json({
        success: false,
        message: 'المكان غير موجود',
      });
    }

    // التحقق من وجود سابق في المفضلة
    const existingFavorite = await Favorite.findOne({
      where: { placeId: id, userId },
    });

    if (existingFavorite) {
      // إذا كان موجوداً بالفعل، نقوم بتحديثه
      await existingFavorite.update({ category, notes });
      
      return res.json({
        success: true,
        message: 'تم تحديث المفضلة بنجاح',
        data: existingFavorite,
      });
    }

    // إضافة إلى المفضلة
    const favorite = await Favorite.create({
      placeId: id,
      userId,
      category: category || 'favorite',
      notes,
    });

    res.status(201).json({
      success: true,
      message: 'تم إضافة المكان إلى المفضلة بنجاح',
      data: favorite,
    });
  } catch (error: any) {
    console.error('Add to favorites error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء إضافة المكان إلى المفضلة',
    });
  }
};

// إزالة من المفضلة
export const removeFromFavorites = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // البحث عن المفضلة
    const favorite = await Favorite.findOne({
      where: { placeId: id, userId },
    });

    if (!favorite) {