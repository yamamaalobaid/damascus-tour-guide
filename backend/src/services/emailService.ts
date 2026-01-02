import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // إرسال بريد إلكتروني للإشعارات
  async sendNotificationEmail(
    to: string,
    title: string,
    message: string,
    actionUrl?: string
  ): Promise<boolean> {
    try {
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 24px;">${title}</h1>
          </div>
          <div style="padding: 30px; background: #f9f9f9;">
            <p style="font-size: 16px; line-height: 1.6; color: #333;">
              ${message}
            </p>
            ${actionUrl ? `
              <div style="text-align: center; margin-top: 30px;">
                <a href="${actionUrl}" 
                   style="display: inline-block; padding: 12px 30px; 
                          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                          color: white; text-decoration: none; border-radius: 5px; 
                          font-weight: bold;">
                  عرض التفاصيل
                </a>
              </div>
            ` : ''}
          </div>
          <div style="padding: 20px; text-align: center; color: #666; font-size: 12px;">
            <p>© ${new Date().getFullYear()} Damascus Tour Guide. جميع الحقوق محفوظة.</p>
          </div>
        </div>
      `;

      const mailOptions = {
        from: `"Damascus Tour Guide" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to,
        subject: title,
        html: htmlContent,
      };

      await this.transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }

  // إرسال بريد التحقق
  async sendVerificationEmail(to: string, verificationCode: string): Promise<boolean> {
    return this.sendNotificationEmail(
      to,
      'تحقق من بريدك الإلكتروني',
      `رمز التحقق الخاص بك هو: <strong>${verificationCode}</strong><br>هذا الرمز صالح لمدة 10 دقائق.`
    );
  }

  // إرسال بريد إعادة تعيين كلمة المرور
  async sendPasswordResetEmail(to: string, resetToken: string): Promise<boolean> {
    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
    
    return this.sendNotificationEmail(
      to,
      'إعادة تعيين كلمة المرور',
      `لإعادة تعيين كلمة المرور الخاصة بك، يرجى النقر على الرابط التالي:<br><br>
       <a href="${resetUrl}">إعادة تعيين كلمة المرور</a><br><br>
       إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذا البريد.`
    );
  }

  // إرسال بريد تأكيد الحجز
  async sendBookingConfirmationEmail(to: string, bookingDetails: any): Promise<boolean> {
    return this.sendNotificationEmail(
      to,
      'تم تأكيد حجزك!',
      `شكراً لحجزك معنا!<br><br>
       <strong>تفاصيل الحجز:</strong><br>
       رقم الحجز: ${bookingDetails.bookingNumber}<br>
       المكان: ${bookingDetails.placeName}<br>
       التاريخ: ${bookingDetails.bookingDate}<br>
       المبلغ: ${bookingDetails.totalAmount} $<br><br>
       سنتواصل معك قريباً لتأكيد التفاصيل النهائية.`
    );
  }
}

export default new EmailService();