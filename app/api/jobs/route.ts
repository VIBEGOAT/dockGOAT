import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import DockingJob, { JobStatus, VinaGridParams } from '@/models/Job';
import { uploadToSupabase, generateFileKey } from '../../../lib/supabase-client'

// MongoDB connection
async function connectDB() {
  if (mongoose.connections[0].readyState) return;

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  await mongoose.connect(mongoUri);
}

// Validate request body
interface JobSubmissionPayload {
  userId: string;
  jobName: string;
  ligandUrl: string;
  targetUrl: string;
  vinaParams: VinaGridParams;
  webhookUrl?: string;
}

function validatePayload(body: unknown): JobSubmissionPayload {
  const data = body as any;

  if (!data.userId || typeof data.userId !== 'string') {
    throw new Error('userId is required and must be a string');
  }

  if (!data.jobName || typeof data.jobName !== 'string') {
    throw new Error('jobName is required and must be a string');
  }

  if (!data.ligandUrl || typeof data.ligandUrl !== 'string') {
    throw new Error('ligandUrl is required and must be a string');
  }

  if (!data.targetUrl || typeof data.targetUrl !== 'string') {
    throw new Error('targetUrl is required and must be a string');
  }

  if (!data.vinaParams || typeof data.vinaParams !== 'object') {
    throw new Error('vinaParams is required and must be an object');
  }

  const vp = data.vinaParams;
  const requiredParams = [
    'centerX',
    'centerY',
    'centerZ',
    'sizeX',
    'sizeY',
    'sizeZ',
  ];

  for (const param of requiredParams) {
    if (typeof vp[param] !== 'number') {
      throw new Error(`vinaParams.${param} is required and must be a number`);
    }
  }

  return data;
}

// Trigger Hugging Face Space webhook
async function triggerHuggingFaceWorker(jobId: string, jobData: any) {
  const hfSpaceUrl = process.env.HF_SPACE_API_URL;
  if (!hfSpaceUrl) {
    console.warn('HF_SPACE_API_URL not set, skipping worker trigger');
    return;
  }

  try {
    const response = await fetch(hfSpaceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.HF_SPACE_API_KEY}`,
      },
      body: JSON.stringify({
        jobId,
        userId: jobData.userId,
        ligandUrl: jobData.ligandUrl,
        targetUrl: jobData.targetUrl,
        vinaParams: jobData.vinaParams,
        webhookUrl: jobData.webhookUrl,
        mongodbUri: process.env.MONGODB_URI,
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY,
        supabaseStorageBucket: process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET,
      }),
    });

    if (!response.ok) {
      console.error(
        `Failed to trigger HF worker: ${response.status} ${response.statusText}`
      );
    }
  } catch (error) {
    console.error('Error triggering HF worker:', error);
    // Don't throw - job is already created in DB
  }
}

/**
 * POST /api/jobs
 * Submit a new docking job with file upload to Supabase Storage
 *
 * Request body:
 * {
 *   userId: string
 *   jobName: string
 *   ligandFile: File (multipart form data) or ligandUrl: string (pre-uploaded URL)
 *   targetFile: File (multipart form data) or targetUrl: string (pre-uploaded URL)
 *   vinaParams: { centerX, centerY, centerZ, sizeX, sizeY, sizeZ, ... }
 *   webhookUrl?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type');
    let ligandUrl: string;
    let targetUrl: string;
    let payload: any;

    await connectDB();

    // Handle multipart form data (file uploads)
    if (contentType?.includes('multipart/form-data')) {
      const formData = await request.formData();

      const userId = formData.get('userId') as string;
      const jobName = formData.get('jobName') as string;
      const ligandFile = formData.get('ligandFile') as File | null;
      const targetFile = formData.get('targetFile') as File | null;
      const vinaParams = JSON.parse(
        formData.get('vinaParams') as string
      ) as VinaGridParams;
      const webhookUrl = formData.get('webhookUrl') as string | null;

      // Validate inputs
      if (!userId || !jobName || !ligandFile || !targetFile || !vinaParams) {
        return NextResponse.json(
          {
            success: false,
            error: 'Missing required fields: userId, jobName, ligandFile, targetFile, vinaParams',
          },
          { status: 400 }
        );
      }

      // Upload files to Supabase Storage
      const ligandBuffer = await ligandFile.arrayBuffer();
      const targetBuffer = await targetFile.arrayBuffer();

      const ligandKey = generateFileKey(userId, 'ligands', ligandFile.name);
      const targetKey = generateFileKey(userId, 'proteins', targetFile.name);

      ligandUrl = await uploadToSupabase(
        ligandKey,
        Buffer.from(ligandBuffer),
        'application/octet-stream'
      );

      targetUrl = await uploadToSupabase(
        targetKey,
        Buffer.from(targetBuffer),
        'application/octet-stream'
      );

      payload = {
        userId,
        jobName,
        ligandUrl,
        targetUrl,
        vinaParams,
        webhookUrl: webhookUrl || undefined,
      };
    } else {
      // Handle JSON request with pre-uploaded URLs
      const body = await request.json();
      payload = validatePayload(body);
    }

    // Create new job in database
    const job = await DockingJob.create({
      userId: payload.userId,
      jobName: payload.jobName,
      status: JobStatus.PENDING,
      ligandUrl: payload.ligandUrl,
      targetUrl: payload.targetUrl,
      vinaParams: payload.vinaParams,
      webhookUrl: payload.webhookUrl,
    });

    // Trigger async worker (non-blocking)
    triggerHuggingFaceWorker(job._id.toString(), {
      userId: payload.userId,
      ligandUrl: payload.ligandUrl,
      targetUrl: payload.targetUrl,
      vinaParams: payload.vinaParams,
      webhookUrl: payload.webhookUrl,
    });

    return NextResponse.json(
      {
        success: true,
        jobId: job._id,
        status: job.status,
        message: 'Job submitted successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Job submission error:', message);

    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    );
  }
}

/**
 * GET /api/jobs?userId=<userId>&status=<status>
 * Fetch user's docking jobs
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      );
    }

    await connectDB();

    const query: any = { userId };
    if (status) {
      query.status = status;
    }

    const jobs = await DockingJob.find(query).sort({ createdAt: -1 }).lean();

    return NextResponse.json({
      success: true,
      jobs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Job fetch error:', message);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
