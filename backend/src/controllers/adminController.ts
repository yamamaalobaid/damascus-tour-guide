import { Request, Response } from 'express';
import { User, Place, Booking, Review, Chat } from '../models';
import { Op, Sequelize } from 'sequelize'; // أضف Sequelize هنا

// إحصائيات النظام - النسخة النهائية المصححة
export const getDashboardStats = async (req: any, res: Response) => {
  try {
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // إحصائيات المستخدمين
    const [totalUsers, newUsersThisMonth] = await Promise.all([
      User.count(),
      User.count({
        where: { createdAt: { [Op.gte]: startOfMonth } }
      })
    ]);

    // إحصائيات الأماكن
    const [totalPlaces, activePlaces] = await Promise.all([
      Place.count(),
      Place.count({ where: { isActive: true } })
    ]);

    // إحصائيات الحجوزات
    const [totalBookings, pendingBookings, confirmedBookings, revenue] = await Promise.all([
      Booking.count(),
      Booking.count({ where: { status: 'pending' } }),
      Booking.count({ where: { status: 'confirmed' } }),
      Booking.sum('totalAmount', {
        where: {
          status: 'confirmed',
          paymentStatus: 'paid',
          createdAt: { [Op.gte]: startOfMonth }
        }
      }) || 0
    ]);

    // إحصائيات المراجعات - طريقة آمنة للتحويل
    const reviews = await Review.findAll({ 
      attributes: ['rating'],
      raw: true 
    });
    
    const totalReviews = reviews.length;
    
    // حساب مجموع التقييمات مع التحقق من صحة الأرقام
    let totalRating = 0;
    let validReviews = 0;
    
    reviews.forEach(review => {
      // تحويل rating إلى number مع التحقق
      const rating = parseFloat(review.rating as any);
      
      // التحقق من أن الرقم صالح وبين 1 و 5
      if (!isNaN(rating) && rating >= 1 && rating <= 5) {
        totalRating += rating;
        validReviews++;
      }
    });
    
    const averageRating = validReviews > 0 ? (totalRating / validReviews).toFixed(1) : '0.0';

    // إحصائيات المحادثات
    const activeChats = await Chat.count({ 
      where: { status: 'active' } 
    });
    
    // استعلام مباشر للمحادثات المعلقة بدون agent
    const pendingChats = await Chat.findAll({
      where: { 
        status: 'pending',
        [Op.or]: [
          { agentId: null },
          { agentId: 0 }
        ]
      },
      raw: true,
    });
    
    const pendingSupport = pendingChats.length;

    // إحصائيات إضافية
    const newUsersToday = await User.count({
      where: { createdAt: { [Op.gte]: startOfToday } }
    });

    const cancelledBookings = await Booking.count({
      where: { status: 'cancelled' }
    });

    const completedBookings = await Booking.count({
      where: { status: 'completed' }
    });

    res.json({
      success: true,
      data: {
        summary: {
          totalUsers: Number(totalUsers),
          totalPlaces: Number(totalPlaces),
          totalBookings: Number(totalBookings),
          totalReviews: Number(totalReviews),
          monthlyRevenue: Number(revenue)
        },
        monthly: {
          newUsers: Number(newUsersThisMonth),
          newUsersToday: Number(newUsersToday),
          activePlaces: Number(activePlaces)
        },
        bookings: {
          total: Number(totalBookings),
          pending: Number(pendingBookings),
          confirmed: Number(confirmedBookings),
          cancelled: Number(cancelledBookings),
          completed: Number(completedBookings),
          completionRate: totalBookings > 0 ? 
            ((confirmedBookings / totalBookings) * 100).toFixed(1) + '%' : '0%'
        },
        reviews: {
          total: Number(totalReviews),
          validReviews: Number(validReviews), // عدد التقييمات الصالحة
          averageRating,
          ratingDistribution: await getRatingDistribution()
        },
        support: {
          activeChats: Number(activeChats),
          pendingSupport: Number(pendingSupport),
          totalChats: Number(activeChats + pendingSupport)
        },
        performance: {
          userGrowth: totalUsers > 0 ? 
            ((newUsersThisMonth / totalUsers) * 100).toFixed(1) + '%' : '0%',
          bookingConversion: totalUsers > 0 ? 
            ((totalBookings / totalUsers) * 100).toFixed(1) + '%' : '0%',
          revenuePerBooking: totalBookings > 0 ? 
            (Number(revenue) / totalBookings).toFixed(2) : '0.00'
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء جلب إحصائيات النظام',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }
};

// دالة مساعدة لتوزيع التقييمات
async function getRatingDistribution() {
  try {
    const reviews = await Review.findAll({
      attributes: ['rating'],
      raw: true,
    });
    
    const distribution: Record<string, number> = {
      '5_stars': 0,
      '4_stars': 0,
      '3_stars': 0,
      '2_stars': 0,
      '1_star': 0,
      'invalid': 0 // للمراجعات غير الصالحة
    };
    
    reviews.forEach(review => {
      // تحويل rating إلى number
      const ratingNum = parseFloat(review.rating as any);
      
      if (!isNaN(ratingNum) && ratingNum >= 1 && ratingNum <= 5) {
        const roundedRating = Math.round(ratingNum);
        
        if (roundedRating === 1) {
          distribution['1_star']++;
        } else if (roundedRating === 2) {
          distribution['2_stars']++;
        } else if (roundedRating === 3) {
          distribution['3_stars']++;
        } else if (roundedRating === 4) {
          distribution['4_stars']++;
        } else if (roundedRating === 5) {
          distribution['5_stars']++;
        }
      } else {
        distribution['invalid']++;
      }
    });
    
    return distribution;
  } catch (error) {
    console.error('Error getting rating distribution:', error);
    return {
      '5_stars': 0,
      '4_stars': 0,
      '3_stars': 0,
      '2_stars': 0,
      '1_star': 0,
      'invalid': 0
    };
  }
}

// دالة إضافية لتحويل rating إلى number بأمان
function parseRating(rating: any): number | null {
  try {
    if (rating === null || rating === undefined) {
      return null;
    }
    
    // إذا كان number بالفعل
    if (typeof rating === 'number') {
      return rating >= 1 && rating <= 5 ? rating : null;
    }
    
    // إذا كان string، حاول تحويله
    if (typeof rating === 'string') {
      const num = parseFloat(rating);
      return !isNaN(num) && num >= 1 && num <= 5 ? num : null;
    }
    
    return null;
  } catch {
    return null;
  }
}