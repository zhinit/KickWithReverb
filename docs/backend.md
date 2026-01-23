# Backend Structure

## Overview

The backend is a Django REST API that handles user authentication. It uses Django REST Framework with JWT authentication.

## Technology Stack

- **Django 5.2** - Web framework
- **Django REST Framework** - API toolkit
- **Simple JWT** - JWT authentication
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
└── users/                    # Users app
    ├── __init__.py
    ├── admin.py             # Admin site config
    ├── apps.py              # App config
    ├── models.py            # Database models
    ├── serializers.py       # DRF serializers
    ├── views.py             # API views
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

| Method | Endpoint              | Description                          |
| ------ | --------------------- | ------------------------------------ |
| POST   | `/api/token/`         | Obtain JWT access and refresh tokens |
| POST   | `/api/token/refresh/` | Refresh access token                 |
| POST   | `/api/register/`      | Create new user account              |
| GET    | `/admin/`             | Django admin interface               |

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
