# VOICY — Audio Notes Platform

Upload a recording, get an accurate **transcript** (Gnani Batch STT) and an AI-written **summary** (Google Gemini), then search it, ask questions about it, and export it.

VOICY is built for Indian-language audio — including code-mixed speech like Hinglish — and handles long files (up to 5 GB / 300 minutes) without ever pushing the audio through the API server.

---

## Table of Contents

1. [What you get](#what-you-get)
2. [User guide — from sign-up to summary](#user-guide--from-sign-up-to-summary)
   - [Step 1 — Create your account](#step-1--create-your-account)
   - [Step 2 — Log in](#step-2--log-in)
   - [Step 3 — (Optional) Add your own API keys](#step-3--optional-add-your-own-api-keys)
   - [Step 4 — Upload an audio file](#step-4--upload-an-audio-file)
   - [Step 5 — Watch it process](#step-5--watch-it-process)
   - [Step 6 — Read the transcript and summary](#step-6--read-the-transcript-and-summary)
   - [Step 7 — Search, ask, and export](#step-7--search-ask-and-export)
   - [Step 8 — Track usage and logs](#step-8--track-usage-and-logs)
3. [Upload limits and supported formats](#upload-limits-and-supported-formats)
4. [Recording status reference](#recording-status-reference)
5. [How it works under the hood](#how-it-works-under-the-hood)
6. [Tech stack](#tech-stack)
7. [Project structure](#project-structure)
8. [Running it yourself](#running-it-yourself)
9. [API overview](#api-overview)
10. [Security model](#security-model)
11. [Troubleshooting](#troubleshooting)
12. [Further reading](#further-reading)

---

## What you get

| Feature | Description |
| --- | --- |
| **Direct-to-storage upload** | Your browser uploads the audio straight to private cloud storage. The API server never receives the audio file. |
| **Transcription** | Gnani **Batch** Speech-to-Text with timestamps, optional speaker diarization and noise reduction. |
| **Multi-language** | Pick up to 3 candidate languages from 8 supported Indian languages; Gnani identifies the language per file. |
| **Auto summary** | As soon as the transcript is ready, Gemini generates a summary (key points, decisions, action items). |
| **Synced playback** | Click any transcript segment to jump the audio player to that moment. |
| **Search** | Fuzzy transcript search inside a recording, plus search/filter across all your recordings. |
| **Ask AI** | Ask questions about a specific recording. |
| **Tags and naming** | Give recordings a name and `#tags`, then filter by tag or date range. |
| **PDF export** | Select one or more recordings and export their transcripts as PDF. |
| **Usage dashboard** | Minutes transcribed, request volume, and estimated billing. |
| **Activity logs** | A per-user timeline of upload, transcription, and summary events (including errors). |
| **Bring your own keys** | Optionally use your own Gnani / Gemini API keys, stored encrypted. |
| **Reliable background jobs** | Retries (1 min → 5 min → 10 min), idempotent processing, and recovery from crashed workers. |

---

## User guide — from sign-up to summary

> **Before you start:** open the VOICY web app in your browser (the deployed URL, or `http://localhost:3000` if you are running it locally — see [Running it yourself](#running-it-yourself)). You will need an audio file in one of the [supported formats](#upload-limits-and-supported-formats). A short sample, `hinglish_conversation.mp3`, is included in the root of this repository if you just want to try it out.

### Step 1 — Create your account

1. Go to **`/register`** (the **Create account** link on the login page).
2. Fill in the form:
   - **Avatar** — pick one of the six avatars.
   - **Username** — letters, numbers, and underscores only (anything else is stripped automatically as you type).
   - **Email address**
   - **Password** — at least **8 characters**.
3. Click **Create account**.

What happens next depends on how the Supabase project is configured:

- **Email confirmation disabled** — you are signed in immediately and land on the **Home** page.
- **Email confirmation enabled** — Supabase sends you a confirmation email. Click the link in it; you will be redirected back to the app through `/auth/callback`. Then log in.

Your username and avatar are saved to your profile and can be edited later on the **Profile** page.

### Step 2 — Log in

1. Go to **`/login`**.
2. Enter your email and password and submit.
3. You land on **Home**.

Authentication is handled by Supabase Auth. Every request the app makes to the backend carries your session token, and the backend verifies it on every call.

### Step 3 — (Optional) Add your own API keys

By default VOICY uses the platform's shared Gnani and Gemini keys, so **you do not need to do anything** to get started.

If you want to use your own quota:

1. Open **Profile** in the sidebar.
2. Find the **Gemini** and/or **Gnani** key field and click **Edit**.
3. Paste your API key.
4. **Uncheck "use default"** for that provider. *If "use default" stays checked, your custom key is not used.*
5. Click **Save Changes**.

Gemini and Gnani are configured independently. Saved keys are **encrypted at rest**, only decrypted in backend memory when a job needs them, **never sent back to the browser**, and always shown masked. To go back to the shared keys, remove your custom keys from the same page.

### Step 4 — Upload an audio file

1. Go to **Home** and click **Upload Audio**. The **Upload Audio Note** dialog opens.
2. **Audio File** — choose your file (`.wav`, `.mp3`, `.ogg`, `.flac`, `.aac`, `.m4a`).
3. **Recording Name** — a friendly title for the recording (optional but recommended; it is what you will search by).
4. **Tags** — type a tag and press **Enter**. Existing tags are suggested as you type; leading `#` is ignored and tags are lowercased. Press **Backspace** on an empty box to remove the last tag.
5. **Language Identification** — choose up to **3 candidate languages**:
   - **1. Primary / Fallback Language** (required) — used if Gnani's language identification confidence is low.
   - **2. / 3. Candidate Language** (optional) — add these if the audio may contain more than one language.
   - Supported: Hindi (`hi-IN`), English – India (`en-IN`), Bengali (`bn-IN`), Kannada (`kn-IN`), Malayalam (`ml-IN`), Marathi (`mr-IN`), Tamil (`ta-IN`), Telugu (`te-IN`).
   - For a Hindi + English mix, choose **Hindi** first and **English (India)** second.
   - The dialog shows the exact value that will be sent (for example `"hi-IN,en-IN"`).
   - *Note:* the language is resolved **per file**, not per sentence.
6. **Enable Speaker Diarization** (optional) — labels who is speaking. Currently supports up to **2 speakers**.
7. **Enable Noise Reduction** (optional) — removes background noise before transcription. Recommended for noisy audio; adds roughly 25% processing time but does **not** add to billed duration.
8. Click **Upload**.

A progress bar walks through the upload stages:

| Progress message | What is happening |
| --- | --- |
| *Preparing upload…* | Checking you are logged in, validating file size and type. |
| *Creating record…* | A recording row is created for you (status `uploading`). |
| *Uploading audio data…* | Your browser is sending the file directly to private storage. |
| *Finalizing…* | The recording is marked `uploaded`. |
| *Upload complete!* | The backend has been asked to queue the transcription job. |

When it completes, the dialog closes and you are taken to **All Transcripts**. If the upload fails (for example, network loss), the partially created record is cleaned up and an error is shown — just try again.

> **Tip:** keep the tab open until you see **Upload complete!**. The processing afterwards happens on the server, so you can safely close the tab after that.

### Step 5 — Watch it process

After upload, processing is fully automatic and runs in the background. You do not need to click anything else.

1. Open the recording from **All Transcripts** (click its card).
2. The detail page **refreshes itself every 5 seconds** while work is in progress.
3. The status badge moves through these states:

```
uploaded → transcription created → transcription starting → transcription processing → transcription completed
                                                                                              │
                                                                          summary: queued → processing → completed
```

Roughly:

- **Transcription created** — your job is queued and waiting for the background worker.
- **Transcription starting** — the worker is preparing the audio and creating the Gnani Batch job.
- **Transcription processing** — Gnani is transcribing. The worker checks in on it about every 10 seconds. Duration depends on audio length (minutes for short files, longer for multi-hour files).
- **Transcription completed** — the transcript is saved. **The summary is queued automatically** at this moment.
- Summary card shows **Generating…** → then the summary text appears.

If something goes wrong, VOICY retries automatically (after 1 minute, then 5, then 10). Only after that does the status become **transcription failed** — see [Troubleshooting](#troubleshooting).

You can follow every step live on the **Logs** page too.

### Step 6 — Read the transcript and summary

Open a recording (**All Transcripts → click a card**). The page has three areas:

**Left column**
- Recording name, status badge, detected language, date, and duration.
- An **audio player** (a secure, short-lived link is generated each time you open the page).
- **Ask AI** panel (see next step).

**Right column — Transcript**
- One block per segment, with the **speaker label** (`S0`, `S1`… when diarization is on) and a **timestamp**.
- **Click any segment** to jump the audio player to that moment and start playing.
- **Search…** box at the top of the transcript.
- **Copy** button to copy the whole transcript to your clipboard.

**Right column — Summary**
- Appears automatically once transcription has finished — a concise, structured summary with main points, key decisions, and action items.
- While it is being written you will see *"Analyzing conversation and generating smart summary…"* and a **Generating…** badge.
- If summary generation fails, you will see *"Summary generation failed. The transcript is still available above."* — **a failed summary never deletes a good transcript.**

Use the pencil icon next to the filename in the header to **rename** the recording, or **Delete** to remove it (this also deletes the stored audio file).

### Step 7 — Search, ask, and export

**Search inside one recording** — type at least 2 characters in the transcript's **Search…** box. Matching is fuzzy (typo-tolerant, powered by PostgreSQL `pg_trgm`) and falls back to exact substring matching. Click a result to jump to that moment in the audio.

**Ask AI** — in the left column, type a question under **Ask AI** (for example, *"What action items were agreed?"*). The answer is generated from that recording's transcript.

**Find recordings** — on **All Transcripts**:
- Search by **Recording Name** or **Audio Filename** (switch with the dropdown next to the search box).
- Filter by **Tags** (multi-select) and **Date Range**.
- **Clear Filters** resets everything.

**Export to PDF** —
1. On **All Transcripts**, tick the checkbox at the top-left corner of one or more cards.
2. Click **EXPORT** → confirm **Export**.
3. A PDF per selected recording is downloaded (named like `VOICY_Transcript_Export_<date>_<recording>_<file>.pdf`).

**Bulk delete** — select cards, then **DELETE TRANSCRIPTS** and confirm.

### Step 8 — Track usage and logs

- **Dashboard** — transcription minutes, total billing (estimated, in ₹), total requests, completed transcriptions, request-volume and daily-duration charts, and a usage history table. Only successful transcriptions are billed; failed jobs cost nothing.
- **Logs** — a timeline of events for your recordings (`upload`, `storage`, `transcription`, `summary`, `system`) with `info` / `warning` / `error` levels. Filter by level. This is the first place to look if a recording seems stuck.
- **Architecture** — an in-app diagram of how the system is put together.
- **Profile** — username, avatar, and API key management.

---

## Upload limits and supported formats

| Limit | Value |
| --- | --- |
| Supported formats | WAV, MP3, OGG, FLAC, AAC, M4A |
| Maximum file size | 5 GB (configurable: `MAX_FILE_SIZE_BYTES`) |
| Maximum duration | 300 minutes (configurable: `MAX_DURATION_MINUTES`) |
| Gnani per-file limit | 4 hours — longer files are automatically split into ~3.5-hour chunks with FFmpeg and stitched back together with correct timestamps |
| Languages | `hi-IN`, `en-IN`, `bn-IN`, `kn-IN`, `ml-IN`, `mr-IN`, `ta-IN`, `te-IN` (Gnani Batch does not support `gu-IN` or `pa-IN`) |
| Speaker diarization | Up to 2 speakers |

---

## Recording status reference

**Recording status** (`status`):

| Status | Meaning |
| --- | --- |
| `created` / `uploading` | Record exists; file is being uploaded. |
| `uploaded` | File is safely in storage; waiting to be queued. |
| `transcription_created` | Queued for the background worker. (Also the state between automatic retries.) |
| `transcription_starting` | Worker picked it up and is creating the Gnani job. |
| `transcription_processing` | Gnani is transcribing. |
| `transcription_completed` | Transcript saved. |
| `transcription_failed` | Failed after all retries or a non-retryable error. Re-upload the file. |
| `cancelled` | Cancelled. |

**Summary status** (`summary_status`): `not_requested` → `queued` → `processing` → `completed` (or `failed`).

---

## How it works under the hood

```
Browser (Next.js)
   │ 1. sign up / log in ───────────────► Supabase Auth
   │ 2. create recording row, upload ───► Supabase Storage (private bucket)
   │    audio directly (no API hop)
   │ 3. POST /api/recordings ───────────► FastAPI ──► validates owner, sets status,
   │                                          │         enqueues job
   │                                          ▼
   │                                    Redis (ARQ queue)
   │                                          │
   │                                          ▼
   │                                    ARQ Worker
   │                                      a. signed URL for the audio (short-lived, 2h for Gnani)
   │                                      b. FFmpeg probe; chunk only if > 4 hours
   │                                      c. Gnani Batch: create job → start job
   │                                      d. poll status (~10s) → fetch files → download transcript
   │                                      e. store transcript segments + raw provider response
   │                                      f. auto-enqueue summary job
   │                                      g. Gemini Flash summarises the transcript
   │                                          │
   │ 4. GET /api/recordings/{id} (polled) ◄───┴── PostgreSQL (notes, segments, jobs, usage, logs)
```

Key design points:

- **Large files never touch the API.** The browser uploads directly to storage; FastAPI only handles small JSON requests.
- **Long work never blocks HTTP.** Transcription and summarization run in an ARQ worker process; the API just enqueues jobs.
- **Idempotent and retryable.** Duplicate jobs are detected (a running job is skipped; a stale lock from a crashed worker is reclaimed after the job timeout). Retries follow **1 min → 5 min → 10 min → failed**. Permanent errors (for example, a terminal Gnani status) are not retried.
- **Provider adapters.** Gnani and Gemini specifics live in `services/transcription/gnani.py` and `services/summarization/gemini.py`; the rest of the app uses provider interfaces.
- **Raw provider responses are preserved** in the `processing_jobs` table for debugging.
- **Failure isolation.** A failed summary never erases a successful transcript.
- **Structured logging** with `note_id`/`recording_id`, job IDs, and provider fields. API keys and transcript contents are never logged.

> ADR-002 in `docs/adr/` originally described Cloudflare R2 presigned multipart uploads. The implementation uses **Supabase Storage** with direct browser upload instead; the principle (the API never receives the audio binary, bucket stays private) is unchanged.

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Recharts, jsPDF |
| Backend API | FastAPI, SQLAlchemy 2 (async), Pydantic 2, structlog |
| Database | PostgreSQL (Alembic migrations, `pg_trgm` for search) |
| Auth + Storage | Supabase Auth, Supabase Storage (private bucket) |
| Background jobs | ARQ + Redis |
| Transcription | Gnani Batch STT (`https://api.vachana.ai`) |
| Summarization / Q&A | Google Gemini Flash |
| Audio processing | FFmpeg / ffprobe via `static-ffmpeg` (no system install needed) |
| Hosting | Railway (API, worker) |

---

## Project structure

```
.
├── backend/
│   ├── app/
│   │   ├── api/routes/        # recordings, profiles, tags, usage, logs, ask_ai, webhooks, health
│   │   ├── core/              # config (env), logging, security (key encryption), supabase client
│   │   ├── crud/              # system-log helpers
│   │   ├── db/                # async session and base
│   │   ├── models/            # SQLAlchemy models and status enums
│   │   ├── schemas/           # Pydantic request/response schemas
│   │   ├── services/          # provider adapters: transcription (Gnani), summarization (Gemini), Ask AI
│   │   ├── workers/           # ARQ worker: main.py, tasks.py (pipeline), chunking.py (FFmpeg)
│   │   └── main.py            # FastAPI app
│   ├── migrations/            # Alembic migrations
│   ├── tests/                 # pytest suite
│   ├── requirements.txt
│   └── pyproject.toml
├── frontend/
│   └── src/
│       ├── app/               # (auth) login/register, (main) home/transcripts/dashboard/logs/profile, recordings/[id]
│       ├── components/        # UploadModal, AskAI, Sidebar, TopBar, AuthProvider
│       └── lib/               # api client, upload logic, supabase client
├── docs/
│   ├── adr/decisions.md       # architecture decision records
│   └── external/gnani/        # Gnani STT reference
├── project_spec_v1.1.md       # product requirements
├── architecture_spec_v1.1.md  # architecture decisions
├── AGENTS.md                  # engineering rules for this repo
└── hinglish_conversation.mp3  # sample audio for trying the app
```

---

## Running it yourself

### Prerequisites

- Python 3.9+ and Node.js 20+
- PostgreSQL with the `pg_trgm` extension available
- Redis
- A [Supabase](https://supabase.com) project (Auth + a **private** Storage bucket named `audio-files`)
- A Gnani API key and a Google Gemini API key
- *FFmpeg does not need to be installed* — `static-ffmpeg` downloads the `ffmpeg`/`ffprobe` binaries automatically on first use.

### 1. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env      # then fill in the values (see below)

alembic upgrade head      # create/upgrade the database schema
uvicorn app.main:app --reload --port 8000
```

API docs are served at `http://localhost:8000/docs`.

### 2. Worker (separate terminal — required!)

```bash
cd backend && source .venv/bin/activate
arq app.workers.main.WorkerSettings
```

> **Without the worker running, uploads will sit at "transcription created" forever.** The API only enqueues jobs; the worker is what actually does the transcription and summarization.

### 3. Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=<your Supabase project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your Supabase anon key>
NEXT_PUBLIC_API_URL=http://localhost:8000
```

```bash
npm run dev               # http://localhost:3000
```

### Backend environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | `postgresql+asyncpg://user:pass@host:5432/db` |
| `REDIS_URL` | Redis connection used by the API (enqueue) and worker |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Backend access to Supabase (token verification, signed URLs). **Keep the service-role key secret.** |
| `SUPABASE_BUCKET_NAME` | Storage bucket (default `audio-files`) |
| `ENCRYPTION_KEY` | Fernet key for encrypting user API keys. Generate one: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |
| `GNANI_API_KEY` | Default Gnani key |
| `GNANI_BASE_URL` | Default `https://api.vachana.ai` |
| `GNANI_MODEL` | Default `gnani-prisma-v2.5` |
| `GNANI_DEFAULT_LANGUAGE_CODE` | Fallback language(s), default `hi-IN,en-IN` |
| `GNANI_WEBHOOK_URL` | *Optional.* If empty, the worker polls Gnani; if set, completion is reported through the webhook route |
| `GEMINI_API_KEY` | Default Gemini key |
| `ALLOWED_ORIGINS` | JSON list of allowed CORS origins, e.g. `["http://localhost:3000"]` |
| `MAX_FILE_SIZE_BYTES`, `MAX_DURATION_MINUTES` | Upload limits |

Never commit `.env` files — they are git-ignored. Secrets are only ever read from environment variables.

### Deploying (Railway)

Run two services from the `backend/` directory, with the same environment variables:

| Service | Start command |
| --- | --- |
| **API** | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| **Worker** | `arq app.workers.main.WorkerSettings` |

Run `alembic upgrade head` on deploy (or as a release command). After changing dependencies or environment variables, **redeploy both** the API and the worker — they are separate processes.

### Tests

```bash
cd backend
pytest
```

---

## API overview

All routes (except health) require `Authorization: Bearer <Supabase access token>`. The user ID is always derived from the verified token — never from the request body.

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/recordings` | Queue an uploaded recording for transcription (sets name, tags, language/diarization config) |
| `GET` | `/api/recordings` | List **your** recordings |
| `GET` | `/api/recordings/{id}` | Recording detail with transcript segments |
| `GET` | `/api/recordings/{id}/status` | Status and processing-job info |
| `GET` | `/api/recordings/{id}/audio-url` | Short-lived signed URL for playback |
| `GET` | `/api/recordings/{id}/search?q=` | Fuzzy transcript search |
| `POST` | `/api/recordings/{id}/summary` | Re-request a summary (requires a completed transcription) |
| `POST` | `/api/recordings/{id}/ask` | Ask AI about the recording |
| `PATCH` / `DELETE` | `/api/recordings/{id}` | Rename / delete |
| `GET` | `/api/tags` | Your tags |
| `GET` | `/api/usage` | Usage and billing summary |
| `GET` / `POST` | `/api/logs` | Your activity logs |
| `GET` / `PATCH` | `/api/profile` | Profile |
| `GET` / `PATCH` / `DELETE` | `/api/profile/keys` | Custom API key configuration |
| `GET` | `/health`, `/ready` | Liveness and readiness |

Interactive docs: `/docs` (Swagger) and `/redoc`.

---

## Security model

- **Per-user isolation** — every recording query is scoped to the authenticated user on the server; other users' recordings return `404`.
- **Server-side authorization** on every recording operation; user IDs are never trusted from the client.
- **Private storage** — the audio bucket is private. Playback and transcription use **short-lived signed URLs** (1 hour for playback; 2 hours for Gnani to download).
- **Encrypted user API keys** — stored as Fernet ciphertext, decrypted only in backend memory, never returned to the browser.
- **No secrets in code** — configuration is via environment variables only; keys, passwords, and transcript contents are not logged.
- **File validation** — type, extension, and size are checked before upload.

---

## Troubleshooting

| Symptom | Likely cause | What to do |
| --- | --- | --- |
| Recording stays at **transcription created** for more than a minute or two | The ARQ worker is not running, can't reach Redis, or crashed | Check the worker service is up and its logs for errors; make sure it uses the same `REDIS_URL`/`DATABASE_URL` as the API; redeploy the worker. Also check the in-app **Logs** page for a warning with the error and retry time. |
| **Logs** shows *"encountered an error … Retrying in 60 seconds"* | A transient failure (storage, FFmpeg, Gnani) | Wait — VOICY retries after 1, 5, then 10 minutes. |
| Status becomes **transcription failed** | Retries exhausted, or Gnani rejected the job (e.g., unsupported or corrupt audio) | Open **Logs** for the error detail, fix the cause (convert the file, check the Gnani key/quota), and upload again. |
| Transcript is present but the Summary shows *"generation failed"* | Gemini key missing/invalid, quota, or temporary API error | Check your Gemini key on **Profile** (or the server's `GEMINI_API_KEY`). The transcript is safe. |
| Custom API key seems ignored | "use default" is still checked | Uncheck **use default** for that provider and **Save Changes**. |
| Upload fails immediately | Wrong file type, over 5 GB, or you're logged out | Use WAV/MP3/OGG/FLAC/AAC/M4A, keep under 5 GB, log in again. |
| `ffprobe`/`ffmpeg` "No such file or directory" in worker logs | FFmpeg binaries not available | VOICY uses `static-ffmpeg`; make sure `static-ffmpeg` is installed from `requirements.txt` and the worker has network access on first start to download the binaries. |
| Can't log in right after registering | Email confirmation is enabled in Supabase | Click the link in the confirmation email first. |

---

## Further reading

- [`project_spec_v1.1.md`](project_spec_v1.1.md) — product requirements
- [`architecture_spec_v1.1.md`](architecture_spec_v1.1.md) — architecture decisions
- [`docs/adr/decisions.md`](docs/adr/decisions.md) — architecture decision records
- [`docs/external/gnani/gnani_stt_offline_reference.md`](docs/external/gnani/gnani_stt_offline_reference.md) — Gnani Batch STT reference
- [`AGENTS.md`](AGENTS.md) — engineering rules for this repository
