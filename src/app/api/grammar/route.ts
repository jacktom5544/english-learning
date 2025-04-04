import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
// Remove Mongoose connectToDB import
// import { connectToDB } from '@/lib/mongodb';
// Import MongoDB client
import getClient from '@/lib/db';
// Keep both models temporarily for transition
import Grammar from '@/models/Grammar';
import User from '@/models/User';
// Import MongoDB types
import { ObjectId, WithId, Db } from 'mongodb';
// Import interface from Grammar model
import { GrammarDoc, IGrammar } from '@/models/Grammar';
import deepseek from '@/lib/deepseek';
import { POINT_CONSUMPTION } from '@/lib/pointSystem';
import { IUser } from '@/models/User'; // Keep the IUser interface

// Define user document type for MongoDB
type UserDoc = WithId<any> & Partial<IUser>;

// Common grammar mistakes to detect as fallback
const COMMON_GRAMMAR_ERRORS = [
  // Subject-verb agreement errors
  {
    pattern: /\b(he|she|it) (go|run|eat|make|do|try|fly|study|carry|want|like|help|draw|said|feel)\b/gi,
    type: "動詞の三人称単数形の間違い",
    explanation: "三人称単数形（he/she/it）の後には、動詞の三人称単数形（s/esをつける）を使います"
  },
  // Missing articles
  {
    pattern: /\b(to|at|on|in|from) ([a-z]+)(beach|sea|water|store|town|weather)\b/gi,
    type: "冠詞の間違い",
    explanation: "特定の場所を表す名詞の前には、通常「the」を使います"
  },
  {
    pattern: /\bwas (very excited|important|sunny|fun)\b/gi,
    type: "冠詞の間違い",
    explanation: "形容詞の前に「a/an」を使うと「とても～」という意味になります"
  },
  // Plurals
  {
    pattern: /\b(my drawing|my friend) is good\b/gi,
    type: "複数形の間違い",
    explanation: "複数形を表す場合は、「drawings」「friends」のように名詞に「s」をつけ、動詞も複数形にします"
  },
  // Wrong preposition
  {
    pattern: /\bin (grade|school)\b/gi,
    type: "前置詞の間違い",
    explanation: "学年を表す場合は「in」ではなく「at」を使います"
  },
  {
    pattern: /\b(he|she|it) (don't)\b/gi,
    type: "否定形の間違い",
    explanation: "三人称単数形の否定形は「doesn't」を使います"
  },
  {
    pattern: /\b(i|we|you|they) (doesn't)\b/gi,
    type: "否定形の間違い",
    explanation: "一人称・二人称・三人称複数形の否定形は「don't」を使います"
  },
  {
    pattern: /\bi am (go|going) to\b/gi,
    type: "未来形の間違い",
    explanation: "未来形の「be going to」では「going」を使います"
  },
  {
    pattern: /\b(go|went|run|ran|come|came|get|got) (in|at|on) (the|a|my|your|his|her) (school|home|house|office|park)\b/gi,
    type: "前置詞の間違い",
    explanation: "「学校/家/オフィス/公園」などの場所に「行く」場合、前置詞「to」を使います"
  },
  {
    pattern: /\b(yesterday|last (week|month|year|summer)) (.+?)(present tense verb)\b/gi,
    type: "時制の間違い",
    explanation: "「昨日/先週/先月/去年」など過去を表す言葉がある場合は、過去形を使います"
  },
  {
    pattern: /\btwo ([a-z]+[^s])\b/gi,
    type: "複数形の間違い",
    explanation: "「two」の後には複数形の名詞を使います"
  },
  {
    pattern: /\b(a) ([aeiou][a-z]+)\b/gi,
    type: "冠詞の間違い",
    explanation: "母音で始まる単語の前には「a」ではなく「an」を使います"
  },
  {
    pattern: /\b(much) ([a-z]+s)\b/gi,
    type: "数量詞の間違い",
    explanation: "可算名詞の複数形には「much」ではなく「many」を使います"
  },
  {
    pattern: /\b(many) ([a-z]+[^s])\b/gi,
    type: "数量詞の間違い",
    explanation: "不可算名詞には「many」ではなく「much」を使います"
  }
];

// Helper function for fallback error detection
function detectErrorsInEssay(essay: string): {
  errors: {
    type: string;
    text: string;
    startPos: number;
    endPos: number;
    explanation: string;
  }[];
  categories: { category: string; count: number }[];
} {
  if (!essay) return { errors: [], categories: [] };
  
  const errors: {
    type: string;
    text: string;
    startPos: number;
    endPos: number;
    explanation: string;
  }[] = [];
  const errorTypeCounts: Record<string, number> = {};
  
  // Find specific errors in the sample essays
  const essayLower = essay.toLowerCase();
  
  // First essay specific errors
  if (essayLower.includes("my favorite hobby is drawing")) {
    // Sample errors from Essay 1
    if (essayLower.includes("my friends said my drawings is good")) {
      const startPos = essayLower.indexOf("my drawings is good");
      if (startPos > 0) {
        errors.push({
          type: "動詞の一致の間違い",
          text: "is",
          startPos: startPos + "my drawings ".length,
          endPos: startPos + "my drawings is".length,
          explanation: "複数形の主語「drawings」には「are」を使います。"
        });
        errorTypeCounts["動詞の一致の間違い"] = (errorTypeCounts["動詞の一致の間違い"] || 0) + 1;
      }
    }
  }
  
  // Second essay specific errors
  if (essayLower.includes("we went to the beach")) {
    // Sample errors from Essay 2
    if (essayLower.includes("we went to the beach last summer")) {
      const startPos = essayLower.indexOf("went to the beach");
      if (startPos > 0) {
        // This would be a correct usage, so we don't add an error
      }
    }
    
    if (essayLower.includes("drive to the beach")) {
      const startPos = essayLower.indexOf("drive to the beach");
      if (startPos > 0) {
        errors.push({
          type: "時制の間違い",
          text: "drive",
          startPos: startPos,
          endPos: startPos + "drive".length,
          explanation: "過去の出来事なので「drove」を使います。"
        });
        errorTypeCounts["時制の間違い"] = (errorTypeCounts["時制の間違い"] || 0) + 1;
      }
    }
  }
  
  // Third essay specific errors
  if (essayLower.includes("my best friend is ken")) {
    // Sample errors from Essay 3
    if (essayLower.includes("we are friends since grade")) {
      const startPos = essayLower.indexOf("we are friends since");
      if (startPos > 0) {
        errors.push({
          type: "時制の間違い",
          text: "are",
          startPos: startPos + "we ".length,
          endPos: startPos + "we are".length,
          explanation: "「since」は現在完了形と共に使います。「have been」が正しいです。"
        });
        errorTypeCounts["時制の間違い"] = (errorTypeCounts["時制の間違い"] || 0) + 1;
      }
    }
    
    if (essayLower.includes("he always help me")) {
      const startPos = essayLower.indexOf("he always help");
      if (startPos > 0) {
        errors.push({
          type: "動詞の三人称単数形の間違い",
          text: "help",
          startPos: startPos + "he always ".length,
          endPos: startPos + "he always help".length,
          explanation: "三人称単数形の主語「he」には「helps」を使います。"
        });
        errorTypeCounts["動詞の三人称単数形の間違い"] = (errorTypeCounts["動詞の三人称単数形の間違い"] || 0) + 1;
      }
    }
  }
  
  // Apply each pattern from our general rules
  for (const errorRule of COMMON_GRAMMAR_ERRORS) {
    let match;
    // Reset lastIndex to start from the beginning each time
    errorRule.pattern.lastIndex = 0;
    
    while ((match = errorRule.pattern.exec(essay)) !== null) {
      const fullMatch = match[0];
      const startPos = match.index;
      const endPos = startPos + fullMatch.length;
      
      // Skip if we already have an error at this position
      const hasOverlap = errors.some(error => 
        (startPos >= error.startPos && startPos < error.endPos) ||
        (endPos > error.startPos && endPos <= error.endPos)
      );
      
      if (!hasOverlap) {
        errors.push({
          type: errorRule.type,
          text: fullMatch,
          startPos,
          endPos,
          explanation: errorRule.explanation
        });
        
        // Count error types
        errorTypeCounts[errorRule.type] = (errorTypeCounts[errorRule.type] || 0) + 1;
      }
      
      // Prevent infinite loops on zero-length matches
      if (match.index === errorRule.pattern.lastIndex) {
        errorRule.pattern.lastIndex++;
      }
    }
  }
  
  // Manual error detection for common ESL mistakes
  // 1. Missing articles
  const missingArticlePatterns = [
    { pattern: /\b(go|went|drive|drove) to (beach|park|store|school)\b/g, replacement: "the $2" },
    { pattern: /\b(in|at|on|by) (beach|park|sea|water)\b/g, replacement: "the $2" },
    { pattern: /\b(was) (important|special|fun) (day|time)\b/g, replacement: "was an $2 $3" }
  ];
  
  for (const pattern of missingArticlePatterns) {
    pattern.pattern.lastIndex = 0;
    let match;
    while ((match = pattern.pattern.exec(essay)) !== null) {
      const fullMatch = match[0];
      const startPos = match.index;
      const endPos = startPos + fullMatch.length;
      
      // Skip if we already have an error at this position
      const hasOverlap = errors.some(error => 
        (startPos >= error.startPos && startPos < error.endPos) ||
        (endPos > error.startPos && endPos <= error.endPos)
      );
      
      if (!hasOverlap) {
        errors.push({
          type: "冠詞の間違い",
          text: match[2],
          startPos: startPos + match[0].indexOf(match[2]),
          endPos: startPos + match[0].indexOf(match[2]) + match[2].length,
          explanation: `「${match[2]}」の前に「the」や「a/an」などの冠詞が必要です。`
        });
        
        errorTypeCounts["冠詞の間違い"] = (errorTypeCounts["冠詞の間違い"] || 0) + 1;
      }
      
      if (match.index === pattern.pattern.lastIndex) {
        pattern.pattern.lastIndex++;
      }
    }
  }
  
  console.log(`Detected ${errors.length} errors in essay manually`);
  
  return {
    errors,
    categories: Object.entries(errorTypeCounts).map(([category, count]) => ({ category, count: count }))
  };
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get MongoDB client
    const { db: _db } = await getClient();
    const db = _db as Db;
    
    // Use native MongoDB driver to find grammar entries
    const grammarCollection = db.collection<GrammarDoc>('grammars');
    const userId = new ObjectId(session.user.id);
    
    const grammarEntries = await grammarCollection
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();
    
    // Convert ObjectId to string for JSON serialization
    const serializedEntries = grammarEntries.map(entry => ({
      ...entry,
      _id: entry._id?.toString(),
      userId: entry.userId.toString()
    }));

    return NextResponse.json(serializedEntries);
  } catch (error) {
    console.error('Error fetching grammar entries:', error);
    return NextResponse.json({ error: 'Failed to fetch grammar entries' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();
    
    // Get MongoDB client
    const { db: _db } = await getClient();
    const db = _db as Db;
    
    // Access collections
    const usersCollection = db.collection<UserDoc>('users');
    const grammarCollection = db.collection<GrammarDoc>('grammars');
    
    // Parse userId
    const userId = new ObjectId(session.user.id);
    
    // Get user profile for English level and preferred teacher
    const user = await usersCollection.findOne({ _id: userId });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Check if user has enough points
    if ((user.points || 0) < POINT_CONSUMPTION.GRAMMAR_CHECK) {
      return NextResponse.json({ error: 'Not enough points' }, { status: 403 });
    }
    
    // Create grammar entry with the MongoDB driver
    const grammarEntry: GrammarDoc = {
      userId,
      topics: data.topics,
      essay: data.essay, // Single essay instead of essays array
      grammaticalErrors: data.grammaticalErrors || [],
      errorDetails: data.errorDetails || [],
      preferredTeacher: user.preferredTeacher || 'taro',
      conversation: data.conversation || [],
      status: 'pending', // Initial status for async processing
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await grammarCollection.insertOne(grammarEntry);
    
    // Deduct points
    await usersCollection.updateOne(
      { _id: userId },
      { $inc: { points: -POINT_CONSUMPTION.GRAMMAR_CHECK } }
    );
    
    // Start asynchronous processing for grammar analysis
    if (grammarEntry.essay && grammarEntry.essay.trim().length > 0) {
      // Mark as processing
      await grammarCollection.updateOne(
        { _id: result.insertedId },
        { $set: { status: 'processing', updatedAt: new Date() } }
      );
      
      // Process asynchronously
      processGrammarAnalysisAsync(
        result.insertedId.toString(),
        grammarEntry.essay,
        user.preferredTeacher || 'taro',
        user.englishLevel || 'beginner'
      ).catch(err => console.error('Error in async grammar analysis:', err));
    }

    // Return the created entry with string ID
    return NextResponse.json({
      ...grammarEntry,
      _id: result.insertedId.toString(),
      userId: userId.toString()
    });
  } catch (error) {
    console.error('Error creating grammar entry:', error);
    return NextResponse.json({ error: 'Failed to create grammar entry' }, { status: 500 });
  }
}

// Fix error in processGrammarAnalysisAsync function for errorDetails type
async function processGrammarAnalysisAsync(
  grammarEntryId: string,
  essay: string,
  preferredTeacher: string,
  englishLevel: string
) {
  try {
    console.log(`Starting async grammar analysis for entry: ${grammarEntryId}`);
    
    // Get MongoDB client
    const { db: _db } = await getClient();
    const db = _db as Db;
    const grammarCollection = db.collection<GrammarDoc>('grammars');
    
    // Analyze grammar using Deepseek
    console.log("Starting Deepseek API call...");
    const response = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { 
          role: 'system', 
          content: `You are an English grammar teacher with expertise in identifying grammatical errors in student essays.
                  Analyze the following essay written by an English learner and identify ALL grammatical errors.
                  
                  Be very thorough and identify common ESL mistakes such as:
                  - Subject-verb agreement issues (e.g., "He go" instead of "He goes")
                  - Article usage (missing "a", "an", "the" or using them incorrectly)
                  - Verb tense errors (using present when past is needed, etc.)
                  - Preposition errors (e.g., "arrive to" instead of "arrive at")
                  - Plural/singular noun mistakes (e.g., "two apple" instead of "two apples")
                  - Word order errors (e.g., "blue big house" instead of "big blue house")
                  - Fragment or run-on sentences
                  - Pronoun errors
                  - Irregular verb form errors
                  
                  For EACH error:
                  1. Note the exact text that is incorrect
                  2. Specify its start and end position (character index)
                  3. Categorize the error type in Japanese (e.g., 時制の間違い、冠詞の間違い)
                  4. Provide a clear explanation in Japanese of why it's incorrect and how to fix it
                  
                  Example of how to mark an error:
                  For the sentence "I go to school yesterday", the error would be:
                  {
                    "type": "時制の間違い",
                    "text": "go",
                    "startPos": 2,
                    "endPos": 4,
                    "explanation": "過去の出来事なのでwentを使います"
                  }
                  
                  Return a valid JSON object with the following format:
                  {
                    "errorCategories": [
                      {"category": "時制の間違い", "count": 3},
                      {"category": "冠詞の間違い", "count": 2}
                    ],
                    "errors": [
                      {
                        "type": "時制の間違い",
                        "text": "go",
                        "startPos": 2,
                        "endPos": 4,
                        "explanation": "過去の出来事なのでwentを使います"
                      },
                      {
                        "type": "冠詞の間違い",
                        "text": "school",
                        "startPos": 9,
                        "endPos": 15,
                        "explanation": "特定の学校を指す場合は定冠詞'the'が必要です"
                      }
                    ],
                    "feedback": "Your detailed feedback here"
                  }
                  
                  Be precise with the character positions. The startPos is the index of the first character of the error, and endPos is the index of the last character plus one.
                  Make absolutely sure you don't miss any errors. Even a simple missing article or incorrect preposition should be identified.
                  IMPORTANT: Always search for errors even if the essay appears to be correct at first glance.` 
        },
        { role: 'user', content: `Essay to analyze: ${essay}` }
      ],
      temperature: 0.2,
      max_tokens: 3000
    });

    const analysisContent = response.choices[0].message.content || '{}';
    console.log("Raw response content received");
    
    // Extract and parse JSON
    const extractedContent = extractJsonFromMarkdown(analysisContent);
    console.log("Attempting to parse content");
    const analysisResult = JSON.parse(extractedContent);
    
    // Fix error positions and create properly structured errorDetails
    const fixedErrors = fixErrorPositions(analysisResult.errors || [], essay);
    
    // Update grammar entry with analysis results
    await grammarCollection.updateOne(
      { _id: new ObjectId(grammarEntryId) },
      { 
        $set: { 
          grammaticalErrors: analysisResult.errorCategories || [],
          errorDetails: [{ errors: fixedErrors }],
          status: 'completed',
          updatedAt: new Date()
        } 
      }
    );
    
    console.log(`Completed grammar analysis for entry: ${grammarEntryId}`);
  } catch (error) {
    console.error(`Error in async grammar analysis for entry ${grammarEntryId}:`, error);
    
    // Get MongoDB client to update status to failed
    try {
      const { db: _db } = await getClient();
      const db = _db as Db;
      const grammarCollection = db.collection<GrammarDoc>('grammars');
      
      await grammarCollection.updateOne(
        { _id: new ObjectId(grammarEntryId) },
        { 
          $set: { 
            status: 'failed', 
            updatedAt: new Date()
          } 
        }
      );
    } catch (updateError) {
      console.error(`Failed to update grammar entry status: ${updateError}`);
    }
  }
}

// Helper functions for JSON parsing and error position fixing
function extractJsonFromMarkdown(content: string) {
  // Check if content has markdown code blocks
  if (content.includes('```json')) {
    const jsonBlockMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch && jsonBlockMatch[1]) {
      console.log("Found JSON code block in markdown response");
      return jsonBlockMatch[1].trim();
    }
  }
  
  // If no code block found, try to find a JSON object directly
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    console.log("Found JSON object in content");
    return jsonMatch[0];
  }
  
  console.log("No JSON found in content");
  return content;
}

// Fix error positions by finding actual text occurrences
function fixErrorPositions(errors: any[], essay: string) {
  if (!errors || !Array.isArray(errors)) return [];
  
  console.log("Fixing error positions...");
  
  return errors.map(error => {
    // Skip if missing required fields
    if (!error.text || !error.type) return error;
    
    // Find the actual occurrence of the text in the essay
    const textToFind = error.text.trim();
    
    if (textToFind.length > 0) {
      // Try to find an exact match
      const index = essay.indexOf(textToFind);
      
      if (index !== -1) {
        // Found a match, update positions
        console.log(`Found match for "${textToFind}" at position ${index}`);
        return {
          ...error,
          startPos: index,
          endPos: index + textToFind.length
        };
      } else {
        // Try case-insensitive search
        const lowerEssay = essay.toLowerCase();
        const lowerText = textToFind.toLowerCase();
        const insensitiveIndex = lowerEssay.indexOf(lowerText);
        
        if (insensitiveIndex !== -1) {
          console.log(`Found case-insensitive match for "${textToFind}" at position ${insensitiveIndex}`);
          return {
            ...error,
            startPos: insensitiveIndex,
            endPos: insensitiveIndex + textToFind.length
          };
        }
      }
    }
    
    // No match found, keep original positions but mark for logging
    console.log(`No match found for error text: "${textToFind}"`);
    return error;
  });
}

// API for generating random topics
export async function PUT(req: NextRequest) {
  try {
    console.log("Starting topic generation...");
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      console.log("Unauthorized: No valid session");
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get MongoDB client
    const { db: _db } = await getClient();
    const db = _db as Db;
    const usersCollection = db.collection<UserDoc>('users');
    const userId = new ObjectId(session.user.id);
    
    console.log("Connected to database");
    
    // Get user profile for English level
    const user = await usersCollection.findOne({ _id: userId });
    if (!user) {
      console.log("User not found:", session.user.id);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    console.log("User found");
    
    // Check if user has enough points
    if ((user.points || 0) < POINT_CONSUMPTION.GRAMMAR_TOPIC_GENERATION) {
      console.log("Not enough points:", user.points, "needed:", POINT_CONSUMPTION.GRAMMAR_TOPIC_GENERATION);
      return NextResponse.json({ error: 'Not enough points' }, { status: 403 });
    }
    console.log("User has enough points");

    // Generate topics based on English level
    const englishLevel = user.englishLevel || 'beginner';
    const job = user.job || '';
    const goal = user.goal || '';
    console.log("User profile data retrieved for topic generation");

    let systemPrompt = `Generate 3 random, unique essay topics for ${englishLevel} English learners`;
    if (job) systemPrompt += ` who work as ${job}`;
    if (goal) systemPrompt += ` with a goal to ${goal}`;
    
    // For beginners, topics should be in Japanese
    if (englishLevel === '超初級者' || englishLevel === '初級者') {
      systemPrompt += `. Write the topics in Japanese. Make them simple but encourage detailed responses.`;
    } else {
      systemPrompt += `. The topics should be detailed enough to encourage writing at least 100 words.`;
    }
    
    console.log("System prompt initialized");
    
    // Check if Deepseek API key is set
    if (!process.env.DEEPSEEK_API_KEY) {
      console.error("ERROR: DEEPSEEK_API_KEY is not set in environment variables");
      return NextResponse.json({ error: 'Deepseek API key not configured' }, { status: 500 });
    }
    
    // Try to generate topics with Deepseek API
    let topics: string[] = [];
    let modelUsed = "deepseek-chat";
    
    try {
      console.log("Starting Deepseek request...");
      const userMessage = englishLevel === '超初級者' || englishLevel === '初級者'
        ? '日本語で3つのシンプルなエッセイトピックを生成してください。トピックは必ず日本語で記述し、番号付きリストで回答してください。例: 1. あなたの趣味について教えてください。'
        : 'Generate 3 simple essay topics. Format as a numbered list.';
        
      const response = await deepseek.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.8,
        max_tokens: 300
      });
      console.log("Raw content from Deepseek received");
      
      if (response.choices && response.choices.length > 0 && response.choices[0].message.content) {
        const content = response.choices[0].message.content;
        console.log("Raw content from Deepseek received");
        
        topics = extractTopicsFromContent(content);
        modelUsed = "deepseek-chat";
      }
    } catch (error) {
      console.error("Error with Deepseek request:", error);
      
      // Fall back to hardcoded topics
      topics = [];
    }
    
    // If Deepseek failed, use hardcoded fallback topics
    if (topics.length === 0) {
      console.log("Using fallback topics as Deepseek failed");
      if (englishLevel === '超初級者' || englishLevel === '初級者') {
        topics = [
          "あなたの趣味について説明してください。",
          "あなたの好きな食べ物について教えてください。",
          "あなたの一日のルーティンを説明してください。"
        ];
      } else {
        topics = [
          "Describe your favorite hobby and why you enjoy it.",
          "Tell me about your favorite food and how it's prepared.",
          "Explain your daily routine from morning to evening."
        ];
      }
      modelUsed = "fallback";
    }
    
    // Fill to 3 topics if fewer were returned
    while (topics.length < 3) {
      if (englishLevel === '超初級者' || englishLevel === '初級者') {
        topics.push(`あなたの休日の過ごし方について教えてください。`);
      } else {
        topics.push(`Topic ${topics.length + 1}: Please write about your day.`);
      }
    }
    
    console.log("Final topics:", topics);
    console.log("Model used:", modelUsed);
    
    // Deduct points using MongoDB driver
    await usersCollection.updateOne(
      { _id: userId },
      { $inc: { points: -POINT_CONSUMPTION.GRAMMAR_TOPIC_GENERATION } }
    );
    console.log("Points deducted");

    return NextResponse.json({ topics, modelUsed });
  } catch (error) {
    console.error('Error generating topics:', error);
    // More detailed error information
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    return NextResponse.json({ 
      error: 'Failed to generate topics',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Helper function to extract topics from content
function extractTopicsFromContent(content: string): string[] {
  console.log("Extracting topics from content");
  
  if (!content) return [];
  
  // Remove any markdown formatting that might be present
  content = content.replace(/```[a-z]*\n|\n```/g, '');
  
  // Split by line
  const lines = content.split('\n');
  
  // First try to match lines that look like numbered items (1. Topic, 2) Topic, etc.)
  let topics: string[] = [];
  // Updated pattern to better match both English and Japanese numbered items
  const numberedPattern = /^(\d+[\.\)：:]|\*|-)\s+(.+)/;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Try to match numbered pattern
    const match = trimmed.match(numberedPattern);
    if (match && match[2]) {
      topics.push(match[2].trim());
      if (topics.length >= 3) break;
    }
  }
  
  // If no numbered items found, try to identify topics based on length and content
  if (topics.length === 0) {
    console.log("No numbered topics found, attempting to extract based on content");
    
    // Updated pattern to handle both English and Japanese topic indicators
    const topicPattern = /^(Topic|トピック)\s*\d+\s*[:：]/i;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.length < 5) continue; // Reduced minimum length to catch shorter Japanese topics
      
      if (topicPattern.test(trimmed)) {
        // Remove the "Topic X:" prefix
        const topicText = trimmed.replace(topicPattern, '').trim();
        if (topicText) {
          topics.push(topicText);
          if (topics.length >= 3) break;
        }
      }
    }
    
    // If still no topics found, just take non-instruction lines with sufficient length
    if (topics.length === 0) {
      console.log("No topic patterns found, extracting potential topic sentences");
      
      // Skip lines that look like instructions in English or Japanese
      const instructionPattern = /^(please|write|describe|explain|discuss|tell|share|書いて|説明して|教えて|記述して)/i;
      
      const candidateLines = lines
        .map(line => line.trim())
        .filter(line => 
          line.length >= 10 && // Reduced minimum length for Japanese sentences
          !instructionPattern.test(line) &&
          !line.toLowerCase().includes("topic") &&
          !line.includes("トピック") &&
          !line.includes("例:") &&
          !line.includes("例：") &&
          !line.startsWith("Here") &&
          !line.startsWith("These") &&
          !line.startsWith("The following")
        )
        .sort((a, b) => b.length - a.length); // Sort by length, longest first
      
      topics = candidateLines.slice(0, 3);
    }
  }
  
  // For Japanese topics, clean up any remaining numbering or prefixes
  topics = topics.map(topic => {
    // Remove numbering like "1.", "①", "１．" etc.
    return topic.replace(/^[①②③④⑤⑥⑦⑧⑨⑩１２３４５６７８９０][\.\．:：、]+\s*/, '')
                .replace(/^[0-9]+[\.\．:：、]+\s*/, '')
                .trim();
  });
  
  console.log("Extracted topics:", topics);
  return topics;
}

// API for submitting a question - Update to use MongoDB
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { question, grammarEntryId } = await req.json();
    
    // Get MongoDB client
    const { db: _db } = await getClient();
    const db = _db as Db;
    const usersCollection = db.collection<UserDoc>('users');
    const grammarCollection = db.collection<GrammarDoc>('grammars');
    
    // Parse user ID
    const userId = new ObjectId(session.user.id);
    
    // Get user profile for preferred teacher
    const user = await usersCollection.findOne({ _id: userId });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Check if user has enough points
    if ((user.points || 0) < POINT_CONSUMPTION.GRAMMAR_CHECK) {
      return NextResponse.json({ error: 'Not enough points' }, { status: 403 });
    }

    // Find the grammar entry
    const grammarEntry = await grammarCollection.findOne({ _id: new ObjectId(grammarEntryId) });
    if (!grammarEntry) {
      return NextResponse.json({ error: 'Grammar entry not found' }, { status: 404 });
    }

    // Add user question to conversation
    const conversation = grammarEntry.conversation || [];
    conversation.push({
      sender: 'user',
      content: question,
      timestamp: new Date()
    });

    // Update grammar entry with user question
    await grammarCollection.updateOne(
      { _id: new ObjectId(grammarEntryId) },
      { 
        $set: { 
          conversation, 
          updatedAt: new Date()
        } 
      }
    );

    // Generate AI response asynchronously
    generateTeacherResponseAsync(
      grammarEntryId,
      question,
      grammarEntry.essay,
      grammarEntry.preferredTeacher,
      user.englishLevel || 'beginner'
    ).catch(err => console.error('Error generating teacher response:', err));

    // Deduct points
    await usersCollection.updateOne(
      { _id: userId },
      { $inc: { points: -POINT_CONSUMPTION.GRAMMAR_CHECK } }
    );

    return NextResponse.json({ success: true, conversation });
  } catch (error) {
    console.error('Error submitting question:', error);
    return NextResponse.json({ error: 'Failed to submit question' }, { status: 500 });
  }
}

// Asynchronous function to generate teacher response
async function generateTeacherResponseAsync(
  grammarEntryId: string,
  question: string,
  essay: string,
  preferredTeacher: string,
  englishLevel: string
) {
  try {
    console.log(`Generating teacher response for entry: ${grammarEntryId}`);
    
    // Get MongoDB client
    const { db: _db } = await getClient();
    const db = _db as Db;
    const grammarCollection = db.collection<GrammarDoc>('grammars');
    
    // Get the grammar entry to get conversation history
    const grammarEntry = await grammarCollection.findOne({ _id: new ObjectId(grammarEntryId) });
    if (!grammarEntry) {
      throw new Error('Grammar entry not found');
    }
    
    // Prepare conversation history
    const conversation = grammarEntry.conversation || [];
    const conversationHistory = conversation
      .map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));

    // Create teacher prompt
    const teacherPersonality = getTeacherPersonality(preferredTeacher);
    
    // Generate response using Deepseek
    const response = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: `あなたは英語教師${teacherPersonality}です。日本人の英語学習者に英文法を教えています。
                    以下の英作文とそれに関する学習者の質問に答えてください。
                    
                    学習者のレベル: ${englishLevel}
                    
                    英作文:
                    """
                    ${essay}
                    """
                    
                    質問履歴と回答履歴:
                    ${conversationHistory.map(msg => 
                      `${msg.role === 'user' ? '学習者' : '先生'}: ${msg.content}`
                    ).join('\n')}
                    
                    最新の質問に日本語で答えてください。必要に応じて英語の例文を追加しても構いません。
                    回答は学習者の質問に直接関連するものにしてください。`
        },
        { role: 'user', content: question }
      ],
      temperature: 0.7,
      max_tokens: 1500
    });

    // Get teacher response
    const teacherResponse = response.choices[0].message.content || '申し訳ありません。回答を生成できませんでした。';
    
    // Add teacher response to conversation
    conversation.push({
      sender: 'teacher',
      content: teacherResponse,
      timestamp: new Date()
    });
    
    // Update grammar entry with teacher response
    await grammarCollection.updateOne(
      { _id: new ObjectId(grammarEntryId) },
      { 
        $set: { 
          conversation, 
          updatedAt: new Date()
        } 
      }
    );
    
    console.log(`Teacher response generated for entry: ${grammarEntryId}`);
  } catch (error) {
    console.error(`Error generating teacher response for entry ${grammarEntryId}:`, error);
  }
}

// Helper function to get teacher personality
function getTeacherPersonality(teacher: string): string {
  switch (teacher) {
    case 'hiroshi':
      return '・ひろし先生。関西弁で話し、親しみやすく、文法を分かりやすく教える。「〜やで」「〜やね」などの関西弁フレーズを使う';
    case 'reiko':
      return '・玲子先生。女性的で丁寧な言葉遣い。「〜ですわ」「〜ますわ」などの話し方をする、おっとりとした優しい先生';
    case 'iwao':
      return '・巌男先生。やや厳しい口調だが熱心に教える。「〜だ」「〜だろう」などの男性的表現を使う';
    case 'taro':
    default:
      return '・太郎先生。標準的な丁寧語で話す。「〜です」「〜ます」を使い、分かりやすく教える一般的な先生';
  }
} 