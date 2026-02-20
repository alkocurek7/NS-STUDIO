# Neural Shelf — Indexing Studio

A personal indexing tool built on the Neural Shelf methodology.

## Deploy to Vercel (step by step)

### Option A: GitHub + Vercel (recommended)

1. Create a new GitHub repository (public or private)
2. Upload all these files keeping the folder structure:
   ```
   index.html
   package.json
   vite.config.js
   src/
     main.jsx
     NeuralShelfStudio.jsx
   ```
3. Go to vercel.com → New Project → Import your GitHub repo
4. Vercel will auto-detect Vite. Leave all settings as default.
5. Click Deploy. Done.

### Option B: Vercel CLI

```bash
npm install -g vercel
cd neural-shelf-deploy
npm install
vercel
```

## Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:5173

## Storage note

Data is saved to your browser's localStorage. It stays on the device you use.
Images are stored as base64 — large photos may hit the ~5MB localStorage limit.
If you want data to sync across devices in the future, that's a database upgrade (Supabase is a good free option).
