import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDB } from '@/lib/mongodb';
import Grammar from '@/models/Grammar';
import User from '@/models/User';
import deepseek from '@/lib/deepseek';
import { POINT_CONSUMPTION } from '@/lib/pointSystem';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDB();
    const grammarEntries = await Grammar.find({ userId: session.user.id })
      .sort({ createdAt: -1 })
      .limit(10);

    return NextResponse.json(grammarEntries);
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
    
    await connectToDB();
    
    // Get user profile for English level and preferred teacher
    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Check if user has enough points
    if (user.points < POINT_CONSUMPTION.GRAMMAR_CHECK) {
      return NextResponse.json({ error: 'Not enough points' }, { status: 403 });
    }
    
    // Create grammar entry
    const grammarEntry = await Grammar.create({
      userId: session.user.id,
      topics: data.topics,
      essays: data.essays,
      grammaticalErrors: data.grammaticalErrors || [],
      preferredTeacher: user.preferredTeacher || 'taro',
      conversation: data.conversation || [],
    });

    // Deduct points
    user.points -= POINT_CONSUMPTION.GRAMMAR_CHECK;
    await user.save();

    return NextResponse.json(grammarEntry);
  } catch (error) {
    console.error('Error creating grammar entry:', error);
    return NextResponse.json({ error: 'Failed to create grammar entry' }, { status: 500 });
  }
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

    await connectToDB();
    console.log("Connected to database");
    
    // Get user profile for English level
    const user = await User.findById(session.user.id);
    if (!user) {
      console.log("User not found:", session.user.id);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    console.log("User found:", user.email || user.name);
    
    // Check if user has enough points
    if (user.points < POINT_CONSUMPTION.GRAMMAR_TOPIC_GENERATION) {
      console.log("Not enough points:", user.points, "needed:", POINT_CONSUMPTION.GRAMMAR_TOPIC_GENERATION);
      return NextResponse.json({ error: 'Not enough points' }, { status: 403 });
    }
    console.log("User has enough points");

    // Generate topics based on English level
    const englishLevel = user.englishLevel || 'beginner';
    const job = user.job || '';
    const goal = user.goal || '';
    console.log("User profile data:", { englishLevel, job, goal });

    let systemPrompt = `Generate 3 random, unique essay topics for ${englishLevel} English learners`;
    if (job) systemPrompt += ` who work as ${job}`;
    if (goal) systemPrompt += ` with a goal to ${goal}`;
    
    // For beginners, topics should be in Japanese
    if (englishLevel === '超初級者' || englishLevel === '初級者') {
      systemPrompt += `. Write the topics in Japanese. Make them simple but encourage detailed responses.`;
    } else {
      systemPrompt += `. The topics should be detailed enough to encourage writing at least 100 words.`;
    }
    
    console.log("System prompt:", systemPrompt);
    
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
      console.log("Deepseek response received");
      
      if (response.choices && response.choices.length > 0 && response.choices[0].message.content) {
        const content = response.choices[0].message.content;
        console.log("Raw content from Deepseek:", content);
        
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
    
    // Deduct points
    user.points -= POINT_CONSUMPTION.GRAMMAR_TOPIC_GENERATION;
    await user.save();
    console.log("Points deducted and user saved");

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
  console.log("Extracting topics from content:", content);
  
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

// API for analyzing the grammar
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { essays, grammarEntryId } = await req.json();
    
    await connectToDB();
    
    // Get user profile for preferred teacher
    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Check if user has enough points
    if (user.points < POINT_CONSUMPTION.GRAMMAR_ANALYSIS) {
      return NextResponse.json({ error: 'Not enough points' }, { status: 403 });
    }

    // Find the grammar entry
    const grammarEntry = await Grammar.findById(grammarEntryId);
    if (!grammarEntry) {
      return NextResponse.json({ error: 'Grammar entry not found' }, { status: 404 });
    }

    // Analyze grammar using Deepseek
    const response = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { 
          role: 'system', 
          content: `You are an English grammar teacher. Analyze the following essays and identify grammatical errors. 
                    Categorize errors into types like 時制の間違い、冠詞の間違い、be動詞の使い方の間違い, etc.
                    Similar types should be consolidated. Return a JSON with categories and counts of errors, 
                    plus detailed feedback on each essay.
                    
                    Your response must be a valid JSON object with the following format:
                    {
                      "errorCategories": [
                        {"category": "時制の間違い", "count": 3},
                        {"category": "冠詞の間違い", "count": 2}
                      ],
                      "feedback": "Your detailed feedback here"
                    }` 
        },
        { role: 'user', content: `Essays to analyze: ${JSON.stringify(essays)}` }
      ],
      temperature: 0.3,
      max_tokens: 1000
    });

    const analysisContent = response.choices[0].message.content || '{}';
    let analysisResult;
    
    try {
      // Try to parse the JSON
      analysisResult = JSON.parse(analysisContent);
    } catch (e) {
      console.error("Failed to parse JSON from Deepseek:", e);
      console.log("Raw content:", analysisContent);
      
      // Create a fallback analysis result
      analysisResult = {
        errorCategories: [],
        feedback: "Sorry, there was an error processing your essays."
      };
      
      // Try to extract JSON from the content if possible
      const jsonMatch = analysisContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const extractedJson = jsonMatch[0];
          analysisResult = JSON.parse(extractedJson);
        } catch (e) {
          console.error("Failed to extract JSON from content");
        }
      }
    }
    
    // Update grammar entry
    grammarEntry.essays = essays;
    grammarEntry.grammaticalErrors = analysisResult.errorCategories || [];
    
    // Add teacher feedback based on preferred teacher
    const teacherResponse = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { 
          role: 'system', 
          content: `You are an English teacher named ${user.preferredTeacher || 'taro'}. 
                   Based on the grammatical errors identified (${JSON.stringify(analysisResult.errorCategories)}),
                   explain these grammar concepts to the student.
                   
                   Teacher personalities:
                   - taro: Polite, formal Japanese teacher who uses です/ます style
                   - hiroshi: Casual Kansai dialect teacher who uses だ/や style
                   - reiko: Very polite, formal female teacher who uses です/ます and わ/わよ endings
                   - iwao: Rough, direct teacher who uses command form and masculine speech
                   
                   Use the appropriate speaking style for the character.` 
        },
        { 
          role: 'user', 
          content: `Provide grammar explanations for these error types: ${JSON.stringify(analysisResult.errorCategories)}` 
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    // Add the teacher's explanation to the conversation
    grammarEntry.conversation.push({
      sender: 'teacher',
      content: teacherResponse.choices[0].message.content || '',
      timestamp: new Date(),
    });
    
    await grammarEntry.save();
    
    // Deduct points
    user.points -= POINT_CONSUMPTION.GRAMMAR_ANALYSIS;
    await user.save();

    return NextResponse.json({
      analysis: analysisResult,
      teacherFeedback: teacherResponse.choices[0].message.content,
      grammarEntry
    });
  } catch (error) {
    console.error('Error analyzing grammar:', error);
    return NextResponse.json({ error: 'Failed to analyze grammar' }, { status: 500 });
  }
} 