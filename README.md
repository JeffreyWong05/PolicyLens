# 🔍 PolicyLens — Plain-English Policy Decoder

> Upload any dense policy document and get a structured, plain-English breakdown tailored to your role — plus a follow-up Q&A chat powered by Gemini AI.

**[Live Demo →](https://YOUR-PROJECT.netlify.app)**

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

| Layer        | Technology                                                                  |
|--------------|-----------------------------------------------------------------------------|
| Frontend     | Pure HTML5, CSS3, Vanilla JavaScript (no build step)                        |
| AI           | [Google Gemini API](https://ai.google.dev/gemini-api/docs) — free tier      |
| API Proxy    | Netlify Function — keeps the API key secret on the server                   |
| PDF Parsing  | [PDF.js](https://mozilla.github.io/pdf.js/) — runs in the browser           |
| DOCX Parsing | [Mammoth.js](https://github.com/mwilliamson/mammoth.js) — runs in browser   |
| Hosting      | [Netlify](https://netlify.com) — free tier, permanent                        |

**Architecture:** Document text is extracted in the visitor's browser (no file uploads to any server). The text is sent to `/.netlify/functions/gemini` — a serverless function that holds the Gemini API key securely as an environment variable, forwards the request to Google, and returns the result. Visitors never need their own API key.

---

## Project Structure

```
PolicyLens/
├── netlify/
│   └── functions/
│       └── gemini.js   # Netlify serverless function — secure API proxy
├── index.html          # App shell and UI structure
├── style.css           # All styles (dark mode, responsive design)
├── app.js              # Core logic: file extraction, API calls, rendering, chat
├── netlify.toml        # Netlify config (functions directory)
├── package.json        # Node.js metadata
└── README.md           # This file
```

---

## Deploying to Netlify (Free, Permanent)

### Step 1 — Push to GitHub

In PowerShell inside your `PolicyLens` folder:

```bash
git add .
git commit -m "Switch to Netlify"
git push
```

### Step 2 — Connect to Netlify

1. Go to [netlify.com](https://netlify.com) and click **Sign up** — use **GitHub** to sign in (free, no credit card)
2. Click **Add new site → Import an existing project**
3. Click **GitHub**, then find and select your **PolicyLens** repo
4. Leave all build settings blank — no build command, no publish directory needed
5. Click **Deploy site**

### Step 3 — Add your API key

1. In your Netlify project dashboard, go to **Site configuration → Environment variables**
2. Click **Add a variable**:
   - **Key:** `GEMINI_API_KEY`
   - **Value:** your key from [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) (free, no credit card)
3. Click **Save**

### Step 4 — Redeploy

Go to **Deploys** and click **Trigger deploy → Deploy site** so it picks up the new environment variable.

Your site is live at `https://YOUR-PROJECT.netlify.app` — update the link at the top of this README.

> Every future change is just `git add . && git commit -m "update" && git push` — Netlify auto-deploys within seconds.

---

## Running Locally

For local development with the full serverless function working, use the Netlify CLI:

```bash
npm install -g netlify-cli
netlify login
netlify dev
```

Create a `.env` file in your project root (never commit this):
```
GEMINI_API_KEY=AIzaSy...your-key-here...
```

Open `http://localhost:8888` — the function runs automatically alongside the frontend.

---

## Key Features for Your Resume

- **Secure API proxy pattern** — Serverless function keeps credentials off the client; industry-standard approach for AI-powered web apps
- **Prompt engineering** — Structured JSON output, role-aware system prompts, multi-turn context management
- **Client-side document processing** — PDF and DOCX text extraction with no file uploads
- **Modern CSS** — CSS custom properties, dark mode, responsive grid, animations
- **UX polish** — Drag & drop upload, loading states, error handling, keyboard navigation
- **Full-stack deployment** — Frontend + serverless backend on Netlify, zero server cost

---

## Privacy & Security

- The Gemini API key is stored as a Netlify environment variable — never in your code or repo
- Documents are extracted in the visitor's browser and never stored anywhere
- Only extracted text is sent to `/.netlify/functions/gemini`, which forwards it to Google
- No analytics, no tracking, no cookies

---

## Disclaimer

PolicyLens provides plain-English summaries for **informational purposes only**. This is **not legal advice**. Always consult a qualified professional before making decisions based on policy documents.

---

## License

MIT — free to use, modify, and distribute.

---

*Built with the [Google Gemini API](https://ai.google.dev/gemini-api/docs). Hosted on [Netlify](https://netlify.com).*
