import { Request, Response } from 'express';
import { Favorite, Place, PlaceImage } from '../models';
import { Op, Sequelize } from 'sequelize'; // أضف Sequelize هنا

// أو استيراد sequelize من config
import sequelize from '../config/database';

// الحصول على المفضلة
export const getFavorites = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const { category, page = 1, limit = 20 } = req.query;

    const where: any = { userId };
    if (category) {
      where.category = category;
    }

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const { count, rows: favorites } = await Favorite.findAndCountAll({
      where,
      include: [
        {
          model: Place,
          as: 'place',
          where: { isActive: true },
          include: [{
            model: PlaceImage,
            as: 'images',
            where: { isPrimary: true },
            required: false,
            limit: 1,
          }]
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit as string),
      offset,
    });

    // تجميع حسب الفئة - استخدم Sequelize من الاستيراد
    const byCategory = await Favorite.findAll({
      where: { userId },
      attributes: [
        'category',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      group: ['category'],
      raw: true,
    });

    res.json({
      success: true,
      count,
      byCategory,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        totalPages: Math.ceil(count / parseInt(limit as string)),
      },
      data: favorites,
    });
  } catch (error: any) {
    console.error('Get favorites error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء جلب المفضلة',
    });
  }
};