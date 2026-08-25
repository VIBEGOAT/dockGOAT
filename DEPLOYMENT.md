# DockGOAT Deployment Guide

Complete step-by-step instructions for deploying dockGOAT to production with zero cost.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Part 1: MongoDB Atlas Setup](#part-1-mongodb-atlas-setup)
3. [Part 2: Supabase Setup](#part-2-supabase-setup)
4. [Part 3: Hugging Face Spaces Worker](#part-3-hugging-face-spaces-worker)
5. [Part 4: Vercel Deployment](#part-4-vercel-deployment)
6. [Verification](#verification)

---

## Prerequisites

- GitHub account (for version control)
- A GitHub repository with this code
- Modern web browser
- Basic command line knowledge

---

## Part 1: MongoDB Atlas Setup

### 1.1 Create MongoDB Account

1. Visit https://www.mongodb.com/cloud/atlas
2. Click "Sign Up" (create free account)
3. Provide email and password
4. Verify email

### 1.2 Create M0 Free Cluster

1. On dashboard, click "Create a Deployment"
2. Select **M0 Free Tier** (default)
3. Choose preferred provider (AWS, Google Cloud, or Azure - all free)
4. Click "Create Deployment"
5. Wait 5-10 minutes for cluster to initialize

### 1.3 Set Security Credentials

1. In "Database Access" tab:
   - Click "Add New Database User"
   - Username: `dockgoat`
   - Password: Generate strong password (copy it!)
   - Database: Select "Read and write to any database"
   - Click "Add User"

2. In "Network Access" tab:
   - Click "Add IP Address"
   - Select "Allow Access from Anywhere" (0.0.0.0/0)
   - Click "Confirm"

### 1.4 Get Connection String

1. Go to "Databases" tab
2. Click "Connect" button on your cluster
3. Select "Drivers" option
4. Choose "Node.js" (default)
5. **Copy the connection string**
6. Replace `<password>` with your actual password
7. Example:
   ```
   mongodb+srv://dockgoat:your_password@cluster0.xxxxx.mongodb.net/dockgoat?retryWrites=true&w=majority
   ```

---

## Part 2: Supabase Setup

### 2.1 Create Supabase Account

1. Visit https://supabase.com/
2. Click "Sign Up" (create free account)
3. Provide email and password (or sign up with GitHub)
4. Verify email

### 2.2 Create New Project

1. Click "New Project" or "Create a new project"
2. Fill in:
   - **Project name**: `dockgoat`
   - **Database password**: Generate strong password (copy it!)
   - **Region**: Choose closest to you (all free)
3. Click "Create new project"
4. Wait 2-3 minutes for project to initialize

### 2.3 Get API Keys

1. Go to **Project Settings** (gear icon)
2. Click **API** in the left sidebar
3. Copy these values:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Anon (public) Key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Service Role Key** → `SUPABASE_SERVICE_KEY` (keep this secret!)

Example:
```
NEXT_PUBLIC_SUPABASE_URL=https://xyzabc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2.4 Create Storage Bucket

1. In Supabase dashboard, click **Storage** in left sidebar
2. Click **Create a new bucket**
3. Bucket name: `dockgoat-files`
4. Check "Public bucket" (so files can be accessed publicly)
5. Click "Create bucket"

### 2.5 Set Bucket Policies (Optional but Recommended)

1. Click the bucket you just created
2. Click **Policies** tab
3. For security, you may want to add row-level security policies
4. (Default settings work for this demo - adjust as needed for production)

---

## Part 3: Hugging Face Spaces Worker

### 3.1 Create Hugging Face Account

1. Visit https://huggingface.co
2. Click "Sign Up"
3. Provide email and password
4. Verify email

### 3.2 Create New Space

1. Go to https://huggingface.co/new-space
2. Fill in:
   - **Space name**: `dockgoat-worker`
   - **License**: Open Rail M
   - **Space SDK**: Docker
   - **Visibility**: Private (recommended)
3. Click **Create Space**

### 3.3 Push Code to Space

Clone the Space repository and push this project:

```bash
# Get your HF username from https://huggingface.co/settings/profile
git clone https://huggingface.co/spaces/your-username/dockgoat-worker
cd dockgoat-worker

# Copy files from this project
# Copy: Dockerfile, requirements.txt, worker/app.py

# Commit and push
git add .
git commit -m "Initial dockGOAT worker setup with Supabase Storage"
git push
```

The Space will automatically rebuild and deploy. Monitor build logs in the Space interface.

### 3.4 Add Environment Secrets

1. Go to your Space → **Settings** tab
2. Scroll to "Repository secrets"
3. Click "Add a secret"
4. Add each key-value pair:

| Secret | Value |
|--------|-------|
| `MONGODB_URI` | Your connection string from Part 1 |
| `SUPABASE_URL` | Your Supabase Project URL |
| `SUPABASE_SERVICE_KEY` | Your Supabase Service Role Key |
| `SUPABASE_STORAGE_BUCKET` | `dockgoat-files` |

### 3.5 Get Space API URL

Once the Space is running:
1. Your Space URL will be: `https://your-username-dockgoat-worker.hf.space`
2. API endpoint: `https://your-username-dockgoat-worker.hf.space/process-job`

---

## Part 4: Vercel Deployment

### 4.1 Prepare Repository

Ensure your GitHub repository contains:

```
├── app/
│   └── api/
│       └── jobs/
│           └── route.ts
├── models/
│   └── Job.ts
├── lib/
│   ├── mongodb.ts
│   ├── supabase-client.ts
│   └── job-helpers.ts
├── worker/
│   └── app.py
├── Dockerfile
├── requirements.txt
├── .env.example
├── next.config.ts
├── tsconfig.json
├── package.json
└── ARCHITECTURE.md
```

**Important**: Do NOT commit `.env.local`. It's already in `.gitignore`.

### 4.2 Push to GitHub

```bash
git add .
git commit -m "dockGOAT with Supabase Storage architecture"
git push origin main
```

### 4.3 Deploy to Vercel

1. Go to https://vercel.com
2. Click "Add New" → "Project"
3. Click "Import Git Repository"
4. Select your GitHub repository
5. Click "Import"

### 4.4 Configure Environment Variables

1. On the "Environment Variables" step:
2. Add the following variables:

| Key | Value |
|-----|-------|
| `MONGODB_URI` | Your connection string from Part 1 |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase Anon Key |
| `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET` | `dockgoat-files` |
| `SUPABASE_URL` | Your Supabase Project URL |
| `SUPABASE_SERVICE_KEY` | Your Supabase Service Key |
| `HF_SPACE_API_URL` | `https://your-username-dockgoat-worker.hf.space/process-job` |
| `HF_SPACE_API_KEY` | Your Hugging Face API token (from https://huggingface.co/settings/tokens) |

### 4.5 Deploy

1. Click "Deploy"
2. Wait for build to complete (~2-3 minutes)
3. You'll see "Congratulations! Your project has been successfully deployed"
4. Click "Visit" to see your live site
5. Your URL: `https://your-project-name.vercel.app`

---

## Verification

### Test MongoDB Connection

```bash
# From your local machine with .env.local set:
npm run dev

# In another terminal:
curl -X GET http://localhost:3000/api/jobs?userId=test
# Should return: { "success": true, "jobs": [] }
```

### Test API Endpoint (with file upload)

```bash
# Create test files
echo "ligand structure" > ligand.pdbqt
echo "protein structure" > protein.pdbqt

# Upload files
curl -X POST http://localhost:3000/api/jobs \
  -F "userId=test-user" \
  -F "jobName=Test Docking" \
  -F "ligandFile=@ligand.pdbqt" \
  -F "targetFile=@protein.pdbqt" \
  -F 'vinaParams={"centerX":0,"centerY":0,"centerZ":0,"sizeX":20,"sizeY":20,"sizeZ":20}'
```

Expected response:
```json
{
  "success": true,
  "jobId": "507f1f77bcf86cd799439011",
  "status": "PENDING",
  "message": "Job submitted successfully"
}
```

### Test Supabase Storage

1. Go to your Supabase project
2. Click **Storage** in left sidebar
3. Click `dockgoat-files` bucket
4. You should see uploaded files organized by `userId/ligands/` or `userId/proteins/`
5. Click on a file → click "Copy URL" to get public URL

### Check HF Space Logs

1. Go to your HF Space
2. Click "Logs" tab
3. You should see the FastAPI app running and ready to receive jobs

### Monitor Vercel Deployment

1. Go to https://vercel.com
2. Select your project
3. View deployment logs in "Deployments" tab
4. Check "Functions" tab for API performance

---

## Troubleshooting

### "SUPABASE_URL not set" Error

**Problem**: API returns error about missing Supabase URL

**Solution**:
1. Go to Vercel project settings
2. Check "Environment Variables" section
3. Ensure all `SUPABASE_*` variables are set
4. Redeploy (Vercel will auto-redeploy after env var update)

### Files Not Appearing in Supabase Storage

**Problem**: Uploaded files don't appear in bucket

**Solution**:
1. Verify bucket name is `dockgoat-files` (case-sensitive)
2. Check bucket is set to "Public" in Supabase dashboard
3. Verify Supabase API keys are correct
4. Try uploading directly via Supabase dashboard to verify bucket works
5. Check browser console for any error messages

### HF Space Worker Doesn't Process Jobs

**Problem**: Jobs stay in PENDING status

**Solution**:
1. Check HF Space logs for errors (click "Logs" tab)
2. Verify all Supabase secrets are set in Space settings
3. Verify MongoDB URI secret is set in Space
4. Check if Space has enough memory/CPU running
5. Verify `HF_SPACE_API_URL` is correct in Vercel
6. Test Space endpoint: `curl https://your-space.hf.space/health`

### "Connection refused" to HF Space

**Problem**: API can't reach HF Space worker

**Solution**:
1. Verify HF Space is running (check "Status" page)
2. Verify URL is correct (including `/process-job` endpoint)
3. Check Space isn't in "paused" state
4. Try accessing Space URL directly in browser
5. Check network logs in browser developer tools

### "No auth token" from Supabase

**Problem**: Supabase returns authentication error

**Solution**:
1. Verify `NEXT_PUBLIC_SUPABASE_ANON_KEY` is for anonymous (public) access
2. Verify `SUPABASE_SERVICE_KEY` is for server-side operations
3. Check keys haven't been regenerated (would invalidate old ones)
4. Visit Supabase dashboard → Settings → API to get fresh keys

---

## Cost Verification

After 24 hours, verify no charges:

| Service | Check |
|---------|-------|
| **MongoDB** | Go to https://cloud.mongodb.com/ → Billing → Should show $0 |
| **Supabase** | Go to https://app.supabase.com/ → Project Settings → Billing → Should show $0 |
| **Vercel** | Go to https://vercel.com/account/billing → Should show $0 usage |
| **Hugging Face** | Go to https://huggingface.co/billing → Should show $0 |

---

## Next Steps

1. **Add Authentication**: Implement user login (Clerk, Auth0, Supabase Auth)
2. **Build UI**: Create frontend form for file upload
3. **Add Visualization**: Integrate 3D structure viewer
4. **Set Up Monitoring**: Add error tracking (Sentry) and analytics
5. **Implement Rate Limiting**: Protect API from abuse
6. **Add Tests**: Write integration tests for critical paths

---

## Support

For issues:
1. Check logs in Vercel/HF Spaces dashboards
2. Review this deployment guide
3. Consult ARCHITECTURE.md for design details
4. Check individual service documentation:
   - MongoDB: https://docs.mongodb.com/
   - Supabase: https://supabase.com/docs/
   - Hugging Face: https://huggingface.co/docs
   - Vercel: https://vercel.com/docs

Good luck! 🚀

