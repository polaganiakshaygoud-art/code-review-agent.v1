# Deployment Guide: Code Review Agent

This guide will help you deploy your application to a production server (specifically **Render**, as requested).

## Prerequisites
- A **Render.com** account.
- Your project pushed to a **GitHub** or **GitLab** repository.
- A **Groq API Key** (from [console.groq.com](https://console.groq.com/)).

## 🚀 Step 1: Create a New Web Service on Render
1.  Log in to your [Render Dashboard](https://dashboard.render.com/).
2.  Click **New +** and select **Web Service**.
3.  Connect your repository.

## ⚙️ Step 2: Configure Service Settings
Fill in the following details:
- **Name**: `code-review-agent` (or your choice).
- **Runtime**: `Node`.
- **Build Command**: `npm run build`
- **Start Command**: `npm start`

## 🔐 Step 3: Set Environment Variables
Go to the **Environment** tab in your Render service and add:
1.  `GROQ_API_KEY`: Paste your key here.
2.  `NODE_ENV`: `production`
3.  `GROQ_MODEL`: `llama-3.3-70b-versatile` (or your preferred model).

## 📄 Step 4: Deploy!
- Click **Create Web Service**. 
- Render will automatically run `npm install` (which triggers our `postinstall` script to install backend/frontend deps), then `npm run build` to build the frontend, and finally `npm start` to launch the server.

---

### 💡 Important Notes
- **Persistence**: The "Hindsight Memory" is stored in `hindsight_vault.json`. On Render, this file is ephemeral. It will work during the session, but it will reset whenever the server restarts or you redeploy.
- **URL**: Once deployed, Render will provide a URL like `https://code-review-agent.onrender.com`.

---
## Local Verification
To test if it works locally before pushing:
1.  Run `npm run build` in the root.
2.  Run `npm start` in the root.
3.  Open `http://localhost:4000`.
