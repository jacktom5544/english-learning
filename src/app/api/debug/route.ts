import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  console.log("Debug API called");
  return NextResponse.json({ message: "Debug endpoint working", timestamp: new Date().toISOString() });
}

export async function POST(req: NextRequest) {
  console.log("Debug POST API called");
  
  try {
    const body = await req.json();
    console.log("Request body:", body);
    
    return NextResponse.json({ 
      message: "Debug POST endpoint working", 
      receivedData: body,
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    console.error("Error in debug POST endpoint:", error);
    return NextResponse.json({ error: "Failed to parse request body" }, { status: 400 });
  }
} 