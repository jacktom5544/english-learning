import { IUser } from '@/models/User';
import { generateAIResponse, AIMessage } from './ai';
import { TeacherType } from './teachers';
import 'server-only';

// Define the structure for the grammar correction result
export interface GrammarCorrectionResult {
    correctedText: string | null;
    explanation: string | null;
}

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
    // Use Deepseek API to generate response directly
    const messages: AIMessage[] = [
      { role: 'user', content: prompt }
    ];
    
    // Await the API call directly without Promise.race
    const response = await generateAIResponse(messages, {
      maxTokens: 250,
      temperature: 0.7,
      systemPrompt: TEACHER_PROFILES[teacher].systemPrompt
    });
    
    return response;
  } catch (error) {
    console.error('Error generating teacher greeting:', error);
    
    // Return fallback greeting
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
- Level: ${user.englishLevel || 'Not specified'}
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
 * Corrects grammar errors in text and provides explanation based on user level.
 */
export async function correctGrammar(
    text: string,
    userLevel: string | undefined // Added userLevel parameter
): Promise<GrammarCorrectionResult> {
    // Skip very short messages
    if (!text || text.trim().length < 5) { 
        return { correctedText: null, explanation: null };
    }

    // Determine the explanation language based on user level
    const explanationLanguage = (userLevel === 'super_beginner' || userLevel === 'beginner') ? 'Japanese' : 'English';

    try {
        // Ask the AI to correct grammar errors and provide explanation
        const prompt = `
      Please analyze the following English text for grammatical errors:
      "${text}"

      If there are errors:
      1. Provide the corrected version of the text.
      2. Provide a brief explanation of the corrections. The explanation should be in ${explanationLanguage}.

      If there are NO grammatical errors:
      Simply respond with the JSON object: {"correctedText": null, "explanation": null}

      If there ARE errors, respond ONLY with a JSON object in the following format, containing the corrected text and the explanation in the specified language:
      {
        "correctedText": "The corrected sentence or phrase.",
        "explanation": "Explanation of the correction(s) in ${explanationLanguage}."
      }
      Do not include any other text or markdown formatting outside the JSON object.
    `;

        const response = await generateAIResponse([{ role: 'user', content: prompt }], {
            maxTokens: 400, // Increased slightly for potential JSON structure and explanation
            temperature: 0.3,
            systemPrompt: `You are an expert English grammar checker and teacher. Your task is to correct grammar errors in text provided by English learners. Respond strictly in the JSON format specified. Provide explanations in ${explanationLanguage} as requested.`
        });

        // Attempt to parse the JSON response
        try {
            // Clean potential markdown code fences
            const cleanedResponse = response.replace(/```json\n?|\n?```/g, '').trim();
            const result: GrammarCorrectionResult = JSON.parse(cleanedResponse);

            // Basic validation of the parsed structure
            if (typeof result.correctedText !== 'string' && result.correctedText !== null) {
                 console.warn('correctGrammar: AI response correctedText is not string or null:', result.correctedText);
                 throw new Error('Invalid correctedText format in AI response');
            }
             if (typeof result.explanation !== 'string' && result.explanation !== null) {
                 console.warn('correctGrammar: AI response explanation is not string or null:', result.explanation);
                 throw new Error('Invalid explanation format in AI response');
            }

            // If response indicates no errors, ensure consistency
             if (result.correctedText === null && result.explanation === null) {
                 return { correctedText: null, explanation: null };
             }
            // If correction exists, return it
             if (result.correctedText && result.explanation) {
                 return result;
             }
            // If structure is unexpected (e.g., one null, one not), treat as no correction
             console.warn('correctGrammar: AI response had unexpected null combination:', result);
             return { correctedText: null, explanation: null };

        } catch (parseError) {
            console.error('Error parsing grammar correction JSON response:', parseError, 'Raw response:', response);
            // If JSON parsing fails, return no correction
            return { correctedText: null, explanation: null };
        }

    } catch (error) {
        console.error('Error calling AI for grammar correction:', error);
        // Fallback if the AI call itself fails
        // We won't use regex fallback anymore as it doesn't fit the requirements well.
        return { correctedText: null, explanation: null }; 
    }
}

/**
 * Creates a title for a new conversation based on initial message
 */
export async function generateConversationTitle(
  teacher: TeacherType,
  initialMessageContent: string
): Promise<string> {
  try {
    // Create a prompt for the AI
    const prompt = `
      Generate a short, descriptive title (5 words or less) for a conversation that starts with this message:
      "${initialMessageContent}"
      
      The title should reflect the likely topic or theme of the conversation.
      Only respond with the title text, nothing else.
    `;
    
    // Await the API call directly without Promise.race
    const title = await generateAIResponse([{ role: 'user', content: prompt }], {
      maxTokens: 50,
      temperature: 0.5,
      systemPrompt: 'You are a helpful assistant that creates concise, meaningful titles for conversations.'
    });

    return title.replace(/"/g, ''); // Keep title cleaning logic
  } catch (error) {
    console.error('Error generating conversation title:', error);
    return `Chat with ${teacher} - ${new Date().toLocaleDateString()}`; // Keep fallback
  }
} 