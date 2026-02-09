# AI Kick Generation - Implementation Plan

## Architecture Overview

The existing app gains a new "AI Kick Gen Mode" that lets logged-in users generate kick drum samples using an AI model. The architecture extends the current stack with two new services:

- **Frontend:** React (Vercel) - New UI mode for generating and browsing AI kicks
- **Backend:** Django (Railway) - New `kicks` app handling generation requests, storage, and rate limiting
- **AI Compute:** Modal (Serverless GPU) - Runs the PyTorch model on demand
- **Model Storage:** Hugging Face Hub - Hosts the ~350MB model weights
- **Audio Storage:** Supabase Storage - Stores generated WAV files in a public bucket
- **Database:** Supabase PostgreSQL - Stores kick metadata (name, URL, user, timestamps)

### Request Flow

1. User clicks generate in the frontend
2. Frontend calls `POST /api/kicks/generate/` on Django
3. Django checks daily limit (10/day) and total cap (30 kicks)
4. Django calls the Modal worker synchronously via `modal.Function.lookup()`
5. Modal loads model from Hugging Face (cached on a Volume), runs inference, returns raw WAV bytes
6. Django uploads WAV bytes to Supabase Storage (`generated-kicks/{user_id}/{uuid}.wav`)
7. Django saves a `GeneratedKick` record in the DB with the storage URL and a random German name
8. Django returns the kick data + remaining daily count + total count to the frontend
9. Frontend decodes the audio, sends it to the WASM engine, updates the dropdown

---

## Phase 1: Infrastructure -- COMPLETED

### 1.1 Supabase Storage Bucket -- COMPLETED

Public bucket `generated-kicks` created in Supabase Storage. File path convention: `generated-kicks/{user_id}/{uuid}.wav`.

### 1.2 Modal Worker -- COMPLETED

Lives at `modal/kick_worker.py`. Uses a class-based approach (`@app.cls`) with `@modal.enter()` for one-time model loading:

- **`KickGenerator.setup()`** runs once on container boot: downloads HuggingFace repo via `snapshot_download`, loads all 3 models (diffusion, VAE, vocoder) into GPU memory
- **`KickGenerator.generate_kick()`** runs per-request: parses prompt, runs DDIM sampling, decodes, returns WAV bytes
- `container_idle_timeout=300` keeps GPU warm for 5 minutes between calls
- T4 GPU, 10 min timeout, Debian slim + torch/torchaudio/huggingface_hub/scipy/numpy

**HuggingFace repo:** `zhinit/kick-gen-v1` — contains full directory structure matching local `pytorch/` folder (models/, inference/, training/, weights/)

**Deployment:** `cd modal && uv run modal deploy kick_worker.py`

**Django connects via:** `modal.Cls.from_name("kick-generator-app", "KickGenerator")`

**Tested:** Successfully generates valid WAV bytes (~354KB, 2-second 44.1kHz kick drum)

### 1.3 Environment Variables -- NOT STARTED

New env vars needed:

| Variable | Where | Purpose |
|---|---|---|
| `MODAL_TOKEN_ID` | Railway + django/.env | Django authenticates with Modal |
| `MODAL_TOKEN_SECRET` | Railway + django/.env | Django authenticates with Modal |
| `SUPABASE_URL` | Railway + django/.env | Supabase Storage API |
| `SUPABASE_SERVICE_KEY` | Railway + django/.env | Supabase Storage admin access |

New Python dependencies for Django: `modal`, `supabase`

---

## Phase 2: Backend

### 2.1 New Django App: `kicks`

Create a new Django app called `kicks` alongside `users` and `presets`.

**Model: `GeneratedKick`**
- `user` - FK to User (CASCADE delete)
- `name` - CharField, the German name (e.g., "AI: Gutenberg")
- `audio_url` - URLField, points to the file in Supabase Storage
- `storage_path` - CharField, the path within the bucket (for deletion)
- `created_at` - DateTimeField (auto, used for daily limit counting)

### 2.2 API Endpoints

**`POST /api/kicks/generate/`** - Authenticated
- Check total cap: if user has 30 kicks, return 400 with message "Delete kicks to generate more (30/30)"
- Check daily limit: count kicks where `created_at >= today midnight EST`. If >= 10, return 429
- Call Modal worker synchronously with keywords "hit" and "house"
- Upload returned WAV bytes to Supabase Storage at `generated-kicks/{user_id}/{uuid}.wav`
- Pick a random German name (avoid duplicates against user's existing kick names)
- Save `GeneratedKick` record
- Return kick data (id, name, audio_url) + `remaining_today` + `total_count`

**`GET /api/kicks/`** - Authenticated
- Return all of the user's generated kicks (id, name, audio_url), ordered alphabetically
- Also return `remaining_today` and `total_count` for UI limit display

**`DELETE /api/kicks/<id>/`** - Authenticated
- If `?confirm=true` is NOT set: check if any presets reference this kick's sample name. If presets found, return 409 with the list of affected preset names
- If `?confirm=true` IS set (or no presets affected): delete the file from Supabase Storage, delete associated presets, delete the DB record
- Return updated `total_count`

### 2.3 Rate Limiting

Two independent limits, both enforced backend-side:

- **Daily limit:** 10 generations per day. Resets at midnight EST (UTC-5). Counted by querying `GeneratedKick` records where `created_at >= today midnight EST` for the user
- **Total cap:** 30 AI kicks max per user. Counted by total `GeneratedKick` records for the user

The generate endpoint returns `remaining_today` and `total_count` in every response so the frontend can display warnings.

### 2.4 German Name Generation

A hardcoded list of ~50-100 stereotypical German names stored in the `kicks` app (e.g., Gutenberg, Schwarzenegger, Beethoven, Hildegard, Wolfgang, Lieselotte, Dietrich, etc.). On generation, pick a random name, check for duplicates against the user's existing kicks, re-pick if collision. Prefix with "AI: " before saving.

### 2.5 Migrations

Run migrations on Supabase to create the `kicks_generatedkick` table.

---

## Phase 3: Frontend

### 3.1 App-Level Mode State

New state in the main app: `mode: "daw" | "kickGen"`. Controls conditional rendering. No URL routing needed.

### 3.2 Load AI Kicks on Startup

During `useAudioEngine` initialization (alongside stock kicks/noise/IRs), if the user is a member:
- Fetch the user's AI kicks from `GET /api/kicks/`
- Fetch and decode all audio from their Supabase Storage URLs
- Send all decoded AI kick buffers to the WASM engine just like stock samples

With a 30 kick cap at ~200KB each, that's ~6MB max. Verify the Emscripten heap size can handle this and bump if needed.

### 3.3 "Generate an AI Kick" Button

- Positioned below the mastering strip, above the logout button
- Large, obvious button that says "Generate an AI Kick"
- Only visible to logged-in members
- Clicking it switches `mode` to `"kickGen"`
- All current knob/noise/reverb/master settings remain as-is when entering kickGen mode

### 3.4 KickGenBar Component

Replaces the PresetsBar when in kickGen mode. Same visual style/layout.

**Dropdown:**
- Lists all user's AI-generated kicks alphabetically
- If no kicks exist, shows placeholder "Click 🎨 to generate new kick"
- Selecting a kick loads it into the sampler (from the in-memory cache, instant)
- Currently active kick shown as selected

**🎨 Button (Generate):**
- Sends `POST /api/kicks/generate/` with hardcoded keywords "hit" and "house"
- Shows "Generating kick..." loading state
- On success: new kick appears in dropdown, gets selected, loads into sampler
- At total cap (30): shows message "Delete kicks to generate more (30/30)" - does not disable the button, message shows on click
- When `remaining_today` <= 3: displays warning "X kick generations left until 12:00 AM EST"
- At daily limit (0 remaining): shows appropriate error

**Delete Button:**
- Deletes the currently selected kick
- Calls `DELETE /api/kicks/<id>/`
- If backend returns 409 (presets affected): shows confirmation dialog "Deleting this kick will also delete these presets:\n- preset1\n- preset2"
- On confirm: calls `DELETE /api/kicks/<id>/?confirm=true`
- Removes kick from memory and updates dropdown

### 3.5 Header Changes

- In daw mode: "KICK WITH REVERB" (no change)
- In kickGen mode: "AI KICK GEN MODE"

### 3.6 Kick Layer Selectah Changes

**In daw mode:**
- Dropdown shows stock kicks first, then AI kicks alphabetically
- AI kicks are visually distinct via the "AI: " prefix, no separator needed
- Selecting an AI kick loads it from memory just like a stock kick

**In kickGen mode:**
- Selectah is replaced by a "Back To DAW" button
- Clicking it switches mode back to `"daw"`
- The current kick stays in the sampler and becomes the selected item in the Selectah

### 3.7 Mode Transitions

**Entering kickGen mode:**
- All knob/noise/reverb/master settings remain untouched
- If user has AI kicks, first one alphabetically loads into sampler
- If no AI kicks, sampler is empty

**Exiting kickGen mode:**
- All knob/noise/reverb/master settings remain untouched
- The kick that was in the sampler (from kickGen mode) stays in the sampler
- That kick becomes the selected item in the Selectah dropdown

This allows seamless creation - users can be working on a sound, enter kickGen mode to try AI kicks with their current settings, and return to daw mode without losing anything.

### 3.8 Auth Text Update

The text that currently says "Login to use presets" changes to "Login for AI kick generation and presets".

### 3.9 Guest Visibility

The "Generate an AI Kick" button is only visible to logged-in members. Guests do not see it.

---

## Phase 4: Testing & Deployment

### 4.1 Local Testing
- Test Modal worker independently (call from a script, verify it returns valid WAV bytes)
- Test Django endpoints with curl/Postman (generate, list, delete, rate limits, preset cascade)
- Test full frontend flow locally (enter kickGen mode, generate, switch kicks, delete, exit, verify Selectah)

### 4.2 Deployment Order
1. Deploy Modal worker (`modal deploy kick_worker.py`)
2. Add env vars to Railway (`MODAL_TOKEN_ID`, `MODAL_TOKEN_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`)
3. Deploy Django backend to Railway (new `kicks` app, migrations, dependencies)
4. Deploy React frontend to Vercel
5. Verify CORS allows Vercel domain for new endpoints
6. Verify Supabase Storage bucket is accessible from frontend

### 4.3 Production Verification
- Test generation end-to-end in production
- Verify rate limits work correctly
- Verify kick deletion cascades to presets properly
- Verify AI kicks appear in Selectah in daw mode
- Test cold start behavior and loading times
