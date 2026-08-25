import mongoose, { Schema, Document } from 'mongoose';

// Job status enum
export enum JobStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

// Vina grid parameters
export interface VinaGridParams {
  centerX: number;
  centerY: number;
  centerZ: number;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  exhaustiveness?: number; // Default: 8
  numModes?: number; // Default: 9
  energyRange?: number; // Default: 3.0
}

// Binding affinity result
export interface AffinityResult {
  mode: number;
  affinity: number; // kcal/mol
  rmsd_lb: number;
  rmsd_ub: number;
}

// Docking job document
export interface IDockingJob extends Document {
  userId: string; // User ID from auth
  jobName: string;
  status: JobStatus;
  
  // File URLs (stored in Cloudflare R2)
  ligandUrl: string; // .pdbqt file URL
  targetUrl: string; // .pdbqt file URL (protein)
  
  // Vina parameters
  vinaParams: VinaGridParams;
  
  // Results
  affinityResults?: AffinityResult[];
  bestAffinity?: number; // Best binding affinity (kcal/mol)
  dockingResultUrl?: string; // R2 URL to output PDBQT
  
  // Metadata
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  
  // Webhook callback URL (optional, for client notifications)
  webhookUrl?: string;
}

const DockingJobSchema = new Schema<IDockingJob>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    jobName: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(JobStatus),
      default: JobStatus.PENDING,
      index: true,
    },
    ligandUrl: {
      type: String,
      required: true,
    },
    targetUrl: {
      type: String,
      required: true,
    },
    vinaParams: {
      centerX: { type: Number, required: true },
      centerY: { type: Number, required: true },
      centerZ: { type: Number, required: true },
      sizeX: { type: Number, required: true },
      sizeY: { type: Number, required: true },
      sizeZ: { type: Number, required: true },
      exhaustiveness: { type: Number, default: 8 },
      numModes: { type: Number, default: 9 },
      energyRange: { type: Number, default: 3.0 },
    },
    affinityResults: [
      {
        mode: Number,
        affinity: Number,
        rmsd_lb: Number,
        rmsd_ub: Number,
      },
    ],
    bestAffinity: Number,
    dockingResultUrl: String,
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    startedAt: Date,
    completedAt: Date,
    errorMessage: String,
    webhookUrl: String,
  },
  { timestamps: true }
);

// Create indexes for query optimization
DockingJobSchema.index({ userId: 1, createdAt: -1 });
DockingJobSchema.index({ status: 1, createdAt: -1 });

export default mongoose.models.DockingJob ||
  mongoose.model<IDockingJob>('DockingJob', DockingJobSchema);
