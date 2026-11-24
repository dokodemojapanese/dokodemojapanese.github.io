/* Dokodemo — Myanmar translation pipeline (runs only in GitHub Actions).
   TASK=kanji : kanji.json entries without a Myanmar meaning  -> kmm.json   {"篆":"..."}
   TASK=dict  : ALL JMdict words (~210,000) that are not in dict.json -> dictx/NNN.json + dictx/index.json
                [word, reading, Myanmar, English, 0, 0, other spellings '取扱い・取り扱い']
   The app reads kmm.json / dictx/* by itself — no index.html upload needed when new data arrives.
   Needs the GitHub Secret GEMINI_API_KEY. Data: JMdict / KANJIDIC2 (EDRDG, CC BY-SA 4.0). */
const fs = require('fs'), { execSync } = require('child_process');
const KEY = process.env.GEMINI_API_KEY, TASK = process.env.TASK || 'kanji';
const BUDGET = (+process.env.MINUTES || 170) * 60e3, T0 = Date.now();
const GAP = +process.env.GAP_MS || 4500;          // pause between requests (free tier ≈ 15 per minute)
const SHARD = 5000;                                // dictionary words per dictx file
if (!KEY) { console.log('❌ GEMINI_API_KEY secret is missing'); process.exit(1); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const left = () => BUDGET - (Date.now() - T0);
const MY = /[က-႟]/;

let MODEL = process.env.MODEL || '';
async function pickModel() {
  if (MODEL) return MODEL;
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': KEY } });
  const j = await r.json();
  if (j.error) { console.log('❌ Gemini key problem:', j.error.status || '', (j.error.message || '').slice(0, 200)); process.exit(1); }
  const ms = (j.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map(m => m.name.replace('models/', ''))
    .filter(n => /^gemini-[\d.]+-flash(-\d+)?$/.test(n));
  const ver = n => parseFloat(n.split('-')[1]) || 0;
  ms.sort((a, b) => ver(b) - ver(a));
  console.log('flash models:', ms.join(', ') || '(none)');
  MODEL = ms[0] || 'gemini-flash-latest';
  return MODEL;
}

const SYS = `You translate Japanese dictionary entries into Myanmar (Burmese) for Myanmar learners of Japanese.
Rules: Myanmar Unicode only (never Zawgyi). Short dictionary style, 1–4 meanings separated by "၊ ".
Natural everyday Myanmar words. Do not add explanations, romanization or English.
Call the language မြန်မာ (never ဗမာ). Return ONLY a JSON array of strings, same order and same length as the input.`;

let quotaHits = 0, bad = 0; const tried = new Set();
async function ask(items) {            // items: [{w, r, en}]  -> array of Myanmar strings (or null)
  const prompt = 'Translate each entry. Input JSON:\n' + JSON.stringify(items.map(x => [x.w, x.r || '', x.en]));
  for (let t = 0; t < 4; t++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: SYS }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } })
    }).catch(e => ({ ok: false, status: 0, text: async () => String(e) }));
    if (res.status === 429) { quotaHits++; if (quotaHits >= 6) return 'QUOTA'; await sleep(65e3); continue; }
    if (!res.ok) {
      const t = await res.text(); console.log('HTTP', res.status, t.slice(0, 200));
      if (res.status === 404 || res.status === 400) {               // model retired → switch to the model Google suggests
        const m = /models\/(gemini-[\w.\-]+)/g; let x, nm = null; while ((x = m.exec(t))) if (x[1] !== MODEL) nm = x[1];
        if (nm && !tried.has(nm)) { tried.add(nm); console.log('➡️ switching model to', nm); MODEL = nm; continue; }
        if (++bad >= 3) { console.log('❌ model not usable — stopping'); process.exit(1); }
      }
      await sleep(15e3); continue; }
    quotaHits = 0; bad = 0;
    try {
      const j = await res.json(); const txt = j.candidates[0].content.parts.map(p => p.text).join('');
      const a = JSON.parse(txt.slice(txt.indexOf('['), txt.lastIndexOf(']') + 1));
      if (Array.isArray(a) && a.length === items.length) return a.map(s => (typeof s === 'string' && MY.test(s)) ? s.trim().replace(/\s*[,、]\s*/g, '၊ ') : null);
      console.log('length mismatch', a && a.length, items.length);
    } catch (e) { console.log('parse error', e.message); }
    await sleep(5e3);
  }
  return null;
}

function commit(msg) {
  try {
    execSync('git add -A kmm.json dictx 2>/dev/null || true', { stdio: 'inherit', shell: '/bin/bash' });
    execSync(`git diff --cached --quiet || (git commit -m "${msg}" && (git push || (git pull --rebase -X ours && git push)))`, { stdio: 'inherit', shell: '/bin/bash' });
  } catch (e) { console.log('commit failed', e.message); }
}

async function runKanji() {
  const kj = JSON.parse(fs.readFileSync('kanji.json', 'utf8'));
  const out = fs.existsSync('kmm.json') ? JSON.parse(fs.readFileSync('kmm.json', 'utf8')) : {};
  const todo = Object.keys(kj).filter(k => !kj[k][3] && !out[k] && kj[k][4]);
  console.log('kanji to translate:', todo.length);
  let n = 0, lastSave = Date.now();
  for (let i = 0; i < todo.length && left() > 60e3; i += 120) {
    const part = todo.slice(i, i + 120).map(k => ({ w: k, r: kj[k][1] || kj[k][2] || '', en: kj[k][4] }));
    const a = await ask(part); if (a === 'QUOTA') { console.log('daily quota reached'); break; }
    if (a) part.forEach((x, j) => { if (a[j]) { out[x.w] = a[j]; n++ } });
    fs.writeFileSync('kmm.json', JSON.stringify(out));
    if (Date.now() - lastSave > 10 * 60e3) { commit(`kmm.json: ${Object.keys(out).length} kanji`); lastSave = Date.now(); }
    await sleep(GAP);
  }
  console.log('translated this run:', n, 'total:', Object.keys(out).length);
  commit(`kmm.json: ${Object.keys(out).length} kanji (Myanmar meanings)`);
}

function jmdictFile() {
  if (fs.existsSync('/tmp/jm.json')) return '/tmp/jm.json';
  const rel = JSON.parse(execSync('curl -sL https://api.github.com/repos/scriptin/jmdict-simplified/releases/latest').toString());
  const as = rel.assets.find(a => /^jmdict-eng-\d.*\.json\.zip$/.test(a.name));
  if (!as) throw new Error('JMdict asset not found');
  execSync(`curl -sL -o /tmp/jm.zip "${as.browser_download_url}" && unzip -o -q /tmp/jm.zip -d /tmp/jm && mv /tmp/jm/*.json /tmp/jm.json`, { shell: '/bin/bash' });
  console.log('JMdict:', as.name);
  return '/tmp/jm.json';
}

async function runDict() {
  const have = new Set();
  JSON.parse(fs.readFileSync('dict.json', 'utf8')).d.forEach(w => have.add(w[0] + '|' + w[1]));
  fs.mkdirSync('dictx', { recursive: true });
  const IDX = 'dictx/index.json';
  const idx = fs.existsSync(IDX) ? JSON.parse(fs.readFileSync(IDX, 'utf8')) : { n: 0, count: 0 };
  for (let i = 0; i < idx.n; i++) { const f = `dictx/${String(i).padStart(3, '0')}.json`; if (fs.existsSync(f)) JSON.parse(fs.readFileSync(f, 'utf8')).forEach(w => have.add(w[0] + '|' + w[1])); }
  const jm = JSON.parse(fs.readFileSync(jmdictFile(), 'utf8'));
  const list = [];
  for (const e of jm.words) {
    const uk = (e.sense[0] && (e.sense[0].misc || []).includes('uk')) || !e.kanji.length;   // usually written in kana
    const r = (e.kana[0] || {}).text || '', w = uk ? r : (e.kanji[0] || {}).text;
    if (!w || have.has(w + '|' + r)) continue; have.add(w + '|' + r);
    const alt = [...new Set(e.kanji.map(x => x.text).concat(e.kana.map(x => x.text)))].filter(x => x !== w && x !== r).slice(0, 6).join('・');
    const en = e.sense.slice(0, 3).map(s => s.gloss.slice(0, 3).map(g => g.text).join(', ')).join('; ').slice(0, 160);
    if (!en) continue;
    const common = (e.kanji.concat(e.kana)).some(x => x.common);
    list.push({ w, r, en, alt, c: common ? 0 : 1 });
  }
  list.sort((a, b) => a.c - b.c);                     // common words first
  console.log('dictionary words left:', list.length);
  let cur = idx.n ? JSON.parse(fs.readFileSync(`dictx/${String(idx.n - 1).padStart(3, '0')}.json`, 'utf8')) : [];
  if (!idx.n || cur.length >= SHARD) { cur = []; idx.n++; }
  const save = () => { fs.writeFileSync(`dictx/${String(idx.n - 1).padStart(3, '0')}.json`, JSON.stringify(cur)); fs.writeFileSync(IDX, JSON.stringify(idx)); };
  let lastSave = Date.now();
  for (let i = 0; i < list.length && left() > 60e3; i += 100) {
    const part = list.slice(i, i + 100);
    const a = await ask(part); if (a === 'QUOTA') { console.log('daily quota reached'); break; }
    if (a) part.forEach((x, j) => {
      if (!a[j]) return; idx.count++;
      cur.push(x.alt ? [x.w, x.r, a[j], x.en, 0, 0, x.alt] : [x.w, x.r, a[j], x.en, 0, 0]);
      if (cur.length >= SHARD) { save(); cur = []; idx.n++; }
    });
    save();
    if (Date.now() - lastSave > 10 * 60e3) { commit(`dictx: ${idx.count} words`); lastSave = Date.now(); }
    await sleep(GAP);
  }
  save(); commit(`dictx: ${idx.count} words (Myanmar)`);
  console.log('total extra words:', idx.count);
}

(async () => {
  console.log('model:', await pickModel(), '· task:', TASK);
  if (!/^gemini/.test(MODEL)) { console.log('❌ no Gemini model found — check the GEMINI_API_KEY'); process.exit(1); }
  execSync('git config user.name "Dokodemo Bot" && git config user.email "actions@users.noreply.github.com"', { shell: '/bin/bash' });
  if (TASK === 'kanji' || TASK === 'all') await runKanji();
  if ((TASK === 'dict' || TASK === 'all') && left() > 5 * 60e3) await runDict();
})().catch(e => { console.log('❌', e); process.exit(1); });
