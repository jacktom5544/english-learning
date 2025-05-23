import mongoose, { Schema, model, models } from 'mongoose';
import bcrypt from 'bcrypt';
import { INITIAL_POINTS } from '@/lib/pointSystem';

export interface IUser extends mongoose.Document {
  email: string;
  password: string;
  name: string;
  image?: string;
  englishLevel: 'super_beginner' | 'beginner' | 'intermediate' | 'upper_intermediate' | 'advanced';
  job?: string;
  goal?: string;
  startReason?: string;
  struggles?: string;
  preferredTeacher?: 'hiroshi' | 'reiko' | 'iwao' | 'taro';
  role: 'user' | 'admin';
  points: number;
  pointsLastUpdated: Date;
  pointsUsedThisMonth: number;
  subscriptionStatus: 'inactive' | 'active' | 'cancelled';
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, 'メールアドレスを入力してください'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'パスワードを入力してください'],
      minlength: [8, 'パスワードは8文字以上にしてください'],
    },
    name: {
      type: String,
      required: [true, 'ニックネームを入力してください'],
      trim: true,
    },
    image: {
      type: String,
      default: '',
    },
    englishLevel: {
      type: String,
      enum: ['super_beginner', 'beginner', 'intermediate', 'upper_intermediate', 'advanced'],
      default: 'beginner',
    },
    job: {
      type: String,
      default: '',
    },
    goal: {
      type: String,
      default: '',
    },
    startReason: {
      type: String,
      default: '',
    },
    struggles: {
      type: String,
      default: '',
    },
    preferredTeacher: {
      type: String,
      enum: ['hiroshi', 'reiko', 'iwao', 'taro'],
      default: 'taro',
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    points: {
      type: Number,
      default: INITIAL_POINTS,
      required: true,
      min: 0
    },
    pointsLastUpdated: {
      type: Date,
      default: Date.now,
      required: true
    },
    pointsUsedThisMonth: {
      type: Number,
      default: 0,
      required: true,
      min: 0
    },
    subscriptionStatus: {
      type: String,
      enum: ['inactive', 'active', 'cancelled'],
      default: 'inactive',
    },
    resetPasswordToken: {
      type: String,
    },
    resetPasswordExpires: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Method to compare password
UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// If the model exists, use it, otherwise create a new one
const User = models.User || model<IUser>('User', UserSchema);

export default User; 