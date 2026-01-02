import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import User from './User';
import Place from './Place';

interface FavoriteAttributes {
  id?: number; // اجعل id اختياريًا
  placeId: number;
  userId: number;
  category?: string;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

class Favorite extends Model<FavoriteAttributes> implements FavoriteAttributes {
  public id!: number;
  public userId!: number;
  public placeId!: number;
  public category?: string;
  public notes?: string;
  public readonly createdAt!: Date;
}

Favorite.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
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
    category: {
      type: DataTypes.STRING(50),
      validate: {
        isIn: [['want_to_visit', 'visited', 'favorite']],
      },
    },
    notes: {
      type: DataTypes.STRING(500),
    },
  },
  {
    sequelize,
    tableName: 'Favorites',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: false,
    indexes: [
      {
        unique: true,
        fields: ['userId', 'placeId'],
      },
    ],
  }
);

Favorite.belongsTo(User, { foreignKey: 'userId' });
Favorite.belongsTo(Place, { foreignKey: 'placeId' });

export default Favorite;