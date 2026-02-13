# Backend Structure

## Overview

The backend is a Django REST API that handles user authentication, presets, and AI kick generation. It uses Django REST Framework with JWT authentication. AI kick generation is powered by a Modal serverless GPU worker that runs a PyTorch model, with generated audio stored in Supabase Storage.

## Technology Stack

- **Django 5.2** - Web framework
- **Django REST Framework** - API toolkit
- **Simple JWT** - JWT authentication
- **djangorestframework-camel-case** - Automatic snake_case to camelCase conversion for API responses/requests
- **PostgreSQL** - Database (Supabase in production)
- **Modal** - Serverless GPU compute for AI kick generation
- **Supabase Storage** - Stores generated WAV files in a public bucket
- **python-dotenv** - Environment variable management
- **Gunicorn** - Production WSGI server
- **Whitenoise** - Static file serving

## Project Structure

```
backend/
├── manage.py                 # Django CLI entry point
├── Procfile                  # Railway/Heroku process definition
├── requirements.txt          # Python dependencies
├── config/                   # Project configuration
│   ├── __init__.py
│   ├── settings.py          # Django settings
│   ├── urls.py              # Root URL configuration
│   ├── asgi.py              # ASGI config
│   └── wsgi.py              # WSGI config
├── users/                    # Users app
│   ├── __init__.py
│   ├── admin.py             # Admin site config
│   ├── apps.py              # App config
│   ├── models.py            # Database models
│   ├── serializers.py       # DRF serializers
│   ├── views.py             # API views
│   ├── tests.py             # Tests
│   └── migrations/          # Database migrations
├── presets/                  # Presets app
│   ├── __init__.py
│   ├── admin.py             # Admin site config for presets
│   ├── apps.py              # App config
│   ├── models.py            # Preset model
│   ├── serializers.py       # DRF serializers for presets
│   ├── views.py             # API views for preset CRUD
│   ├── tests.py             # Tests
│   └── migrations/          # Database migrations
└── kickgen/                  # AI kick generation app
    ├── __init__.py
    ├── admin.py             # Admin site config
    ├── apps.py              # App config
    ├── models.py            # GeneratedKick model
    ├── views.py             # Generate, list, delete views + rate limiting
    ├── german_names.py      # Random German name generator for kicks
    ├── tests.py             # Tests
    └── migrations/          # Database migrations
```

### Modal Worker

```
kick_gen_worker/
└── kick_worker.py            # Serverless GPU worker for AI kick generation
```

## Configuration

### Environment Variables

The app loads environment variables from a `.env` file (local) or platform config (production):

- `SECRET_KEY` - Django secret key
- `DEBUG` - Debug mode
- `ALLOWED_HOSTS` - Comma-separated list of allowed hosts (defaults to "localhost,127.0.0.1")
- `DB_NAME` - PostgreSQL database name
- `DB_USER` - Database user (for Supabase pooler, include project ref: `postgres.{project_ref}`)
- `DB_PASSWORD` - Database password
- `DB_HOST` - Database host (for Supabase pooler: `aws-1-us-east-1.pooler.supabase.com`)
- `DB_PORT` - Database port (for Supabase pooler: `6543`)
- `CORS_ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins (for production frontend)
- `MODAL_TOKEN_ID` - Modal authentication token ID (from `~/.modal.toml`)
- `MODAL_TOKEN_SECRET` - Modal authentication token secret (from `~/.modal.toml`)
- `SUPABASE_URL` - Supabase project URL (for Storage API)
- `SUPABASE_SERVICE_KEY` - Supabase secret key (for Storage admin access)

### CORS

CORS is enabled for:

- `http://localhost:5173` (local dev)
- `http://127.0.0.1:5173` (local dev)
- Additional origins via `CORS_ALLOWED_ORIGINS` env var (production)

### Authentication

Uses JWT via `rest_framework_simplejwt`:

- Default authentication class is `JWTAuthentication`
- Tokens issued via `/api/token/`
- Token refresh via `/api/token/refresh/`

## API Endpoints

| Method | Endpoint               | Description                          | Auth Required |
| ------ | ---------------------- | ------------------------------------ | ------------- |
| POST   | `/api/token/`          | Obtain JWT access and refresh tokens | No            |
| POST   | `/api/token/refresh/`  | Refresh access token                 | No            |
| POST   | `/api/register/`       | Create new user account              | No            |
| GET    | `/api/presets/`        | List user's and shared presets       | Yes           |
| POST   | `/api/presets/`        | Create a new preset                  | Yes           |
| PUT    | `/api/presets/<id>/`   | Update an existing preset            | Yes           |
| DELETE | `/api/presets/<id>/`   | Delete a preset                      | Yes           |
| POST   | `/api/kicks/generate/` | Generate an AI kick                  | Yes           |
| GET    | `/api/kicks/`          | List user's AI kicks + counts        | Yes           |
| DELETE | `/api/kicks/<id>/`     | Delete an AI kick                    | Yes           |
| GET    | `/admin/`              | Django admin interface               | Admin         |

## Users App

### Models

Uses Django's built-in `User` model from `django.contrib.auth.models`.

### Serializers (`serializers.py`)

**RegisterSerializer**

- Fields: `username`, `email`, `password`
- Password is write-only with 8 character minimum
- Creates user via `User.objects.create_user()`

### Views (`views.py`)

**RegisterView**

- `POST` - Creates new user
- Permission: `AllowAny`
- Returns 201 on success, 400 on validation error

## Presets App

### Models (`presets/models.py`)

**Preset** - User-owned and shared presets

- `user` - Foreign key to User (CASCADE delete)
- `preset_name` - Name of the preset (max 32 chars)
- `is_shared` - Boolean flag; shared presets are visible to all users (default: False)
- `bpm` - Beats per minute
- Kick layer: `kick_sample`, `kick_len`, `kick_dist_amt`, `kick_ott_amt`
- Noise layer: `noise_sample`, `noise_low_pass_freq`, `noise_high_pass_freq`, `noise_volume`
- Reverb layer: `reverb_sample`, `reverb_low_pass_freq`, `reverb_high_pass_freq`, `reverb_volume`
- Master chain: `master_ott_amt`, `master_dist_amt`, `master_limiter_amt`
- Timestamps: `created_at`, `updated_at`
- Unique constraint on `(user, preset_name)`

### Serializers (`presets/serializers.py`)

**PresetSerializer**

- Serializes all preset fields including `is_shared`
- Read-only: `id`, `created_at`, `updated_at`
- Validates `preset_name` is alphanumeric (spaces allowed)

### Views (`presets/views.py`)

**PresetListCreateView** (`/api/presets/`)

- `GET` - List all presets owned by the authenticated user plus all shared presets
- `POST` - Create a new preset for the authenticated user

**PresetDetailView** (`/api/presets/<id>/`)

- `PUT` - Update a preset (only if owned by the user)
- `DELETE` - Delete a preset (only if owned by the user)

## Kickgen App

### Models (`kickgen/models.py`)

**GeneratedKick** - AI-generated kick drum samples

- `user` - Foreign key to User (CASCADE delete)
- `name` - CharField(max_length=64), random German name prefixed with "AI: " (e.g., "AI: Burkhard")
- `audio_url` - URLField, public URL pointing to the WAV in Supabase Storage
- `storage_path` - CharField(max_length=256), path within the `generated-kicks` bucket (for deletion)
- `created_at` - DateField (auto_now_add, used for daily limit counting)
- `Meta: ordering = ["name"]` (alphabetical)

### Views (`kickgen/views.py`)

**Rate Limiting Constants:**

- `DAILY_GEN_LIMIT = 10` (resets at midnight EST)
- `TOTAL_GEN_CAP = 30` (must delete kicks to generate more)

**GenerateKickView** (`POST /api/kicks/generate/`)

- Checks total cap (returns 400 if at 30) and daily limit (returns 429 if at 10)
- Calls Modal worker: `modal.Cls.from_name("kick-generator-app", "KickGenerator")().generate_kick.remote("hit house")`
- Uploads returned WAV bytes to Supabase Storage at `{user_id}/{uuid}.wav`
- Picks a random German name (avoiding duplicates), saves `GeneratedKick` record
- Returns: `id`, `name`, `audioUrl`, `remainingGensToday`, `totalGensCount`

**KickListView** (`GET /api/kicks/`)

- Returns all user's kicks (`id`, `name`, `audioUrl`) plus `remainingGensToday` and `totalGensCount`

**KickDeleteView** (`DELETE /api/kicks/<id>/`)

- Without `?confirm=true`: checks for presets using this kick, returns 409 with preset names if found
- With `?confirm=true` (or no presets affected): deletes from Supabase Storage, deletes affected presets, deletes DB record
- Returns updated `totalGensCount`

### German Name Generation (`kickgen/german_names.py`)

~53 German names. `generate_kick_name(existing_names)` picks a random name prefixed with "AI: ", filtering out names already in use by the user.

### URL Registration

Kickgen URLs are registered directly in `config/urls.py` (no app-level `urls.py`), matching the pattern used by presets.

## Modal Worker (`kick_gen_worker/kick_worker.py`)

Serverless GPU worker that runs the AI kick generation model. Deployed separately from Django.

### Architecture

- Class-based Modal app using `@app.cls` with `@modal.enter()` for one-time model loading
- App name: `"kick-generator-app"`, class name: `"KickGenerator"`
- GPU: T4, `container_idle_timeout=300` (5 min warm), 10 min execution timeout
- Volume: `"kick-gen-model-cache"` mounted at `/cache` for model weight caching

### Model Loading (`setup()`)

Downloads from HuggingFace (`zhinit/kick-gen-v1`) on first boot, then loads 3 models into GPU memory:

1. **Diffusion model** (`weights/diffusion_step_100000.pt`) - LatentUNet + KeywordEncoder + NoiseScheduler
2. **VAE** (`weights/vae_epoch_100.pt`) - KickVAE decoder
3. **Vocoder** (`weights/vocoder_epoch_50.pt`) - HiFiGANGenerator

All use `torch.load(weights_only=False)` because checkpoints contain pickled Python objects (config dataclass, vocab).

### Generation (`generate_kick()`)

- Signature: `generate_kick(prompt: str = "hit house", cfg_scale: float = 3.0, steps: int = 50) -> bytes`
- Takes a string prompt (not a list — `parse_prompt` expects a string)
- Returns raw WAV bytes (~354KB, 2-second 44.1kHz kick drum)

### Deployment

```bash
cd kick_gen_worker && uv run modal deploy kick_worker.py
```

Django connects via: `modal.Cls.from_name("kick-generator-app", "KickGenerator")`

### API Response Format

The backend uses `djangorestframework-camel-case` to automatically convert:

- Request bodies: `camelCase` (frontend) → `snake_case` (Django)
- Response bodies: `snake_case` (Django) → `camelCase` (frontend)

This allows the frontend to use JavaScript conventions while Django uses Python conventions.

## Running the Server

```bash
cd backend
python manage.py runserver
```

Server runs on `http://localhost:8000` by default.

## Database Commands

```bash
# Create migrations
python manage.py makemigrations

# Apply migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser
```

## Production Deployment

Deployed on **Railway** with **Supabase** PostgreSQL.

- **URL**: `https://kickwithreverb-production.up.railway.app`
- **Root directory**: `backend`
- **Port**: `8080`

The `Procfile` tells Railway to start Gunicorn:

```
web: gunicorn config.wsgi
```

See `notes/railwayExecution.md` for full deployment details.
