import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';
import Place from './Place';
import User from './User';

interface PlaceImageAttributes {
  id?: number;
  placeId: number;
  imageUrl: string;
  captionAr?: string | null;
  captionEn?: string | null;
  isPrimary: boolean;
  displayOrder: number;
  uploadedBy: number;
  createdAt?: Date;
  updatedAt?: Date;
}

class PlaceImage extends Model<PlaceImageAttributes> implements PlaceImageAttributes {
  public id!: number;
  public placeId!: number;
  public imageUrl!: string;
  public captionAr?: string | null;
  public captionEn?: string | null;
  public isPrimary!: boolean;
  public displayOrder!: number;
  public uploadedBy!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

PlaceImage.init(
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
    imageUrl: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    captionAr: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    captionEn: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    isPrimary: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    displayOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    uploadedBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: 'id',
      },
    },
  },
  {
    sequelize,
    tableName: 'PlaceImages',
    timestamps: true,
    indexes: [
      {
        fields: ['placeId'],
      },
      {
        fields: ['isPrimary'],
      },
      {
        fields: ['displayOrder'],
      },
    ],
  }
);

export default PlaceImage;