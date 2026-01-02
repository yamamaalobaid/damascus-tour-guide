import { Request, Response } from 'express';
import { Chat, Message, User } from '../models';
import { Op } from 'sequelize';

// =============================================
// دوال مساعدة لإنشاء السجلات
// =============================================

/**
 * دالة مساعدة لإنشاء محادثة جديدة
 */
const createChatRecord = async (chatData: {
  userId: number;
  agentId: number | null;
  subject: string;
  status: 'pending' | 'active' | 'closed' | 'resolved';
}): Promise<Chat> => {
  const fullChatData = {
    ...chatData,
    lastMessageAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  return await Chat.create(fullChatData as any);
};

/**
 * دالة مساعدة لإنشاء رسالة جديدة
 */
const createMessageRecord = async (messageData: {
  chatId: number;
  senderId: number;
  content: string;
  messageType: 'text' | 'file' | 'system';
}): Promise<Message> => {
  const fullMessageData = {
    ...messageData,
    isRead: false,
    readAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  return await Message.create(fullMessageData as any);
};

// =============================================
// دوال التحكم
// =============================================

/**
 * الحصول على محادثات المستخدم
 */
export const getUserChats = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    const where: any = { [Op.or]: [{ userId }, { agentId: userId }] };
    if (status) {
      where.status = status;
    }

    const chats = await Chat.findAll({
      where,
      include: [
        { model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'avatarUrl'] },
        { model: User, as: 'agent', attributes: ['id', 'firstName', 'lastName', 'avatarUrl'] },
        {
          model: Message,
          as: 'messages',
          limit: 1,
          order: [['createdAt', 'DESC']],
          separate: true,
        },
      ],
      order: [['lastMessageAt', 'DESC']],
    });

    res.json({
      success: true,
      data: chats,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * الحصول على محادثة محددة مع رسائلها
 */
export const getChat = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const chat = await Chat.findOne({
      where: {
        id,
        [Op.or]: [{ userId }, { agentId: userId }],
      },
      include: [
        { model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'avatarUrl'] },
        { model: User, as: 'agent', attributes: ['id', 'firstName', 'lastName', 'avatarUrl'] },
      ],
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'المحادثة غير موجودة',
      });
    }

    // الحصول على الرسائل
    const messages = await Message.findAll({
      where: { chatId: id },
      include: [
        { model: User, as: 'sender', attributes: ['id', 'firstName', 'lastName', 'avatarUrl'] },
      ],
      order: [['createdAt', 'ASC']],
      limit: 100,
    });

    // تحديث الرسائل كمقروءة
    await Message.update(
      { isRead: true, readAt: new Date() },
      {
        where: {
          chatId: id,
          senderId: { [Op.ne]: userId },
          isRead: false,
        },
      }
    );

    res.json({
      success: true,
      data: {
        chat,
        messages,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * بدء محادثة جديدة
 */
export const startChat = async (req: any, res: Response) => {
  try {
    const { agentId, subject } = req.body;
    const userId = req.user.id;

    // التحقق من وجود محادثة سابقة
    const existingChat = await Chat.findOne({
      where: {
        userId,
        agentId,
        status: 'active',
      },
    });

    if (existingChat) {
      return res.json({
        success: true,
        data: existingChat,
        message: 'هناك محادثة نشطة بالفعل',
      });
    }

    // إنشاء محادثة جديدة باستخدام الدالة المساعدة
    const chat = await createChatRecord({
      userId,
      agentId,
      subject,
      status: 'active',
    });

    res.status(201).json({
      success: true,
      data: chat,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * إغلاق محادثة
 */
export const closeChat = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const chat = await Chat.findOne({
      where: {
        id,
        [Op.or]: [{ userId }, { agentId: userId }],
      },
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'المحادثة غير موجودة',
      });
    }

    await chat.update({ status: 'closed' });

    res.json({
      success: true,
      message: 'تم إغلاق المحادثة',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * الحصول على محادثات الدعم (للمسؤولين)
 */
export const getSupportChats = async (req: any, res: Response) => {
  try {
    const { status = 'pending' } = req.query;

    const chats = await Chat.findAll({
      where: { status, agentId: null },
      include: [
        { model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'avatarUrl'] },
        {
          model: Message,
          as: 'messages',
          limit: 1,
          order: [['createdAt', 'DESC']],
          separate: true,
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    res.json({
      success: true,
      data: chats,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * قبول محادثة دعم (للمسؤولين)
 */
export const acceptSupportChat = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const agentId = req.user.id;

    const chat = await Chat.findByPk(id);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'المحادثة غير موجودة',
      });
    }

    if (chat.agentId) {
      return res.status(400).json({
        success: false,
        message: 'المحادثة مقبولة بالفعل',
      });
    }

    await chat.update({ agentId, status: 'active' });

    // إرسال رسالة ترحيبية باستخدام الدالة المساعدة
    await createMessageRecord({
      chatId: parseInt(id),
      senderId: agentId,
      content: 'مرحباً، كيف يمكنني مساعدتك اليوم؟',
      messageType: 'text',
    });

    res.json({
      success: true,
      message: 'تم قبول المحادثة',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * إرسال رسالة جديدة
 */
export const sendMessage = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { content, messageType = 'text' } = req.body;
    const userId = req.user.id;

    // التحقق من وجود المحادثة
    const chat = await Chat.findOne({
      where: {
        id,
        [Op.or]: [{ userId }, { agentId: userId }],
        status: 'active',
      },
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'المحادثة غير موجودة أو غير نشطة',
      });
    }

    // إنشاء الرسالة باستخدام الدالة المساعدة
    const message = await createMessageRecord({
      chatId: parseInt(id),
      senderId: userId,
      content,
      messageType,
    });

    // تحديث وقت آخر رسالة في المحادثة
    await chat.update({ lastMessageAt: new Date() });

    // تضمين معلومات المرسل
    const messageWithSender = await Message.findByPk(message.id, {
      include: [
        { model: User, as: 'sender', attributes: ['id', 'firstName', 'lastName', 'avatarUrl'] },
      ],
    });

    res.status(201).json({
      success: true,
      data: messageWithSender,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * تحديث حالة الرسائل كمقروءة
 */
export const markMessagesAsRead = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // التحقق من وجود المحادثة
    const chat = await Chat.findOne({
      where: {
        id,
        [Op.or]: [{ userId }, { agentId: userId }],
      },
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'المحادثة غير موجودة',
      });
    }

    // تحديث الرسائل كمقروءة
    const result = await Message.update(
      { isRead: true, readAt: new Date() },
      {
        where: {
          chatId: id,
          senderId: { [Op.ne]: userId },
          isRead: false,
        },
      }
    );

    res.json({
      success: true,
      message: `تم تحديث ${result[0]} رسالة كمقروءة`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * حذف محادثة
 */
export const deleteChat = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const chat = await Chat.findOne({
      where: {
        id,
        [Op.or]: [{ userId }, { agentId: userId }],
      },
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'المحادثة غير موجودة',
      });
    }

    // حذف الرسائل أولاً (إذا كان هناك علاقة حذف متتالي)
    await Message.destroy({ where: { chatId: id } });
    
    // ثم حذف المحادثة
    await chat.destroy();

    res.json({
      success: true,
      message: 'تم حذف المحادثة بنجاح',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};