import { Request, Response } from 'express';
import { Review, Place, User, Booking } from '../models';
import { Op, Sequelize } from 'sequelize'; // أضف Sequelize هنا// الحصول على مراجعات مكان
export const getPlaceReviews = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10, rating, sortBy = 'newest' } = req.query;

    const where: any = { placeId: id };
    if (rating) {
      where.rating = rating;
    }

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let order: any[] = [];
    switch (sortBy) {
      case 'newest':
        order = [['createdAt', 'DESC']];
        break;
      case 'oldest':
        order = [['createdAt', 'ASC']];
        break;
      case 'highest':
        order = [['rating', 'DESC'], ['helpfulCount', 'DESC']];
        break;
      case 'lowest':
        order = [['rating', 'ASC'], ['helpfulCount', 'DESC']];
        break;
      case 'helpful':
        order = [['helpfulCount', 'DESC'], ['createdAt', 'DESC']];
        break;
      default:
        order = [['createdAt', 'DESC']];
    }

    const { count, rows: reviews } = await Review.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'avatarUrl', 'createdAt']
        }
      ],
      order,
      limit: parseInt(limit as string),
      offset,
    });

    // الحصول على إحصائيات التقييم
    const ratingStats = await Review.findAll({
      where: { placeId: id },
      attributes: [
        'rating',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      group: ['rating'],
      order: [['rating', 'DESC']],
    });

    res.json({
      success: true,
      count,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        totalPages: Math.ceil(count / parseInt(limit as string)),
      },
      ratingStats,
      data: reviews,
    });
  } catch (error: any) {
    console.error('Get place reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء جلب المراجعات',
    });
  }
};

// الحصول على مراجعات المستخدم
export const getUserReviews = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const { count, rows: reviews } = await Review.findAndCountAll({
      where: { userId },
      include: [
        {
          model: Place,
          as: 'place',
          attributes: ['id', 'nameAr', 'nameEn', 'category', 'featuredImage']
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
      data: reviews,
    });
  } catch (error: any) {
    console.error('Get user reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء جلب مراجعات المستخدم',
    });
  }
};