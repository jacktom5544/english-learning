import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { MONGODB_URI } from '@/lib/env';

export async function GET() {
  try {
    // Get the connection string from our centralized env module
    const uri = MONGODB_URI;
    
    console.log('Testing MongoDB connection with connection string starting with:', 
      uri.substring(0, 20) + '...');
    
    const client = new MongoClient(uri);
    console.log('Attempting to connect...');
    await client.connect();
    console.log('Connected successfully to MongoDB server');
    
    const serverInfo = await client.db().admin().serverInfo();
    const dbList = await client.db().admin().listDatabases();
    await client.close();
    console.log('Connection closed properly');
    
    return NextResponse.json({
      success: true,
      message: "Successfully connected to MongoDB",
      version: serverInfo.version,
      databases: dbList.databases.map(db => db.name),
      connection_string_prefix: uri.substring(0, 20) + '...'
    });

  } catch (error: any) {
    console.error("MongoDB connection error:", error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
} 