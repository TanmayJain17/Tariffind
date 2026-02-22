# Deployment Guide (Vercel + Railway)

## Backend (Railway)
1. Create project from this GitHub repo.
2. Set root directory to `backend`.
3. Add env vars: `ANTHROPIC_API_KEY`, `SERPAPI_KEY`.
4. Deploy and verify `https://<railway-domain>/health`.

## Frontend (Vercel)
1. Import this repo in Vercel.
2. Set root directory to `frontend`.
3. Add env var: `VITE_API_URL=https://<railway-domain>`.
4. Deploy and verify app loads.

## Notes
- `backend/railway.toml` and `backend/Procfile` are included.
- `frontend/vercel.json` is included.
- Env templates are included at `backend/.env.example` and `frontend/.env.production.example`.
