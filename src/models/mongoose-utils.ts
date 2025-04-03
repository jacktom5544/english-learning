import mongoose, { Model, Document } from 'mongoose';
import { safeError, safeLog } from '@/lib/utils';
import connectDB from '@/lib/db'; // Import the function that returns the native db object

/**
 * Type-safe wrapper functions for Mongoose operations
 * These functions help avoid TypeScript errors with Mongoose's complex types
 */

/**
 * Safe wrapper for Model.find
 */
export async function findDocuments<T>(
  model: Model<any>,
  filter: Record<string, any> = {}
): Promise<T[]> {
  try {
    // Use any type to bypass TypeScript's strict checking
    // and then cast to the appropriate type at the end
    const query: any = model.find(filter);
    return await query.exec() as T[];
  } catch (error) {
    safeError('Error in findDocuments:', error);
    return [];
  }
}

/**
 * Safe wrapper for findById using NATIVE driver
 */
export async function findDocumentById<T>(
  model: Model<any>, // Keep model parameter for consistency, but use modelName
  id: string
): Promise<T | null> {
  let db;
  try {
    const { db: nativeDb } = await connectDB();
    db = nativeDb;
    const collectionName = model.collection.name;
    safeLog(`[native-utils] Executing native findOne on ${collectionName} with filter:`, { _id: new mongoose.Types.ObjectId(id) });
    const startTime = Date.now();
    // Use native findOne with ObjectId conversion
    const result = await db.collection(collectionName).findOne({ _id: new mongoose.Types.ObjectId(id) });
    const duration = Date.now() - startTime;
    safeLog(`[native-utils] native findOne by ID on ${collectionName} completed in ${duration}ms. Found: ${!!result}`);
    return result as T | null; // Cast result
  } catch (error) {
    safeError(`[native-utils] Error executing native findOne by ID on ${model.collection.name}:`, error);
    return null;
  }
}

/**
 * Safe wrapper for findOne using NATIVE driver
 */
export async function findOneDocument<T>(
  model: Model<any>, // Keep model parameter for consistency, but use modelName
  filter: Record<string, any>
): Promise<T | null> {
  let db;
  try {
    const { db: nativeDb } = await connectDB();
    db = nativeDb;
    const collectionName = model.collection.name; // Get collection name from model
    safeLog(`[native-utils] Executing native findOne on ${collectionName} with filter:`, filter);
    const startTime = Date.now();
    // Use native findOne
    const result = await db.collection(collectionName).findOne(filter);
    const duration = Date.now() - startTime;
    safeLog(`[native-utils] native findOne on ${collectionName} completed in ${duration}ms. Found: ${!!result}`);
    return result as T | null; // Cast result
  } catch (error) {
    safeError(`[native-utils] Error executing native findOne on ${model.collection.name}:`, error);
    return null;
  }
}

/**
 * Safe wrapper for query chaining with select and sort
 */
export async function findDocumentsWithOptions<T>(
  model: Model<any>,
  filter: Record<string, any> = {},
  select: string | Record<string, any> | null = null,
  sort: Record<string, any> | null = null
): Promise<T[]> {
  try {
    // Use any type to bypass TypeScript's strict checking
    let query: any = model.find(filter);
    
    if (select) {
      query = query.select(select);
    }
    
    if (sort) {
      query = query.sort(sort);
    }
    
    return await query.exec() as T[];
  } catch (error) {
    safeError('Error in findDocumentsWithOptions:', error);
    return [];
  }
} 