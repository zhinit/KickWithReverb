# Code Review Report — Kick With Reverb

**Date:** February 9, 2026
**Scope:** Full codebase — heavy focus on Frontend (React/TS) and PyTorch model code, moderate look at DSP (convolution reverb, OTT), lighter pass on Django backend.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Security Findings](#2-security-findings)
3. [Frontend (React/TypeScript)](#3-frontend-reacttypescript)
4. [PyTorch / ML Code](#4-pytorch--ml-code)
5. [DSP (Convolution Reverb & OTT)](#5-dsp-convolution-reverb--ott)
6. [Backend (Django) — Light Pass](#6-backend-django--light-pass)
7. [Cross-Cutting Concerns](#7-cross-cutting-concerns)
8. [Summary Table](#8-summary-table)

---

## 1. Executive Summary

This is a well-architected full-stack audio application. The Django backend follows solid conventions, secrets are properly managed, and there are no SQL injection or XSS vulnerabilities. The DSP code is clean and well-organized.

The areas with the most room for improvement are:

- **Frontend**: The biggest issues are around error handling gaps, magic strings for WASM messages, an oversized `usePresets` hook, and some inconsistent patterns across components.
- **PyTorch**: A hard-coded checkpoint filename that could break inference, an inefficient mel-spectrogram loss that rebuilds a transform on every batch, and some device-handling inconsistencies.
- **Security**: No API-level rate limiting (only app-level generation caps), and no error handling around Modal/Supabase calls in views.

Nothing here is a showstopper. Most findings are "moderate" severity — things that work today but could bite you later or make the code harder to maintain.

---

## 2. Security Findings

### What's Good
- `.env` properly gitignored, all secrets loaded via `os.getenv()`
- JWT auth (SimpleJWT) with access + refresh tokens, properly implemented
- All sensitive endpoints protected with `IsAuthenticated`
- CORS locked down (no wildcards, explicit origins)
- Zero raw SQL — all ORM queries, no injection risk
- No `dangerouslySetInnerHTML`, no `eval()`, no XSS vectors
- File uploads are generated internally (not user-provided), scoped by user ID
- CSRF middleware enabled, dependencies all current

### Issues Found

| Issue | Severity | Location |
|-------|----------|----------|
| **No API rate limiting** — No DRF throttling configured. Login/register endpoints have no brute-force protection. Only app-level generation caps (10/day, 30 total) exist. | **MEDIUM** | `backend/config/settings.py` |
| **No error handling around external calls** — Modal worker and Supabase API calls in views have no try/except. Failures produce raw 500 errors instead of user-friendly messages. | **MEDIUM** | `backend/kickgen/views.py:54-66` |
| **Tokens in localStorage** — JWT tokens stored in localStorage are accessible to any XSS attack. Not critical since there's no XSS vector currently, but httpOnly cookies would be more resilient. | **LOW** | `frontend/src/hooks/use-auth.tsx`, `frontend/src/utils/api.ts` |
| **No token expiry validation on load** — `getInitialStatus()` assumes token exists = valid. An expired token will stay in localStorage until the first 401 response. | **LOW** | `frontend/src/hooks/use-auth.tsx` |
| **No logging** — No logging configured for failed auth attempts, failed uploads, or API errors. Makes incident investigation harder. | **LOW** | Django backend generally |
| **Hardcoded EST offset** — Daily generation limit uses a hardcoded `-5` hour offset instead of Django timezone utilities. | **LOW** | `backend/kickgen/views.py:14-16` |

---

## 3. Frontend (React/TypeScript)

### 3.1 Magic Strings for WASM Messages — No Single Source of Truth

**Severity: MEDIUM** — Affects maintainability across multiple files.

Message types like `"selectKickSample"`, `"kickLength"`, `"noiseVolume"`, etc. are hard-coded as string literals scattered across every layer hook (`use-kick-layer.ts`, `use-noise-layer.ts`, `use-reverb-layer.ts`, `use-master-chain.ts`, `use-transport.ts`). There is no enum or constants file defining the protocol.

If a message type string is misspelled or the WASM side renames a message, it will fail silently at runtime with no TypeScript help.

**Recommendation:** Create a `MESSAGE_TYPES` enum or const object and use it everywhere.

---

### 3.2 `usePresets` Is Too Large (349 lines)

**Severity: MEDIUM** — Violates single responsibility, hard to maintain.

This hook handles fetching, caching, loading, saving, deleting presets AND coordinates 5 different layer hooks. It contains:

- Separate setter interfaces for each layer (`KickSetters`, `NoiseSetters`, `ReverbSetters`, etc.) that are structurally similar but not abstracted
- Complex branching for initial preset loading (guest vs. member vs. fallback logic, lines 205-220)
- `Promise.all` that destructures only the first element (line 196), suggesting incomplete refactoring
- `applyValues` callback with empty dependency array that relies on a mutable ref (`layersRef.current`) — works but is fragile

**Recommendation:** Consider splitting preset fetching/CRUD from preset-application logic. The layer coordination could be a separate hook.

---

### 3.3 Error Handling Gaps in Hooks

**Severity: MEDIUM** — Users get no feedback when things fail.

- `useAudioEngine` (line 162): `init().catch(console.error)` — if WASM fails to load, `isReady` stays false forever with no way to know what went wrong. No error state exposed.
- `useAiKicks` (line 75): `loadAiKicks().catch(console.error)` — loading failures are silently logged.
- `usePresets`: No retry mechanism or user-visible error state if preset fetch fails.

**Recommendation:** Hooks that do async initialization should expose an `error` state alongside `isReady`/`isLoading`, so the UI can show meaningful feedback.

---

### 3.4 Potential State Update After Unmount

**Severity: LOW-MEDIUM** — React will warn, could indicate a leak.

- `useAiKicks`: If the component unmounts during `loadAiKicks()`, the `.then()` callback will still call `setAiKicks()` on an unmounted component.
- `useAudioEngine`: The `cancelled` flag prevents `setIsReady(true)` but resources allocated before the cancellation check (line 101) won't be cleaned up.

**Recommendation:** Use an abort controller or mounted ref for async operations.

---

### 3.5 `api.ts` — Inconsistent Error Handling and Missing Timeouts

**Severity: LOW-MEDIUM**

- All API functions return `{ok: false, status: null, data: null}` for any error — no distinction between network error, 401, 403, 500, etc.
- Token refresh: If the first request gets 401 and the retry also fails, it won't attempt refresh again. Double-401s fail silently.
- No request timeout — fetches could hang indefinitely on a stalled network.
- Endpoint URLs (`"/api/kicks/"`) are magic strings. Should be constants.
- Query strings built by concatenation (`?confirm=true`) instead of `URLSearchParams`.

---

### 3.6 Component State Management Inconsistencies

**Severity: LOW-MEDIUM**

- `PresetsBar` uses 4 separate `useState` calls for modal state. `KickGenBar` uses 3. Different patterns for the same kind of UI (modals + messages). A shared pattern or reducer would be cleaner.
- `ControlStrip`: BPM input validation allows 60-365 on keystroke but clamps to 110-365 on blur — inconsistent ranges. Also, every keystroke sends a WASM message with no debounce.

---

### 3.7 TypeScript Weaknesses

**Severity: LOW**

- `types.ts:22`: `setBPM: Function` — using the bare `Function` type defeats TypeScript's purpose. Should be `(bpm: number) => void`.
- Several `!` non-null assertions without validation (e.g., `response.data!` in `usePresets` lines 281, 290).
- `useAiKicks:85-86`: Unsafe `as { error?: string }` cast on error response data.

---

### 3.8 Missing Accessibility

**Severity: LOW**

- Delete confirmation modal in `KickGenBar` lacks aria labels, focus management, keyboard navigation.
- `LoginForm`/`RegisterForm`: No `<label>` elements, no error descriptions for screen readers.
- `Knob` component: No keyboard interaction support (only mouse/pointer).

---

### 3.9 Minor Frontend Issues

| Issue | Location | Note |
|-------|----------|------|
| Array index as key | `Selectah.tsx:6`, `LayerStrip.tsx:27` | Use stable identifier instead of `key={i}` |
| All audio assets eager-loaded | `audioAssets.ts:2,13,24` | `import.meta.glob` with `eager: true` loads everything at startup |
| Fragile file name parsing | `audioAssets.ts:6,17,28` | `.split("/").pop()?.replace(...)` breaks if path structure changes |
| Knob sensitivity hard-coded | `Knob.tsx:31` | `0.5` magic number, no explanation |
| Unicode escape for emoji | `KickGenBar.tsx:158` | `\uD83C\uDFA8` instead of actual emoji — fragile if encoding changes |

---

## 4. PyTorch / ML Code

### 4.1 Hard-Coded Vocoder Checkpoint Filename

**Severity: HIGH** — Could break inference if checkpoint name changes.

```python
# kick_gen_worker/kick_worker.py:104
voc_path = os.path.join(self.repo_dir, "weights/vocoder_epoch_50.pt")
```

The vocoder training script saves both `"vocoder_epoch_50.pt"` and `"vocoder.pt"` (inference checkpoint). The Modal worker hard-codes the epoch-specific name. If you retrain and save at a different epoch, inference breaks.

**Recommendation:** Use `"vocoder.pt"` (the inference-ready checkpoint name).

---

### 4.2 Mel-Spectrogram Transform Rebuilt Every Batch

**Severity: MEDIUM** — Wasteful during training.

```python
# kick_gen_trainer/training/train_vocoder.py:141-156
def mel_spectrogram_loss(y, y_hat):
    mel_spec = torchaudio.transforms.MelSpectrogram(
        sample_rate=SAMPLE_RATE, n_fft=N_FFT, ...
    ).to(y.device)  # Creates new transform object every call!
    ...
```

This allocates a new `MelSpectrogram` transform on every loss computation. Should be created once and reused.

---

### 4.3 Text Encoder Device Handling Is Inconsistent

**Severity: MEDIUM** — Works but fragile.

`text_encoder.py` accepts `device` as a forward-pass parameter and creates tensors explicitly on that device:
```python
idx = torch.tensor(ids, device=device)
```

But `self.null_embedding` is a `nn.Parameter` that lives on whatever device the model is on. If someone passes a different `device` than where the model lives, you get a device mismatch.

**Recommendation:** Use `self.embedding.weight.device` instead of accepting `device` as a parameter.

---

### 4.4 NoiseScheduler Tensors Default to CPU

**Severity: MEDIUM** — Easy to forget `.to(device)`.

`NoiseScheduler.__init__()` creates `betas`, `alphas`, `alpha_bars` on CPU. A `.to(device)` method exists, but if someone forgets to call it, you get silent device-mismatch errors.

**Recommendation:** Either auto-detect device at inference time, or make the constructor accept a `device` parameter.

---

### 4.5 No Gradient Clipping in Training

**Severity: LOW** — Training works but could be more stable.

None of the three training scripts (`train_autoencoder.py`, `train_diffusion.py`, `train_vocoder.py`) apply gradient clipping. For diffusion models and adversarial training, this can cause instability.

**Recommendation:** Add `torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)` before `optimizer.step()`.

---

### 4.6 Naive Audio Resampling in Vocoder Dataset

**Severity: LOW-MEDIUM** — Affects audio quality.

```python
# kick_gen_trainer/training/train_vocoder.py:74-80
audio = np.interp(
    np.linspace(0, len(audio) - 1, int(len(audio) * SAMPLE_RATE / sr)),
    np.arange(len(audio)), audio,
).astype(np.float32)
```

This uses linear interpolation for resampling, which introduces aliasing. `torchaudio.transforms.Resample` (which is used elsewhere in preprocessing) would produce better results.

---

### 4.7 Minor PyTorch Issues

| Issue | Location | Note |
|-------|----------|------|
| Weight norm removed after `.eval()` | `kick_worker.py:113-114` | Should remove weight norm first, then set eval mode |
| Redundant `no_grad` contexts | `kick_worker.py:150-158` | Sampler already decorated with `@torch.no_grad()` |
| `squeeze(0)` assumes batch dim | `generate.py:332` | `squeeze()` without arg would be more robust |
| Undersized segment padding | `train_vocoder.py:107-110` | Padding in `__getitem__` suggests segment selection can produce short segments |
| `weights_only=False` undocumented | Multiple files | Works, but a comment explaining WHY would help future readers |

---

## 5. DSP (Convolution Reverb & OTT)

Overall assessment: **Clean and well-organized (7/10)**. Good use of JUCE, clear signal chain, consistent naming.

### 5.1 OTT Fixed Buffer Size — Could Overflow

**Severity: HIGH** — Works today, but fragile contract.

```cpp
// ott.h:54-56
std::array<float, 128> lowBandL_{}, lowBandR_{};
```

The OTT compressor uses fixed 128-sample arrays. If `process()` is ever called with `numSamples > 128`, this is a buffer overflow. Currently safe because the AudioWorklet always sends 128 samples, but this is an implicit contract with no assertion.

**Recommendation:** Add `assert(numSamples <= 128)` or make buffer sizes dynamic.

---

### 5.2 No WASM Pointer Validation

**Severity: MEDIUM** — Relies on Emscripten bounds checking.

```cpp
// audio_engine.cpp:50-51
float* left = reinterpret_cast<float*>(leftPtr);
float* right = reinterpret_cast<float*>(rightPtr);
```

Pointers from JavaScript are cast without validation. If JS passes wrong pointers, this reads/writes arbitrary memory.

**Recommendation:** Add debug assertions for pointer validity.

---

### 5.3 Unbounded IR Storage

**Severity: LOW** — Memory concern.

```cpp
// audio_engine.cpp:215-219
irStorage_.push_back(std::move(ir));
```

No limit on how many impulse responses can be loaded. In practice this is fine (user loads a few IRs), but there's no guard against memory exhaustion.

---

### 5.4 Hard-Coded Constants

**Severity: LOW** — Documentation concern.

The numbers `128` (block size) and `512` (FFT size) appear as literals throughout the DSP code. These should be named constants or documented in headers so the implicit contract between the AudioWorklet and C++ is explicit.

---

## 6. Backend (Django) — Light Pass

The backend is solid. A few observations:

| Issue | Severity | Location |
|-------|----------|----------|
| No try/except around Modal and Supabase calls | **MEDIUM** | `kickgen/views.py:54-66` |
| No DRF throttling configured | **MEDIUM** | `config/settings.py` |
| Hardcoded EST offset for daily limits | **LOW** | `kickgen/views.py:14-16` |
| `created_at` is `DateField` but logic needs datetime precision | **LOW** | `kickgen/models.py` |
| No server-side logging | **LOW** | Backend generally |
| No caching for shared presets | **LOW** | `presets/views.py` |

---

## 7. Cross-Cutting Concerns

### Naming Conventions
Generally consistent. A few exceptions:
- `Selectah` — creative but non-obvious name for a dropdown component
- `len` abbreviation in `useKickLayer.ts` where other hooks spell out full names
- `setSample` vs `setIr` — inconsistent setter naming across layer hooks

### Repetitive Patterns
The layer hooks (`use-kick-layer`, `use-noise-layer`, `use-reverb-layer`, `use-master-chain`) follow nearly identical structures with repeated `useEffect` patterns. A hook factory or shared abstraction could reduce duplication.

### Missing Error Boundaries
No React error boundary wraps the `Daw` component. If any child component throws during render, the entire app crashes with no recovery.

---

## 8. Summary Table

| Area | Finding | Severity | Category |
|------|---------|----------|----------|
| **Security** | No API rate limiting / DRF throttling | MEDIUM | Security |
| **Security** | No error handling around Modal/Supabase calls | MEDIUM | Security |
| **Frontend** | WASM message types are magic strings (no enum) | MEDIUM | Maintainability |
| **Frontend** | `usePresets` hook is 349 lines, does too much | MEDIUM | Code Organization |
| **Frontend** | Async errors silently logged, not exposed to UI | MEDIUM | Error Handling |
| **Frontend** | No request timeouts in `api.ts` | LOW-MEDIUM | Robustness |
| **Frontend** | Inconsistent modal state patterns across components | LOW-MEDIUM | Consistency |
| **Frontend** | `Function` type used instead of typed callback | LOW | TypeScript |
| **Frontend** | No error boundary around Daw | LOW | Error Handling |
| **Frontend** | Array index used as React key | LOW | React Pattern |
| **Frontend** | Missing accessibility (aria, labels, keyboard) | LOW | Accessibility |
| **PyTorch** | Hard-coded vocoder checkpoint filename | HIGH | Fragility |
| **PyTorch** | Mel transform rebuilt every batch in loss | MEDIUM | Performance |
| **PyTorch** | Text encoder device handling inconsistent | MEDIUM | Correctness |
| **PyTorch** | NoiseScheduler tensors default to CPU | MEDIUM | Error-Prone |
| **PyTorch** | Naive linear interpolation for resampling | LOW-MEDIUM | Audio Quality |
| **PyTorch** | No gradient clipping in training | LOW | Stability |
| **DSP** | OTT fixed 128-sample buffer, no bounds check | HIGH | Safety |
| **DSP** | No WASM pointer validation | MEDIUM | Safety |
| **DSP** | Hard-coded block size constants | LOW | Maintainability |
| **Backend** | No try/except around external service calls | MEDIUM | Error Handling |
| **Backend** | Hardcoded EST timezone offset | LOW | Correctness |

---

*Report generated by Claude Code — no code changes made.*
