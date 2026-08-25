# DockGOAT Quick Setup Guide

## 5-Minute Quick Start

### Step 1: MongoDB Atlas (2 min)

1. Go to https://www.mongodb.com/cloud/atlas → Create Account
2. Create M0 Free cluster
3. Click "Connect" → "Drivers" → Copy connection string
4. In your project, create `.env.local`:
   ```
   MONGODB_URI=mongodb+srv://user:password@cluster0.xxxxx.mongodb.net/dockgoat?retryWrites=true&w=majority
   ```

### Step 2: Cloudflare R2 (2 min)

1. Go to https://dash.cloudflare.com/ → Create Account
2. Navigate to R2 → Create bucket named `dockgoat`
3. Click R2 API Tokens → Create token with All permissions
4. Add to `.env.local`:
   ```
   CF_R2_ENDPOINT=https://xxxxx.r2.cloudflarestorage.com
   CF_R2_ACCESS_KEY=your_key
   CF_R2_SECRET_KEY=your_secret
   CF_R2_BUCKET=dockgoat
   CF_R2_PUBLIC_URL=https://r2.yourdomain.com
   ```

### Step 3: Hugging Face Spaces (1 min)

1. Go to https://huggingface.co/new-space
2. Create Docker space named `dockgoat-worker`
3. Git push this repo to the Space
4. Add MongoDB & R2 credentials in Space secrets
5. Add to `.env.local`:
   ```
   HF_SPACE_API_URL=https://your-username-dockgoat-worker.hf.space/process-job
   HF_SPACE_API_KEY=your_hf_token
   ```

### Step 4: Deploy to Vercel

1. Push to GitHub
2. Go to https://vercel.com → Import project
3. Add `.env.local` variables to Vercel project settings
4. Deploy ✨

---

## Testing Locally

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# In another terminal, test API
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "jobName": "Test Docking",
    "ligandUrl": "https://r2.yourdomain.com/test-ligand.pdbqt",
    "targetUrl": "https://r2.yourdomain.com/test-protein.pdbqt",
    "vinaParams": {
      "centerX": 0,
      "centerY": 0,
      "centerZ": 0,
      "sizeX": 20,
      "sizeY": 20,
      "sizeZ": 20
    }
  }'
```

---

## Next Steps

1. **Add Authentication** (Clerk, Auth0, Supabase)
2. **Build File Upload UI** (Next.js form + Cloudflare R2)
3. **Add 3D Visualization** (Mol*, PyMOL.js)
4. **Deploy to production** (Vercel, HF Spaces)

For full details, see `ARCHITECTURE.md`
