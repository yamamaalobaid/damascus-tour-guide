import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import User from './User';

interface ChatAttributes {
  id: number;
  userId: number;
  agentId?: number | null;
  status: string;
  subject?: string;
  lastMessageAt: Date;
  createdAt?: Date;
}

class Chat extends Model<ChatAttributes> implements ChatAttributes {
  public id!: number;
  public userId!: number;
  public agentId?: number;
  public status!: string;
  public subject?: string;
  public lastMessageAt!: Date;
  public readonly createdAt!: Date;
}

Chat.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    agentId: {
      type: DataTypes.INTEGER,
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'active',
      validate: {
        isIn: [['active', 'closed', 'resolved']],
      },
    },
    subject: {
      type: DataTypes.STRING(200),
    },
    lastMessageAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'Chats',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: false,
  }
);

Chat.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Chat.belongsTo(User, { foreignKey: 'agentId', as: 'agent' });

export default Chat;