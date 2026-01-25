# Backend Structure

## Overview

The backend is a Django REST API that handles user authentication. It uses Django REST Framework with JWT authentication.

## Technology Stack

- **Django 5.2** - Web framework
- **Django REST Framework** - API toolkit
- **Simple JWT** - JWT authentication
- **djangorestframework-camel-case** - Automatic snake_case to camelCase conversion for API responses/requests
- **PostgreSQL** - Database (Supabase in production)
- **python-dotenv** - Environment variable management
- **Gunicorn** - Production WSGI server
- **Whitenoise** - Static file serving

## Project Structure

```
django/
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
└── presets/                  # Presets app
    ├── __init__.py
    ├── admin.py             # Admin site config for presets
    ├── apps.py              # App config
    ├── models.py            # Preset and SharedPreset models
    ├── serializers.py       # DRF serializers for presets
    ├── views.py             # API views for preset CRUD
    ├── tests.py             # Tests
    └── migrations/          # Database migrations
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
| GET    | `/api/presets/`        | List user's presets                  | Yes           |
| POST   | `/api/presets/`        | Create a new preset                  | Yes           |
| PUT    | `/api/presets/<id>/`   | Update an existing preset            | Yes           |
| DELETE | `/api/presets/<id>/`   | Delete a preset                      | Yes           |
| GET    | `/api/presets/shared/` | List shared (global) presets         | Yes           |
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

**Preset** - User-owned presets

- `user` - Foreign key to User (CASCADE delete)
- `preset_name` - Name of the preset (max 32 chars)
- `bpm` - Beats per minute
- Kick layer: `kick_sample`, `kick_len`, `kick_dist_amt`, `kick_ott_amt`
- Noise layer: `noise_sample`, `noise_low_pass_freq`, `noise_high_pass_freq`, `noise_dist_amt`
- Reverb layer: `reverb_sample`, `reverb_low_pass_freq`, `reverb_high_pass_freq`, `reverb_phaser_amt`
- Master chain: `master_ott_amt`, `master_dist_amt`, `master_limiter_amt`
- Timestamps: `created_at`, `updated_at`
- Unique constraint on `(user, preset_name)`

**SharedPreset** - Global presets available to all users (admin-managed)

- Same fields as Preset but without `user` foreign key
- `preset_name` is unique globally
- Read-only via API (only admins can create/modify via Django admin)

### Serializers (`presets/serializers.py`)

**PresetSerializer**

- Serializes all preset fields
- Read-only: `id`, `created_at`, `updated_at`
- Validates `preset_name` is alphanumeric (spaces allowed)

**SharedPresetSerializer**

- Read-only serializer for shared presets
- All fields are read-only

### Views (`presets/views.py`)

**PresetListCreateView** (`/api/presets/`)

- `GET` - List all presets owned by the authenticated user
- `POST` - Create a new preset for the authenticated user

**PresetDetailView** (`/api/presets/<id>/`)

- `PUT` - Update a preset (only if owned by the user)
- `DELETE` - Delete a preset (only if owned by the user)

**SharedPresetView** (`/api/presets/shared/`)

- `GET` - List all shared presets

### API Response Format

The backend uses `djangorestframework-camel-case` to automatically convert:
- Request bodies: `camelCase` (frontend) → `snake_case` (Django)
- Response bodies: `snake_case` (Django) → `camelCase` (frontend)

This allows the frontend to use JavaScript conventions while Django uses Python conventions.

## Running the Server

```bash
cd django
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
- **Root directory**: `django`
- **Port**: `8080`

The `Procfile` tells Railway to start Gunicorn:

```
web: gunicorn config.wsgi
```

See `notes/railwayExecution.md` for full deployment details.
