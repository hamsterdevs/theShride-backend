# JobApply Backend

Express API for parsing resumes and job descriptions, generating application emails with Gemini, authorizing Gmail, and sending application emails with a resume PDF attachment.

## Setup

```bash
npm install
cp .env.example .env
```

Set the placeholder values in `.env`, then start the API:

```bash
npm run dev
```

The API runs on `http://localhost:5000` by default. Change `PORT` if needed.

## Environment

| Variable | Purpose |
| --- | --- |
| `PORT` | Backend port. Defaults to `5000`. |
| `CLIENT_ORIGIN` | Frontend URL used after Google OAuth completes. |
| `GEMINI_API_KEY` | Google AI Studio API key for Gemini-powered parsing and drafting. |
| `GEMINI_MODEL` | Optional Gemini model name. Defaults to `gemini-3.6-flash`; use either `gemini-3.6-flash` or `models/gemini-3.6-flash`. |
| `GOOGLE_CLIENT_ID` | Google Cloud OAuth client ID for Gmail access. |
| `GOOGLE_CLIENT_SECRET` | Google Cloud OAuth client secret. |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL, for example `http://localhost:5000/api/auth/google/callback`. |

## Google OAuth and Gmail

Create a Google Cloud OAuth client and register `GOOGLE_REDIRECT_URI` as an authorized redirect URI. The authorization flow requests profile, email, and `gmail.send` permissions.

1. Request `GET /api/auth/google/url`.
2. Direct the user to the returned URL and let Google redirect to `/api/auth/google/callback`.
3. The backend saves the returned refresh token in `config/googleTokens.json` and redirects to `CLIENT_ORIGIN` with `?google_connected=true`.

The refresh token file is local-only and ignored by Git.

## API

### Health check

`GET /api/health`

### Resume parsing

`POST /api/resume/parse`

Send `multipart/form-data` with one `resume` file. PDF and DOCX files are accepted, with a 10 MB maximum. Gemini returns structured candidate data including contact details, skills, a summary, and formatted experience.

```bash
curl -X POST http://localhost:5000/api/resume/parse \
  -F 'resume=@/path/to/resume.pdf'
```

The latest uploaded PDF is stored locally as `config/lastResume.pdf`. It can be used automatically by the email-send endpoint. Uploading a DOCX removes an older saved PDF so a stale resume is not attached.

### Job parsing

`POST /api/jobs/parse`

```json
{
  "rawText": "Job title, company, requirements, and application details..."
}
```

Returns structured job details including `jobTitle`, `companyOrIndustry`, `recipientEmail`, `location`, `remuneration`, `employmentType`, and `keyRequirements`.

### Application email drafting

`POST /api/applications/draft`

```json
{
  "profile": {
    "name": "Candidate Name",
    "title": "Software Engineer",
    "skills": ["Node.js", "JavaScript"],
    "summary": "Backend-focused engineer."
  },
  "jobDetails": {
    "jobTitle": "Backend Engineer",
    "companyOrIndustry": "Example Company",
    "keyRequirements": ["Node.js"],
    "recipientEmail": "hiring@example.com"
  },
  "customTone": "professional"
}
```

Returns `subject`, `body`, and `recipientEmail`. A deterministic fallback draft with `isFallback: true` is returned when Gemini is rate-limited.

### Send application email

`POST /api/applications/send`

```json
{
  "to": "hiring@example.com",
  "subject": "Application for Backend Engineer - Candidate Name",
  "body": "Dear Hiring Manager,\n\nPlease find my resume attached.",
  "pdfBase64": "optional_base64_encoded_pdf"
}
```

The endpoint sends through Gmail as the authorized user and always attaches a PDF named `Boluwatife_Oladele_Resume.pdf`. It uses `pdfBase64` when present; otherwise it uses the latest PDF uploaded to the resume endpoint. A request with neither returns `400`.

### Legacy application pipeline

`POST /api/apply`

Accepts `jobUrl` or `jobDescription`, a `candidateProfile` object, and optional `applyTarget`. It generates a cover letter and invokes the browser-automation service.

## Local Files and Security

Never commit `.env`, `config/googleTokens.json`, or `config/lastResume.pdf`. They are listed in `.gitignore` because they can contain credentials or personally identifiable candidate data.

Before pushing, check the staged files:

```bash
git status
git diff --cached
```