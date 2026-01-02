import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import bcrypt from 'bcryptjs';

interface UserAttributes {
  id: number;
  email: string;
  password: string;
  firstName?: string | null;  // اسمح بـ null
  lastName?: string | null;   // اسمح بـ null
  phone?: string | null;      // اسمح بـ null
  language?: string | null;   // اسمح بـ null
  avatarUrl?: string | null;  // اسمح بـ null
  isVerified: boolean;
  verificationToken?: string | null;  // اسمح بـ null
  resetPasswordToken?: string | null; // اسمح بـ null
  resetPasswordExpire?: Date | null;  // اسمح بـ null
  lastLogin?: Date | null;    // اسمح بـ null
  createdAt?: Date;
  updatedAt?: Date;
}

interface UserCreationAttributes extends Optional<UserAttributes, 'id'> {}

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: number;
  public email!: string;
  public phone?: string;
  public password!: string;
  public firstName?: string;
  public lastName?: string;
  public avatarUrl?: string;
  public language!: string;
  public isVerified!: boolean;
  public verificationToken?: string;
  public resetPasswordToken?: string;
  public resetPasswordExpire?: Date;
  public lastLogin?: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // التحقق من كلمة المرور
  public async comparePassword(enteredPassword: string): Promise<boolean> {
    return await bcrypt.compare(enteredPassword, this.password);
  }

  // تجزئة كلمة المرور قبل الحفظ
  public static async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 10);
  }
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    phone: {
      type: DataTypes.STRING(20),
      unique: true,
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    firstName: {
      type: DataTypes.STRING(50),
    },
    lastName: {
      type: DataTypes.STRING(50),
    },
    avatarUrl: {
      type: DataTypes.STRING(500),
    },
    language: {
      type: DataTypes.STRING(10),
      defaultValue: 'ar',
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    verificationToken: {
      type: DataTypes.STRING(255),
    },
    resetPasswordToken: {
      type: DataTypes.STRING(255),
    },
    resetPasswordExpire: {
      type: DataTypes.DATE,
    },
    lastLogin: {
      type: DataTypes.DATE,
    },
  },
  {
    sequelize,
    tableName: 'Users',
    timestamps: true,
    hooks: {
      beforeCreate: async (user: User) => {
        if (user.password) {
          user.password = await User.hashPassword(user.password);
        }
      },
      beforeUpdate: async (user: User) => {
        if (user.changed('password')) {
          user.password = await User.hashPassword(user.password);
        }
      },
    },
  }
);

export default User;