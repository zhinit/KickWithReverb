# Connections & Environment Variables

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              LOCAL DEVELOPMENT                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Browser ──► React Dev Server ──► Django Dev Server ──► Supabase           │
│              (localhost:5173)      (localhost:8000)      (PostgreSQL)        │
│                                                                              │
│   No VITE_API_URL set              Reads django/.env     Pooler connection   │
│   (defaults to localhost:8000)                                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                                PRODUCTION                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Browser ──► Vercel ─────────────► Railway ─────────────► Supabase          │
│              (React)                (Django + Gunicorn)    (PostgreSQL)      │
│                                                                              │
│   kick-with-reverb    HTTPS API     kickwithreverb-        Pooler connection │
│   .vercel.app         requests      production.up.         Port 6543         │
│                                     railway.app:8080                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Environment Variable Locations

| Location          | File/Platform                                       | Used By           |
| ----------------- | --------------------------------------------------- | ----------------- |
| Local Django      | `django/.env`                                       | Django dev server |
| Local React       | None (uses defaults)                                | Vite dev server   |
| Production Django | Railway Dashboard → Variables                       | Gunicorn/Django   |
| Production React  | Vercel Dashboard → Settings → Environment Variables | Vite build        |

## All Environment Variables

### Django Backend Variables

| Variable               | Description                       | Local Value                                 | Production Value                             |
| ---------------------- | --------------------------------- | ------------------------------------------- | -------------------------------------------- |
| `SECRET_KEY`           | Django cryptographic signing key  | Any string (insecure ok for dev)            | `${{ secret(50) }}` (Railway auto-generates) |
| `DEBUG`                | Enable debug mode                 | `True`                                      | `False`                                      |
| `ALLOWED_HOSTS`        | Hosts allowed to serve the app    | Not set (defaults to `localhost,127.0.0.1`) | `kickwithreverb-production.up.railway.app`   |
| `CORS_ALLOWED_ORIGINS` | Origins allowed for CORS requests | Not set (uses hardcoded localhost)          | `https://kick-with-reverb.vercel.app`        |
| `DB_NAME`              | PostgreSQL database name          | `postgres`                                  | `postgres`                                   |
| `DB_USER`              | PostgreSQL user                   | `postgres.{project_ref}`                    | `postgres.{project_ref}`                     |
| `DB_PASSWORD`          | PostgreSQL password               | (from Supabase)                             | (from Supabase)                              |
| `DB_HOST`              | PostgreSQL host                   | `aws-1-us-east-1.pooler.supabase.com`       | `aws-1-us-east-1.pooler.supabase.com`        |
| `DB_PORT`              | PostgreSQL port                   | `6543`                                      | `6543`                                       |

**Note**: Both local and production use the same Supabase database via the pooler connection.

### React Frontend Variables

| Variable       | Description          | Local Value                                   | Production Value                                   |
| -------------- | -------------------- | --------------------------------------------- | -------------------------------------------------- |
| `VITE_API_URL` | Backend API base URL | Not set (defaults to `http://localhost:8000`) | `https://kickwithreverb-production.up.railway.app` |

## How Variables Are Read

### Django (`django/config/settings.py`)

```python
# Loads from .env file locally, from platform env vars in production
from dotenv import load_dotenv
load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
DEBUG = os.getenv("DEBUG", "FALSE") == "True"
ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("DB_NAME"),
        "USER": os.getenv("DB_USER"),
        "PASSWORD": os.getenv("DB_PASSWORD"),
        "HOST": os.getenv("DB_HOST"),
        "PORT": os.getenv("DB_PORT"),
    }
}

CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
] + [origin for origin in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",") if origin]
```

### React (`react/src/utils/api.ts`)

```typescript
// Vite exposes env vars prefixed with VITE_ via import.meta.env
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
```

## Connection Details

### Frontend → Backend

| Environment | Frontend URL                          | Backend URL                                        | Protocol |
| ----------- | ------------------------------------- | -------------------------------------------------- | -------- |
| Local       | `http://localhost:5173`               | `http://localhost:8000`                            | HTTP     |
| Production  | `https://kick-with-reverb.vercel.app` | `https://kickwithreverb-production.up.railway.app` | HTTPS    |

The frontend makes API calls to:

- `POST /api/token/` - Login (get JWT tokens)
- `POST /api/token/refresh/` - Refresh access token
- `POST /api/register/` - Create new user

### Backend → Database

| Environment | Django Host       | Supabase Host                         | Port | Connection Type           |
| ----------- | ----------------- | ------------------------------------- | ---- | ------------------------- |
| Local       | localhost:8000    | `aws-1-us-east-1.pooler.supabase.com` | 6543 | Pooler (Transaction mode) |
| Production  | Railway container | `aws-1-us-east-1.pooler.supabase.com` | 6543 | Pooler (Transaction mode) |

**Why Pooler?**

- Direct connection (`db.{ref}.supabase.co:5432`) has IPv6/network issues from some hosts
- Pooler (`aws-1-us-east-1.pooler.supabase.com:6543`) handles connection pooling and works reliably from external services
- Pooler requires username format: `postgres.{project_ref}` (not just `postgres`)

## Platform Dashboards

| Platform | URL                                                                           | What to Configure          |
| -------- | ----------------------------------------------------------------------------- | -------------------------- |
| Railway  | [railway.app](https://railway.app) → Project → Service → Variables            | Django env vars            |
| Vercel   | [vercel.com](https://vercel.com) → Project → Settings → Environment Variables | `VITE_API_URL`             |
| Supabase | [supabase.com](https://supabase.com) → Project → Settings → Database          | Get connection credentials |

## Supabase Connection Info

Found in Supabase Dashboard → Project Settings → Database → Connection string

**Pooler Connection (use this):**

- Host: `aws-1-us-east-1.pooler.supabase.com`
- Port: `6543`
- User: `postgres.{project_ref}`
- Password: (from dashboard)
- Database: `postgres`

**Direct Connection (not recommended for external services):**

- Host: `db.{project_ref}.supabase.co`
- Port: `5432`
- User: `postgres`

## Updating Environment Variables

### Local Development

1. Edit `django/.env`
2. Restart Django dev server

### Railway (Backend)

1. Go to Railway Dashboard → Service → Variables
2. Add/edit variable
3. Railway auto-redeploys

### Vercel (Frontend)

1. Go to Vercel Dashboard → Project → Settings → Environment Variables
2. Add/edit variable
3. **Must manually redeploy** (Deployments → Latest → Redeploy)

## Troubleshooting Connections

| Symptom                       | Likely Cause                                | Solution                                                  |
| ----------------------------- | ------------------------------------------- | --------------------------------------------------------- |
| CORS error in browser         | `CORS_ALLOWED_ORIGINS` missing frontend URL | Add frontend URL to Railway's `CORS_ALLOWED_ORIGINS`      |
| 500 error on API calls        | Database connection failed                  | Check `DB_HOST`, `DB_PORT`, `DB_USER` include project ref |
| Frontend not reaching backend | Wrong `VITE_API_URL`                        | Check Vercel env var, redeploy after changing             |
| "Network unreachable" in logs | Using direct Supabase connection            | Switch to pooler connection (host + port 6543)            |
