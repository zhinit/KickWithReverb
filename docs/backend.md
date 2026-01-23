# Backend Structure

## Overview

The backend is a Django REST API that handles user authentication. It uses Django REST Framework with JWT authentication.

## Technology Stack

- **Django 5.2** - Web framework
- **Django REST Framework** - API toolkit
- **Simple JWT** - JWT authentication
- **PostgreSQL** - Database
- **python-dotenv** - Environment variable management

## Project Structure

```
django/
├── manage.py                 # Django CLI entry point
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

The app loads environment variables from a `.env` file:

- `SECRET_KEY` - Django secret key
- `DEBUG` - Debug mode ("True" or "False")
- `DB_NAME` - PostgreSQL database name
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password
- `DB_HOST` - Database host
- `DB_PORT` - Database port

### CORS

CORS is enabled for the frontend dev server:
- `http://localhost:5173`
- `http://127.0.0.1:5173`

### Authentication

Uses JWT via `rest_framework_simplejwt`:
- Default authentication class is `JWTAuthentication`
- Tokens issued via `/api/token/`
- Token refresh via `/api/token/refresh/`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/token/` | Obtain JWT access and refresh tokens |
| POST | `/api/token/refresh/` | Refresh access token |
| POST | `/api/register/` | Create new user account |
| GET | `/admin/` | Django admin interface |

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
