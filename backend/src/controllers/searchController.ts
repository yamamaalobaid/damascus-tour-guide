import { Request, Response } from 'express';
import { Place, Review, PlaceImage } from '../models';
import { Op, Sequelize } from 'sequelize';

// بحث متقدم في الأماكن
export const advancedSearch = async (req: Request, res: Response) => {
  try {
    const {
      query,
      categories,
      minRating,
      maxRating,
      minPrice,
      maxPrice,
      latitude,
      longitude,
      radius = 5,
      amenities,
      sortBy = 'relevance',
      page = 1,
      limit = 20,
    } = req.query;

    const where: any = { isActive: true };
    const having: any = {};

    // البحث النصي
    if (query) {
      where[Op.or] = [
        { nameAr: { [Op.like]: `%${query}%` } },
        { nameEn: { [Op.like]: `%${query}%` } },
        { descriptionAr: { [Op.like]: `%${query}%` } },
        { descriptionEn: { [Op.like]: `%${query}%` } },
        { addressAr: { [Op.like]: `%${query}%` } },
        { addressEn: { [Op.like]: `%${query}%` } },
      ];
    }

    // تصفية حسب الفئات
    if (categories) {
      const categoryList = (categories as string).split(',');
      where.category = { [Op.in]: categoryList };
    }

    // تصفية حسب التقييم
    if (minRating || maxRating) {
      const ratingWhere: any = {};
      if (minRating) ratingWhere[Op.gte] = parseFloat(minRating as string);
      if (maxRating) ratingWhere[Op.lte] = parseFloat(maxRating as string);
      where.averageRating = ratingWhere;
    }

    // تصفية حسب السعر
    if (minPrice || maxPrice) {
      const priceWhere: any = {};
      if (minPrice) priceWhere[Op.gte] = parseFloat(minPrice as string);
      if (maxPrice) priceWhere[Op.lte] = parseFloat(maxPrice as string);
      where.entryFee = priceWhere;
    }

    // تصفية حسب المسافة
    if (latitude && longitude) {
      const lat = parseFloat(latitude as string);
      const lng = parseFloat(longitude as string);
      const radiusKm = parseFloat(radius as string);

      having.distance = Sequelize.literal(`
        6371 * ACOS(
          COS(RADIANS(${lat})) * COS(RADIANS(latitude)) *
          COS(RADIANS(longitude) - RADIANS(${lng})) +
          SIN(RADIANS(${lat})) * SIN(RADIANS(latitude))
        ) <= ${radiusKm}
      `);
    }

    let order: any[] = [];
    
    // تحديد الترتيب
    switch (sortBy) {
      case 'distance':
        if (latitude && longitude) {
          order.push([
            Sequelize.literal(`
              6371 * ACOS(
                COS(RADIANS(${latitude})) * COS(RADIANS(latitude)) *
                COS(RADIANS(longitude) - RADIANS(${longitude})) +
                SIN(RADIANS(${latitude})) * SIN(RADIANS(latitude))
              )
            `),
            'ASC'
          ]);
        }
        break;
      case 'rating':
        order = [['averageRating', 'DESC'], ['totalReviews', 'DESC']];
        break;
      case 'price_low':
        order = [['entryFee', 'ASC']];
        break;
      case 'price_high':
        order = [['entryFee', 'DESC']];
        break;
      case 'popular':
        order = [['totalReviews', 'DESC'], ['viewsCount', 'DESC']];
        break;
      default: // relevance
        if (query) {
          order = [
            [Sequelize.literal(`CASE WHEN nameAr LIKE '%${query}%' THEN 1 ELSE 0 END`), 'DESC'],
            [Sequelize.literal(`CASE WHEN nameEn LIKE '%${query}%' THEN 1 ELSE 0 END`), 'DESC'],
            ['averageRating', 'DESC'],
          ];
        } else {
          order = [['averageRating', 'DESC'], ['totalReviews', 'DESC']];
        }
    }

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const { count, rows: places } = await Place.findAndCountAll({
      where,
      having,
      include: [{
        model: PlaceImage,
        as: 'images',
        where: { isPrimary: true },
        required: false,
        limit: 1,
      }],
      order,
      limit: parseInt(limit as string),
      offset,
      subQuery: false,
    });

    res.json({
      success: true,
      count,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        totalPages: Math.ceil(count / parseInt(limit as string)),
      },
      data: places,
    });
  } catch (error: any) {
    console.error('Advanced search error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء البحث',
    });
  }
};