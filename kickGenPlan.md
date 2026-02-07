# Kick Generation Plan

## Overview

Add AI kick drum generation to the app. Members can generate up to 10 kicks using a latent diffusion model, stored in Supabase Storage, and available in the kick selector alongside stock kicks.

## Architecture

```
React (Vercel)                Django (Railway)               Supabase
─────────────                 ────────────────               ────────
                                                             Storage:
📀 click  ──► POST /api/kicks/generate/ ──► PyTorch inference ──► upload WAV to generated-kicks bucket
              GET  /api/kicks/          ──► list user kicks   ──► return signed/public URLs
              DEL  /api/kicks/<id>/     ──► delete kick       ──► remove from bucket + DB

On login ──► GET /api/kicks/ ──► fetch audio from Supabase URLs ──► load into WASM engine
```

Model weights (~315MB) stored in a `model-weights` Supabase Storage bucket. Lazy-downloaded to Railway filesystem on first generation request per deploy, then kept in memory.

---

## Backend

### New Django App: `kickgen`

#### Model — `GeneratedKick`

| Field          | Type                    | Description                                      |
| -------------- | ----------------------- | ------------------------------------------------ |
| `user`         | FK → User (CASCADE)     | Owner                                            |
| `name`         | CharField(max_length=32)| German name (e.g. "Donnerschlag")                |
| `storage_path` | CharField               | Supabase Storage path: `{user_id}/{name}.wav`    |
| `created_at`   | DateTimeField(auto_now) | Timestamp                                        |

#### Endpoints

| Method | Endpoint                 | Description                                            | Auth |
| ------ | ------------------------ | ------------------------------------------------------ | ---- |
| POST   | `/api/kicks/generate/`   | Generate a kick. 10-kick limit enforced. Returns metadata + audio URL. | Yes  |
| GET    | `/api/kicks/`            | List user's generated kicks (name, id, audio URL)      | Yes  |
| DELETE | `/api/kicks/<id>/`       | Delete a kick (ownership check). Removes Supabase file + DB row. | Yes  |

#### Generation Flow (POST `/api/kicks/generate/`)

1. Check `GeneratedKick.objects.filter(user=request.user).count() < 10`
   - If at limit → 400 response with message
2. Pick a random German name not already used by this user
3. Run `generate()` from `pytorch.inference.generate`:
   - Prompt: `"hit house"` (hardcoded)
   - `cfg_scale=3.0`, `ddim_steps=50`
   - Output to temp file
4. Upload WAV to Supabase Storage: `generated-kicks/{user_id}/{name}.wav`
5. Create `GeneratedKick` DB row
6. Return kick metadata (id, name) + audio URL

#### Model Loading (Lazy Singleton)

- On first generation request, download weights from `model-weights` Supabase bucket to local filesystem
- Load PyTorch models into memory (VAE, diffusion U-Net, text encoder, vocoder)
- Keep loaded for all subsequent requests (any user)
- Re-downloads only after Railway redeploy

#### German Name Pool (~30 names)

Donnerschlag, Stahlhammer, Erdstoss, Blitzknall, Druckwelle, Klangwucht, Eisenfaust, Hammerschlag, Sturmkraft, Wellenbrecher, Grundstein, Tiefschlag, Donnergrollen, Klangmeister, Kernschlag, Schallmauer, Kraftwerk, Stampfer, Paukenschlag, Urgewalt, Dröhnung, Erschütterung, Schwerkraft, Nachhall, Schlagwerk, Taktgeber, Herzschlag, Impulsgeber, Widerhall, Resonanz

Backend picks randomly from names not already used by the requesting user.

#### New Dependencies (add to `requirements.txt`)

- `torch>=2.10.0`
- `torchaudio>=2.10.0`
- `numpy>=2.4.2`
- `scipy>=1.14.0`
- `supabase` (Python client for Storage uploads/deletes)

---

## Frontend

### Main DAW Screen Changes

#### Kick Selector Dropdown

Stock kicks listed first (unchanged), then AI kicks appended after:

```
Kick 1
Kick 2
Kick 3
...
AI: Donnerschlag
AI: Stahlhammer
```

AI kicks only appear for logged-in members who have generated kicks.

#### "Generate Kick From The Ether" Button

- Position: below mastering strip, above logout button
- Only visible to members
- Clicking it transitions to the generation screen

#### Login Prompt Update

Change "log in to use presets" → "log in to use presets and kick gen AI"

#### On Login

1. `GET /api/kicks/` → fetch list of user's generated kicks
2. Download audio from Supabase URLs
3. Decode and load into WASM engine as additional kick samples (indices after stock kicks)
4. Populate the "AI: {name}" entries in the kick selector dropdown

### Generation Screen

Same DAW layout with these control modifications:

#### Kick Selectah → Red "Back" Button

- Bright red button that says "back"
- Returns to main DAW screen
- Currently loaded kick (stock or AI) stays loaded

#### Presets Bar → Generated Kicks Dropdown

- Shows user's generated kicks by name
- If empty: shows "click the 📀 to generate a kick"
- Selecting a kick loads its audio into the engine

#### Save Button (💾) → Generate Button (📀)

- Click triggers generation flow
- If at 10 kicks: show message "Only 10 kicks allowed. Please delete some of your kicks to generate more."
- If under limit: show loading spinner (~15-30 seconds)
- On success: new kick loads immediately, gets selected in dropdown

#### Delete Button → Delete Current AI Kick

- Shows "Are you sure?" confirmation dialog
- On confirm: `DELETE /api/kicks/<id>/`
- Removes from dropdown, loads next available kick (or shows empty state)

#### Everything Else Unchanged

Transport, noise layer, reverb layer, mastering chain all work normally. User can audition AI kicks through the full signal chain.

---

## Supabase Storage Setup

### Buckets

| Bucket             | Purpose                          | Access |
| ------------------ | -------------------------------- | ------ |
| `model-weights`    | PyTorch model checkpoints (~315MB) | Private (only Django server accesses) |
| `generated-kicks`  | User-generated kick WAVs         | Public (frontend fetches audio directly) |

### Paths

- Model weights: `model-weights/vae_epoch_100.pt`, `model-weights/diffusion_step_100000.pt`, `model-weights/vocoder_epoch_50.pt`
- Generated kicks: `generated-kicks/{user_id}/{name}.wav`

---

## Implementation Steps

### Phase 1: Backend

1. Upload model weights to Supabase Storage `model-weights` bucket
2. Create `generated-kicks` Supabase Storage bucket (public)
3. Create `kickgen` Django app with `GeneratedKick` model
4. Add Supabase Python client + PyTorch dependencies to `requirements.txt`
5. Implement lazy model loader (download weights from Supabase → load PyTorch models → keep in memory)
6. Implement `POST /api/kicks/generate/` endpoint (limit check → generate → upload → save)
7. Implement `GET /api/kicks/` endpoint (list kicks with audio URLs)
8. Implement `DELETE /api/kicks/<id>/` endpoint (ownership check → delete from Supabase + DB)
9. Add URL routing in `config/urls.py`
10. Test endpoints locally

### Phase 2: Frontend — Main DAW Changes

11. Add API functions: `generateKick()`, `getUserKicks()`, `deleteKick()`
12. Create hook `useKickGen` — manages generated kicks state, fetches on login, loads audio into engine
13. Update kick selector dropdown to include AI kicks after stock kicks
14. Add "Generate Kick From The Ether" button (members only)
15. Update login prompt message

### Phase 3: Frontend — Generation Screen

16. Create generation screen component (modified DAW layout)
17. Implement red "back" button (replaces kick selectah)
18. Implement generated kicks dropdown (replaces presets bar)
19. Implement 📀 generate button (replaces 💾 save button) with loading state and 10-kick limit message
20. Implement delete button with confirmation dialog
21. Wire up screen transitions (main DAW ↔ generation screen)

### Phase 4: Deploy

22. Deploy Django to Railway (with PyTorch dependencies)
23. Verify model weight download + generation works on Railway
24. Deploy frontend to Vercel
25. End-to-end test: generate, audition, delete, login persistence
