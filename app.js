/* =====================================================
   PolicyLens — app.js
   Core application logic:
     - PDF / DOCX / TXT text extraction
     - Google Gemini API via /.netlify/functions/gemini proxy (key stays on server)
     - Structured breakdown rendering
     - Follow-up Q&A chat
   ===================================================== */

'use strict';

// =====================================================
// STATE
// =====================================================
const state = {
  model:       'gemini-3.1-flash-lite-preview',
  role:        'individual',
  rawText:     '',
  fileName:    '',
  fileSize:    0,
  breakdown:   null,
  chatHistory: [],   // [{role, content}]
  isAnalyzing: false,
  isChatting:  false,
};

// =====================================================
// DOM HELPERS
// =====================================================
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function show(el)  { el && el.classList.remove('hidden'); }
function hide(el)  { el && el.classList.add('hidden'); }

function showError(msg) {
  $('#errorMsg').textContent = msg;
  show($('#errorToast'));
  setTimeout(() => hide($('#errorToast')), 6000);
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// =====================================================
// SETTINGS (model only — API key lives on the server)
// =====================================================
function loadSettings() {
  const savedModel = localStorage.getItem('pl_model');
  if (savedModel && $('#modelSelect')) {
    state.model = savedModel;
    $('#modelSelect').value = savedModel;
  }
}

function saveSettings() {
  const model = $('#modelSelect').value;
  state.model = model;
  localStorage.setItem('pl_model', model);
  hide($('#settingsModal'));
}

// =====================================================
// THEME
// =====================================================
function initTheme() {
  const pref = localStorage.getItem('pl_theme') || 'light';
  applyTheme(pref);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  $('#themeToggle').textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('pl_theme', theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

// =====================================================
// FILE EXTRACTION
// =====================================================

// PDF via PDF.js
async function extractPdf(file) {
  const arrayBuffer = await file.arrayBuffer();
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const pdf   = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let   text  = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page    = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str).join(' ') + '\n\n';
  }
  return text.trim();
}

// DOCX via mammoth (loaded dynamically)
async function extractDocx(file) {
  // Load mammoth.js dynamically if not already present
  if (!window.mammoth) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
      s.onload = resolve;
      s.onerror = () => reject(new Error('Failed to load DOCX parser.'));
      document.head.appendChild(s);
    });
  }
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value.trim();
}

// Plain text
async function extractText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = (e) => resolve(e.target.result.trim());
    reader.onerror = () => reject(new Error('Could not read text file.'));
    reader.readAsText(file);
  });
}

async function extractFileText(file) {
  const name = file.name.toLowerCase();
  if      (name.endsWith('.pdf'))  return extractPdf(file);
  else if (name.endsWith('.docx')) return extractDocx(file);
  else if (name.endsWith('.txt') || name.endsWith('.text')) return extractText(file);
  else throw new Error('Unsupported file type. Please upload a PDF, DOCX, or TXT file.');
}

// =====================================================
// FILE UPLOAD UI
// =====================================================
function setupDropzone() {
  const dropzone  = $('#dropzone');
  const fileInput = $('#fileInput');

  // Click on zone → open picker (but not if clicking "Remove file")
  dropzone.addEventListener('click', (e) => {
    if (e.target.id === 'removeFile' || e.target.closest('#removeFile')) return;
    if (e.target.id === 'fileInput') return;
    fileInput.click();
  });

  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
  });

  // Drag & drop
  dropzone.addEventListener('dragover',  (e) => { e.preventDefault(); dropzone.classList.add('drag-over'); });
  dropzone.addEventListener('dragleave', ()  => dropzone.classList.remove('drag-over'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });

  $('#removeFile')?.addEventListener('click', (e) => {
    e.stopPropagation();
    clearFile();
  });
}

async function handleFile(file) {
  const maxBytes = 10 * 1024 * 1024;
  if (file.size > maxBytes) { showError('File is too large. Maximum size is 10MB.'); return; }

  const name = file.name.toLowerCase();
  if (!name.endsWith('.pdf') && !name.endsWith('.docx') && !name.endsWith('.txt') && !name.endsWith('.text')) {
    showError('Unsupported file type. Please upload a PDF, DOCX, or TXT.');
    return;
  }

  // Show loading state
  hide($('#dropzoneIdle'));
  const loadedDiv = $('#dropzoneLoaded');
  show(loadedDiv);
  $('#filePreview').innerHTML = `
    <span class="file-preview-icon">⏳</span>
    <div>
      <div class="file-preview-name">Extracting text…</div>
      <div class="file-preview-size">${formatBytes(file.size)}</div>
    </div>
  `;
  hide($('#extractedPreview'));

  try {
    const text = await extractFileText(file);
    if (!text || text.length < 50) {
      throw new Error('Could not extract meaningful text from this file. Is the PDF scanned/image-based?');
    }

    state.rawText  = text;
    state.fileName = file.name;
    state.fileSize = file.size;

    const icon = name.endsWith('.pdf') ? '📕' : name.endsWith('.docx') ? '📘' : '📄';
    $('#filePreview').innerHTML = `
      <span class="file-preview-icon">${icon}</span>
      <div>
        <div class="file-preview-name">${file.name}</div>
        <div class="file-preview-size">${formatBytes(file.size)} · ${text.length.toLocaleString()} characters extracted</div>
      </div>
    `;

    // Show text preview
    const preview = $('#extractedPreview');
    show(preview);
    $('#charCount').textContent = `${text.length.toLocaleString()} chars`;
    $('#extractedText').textContent = text.substring(0, 800) + (text.length > 800 ? '\n\n[… preview truncated]' : '');

  } catch (err) {
    showError(err.message || 'Failed to read file.');
    clearFile();
    return;
  }

  updateAnalyzeButton();
}

function clearFile() {
  state.rawText  = '';
  state.fileName = '';
  state.fileSize = 0;
  hide($('#dropzoneLoaded'));
  show($('#dropzoneIdle'));
  hide($('#extractedPreview'));
  $('#fileInput').value = '';
  updateAnalyzeButton();
}

// =====================================================
// ANALYZE BUTTON STATE
// =====================================================
function updateAnalyzeButton() {
  const btn     = $('#analyzeBtn');
  const hint    = $('#analyzeHint');
  const hasRole = !!state.role;
  const hasDoc  = !!state.rawText;

  if (!hasRole && !hasDoc) {
    btn.disabled = true;
    hint.textContent = 'Select a role and upload a document to begin.';
  } else if (!hasRole) {
    btn.disabled = true;
    hint.textContent = 'Select your role above to continue.';
  } else if (!hasDoc) {
    btn.disabled = true;
    hint.textContent = 'Upload a document above to continue.';
  } else {
    btn.disabled = false;
    hint.textContent = 'Ready! Click to analyze your document.';
  }
}

// =====================================================
// GEMINI API CALL — via /.netlify/functions/gemini proxy
// =====================================================
// The browser never touches the Gemini API directly.
// All requests go to our Vercel serverless function,
// which holds the API key securely as an env variable.

async function callGemini(messages, systemPrompt, { jsonMode = false } = {}) {
  const response = await fetch('/.netlify/functions/gemini', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model:        state.model,
      messages,     // already in Gemini's {role, parts} format
      systemPrompt,
      jsonMode,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    // Gemini nests its message inside err.error.message — unwrap it safely
    const msg = err?.error?.message || (typeof err?.error === 'string' ? err.error : '') || err?.message || '';
    if (response.status === 400) throw new Error(`Bad request: ${msg || 'check that the API key has no restrictions.'}`);
    if (response.status === 403) throw new Error('API key permission denied (403). In Google AI Studio, open your API key and make sure it has no API restrictions, or delete it and create a fresh one.');
    if (response.status === 429) throw new Error('Rate limit reached — please wait a moment and try again.');
    if (response.status === 500) throw new Error('Server configuration error. The API key may not be set up yet.');
    if (response.status === 503) throw new Error('Gemini API is temporarily unavailable. Please try again.');
    throw new Error(msg || `Request failed (${response.status}). Please try again.`);
  }

  const data = await response.json();

  // Handle Gemini safety blocks
  if (data.promptFeedback?.blockReason) {
    throw new Error(`Blocked by safety filters: ${data.promptFeedback.blockReason}. Try a different document.`);
  }

  const candidate = data.candidates?.[0];
  if (!candidate) throw new Error('Empty response from Gemini. Please try again.');
  if (candidate.finishReason === 'SAFETY') throw new Error('Response blocked by safety filters. Please try a different document.');

  return candidate.content.parts[0].text;
}

// =====================================================
// SYSTEM PROMPT
// =====================================================
const ROLE_LABELS = {
  individual:    'Individual / Employee',
  small_business:'Small Business Owner',
  hr_manager:    'HR / Compliance Manager',
  student:       'Student / Researcher',
  developer:     'Developer / Technical',
  general:       'General Reader',
};

function buildSystemPrompt() {
  return `You are PolicyLens, an expert legal document analyst. You specialize in translating dense, jargon-heavy policy documents (tax regulations, GDPR, HIPAA, employment law, contracts, etc.) into clear, plain-English explanations structured for specific audiences.

Your audience for this session: ${ROLE_LABELS[state.role] || 'General Reader'}

Your job is to:
1. Identify the document type and subject matter
2. Assess the compliance/action risk level (low, medium, high)
3. Provide a structured breakdown in JSON format

IMPORTANT RULES:
- Never provide legal advice. Frame everything as informational.
- Use plain English — explain jargon in parentheses or the glossary.
- Be specific about deadlines, thresholds, and amounts when mentioned.
- Tailor the "audience_specific" section directly to the user's role.
- If a section has no relevant content (e.g., no deadlines found), use an empty array or "N/A".
- Dates in deadlines should be extracted exactly as they appear in the document. If no dates are found, say "No specific dates mentioned."`;
}

function buildAnalysisPrompt(text) {
  // Truncate to ~80k chars to stay within context limits
  const truncated = text.length > 80000
    ? text.substring(0, 80000) + '\n\n[Document truncated due to length — first 80,000 characters analyzed]'
    : text;

  return `Please analyze the following policy document and return a JSON object with this exact structure:

{
  "document_type": "string — e.g. 'GDPR Data Processing Agreement', 'IRS Tax Regulation', 'Employment Contract'",
  "risk_level": "low | medium | high",
  "tldr": "2-4 sentence plain-English summary of the entire document",
  "affects": ["who this applies to — list each group affected"],
  "key_points": [
    { "point": "Brief headline", "plain_english": "What it means in plain language" }
  ],
  "obligations": [
    { "who": "who must act", "must_do": "plain-English description of what they must do", "by_when": "deadline or 'Ongoing'" }
  ],
  "deadlines": [
    { "date": "the specific date or period", "description": "what must happen by this date" }
  ],
  "action_items": ["Specific, actionable step in plain English"],
  "glossary": [
    { "term": "Technical/legal term", "definition": "Plain-English definition" }
  ],
  "audience_specific": "2-3 sentence paragraph specifically about what this means for a ${ROLE_LABELS[state.role] || 'general reader'}. Be practical and specific."
}

Return ONLY valid JSON. No markdown, no backticks, no explanation outside the JSON.

DOCUMENT TO ANALYZE:
---
${truncated}
---`;
}

// =====================================================
// RENDER BREAKDOWN
// =====================================================
function renderBreakdown(data) {
  state.breakdown = data;

  // Risk badge
  const riskRow = $('#riskBadgeRow');
  show(riskRow);
  const riskBadge = $('#riskBadge');
  const riskLabels = { low: '🟢 Low Risk', medium: '🟡 Medium Risk', high: '🔴 High Risk' };
  riskBadge.textContent = riskLabels[data.risk_level] || data.risk_level;
  riskBadge.className = `risk-badge ${data.risk_level}`;
  $('#documentType').textContent = data.document_type || '';

  // Meta
  const roleLabel = ROLE_LABELS[state.role] || 'General';
  $('#resultsMeta').textContent = `${state.fileName} · Tailored for: ${roleLabel}`;

  // TL;DR
  $('#tldrBody').textContent = data.tldr || '—';

  // Key Points
  const kpList = $('#keyPointsList');
  kpList.innerHTML = '';
  (data.key_points || []).forEach(kp => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${escHtml(kp.point)}</strong> — ${escHtml(kp.plain_english)}`;
    kpList.appendChild(li);
  });

  // Obligations
  const obList = $('#obligationsList');
  obList.innerHTML = '';
  (data.obligations || []).forEach(ob => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${escHtml(ob.who)}</strong> must ${escHtml(ob.must_do)}${ob.by_when ? ` <em>(${escHtml(ob.by_when)})</em>` : ''}`;
    obList.appendChild(li);
  });
  if (!data.obligations || data.obligations.length === 0) {
    obList.innerHTML = '<li>No specific obligations identified.</li>';
  }

  // Audience specific
  $('#audienceBody').textContent = data.audience_specific || '—';

  // Deadlines
  const dlList = $('#deadlinesList');
  dlList.innerHTML = '';
  if (data.deadlines && data.deadlines.length > 0) {
    data.deadlines.forEach(dl => {
      const li = document.createElement('li');
      li.style.listStyle = 'none';
      li.innerHTML = `
        <div class="deadline-item">
          <span class="deadline-date">📅 ${escHtml(dl.date)}</span>
          <span class="deadline-desc">${escHtml(dl.description)}</span>
        </div>`;
      dlList.appendChild(li);
    });
  } else {
    dlList.innerHTML = '<li class="no-deadlines">✅ No specific deadlines found in this document.</li>';
  }

  // Action Items
  const aiList = $('#actionItemsList');
  aiList.innerHTML = '';
  (data.action_items || []).forEach(item => {
    const li = document.createElement('li');
    li.textContent = item;
    aiList.appendChild(li);
  });
  if (!data.action_items || data.action_items.length === 0) {
    aiList.innerHTML = '<li>No specific action items identified.</li>';
  }

  // Glossary
  const glossGrid = $('#glossaryGrid');
  glossGrid.innerHTML = '';
  if (data.glossary && data.glossary.length > 0) {
    data.glossary.forEach(entry => {
      const div = document.createElement('div');
      div.className = 'glossary-item';
      div.innerHTML = `
        <div class="glossary-term">${escHtml(entry.term)}</div>
        <div class="glossary-def">${escHtml(entry.definition)}</div>
      `;
      glossGrid.appendChild(div);
    });
  } else {
    glossGrid.innerHTML = '<p style="font-size:0.875rem;color:var(--text-muted)">No technical terms identified.</p>';
  }
}

// =====================================================
// ANALYZE
// =====================================================
async function analyzeDocument() {
  if (state.isAnalyzing) return;
  if (!state.role)    { showError('Please select your role first.'); return; }
  if (!state.rawText) { showError('Please upload a document first.'); return; }

  state.isAnalyzing = true;

  // UI: show spinner
  hide($('#analyzeBtnText'));
  show($('#analyzeSpinner'));
  $('#analyzeBtn').disabled = true;

  // Hide results section if visible
  hide($('#resultsSection'));

  try {
    const systemPrompt = buildSystemPrompt();
    const userPrompt   = buildAnalysisPrompt(state.rawText);

    // Use JSON mode for the initial analysis — Gemini returns clean JSON directly
    const rawResponse = await callGemini(
      [{ role: 'user', parts: [{ text: userPrompt }] }],
      systemPrompt,
      { jsonMode: true }
    );

    // Parse JSON (jsonMode means no fences, but strip them defensively)
    let data;
    try {
      const cleaned = rawResponse.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      data = JSON.parse(cleaned);
    } catch {
      throw new Error('The AI returned an unexpected format. Please try again.');
    }

    // Render breakdown
    renderBreakdown(data);

    // Seed chat history with the document context in Gemini's format.
    state.chatHistory = [
      { role: 'user',  parts: [{ text: userPrompt  }] },
      { role: 'model', parts: [{ text: rawResponse }] },
    ];

    // Show results & scroll
    show($('#resultsSection'));
    document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });

  } catch (err) {
    showError(err.message || 'Analysis failed. Please check your API key and try again.');
  } finally {
    state.isAnalyzing = false;
    hide($('#analyzeSpinner'));
    show($('#analyzeBtnText'));
    $('#analyzeBtn').disabled = false;
    updateAnalyzeButton();
  }
}

// =====================================================
// CHAT
// =====================================================
function addChatMessage(role, content) {
  const msgs = $('#chatMessages');
  const div  = document.createElement('div');
  div.className = `chat-message ${role === 'user' ? 'user-message' : 'assistant-message'}`;

  const avatarText = role === 'user' ? '👤' : '🔍';
  div.innerHTML = `
    <div class="message-avatar">${avatarText}</div>
    <div class="message-bubble">${escHtml(content).replace(/\n/g, '<br>')}</div>
  `;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function addTypingIndicator() {
  const msgs = $('#chatMessages');
  const div  = document.createElement('div');
  div.className = 'chat-message assistant-message';
  div.id = 'typingIndicator';
  div.innerHTML = `
    <div class="message-avatar">🔍</div>
    <div class="message-bubble">
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>
  `;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function removeTypingIndicator() {
  $('#typingIndicator')?.remove();
}

async function sendChatMessage() {
  if (state.isChatting) return;
  const input   = $('#chatInput');
  const message = input.value.trim();
  if (!message) return;

  input.value = '';
  input.disabled = true;
  $('#sendChatBtn').disabled = true;
  state.isChatting = true;

  addChatMessage('user', message);
  addTypingIndicator();

  // Append to history in Gemini's {role, parts} format
  state.chatHistory.push({ role: 'user', parts: [{ text: message }] });

  const chatSystemPrompt = `${buildSystemPrompt()}

You are now in follow-up Q&A mode. The user has already received a structured breakdown of the document. Answer their questions conversationally and helpfully. Be specific, cite relevant parts of the document when useful, and always clarify when something requires professional legal or financial advice. Keep answers focused and under 300 words unless detail is truly needed.`;

  try {
    const reply = await callGemini(state.chatHistory, chatSystemPrompt);
    removeTypingIndicator();
    addChatMessage('assistant', reply);
    // Store AI reply in Gemini's format
    state.chatHistory.push({ role: 'model', parts: [{ text: reply }] });
  } catch (err) {
    removeTypingIndicator();
    addChatMessage('assistant', `❌ Error: ${err.message}`);
  } finally {
    state.isChatting = false;
    input.disabled  = false;
    $('#sendChatBtn').disabled = false;
    input.focus();
  }
}

// =====================================================
// COPY RESULTS
// =====================================================
function copyResults() {
  if (!state.breakdown) return;
  const d = state.breakdown;
  const roleLabel = ROLE_LABELS[state.role] || 'General';

  let text = `POLICYLENS BREAKDOWN\n`;
  text += `Document: ${state.fileName}\n`;
  text += `Audience: ${roleLabel}\n`;
  text += `Risk Level: ${d.risk_level?.toUpperCase()}\n`;
  text += `Document Type: ${d.document_type}\n\n`;
  text += `TL;DR\n${d.tldr}\n\n`;
  text += `KEY POINTS\n${(d.key_points || []).map(k => `• ${k.point}: ${k.plain_english}`).join('\n')}\n\n`;
  text += `OBLIGATIONS\n${(d.obligations || []).map(o => `• ${o.who}: ${o.must_do} (${o.by_when})`).join('\n')}\n\n`;
  text += `WHAT THIS MEANS FOR YOU\n${d.audience_specific}\n\n`;
  text += `ACTION ITEMS\n${(d.action_items || []).map(a => `→ ${a}`).join('\n')}\n\n`;
  if (d.deadlines?.length) {
    text += `DEADLINES\n${d.deadlines.map(dl => `• ${dl.date}: ${dl.description}`).join('\n')}\n\n`;
  }
  text += `GLOSSARY\n${(d.glossary || []).map(g => `• ${g.term}: ${g.definition}`).join('\n')}\n`;
  text += `\n—\nGenerated by PolicyLens. Not legal advice.`;

  navigator.clipboard.writeText(text)
    .then(() => {
      const btn = $('#copyResultsBtn');
      btn.textContent = '✅ Copied!';
      setTimeout(() => { btn.textContent = '📋 Copy'; }, 2000);
    })
    .catch(() => showError('Could not copy to clipboard.'));
}

// =====================================================
// RESET
// =====================================================
function resetApp() {
  state.rawText     = '';
  state.fileName    = '';
  state.fileSize    = 0;
  state.breakdown   = null;
  state.chatHistory = [];
  state.role        = 'individual';

  // Reset role selection — default back to Individual/Employee
  $$('input[name="role"]').forEach(r => { r.checked = r.value === 'individual'; });

  // Reset dropzone
  clearFile();

  // Reset chat
  $('#chatMessages').innerHTML = `
    <div class="chat-message assistant-message">
      <div class="message-avatar">🔍</div>
      <div class="message-bubble">
        I've analyzed your document. Feel free to ask me anything about it — specific clauses, what they mean for you, deadlines, exceptions, or anything else you're wondering about.
      </div>
    </div>
  `;

  hide($('#resultsSection'));
  updateAnalyzeButton();
  document.getElementById('upload-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// =====================================================
// EXAMPLE POLICY DOCUMENT
// =====================================================
const EXAMPLE_POLICY = `ACME TECHNOLOGIES INC.
EMPLOYEE DATA & REMOTE WORK POLICY
Version 2.1 — Effective Date: January 1, 2025
Last Reviewed: October 15, 2024

1. PURPOSE AND SCOPE

This Policy governs the collection, processing, and protection of personal data by Acme Technologies Inc. ("the Company") and establishes standards for employees working remotely. It applies to all full-time employees, part-time employees, contractors, and third-party vendors who access Company systems or handle personal data on behalf of the Company.

This Policy is issued in compliance with the General Data Protection Regulation (EU) 2016/679 ("GDPR"), the California Consumer Privacy Act ("CCPA"), and applicable federal employment law.

2. DATA CLASSIFICATION AND HANDLING

2.1 Personal Data
"Personal data" means any information relating to an identified or identifiable natural person (a "data subject"). This includes, but is not limited to: names, email addresses, national identification numbers, location data, IP addresses, and any data that could be used to identify an individual directly or indirectly.

2.2 Sensitive Personal Data
Employees may not collect or process special categories of data — including health records, biometric data, religious beliefs, or political opinions — without explicit written authorization from the Data Protection Officer ("DPO") and documented consent from the data subject.

2.3 Data Minimization
Employees must collect only the minimum personal data necessary for the stated business purpose (the principle of data minimization). Collecting data "just in case" is a violation of this Policy and may constitute a breach of GDPR Article 5.

3. EMPLOYEE OBLIGATIONS

3.1 Training
All employees with access to personal data must complete the Company's annual Data Privacy Training by March 31 of each calendar year. New hires must complete this training within 30 days of their start date. Failure to complete training by the deadline will result in suspension of system access until compliance is confirmed.

3.2 Device Security
Employees working remotely must ensure that:
(a) All Company devices are protected with a password or biometric lock.
(b) Full-disk encryption is enabled on laptops (FileVault on macOS; BitLocker on Windows).
(c) Automatic screen lock activates after no more than 5 minutes of inactivity.
(d) Public Wi-Fi networks are never used to access Company systems without an active VPN connection.

3.3 Incident Reporting
Any suspected or confirmed data breach — including lost devices, unauthorized access, or accidental disclosure — must be reported to the DPO within 24 hours of discovery. The DPO is required by law to notify the relevant supervisory authority within 72 hours of becoming aware of a breach affecting the rights and freedoms of data subjects (GDPR Article 33). Employees who fail to report an incident promptly may be subject to disciplinary action, up to and including termination.

4. REMOTE WORK STANDARDS

4.1 Eligible Roles
Remote work is permitted for roles designated as "remote-eligible" in the employee's contract. Employees wishing to change their work location permanently must submit a Remote Work Amendment Request at least 60 days in advance. Requests are subject to managerial and HR approval.

4.2 Home Office Requirements
Employees are responsible for maintaining a safe and productive home work environment. The Company will reimburse up to $500 per calendar year for qualifying home office expenses (ergonomic equipment, monitors, internet upgrades). Reimbursement claims must be submitted via the expense portal by December 15 of the applicable year. Claims submitted after this date will not be processed.

4.3 Core Hours
Remote employees must be available and responsive during core hours of 10:00 AM – 3:00 PM in their designated time zone, Monday through Friday, excluding public holidays.

5. DATA RETENTION AND DELETION

Personal data collected in the course of employment will be retained for no longer than 7 years after the termination of the employment relationship, unless a longer retention period is required by law. Upon request, employees may ask the DPO for a copy of their personal data held by the Company (Subject Access Request). The Company will respond to such requests within 30 days.

6. CONSEQUENCES OF NON-COMPLIANCE

Violations of this Policy may result in disciplinary action proportionate to the severity of the breach, up to and including termination of employment. In cases involving willful misuse of personal data, the Company reserves the right to pursue civil or criminal remedies as permitted by applicable law. Regulatory fines under GDPR can reach €20 million or 4% of annual global turnover, whichever is higher.

7. POLICY REVIEW

This Policy will be reviewed annually by the Legal and HR departments. Employees will be notified of material changes by email at least 14 days before the effective date of any revision. Continued employment following notification constitutes acceptance of the updated Policy.

For questions, contact: privacy@acmetech.example.com
Data Protection Officer: compliance@acmetech.example.com`;

function loadExample() {
  state.rawText  = EXAMPLE_POLICY;
  state.fileName = 'Acme_Employee_Data_Remote_Work_Policy.txt';
  state.fileSize = new Blob([EXAMPLE_POLICY]).size;

  // Show the loaded state in the dropzone
  hide($('#dropzoneIdle'));
  show($('#dropzoneLoaded'));
  $('#filePreview').innerHTML = `
    <span class="file-preview-icon">📄</span>
    <div>
      <div class="file-preview-name">${state.fileName}</div>
      <div class="file-preview-size">${formatBytes(state.fileSize)} · ${EXAMPLE_POLICY.length.toLocaleString()} characters · Example document</div>
    </div>
  `;

  // Show text preview
  show($('#extractedPreview'));
  $('#charCount').textContent = `${EXAMPLE_POLICY.length.toLocaleString()} chars`;
  $('#extractedText').textContent = EXAMPLE_POLICY.substring(0, 800) + '\n\n[… preview truncated]';

  updateAnalyzeButton();

  // Scroll smoothly to the analyze button
  $('#analyzeBtn').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// =====================================================
// XSS HELPER
// =====================================================
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// =====================================================
// EVENT LISTENERS
// =====================================================
function initEventListeners() {
  // Settings modal
  $('#settingsBtn').addEventListener('click', () => show($('#settingsModal')));
  $('#closeSettings').addEventListener('click', () => hide($('#settingsModal')));
  $('#settingsModal').addEventListener('click', (e) => {
    if (e.target === $('#settingsModal')) hide($('#settingsModal'));
  });
  $('#saveSettings').addEventListener('click', saveSettings);

  // Theme toggle
  $('#themeToggle').addEventListener('click', toggleTheme);

  // Role selection
  $$('input[name="role"]').forEach(radio => {
    radio.addEventListener('change', () => {
      state.role = radio.value;
      updateAnalyzeButton();
    });
  });

  // Analyze
  $('#analyzeBtn').addEventListener('click', analyzeDocument);

  // Copy & Reset
  $('#copyResultsBtn').addEventListener('click', copyResults);
  $('#resetBtn').addEventListener('click', resetApp);

  // Chat
  $('#sendChatBtn').addEventListener('click', sendChatMessage);
  $('#chatInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });

  // Example document
  $('#loadExampleBtn')?.addEventListener('click', loadExample);

  // Error toast dismiss
  $('#closeError').addEventListener('click', () => hide($('#errorToast')));
}

// =====================================================
// INIT
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadSettings();
  setupDropzone();
  initEventListeners();
  updateAnalyzeButton();
});
