# Presets System Implementation Plan

## Overview

Add a presets system that saves/loads all DAW parameters per user, with admin-managed shared presets displayed first.

---

## Design Decisions

| Decision         | Choice                                                                  |
| ---------------- | ----------------------------------------------------------------------- |
| Data storage     | Individual fields (more explicit and queryable than JSONField)          |
| Django structure | New `presets` app (separation from auth-focused users app)              |
| Shared presets   | Separate `SharedPreset` model, admin-only via Django admin              |
| State management | Hooks expose `setters` + `getState()`, centralized in `usePresets` hook |
| Load strategy    | Fetch ALL presets on login, switch locally (instant, no API per switch) |

---

## Preset Fields

- `preset_name` (string, max 32 chars)
- `bpm` (positive integer)
- `kick_sample`, `kick_len`, `kick_dist_amt`, `kick_ott_amt`
- `noise_sample`, `noise_low_pass_freq`, `noise_high_pass_freq`, `noise_dist_amt`
- `reverb_sample`, `reverb_low_pass_freq`, `reverb_high_pass_freq`, `reverb_phaser_amt`
- `master_ott_amt`, `master_dist_amt`, `master_limiter_amt`
- `created_at`, `updated_at` (auto-managed timestamps)

---

## UI Behavior

### PresetsBar Layout

```
[⇇] [⇉] [____dropdown____] [🗑️] [💾]
```

- Prev/Next buttons on left
- Dropdown in center
- Delete button (left of save)
- Save button on right

### Dropdown Order

1. Shared presets (alphabetical) - no prefix
2. User presets (alphabetical)
3. If no presets exist: show "No presets yet" placeholder

### Next/Prev Navigation

Cycles through dropdown order (shared then user, alphabetical). Wraps around using modulo.

### Save Flow

1. User clicks 💾 → Modal appears with name input
2. If name exists: prompt "Update existing or save as new?"
3. Validation: alphanumeric only, max 32 characters
4. On success: close modal, select the saved preset

### Delete Flow

1. User clicks 🗑️ → Confirmation prompt
2. On confirm: delete preset, show "Unsaved" state (keep current audio settings)
3. Cannot delete shared presets (button disabled when shared preset selected)

### States

- **Unauthenticated**: PresetsBar visible but disabled, shows "Log in to use presets"
- **Initial**: Use current hook defaults, display shows "Unsaved"
- **After Delete**: Reset to "Unsaved", keep current audio settings
- **Modified** (nice to have): Show asterisk when preset modified (e.g., "My Kick *")

---

## API Endpoints

| Endpoint               | Method | Description                        |
| ---------------------- | ------ | ---------------------------------- |
| `/api/presets/`        | GET    | List user's presets                |
| `/api/presets/`        | POST   | Create new preset                  |
| `/api/presets/<id>/`   | PUT    | Update preset (name and/or config) |
| `/api/presets/<id>/`   | DELETE | Delete preset                      |
| `/api/presets/shared/` | GET    | List shared presets (read-only)    |

All endpoints require authentication.

---

## Files to Create

**Backend**: `django/presets/` - `__init__.py`, `apps.py`, `models.py`, `serializers.py`, `views.py`, `admin.py`

**Frontend**: `react/src/types/preset.ts`, `react/src/hooks/usePresets.ts`

## Files to Modify

**Backend**: `config/settings.py` (INSTALLED_APPS), `config/urls.py` (routes)

**Frontend**:
- `utils/api.ts` - Add `authenticatedFetch` + preset API functions
- `useKickLayer.ts`, `useNoiseLayer.ts`, `useReverbLayer.ts`, `useMasterChain.ts`, `useTransport.ts` - Export `setters` + `getState()`
- `PresetsBar.tsx` - Full rewrite with dropdown, nav, delete, save modal
- `Daw.tsx` - Wire up `usePresets` hook
- `App.css` - Modal/dialog styles

---

## Implementation Order

### Phase 1: Backend

1. [x] Create `django/presets/` directory with `apps.py`, `__init__.py`
2. [x] Create `models.py` with Preset and SharedPreset
3. [x] Create `serializers.py` with validation
4. [x] Create `views.py` with all endpoints
5. [x] Create `admin.py` for shared preset management
6. [x] Update `config/settings.py` and `config/urls.py`
7. [x] Run migrations
8. [x] Test with curl or Postman

### Phase 2: Frontend Types & API

9. [ ] Create `types/preset.ts`
10. [ ] Update `utils/api.ts` with authenticatedFetch and preset functions

### Phase 3: Hook Updates

11. [ ] Modify `useKickLayer.ts` - add setters + getState
12. [ ] Modify `useNoiseLayer.ts` - add setters + getState
13. [ ] Modify `useReverbLayer.ts` - add setters + getState
14. [ ] Modify `useMasterChain.ts` - add setters + getState
15. [ ] Modify `useTransport.ts` - add setters + getState

### Phase 4: Presets Hook & UI

16. [ ] Create `hooks/usePresets.ts`
17. [ ] Rewrite `components/PresetsBar.tsx`
18. [ ] Update `components/Daw.tsx`
19. [ ] Add modal/dialog CSS to `App.css`

---

## Validation Rules

- **Preset Name**: Alphanumeric + spaces only, max 32 chars, unique per user, required

---

## Verification Checklist

### Backend
- [ ] Create preset returns 201
- [ ] List presets returns only current user's presets
- [ ] Duplicate name for same user returns 400
- [ ] Delete returns 204
- [ ] Cannot delete another user's preset (404)
- [ ] Shared presets endpoint returns all shared presets
- [ ] Invalid name returns validation error

### Frontend
- [ ] Unauthenticated: shows "Log in to use presets"
- [ ] On login: all presets fetched automatically
- [ ] Dropdown shows shared (alpha) then user (alpha)
- [ ] Selecting preset loads all settings instantly
- [ ] Next/prev buttons cycle with wrap-around
- [ ] Save with new name creates preset
- [ ] Save with existing name prompts update/new choice
- [ ] Delete shows confirmation, then removes preset
- [ ] After delete: shows "Unsaved", keeps current settings
- [ ] Cannot delete shared presets

---

## Out of Scope

- Preset versioning/migration (just use defaults for new params)
- Export/import presets as files
- Preset categories, tags, or sharing between users
