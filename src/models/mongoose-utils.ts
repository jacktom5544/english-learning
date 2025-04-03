import mongoose, { Model, Document } from 'mongoose';
import { safeError, safeLog } from '@/lib/utils';
import connectDB from '@/lib/db'; // Import the function that returns the native db object

/**
 * Type-safe wrapper functions for Mongoose operations
 * These functions help avoid TypeScript errors with Mongoose's complex types
 */

/**
 * Safe wrapper for Model.find using NATIVE driver
 */
export async function findDocuments<T>(
  model: Model<any>,
  filter: Record<string, any> = {}
): Promise<T[]> {
  let db;
  try {
    const { db: nativeDb } = await connectDB();
    db = nativeDb;
    const collectionName = model.collection.name;
    safeLog(`[native-utils] Executing native find on ${collectionName} with filter:`, filter);
    const startTime = Date.now();
    
    const results = await db.collection(collectionName).find(filter).toArray();
    
    const duration = Date.now() - startTime;
    safeLog(`[native-utils] native find on ${collectionName} completed in ${duration}ms. Found: ${results.length} documents.`);

    // Cast result (potential type mismatch if Mongoose Documents are expected downstream)
    return results as T[]; 

  } catch (error) {
    safeError(`[native-utils] Error executing native find on ${model.collection.name}:`, error);
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
 * Safe wrapper for find using NATIVE driver with select and sort options
 */
export async function findDocumentsWithOptions<T>(
  model: Model<any>, // Keep model parameter for consistency
  filter: Record<string, any> = {},
  select: string | Record<string, any> | null = null,
  sort: Record<string, any> | null = null
): Promise<T[]> {
  let db;
  try {
    const { db: nativeDb } = await connectDB();
    db = nativeDb;
    const collectionName = model.collection.name;
    safeLog(`[native-utils] Executing native find on ${collectionName} with filter:`, filter);

    // Build projection for select
    let projection: Record<string, any> | undefined = undefined;
    if (typeof select === 'string') {
      projection = {};
      // Simple parser: assumes space-separated fields, respects '-'
      select.split(' ').forEach(field => {
        if (field.startsWith('-')) {
          projection[field.substring(1)] = 0; // Exclude field
        } else if (field.length > 0) {
          projection[field] = 1; // Include field
        }
      });
    } else if (typeof select === 'object' && select !== null) {
       // Allow passing a projection object directly
       projection = select;
    }
    safeLog(`[native-utils] Using projection:`, projection);

    // Build sort options
    let sortOptions: Record<string, any> | undefined = undefined;
    if (sort) {
       sortOptions = sort;
    }
    safeLog(`[native-utils] Using sort:`, sortOptions);

    const startTime = Date.now();
    // Use native find with projection and sort
    let cursor = db.collection(collectionName).find(filter);
    if (projection) {
      cursor = cursor.project(projection);
    }
    if (sortOptions) {
      cursor = cursor.sort(sortOptions);
    }
    
    // Execute the query by converting cursor to array
    const results = await cursor.toArray(); 
    const duration = Date.now() - startTime;
    safeLog(`[native-utils] native find on ${collectionName} completed in ${duration}ms. Found: ${results.length} documents.`);
    
    // IMPORTANT: Mongoose often returns Documents, native driver returns plain objects.
    // If downstream code expects Mongoose Documents (with methods like .save()), this could break.
    // For simple data fetching/display, this cast is usually okay.
    return results as T[]; // Cast result

  } catch (error) {
    safeError(`[native-utils] Error executing native find on ${model.collection.name}:`, error);
    return []; // Return empty array on error
  }
} 