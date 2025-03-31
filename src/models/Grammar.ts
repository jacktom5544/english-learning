import mongoose, { Schema, model, models } from 'mongoose';

export interface IGrammar extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  topics: string[];
  essays: string[];
  grammaticalErrors: {
    category: string;
    count: number;
  }[];
  preferredTeacher: 'hiroshi' | 'reiko' | 'iwao' | 'taro';
  conversation: {
    sender: 'user' | 'teacher';
    content: string;
    timestamp: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const GrammarSchema = new Schema<IGrammar>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    topics: [{
      type: String,
      required: true,
    }],
    essays: [{
      type: String,
      default: '',
    }],
    grammaticalErrors: [{
      category: {
        type: String,
        required: true,
      },
      count: {
        type: Number,
        default: 1,
      }
    }],
    preferredTeacher: {
      type: String,
      enum: ['hiroshi', 'reiko', 'iwao', 'taro'],
      default: 'taro',
    },
    conversation: [{
      sender: {
        type: String,
        enum: ['user', 'teacher'],
        required: true,
      },
      content: {
        type: String,
        required: true,
      },
      timestamp: {
        type: Date,
        default: Date.now,
      },
    }],
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
GrammarSchema.index({ userId: 1 });

const Grammar = models.Grammar || model<IGrammar>('Grammar', GrammarSchema);

export default Grammar; 