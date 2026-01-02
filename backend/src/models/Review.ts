import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';
import User from './User';
import Place from './Place';

interface ReviewAttributes {
  id: number;
  placeId: number;
  userId: number;
  rating: number;
  commentAr?: string;
  commentEn?: string;
  images?: string[];
  helpfulCount: number;
  isVerifiedVisit: boolean;
  visitDate?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

class Review extends Model<ReviewAttributes> implements ReviewAttributes {
  public id!: number;
  public placeId!: number;
  public userId!: number;
  public rating!: number;
  public commentAr?: string;
  public commentEn?: string;
  public images?: string[];
  public helpfulCount!: number;
  public isVerifiedVisit!: boolean;
  public visitDate?: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Review.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    placeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Place,
        key: 'id',
      },
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: 'id',
      },
    },
    rating: {
      type: DataTypes.DECIMAL(2, 1),
      allowNull: false,
      validate: {
        min: 1,
        max: 5,
      },
    },
    commentAr: {
      type: DataTypes.TEXT,
    },
    commentEn: {
      type: DataTypes.TEXT,
    },
    images: {
      type: DataTypes.JSON, // أو DataTypes.TEXT
      defaultValue: [], // إذا كان JSON، أو '[]' إذا كان TEXT
    },
    helpfulCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    isVerifiedVisit: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    visitDate: {
      type: DataTypes.DATEONLY,
    },
  },
  {
    sequelize,
    tableName: 'Reviews',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['userId', 'placeId'], // لمنع أكثر من تقييم من نفس المستخدم للمكان نفسه
      },
      {
        fields: ['placeId'],
      },
      {
        fields: ['rating'],
      },
      {
        fields: ['helpfulCount'], // يمكنك إضافة هذا الفهرس
      },
    ],
  }
);

// Associations
Review.belongsTo(User, { foreignKey: 'userId' });
Review.belongsTo(Place, { foreignKey: 'placeId' });

export default Review;