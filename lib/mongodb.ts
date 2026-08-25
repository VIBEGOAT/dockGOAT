/**
 * MongoDB connection utility for Next.js
 * Handles connection pooling and caching
 */

import mongoose, { Mongoose } from 'mongoose';

interface MongooseConnection {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
}

let cached: MongooseConnection = {
  conn: null,
  promise: null,
};

/**
 * Connect to MongoDB Atlas
 * Reuses connection in development to avoid opening multiple connections
 */
export async function connectDB(): Promise<Mongoose> {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error(
      'Please define the MONGODB_URI environment variable inside .env.local'
    );
  }

  // Return cached connection if available
  if (cached.conn) {
    return cached.conn;
  }

  // Return existing promise if in progress
  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
    };

    cached.promise = mongoose
      .connect(mongoUri, opts)
      .then((mongoose) => {
        console.log('Connected to MongoDB');
        return mongoose;
      })
      .catch((error) => {
        console.error('Failed to connect to MongoDB:', error);
        cached.promise = null;
        throw error;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

/**
 * Disconnect from MongoDB
 * Useful for serverless functions
 */
export async function disconnectDB(): Promise<void> {
  if (cached.conn) {
    await cached.conn.disconnect();
    cached.conn = null;
    cached.promise = null;
  }
}

export default connectDB;
