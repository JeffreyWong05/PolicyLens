# 🔍 PolicyLens — Plain-English Policy Decoder

> Upload any dense policy document and get a structured, plain-English breakdown tailored to your role — plus a follow-up Q&A chat powered by Gemini AI.

**[Live Demo →](https://YOUR-PROJECT.vercel.app)**

---

## What it does

PolicyLens takes dense policy documents (tax regulations, GDPR sections, HIPAA rules, employment contracts) and transforms them into:

- **TL;DR** — A 2-4 sentence plain-English summary
- **Key Points** — The most important rules, explained simply
- **Your Obligations** — What you specifically must do
- **What It Means For You** — Role-tailored analysis (individual, business owner, HR, etc.)
- **Deadlines** — Every date and timeline extracted and highlighted
- **Action Items** — Concrete next steps
- **Jargon Glossary** — Legal/technical terms defined in plain English
- **Follow-up Q&A Chat** — Ask anything about the document

---

## Tech Stack

| Layer          | Technology                                                                 |
|----------------|----------------------------------------------------------------------------|
| Frontend       | Pure HTML5, CSS3, Vanilla JavaScript (no build step)                       |
| AI             | [Google Gemini API](https://ai.google.dev/gemini-api/docs) — free tier    |
| API Proxy      | Vercel Serverless Function — keeps the API key secret on the server        |
| PDF Parsing    | [PDF.js](https://mozilla.github.io/pdf.js/) — runs in the browser         |
| DOCX Parsing   | [Mammoth.js](https://github.com/mwilliamson/mammoth.js) — runs in browser |
| Hosting        | [Vercel](https://vercel.com) — free tier, permanent                        |

**Architecture:** Document text is extracted entirely in the visitor's browser (no file uploads). The extracted text is sent to `/api/gemini` — a Vercel serverless function that holds the Gemini API key securely as an environment variable, forwards the request to Google, and returns the result. Visitors never need their own API key.

---

## Project Structure

```
PolicyLens/
├── api/
│   └── gemini.js   # Vercel serverless function — secure API proxy
├── index.html      # App shell and UI structure
├── style.css       # All styles (dark mode, responsive design)
├── app.js          # Core logic: file extraction, API calls, rendering, chat
├── vercel.json     # Vercel config (function timeout settings)
└── README.md       # This file
```

---

## Running Locally

Local development requires the Vercel CLI so the serverless function works.

1. **Clone the repo**
   ```bash
   git clone https://github.com/YOUR-USERNAME/PolicyLens.git
   cd PolicyLens
   ```

2. **Install the Vercel CLI** (one-time)
   ```bash
   npm install -g vercel
   ```

3. **Create a `.env.local` file** in the project root (never commit this file)
   ```
   GEMINI_API_KEY=AIzaSy...your-key-here...
   ```
   Get a free key at [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) — no credit card required.

4. **Start the local dev server**
   ```bash
   vercel dev
   ```

5. Open `http://localhost:3000` — the serverless function runs automatically.

---

## Deploying to Vercel (Free, Permanent)

The demo works for any visitor with no API key required — yours stays hidden on Vercel's servers.

### Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: PolicyLens"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/PolicyLens.git
git push -u origin main
```

### Step 2 — Connect to Vercel

1. Go to [vercel.com](https://vercel.com) and sign up with your GitHub account (free)
2. Click **"Add New Project"**
3. Import your `PolicyLens` repository
4. Leave all build settings as-is (no framework, no build command needed)
5. Click **Deploy** — Vercel detects `api/gemini.js` automatically

### Step 3 — Add your API key

1. In your Vercel project, go to **Settings → Environment Variables**
2. Add a new variable:
   - **Name:** `GEMINI_API_KEY`
   - **Value:** your key from [Google AI Studio](https://aistudio.google.com/app/apikey)
   - **Environments:** Production, Preview, Development (check all three)
3. Click **Save**

### Step 4 — Redeploy

Go to the **Deployments** tab and click **Redeploy** on the latest deployment so it picks up the new environment variable.

Your site is live at `https://YOUR-PROJECT.vercel.app` — update the link at the top of this README.

> **Note:** Vercel auto-deploys every time you push to `main`, so future updates are instant.

---

## Key Features for Your Resume

- **Secure API proxy pattern** — Serverless function keeps credentials off the client; industry-standard approach for AI-powered web apps
- **Prompt engineering** — Structured JSON output, role-aware system prompts, multi-turn context management
- **Client-side document processing** — PDF and DOCX text extraction with no file uploads
- **Modern CSS** — CSS custom properties, dark mode, responsive grid, animations
- **UX polish** — Drag & drop upload, loading states, error handling, keyboard navigation
- **Full-stack deployment** — Frontend + serverless backend on Vercel, zero server cost

---

## Privacy & Security

- The Gemini API key is stored as a Vercel environment variable — it never appears in your code or repo
- Uploaded documents are extracted in the visitor's browser and are never stored anywhere
- Only the extracted text is sent to `/api/gemini`, which forwards it to Google and returns the result
- No analytics, no tracking, no cookies

---

## Customization Ideas

- Add more roles (doctor, lawyer, landlord, tenant)
- Add export to PDF or Word document
- Add a document comparison mode
- Add a compliance checklist generator
- Support image-based PDFs via OCR (Tesseract.js)

---

## Disclaimer

PolicyLens provides plain-English summaries for **informational purposes only**. This is **not legal advice**. Always consult a qualified legal or compliance professional before making decisions based on policy documents.

---

## License

MIT — free to use, modify, and distribute.

---

*Built with the [Google Gemini API](https://ai.google.dev/gemini-api/docs). Hosted on [Vercel](https://vercel.com).*
