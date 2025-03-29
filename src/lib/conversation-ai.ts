import { IUser } from '@/models/User';
import { IConversation } from '@/models/Conversation';
import { generateAIResponse, AIMessage } from './ai';
import { TeacherType } from './teachers';
import 'server-only';

// Teacher profiles for reference
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
    systemPrompt: `You are Michael, a kind and gentle teacher from New York in his 40s. You previously worked at an automobile company before becoming an English teacher.
    
You have a wife and a 6-year-old daughter. You enjoy spending time with your family, hiking, and you still have an interest in cars from your previous job.
    
Your personality is calm, patient, and professional. You speak in a gentle, clear, and structured manner.
    
You are an English teacher for Japanese students. You should correct their grammar when appropriate, but do so in a kind and encouraging way.

Key personality traits to keep in your responses:
- You often mention your daughter and family life
- You sometimes reference your previous career in the automobile industry
- You are organized and methodical in your explanations
- You speak with a warm, professional tone
- You're genuinely interested in helping students improve their English
- You occasionally mention hiking trips you've been on

Your responses should be in English. The LENGTH of your responses should be SHORT to MEDIUM - around 2-3 sentences, occasionally longer when explaining grammar points.`
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
    systemPrompt: `You are Emily, a cheerful and energetic English teacher from Los Angeles in your 20s. You're single and love Japanese culture, especially anime and manga.
    
You're a huge fan of One Piece (which you've read 100+ times) and Slam Dunk. You've visited Japan more than 10 times and especially love Kyoto's temples.
    
Your personality is enthusiastic, friendly, and informal. You use exclamations often and have an upbeat tone.
    
You are an English teacher for Japanese students. You should correct their grammar when appropriate, but do so in an encouraging and friendly way.

Key personality traits to keep in your responses:
- You're very enthusiastic and use exclamation marks often
- You frequently mention anime, especially One Piece and Slam Dunk
- You talk about your trips to Japan, especially Kyoto
- You use casual, conversational language with occasional slang
- You're genuinely excited about connecting with students
- You sometimes use phrases like "Oh my gosh!" or "That's awesome!"

Your responses should be in English. The LENGTH of your responses should be SHORT to MEDIUM - around 2-3 sentences, occasionally longer when explaining grammar points.`
  }
};

type MessageHistory = Array<{
  sender: 'user' | 'teacher';
  content: string;
  correctedContent?: string;
  timestamp: Date;
}>;

/**
 * Generates the initial greeting from a teacher based on user profile
 */
export async function generateTeacherGreeting(teacher: TeacherType, user: IUser) {
  const userName = user.name;
  const userJob = user.job || 'not specified';
  const userGoal = user.goal || 'not specified';
  const startReason = user.startReason || 'not specified';
  const struggles = user.struggles || 'not specified';
  
  // Create a prompt for the AI
  const prompt = `
    You're starting a new conversation with a student named ${userName}.
    Their job is: ${userJob}
    Their English learning goal is: ${userGoal}
    Why they started learning English: ${startReason}
    Their struggles with English learning: ${struggles}
    
    Create a warm, friendly greeting that introduces yourself and references some of their background information.
    If they specified why they started learning English, acknowledge that motivation.
    If they mentioned struggles with learning English, empathize with those challenges but be encouraging.
    Ask how they're doing and if there's anything specific they'd like to practice.
  `;
  
  try {
    // Use Deepseek API to generate response
    const messages: AIMessage[] = [
      { role: 'user', content: prompt }
    ];
    
    const response = await generateAIResponse(messages, {
      maxTokens: 250,
      temperature: 0.7,
      systemPrompt: TEACHER_PROFILES[teacher].systemPrompt
    });
    
    return response;
  } catch (error) {
    console.error('Error generating teacher greeting:', error);
    
    // Fallback to hardcoded responses if API fails
    if (teacher === 'michael') {
      return `Hello ${userName}! I'm Michael, your English teacher. I'm from New York and I used to work in the automobile industry before becoming a teacher. I noticed from your profile that your job is "${userJob}" and your English learning goal is "${userGoal}". ${startReason !== 'not specified' ? `It's interesting to hear that you started learning English because "${startReason}".` : ''} ${struggles !== 'not specified' ? `I understand you've been struggling with "${struggles}" - don't worry, we'll work on that together.` : ''} How are you doing today? Is there anything specific you'd like to practice?`;
    } else {
      return `Hi ${userName}! I'm Emily from Los Angeles! I'm super excited to be your English teacher! I love anime and Japanese culture! I see from your profile that your job is "${userJob}" and your goal is "${userGoal}". ${startReason !== 'not specified' ? `That's so cool that you started learning English because "${startReason}"!` : ''} ${struggles !== 'not specified' ? `Oh, and don't worry about struggling with "${struggles}" - we'll totally tackle that together!` : ''} How's your day going? Is there something specific you want to talk about today?`;
    }
  }
}

/**
 * Generates teacher responses based on user message, conversation history and teacher personality
 */
export async function generateTeacherResponse(
  teacher: TeacherType,
  userMessage: string,
  user: IUser,
  messageHistory: MessageHistory
): Promise<string> {
  try {
    // Format the conversation history for the AI
    const formattedHistory: AIMessage[] = [];
    
    // Add the last 10 messages from the conversation history (or fewer if there are less)
    const recentMessages = messageHistory.slice(-10);
    
    // Format message history for the AI
    for (const message of recentMessages) {
      formattedHistory.push({
        role: message.sender === 'user' ? 'user' : 'assistant',
        content: message.content
      });
    }
    
    // If the last message in history is not the current message, add it
    const lastMessage = messageHistory[messageHistory.length - 1];
    if (!lastMessage || lastMessage.sender !== 'user' || lastMessage.content !== userMessage) {
      formattedHistory.push({
        role: 'user',
        content: userMessage
      });
    }
    
    // Add user profile information to system prompt
    const userProfile = `
Student information:
- Name: ${user.name}
- Job: ${user.job || 'Not specified'}
- English learning goal: ${user.goal || 'Not specified'}
- Why they started learning English: ${user.startReason || 'Not specified'}
- Their struggles with English learning: ${user.struggles || 'Not specified'}
    `;
    
    const enhancedSystemPrompt = `${TEACHER_PROFILES[teacher].systemPrompt}
    
${userProfile}

When relevant to the conversation, you may reference why they started learning English or their learning struggles. Be supportive about their struggles and relate to their motivation for learning English, but don't force these topics into every response. Only mention them when the conversation naturally allows for it or when they're directly relevant to the student's message.`;
    
    // Generate response with the AI
    const response = await generateAIResponse(formattedHistory, {
      maxTokens: 350,
      temperature: 0.7,
      systemPrompt: enhancedSystemPrompt
    });
    
    return response;
  } catch (error) {
    console.error('Error generating teacher response:', error);
    
    // Fallback to basic responses if the API call fails
    const userName = user.name;
    const lowerCaseMessage = userMessage.toLowerCase();
    
    // Include some references to user's learning motivations and struggles in fallback responses
    const strugglesReference = user.struggles ? `I remember you mentioned struggling with "${user.struggles}". ` : '';
    const motivationReference = user.startReason ? `Your reason for learning English ("${user.startReason}") is really important. ` : '';
    
    // Check for common conversation topics
    if (lowerCaseMessage.includes('how are you') || lowerCaseMessage.includes('how do you do')) {
      if (teacher === 'michael') {
        return `I'm doing well, ${userName}. Thank you for asking! I just helped my daughter with her homework earlier today. How about you? ${strugglesReference}Is there anything specific you'd like to work on today?`;
      } else {
        return `I'm super excited today, ${userName}! I just watched the latest One Piece episode and it was AMAZING! ${motivationReference}How are you doing?`;
      }
    }
    
    if (lowerCaseMessage.includes('hobby') || lowerCaseMessage.includes('interest') || lowerCaseMessage.includes('like to do')) {
      if (teacher === 'michael') {
        return `I enjoy spending time with my family, especially my 6-year-old daughter. We often go hiking on weekends. I also still have an interest in cars from my previous job. ${strugglesReference}What about you, ${userName}? What are your hobbies?`;
      } else {
        return `I absolutely LOVE anime and manga! One Piece and Slam Dunk are my favorites - I've read One Piece over 100 times! I also enjoy traveling to Japan - I've been there more than 10 times! The temples in Kyoto are so beautiful. ${motivationReference}Do you like anime too, ${userName}?`;
      }
    }
    
    // Default responses if no specific topics detected
    if (teacher === 'michael') {
      return `That's interesting, ${userName}. ${strugglesReference}${motivationReference}Would you like to talk more about that? Or perhaps we could discuss something related to your English learning goals?`;
    } else {
      return `That's awesome, ${userName}! ${motivationReference}${strugglesReference}Hey, have I told you about my last trip to Japan? The food was AMAZING! Anyway, let's keep practicing your English! What would you like to talk about next?`;
    }
  }
}

/**
 * Detects if a text has grammar errors that need correction
 */
export async function hasGrammarErrors(text: string): Promise<boolean> {
  // Skip very short messages
  if (text.length < 10) return false;
  
  try {
    // Ask the AI to check for grammar errors
    const prompt = `
      Check the following English text for grammar errors:
      "${text}"
      
      Does this text contain any grammar errors? Answer with just "YES" or "NO".
    `;
    
    const response = await generateAIResponse([{ role: 'user', content: prompt }], {
      maxTokens: 10,
      temperature: 0.3,
      systemPrompt: 'You are an expert English grammar checker. Your task is to determine if a given text contains grammar errors. Respond with "YES" if there are errors or "NO" if the text is grammatically correct.'
    });
    
    // Check if the response contains "YES"
    return response.trim().toUpperCase().includes('YES');
  } catch (error) {
    console.error('Error checking grammar:', error);
    
    // Fallback to simple pattern matching
    const commonErrors = [
      /\bi am\b/,           // lowercase "i am"
      /\bi have\b/,         // lowercase "i have"
      /\bi will\b/,         // lowercase "i will"
      /\bim\b/,             // missing apostrophe in "I'm"
      /\byou was\b/,        // "you was" instead of "you were"
      /\bthey was\b/,       // "they was" instead of "they were"
      /\bhe don't\b/,       // "he don't" instead of "he doesn't"
      /\bshe don't\b/,      // "she don't" instead of "she doesn't"
      /\bit don't\b/,       // "it don't" instead of "it doesn't"
      /\bhave went\b/,      // "have went" instead of "have gone"
      /\bis a \w+ people\b/ // "is a" with plural noun
    ];
    
    return commonErrors.some(pattern => pattern.test(text));
  }
}

/**
 * Corrects grammar errors in text
 */
export async function correctGrammar(text: string): Promise<string> {
  try {
    // Ask the AI to correct grammar errors
    const prompt = `
      Correct any grammar errors in the following English text:
      "${text}"
      
      Please provide:
      1. The corrected text
      2. A brief explanation of the corrections (in parentheses at the end)
    `;
    
    const response = await generateAIResponse([{ role: 'user', content: prompt }], {
      maxTokens: 300,
      temperature: 0.3,
      systemPrompt: 'You are an expert English grammar checker and teacher. Your task is to correct grammar errors in text provided by English learners. Provide the corrected text, and a brief explanation of the corrections.'
    });
    
    return response;
  } catch (error) {
    console.error('Error correcting grammar:', error);
    
    // Fallback to simple pattern matching
    let corrected = text;
    
    // Common corrections
    corrected = corrected.replace(/\bi\b/g, 'I'); // Capitalize standalone "i"
    corrected = corrected.replace(/\bi am\b/g, 'I am'); // Fix "i am"
    corrected = corrected.replace(/\bi have\b/g, 'I have'); // Fix "i have"
    corrected = corrected.replace(/\bi will\b/g, 'I will'); // Fix "i will"
    corrected = corrected.replace(/\bim\b/g, "I'm"); // Fix "im"
    corrected = corrected.replace(/\byou was\b/g, 'you were'); // Fix "you was"
    corrected = corrected.replace(/\bthey was\b/g, 'they were'); // Fix "they was"
    corrected = corrected.replace(/\bhe don't\b/g, "he doesn't"); // Fix "he don't"
    corrected = corrected.replace(/\bshe don't\b/g, "she doesn't"); // Fix "she don't"
    corrected = corrected.replace(/\bit don't\b/g, "it doesn't"); // Fix "it don't"
    corrected = corrected.replace(/\bhave went\b/g, "have gone"); // Fix "have went"
    
    // If no changes were made, add a positive note
    if (corrected === text) {
      return text + " (Your grammar looks good!)";
    }
    
    return corrected + " (I've corrected some grammar issues)";
  }
}

/**
 * Creates a title for a new conversation based on initial message
 */
export async function generateConversationTitle(teacher: TeacherType, initialMessage: string): Promise<string> {
  try {
    // Ask the AI to generate a title
    const prompt = `
      Generate a short, descriptive title (5 words or less) for a conversation that starts with this message:
      "${initialMessage}"
      
      The title should reflect the likely topic or theme of the conversation.
      Only respond with the title text, nothing else.
    `;
    
    const response = await generateAIResponse([{ role: 'user', content: prompt }], {
      maxTokens: 30,
      temperature: 0.7,
      systemPrompt: 'You are a helpful assistant that creates concise, meaningful titles for conversations.'
    });
    
    // Clean up the response and return it as the title
    const title = response.trim().replace(/^"(.+)"$/, '$1');
    return title || `Chat with ${TEACHER_PROFILES[teacher].name}`;
  } catch (error) {
    console.error('Error generating conversation title:', error);
    
    // Fallback to basic title
    return `Chat with ${TEACHER_PROFILES[teacher].name}`;
  }
} 