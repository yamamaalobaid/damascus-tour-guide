import { Request, Response } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import { User } from '../models';
import emailService from '../services/emailService';
import { Op } from 'sequelize';

// توليد JWT Token
const generateToken = (id: number): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }
  
  const expiresIn = process.env.JWT_EXPIRE || '7d';
  
  // استخدم as any لتجاوز مشكلة النوع في jwt.sign
  return jwt.sign({ id }, secret, { expiresIn } as any);
};

// تسجيل مستخدم جديد
export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, phone } = req.body;

    // التحقق من الحقول المطلوبة
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'يرجى إدخال البريد الإلكتروني وكلمة المرور',
      });
    }

    // التحقق من صحة البريد الإلكتروني
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'صيغة البريد الإلكتروني غير صحيحة',
      });
    }

    // التحقق من قوة كلمة المرور
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
      });
    }

    // التحقق من وجود المستخدم
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [
          { email },
          { phone: phone || '' }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === email 
          ? 'البريد الإلكتروني مسجل مسبقاً'
          : 'رقم الهاتف مسجل مسبقاً',
      });
    }

    // إنشاء توكن التفعيل
    const verificationToken = generateToken(Date.now());

    // إنشاء المستخدم مع جميع الحقول المطلوبة
    const user = await User.create({
      email,
      password,
      firstName: firstName || null,
      lastName: lastName || null,
      phone: phone || null,
      language: 'ar', // القيمة الافتراضية
      isVerified: false, // مهم: يجب تحديد قيمة
      verificationToken: verificationToken,
    } as any); // استخدم as any للتغلب على مشكلة TypeScript

    // توليد التوكن للمصادقة
    const token = generateToken(user.id);

    // إرسال بريد الترحيب والتأكيد
    try {
      // استخدم sendNotificationEmail كبديل حتى تضيف sendWelcomeEmail
      await emailService.sendNotificationEmail(
        user.email,
        'مرحباً بك في دليل دمشق السياحي',
        'شكراً لتسجيلك في دليل دمشق السياحي. يرجى تفعيل حسابك للنقر على الرابط.',
        `${process.env.CLIENT_URL}/verify-email/${verificationToken}`
      );
    } catch (emailError) {
      console.error('فشل إرسال البريد الترحيبي:', emailError);
    }

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        language: user.language,
        isVerified: user.isVerified,
        avatarUrl: user.avatarUrl,
      },
      message: 'تم إنشاء الحساب بنجاح، يرجى تفعيل بريدك الإلكتروني',
    });
  } catch (error: any) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء إنشاء الحساب',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// تسجيل الدخول
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'يرجى إدخال البريد الإلكتروني وكلمة المرور',
      });
    }

    // البحث عن المستخدم
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'بيانات الدخول غير صحيحة',
      });
    }

    // التحقق من كلمة المرور
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'بيانات الدخول غير صحيحة',
      });
    }

    // التحقق من تفعيل الحساب
    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        message: 'يرجى تفعيل حسابك أولاً',
        needsVerification: true,
        email: user.email,
      });
    }

    // تحديث آخر دخول
    await user.update({ lastLogin: new Date() });

    // توليد التوكن
    const token = generateToken(user.id);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        language: user.language,
        isVerified: user.isVerified,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء تسجيل الدخول',
    });
  }
};

// تفعيل الحساب
export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'توكن التفعيل مطلوب',
      });
    }

    const user = await User.findOne({ where: { verificationToken: token } });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'توكن التفعيل غير صالح أو منتهي',
      });
    }

    // تفعيل الحساب - استخدم null بدلاً من undefined
    await user.update({
      isVerified: true,
      verificationToken: null as any, // استخدم as any
    });

    res.json({
      success: true,
      message: 'تم تفعيل حسابك بنجاح',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        isVerified: user.isVerified,
      },
    });
  } catch (error: any) {
    console.error('Verify email error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء تفعيل الحساب',
    });
  }
};

// إعادة إرسال بريد التفعيل
export const resendVerification = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'البريد الإلكتروني مطلوب',
      });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم غير موجود',
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'الحساب مفعل بالفعل',
      });
    }

    // إنشاء توكن جديد
    const verificationToken = generateToken(Date.now());
    await user.update({ verificationToken });

    // إرسال البريد باستخدام sendNotificationEmail
    await emailService.sendNotificationEmail(
      user.email,
      'تفعيل حسابك في دليل دمشق السياحي',
      'لتفعيل حسابك، يرجى النقر على الرابط أدناه:',
      `${process.env.CLIENT_URL}/verify-email/${verificationToken}`
    );

    res.json({
      success: true,
      message: 'تم إرسال بريد التفعيل بنجاح',
    });
  } catch (error: any) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء إرسال بريد التفعيل',
    });
  }
};

// نسيان كلمة المرور
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'البريد الإلكتروني مطلوب',
      });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      // لإخفاء وجود المستخدم، نعيد نفس الرسالة
      return res.json({
        success: true,
        message: 'إذا كان البريد الإلكتروني مسجلاً، سيصلك رابط إعادة التعيين',
      });
    }

    // إنشاء توكن إعادة التعيين
    const resetToken = generateToken(user.id);
    const resetPasswordExpire = new Date(Date.now() + 10 * 60 * 1000); // 10 دقائق
    
    // استخدم as any للتعامل مع null
    await user.update({
      resetPasswordToken: resetToken,
      resetPasswordExpire: resetPasswordExpire,
    } as any);

    // إرسال البريد
    await emailService.sendPasswordResetEmail(user.email, resetToken);

    res.json({
      success: true,
      message: 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني',
    });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء معالجة الطلب',
    });
  }
};

// إعادة تعيين كلمة المرور
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: 'التوكن وكلمة المرور الجديدة مطلوبان',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
      });
    }

    const user = await User.findOne({
      where: {
        resetPasswordToken: token,
        resetPasswordExpire: { [Op.gt]: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'توكن إعادة التعيين غير صالح أو منتهي',
      });
    }

    // تحديث كلمة المرور - استخدم as any للتعامل مع null
    await user.update({
      password,
      resetPasswordToken: null as any,
      resetPasswordExpire: null as any,
    });

    res.json({
      success: true,
      message: 'تم تحديث كلمة المرور بنجاح',
    });
  } catch (error: any) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء تحديث كلمة المرور',
    });
  }
};

// الحصول على بيانات المستخدم الحالي
export const getMe = async (req: any, res: Response) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password', 'verificationToken', 'resetPasswordToken', 'resetPasswordExpire'] },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم غير موجود',
      });
    }

    res.json({
      success: true,
      user,
    });
  } catch (error: any) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء جلب بيانات المستخدم',
    });
  }
};

// تحديث الملف الشخصي
export const updateProfile = async (req: any, res: Response) => {
  try {
    const { firstName, lastName, phone, language, avatarUrl } = req.body;
    const userId = req.user.id;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم غير موجود',
      });
    }

    // التحقق من رقم الهاتف إذا تم تحديثه
    if (phone && phone !== user.phone) {
      const existingPhone = await User.findOne({
        where: { phone, id: { [Op.ne]: userId } },
      });
      
      if (existingPhone) {
        return res.status(400).json({
          success: false,
          message: 'رقم الهاتف مسجل مسبقاً',
        });
      }
    }

    // تحديث البيانات باستخدام null للقيم الفارغة
    const updateData: any = {
      firstName: firstName !== undefined ? (firstName || null) : user.firstName,
      lastName: lastName !== undefined ? (lastName || null) : user.lastName,
      phone: phone !== undefined ? (phone || null) : user.phone,
      language: language !== undefined ? language : user.language,
      avatarUrl: avatarUrl !== undefined ? (avatarUrl || null) : user.avatarUrl,
    };

    await user.update(updateData);

    res.json({
      success: true,
      message: 'تم تحديث الملف الشخصي بنجاح',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        language: user.language,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error: any) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء تحديث الملف الشخصي',
    });
  }
};

// تغيير كلمة المرور
export const changePassword = async (req: any, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'كلمة المرور الحالية والجديدة مطلوبتان',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل',
      });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم غير موجود',
      });
    }

    // التحقق من كلمة المرور الحالية
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'كلمة المرور الحالية غير صحيحة',
      });
    }

    // تحديث كلمة المرور
    await user.update({ password: newPassword });

    res.json({
      success: true,
      message: 'تم تغيير كلمة المرور بنجاح',
    });
  } catch (error: any) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء تغيير كلمة المرور',
    });
  }
};

// تسجيل الخروج
export const logout = async (req: any, res: Response) => {
  try {
    res.json({
      success: true,
      message: 'تم تسجيل الخروج بنجاح',
    });
  } catch (error: any) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء تسجيل الخروج',
    });
  }
};

// تحديث الصورة الشخصية
export const updateAvatar = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const { avatarUrl } = req.body;

    if (!avatarUrl) {
      return res.status(400).json({
        success: false,
        message: 'رابط الصورة مطلوب',
      });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم غير موجود',
      });
    }

    await user.update({ avatarUrl: avatarUrl || null });

    res.json({
      success: true,
      message: 'تم تحديث الصورة الشخصية بنجاح',
      avatarUrl: user.avatarUrl,
    });
  } catch (error: any) {
    console.error('Update avatar error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء تحديث الصورة الشخصية',
    });
  }
};