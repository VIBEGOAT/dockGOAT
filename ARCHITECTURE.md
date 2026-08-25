# DockGOAT Zero-Cost SaaS Architecture

A commercial-grade molecular docking platform using generous free tiers. This document outlines the complete architecture, setup process, and deployment instructions.

## Tech Stack Overview

| Component | Service | Free Tier | Cost |
|-----------|---------|-----------|------|
| Frontend & API | Vercel | Hobby (Unlimited deployments, serverless) | $0 |
| Database | MongoDB Atlas | M0 Cluster (512 MB, forever free) | $0 |
| File Storage | Supabase Storage | 1 GB per project (no credit card required) | $0 |
| Compute Worker | Hugging Face Spaces | Docker (2 vCPU, 16 GB RAM) | $0 |

**Total Monthly Cost: $0**

---

## Storage Comparison: Supabase vs Cloudflare R2

| Feature | Supabase Storage | Cloudflare R2 |
|---------|------------------|---------------|
| **Free Tier** | 1 GB per project | 10 GB/month |
| **Credit Card** | NOT required ✅ | Required ✗ |
| **Auth** | Built-in | Via API tokens |
| **File Limit** | 5 GB per file | Unlimited |
| **Ideal For** | Hobby/startup | Production scale |

**For this project, Supabase Storage is perfect—no credit card needed and 1 GB is enough for thousands of small-to-medium docking jobs.**

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                   │
│                   Deployed on Vercel (Free)                 │
└────────────────────────┬────────────────────────────────────┘
                         │
                    HTTPS REST API
                         │
        ┌────────────────┴────────────────┐
        │                                 │
    ┌───▼────────────┐          ┌────────▼──────────┐
    │  Job Submission│          │  Job Status Query │
    │  (POST /jobs)  │          │  (GET /jobs)      │
    └───┬────────────┘          └────────┬──────────┘
        │                                │
        └────────────────┬───────────────┘
                         │
            ┌────────────▼────────────┐
            │  MongoDB Atlas M0       │
            │  • Job metadata         │
            │  • Status tracking      │
            │  • Result storage       │
            └────────────┬────────────┘
                         │
    ┌────────────────────┴────────────────────┐
    │                                         │
    │  Async Webhook Trigger                  │
    │  (HF_SPACE_API_URL + Job ID)           │
    │                                         │
    ┌────▼──────────────────────────────────┐
    │  Hugging Face Spaces (Docker)         │
    │  • Python FastAPI Worker               │
    │  • AutoDock Vina + OpenBabel          │
    │  • 2 vCPU, 16 GB RAM (Free Tier)      │
    │                                       │
    │  Workflow:                            │
    │  1. Download files from Supabase      │
    │  2. Run Vina docking                  │
    │  3. Upload results to Supabase        │
    │  4. Update MongoDB with results       │
    │  5. Send webhook callback             │
    └───┬────────────────────────────────────┘
        │
    ┌───▼────────────────────────────────┐
    │  Supabase Storage                  │
    │  • Input files (.pdbqt, .sdf)     │
    │  • Output structures               │
    │  • 1 GB/project, no credit card   │
    └────────────────────────────────────┘
```

---

## File Structure

```
project/
├── app/
│   ├── api/
│   │   └── jobs/
│   │       └── route.ts           # Job submission & query API
│   ├── layout.tsx
│   └── page.tsx
├── models/
│   └── Job.ts                     # Mongoose schema
├── lib/
│   ├── mongodb.ts                 # MongoDB connection
│   ├── supabase-client.ts         # Supabase Storage helpers
│   └── job-helpers.ts             # Common job operations
├── worker/
│   └── app.py                     # FastAPI worker app
├── Dockerfile                     # For HF Spaces
├── requirements.txt               # Python dependencies
├── .env.example                   # Environment template
├── next.config.ts
├── tsconfig.json
├── package.json
└── ARCHITECTURE.md               # This file
```

---

## API Documentation

### Submit Docking Job (with file upload)

```http
POST /api/jobs
Content-Type: multipart/form-data

userId=user123
jobName=Ligand A + Protein B
ligandFile=@ligand.pdbqt
targetFile=@protein.pdbqt
vinaParams={"centerX":10.5,"centerY":20.3,"centerZ":15.1,...}
webhookUrl=https://yourapp.com/webhooks/docking (optional)
```

**Response:**
```json
{
  "success": true,
  "jobId": "507f1f77bcf86cd799439011",
  "status": "PENDING",
  "message": "Job submitted successfully"
}
```

### Submit Job with Pre-uploaded URLs

```http
POST /api/jobs
Content-Type: application/json

{
  "userId": "user123",
  "jobName": "Ligand A + Protein B",
  "ligandUrl": "https://your-project.supabase.co/storage/v1/object/public/dockgoat-files/...",
  "targetUrl": "https://your-project.supabase.co/storage/v1/object/public/dockgoat-files/...",
  "vinaParams": {
    "centerX": 10.5,
    "centerY": 20.3,
    "centerZ": 15.1,
    "sizeX": 20,
    "sizeY": 20,
    "sizeZ": 20,
    "exhaustiveness": 8,
    "numModes": 9,
    "energyRange": 3.0
  },
  "webhookUrl": "https://yourapp.com/webhooks/docking"
}
```

### Fetch User Jobs

```http
GET /api/jobs?userId=user123&status=COMPLETED
```

**Response:**
```json
{
  "success": true,
  "jobs": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "userId": "user123",
      "jobName": "Ligand A + Protein B",
      "status": "COMPLETED",
      "bestAffinity": -7.5,
      "dockingResultUrl": "https://your-project.supabase.co/storage/v1/object/public/dockgoat-files/...",
      "affinityResults": [
        {
          "mode": 1,
          "affinity": -7.5,
          "rmsd_lb": 0.0,
          "rmsd_ub": 0.0
        }
      ],
      "createdAt": "2026-08-25T10:30:00Z",
      "completedAt": "2026-08-25T10:45:00Z"
    }
  ]
}
```

---

## Job Processing Flow

1. **User Submits Job** (Next.js Frontend)
   - Uploads ligand & protein
   - Calls `/api/jobs` with file data or URLs

2. **Next.js API**
   - Validates input
   - Uploads files to Supabase Storage (if multipart)
   - Creates job in MongoDB (status: PENDING)
   - Triggers HF Space webhook (async, non-blocking)
   - Returns jobId to client

3. **HF Space Worker** (Receives webhook)
   - Updates job status to RUNNING
   - Downloads files from Supabase Storage
   - Runs AutoDock Vina
   - Uploads results to Supabase Storage
   - Updates MongoDB with results and binding affinities
   - Sends webhook callback to client (optional)

4. **Client Polls Status**
   - Calls `GET /api/jobs?userId=X` periodically
   - Displays results when status = COMPLETED
   - Downloads result files from Supabase Storage public URLs

---

## Cost Analysis

### Free Tier Limits (Per Month)

| Service | Limit | Usage |
|---------|-------|-------|
| MongoDB | 512 MB storage | ~10K jobs (metadata) |
| Supabase Storage | 1 GB storage | ~1,000 docking runs |
| Vercel | Unlimited requests | Serverless, pay-per-use |
| HF Spaces | 2 vCPU, 16 GB RAM | Continuous runner |

### Scaling Path

When you outgrow free tiers:
- **MongoDB**: Upgrade to M2+ ($57/month for 2.5 GB)
- **Supabase Storage**: Additional storage at $0.025/GB
- **Vercel**: Functions scale automatically, pay per request
- **HF Spaces**: Upgrade to paid tier ($7-$30/month)

---

## Monitoring & Debugging

### Supabase Dashboard

- Navigate to https://app.supabase.com
- View Storage → `dockgoat-files` bucket
- Monitor API usage and analytics

### MongoDB Compass (Free GUI)

```bash
# Download: https://www.mongodb.com/products/compass
# Connect using your MONGODB_URI
# Monitor collections in real-time
```

### View HF Space Logs

- Navigate to your Space
- Click "Logs" tab
- Watch real-time FastAPI output

---

## Production Checklist

- [ ] Set strong passwords for MongoDB
- [ ] Configure Supabase RLS policies (row-level security)
- [ ] Configure CORS properly in Vercel
- [ ] Add rate limiting to API routes
- [ ] Implement authentication (Clerk, Auth0, Supabase Auth)
- [ ] Set up monitoring/alerting
- [ ] Enable MongoDB backups
- [ ] Test webhook retry logic
- [ ] Document file format requirements
- [ ] Set up error logging (Sentry, etc.)

---

## Troubleshooting

### "SUPABASE_URL not set" Error

Check `.env.local` exists and contains Supabase credentials.

### Vina Not Found in HF Space

Ensure `requirements.txt` contains `vina==1.2.5` and rebuild Space.

### File Upload to Supabase Fails

- Check bucket name is `dockgoat-files`
- Verify bucket is set to "Public"
- Ensure API keys are correct

### Job Never Completes

- Check HF Space logs for errors
- Verify MongoDB connection in worker
- Check Supabase credentials in Space secrets

---

## Future Enhancements

1. **Authentication**: Add user auth (Clerk, Auth0, Supabase)
2. **File Management**: UI for uploading protein/ligand files
3. **Result Visualization**: 3D structure viewer (PyMOL.js, Mol*)
4. **Batch Processing**: Submit multiple jobs at once
5. **Advanced Parameters**: UI for all Vina parameters
6. **Job Scheduling**: Queue management for large workloads
7. **Webhooks**: Real-time updates via WebSockets
8. **Cost Tracking**: Monitor free tier usage vs limits

---

## References

- [MongoDB Atlas Free Tier](https://www.mongodb.com/docs/atlas/admin/billing/free-tier/)
- [Supabase Storage Docs](https://supabase.com/docs/guides/storage)
- [Hugging Face Spaces Docker](https://huggingface.co/docs/hub/spaces-sdks-docker)
- [AutoDock Vina Documentation](https://vina.scripps.edu/)
- [Vercel Deployment Guide](https://vercel.com/docs/deployments/overview)

---

## License

MIT - Feel free to use this architecture for commercial projects!
