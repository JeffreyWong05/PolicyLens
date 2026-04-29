# 🔍 PolicyLens — Plain-English Policy Decoder

> Upload any dense policy document and get a structured, plain-English breakdown tailored to your role — plus a follow-up Q&A chat powered by Google Gemini AI.

**[Live Demo →](https://terms-and-conditions-translator1432d3.netlify.app/)**

---

## Overview

Legal and policy documents are notoriously difficult to read. PolicyLens solves this by combining client-side document parsing with AI-powered analysis to deliver structured, plain-English breakdowns — tailored to the reader's specific role and situation.

Users upload a PDF, DOCX, or plain text document, select who they are (individual, business owner, HR manager, etc.), and receive:

- **TL;DR** — A concise 2–4 sentence summary of the document
- **Key Points** — The most important rules and clauses, explained simply
- **Obligations** — What the user specifically must do, and by when
- **Role-Tailored Analysis** — Insights focused on what matters for their situation
- **Deadlines** — Every date and timeline extracted and highlighted
- **Action Items** — Concrete next steps
- **Jargon Glossary** — Legal and technical terms defined in plain English
- **Follow-up Q&A Chat** — Conversational interface to ask anything about the document

---

## Technical Architecture

The application is entirely client-rendered with a single serverless backend function acting as a secure API proxy.

```
Browser
  │
  ├── PDF.js / Mammoth.js     (document text extraction — runs locally, no uploads)
  │
  └── POST /.netlify/functions/gemini
          │
          └── Google Gemini API   (AI analysis — key stored server-side only)
```

Documents never leave the user's browser. Only the extracted text is forwarded to the serverless proxy, which holds the Gemini API key as an environment variable — keeping credentials completely off the client.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript (no build step, no dependencies) |
| AI | [Google Gemini API](https://ai.google.dev/gemini-api/docs) via `v1beta` endpoint |
| API Proxy | Netlify Serverless Function (Node.js) |
| PDF Parsing | [PDF.js](https://mozilla.github.io/pdf.js/) — browser-based |
| DOCX Parsing | [Mammoth.js](https://github.com/mwilliamson/mammoth.js) — browser-based |
| Hosting | [Netlify](https://netlify.com) |

---

## Project Structure

```
PolicyLens/
├── netlify/
│   └── functions/
│       └── gemini.js   # Serverless API proxy — validates requests, holds API key
├── index.html          # Application shell and UI
├── style.css           # Styles: dark mode, responsive grid, animations
├── app.js              # Core logic: file extraction, AI calls, rendering, chat
├── netlify.toml        # Netlify configuration
└── package.json        # Node.js metadata
```

---

## Running Locally

Requires the [Netlify CLI](https://docs.netlify.com/cli/get-started/) to run the serverless function locally alongside the frontend.

```bash
npm install -g netlify-cli
netlify login
netlify dev
```

Create a `.env` file in the project root (not committed):
```
GEMINI_API_KEY=your-key-here
```

Open `http://localhost:8888`. The function runs automatically.

---

## Deployment

The app is deployed to Netlify. To deploy your own instance:

1. Push the repo to GitHub
2. Connect the repo in the [Netlify dashboard](https://app.netlify.com) — no build command or publish directory needed
3. Add `GEMINI_API_KEY` as an environment variable under **Site configuration → Environment variables**
4. Trigger a redeploy to pick up the key

A free API key can be obtained from [Google AI Studio](https://aistudio.google.com/app/apikey).

---

## Privacy & Security

- The Gemini API key is stored exclusively as a Netlify environment variable — never in client code or version control
- Documents are parsed entirely in the visitor's browser and are never transmitted to or stored on any server
- The serverless proxy validates the request model and method before forwarding to Google
- No analytics, no tracking, no cookies

---

## Disclaimer

PolicyLens provides plain-English summaries for **informational purposes only**. This is **not legal advice**. Always consult a qualified professional before making decisions based on policy documents.

---

## License

MIT — free to use, modify, and distribute.
