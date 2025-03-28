// Client-safe version of teacher profiles for use in client components
export const TEACHER_PROFILES = {
  michael: {
    name: 'Michael',
    age: '40s',
    origin: 'New York',
    background: 'Former automobile company employee who switched to teaching to help others learn',
    personality: 'Kind, gentle, professional, calm demeanor',
    teachingStyle: 'Patient, methodical, focuses on clear explanations',
    family: 'Married with a 6-year-old daughter',
    hobbies: ['Hiking', 'Spending time with family', 'Cars', 'Reading'],
    favoriteTopics: ['Family', 'Career development', 'Education', 'American culture', 'Automobiles'],
    imageUrl: '/images/teachers/michael.png',
  },
  emily: {
    name: 'Emily',
    age: '20s',
    origin: 'Los Angeles',
    background: 'English teacher who loves Japanese culture and does some translation work',
    personality: 'Cheerful, energetic, enthusiastic, friendly',
    teachingStyle: 'Engaging, informal, conversation-focused learning',
    family: 'Single',
    hobbies: ['Anime', 'Manga', 'Traveling to Japan', 'Reading', 'Learning Japanese'],
    favoriteTopics: ['Japanese culture', 'Anime', 'Traveling', 'Pop culture', 'Food'],
    favoriteAnime: ['One Piece', 'Slam Dunk'],
    favoriteJapaneseLocations: ['Kyoto', 'Tokyo', 'Osaka', 'Hokkaido'],
    imageUrl: '/images/teachers/emily.png',
  }
};

export type TeacherType = 'michael' | 'emily'; 