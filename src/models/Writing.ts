import mongoose, { Schema, model, models } from 'mongoose';

export interface IWriting extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  topic: string;
  content: string;
  feedback: string;
  score: number;
  createdAt: Date;
  updatedAt: Date;
}

const WritingSchema = new Schema<IWriting>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    topic: {
      type: String,
      required: [true, 'トピックを入力してください'],
    },
    content: {
      type: String,
      default: '',
    },
    feedback: {
      type: String,
      default: '',
    },
    score: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
WritingSchema.index({ userId: 1 });

const Writing = models.Writing || model<IWriting>('Writing', WritingSchema);

export default Writing; 