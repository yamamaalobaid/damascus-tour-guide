import { Request, Response } from 'express';
import { Booking, Place, User } from '../models';

// حل مشكلة Stripe module - استخدم require بدلاً من import
const StripeLib = require('stripe');

// تحقق من وجود STRIPE_SECRET_KEY
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.error('STRIPE_SECRET_KEY is not defined in environment variables');
}

// إنشاء instance من Stripe
const stripe = stripeSecretKey ? new StripeLib(stripeSecretKey, {
  apiVersion: '2023-10-16',
}) : null;

// إنشاء جلسة دفع
export const createPaymentSession = async (req: any, res: Response) => {
  try {
    // تحقق من تهيئة Stripe
    if (!stripe) {
      return res.status(500).json({
        success: false,
        message: 'خدمة الدفع غير متوفرة حالياً',
      });
    }

    const { bookingId, currency = 'syp' } = req.body;
    const userId = req.user.id;

    // الحصول على معلومات الحجز
    const booking = await Booking.findByPk(bookingId, {
      include: [
        { 
          model: Place, 
          as: 'place',
          attributes: ['id', 'nameAr', 'nameEn', 'featuredImage', 'entryFee'] 
        },
        { 
          model: User, 
          as: 'user',
          attributes: ['id', 'email', 'firstName', 'lastName'] 
        },
      ],
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'الحجز غير موجود',
      });
    }

    // استخدم type assertion للوصول إلى الحقول
    const bookingData = booking as any;
    
    // تحقق من ملكية الحجز
    if (bookingData.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح بالوصول لهذا الحجز',
      });
    }

    // تحقق من أن الحجز معلق
    if (bookingData.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'الحجز غير قابل للدفع',
        currentStatus: bookingData.status,
      });
    }

    if (!bookingData.place) {
      return res.status(400).json({
        success: false,
        message: 'بيانات المكان غير متوفرة',
      });
    }

    // تحويل العملة إذا لزم الأمر
    let amount = bookingData.totalAmount;
    let stripeCurrency: 'usd' | 'syp' = 'syp';
    
    if (currency.toLowerCase() === 'usd') {
      // سعر الصرف (يمكن جعله ديناميكياً)
      amount = Math.round(bookingData.totalAmount / 4500); // مثال: 1 دولار = 4500 ليرة
      stripeCurrency = 'usd';
    }

    // تحقق من الحد الأدنى للدفع (50 سنت أو 1000 ليرة)
    const minAmount = stripeCurrency === 'usd' ? 0.5 : 1000;
    if (amount < minAmount) {
      amount = minAmount;
    }

    // تحويل المبلغ لساتش (Stripe يتطلب المبلغ بالسنتات)
    const amountInCents = Math.round(amount * 100);

    // إنشاء جلسة دفع في Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: stripeCurrency,
            product_data: {
              name: bookingData.place.nameAr || 'حجز سياحي',
              description: `حجز ${bookingData.serviceType} - ${new Date(bookingData.bookingDate).toLocaleDateString('ar-SA')}`,
              images: bookingData.place.featuredImage ? [bookingData.place.featuredImage] : [],
              metadata: {
                bookingId: bookingData.id.toString(),
              },
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/booking/success?session_id={CHECKOUT_SESSION_ID}&booking_id=${bookingData.id}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/booking/cancel?booking_id=${bookingData.id}`,
      customer_email: bookingData.user?.email,
      metadata: {
        bookingId: bookingData.id.toString(),
        userId: userId.toString(),
        bookingNumber: bookingData.bookingNumber,
        amount: amount.toString(),
        currency: stripeCurrency,
        serviceType: bookingData.serviceType,
      },
      payment_intent_data: {
        metadata: {
          bookingId: bookingData.id.toString(),
          userId: userId.toString(),
          bookingNumber: bookingData.bookingNumber,
        },
      },
    });

    res.json({
      success: true,
      sessionId: session.id,
      url: session.url,
      paymentData: {
        amount,
        currency: stripeCurrency,
        bookingNumber: bookingData.bookingNumber,
        placeName: bookingData.place.nameAr,
        bookingDate: bookingData.bookingDate,
        amountInCents,
      }
    });
  } catch (error: any) {
    console.error('Create payment session error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء إنشاء جلسة الدفع',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// webhook للدفع (يتطلب raw body parser)
export const stripeWebhook = async (req: Request, res: Response) => {
  try {
    // تحقق من تهيئة Stripe
    if (!stripe) {
      console.error('Stripe not initialized');
      return res.status(500).json({ error: 'Payment service not configured' });
    }

    const sig = req.headers['stripe-signature'] as string;
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!endpointSecret) {
      console.error('STRIPE_WEBHOOK_SECRET is not defined');
      return res.status(500).json({ error: 'Webhook configuration error' });
    }

    let event;
    let rawBody: Buffer;

    try {
      // في Express، قد نحتاج للحصول على raw body
      if ((req as any).rawBody) {
        rawBody = (req as any).rawBody;
      } else {
        rawBody = Buffer.from(JSON.stringify(req.body));
      }

      event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // معالجة أنواع الأحداث المختلفة
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutSessionCompleted(event.data.object);
          break;
          
        case 'checkout.session.expired':
          await handleCheckoutSessionExpired(event.data.object);
          break;
          
        case 'payment_intent.succeeded':
          await handlePaymentIntentSucceeded(event.data.object);
          break;
          
        case 'payment_intent.payment_failed':
          await handlePaymentIntentFailed(event.data.object);
          break;
          
        case 'payment_intent.canceled':
          await handlePaymentIntentCanceled(event.data.object);
          break;
          
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      res.json({ received: true, handled: true });
    } catch (error: any) {
      console.error('Error handling webhook event:', error);
      res.status(500).json({ error: 'Failed to handle webhook event' });
    }
  } catch (error: any) {
    console.error('Stripe webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// معالجة اكتمال جلسة الدفع
const handleCheckoutSessionCompleted = async (session: any) => {
  try {
    const bookingId = session.metadata?.bookingId;
    const userId = session.metadata?.userId;

    if (!bookingId || !userId) {
      console.error('Missing metadata in session:', session.id);
      return;
    }

    const booking = await Booking.findByPk(bookingId);
    if (booking) {
      const updateData: any = {
        paymentStatus: 'paid',
        status: 'confirmed',
        paymentMethod: 'stripe',
        transactionId: session.payment_intent || session.id,
        confirmedAt: new Date(),
      };

      await booking.update(updateData);

      console.log(`✅ Payment confirmed for booking ${bookingId}, user ${userId}`);

      // إرسال إشعار للمستخدم (يمكنك تفعيل هذا لاحقاً)
      // await sendPaymentConfirmationNotification(parseInt(userId), booking);
    }
  } catch (error) {
    console.error('Error handling checkout session completed:', error);
  }
};

// معالجة انتهاء صلاحية جلسة الدفع
const handleCheckoutSessionExpired = async (session: any) => {
  try {
    const bookingId = session.metadata?.bookingId;
    
    if (bookingId) {
      const booking = await Booking.findByPk(bookingId);
      if (booking && booking.status === 'pending') {
        await booking.update({
          status: 'cancelled',
          cancellationReason: 'انتهاء صلاحية جلسة الدفع',
          cancelledAt: new Date(),
        });
        
        console.log(`⏰ Booking ${bookingId} cancelled due to expired payment session`);
      }
    }
  } catch (error) {
    console.error('Error handling expired payment session:', error);
  }
};

// معالجة نجاح payment intent
const handlePaymentIntentSucceeded = async (paymentIntent: any) => {
  try {
    const bookingId = paymentIntent.metadata?.bookingId;
    
    if (bookingId) {
      const booking = await Booking.findByPk(bookingId);
      if (booking && booking.paymentStatus === 'pending') {
        await booking.update({
          paymentStatus: 'paid',
          transactionId: paymentIntent.id,
        });
        
        console.log(`✅ Payment intent succeeded for booking ${bookingId}`);
      }
    }
  } catch (error) {
    console.error('Error handling payment intent succeeded:', error);
  }
};

// معالجة فشل payment intent
const handlePaymentIntentFailed = async (paymentIntent: any) => {
  try {
    const bookingId = paymentIntent.metadata?.bookingId;
    
    if (bookingId) {
      const booking = await Booking.findByPk(bookingId);
      if (booking && booking.status === 'pending') {
        await booking.update({
          paymentStatus: 'failed',
          cancellationReason: 'فشل في عملية الدفع',
        });
        
        console.log(`❌ Payment failed for booking ${bookingId}`);
      }
    }
  } catch (error) {
    console.error('Error handling payment intent failed:', error);
  }
};

// معالجة إلغاء payment intent
const handlePaymentIntentCanceled = async (paymentIntent: any) => {
  try {
    const bookingId = paymentIntent.metadata?.bookingId;
    
    if (bookingId) {
      const booking = await Booking.findByPk(bookingId);
      if (booking && booking.status === 'pending') {
        await booking.update({
          paymentStatus: 'cancelled',
          cancellationReason: 'تم إلغاء عملية الدفع',
          cancelledAt: new Date(),
        });
        
        console.log(`🚫 Payment canceled for booking ${bookingId}`);
      }
    }
  } catch (error) {
    console.error('Error handling payment intent canceled:', error);
  }
};

// الحصول على تفاصيل الدفع
export const getPaymentDetails = async (req: any, res: Response) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id;

    const booking = await Booking.findOne({
      where: { id: bookingId, userId },
      include: [{ 
        model: Place, 
        as: 'place',
        attributes: ['id', 'nameAr', 'nameEn', 'featuredImage'] 
      }],
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'الحجز غير موجود',
      });
    }

    // استخدم type assertion
    const bookingData = booking as any;

    res.json({
      success: true,
      data: {
        id: bookingData.id,
        bookingNumber: bookingData.bookingNumber,
        totalAmount: bookingData.totalAmount,
        currency: bookingData.currency,
        paymentStatus: bookingData.paymentStatus,
        paymentMethod: bookingData.paymentMethod,
        status: bookingData.status,
        placeName: bookingData.place?.nameAr,
        placeImage: bookingData.place?.featuredImage,
        bookingDate: bookingData.bookingDate,
        serviceType: bookingData.serviceType,
        canPay: bookingData.status === 'pending' && bookingData.paymentStatus === 'pending',
        requiresPayment: bookingData.status === 'pending',
      },
    });
  } catch (error: any) {
    console.error('Get payment details error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء جلب تفاصيل الدفع',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// التحقق من حالة الدفع
export const verifyPayment = async (req: any, res: Response) => {
  try {
    // تحقق من تهيئة Stripe
    if (!stripe) {
      return res.status(500).json({
        success: false,
        message: 'خدمة الدفع غير متوفرة حالياً',
      });
    }

    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'معرف الجلسة مطلوب',
      });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    res.json({
      success: true,
      data: {
        paymentStatus: session.payment_status,
        status: session.status,
        amount: session.amount_total ? session.amount_total / 100 : 0,
        currency: session.currency,
        customerEmail: session.customer_email,
        customerName: session.customer_details?.name,
        bookingId: session.metadata?.bookingId,
        bookingNumber: session.metadata?.bookingNumber,
      },
    });
  } catch (error: any) {
    console.error('Verify payment error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء التحقق من حالة الدفع',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// إنشاء payment intent مباشر (للتطبيقات المحلية)
export const createPaymentIntent = async (req: any, res: Response) => {
  try {
    // تحقق من تهيئة Stripe
    if (!stripe) {
      return res.status(500).json({
        success: false,
        message: 'خدمة الدفع غير متوفرة حالياً',
      });
    }

    const { bookingId, currency = 'syp' } = req.body;
    const userId = req.user.id;

    const booking = await Booking.findByPk(bookingId, {
      include: [{ 
        model: Place, 
        as: 'place',
        attributes: ['nameAr', 'nameEn'] 
      }],
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'الحجز غير موجود',
      });
    }

    const bookingData = booking as any;
    
    // تحقق من ملكية الحجز
    if (bookingData.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح',
      });
    }

    // تحقق من حالة الحجز
    if (bookingData.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'الحجز غير قابل للدفع',
        currentStatus: bookingData.status,
      });
    }

    // حساب المبلغ
    let amount = bookingData.totalAmount;
    let stripeCurrency: 'usd' | 'syp' = 'syp';
    
    if (currency.toLowerCase() === 'usd') {
      amount = Math.round(bookingData.totalAmount / 4500);
      stripeCurrency = 'usd';
    }

    const minAmount = stripeCurrency === 'usd' ? 0.5 : 1000;
    if (amount < minAmount) {
      amount = minAmount;
    }

    // إنشاء payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: stripeCurrency,
      metadata: {
        bookingId: bookingData.id.toString(),
        userId: userId.toString(),
        bookingNumber: bookingData.bookingNumber,
        placeName: bookingData.place?.nameAr || 'مكان سياحي',
      },
      description: `دفع حجز ${bookingData.bookingNumber}`,
    });

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
      data: {
        amount,
        currency: stripeCurrency,
        bookingNumber: bookingData.bookingNumber,
        placeName: bookingData.place?.nameAr,
      }
    });
  } catch (error: any) {
    console.error('Create payment intent error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء إنشاء نية الدفع',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// إلغاء الدفع
export const cancelPayment = async (req: any, res: Response) => {
  try {
    // تحقق من تهيئة Stripe
    if (!stripe) {
      return res.status(500).json({
        success: false,
        message: 'خدمة الدفع غير متوفرة حالياً',
      });
    }

    const { paymentIntentId } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({
        success: false,
        message: 'معرف نية الدفع مطلوب',
      });
    }

    const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);

    res.json({
      success: true,
      message: 'تم إلغاء الدفع بنجاح',
      data: {
        status: paymentIntent.status,
        cancelledAt: new Date().toISOString(),
        paymentIntentId: paymentIntent.id,
      },
    });
  } catch (error: any) {
    console.error('Cancel payment error:', error);
    
    // إذا كان الدفع قد تم بالفعل
    if (error.code === 'payment_intent_unexpected_state') {
      return res.status(400).json({
        success: false,
        message: 'لا يمكن إلغاء الدفع بعد اكتماله',
      });
    }

    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء إلغاء الدفع',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// الحصول على تاريخ الدفعات
export const getPaymentHistory = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 10;
    const offset = (pageNum - 1) * limitNum;

    const { count, rows: bookings } = await Booking.findAndCountAll({
      where: { 
        userId,
        paymentStatus: 'paid',
        status: { [require('sequelize').Op.ne]: 'cancelled' }
      },
      include: [{ 
        model: Place, 
        as: 'place',
        attributes: ['id', 'nameAr', 'nameEn', 'featuredImage'] 
      }],
      order: [['confirmedAt', 'DESC']],
      limit: limitNum,
      offset,
    });

    // تنسيق البيانات
    const paymentHistory = (bookings as any[]).map(booking => ({
      id: booking.id,
      bookingNumber: booking.bookingNumber,
      date: booking.confirmedAt || booking.createdAt,
      amount: booking.totalAmount,
      currency: booking.currency,
      status: booking.status,
      placeName: booking.place?.nameAr,
      placeImage: booking.place?.featuredImage,
      serviceType: booking.serviceType,
      transactionId: booking.transactionId,
    }));

    res.json({
      success: true,
      data: paymentHistory,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count,
        totalPages: Math.ceil(count / limitNum),
      },
    });
  } catch (error: any) {
    console.error('Get payment history error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء جلب سجل الدفعات',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// إنشاء فاتورة
export const createInvoice = async (req: any, res: Response) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id;

    const booking = await Booking.findOne({
      where: { id: bookingId, userId },
      include: [
        { 
          model: Place, 
          as: 'place',
          attributes: ['nameAr', 'nameEn', 'addressAr', 'addressEn', 'contactPhone'] 
        },
        { 
          model: User, 
          as: 'user',
          attributes: ['firstName', 'lastName', 'email', 'phone'] 
        },
      ],
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'الحجز غير موجود',
      });
    }

    const bookingData = booking as any;

    // إنشاء بيانات الفاتورة
    const invoiceData = {
      invoiceNumber: `INV-${bookingData.bookingNumber}`,
      date: new Date().toISOString().split('T')[0],
      bookingNumber: bookingData.bookingNumber,
      customer: {
        name: `${bookingData.user?.firstName || ''} ${bookingData.user?.lastName || ''}`.trim(),
        email: bookingData.user?.email,
        phone: bookingData.user?.phone,
      },
      place: {
        name: bookingData.place?.nameAr,
        address: bookingData.place?.addressAr,
        phone: bookingData.place?.contactPhone,
      },
      items: [
        {
          description: `حجز ${bookingData.serviceType}`,
          quantity: bookingData.numberOfGuests,
          unitPrice: bookingData.totalAmount / bookingData.numberOfGuests,
          total: bookingData.totalAmount,
        },
      ],
      subtotal: bookingData.totalAmount,
      tax: 0, // يمكن إضافة ضريبة إذا لزم
      total: bookingData.totalAmount,
      currency: bookingData.currency,
      paymentStatus: bookingData.paymentStatus,
      paymentMethod: bookingData.paymentMethod,
      transactionId: bookingData.transactionId,
      notes: 'شكراً لاستخدامك دليل دمشق السياحي',
    };

    res.json({
      success: true,
      data: invoiceData,
      downloadUrl: `/api/payments/invoice/${bookingId}/download`,
    });
  } catch (error: any) {
    console.error('Create invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء إنشاء الفاتورة',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};