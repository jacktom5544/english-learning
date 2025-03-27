import mongoose, { Schema, model, models } from 'mongoose';

export interface IQuizQuestion {
  question: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
}

export interface IQuizResult {
  question: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
  userAnswer: number | null;
  isCorrect: boolean;
}

export interface IQuiz extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  questions: IQuizQuestion[];
  results?: IQuizResult[];
  completed: boolean;
  score: number;
  createdAt: Date;
  updatedAt: Date;
}

const QuizSchema = new Schema<IQuiz>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    questions: [
      {
        question: {
          type: String,
          required: true,
        },
        choices: {
          type: [String],
          required: true,
        },
        correctIndex: {
          type: Number,
          required: true,
        },
        explanation: {
          type: String,
          required: true,
        },
      },
    ],
    results: [
      {
        question: {
          type: String,
          required: true,
        },
        choices: {
          type: [String],
          required: true,
        },
        correctIndex: {
          type: Number,
          required: true,
        },
        explanation: {
          type: String,
          required: true,
        },
        userAnswer: {
          type: Number,
          default: null,
        },
        isCorrect: {
          type: Boolean,
          required: true,
        },
      },
    ],
    completed: {
      type: Boolean,
      default: false,
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

const Quiz = models.Quiz || model<IQuiz>('Quiz', QuizSchema);

export default Quiz; 