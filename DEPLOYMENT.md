# Styx Netlify & Cloud Deployment Guide 🚀

This repository is configured as a **unified single-folder project** ready for 1-click deployment on **Netlify** (Frontend) and **Render / Railway / Heroku** (Backend + MongoDB).

---

## 1. Deploying Frontend to Netlify

### Option A: 1-Click Git Deployment (Recommended)
1. Push this repository to GitHub / GitLab / Bitbucket.
2. Log into [Netlify Dashboard](https://app.netlify.com/) and click **"Add new site"** -> **"Import an existing project"**.
3. Select your repository.
4. Netlify will automatically detect [netlify.toml](file:///c:/Users/arora/Desktop/Styx/netlify.toml) with these settings:
   - **Build Command**: `npm run build:frontend`
   - **Publish directory**: `frontend/dist`
   - **Node Version**: `20`
5. Set environment variable under **Site Configuration -> Environment Variables**:
   - `VITE_API_BASE_URL`: `https://your-backend-api.onrender.com/api` (URL of your live backend API).
6. Click **Deploy Site**.

### Option B: Manual Netlify CLI Deployment
```bash
# Build frontend static files
npm run build:frontend

# Deploy frontend/dist folder using Netlify CLI
npx netlify-cli deploy --dir=frontend/dist --prod
```

---

## 2. Deploying Backend API & Database

### Deploying Backend to Render / Railway / Heroku
1. Create a MongoDB database using **MongoDB Atlas** (Free M0 cluster) and copy your connection string (`mongodb+srv://...`).
2. Create a new **Web Service** on [Render.com](https://render.com/) or [Railway.app](https://railway.app/).
3. Connect your repository and configure settings:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
4. Set Environment Variables:
   - `MONGODB_URI`: `mongodb+srv://user:password@cluster.mongodb.net/expense-tracker`
   - `GEMINI_API_KEY`: `your-google-gemini-api-key`
   - `NODE_ENV`: `production`
   - `CORS_ORIGIN`: `https://your-netlify-app-name.netlify.app`
