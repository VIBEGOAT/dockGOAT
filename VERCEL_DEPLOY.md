# 🚀 Deploy dockGOAT to Vercel

Your code is pushed to GitHub! Now deploy to Vercel in 3 minutes.

## Step 1: Go to Vercel

1. Open https://vercel.com
2. Click **"Add New..." → "Project"**
3. Click **"Import Git Repository"**

## Step 2: Connect GitHub

1. Select your GitHub repository: **VIBEGOAT/dockGOAT**
2. Click **"Import"**

## Step 3: Configure Environment Variables

Vercel will show the project settings screen. Click **"Environment Variables"** and add:

```
MONGODB_URI=mongodb+srv://user:password@cluster0.xxxxx.mongodb.net/dockgoat?retryWrites=true&w=majority

NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=dockgoat-files

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_supabase_service_key

HF_SPACE_API_URL=https://your-username-dockgoat-worker.hf.space/process-job
HF_SPACE_API_KEY=your_hf_token
```

**Where to get these values:**
- **MONGODB_URI**: MongoDB Atlas → Databases → Connect → Drivers
- **SUPABASE_URL & KEYS**: Supabase → Project Settings → API
- **HF_SPACE_URL**: Your Hugging Face Space URL
- **HF_SPACE_API_KEY**: https://huggingface.co/settings/tokens

## Step 4: Deploy

1. Click **"Deploy"**
2. Wait 2-3 minutes for build to complete
3. You'll see "Congratulations! Your project has been successfully deployed"
4. Click **"Visit"** to see your live site!

## ✅ Your Site is Live!

You'll get a URL like: **https://dockgoat-xyz123.vercel.app**

---

## 🔄 Automatic Deployments

Now whenever you push to `main` branch:
```bash
git add .
git commit -m "Your changes"
git push origin main
# Vercel automatically rebuilds and deploys!
```

---

## 📊 Vercel Dashboard

Access your site anytime at: https://vercel.com/dashboard

You can:
- ✅ View deployments
- ✅ See build logs
- ✅ Check performance metrics
- ✅ Manage environment variables
- ✅ Configure custom domain

---

## 🌐 Custom Domain (Optional)

To use your own domain:

1. Go to Vercel Dashboard → Your Project
2. Click **"Settings"** → **"Domains"**
3. Enter your domain (e.g., `docking.com`)
4. Follow DNS setup instructions
5. Domain will be live in 24 hours

---

## 🔒 Security Notes

- Never commit `.env.local` to GitHub (already in `.gitignore`)
- Supabase Service Key is SECRET - only in environment variables
- Use MongoDB authentication (username/password)
- Enable HTTPS (automatic with Vercel)

---

## ✨ What's Deployed

Your complete dockGOAT application:
- ✅ Frontend (Next.js React UI)
- ✅ API routes (Job submission & query)
- ✅ MongoDB integration (ready to connect)
- ✅ Supabase Storage (ready to upload files)
- ✅ Real-time job polling
- ✅ Professional dark theme UI

---

## 🆘 Troubleshooting

### Build fails in Vercel
- Check environment variables are set correctly
- View build logs in Vercel dashboard
- Ensure all dependencies installed locally: `npm install`

### API returns 500 error
- Check MongoDB connection string
- Verify Supabase credentials
- View Vercel function logs

### Website loads but no jobs appear
- Ensure MongoDB is connected
- Check if environment variables are set
- Test API directly: `https://your-site.vercel.app/api/jobs?userId=test`

---

## 📈 Next Steps After Deployment

1. **Add authentication** (Clerk, Auth0, Supabase Auth)
2. **Configure custom domain**
3. **Set up monitoring** (error tracking, analytics)
4. **Enable database backups**
5. **Test with real Supabase credentials**
6. **Deploy compute worker to HF Spaces**
7. **Configure webhooks for job notifications**

---

## 💬 Support

For Vercel help: https://vercel.com/support
For Next.js help: https://nextjs.org/docs

---

**You're all set! Your dockGOAT is now production-ready and deployed to Vercel! 🚀**

Visit your live site and start docking! 🧪
