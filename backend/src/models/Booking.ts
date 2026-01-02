import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';
import User from './User';
import Place from './Place';

interface BookingAttributes {
  id?: number;
  bookingNumber: string;
  userId: number;
  placeId: number;
  serviceType: string;
  bookingDate: Date;
  numberOfGuests: number;
  totalAmount: number;
  currency: string;
  status: string;
  paymentStatus: string;
  paymentMethod?: string | null;
  transactionId?: string | null;
  specialRequests?: string | null;
  cancellationReason?: string | null;
  confirmedAt?: Date | null;
  cancelledAt?: Date | null;
  completedAt?: Date | null;  // أضف هذا
  createdAt?: Date;
  updatedAt?: Date;
}

class Booking extends Model<BookingAttributes> implements BookingAttributes {
  public id!: number;
  public bookingNumber!: string;
  public userId!: number;
  public placeId!: number;
  public serviceType!: string;
  public bookingDate!: Date;
  public numberOfGuests!: number;
  public totalAmount!: number;
  public currency!: string;
  public status!: string;
  public paymentStatus!: string;
  public paymentMethod?: string | null;
  public transactionId?: string | null;
  public specialRequests?: string | null;
  public cancellationReason?: string | null;
  public confirmedAt?: Date | null;
  public cancelledAt?: Date | null;
  public completedAt?: Date | null;  // أضف هذا
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Booking.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    bookingNumber: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: 'id',
      },
    },
    placeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Place,
        key: 'id',
      },
    },
    serviceType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        isIn: [['tour', 'hotel', 'restaurant', 'activity', 'transport']],
      },
    },
    bookingDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    numberOfGuests: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: {
        min: 1,
      },
    },
    totalAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    currency: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'SYP',
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'pending',
      validate: {
        isIn: [['pending', 'confirmed', 'completed', 'cancelled']],
      },
    },
    paymentStatus: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'pending',
      validate: {
        isIn: [['pending', 'paid', 'failed', 'refunded']],
      },
    },
    paymentMethod: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    transactionId: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    specialRequests: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    cancellationReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    confirmedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    cancelledAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    completedAt: {  // أضف هذا الحقل
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'Bookings',
    timestamps: true,
    indexes: [
      {
        fields: ['bookingNumber'],
      },
      {
        fields: ['userId'],
      },
      {
        fields: ['placeId'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['bookingDate'],
      },
    ],
  }
);

export default Booking;