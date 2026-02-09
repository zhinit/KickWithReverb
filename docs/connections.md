# Connections & Environment Variables

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              LOCAL DEVELOPMENT                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   Browser ──► React Dev Server ──► Django Dev Server ──► Supabase (PostgreSQL)  │
│              (localhost:5173)      (localhost:8000)       Pooler connection      │
│                                        │                                         │
│                                        ├──► Modal (Serverless GPU)              │
│                                        │    kick-generator-app                   │
│                                        │                                         │
│                                        └──► Supabase Storage                    │
│                                             generated-kicks bucket               │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                                PRODUCTION                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   Browser ──► Vercel ──────────► Railway ──────────────► Supabase (PostgreSQL)  │
│              (React)             (Django + Gunicorn)      Pooler, Port 6543     │
│                                      │                                           │
│                                      ├──► Modal (Serverless GPU)                │
│                                      │    kick-generator-app                     │
│                                      │                                           │
│                                      └──► Supabase Storage                      │
│                                           generated-kicks bucket                 │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
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
| `MODAL_TOKEN_ID`       | Modal API authentication ID       | (from `~/.modal.toml`)                      | (from Modal dashboard)                       |
| `MODAL_TOKEN_SECRET`   | Modal API authentication secret   | (from `~/.modal.toml`)                      | (from Modal dashboard)                       |
| `SUPABASE_URL`         | Supabase project URL              | (from Supabase Settings > API)              | (same as local)                              |
| `SUPABASE_SERVICE_KEY` | Supabase secret key               | (from Supabase Settings > API > secret key) | (same as local)                              |

**Note**: Both local and production use the same Supabase database via the pooler connection.

**Note**: `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET` are read directly by the Modal SDK from environment variables (not explicitly loaded in `settings.py`). `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are loaded in `settings.py`.

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
- `GET /api/presets/` - List user's presets
- `POST /api/presets/` - Create a new preset
- `PUT /api/presets/<id>/` - Update an existing preset
- `DELETE /api/presets/<id>/` - Delete a preset
- `GET /api/presets/shared/` - List shared presets
- `POST /api/kicks/generate/` - Generate an AI kick
- `GET /api/kicks/` - List user's AI kicks
- `DELETE /api/kicks/<id>/` - Delete an AI kick

### Backend → Modal (AI Compute)

| Environment | How Django Connects                                               | Modal App                  |
| ----------- | ----------------------------------------------------------------- | -------------------------- |
| Local       | `modal.Cls.from_name("kick-generator-app", "KickGenerator")`     | Shared deployed instance   |
| Production  | `modal.Cls.from_name("kick-generator-app", "KickGenerator")`     | Same shared deployed instance |

Django calls `generate_kick.remote("hit house")` which runs on a T4 GPU in Modal's cloud. The Modal worker:
- Downloads model weights from HuggingFace (`zhinit/kick-gen-v1`) on first boot (cached on a Volume)
- Keeps the GPU container warm for 5 minutes between calls (`container_idle_timeout=300`)
- Returns raw WAV bytes (~354KB, 2-second 44.1kHz kick)

Authentication is handled by `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET` env vars.

### Backend → Supabase Storage

| Environment | Upload Path                              | Public URL Format                                          |
| ----------- | ---------------------------------------- | ---------------------------------------------------------- |
| Local       | `generated-kicks/{user_id}/{uuid}.wav`   | `{SUPABASE_URL}/storage/v1/object/public/generated-kicks/...` |
| Production  | `generated-kicks/{user_id}/{uuid}.wav`   | Same pattern                                               |

Django uploads WAV bytes to the `generated-kicks` bucket using the Supabase secret key. The bucket is public, so the frontend can fetch audio directly via the public URL stored in `GeneratedKick.audio_url`.

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

| Platform | URL                                                                           | What to Configure                        |
| -------- | ----------------------------------------------------------------------------- | ---------------------------------------- |
| Railway  | [railway.app](https://railway.app) → Project → Service → Variables            | Django env vars (incl. Modal + Supabase) |
| Vercel   | [vercel.com](https://vercel.com) → Project → Settings → Environment Variables | `VITE_API_URL`                           |
| Supabase | [supabase.com](https://supabase.com) → Project → Settings → Database          | Get connection credentials               |
| Supabase | [supabase.com](https://supabase.com) → Project → Storage                      | `generated-kicks` bucket                 |
| Modal    | [modal.com](https://modal.com) → Settings → API Tokens                        | Get `MODAL_TOKEN_ID/SECRET`              |
| HuggingFace | [huggingface.co/zhinit/kick-gen-v1](https://huggingface.co/zhinit/kick-gen-v1) | Model weights (~350MB)               |

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

| Symptom                           | Likely Cause                                | Solution                                                  |
| --------------------------------- | ------------------------------------------- | --------------------------------------------------------- |
| CORS error in browser             | `CORS_ALLOWED_ORIGINS` missing frontend URL | Add frontend URL to Railway's `CORS_ALLOWED_ORIGINS`      |
| 500 error on API calls            | Database connection failed                  | Check `DB_HOST`, `DB_PORT`, `DB_USER` include project ref |
| Frontend not reaching backend     | Wrong `VITE_API_URL`                        | Check Vercel env var, redeploy after changing             |
| "Network unreachable" in logs     | Using direct Supabase connection            | Switch to pooler connection (host + port 6543)            |
| Kick generation 500 error         | Modal token missing or expired              | Check `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET` env vars |
| Kick generation timeout           | Modal cold start (first call after idle)    | T4 GPU container takes ~60s to boot and load models       |
| Upload to Storage fails           | Wrong Supabase key                          | Must use secret key (not anon key) for `SUPABASE_SERVICE_KEY` |
| Audio URL returns 404             | Bucket not public or wrong path             | Verify `generated-kicks` bucket is public in Supabase     |
