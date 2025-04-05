import { ReactNode } from 'react';
import { ICoachingSession } from '@/models/Coaching';
import { IUser } from '@/models/User';
import { JapaneseTeacherKey } from '@/lib/japanese-teachers';

// CoachingContainer component types
export interface CoachingContainerProps {
  user: IUser;
  initialSessions: Array<Partial<ICoachingSession>>;
}

declare module './CoachingContainer' {
  export default function CoachingContainer(props: CoachingContainerProps): ReactNode;
}

// CoachingList component types
export interface CoachingListProps {
  sessions: Array<Partial<ICoachingSession>>;
  onSelectSession: (sessionId: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (sessionId: string) => void;
  currentSessionId: string | null;
  isLoading: boolean;
}

declare module './CoachingList' {
  export default function CoachingList(props: CoachingListProps): ReactNode;
}

// CoachingInterface component types
export interface CoachingInterfaceProps {
  session: ICoachingSession;
  onSessionUpdate: () => void;
}

declare module './CoachingInterface' {
  export default function CoachingInterface(props: CoachingInterfaceProps): ReactNode;
}

// TypingIndicator component types
export interface TypingIndicatorProps {
  teacherKey: JapaneseTeacherKey;
}

declare module './TypingIndicator' {
  export default function TypingIndicator(props: TypingIndicatorProps): ReactNode;
} 