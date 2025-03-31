import mongoose, { Schema, model, models } from 'mongoose';

export interface IGrammar extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  topics: string[];
  essays: string[];
  grammaticalErrors: {
    category: string;
    count: number;
  }[];
  errorDetails: {
    essayIndex: number;
    errors: {
      type: string;
      text: string;
      startPos: number;
      endPos: number;
      explanation: string;
    }[];
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
    errorDetails: [{
      essayIndex: {
        type: Number,
        required: true
      },
      errors: [{
        type: {
          type: String,
          required: true
        },
        text: {
          type: String,
          required: true
        },
        startPos: {
          type: Number,
          required: true
        },
        endPos: {
          type: Number,
          required: true
        },
        explanation: {
          type: String,
          required: true
        }
      }]
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