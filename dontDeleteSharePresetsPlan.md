# Protect Shared Presets from Update/Delete

## Goal
Prevent users from updating or deleting shared presets through the app. Admin/Django management commands remain unaffected.

## Backend Changes

### `django/presets/views.py` - PresetDetailView

**`put()` method:** Before the existing ownership check, fetch the preset by `pk` alone. If it exists and `is_shared` is `True`, return a `403 Forbidden` with `{"error": "Cannot update shared preset"}`.

**`delete()` method:** Same guard — fetch by `pk`, check `is_shared`, return `403` with `{"error": "Cannot delete shared preset"}` if shared.

## Frontend Changes

### `react/src/hooks/usePresets.ts`

**`savePreset`:** Before calling the update API, check if the matching preset is shared. If so, skip the API call and return `{ ok: false, error: "Cannot update shared presets" }`.

**`deleteCurrentPreset`:** Before calling the delete API, check if the current preset is shared. If so, skip the API call and return `{ ok: false, error: "Cannot delete shared presets" }`.

### `react/src/components/PresetsBar.tsx`

**Delete button:** Remove the `disabled` attribute. When clicked, if the current preset is shared, show an info modal with the message "Cannot delete shared presets" and an OK button. Otherwise, show the existing delete confirmation modal.

**Save button:** When clicked, if the save would overwrite a shared preset, show an info modal with "Cannot update shared presets" and an OK button instead of opening the save modal.

The info modal reuses the existing `.modal-overlay` / `.modal` CSS classes. A single `showSharedMessage` state controls it, with a `sharedMessage` state for the text content.
