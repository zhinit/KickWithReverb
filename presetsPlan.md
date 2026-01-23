# Presets System Implementation Plan

## Overview
Add a presets system that saves/loads all DAW parameters per user, with admin-managed shared presets displayed first.

---

## Design Decisions

| Decision | Choice |
|----------|--------|
| Data storage | JSONField for config (flexible, no migrations for new params) |
| Django structure | New `presets` app (separation from auth-focused users app) |
| Shared presets | Separate `SharedPreset` model, admin-only via Django admin |
| State management | Hooks expose `setters` + `getState()`, centralized in `usePresets` hook |
| Load strategy | Fetch ALL presets on login, switch locally (instant, no API per switch) |

---

## Preset Config Schema
```json
{
  "bpm": 140,
  "kick": { "sample": "Kick1", "len": 0.15, "distortionAmt": 0, "ottAmt": 0 },
  "noise": { "sample": "greyNoise", "lowPassFreq": 7000, "highPassFreq": 30, "distortionAmt": 0 },
  "reverb": { "ir": "JFKUnderpass", "lowPassFreq": 7000, "highPassFreq": 30, "phaserWetness": 0 },
  "master": { "ottAmt": 0, "distortionAmt": 0, "limiterAmt": 1 }
}
```

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
- Cycles through dropdown order (shared alphabetical, then user alphabetical)
- Wraps around using modulo

### Save Flow
1. User clicks 💾
2. Modal appears with name input
3. If name exists for this user: prompt "Update existing or save as new?"
4. Validation: alphanumeric only, max 32 characters
5. On success: close modal, select the saved preset

### Delete Flow
1. User clicks 🗑️
2. Confirmation prompt: "Are you sure you want to delete [preset name]?"
3. On confirm: delete preset, show "Unsaved" state (keep current audio settings)
4. Cannot delete shared presets (button disabled or hidden when shared preset selected)

### Unauthenticated State
- PresetsBar visible but disabled
- Shows "Log in to use presets" message

### Initial State
- Use current hook default values as starting state
- Display shows "Unsaved" until a preset is selected

### After Delete
- Reset to "Unsaved" state
- Keep current audio settings intact

### Modified Indicator (nice to have)
- If easy to implement: show asterisk when preset has been modified (e.g., "My Kick *")
- Skip if complex

---

## API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/presets/` | GET | Required | List user's presets |
| `/api/presets/` | POST | Required | Create new preset |
| `/api/presets/<id>/` | PUT | Required | Update preset (name and/or config) |
| `/api/presets/<id>/` | DELETE | Required | Delete preset |
| `/api/presets/shared/` | GET | Required | List shared presets (read-only) |

---

## Files to Create

### Backend (Django)

| File | Purpose |
|------|---------|
| `django/presets/__init__.py` | Package init (empty) |
| `django/presets/apps.py` | App config |
| `django/presets/models.py` | `Preset` and `SharedPreset` models |
| `django/presets/serializers.py` | DRF serializers with name validation (alphanumeric, max 32, unique per user) |
| `django/presets/views.py` | API views with IsAuthenticated permission |
| `django/presets/admin.py` | Django admin for managing shared presets |

### Frontend (React)

| File | Purpose |
|------|---------|
| `react/src/types/preset.ts` | TypeScript interfaces for PresetConfig, Preset, setters |
| `react/src/hooks/usePresets.ts` | Preset management: fetch, save, update, delete, navigation |

---

## Files to Modify

### Backend

| File | Change |
|------|--------|
| `django/config/settings.py` | Add `"presets"` to INSTALLED_APPS |
| `django/config/urls.py` | Add preset API routes |

### Frontend

| File | Change |
|------|--------|
| `react/src/utils/api.ts` | Add `authenticatedFetch` helper + all preset API functions |
| `react/src/hooks/useKickLayer.ts` | Export `setters` object and `getState()` function |
| `react/src/hooks/useNoiseLayer.ts` | Export `setters` object and `getState()` function |
| `react/src/hooks/useReverbLayer.ts` | Export `setters` object and `getState()` function |
| `react/src/hooks/useMasterChain.ts` | Export `setters` object and `getState()` function |
| `react/src/hooks/useTransport.ts` | Export `setters` object and `getState()` function |
| `react/src/components/PresetsBar.tsx` | Full rewrite: dropdown, nav, delete, save modal, confirmation dialogs |
| `react/src/components/Daw.tsx` | Wire up `usePresets` hook, pass setters and getCurrentConfig |
| `react/src/App.css` | Add modal overlay and confirmation dialog styles |

---

## Implementation Order

### Phase 1: Backend
1. Create `django/presets/` directory
2. Create `apps.py`, `__init__.py`
3. Create `models.py` with Preset and SharedPreset
4. Create `serializers.py` with validation (alphanumeric, max 32, unique per user)
5. Create `views.py` with all endpoints
6. Create `admin.py` for shared preset management
7. Update `config/settings.py` - add "presets" to INSTALLED_APPS
8. Update `config/urls.py` - add routes
9. Run: `python manage.py makemigrations presets && python manage.py migrate`
10. Test with curl or Postman

### Phase 2: Frontend Types & API
11. Create `types/preset.ts`
12. Update `utils/api.ts` with authenticatedFetch and preset functions

### Phase 3: Hook Updates
13. Modify `useKickLayer.ts` - add setters + getState
14. Modify `useNoiseLayer.ts` - add setters + getState
15. Modify `useReverbLayer.ts` - add setters + getState
16. Modify `useMasterChain.ts` - add setters + getState
17. Modify `useTransport.ts` - add setters + getState

### Phase 4: Presets Hook & UI
18. Create `hooks/usePresets.ts`
19. Rewrite `components/PresetsBar.tsx`
20. Update `components/Daw.tsx`
21. Add modal/dialog CSS to `App.css`

---

## Validation Rules

### Preset Name
- Alphanumeric characters only (a-z, A-Z, 0-9, spaces allowed)
- Maximum 32 characters
- Must be unique per user (same name allowed for different users)
- Required (cannot be empty)

---

## Model Definitions

### Preset (User Presets)
```python
class Preset(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='presets')
    name = models.CharField(max_length=32)
    config = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['user', 'name']
        ordering = ['name']
```

### SharedPreset (Admin Presets)
```python
class SharedPreset(models.Model):
    name = models.CharField(max_length=32, unique=True)
    config = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
```

---

## Verification Checklist

### Backend
- [ ] Create preset via API returns 201
- [ ] List presets returns only current user's presets
- [ ] Duplicate name for same user returns 400 error
- [ ] Same name for different users works fine
- [ ] Delete preset returns 204
- [ ] Cannot delete another user's preset (404)
- [ ] Shared presets endpoint returns all shared presets
- [ ] Invalid name (special chars or >32) returns validation error

### Frontend
- [ ] Unauthenticated: shows "Log in to use presets"
- [ ] On login: all presets fetched automatically
- [ ] Dropdown shows shared (alpha) then user (alpha)
- [ ] Selecting preset loads all settings instantly (no API call)
- [ ] Next/prev buttons cycle through list with wrap-around
- [ ] Save with new name creates preset
- [ ] Save with existing name prompts update/new choice
- [ ] Invalid name shows error in modal
- [ ] Delete shows confirmation, then removes preset
- [ ] After delete: shows "Unsaved", keeps current settings
- [ ] No presets: dropdown shows "No presets yet"
- [ ] Cannot delete shared presets

---

## Future Considerations (Not in Scope)
- Preset versioning/migration for new parameters (just use defaults)
- Export/import presets as files
- Preset categories or tags
- Preset sharing between users
