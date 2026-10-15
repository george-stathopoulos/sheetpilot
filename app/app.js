(() => {
'use strict';
const KEY = 'sheetpilot.v1';
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => Math.random().toString(36).slice(2, 10);

/* ---------- state ---------- */
let state = { sheets: [], current: null };
const freshUI = tab => ({ tab: tab || 'dash', sort: null, q: '', sf: '', drawer: null, f: {}, dim: '', measure: '', agg: '' });
let ui = freshUI();
try { state = JSON.parse(localStorage.getItem(KEY)) || state; } catch (e) {}
const save = () => { if (shared) return; try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} };
let shared = null; // a dashboard opened from a share link (kept in memory only)
const sheet = () => shared || state.sheets.find(s => s.id === state.current);
const BRAND = 'SheetPilot';
const HOME = 'https://george-stathopoulos.github.io/';
const PROJECTS = [['Gatehouse', HOME + 'gatehouse/'], ['Helpdesk Hero', HOME + 'helpdesk-hero/'], ['Fixpass', HOME + 'fixpass/']];
const THEMES = [
  { id: 'clean', name: 'Clean', hint: 'General business, follows your light/dark setting', c: ['#f6f7f9', '#2f6bff'] },
  { id: 'midnight', name: 'Midnight', hint: 'Tech, engineering, SaaS', c: ['#0e1117', '#58a6ff'] },
  { id: 'corporate', name: 'Corporate', hint: 'Finance, consulting, enterprise', c: ['#eef1f5', '#1f3a68'] },
  { id: 'forest', name: 'Forest', hint: 'Health, sustainability, agriculture', c: ['#f2f6f1', '#2e7d4f'] },
  { id: 'sunset', name: 'Sunset', hint: 'Retail, hospitality, marketing', c: ['#fff7f0', '#e8590c'] },
  { id: 'ocean', name: 'Ocean', hint: 'Logistics, travel, utilities', c: ['#eef7fa', '#0b7f9c'] },
  { id: 'violet', name: 'Violet', hint: 'Agencies, creative, media', c: ['#f6f3ff', '#6d3df5'] },
  { id: 'mono', name: 'Mono', hint: 'Legal, editorial, print-friendly', c: ['#ffffff', '#111111'] },
  { id: 'rose', name: 'Rose', hint: 'Beauty, lifestyle, non-profit', c: ['#fff5f7', '#d6336c'] },
  { id: 'paper', name: 'Paper', hint: 'Education, publishing, HR', c: ['#f5efe3', '#8a5a2b'] }
];
const curTheme = () => { const t = (sheet() || {}).theme || state.theme || 'clean'; return THEMES.some(x => x.id === t) ? t : 'clean'; };
const creditsInner = () => `<div>${esc(BRAND)} dashboards · Made by <a href="${HOME}" target="_blank" rel="noopener">George Stathopoulos</a> — CV, projects and contact at <a href="${HOME}" target="_blank" rel="noopener">george-stathopoulos.github.io</a></div><div class="sub">Projects: ${PROJECTS.map(([n, u]) => `<a href="${u}" target="_blank" rel="noopener">${n}</a>`).join(' · ')} · Your data stays in your browser; nothing is uploaded.</div>`;
const isNumT = t => t === 'number' || t === 'money' || t === 'percent';

/* ---------- dates & numbers ---------- */
const pad = n => String(n).padStart(2, '0');
const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayISO = () => isoOf(new Date());
const toUTC = iso => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const addDays = (iso, n) => new Date(toUTC(iso) + n * 864e5).toISOString().slice(0, 10);
const diffDays = (a, b) => Math.round((toUTC(b) - toUTC(a)) / 864e5); // b - a
function valid(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? `${y}-${pad(m)}-${pad(d)}` : null;
}
// order: 'dmy' | 'mdy' | undefined (undefined: dots mean day-first, slashes month-first)
function parseDate(v, order) {
  if (v instanceof Date) return isNaN(v) ? null : isoOf(v);
  const s = String(v ?? '').trim();
  let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/))) return valid(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{1,2})([\/.\-])(\d{1,2})\2(\d{2,4})$/))) {
    const a = +m[1], b = +m[3]; let y = +m[4]; if (y < 100) y += 2000;
    const dmy = a > 12 ? true : b > 12 ? false : order ? order === 'dmy' : m[2] === '.' || localeDMY;
    return dmy ? valid(y, b, a) : valid(y, a, b);
  }
  return null;
}
const localeDMY = (() => { try { const p = new Intl.DateTimeFormat(navigator.language).formatToParts(new Date(2001, 10, 25)).map(x => x.type); return p.indexOf('day') < p.indexOf('month'); } catch (e) { return false; } })();
function dateOrder(vals) {
  let dots = 0, others = 0;
  for (const v of vals) { const m = String(v).trim().match(/^(\d{1,2})([\/.\-])(\d{1,2})\2\d{2,4}$/); if (m) { if (+m[1] > 12) return 'dmy'; if (+m[3] > 12) return 'mdy'; m[2] === '.' ? dots++ : others++; } }
  return dots > others ? 'dmy' : undefined; // a column written with dots is day-first throughout
}
function num(v) {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').replace(/[^\d.,\-]/g, '');
  if (!s || s === '-') return null;
  const n = parseFloat(s.includes(',') && s.includes('.') ? s.replace(/,/g, '') : s.replace(/,(?=\d{3}\b)/g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
}
const fmtNum = n => n == null || !isFinite(n) ? '' : new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);
const fmtVal = (c, v) => v == null ? '–' : fmtNum(v) + (c && c.type === 'percent' ? '%' : '');

/* ---------- parsing ---------- */
function parseTable(text, keepBlank) {
  text = text.replace(/^﻿/, '');
  const first = text.split(/\r?\n/).find(l => l.trim()) || '';
  const delim = [['\t', first.split('\t').length], [';', first.split(';').length], [',', first.split(',').length]].sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"' && !cur) q = true;
    else if (c === delim) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  if (keepBlank) return rows;
  return rows.filter(r => r.some(c => c.trim() !== ''));
}

/* ---------- matrix layouts (price lists, side-by-side blocks) -> records ---------- */
function unpivot(raw) {
  const W = Math.max(0, ...raw.map(r => r.length)), g = (r, c) => (raw[r][c] ?? '').trim();
  const isNum = v => v !== '' && /^[\s$€£]*-?[\d.,]+\s*%?$/.test(v);
  const emptyCol = c => raw.every((_, r) => g(r, c) === '');
  const bands = []; let start = null;
  for (let c = 0; c <= W; c++) { const e = c === W || emptyCol(c); if (!e && start === null) start = c; if (e && start !== null) { bands.push([start, c - 1]); start = null; } }
  if (bands.length < 2) return null;
  const out = [['Block', 'Section', 'Item', 'Currency', 'Plan', 'Value', 'Unit']];
  for (const [c0, c1] of bands) {
    const cols = r => { const a = []; for (let c = c0; c <= c1; c++) if (g(r, c) !== '') a.push(c); return a; };
    const r0 = raw.findIndex((_, r) => cols(r).length);
    if (r0 < 0) continue;
    let block = g(r0, cols(r0)[0]);
    if (raw[r0 + 1] && cols(r0 + 1)[0] === cols(r0)[0]) block += ' – ' + g(r0 + 1, cols(r0 + 1)[0]);
    let section = '';
    for (let r = r0 + 1; r < raw.length; r++) {
      const cs = cols(r);
      if (cs.length === 1 && !isNum(g(r, cs[0]))) { section = g(r, cs[0]); continue; }
      if (cs.length < 4 || cs.some(c => isNum(g(r, c)))) continue;
      let nxt = r + 1; while (nxt < raw.length && nxt <= r + 3 && !cols(nxt).length) nxt++;
      if (!raw[nxt] || cols(nxt).filter(c => isNum(g(nxt, c))).length < 3) continue;
      const hasCur = g(r, cs[0]).toLowerCase() === 'currency', plans = hasCur ? cs.slice(1) : cs, labelCol = cs[0] - 1;
      let started = false, rr = r + 1;
      for (; rr < raw.length; rr++) {
        if (!cols(rr).length) { if (started) break; continue; }
        if (!plans.some(c => isNum(g(rr, c)))) break;
        started = true;
        const cur = hasCur ? g(rr, cs[0]) : '', label = labelCol >= c0 ? g(rr, labelCol) : '';
        for (const pc of plans) { const v = g(rr, pc); if (v !== '') out.push([block, section, label, cur, g(r, pc), String(num(v)), v.includes('%') ? '%' : cur]); }
      }
      r = rr - 1;
    }
  }
  return out.length > 1 ? out : null;
}

/* ---------- column type inference ---------- */
const DONE_RE = /^(won|lost|closed|done|paid|complete[d]?|resolved|inactive|left|terminated|cancel+ed|archived|rejected|resigned|churned|expired|delivered)$/i;
function inferType(name, vals) {
  const v = vals.map(x => String(x).trim()).filter(x => x !== '');
  if (!v.length) return 'text';
  const frac = f => v.filter(f).length / v.length;
  if (frac(x => /^(true|false|yes|no)$/i.test(x)) >= .9) return 'bool';
  if (frac(x => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)) > .8) return 'email';
  if (frac(x => /^https?:\/\//i.test(x)) > .8) return 'link';
  if (frac(x => /^-?[\d.,]+\s*%$/.test(x)) > .9) return 'percent';
  const order = dateOrder(v);
  if (frac(x => parseDate(x, order)) > .8) return 'date';
  if (/status|stage|state$/i.test(name)) return 'status';
  if (frac(x => num(x) != null && /^[\s$€£]*-?[\d.,]+\s*[$€£%]?$/.test(x)) > .9)
    return /salary|price|amount|value|cost|revenue|total|pay|fee|budget|bonus|wage/i.test(name) || v.some(x => /[$€£]/.test(x)) ? 'money' : 'number';
  if (v.reduce((t, x) => t + x.length, 0) / v.length > 80 || v.some(x => x.length > 200)) return 'longtext';
  const uniq = new Set(v.map(x => x.toLowerCase()));
  if (uniq.size <= 8 && uniq.size < v.length / 2) return 'status';
  return 'text';
}

function pickHeader(table) {
  const lim = Math.min(10, table.length), cnt = r => table[r].filter(c => c.trim() !== '').length;
  const max = Math.max(...Array.from({ length: lim }, (_, r) => cnt(r)));
  let h = 0; while (cnt(h) < .8 * max) h++;
  return h;
}

function buildSheet(name, table, fx) {
  const formulas = fx?.fm;
  const h = pickHeader(table), above = table.slice(0, h), body = table.slice(h + 1);
  let raw = table[h].map(x => (x || '').trim());
  const hEnd = raw.reduce((e, x, i) => x ? i : e, -1); raw = raw.slice(0, hEnd + 1); // ignore stray cells right of the table
  const W = raw.length;
  const counts = {}; raw.forEach(x => { counts[x] = (counts[x] || 0) + 1; });
  const aboveCell = i => above.map(r => (r[i] || '').trim()).filter(Boolean);
  const names = raw.map((x, i) => {
    let n = x;
    if (!n || counts[x] > 1 || n.includes('\n') || n.length > 40) { const alt = aboveCell(i).filter(a => a.length <= 40).sort((a, b) => a.length - b.length)[0]; if (alt) n = alt; }
    return n.replace(/\s*\n\s*/g, ' ').slice(0, 60) || `Column ${i + 1}`;
  });
  const seen = {}; const uniq = names.map(n => { seen[n] = (seen[n] || 0) + 1; return seen[n] > 1 ? `${n} ${seen[n]}` : n; });
  const columns = uniq.map((n, i) => {
    const vals = body.map(r => r[i] ?? '');
    const type = inferType(raw[i].includes('\n') ? n : n, vals);
    const desc = aboveCell(i).filter(a => a.length > 40).sort((a, b) => b.length - a.length)[0] || (raw[i].includes('\n') ? raw[i].replace(/\s*\n\s*/g, ' · ') : '');
    return { name: n, type, order: type === 'date' ? dateOrder(vals) : undefined, desc, formula: formulas?.[i] || '' };
  });
  const now = new Date().toISOString();
  const resolved = [];
  columns.forEach((c, i) => {
    if (c.type !== 'date' || c.order) return;
    const sure = body.map(r => String(r[i] ?? '').trim()).filter(v => !/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-]\d{2,4}$/.test(v) || (+RegExp.$1 > 12 || +RegExp.$2 > 12)).map(v => parseDate(v)).filter(Boolean).sort();
    if (!sure.length) return;
    const mid = toUTC(sure[sure.length >> 1]);
    c.fix = {};
    body.forEach(r => {
      const v = String(r[i] ?? '').trim(), m = v.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
      if (!m || +m[1] > 12 || +m[2] > 12 || m[1] === m[2]) return;
      const y = +m[3] < 100 ? 2000 + +m[3] : +m[3], a = valid(y, +m[2], +m[1]), b = valid(y, +m[1], +m[2]);
      if (a && b) { const pick = Math.abs(toUTC(a) - mid) <= Math.abs(toUTC(b) - mid) ? a : b; c.fix[v] = pick; resolved.push(`${v} → ${pick}`); }
    });
  });
  const ambiguous = columns.reduce((t, c, i) => t + (c.type === 'date' && !c.order && !c.fix ? body.filter(r => { const m = String(r[i] ?? '').trim().match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-]\d{2,4}$/); return m && +m[1] <= 12 && +m[2] <= 12 && m[1] !== m[2]; }).length : 0), 0);
  const fcols = new Set(Object.keys(formulas || {}).map(Number));
  const rows = body.filter(r => !formulas || r.some((v, i) => i <= hEnd && !fcols.has(i) && String(v ?? '').trim() !== '')).map(r => ({
    id: uid(), touched: now, notes: [], handled: {},
    cells: Object.fromEntries(columns.map((c, i) => [c.name, c.type === 'date' ? (c.fix?.[String(r[i] ?? '').trim()] || parseDate(r[i], c.order) || (r[i] ?? '').trim()) : (r[i] ?? '').trim()]))
  }));
  const distinct = c => new Set(rows.map(r => r.cells[c.name]).filter(v => v !== '')).size;
  const statusCol = columns.find(c => /status|stage|state$/i.test(c.name) && ['status', 'text'].includes(c.type) && distinct(c) >= 2 && distinct(c) <= 20)?.name || '';
  const doneStatuses = statusCol ? [...new Set(rows.map(r => r.cells[statusCol]).filter(v => DONE_RE.test(v)))].join(', ') : '';
  return {
    note: resolved.length ? `Ambiguous date${resolved.length > 1 ? 's' : ''} resolved from the neighbouring dates: ${resolved.slice(0, 3).join(', ')}.` : ambiguous ? `${ambiguous} date${ambiguous > 1 ? 's are' : ' is'} written like 05/10/2026 and could be day-first or month-first; assumed ${localeDMY ? 'day-first' : 'month-first'}. Check in the Table tab.` : '',
    id: uid(), name, columns, rows, statusCol, doneStatuses, fOff: fx?.off || 0,
    titleCol: (columns.filter(c => c.type === 'text' && /name|title|task|subject|summary/i.test(c.name)).sort((a, b) => distinct(b) - distinct(a))[0] || columns.find(c => c.type === 'text' && distinct(c) > 1) || columns.find(c => c.type === 'text') || columns[0]).name,
    lastCol: columns.find(c => c.type === 'date' && /last|contact|touch/i.test(c.name))?.name || '',
    staleDays: 0,
    watches: columns.filter(c => c.type === 'date' && /follow|due|review|renew|next|expir|deadline|remind|end/i.test(c.name) && !/actual|complet|resolv|done|created|hire/i.test(c.name)).map(c => ({ col: c.name, offset: 0 }))
  };
}

/* ---------- logic discovery: how are columns calculated from each other? ---------- */
function discoverLogic(s) {
  const cols = s.columns, V = cols.map(c => isNumT(c.type) ? s.rows.map(r => num(r.cells[c.name])) : null);
  const numIdx = cols.map((c, i) => V[i] ? i : -1).filter(i => i >= 0).slice(0, 40);
  const nonConst = i => new Set(V[i].filter(x => x != null)).size > 1;
  const test = (Yi, fn, tolFn) => {
    let n = 0, ok = 0; const bad = [];
    s.rows.forEach((r, k) => {
      const y = V[Yi][k], e = fn(k); if (y == null || e == null || !isFinite(e)) return;
      n++; if (Math.abs(y - e) <= tolFn(y)) ok++; else bad.push(r.id);
    });
    return { n, ok, bad, good: n >= 3 && ok / n >= .97, exact: n >= 3 && ok === n };
  };
  const exact = y => Math.max(.005 * Math.abs(y), .01), round = y => Math.max(.006 * Math.abs(y), .51);
  const rules = [];
  for (const Yi of numIdx) {
    if (!nonConst(Yi)) continue;
    let best = null;
    for (let i = 0; i < cols.length; i++) {
      if (!V[i] || i === Yi) continue;
      for (let j = i + 1; j < cols.length && V[j] && j !== Yi; j++) {
        const run = []; for (let q = i; q <= j; q++) run.push(q);
        const t = test(Yi, k => { let t = 0; for (const q of run) { if (V[q][k] == null) return null; t += V[q][k]; } return t; }, exact);
        if (t.good && (!best || run.length > best.run.length)) best = { run, t };
      }
    }
    const mk = (kind, text, t, extra) => rules.push({ col: cols[Yi].name, kind, text, bad: t.bad, checked: t.n, ...extra });
    if (best) { mk('sum', `${cols[Yi].name} = sum of ${cols[best.run[0]].name} → ${cols[best.run.at(-1)].name} (${best.run.length} columns)`, best.t, { parts: best.run.map(q => cols[q].name) }); continue; }
    let found = false;
    for (const A of numIdx) {
      if (A >= Yi || A === Yi) continue;
      const t = test(Yi, k => V[A][k], exact);
      if (t.exact) { mk('copy', `${cols[Yi].name} = ${cols[A].name}`, t); found = true; break; }
    }
    if (found) continue;
    const mults = cols[Yi].type === 'percent' ? [100, 1] : [1, 100];
    for (const A of numIdx) { if (found) break; if (A === Yi) continue;
      for (const B of numIdx) {
        if (B === A || B === Yi) continue;
        for (const m of mults) {
          const t = test(Yi, k => V[B][k] ? V[A][k] / V[B][k] * m : null, m === 100 ? round : y => Math.max(.006 * Math.abs(y), .011));
          if (t.good) { mk('ratio', `${cols[Yi].name} = ${cols[A].name} ÷ ${cols[B].name}${m === 100 ? ' × 100' : ''}`, t, { involved: [cols[Yi].name, cols[A].name, cols[B].name] }); found = true; break; }
        }
        if (found) break;
      }
    }
    if (found) continue;
    for (const A of numIdx) { if (found) break; if (A === Yi || !nonConst(A)) continue;
      for (const B of numIdx) {
        if (B <= A || B === Yi || !nonConst(B)) continue;
        for (const [sym, fn] of [['×', k => V[A][k] == null || V[B][k] == null ? null : V[A][k] * V[B][k]], ['−', k => V[A][k] == null || V[B][k] == null ? null : V[A][k] - V[B][k]], ['+', k => V[A][k] == null || V[B][k] == null ? null : V[A][k] + V[B][k]]]) {
          const t = test(Yi, fn, exact);
          if (t.good) { mk('calc', `${cols[Yi].name} = ${cols[A].name} ${sym} ${cols[B].name}`, t, { involved: [cols[Yi].name, cols[A].name, cols[B].name] }); found = true; break; }
        }
        if (found) break;
      }
    }
  }
  // a × b = c also shows up as c ÷ b = a and c ÷ a = b: keep one rule per set of columns, preferring the product
  const seen = new Set();
  return rules.sort((a, b) => (a.kind === 'ratio') - (b.kind === 'ratio')).filter(r => {
    if (!r.involved) return true;
    const key = r.involved.slice().sort().join('|'); if (seen.has(key)) return false; seen.add(key); return true;
  }).sort((a, b) => cols.findIndex(c => c.name === a.col) - cols.findIndex(c => c.name === b.col));
}
const colLetter = n => { let s = ''; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
const letterIdx = L => L.split('').reduce((t, ch) => t * 26 + ch.charCodeAt(0) - 64, 0) - 1;
const readableFormula = (s, f) => '=' + f.replace(/\$?([A-Z]{1,3})\$?\d+/g, (m, L) => `[${s.columns[letterIdx(L) - (s.fOff || 0)]?.name ?? L}]`);

/* ---------- profile: what is each column for? ---------- */
const dist = (s, c) => new Set(s.rows.map(r => r.cells[c.name]).filter(v => v !== '' && v != null));
const LOW_RE = /time|hours|days|duration|delay|cost|expense|spend|churn|error|bug|defect|complain|backlog|overdue|late|wait|refund|return|loss|risk|abandon|bounce/i;
const HIGH_RE = /score|rating|satisf|revenue|sales|profit|mrr|arr|complete|conversion|retention|efficiency|csat|nps|performance|income|growth|margin/i;
const SUM_RE = /revenue|sales|amount|total|cost|spend|budget|mrr|arr|quantity|units|orders|profit|expense|impressions|clicks|reach|calories|steps|billing|income|payment|stock/i;
const AVG_RE = /salary|wage|price|rate|score|rating|age|duration|time|hours|days|%|percent|satisf|margin/i;
const KEY_RE = /score|total|amount|value|revenue|salary|price|rating|cost|pay|mrr|sales|profit|budget|hours|time|spend|income/i;
const EVENT_RE = /created|opened|order|start|submitted|timestamp|^date$|\bdate$|logged|sent|posted/i, NOT_EVENT_RE = /hire|birth|due|end|expire|resolv|clos|actual|renew|deadline|complet/i;

// share of the variation in `meas` that is explained by differences between the groups of `dim` (0..1)
function etaSq(rows, dim, meas) {
  const groups = [...groupBy(rows, dim).values()].map(rs => rs.map(r => num(r.cells[meas])).filter(x => x != null)).filter(a => a.length >= 2);
  if (groups.length < 2) return 0;
  const all = groups.flat(), m = all.reduce((a, b) => a + b, 0) / all.length;
  const sst = all.reduce((t, x) => t + (x - m) ** 2, 0); if (!sst) return 0;
  return groups.reduce((t, a) => { const g = a.reduce((x, y) => x + y, 0) / a.length; return t + a.length * (g - m) ** 2; }, 0) / sst;
}

function profile(s) {
  const rules = discoverLogic(s);
  const filled = c => s.rows.filter(r => r.cells[c.name] !== '' && r.cells[c.name] != null).length;
  const stat = {}; s.columns.forEach(c => { stat[c.name] = { n: filled(c), d: dist(s, c).size }; });
  const sumRule = rules.filter(r => r.kind === 'sum').sort((a, b) => b.parts.length - a.parts.length)[0];
  let criteria = sumRule && sumRule.parts.length >= 3 ? sumRule.parts : [];
  if (!criteria.length) {
    let run = [], best = [];
    for (const c of s.columns) {
      const ok = isNumT(c.type) && s.rows.every(r => { const x = num(r.cells[c.name]); return x == null || (Number.isInteger(x) && x >= 0 && x <= 10); }) && stat[c.name].n > 0;
      if (ok) { run.push(c.name); if (run.length > best.length) best = run.slice(); } else run = [];
    }
    if (best.length >= 3) criteria = best;
  }
  const isCrit = c => criteria.includes(c.name);
  const constants = s.columns.filter(c => stat[c.name].n > 0 && stat[c.name].d === 1 && c.type !== 'longtext');
  const isConst = c => constants.includes(c);
  const idLike = c => isNumT(c.type) && stat[c.name].n >= 20 && stat[c.name].d === stat[c.name].n && /(^|\W)(id|no|nr|number|code|index)(\W|$)|#/i.test(c.name);
  const allNum = s.columns.filter(c => isNumT(c.type) && !isConst(c) && stat[c.name].n >= 3 && !idLike(c));
  const measures = allNum.filter(c => !isCrit(c));
  const lastRule = rules.at(-1)?.col;
  const rankedM = measures.map(c => ({ c, sc: (c.type === 'percent' ? 3 : 0) + (KEY_RE.test(c.name) ? 3 : 0) + (c.type === 'money' ? 1 : 0) + (c.name === lastRule ? 1 : 0) + stat[c.name].n / s.rows.length }))
    .sort((a, b) => b.sc - a.sc);
  const ov = s.roles || {};
  const autoMeasure = rankedM[0]?.c.name || '';
  const measure = ov.measure && allNum.some(c => c.name === ov.measure) ? ov.measure : autoMeasure;
  const mc = s.columns.find(c => c.name === measure);
  const autoAgg = !mc ? 'count' : (SUM_RE.test(mc.name) && !AVG_RE.test(mc.name)) || (mc.type === 'money' && !AVG_RE.test(mc.name)) ? 'sum' : 'avg';
  const autoPol = !mc ? 'neutral' : LOW_RE.test(mc.name) ? 'low' : HIGH_RE.test(mc.name) ? 'high' : 'neutral';
  // group-by candidates, best first: the column whose groups differ most on the chosen measure
  const dimsAll = s.columns.filter(c => ['text', 'status'].includes(c.type) && !isConst(c) && stat[c.name].d >= 2 && stat[c.name].d <= 30 && (c.type === 'status' || stat[c.name].n / stat[c.name].d >= 1.5)).map(c => c.name);
  const eta = {}; dimsAll.forEach(d => { eta[d] = measure ? etaSq(s.rows, d, measure) : 0; });
  const dimScore = d => eta[d] * (stat[d].d > 20 ? .7 : 1) + (/name|agent|employee|owner|team|dept|department|region|category|status|stage|type|plan/i.test(d) ? .02 : 0);
  const dims = dimsAll.slice().sort((a, b) => dimScore(b) - dimScore(a));
  const autoDim = dims[0] || '';
  const dim = ov.dim && dims.includes(ov.dim) ? ov.dim : autoDim;
  const times = s.columns.filter(c => c.type === 'date' && stat[c.name].d >= 3).map(c => ({ n: c.name, sc: (EVENT_RE.test(c.name) && !NOT_EVENT_RE.test(c.name) ? 3 : 0) - (NOT_EVENT_RE.test(c.name) ? 1 : 0) + Math.min(stat[c.name].d, 30) / 30 })).sort((a, b) => b.sc - a.sc);
  const autoTime = times[0]?.n || '';
  const time = ov.time && times.some(t => t.n === ov.time) ? ov.time : autoTime;
  const roles = { measure, agg: ov.agg || autoAgg, polarity: ov.polarity || autoPol, dim, time };
  const unsure = {
    measure: rankedM.length > 1 && rankedM[0].sc - rankedM[1].sc <= 1,
    dim: dims.length > 1 && dimScore(dims[0]) - dimScore(dims[1]) < .02,
    time: times.length > 1 && times[0].sc - times[1].sc < 1
  };
  // data-quality notes
  const dq = [];
  s.columns.forEach(c => {
    const blank = 1 - stat[c.name].n / (s.rows.length || 1);
    if (blank >= .3 && blank < 1 && c.type !== 'longtext') dq.push(`${c.name} is empty in ${Math.round(blank * 100)}% of rows.`);
    if (isNumT(c.type)) { const bad = s.rows.filter(r => r.cells[c.name] !== '' && num(r.cells[c.name]) == null); if (bad.length) dq.push(`${c.name} has ${bad.length} non-numeric entr${bad.length > 1 ? 'ies' : 'y'} (e.g. “${bad[0].cells[c.name]}”) that are ignored in calculations.`); }
  });
  if (/id|number|ticket|order|ref/i.test(s.titleCol) && stat[s.titleCol] && stat[s.titleCol].d < stat[s.titleCol].n) dq.push(`${stat[s.titleCol].n - stat[s.titleCol].d} rows repeat a ${s.titleCol} value used elsewhere.`);
  rules.filter(r => r.bad.length).forEach(r => dq.push(`${r.text}: ${r.bad.length} of ${r.checked} rows break this rule.`));
  return {
    rules, criteria, constants, measures, allNum, dims, stat, eta, roles, dq, unsure,
    auto: { measure: autoMeasure, agg: autoAgg, polarity: autoPol, dim: autoDim, time: autoTime },
    times: times.map(t => t.n),
    bools: s.columns.filter(c => c.type === 'bool' && !isConst(c)),
    longs: s.columns.filter(c => c.type === 'longtext'),
    links: s.columns.filter(c => c.type === 'link')
  };
}

/* ---------- reminders ---------- */
const isDone = (s, r) => !!s.statusCol && s.doneStatuses.split(',').map(x => x.trim().toLowerCase()).filter(Boolean).includes(String(r.cells[s.statusCol] ?? '').trim().toLowerCase());
function analyse(s) {
  const t = todayISO(); const out = { overdue: [], today: [], soon: [], stale: [] };
  for (const r of s.rows) {
    if (isDone(s, r)) continue;
    for (const w of s.watches) {
      const d = parseDate(r.cells[w.col]); if (!d || r.handled?.[w.col] === d) continue;
      const due = addDays(d, +w.offset || 0), diff = diffDays(t, due);
      const item = { r, w, due, diff };
      if (diff < 0) out.overdue.push(item); else if (diff === 0) out.today.push(item); else if (diff <= 14) out.soon.push(item);
    }
    if (s.staleDays > 0) {
      const last = [r.touched?.slice(0, 10), s.lastCol && parseDate(r.cells[s.lastCol])].filter(Boolean).sort().pop();
      const age = last ? diffDays(last, t) : 0;
      if (age >= s.staleDays) out.stale.push({ r, age });
    }
  }
  out.overdue.sort((a, b) => a.diff - b.diff); out.soon.sort((a, b) => a.diff - b.diff); out.stale.sort((a, b) => b.age - a.age);
  return out;
}
let dupCache = null;
function title(s, r) {
  const base = r.cells[s.titleCol] || '(untitled)';
  if (!dupCache || dupCache.k !== s.id + s.titleCol) { const cnt = {}; s.rows.forEach(x => { const b = x.cells[s.titleCol]; cnt[b] = (cnt[b] || 0) + 1; }); dupCache = { k: s.id + s.titleCol, cnt }; }
  if (dupCache.cnt[base] > 1) { const d = s.columns.find(c => c.type === 'date'); const dv = d && r.cells[d.name]; if (dv) return `${base} · ${dv}`; }
  return base;
}

/* ---------- rendering ---------- */
const TABS = [['dash', 'Dashboard'], ['rem', 'Reminders'], ['table', 'Table'], ['setup', 'Setup']];
function render() {
  dupCache = null;
  document.documentElement.dataset.theme = curTheme();
  document.title = BRAND; $('.brand').innerHTML = `<b>${esc(BRAND)}</b>`; $('#credit').innerHTML = creditsInner();
  document.body.classList.toggle('shared', !!shared);
  $('#sharebar').innerHTML = shared ? `<div class="sharebar"><b>Shared dashboard</b><span class="muted">You're looking at a copy; your changes aren't saved.</span><button class="primary" data-act="savecopy">Save a copy to my sheets</button><a href="${esc(location.pathname)}">Make your own dashboard</a></div>` : '';
  $('#wsSelect').innerHTML = state.sheets.map(s => `<option value="${s.id}" ${s.id === state.current ? 'selected' : ''}>${esc(s.name)}</option>`).join('') || '<option>No sheets yet</option>';
  $('#tabs').innerHTML = TABS.map(([k, l]) => `<button data-tab="${k}" class="${ui.tab === k ? 'on' : ''}">${l}</button>`).join('');
  const s = sheet(); const m = $('#main');
  if (!s) { m.innerHTML = `<div class="card"><h2>Turn any sheet into a live dashboard</h2><p class="muted">Import a CSV or Excel file, paste cells, or try a sample. SheetPilot works out what each column is, how the numbers are calculated, and builds an interactive dashboard from that.</p><button class="primary" data-act="import">Import a sheet</button></div>`; renderDrawer(); return; }
  m.innerHTML = (s.note ? `<p class="card muted">${esc(s.note)}</p>` : '') + { dash: viewDash, rem: viewRem, table: viewTable, setup: viewSetup }[ui.tab](s);
  renderDrawer();
}

/* --- dashboard helpers --- */
const AGGS = { avg: 'Average', sum: 'Total', count: 'Count', max: 'Highest', min: 'Lowest' };
function aggregate(rows, col, how) {
  if (how === 'count') return rows.length;
  const v = rows.map(r => num(r.cells[col])).filter(x => x != null);
  if (!v.length) return null;
  const sum = v.reduce((a, b) => a + b, 0);
  return how === 'sum' ? sum : how === 'max' ? Math.max(...v) : how === 'min' ? Math.min(...v) : sum / v.length;
}
const filteredRows = s => s.rows.filter(r => Object.entries(ui.f).every(([k, v]) => String(r.cells[k] ?? '') === v));
const groupBy = (rows, col) => { const g = new Map(); rows.forEach(r => { const k = r.cells[col]; if (k === '' || k == null) return; (g.get(k) || g.set(k, []).get(k)).push(r); }); return g; };
const opts = (list, sel) => list.map(([v, l]) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(l ?? v)}</option>`).join('');

function lineChart(points, fmt) {
  const W = 640, H = 170, P = 34, vs = points.map(p => p.v), lo = Math.min(...vs), hi = Math.max(...vs), span = hi - lo || 1;
  const X = i => P + (points.length === 1 ? (W - 2 * P) / 2 : i / (points.length - 1) * (W - 2 * P)), Y = v => H - 26 - ((v - lo) / span) * (H - 56);
  return `<svg viewBox="0 0 ${W} ${H}" class="line" role="img"><polyline fill="none" stroke="var(--accent)" stroke-width="2" points="${points.map((p, i) => `${X(i)},${Y(p.v)}`).join(' ')}"/>
    ${points.map((p, i) => `<circle cx="${X(i)}" cy="${Y(p.v)}" r="4" fill="var(--accent)"><title>${esc(p.l)}: ${fmt(p.v)} (${p.n} rows)</title></circle>`).join('')}
    <text x="${P}" y="${H - 6}" class="ax">${esc(points[0].l)}</text><text x="${W - P}" y="${H - 6}" text-anchor="end" class="ax">${esc(points.at(-1).l)}</text>
    <text x="4" y="${Y(hi) + 4}" class="ax">${fmt(hi)}</text>${hi !== lo ? `<text x="4" y="${Y(lo) + 4}" class="ax">${fmt(lo)}</text>` : ''}</svg>`;
}

const sec = (id, label, html) => `<section data-sec="${id}" data-label="${esc(label)}">${html}</section>`;
const POL = { high: 'Higher is better', low: 'Lower is better', neutral: 'No good or bad direction' };
function timeSeries(rows, timeC, mc, agg) {
  const days = new Set(rows.map(r => r.cells[timeC.name]).filter(Boolean));
  let cut = days.size > 40 ? 7 : 10; // group by month when there are many days...
  if (cut === 7 && new Set([...days].map(d => d.slice(0, 7))).size > 48) cut = 4; // ...and by year for very long spans
  const buckets = new Map(); rows.forEach(r => { const d = r.cells[timeC.name]; if (!d) return; const k = d.slice(0, cut); (buckets.get(k) || buckets.set(k, []).get(k)).push(r); });
  const points = [...buckets].map(([k, rs]) => ({ l: k, v: aggregate(rs, mc.name, agg), n: rs.length })).filter(x => x.v != null).sort((a, b) => a.l < b.l ? -1 : 1);
  return { points, cut };
}
const pct = x => `${(x * 100).toFixed(x < .1 ? 1 : 0)}%`;

function findings(s, P, rows, g, series) {
  const { measure, agg, polarity, dim, time } = P.roles; const mc = s.columns.find(c => c.name === measure);
  const fv = v => fmtVal(mc, v), F = [];
  const link = (d, k) => `<a data-act="fdim" data-c="${esc(d)}" data-v="${esc(k)}">${esc(k)}</a>`;
  if (mc && dim && g.length >= 2) {
    const hi = g[0], lo = g.at(-1), e = etaSq(rows, dim, mc.name);
    if (agg === 'sum') {
      const tot = g.reduce((t, x) => t + x.v, 0);
      if (tot > 0) F.push(`${link(dim, hi.k)} is the largest ${esc(dim)}: ${pct(hi.v / tot)} of total ${esc(mc.name)} (${hi.rs.length} of ${rows.length} rows).`);
    } else if (agg === 'avg' && polarity !== 'neutral') {
      const best = polarity === 'high' ? hi : lo, worst = polarity === 'high' ? lo : hi;
      F.push(`Best ${esc(dim)} on average ${esc(mc.name)}: ${link(dim, best.k)} (${fv(best.v)}); worst: ${link(dim, worst.k)} (${fv(worst.v)}).`);
    } else if (agg === 'avg') {
      F.push(lo.v && hi.v / lo.v >= 1.05 ? `Average ${esc(mc.name)} ranges from ${link(dim, lo.k)} (${fv(lo.v)}) to ${link(dim, hi.k)} (${fv(hi.v)}).` : `${esc(dim)} makes little difference to average ${esc(mc.name)}.`);
    }
    F.push(e >= .1 ? `${esc(dim)} explains ${pct(e)} of the variation in ${esc(mc.name)}.` : `No single ${esc(dim)} stands out: it explains only ${pct(e)} of the variation in ${esc(mc.name)}.`);
  }
  if (mc && series && series.points.length >= 6) {
    const p = series.points, t = Math.floor(p.length / 3), mean = a => a.reduce((x, y) => x + y.v, 0) / a.length, a = mean(p.slice(0, t)), b = mean(p.slice(-t));
    if (a && Math.abs((b - a) / a) >= .1) F.push(`${AGGS[agg]} ${esc(mc.name)} ${b > a ? 'rose' : 'fell'} ${pct(Math.abs((b - a) / a))} from the first to the last third of ${esc(time)}.`);
  }
  P.bools.slice(0, 2).forEach(b => {
    const rate = rs => rs.filter(r => /^(true|yes)$/i.test(r.cells[b.name])).length / (rs.length || 1);
    let t = `${esc(b.name)} is true for ${pct(rate(rows))} of rows`;
    if (dim) { const gr = [...groupBy(rows, dim)].filter(([, rs]) => rs.length >= 10).map(([k, rs]) => ({ k, v: rate(rs) })).sort((x, y) => y.v - x.v); if (gr.length >= 2 && gr[0].v - gr.at(-1).v >= .1) t += `; highest for ${link(dim, gr[0].k)} (${pct(gr[0].v)}), lowest for ${link(dim, gr.at(-1).k)} (${pct(gr.at(-1).v)})`; }
    F.push(t + '.');
  });
  if (mc) {
    const v = rows.map(r => ({ r, v: num(r.cells[mc.name]) })).filter(x => x.v != null).sort((x, y) => x.v - y.v);
    if (v.length >= 20) {
      const q = f => v[Math.floor(f * (v.length - 1))].v, q1 = q(.25), q3 = q(.75), iqr = q3 - q1;
      const out = v.filter(x => iqr > 0 && (x.v > q3 + 3 * iqr || x.v < q1 - 3 * iqr));
      if (out.length && out.length <= .03 * v.length) F.push(`${out.length} row${out.length > 1 ? 's are' : ' is'} an extreme outlier on ${esc(mc.name)}, e.g. <a data-act="open" data-r="${out.at(-1).r.id}">${esc(title(s, out.at(-1).r))}</a> (${fv(out.at(-1).v)}).`);
    }
  }
  return F;
}

function viewDash(s) {
  const P = profile(s), rows = filteredRows(s), total = s.rows.length;
  const { measure, agg, polarity, dim, time } = P.roles;
  const mc = s.columns.find(c => c.name === measure) || null, timeC = s.columns.find(c => c.name === time) || null;
  const aggName = mc ? `${AGGS[agg]} ${mc.name}` : 'Rows';
  const fv = v => mc ? fmtVal(mc, v) : fmtNum(v);
  const nActive = Object.keys(ui.f).length;
  const groups = dim ? [...groupBy(rows, dim)].map(([k, rs]) => ({ k, rs, v: aggregate(rs, mc ? mc.name : '', mc ? agg : 'count') })).filter(x => x.v != null).sort((a, b) => b.v - a.v) : [];
  const series = timeC && mc ? timeSeries(rows, timeC, mc, agg) : null;
  let h = '';

  // review banner
  const un = k => P.unsure[k] ? ' <span class="badge amber">unsure</span>' : '';
  if (!s.reviewed) h += `<div class="card review"><b>How I read your sheet</b> <span class="muted">— check this looks right</span><ul>
    <li>Each row is named by <b>${esc(s.titleCol)}</b></li>
    <li>${mc ? `Main number: <b>${esc(mc.name)}</b>, shown as ${agg === 'sum' ? 'a total' : 'an average'}; ${esc(POL[polarity].toLowerCase())}` : 'No main number found, so rows are counted'}${un('measure')}</li>
    ${dim ? `<li>Compared by: <b>${esc(dim)}</b>${un('dim')}</li>` : ''}${timeC ? `<li>Timeline: <b>${esc(timeC.name)}</b>${un('time')}</li>` : ''}</ul>
    <div class="row"><button class="primary" data-act="reviewed">Looks right</button><button data-tab-go="setup">Adjust…</button><span class="muted">You can change any of this later in Setup, or with the dropdowns on the charts.</span></div></div>`;

  // header summary
  const dates = timeC ? rows.map(r => r.cells[timeC.name]).filter(Boolean).sort() : [];
  h += sec('summary', 'Row count and date range', `<div class="summary"><b>${rows.length}${nActive ? ` of ${total}` : ''} rows</b>${dates.length ? ` · ${esc(timeC.name)}: ${esc(dates[0])} → ${esc(dates.at(-1))}` : ''}${P.constants.length ? `<div class="muted">Same on every row: ${P.constants.map(c => `${esc(c.name)} = ${esc(s.rows.find(r => r.cells[c.name] !== '')?.cells[c.name])}`).join(' · ')}</div>` : ''}</div>`);

  // style picker
  h += `<div class="themebar"><b>Style</b>${THEMES.map(t => `<button class="chip ${t.id === curTheme() ? 'on' : ''}" style="--c1:${t.c[0]};--c2:${t.c[1]}" data-act="theme" data-t="${t.id}" title="${esc(t.name)} — ${esc(t.hint)}" aria-label="${esc(t.name)}"><i></i><i></i></button>`).join('')}<span class="muted">${esc(THEMES.find(t => t.id === curTheme()).name)} · ${esc(THEMES.find(t => t.id === curTheme()).hint)}</span></div>`;

  // filters
  const fcols = [...P.dims, ...P.bools.map(c => c.name)].slice(0, 6);
  h += `<div class="tools filters">${fcols.map(n => `<select data-fsel="${esc(n)}"><option value="">All ${esc(n)}</option>${opts([...dist(s, s.columns.find(c => c.name === n))].sort().map(v => [v]), ui.f[n])}</select>`).join('')}${nActive ? '<button data-act="clearf">Clear filters</button>' : ''}</div>`;

  // KPI cards
  const cards = [`<div class="card"><div class="n">${rows.length}</div>Rows</div>`];
  if (mc) {
    const kp = agg === 'sum' ? [['sum', 'Total'], ['avg', 'Average']] : [['avg', 'Average'], ['min', 'Lowest'], ['max', 'Highest']];
    kp.forEach(([a, l]) => cards.push(`<div class="card"><div class="n">${fmtVal(mc, aggregate(rows, mc.name, a))}</div>${l} ${esc(mc.name)}</div>`));
  }
  P.measures.filter(c => c !== mc).slice(0, 2).forEach(c => { const a = SUM_RE.test(c.name) && !AVG_RE.test(c.name) ? 'sum' : 'avg'; cards.push(`<div class="card"><div class="n">${fmtVal(c, aggregate(rows, c.name, a))}</div>${AGGS[a]} ${esc(c.name)}</div>`); });
  P.bools.slice(0, 3).forEach(c => { const t = rows.filter(r => /^(true|yes)$/i.test(r.cells[c.name])).length; cards.push(`<div class="card ${t ? 'green' : ''}"><div class="n">${t}<span class="muted"> / ${rows.length}</span></div>${esc(c.name)}</div>`); });
  P.longs.slice(0, 2).forEach(c => cards.push(`<div class="card"><div class="n">${rows.filter(r => r.cells[c.name]).length}</div>Rows with ${esc(c.name)}</div>`));
  if (s.watches.length) { const a = analyse(s); cards.push(`<div class="card ${a.overdue.length ? 'red' : ''}" data-tab-go="rem" style="cursor:pointer"><div class="n">${a.overdue.length}</div>Overdue reminders</div>`); }
  h += sec('kpis', 'Key numbers', `<div class="cards">${cards.join('')}</div>`);

  // findings
  const F = findings(s, P, rows, groups, series);
  if (F.length) h += sec('findings', 'Key findings', `<h2>Key findings</h2><div class="card"><ul class="logic">${F.map(f => `<li>${f}</li>`).join('')}</ul></div>`);

  // grouped bars
  if (dim && groups.length >= 2) {
    const g = groups.slice(0, 25), max = Math.max(...g.map(x => Math.abs(x.v)), 1e-9);
    const cls = (x, i) => { if (polarity === 'neutral' || !mc || agg === 'count' || g.length < 3) return ''; if (i === 0) return polarity === 'high' ? 'best' : 'worst'; if (i === g.length - 1) return polarity === 'high' ? 'worst' : 'best'; return ''; };
    h += sec('bars', 'Comparison chart', `<h2>${esc(aggName)} by ${esc(dim)}</h2><div class="tools"><select data-role="agg">${opts(Object.entries(AGGS).filter(([k]) => mc || k === 'count'), agg)}</select><select data-role="measure">${opts(P.allNum.map(c => [c.name]), mc?.name)}</select><span class="muted">by</span><select data-role="dim">${opts(P.dims.map(d => [d]), dim)}</select><select data-role="polarity" title="Used for colouring and the attention list">${opts(Object.entries(POL), polarity)}</select></div>
      <div class="list bars">${g.map((x, i) => `<div class="brow ${ui.f[dim] === x.k ? 'on' : ''}" data-act="fdim" data-c="${esc(dim)}" data-v="${esc(x.k)}"><div class="bl">${esc(x.k)}</div><div class="bt"><div class="bar ${cls(x, i)}" style="width:${Math.abs(x.v) / max * 100}%"></div></div><div class="bv">${fv(x.v)} <span class="muted">(${x.rs.length})</span></div></div>`).join('')}</div><p class="muted"><span class="ui-only">Click a bar to filter the page.</span>${polarity !== 'neutral' && mc && agg !== 'count' ? ' Green = best, red = worst.' : ''}</p>`);
  }

  // trend
  if (series && series.points.length >= 3 && new Set(series.points.map(p => p.v)).size > 1)
    h += sec('trend', 'Trend over time', `<h2>${esc(aggName)} over ${esc(timeC.name)}${series.cut < 10 ? ` (by ${series.cut === 7 ? 'month' : 'year'})` : ''}</h2><div class="card">${lineChart(series.points, fv)}</div>`);

  // heatmap of criteria
  if (P.criteria.length >= 2 && dim && groups.length >= 2) {
    const cc = P.criteria.map(n => s.columns.find(c => c.name === n)); const all = cc.flatMap(c => rows.map(r => num(r.cells[c.name]))).filter(x => x != null); const top = Math.max(...all, 1);
    const cell = rs => (c) => { const v = aggregate(rs, c.name, 'avg'); return v == null ? '<td>–</td>' : `<td style="background:hsla(${Math.max(0, Math.min(1, v / top)) ** 2 * 120},70%,45%,.38)">${fmtNum(v)}</td>`; };
    const gl = groups.slice().sort((a, b) => String(a.k).localeCompare(String(b.k))).slice(0, 40);
    h += sec('heat', 'Criteria heatmap', `<h2>${esc(P.rules.find(r => r.kind === 'sum')?.col ? 'Breakdown of ' + P.rules.find(r => r.kind === 'sum').col : 'Criteria')} by ${esc(dim)}</h2><div class="tablewrap"><table class="heat"><thead><tr><th>${esc(dim)}</th>${cc.map(c => `<th title="${esc(c.desc)}">${esc(c.name)}</th>`).join('')}</tr></thead><tbody>
      <tr class="all"><td><b>All (${rows.length})</b></td>${cc.map(cell(rows)).join('')}</tr>
      ${gl.map(x => `<tr class="${ui.f[dim] === x.k ? 'on' : ''}"><td><a data-act="fdim" data-c="${esc(dim)}" data-v="${esc(x.k)}">${esc(x.k)}</a> <span class="muted">(${x.rs.length})</span></td>${cc.map(cell(x.rs)).join('')}</tr>`).join('')}</tbody></table></div><p class="muted">Colour: green = high, red = low. Hover a column title for its description.</p>`);
  }

  // distribution
  if (mc) {
    const vals = rows.map(r => num(r.cells[mc.name])).filter(x => x != null);
    const distinct = [...new Set(vals)].sort((a, b) => a - b);
    if (vals.length >= 3 && distinct.length >= 2) {
      const lo = distinct[0], hi = distinct.at(-1); let bins;
      if (distinct.length <= 8) bins = distinct.map(v => ({ l: fmtVal(mc, v), n: vals.filter(x => x === v).length }));
      else { const w = (hi - lo) / 8; bins = Array.from({ length: 8 }, (_, i) => ({ l: fmtNum(lo + i * w), n: 0 })); vals.forEach(v => { bins[Math.min(7, Math.floor((v - lo) / w))].n++; }); }
      const mx = Math.max(...bins.map(b => b.n), 1);
      h += sec('dist', 'Distribution', `<h2>Distribution of ${esc(mc.name)}</h2><div class="card"><div class="hist">${bins.map(b => `<div class="hcol"><div class="hn">${b.n}</div><div class="hbar" style="height:${b.n / mx * 100}px"></div><div class="hl">${esc(b.l)}</div></div>`).join('')}</div></div>`);
    }
  }

  // attention list (direction-aware)
  if (mc) {
    const worstHigh = polarity !== 'high';
    const list = rows.map(r => ({ r, v: num(r.cells[mc.name]) })).filter(x => x.v != null).sort((a, b) => worstHigh ? b.v - a.v : a.v - b.v).slice(0, 5);
    const long = P.longs[0];
    h += sec('attention', 'Highest / lowest rows', `<h2>${worstHigh ? 'Highest' : 'Lowest'} ${esc(mc.name)}${polarity === 'neutral' ? '' : ' — needs attention'}</h2><div class="list">${list.map(x => `<div class="item"><div class="t"><a data-act="open" data-r="${x.r.id}">${esc(title(s, x.r))}</a>${long ? `<div class="muted">${esc((x.r.cells[long.name] || '').slice(0, 160))}${(x.r.cells[long.name] || '').length > 160 ? '…' : ''}</div>` : ''}</div><span class="badge">${fv(x.v)}</span></div>`).join('') || '<div class="empty">Nothing here.</div>'}</div>`);
  }

  // checks + logic
  h += sec('logic', 'How the sheet works and data checks', `<h2>How this sheet works</h2><details class="card" open><summary>What SheetPilot understood</summary>
    <ul class="logic">
    <li>Each row is labelled by <b>${esc(s.titleCol)}</b>${mc ? `; main number: <b>${esc(mc.name)}</b>` : ''}${P.criteria.length ? `; ${P.criteria.length} scored criteria` : ''}${timeC ? `; timeline: <b>${esc(timeC.name)}</b>` : ''}.</li>
    ${P.dims.length ? `<li>Can be grouped by: ${P.dims.map(esc).join(', ')}.</li>` : ''}
    ${s.columns.filter(c => c.formula).map(c => `<li><b>${esc(c.name)}</b> is calculated in your file by <code>${esc(readableFormula(s, c.formula))}</code></li>`).join('')}
    ${P.rules.filter(r => !s.columns.find(c => c.name === r.col)?.formula).map(r => `<li>${esc(r.text)} <span class="badge ${r.bad.length ? 'amber' : 'green'}">${r.bad.length ? `${r.bad.length} of ${r.checked} rows differ` : `holds in all ${r.checked} rows`}</span>${r.bad.length ? ' ' + r.bad.slice(0, 5).map(id => `<a data-act="open" data-r="${id}">${esc(title(s, s.rows.find(x => x.id === id)))}</a>`).join(', ') : ''}</li>`).join('')}
    </ul>${P.rules.length && !s.columns.some(c => c.formula) && !s.fromXlsx ? '<p class="muted">Formulas are lost when a sheet is exported to CSV, so these rules were inferred from the values. Upload the .xlsx to see the actual formulas.</p>' : ''}
    ${P.dq.length ? `<b>Data checks</b><ul class="logic">${P.dq.map(d => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}</details>`);
  return h;
}

/* --- reminders --- */
function remItem(s, it, kind) {
  const label = kind === 'overdue' ? `${-it.diff}d overdue` : kind === 'today' ? 'today' : `in ${it.diff}d`;
  const cls = kind === 'overdue' ? 'red' : kind === 'today' ? 'amber' : 'green';
  return `<div class="item"><div class="t"><a data-act="open" data-r="${it.r.id}">${esc(title(s, it.r))}</a><div class="muted">${esc(it.w.col)}: ${esc(it.due)}${s.statusCol ? ' · ' + esc(it.r.cells[s.statusCol]) : ''}</div></div>
    <span class="badge ${cls}">${label}</span>
    <button data-act="snooze" data-r="${it.r.id}" data-w="${esc(it.w.col)}" title="Move the date 7 days later">+7d</button>
    <button data-act="handled" data-r="${it.r.id}" data-w="${esc(it.w.col)}">Done</button></div>`;
}
const section = (h, items, fn) => `<h2>${h} (${items.length})</h2><div class="list">${items.length ? items.map(fn).join('') : '<div class="empty">Nothing here.</div>'}</div>`;
function viewRem(s) {
  const a = analyse(s);
  let h = '';
  if (!s.watches.length) h += `<div class="card">No date columns are being watched. Open <a href="#" data-tab-go="setup">Setup</a> and tick the dates that should trigger reminders.</div>`;
  h += `<div class="cards"><div class="card red"><div class="n">${a.overdue.length}</div>Overdue</div><div class="card amber"><div class="n">${a.today.length}</div>Due today</div><div class="card green"><div class="n">${a.soon.length}</div>Next 14 days</div>${s.staleDays > 0 ? `<div class="card"><div class="n">${a.stale.length}</div>No activity ${s.staleDays}+ days</div>` : ''}</div>`;
  h += section('Overdue', a.overdue, it => remItem(s, it, 'overdue')) + section('Due today', a.today, it => remItem(s, it, 'today')) + section('Coming up', a.soon, it => remItem(s, it, 'soon'));
  if (s.staleDays > 0) h += section('No recent activity', a.stale, it => `<div class="item"><div class="t"><a data-act="open" data-r="${it.r.id}">${esc(title(s, it.r))}</a></div><span class="badge amber">${it.age}d</span></div>`);
  return h;
}

/* --- table --- */
function visibleRows(s) {
  let rows = s.rows.slice();
  const q = ui.q.toLowerCase();
  if (q) rows = rows.filter(r => Object.values(r.cells).some(v => String(v).toLowerCase().includes(q)));
  if (ui.sf && s.statusCol) rows = rows.filter(r => r.cells[s.statusCol] === ui.sf);
  if (ui.sort) {
    const c = s.columns.find(x => x.name === ui.sort.col); const k = ui.sort.dir;
    rows.sort((a, b) => {
      let x = a.cells[c.name], y = b.cells[c.name];
      if (isNumT(c.type)) { x = num(x) ?? -Infinity; y = num(y) ?? -Infinity; }
      else { x = String(x ?? '').toLowerCase(); y = String(y ?? '').toLowerCase(); }
      return (x > y ? 1 : x < y ? -1 : 0) * k;
    });
  }
  return rows;
}
function cellHtml(c, v) {
  if (c.type === 'bool') return /^(true|yes)$/i.test(v) ? '✓' : v === '' ? '' : '–';
  if (c.type === 'link' && v) return `<a href="${esc(v)}" target="_blank" rel="noopener">${esc(v.replace(/^https?:\/\/(www\.)?/, '').split('/').filter(Boolean).pop().slice(0, 24))}</a>`;
  if (c.type === 'longtext') return `<span title="${esc(v)}">${esc(v.slice(0, 50))}${v.length > 50 ? '…' : ''}</span>`;
  return esc(isNumT(c.type) && c.type !== 'percent' ? fmtNum(num(v)) || v : v);
}
function viewTable(s) {
  const statuses = s.statusCol ? [...new Set(s.rows.map(r => r.cells[s.statusCol]).filter(Boolean))] : [];
  const rows = visibleRows(s); const t = todayISO();
  const watched = new Set(s.watches.map(w => w.col));
  return `<div class="tools"><input id="q" placeholder="Search…" value="${esc(ui.q)}">
    ${statuses.length ? `<select id="sf"><option value="">All ${esc(s.statusCol)}</option>${statuses.map(v => `<option ${v === ui.sf ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>` : ''}
    <div class="spacer"></div><span class="muted">${rows.length} of ${s.rows.length} rows · click a cell to edit</span><button data-act="addrow">+ Row</button></div>
  <div class="tablewrap"><table><thead><tr><th></th>${s.columns.map(c => `<th data-sort="${esc(c.name)}" title="${esc(c.desc)}">${esc(c.name)}${ui.sort?.col === c.name ? (ui.sort.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('')}</tr></thead>
  <tbody>${rows.map(r => `<tr class="${isDone(s, r) ? 'muted' : ''}"><td><a data-act="open" data-r="${r.id}" style="cursor:pointer">↗</a></td>${s.columns.map(c => {
      const v = r.cells[c.name] ?? '';
      const over = c.type === 'date' && watched.has(c.name) && !isDone(s, r) && parseDate(v) && parseDate(v) < t && r.handled?.[c.name] !== parseDate(v);
      return `<td data-r="${r.id}" data-c="${esc(c.name)}" class="${isNumT(c.type) ? 'num' : ''} ${c.type === 'date' ? 'date' : ''} ${over ? 'over' : ''}">${cellHtml(c, v)}</td>`;
    }).join('')}</tr>`).join('')}</tbody></table></div>`;
}

/* --- setup --- */
function setupAnalysis(s) {
  const P = profile(s), a = P.auto, r = s.roles || {};
  const sel = (key, label, options, autoLabel) => `<label>${label}<select data-role="${key}"><option value="">Auto${autoLabel ? ` (${esc(autoLabel)})` : ''}</option>${options.map(([v, l]) => `<option value="${esc(v)}" ${r[key] === v ? 'selected' : ''}>${esc(l ?? v)}</option>`).join('')}</select></label>`;
  return `<div class="card"><b>How SheetPilot reads this sheet</b><div class="muted">Everything is chosen automatically. Override anything that looks wrong.</div><div class="setup" style="margin-top:10px">
    ${sel('measure', 'Main number', P.allNum.map(c => [c.name]), a.measure || 'none')}
    ${sel('agg', 'Show it as', [['avg', 'Average'], ['sum', 'Total'], ['max', 'Highest'], ['min', 'Lowest']], AGGS[a.agg])}
    ${sel('polarity', 'Which direction is good?', Object.entries(POL), POL[a.polarity])}
    ${sel('dim', 'Compare by', P.dims.map(d => [d]), a.dim || 'none')}
    ${sel('time', 'Timeline', P.times.map(d => [d]), a.time || 'none')}
    <button data-act="resetroles">Reset to automatic</button></div></div>`;
}
function viewSetup(s) {
  const o = (sel, filter = () => true, none = '— none —') => `<option value="">${none}</option>` + s.columns.filter(filter).map(c => `<option ${c.name === sel ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
  const dates = s.columns.filter(c => c.type === 'date');
  return `<div class="setup">
    ${setupAnalysis(s)}
    <p class="muted">The Dashboard builds itself from the column types below. Reminders are optional: use them for sheets with follow-up or review dates.</p>
    <label>Sheet name<input data-set="name" value="${esc(s.name)}"></label>
    <label>Title column <span>Names each row in lists.</span><select data-set="titleCol">${o(s.titleCol, () => true, '—')}</select></label>
    <label>Status column <span>Optional. Rows with a finished status are skipped by reminders.</span><select data-set="statusCol">${o(s.statusCol)}</select></label>
    <label>Finished statuses <span>Comma-separated.</span><input data-set="doneStatuses" value="${esc(s.doneStatuses)}"></label>
    <label>Last contacted column <span>Optional. Used by the "no recent activity" rule.</span><select data-set="lastCol">${o(s.lastCol, c => c.type === 'date')}</select></label>
    <label>Flag rows with no activity for (days) <span>0 turns it off.</span><input type="number" min="0" data-set="staleDays" value="${s.staleDays}"></label>
    <div><b>Dates that trigger reminders</b><div class="muted">Offset shifts the reminder: <code>3</code> = three days after the date, <code>-30</code> = thirty days before.</div>
      ${dates.length ? dates.map(c => { const w = s.watches.find(x => x.col === c.name); return `<div class="row" style="margin-top:6px"><label class="row" style="font-weight:400"><input type="checkbox" data-watch="${esc(c.name)}" ${w ? 'checked' : ''}> ${esc(c.name)}</label><input type="number" data-offset="${esc(c.name)}" value="${w ? w.offset : 0}" style="width:80px" ${w ? '' : 'disabled'}> <span class="muted">days</span></div>`; }).join('') : '<div class="muted">No date columns detected.</div>'}</div>
    <div><b>Column types</b><div class="tablewrap" style="margin-top:6px"><table class="coltab"><tbody>${s.columns.map(c => `<tr><td>${esc(c.name)}</td><td><select data-type="${esc(c.name)}">${['text', 'longtext', 'number', 'money', 'percent', 'date', 'status', 'bool', 'email', 'link'].map(t => `<option ${t === c.type ? 'selected' : ''}>${t}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div></div>
  </div>`;
}

function renderDrawer() {
  const d = $('#drawer'); const s = sheet(); const r = s && s.rows.find(x => x.id === ui.drawer);
  if (!r) { d.hidden = true; return; }
  d.hidden = false;
  d.innerHTML = `<div class="row"><h3 style="flex:1">${esc(title(s, r))}</h3><button data-act="close">Close</button></div>
    <div class="kv">${s.columns.map(c => { const v = r.cells[c.name] ?? ''; return `<div class="muted">${esc(c.name)}</div><div style="white-space:pre-wrap;word-break:break-word">${c.type === 'link' ? cellHtml(c, v) : esc(v)}</div>`; }).join('')}</div>
    <h3>Activity</h3>
    <div class="row"><input id="noteIn" placeholder="Add a note (counts as activity)" style="flex:1"><button class="primary" data-act="addnote">Add</button></div>
    ${r.notes.slice().reverse().map(n => `<div class="note"><div class="muted">${esc(new Date(n.t).toLocaleString())}</div>${esc(n.text)}</div>`).join('') || '<p class="muted">No notes yet.</p>'}
    <p><button class="danger" data-act="delrow">Delete row</button></p>`;
}

/* ---------- actions ---------- */
const findRow = id => sheet()?.rows.find(r => r.id === id);
function setCell(r, col, val) {
  const c = sheet().columns.find(x => x.name === col);
  r.cells[col] = c.type === 'date' ? (parseDate(val, c.order) || val.trim()) : val.trim();
  r.touched = new Date().toISOString(); save();
}
function startEdit(td) {
  if (td.querySelector('input')) return;
  const s = sheet(), r = findRow(td.dataset.r), col = td.dataset.c, c = s.columns.find(x => x.name === col);
  const inp = document.createElement('input'); inp.value = r.cells[col] ?? ''; inp.type = 'text';
  if (c.type === 'status') { inp.setAttribute('list', 'dl'); const dl = document.createElement('datalist'); dl.id = 'dl'; dl.innerHTML = [...new Set(s.rows.map(x => x.cells[col]).filter(Boolean))].map(v => `<option value="${esc(v)}">`).join(''); td.append(dl); }
  td.textContent = ''; td.append(inp); inp.focus(); inp.select();
  let done = false;
  const commit = ok => { if (done) return; done = true; if (ok) setCell(r, col, inp.value); render(); };
  inp.addEventListener('blur', () => commit(true));
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') commit(true); if (e.key === 'Escape') commit(false); });
}

document.addEventListener('click', e => {
  const t = e.target;
  const tabBtn = t.closest('#tabs button'); if (tabBtn) { ui.tab = tabBtn.dataset.tab; render(); return; }
  const go = t.closest('[data-tab-go]'); if (go) { e.preventDefault(); ui.tab = go.dataset.tabGo; render(); return; }
  if (t.closest('a[href]') && t.closest('td')) return;
  const th = t.closest('th[data-sort]');
  if (th) { const c = th.dataset.sort; ui.sort = ui.sort?.col === c ? (ui.sort.dir > 0 ? { col: c, dir: -1 } : null) : { col: c, dir: 1 }; render(); return; }
  const td = t.closest('td[data-c]');
  if (td && !t.closest('input')) {
    const s = sheet(), c = s.columns.find(x => x.name === td.dataset.c);
    if (c.type === 'bool') { const r = findRow(td.dataset.r); r.cells[c.name] = /^(true|yes)$/i.test(r.cells[c.name]) ? 'FALSE' : 'TRUE'; r.touched = new Date().toISOString(); save(); render(); }
    else startEdit(td);
    return;
  }
  const a = t.closest('[data-act]'); if (!a) return;
  const s = sheet(), r = findRow(a.dataset.r || ui.drawer);
  switch (a.dataset.act) {
    case 'import': openImport(); break;
    case 'open': ui.drawer = a.dataset.r; renderDrawer(); break;
    case 'close': ui.drawer = null; renderDrawer(); break;
    case 'fdim': { const c = a.dataset.c, v = a.dataset.v; if (ui.f[c] === v) delete ui.f[c]; else ui.f[c] = v; render(); break; }
    case 'clearf': ui.f = {}; render(); break;
    case 'theme': { const t = a.dataset.t; if (THEMES.some(x => x.id === t)) { s.theme = t; state.theme = t; save(); render(); } break; }
    case 'savecopy': { const copy = shared; shared = null; state.sheets.push(copy); state.current = copy.id; ui = freshUI(); history.replaceState(null, '', location.pathname); save(); render(); break; }
    case 'resetroles': delete s.roles; save(); render(); break;
    case 'reviewed': s.reviewed = true; save(); render(); break;
    case 'handled': r.handled ||= {}; r.handled[a.dataset.w] = parseDate(r.cells[a.dataset.w]); r.touched = new Date().toISOString(); save(); render(); break;
    case 'snooze': { const d = parseDate(r.cells[a.dataset.w]); r.cells[a.dataset.w] = addDays(d, 7); save(); render(); break; }
    case 'addrow': { const row = { id: uid(), touched: new Date().toISOString(), notes: [], handled: {}, cells: Object.fromEntries(s.columns.map(c => [c.name, ''])) }; s.rows.unshift(row); ui.sort = null; save(); render(); break; }
    case 'addnote': { const v = $('#noteIn').value.trim(); if (v) { r.notes.push({ t: new Date().toISOString(), text: v }); r.touched = new Date().toISOString(); save(); render(); } break; }
    case 'delrow': if (confirm('Delete this row?')) { s.rows = s.rows.filter(x => x !== findRow(ui.drawer)); ui.drawer = null; save(); render(); } break;
  }
});
document.addEventListener('input', e => {
  if (e.target.id === 'q') { ui.q = e.target.value; const p = e.target.selectionStart; render(); const q = $('#q'); q.focus(); q.setSelectionRange(p, p); }
});
document.addEventListener('change', e => {
  const t = e.target, s = sheet(); if (!s) return;
  if (t.id === 'sf') { ui.sf = t.value; render(); }
  else if (t.dataset.fsel) { if (t.value) ui.f[t.dataset.fsel] = t.value; else delete ui.f[t.dataset.fsel]; render(); }
  else if (t.dataset.role) {
    const k = t.dataset.role; s.roles ||= {};
    if (t.value) s.roles[k] = t.value; else delete s.roles[k];
    if (k === 'measure') { delete s.roles.agg; delete s.roles.polarity; } // follow the new measure's defaults
    save(); render();
  }
  else if (t.dataset.set) { s[t.dataset.set] = t.dataset.set === 'staleDays' ? Math.max(0, +t.value || 0) : t.value; save(); render(); }
  else if (t.dataset.watch) {
    const col = t.dataset.watch;
    if (t.checked) s.watches.push({ col, offset: 0 }); else s.watches = s.watches.filter(w => w.col !== col);
    save(); render();
  }
  else if (t.dataset.offset) { s.watches.find(w => w.col === t.dataset.offset).offset = +t.value || 0; save(); }
  else if (t.dataset.type) {
    const c = s.columns.find(x => x.name === t.dataset.type); c.type = t.value;
    if (c.type === 'date') { c.order = dateOrder(s.rows.map(r => r.cells[c.name])); s.rows.forEach(r => { r.cells[c.name] = parseDate(r.cells[c.name], c.order) || r.cells[c.name]; }); }
    ui.f = {}; save(); render();
  }
});
$('#wsSelect').addEventListener('change', e => { state.current = e.target.value; ui = freshUI(); save(); render(); });
$('#btnDelete').addEventListener('click', () => { const s = sheet(); if (s && confirm(`Delete "${s.name}"? This cannot be undone.`)) { state.sheets = state.sheets.filter(x => x !== s); state.current = state.sheets[0]?.id || null; ui = freshUI(); save(); render(); } });
/* ---------- export & share ---------- */
const outDlg = $('#outDlg'), outForm = $('#outForm');
const TYPES = ['text', 'longtext', 'number', 'money', 'percent', 'date', 'status', 'bool', 'email', 'link'];
const selectedIds = () => [...outForm.querySelectorAll('input[data-sec]:checked')].map(i => i.value);
const filterNote = () => { const e = Object.entries(ui.f); return e.length ? `<p class="muted">Filtered by: ${e.map(([k, v]) => `${esc(k)} = ${esc(v)}`).join(', ')}</p>` : ''; };

function exportBody(ids) {
  const wrap = document.createElement('div');
  ids.forEach(id => { const el = $(`#main section[data-sec="${id}"]`); if (el) wrap.append(el.cloneNode(true)); });
  wrap.querySelectorAll('.tools,.review,select,button,.ui-only').forEach(n => n.remove());
  wrap.querySelectorAll('a[data-act]').forEach(a => { const sp = document.createElement('span'); sp.className = 'lnk'; sp.innerHTML = a.innerHTML; a.replaceWith(sp); });
  wrap.querySelectorAll('[data-act],[data-c],[data-v],[data-r],[data-tab-go]').forEach(n => ['data-act', 'data-c', 'data-v', 'data-r', 'data-tab-go'].forEach(a => n.removeAttribute(a)));
  return filterNote() + wrap.innerHTML;
}
async function getCSS() {
  try { return await (await fetch('style.css')).text(); }
  catch (e) { return [...document.styleSheets].flatMap(ss => { try { return [...ss.cssRules].map(r => r.cssText); } catch (e2) { return []; } }).join('\n'); }
}
const standaloneDoc = (name, body, css, theme, autoPrint) => `<!doctype html><html lang="en" data-theme="${esc(theme)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(name)} · ${esc(BRAND)}</title><style>${css}</style></head><body class="static"><header class="top"><div class="brand"><b>${esc(BRAND)}</b></div><span class="muted">${esc(name)}</span></header><main>${body}</main><footer class="credit">${creditsInner()}</footer>${autoPrint ? '<script>onload=()=>setTimeout(()=>print(),400)<\/script>' : ''}</body></html>`;
function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
const fileSafe = n => n.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'dashboard';
function dataCSV(s) {
  const q = v => /[",\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : v;
  return [s.columns.map(c => q(c.name)).join(','), ...filteredRows(s).map(r => s.columns.map(c => q(r.cells[c.name] ?? '')).join(','))].join('\n');
}

// compact, URL-safe packing (deflate when the browser supports it)
const b64u = bytes => { let t = ''; for (let i = 0; i < bytes.length; i += 0x8000) t += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(t).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = t => { const bin = atob(t.replace(/-/g, '+').replace(/_/g, '/')); const b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return b; };
async function pack(obj) {
  const raw = new TextEncoder().encode(JSON.stringify(obj));
  if (window.CompressionStream) return 'z' + b64u(new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()));
  return 'r' + b64u(raw);
}
async function unpack(tok) {
  const bytes = unb64u(tok.slice(1));
  if (tok[0] === 'z') return JSON.parse(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text());
  return JSON.parse(new TextDecoder().decode(bytes));
}

function openOut(mode) {
  const s = sheet(); if (!s) return;
  ui.tab = 'dash'; render();
  const secs = [...document.querySelectorAll('#main section[data-sec]')].map(e => ({ id: e.dataset.sec, label: e.dataset.label }));
  const checks = `<div class="checks">${secs.map(x => `<label><input type="checkbox" data-sec value="${esc(x.id)}" checked> ${esc(x.label)}</label>`).join('')}</div>`;
  const note = Object.keys(ui.f).length ? ' Your current filters are applied.' : '';
  outDlg.dataset.mode = mode;
  outForm.innerHTML = mode === 'export'
    ? `<h2>Export dashboard</h2><p class="muted">Tick what to include.${note}</p>${checks}
       <div class="radios"><label><input type="radio" name="fmt" value="html" checked> <span><b>Web page (.html)</b><br><span class="muted">One self-contained file in the chosen style. Opens anywhere, no internet needed.</span></span></label>
       <label><input type="radio" name="fmt" value="pdf"> <span><b>PDF</b><br><span class="muted">Opens the print dialog; choose “Save as PDF”.</span></span></label>
       <label><input type="radio" name="fmt" value="csv"> <span><b>Data (.csv)</b><br><span class="muted">The rows currently shown, without charts (the ticks above don't apply).</span></span></label></div>
       <div class="row"><button type="button" class="primary" id="outGo">Export</button><button value="cancel">Close</button></div><div class="muted" id="outMsg"></div>`
    : `<h2>Share this dashboard</h2><p class="muted">Tick what to include.${note}</p>${checks}
       <div class="radios"><label><input type="radio" name="smode" value="snap" checked> <span><b>View-only snapshot</b><br><span class="muted">Contains only the ticked sections. No raw rows are included.</span></span></label>
       <label><input type="radio" name="smode" value="live"> <span><b>Interactive copy</b><br><span class="muted">Contains every row, so people can filter and explore. Ticks above don't apply.</span></span></label></div>
       <div class="row"><button type="button" class="primary" id="outGo">Create link</button><button value="cancel">Close</button></div>
       <div class="linkbox" id="linkBox" hidden><input id="linkOut" readonly><button type="button" id="linkCopy">Copy</button></div>
       <div class="muted" id="outMsg">There is no server: the link itself carries the data (compressed). Anyone with the link can read it, and chat apps may keep a copy, so don't share confidential sheets this way.</div>`;
  outDlg.showModal();
}
$('#btnOut').addEventListener('click', () => openOut('export'));
$('#btnShare').addEventListener('click', () => openOut('share'));
outDlg.addEventListener('click', async e => {
  const s = sheet(), msg = $('#outMsg');
  if (e.target.id === 'linkCopy') { try { await navigator.clipboard.writeText($('#linkOut').value); msg.textContent = 'Link copied.'; } catch (x) { $('#linkOut').select(); msg.textContent = 'Press Ctrl/Cmd+C to copy.'; } return; }
  if (e.target.id !== 'outGo') return;
  const ids = selectedIds(), name = s.name, theme = curTheme();
  try {
    if (outDlg.dataset.mode === 'export') {
      const fmt = outForm.querySelector('input[name=fmt]:checked').value;
      if (fmt === 'csv') { download(`${fileSafe(name)}.csv`, dataCSV(s), 'text/csv'); msg.textContent = 'Downloaded.'; return; }
      if (!ids.length) { msg.textContent = 'Tick at least one section.'; return; }
      const doc = standaloneDoc(name, exportBody(ids), await getCSS(), theme, fmt === 'pdf');
      if (fmt === 'html') { download(`${fileSafe(name)}-dashboard.html`, doc, 'text/html'); msg.textContent = 'Downloaded.'; }
      else { const w = window.open('', '_blank'); if (!w) { msg.textContent = 'Your browser blocked the new window; allow pop-ups and try again.'; return; } w.document.write(doc); w.document.close(); msg.textContent = 'Print dialog opened in a new tab.'; }
    } else {
      const live = outForm.querySelector('input[name=smode]:checked').value === 'live';
      if (!live && !ids.length) { msg.textContent = 'Tick at least one section.'; return; }
      const payload = live
        ? { v: 1, k: 'sheet', t: theme, s: { name, columns: s.columns.map(({ name, type, order, desc, formula }) => ({ name, type, order, desc, formula })), rows: s.rows.map(r => s.columns.map(c => r.cells[c.name] ?? '')), titleCol: s.titleCol, statusCol: s.statusCol, doneStatuses: s.doneStatuses, roles: s.roles || {}, fromXlsx: !!s.fromXlsx } }
        : { v: 1, k: 'snap', t: theme, n: name, h: exportBody(ids) };
      const url = `${location.origin}${location.pathname}#share=${await pack(payload)}`, kb = Math.round(url.length / 1024);
      if (url.length > 600000) { msg.textContent = `This link would be ${kb} KB, too long to share reliably. Use Export (web page) instead, or share a snapshot.`; return; }
      $('#linkBox').hidden = false; $('#linkOut').value = url; $('#linkOut').select();
      msg.textContent = `Link created (${kb} KB). ${kb > 30 ? 'Long links can be cut off by some chat apps; if so, send the exported web page instead. ' : ''}Anyone with it can read the ${live ? 'full data' : 'snapshot'}.`;
    }
  } catch (err) { msg.textContent = 'Something went wrong: ' + err.message; }
});



/* ---------- import ---------- */
const dlg = $('#importDlg');
let matrix = false;
function openImport() { $('#importMsg').textContent = ''; $('#pasteIn').value = ''; $('#fileIn').value = ''; $('#nameIn').value = ''; dlg.showModal(); }
$('#btnImport').addEventListener('click', openImport);
function addSheet(name, table, fx) {
  if (table.length < 2) return null;
  const s = buildSheet(name, table, fx);
  if (!s.rows.length) return null;
  if (fx) s.fromXlsx = true;
  state.sheets.push(s); state.current = s.id;
  if (matrix) { s.statusCol = 'Block'; s.titleCol = 'Item'; s.watches = []; s.note = 'Matrix layout detected: side-by-side price blocks were converted to one record per block, section, item and plan.'; matrix = false; }
  return s;
}
const formulaOnly = (table, fx) => {
  if (table.length < 2) return true;
  const fcols = new Set(Object.keys(fx.fm).map(Number)), h = pickHeader(table), hEnd = table[h].reduce((e, x, i) => x.trim() ? i : e, -1);
  return !table.slice(h + 1).some(r => r.some((v, i) => i <= hEnd && !fcols.has(i) && String(v ?? '').trim() !== ''));
};
const tableOf = text => {
  let table = parseTable(text);
  const blank = table[0] ? table[0].filter(c => !c.trim()).length / table[0].length : 0;
  const flat = blank > .3 && unpivot(parseTable(text, true));
  if (flat) { matrix = true; return { table: flat, flat: true }; }
  return { table };
};
// returns [{ name, text, fx }] — one entry per tab for Excel files
async function fileToSheets(f) {
  const base = f.name.replace(/\.[^.]+$/, '');
  if (!/\.xlsx?$/i.test(f.name)) return [{ name: base, text: await f.text() }];
  if (!window.XLSX) await new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; sc.onload = res; sc.onerror = () => rej(new Error('Could not load the Excel reader (offline?). Save as CSV instead.')); document.head.append(sc); });
  const wb = XLSX.read(await f.arrayBuffer(), { cellDates: true, cellFormula: true, dateNF: 'yyyy-mm-dd' });
  return wb.SheetNames.filter(n => wb.Sheets[n]['!ref']).map(n => {
    const ws = wb.Sheets[n], rng = XLSX.utils.decode_range(ws['!ref']), fm = {};
    for (const addr of Object.keys(ws)) { if (addr[0] === '!' || !ws[addr].f) continue; const c = XLSX.utils.decode_cell(addr).c - rng.s.c; fm[c] ||= ws[addr].f; }
    return { name: wb.SheetNames.length > 1 ? `${base} · ${n}` : base, text: XLSX.utils.sheet_to_csv(ws, { dateNF: 'yyyy-mm-dd' }), fx: { fm, off: rng.s.c } };
  });
}
$('#goImport').addEventListener('click', async () => {
  try {
    const f = $('#fileIn').files[0], pasted = $('#pasteIn').value.trim(), custom = $('#nameIn').value.trim();
    if (!f && !pasted) { $('#importMsg').textContent = 'Choose a file or paste some cells first.'; return; }
    const items = f ? await fileToSheets(f) : [{ name: 'Pasted sheet', text: pasted }];
    const added = [], skipped = [];
    for (const it of items) {
      if (it.fx && formulaOnly(parseTable(it.text), it.fx)) { skipped.push(it.name); continue; }
      const { table, flat } = tableOf(it.text);
      const s = addSheet(items.length === 1 && custom ? custom : it.name, table, flat ? null : it.fx);
      s ? added.push(s) : skipped.push(it.name);
    }
    if (!added.length) { $('#importMsg').textContent = 'Need a header row and at least one data row.'; return; }
    if (skipped.length) added.at(-1).note = [added.at(-1).note, `Skipped ${skipped.length} empty tab${skipped.length > 1 ? 's' : ''} (formulas but no data): ${skipped.join(', ')}.`].filter(Boolean).join(' ');
    state.current = added[0].id; ui = freshUI(); save(); render(); dlg.close();
  } catch (err) { $('#importMsg').textContent = err.message; }
});
const off = n => addDays(todayISO(), n);

// Generated sample sheets (fixed seed, so the demo and the docs always show the same data)
const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const pick = (r, a) => a[Math.floor(r() * a.length)];
const dayStr = (y, m, d, add) => addDays(`${y}-${pad(m)}-${pad(d)}`, add);
function sampleTickets() {
  const r = rng(11), agents = ['Maya Chen', 'Luis Ortega', 'Priya Nair', 'Tom Becker', 'Aisha Khan', 'Jonas Weber', 'Elena Rossi', 'Sam Okafor'];
  const prio = { Low: [30, 40], Medium: [16, 26], High: [8, 14], Critical: [3, 6] }, rows = ['Ticket ID,Created,Channel,Category,Priority,Agent,Resolution time (hours),SLA met,Customer satisfaction'];
  for (let i = 0; i < 320; i++) {
    const p = pick(r, ['Low', 'Low', 'Medium', 'Medium', 'Medium', 'High', 'High', 'Critical']), [lo, hi] = prio[p], agent = pick(r, agents);
    const slow = agent === 'Tom Becker' ? 1.5 : agent === 'Aisha Khan' ? .75 : 1, hrs = Math.max(.5, (lo + r() * (hi - lo)) * slow * (1 + (r() - .5) * .5)).toFixed(1);
    const met = hrs < { Low: 48, Medium: 30, High: 16, Critical: 8 }[p] ? 'TRUE' : 'FALSE', csat = Math.max(1, Math.min(5, Math.round(5.2 - hrs / 22 + (r() - .5) * 2)));
    rows.push([`TKT-${1001 + i}`, dayStr(2026, 4, 1, Math.floor(i * 180 / 320 + r() * 3)), pick(r, ['Email', 'Email', 'Live chat', 'Live chat', 'Phone', 'Social']), pick(r, ['Billing', 'Technical', 'Technical', 'Account', 'Shipping', 'Product']), p, agent, hrs, met, csat].join(','));
  }
  return rows.join('\n');
}
function sampleSales() {
  const r = rng(23), reps = ['Alice Moreau', 'Ben Hartley', 'Carla Díaz', 'Dmitri Volkov', 'Emma Larsen', 'Farid Nasser', 'Grace Liu', 'Hugo Martin'];
  const lines = { 'Smart Lamp': 49, 'Desk Pro': 199, 'Air Filter': 89, 'Sound Bar': 149, 'Charging Dock': 39 }, rows = ['Order ID,Order date,Region,Product line,Sales rep,Units,Unit price,Revenue,Discount %'];
  for (let i = 0; i < 420; i++) {
    const region = pick(r, ['North', 'North', 'South', 'East', 'East', 'West', 'Online', 'Online', 'Online']), line = pick(r, Object.keys(lines));
    const units = 1 + Math.floor(r() * (line === 'Desk Pro' ? 6 : 12)) + (region === 'Online' ? 0 : 2), price = lines[line];
    rows.push([`SO-${20001 + i}`, dayStr(2025, 10, 1, Math.floor(i * 330 / 420 + r() * 2)), region, line, pick(r, reps), units, price, units * price, `${Math.round(r() * 3) * 5}%`].join(','));
  }
  return rows.join('\n');
}
function sampleReviews() {
  const r = rng(5), crit = ['Communication', 'Quality of work', 'Reliability', 'Teamwork', 'Initiative', 'Customer focus'];
  const people = ['Anna Lopez', 'Ben Carter', 'Chloe Nguyen', 'Dev Patel', 'Eva Rossi', 'Femi Adeyemi', 'Gus Berg', 'Hana Kim', 'Ivan Petrov', 'Julia Costa'];
  const rows = [`Employee,Reviewed on,${crit.join(',')},Total,Max,Score %`];
  for (let i = 0; i < 60; i++) {
    const bias = (i % people.length) / people.length * 1.2 - .4, v = crit.map((c, j) => Math.max(1, Math.min(5, Math.round(3.6 + bias + (j === 4 ? -.5 : 0) + (r() - .5) * 2.2)))), tot = v.reduce((a, b) => a + b, 0);
    rows.push([people[i % people.length], dayStr(2026, 1, 12, Math.floor(i * 9 / 2)), ...v, tot, 30, `${Math.round(tot / 30 * 100)}%`].join(','));
  }
  return rows.join('\n');
}
const SAMPLE_NAMES = { customers: 'Sample customers', salaries: 'Sample salaries', tickets: 'Support tickets (sample)', sales: 'Sales orders (sample)', reviews: 'Performance reviews (sample)' };
const SAMPLES = {
  tickets: sampleTickets, sales: sampleSales, reviews: sampleReviews,
  customers: () => ['Name,Email,Status,Quote value,Quote sent,Next follow-up,Last contacted', `Acme Roofing,sam@acme.example,Quote sent,"$4,200",${off(-6)},${off(-3)},${off(-6)}`, `Bright Cafe,hello@bright.example,Lead,"$1,500",,${off(0)},${off(-2)}`, `Cole & Sons,cole@sons.example,Negotiating,"$12,000",${off(-12)},${off(5)},${off(-12)}`, `Dune Studio,team@dune.example,Won,"$7,800",${off(-30)},${off(-20)},${off(-20)}`, `Evergreen Ltd,ops@evergreen.example,Quote sent,"$3,100",${off(-9)},${off(-1)},${off(-40)}`, `Fjord Design,hi@fjord.example,Lost,"$2,000",${off(-25)},${off(-15)},${off(-15)}`, `Gamma Plumbing,gp@gamma.example,Lead,$900,,${off(9)},${off(-1)}`].join('\n'),
  salaries: () => ['Employee,Department,Role,Salary,Status,Hire date,Next review,Contract end', `Anna Lopez,Engineering,Developer,"72,000",Active,2021-03-01,${off(-10)},`, `Ben Carter,Sales,Account Exec,"58,500",Active,2022-06-15,${off(12)},`, `Chloe Nguyen,Engineering,Lead,"95,000",Active,2019-01-10,${off(0)},`, `Dev Patel,Support,Agent,"41,000",On review,2023-02-20,${off(-4)},${off(25)}`, `Eva Rossi,Marketing,Manager,"67,000",Active,2020-09-01,${off(40)},`, `Femi Adeyemi,Sales,Intern,"24,000",Active,2024-05-01,${off(30)},${off(20)}`, `Gus Berg,Support,Agent,"39,500",Left,2021-11-11,,`].join('\n')
};
dlg.addEventListener('click', e => {
  const k = e.target.dataset?.sample; if (!k) return;
  if (addSheet(SAMPLE_NAMES[k], parseTable(SAMPLES[k]()))) { ui = freshUI(); save(); render(); dlg.close(); }
});

// opening a share link
function sheetFromPayload(p) {
  const d = p.s; if (!d || !Array.isArray(d.columns) || !Array.isArray(d.rows)) throw new Error('This link is damaged.');
  const cols = d.columns.slice(0, 200).map(c => ({ name: String(c.name).slice(0, 120), type: TYPES.includes(c.type) ? c.type : 'text', order: c.order === 'dmy' || c.order === 'mdy' ? c.order : undefined, desc: String(c.desc || '').slice(0, 400), formula: String(c.formula || '').slice(0, 400) }));
  const now = new Date().toISOString(), str = v => String(v ?? '').slice(0, 200);
  const roles = {}; ['measure', 'agg', 'polarity', 'dim', 'time'].forEach(k => { if (d.roles && typeof d.roles[k] === 'string') roles[k] = d.roles[k].slice(0, 120); });
  return { id: uid(), name: str(d.name) || 'Shared dashboard', columns: cols, rows: d.rows.slice(0, 50000).map(a => ({ id: uid(), touched: now, notes: [], handled: {}, cells: Object.fromEntries(cols.map((c, i) => [c.name, String(a[i] ?? '')])) })),
    titleCol: cols.some(c => c.name === d.titleCol) ? d.titleCol : cols[0]?.name || '', statusCol: cols.some(c => c.name === d.statusCol) ? d.statusCol : '', doneStatuses: str(d.doneStatuses), lastCol: '', staleDays: 0, watches: [], fOff: 0,
    roles, theme: THEMES.some(t => t.id === p.t) ? p.t : 'clean', reviewed: true, note: '', fromXlsx: !!d.fromXlsx };
}
async function boot() {
  const m = location.hash.match(/^#share=([\w-]+)$/);
  if (!m) { render(); return; }
  try {
    const p = await unpack(m[1]);
    if (!p || p.v !== 1) throw new Error('unsupported link');
    if (p.k === 'sheet') { shared = sheetFromPayload(p); ui = freshUI(); render(); return; }
    if (p.k === 'snap' && typeof p.h === 'string') {
      const theme = THEMES.some(t => t.id === p.t) ? p.t : 'clean';
      document.documentElement.dataset.theme = theme; document.title = `${String(p.n).slice(0, 100)} · ${BRAND}`;
      document.body.classList.add('snapview'); $('#credit').hidden = true;
      $('.brand').innerHTML = `<b>${esc(BRAND)}</b>`;
      $('#sharebar').innerHTML = `<div class="sharebar"><b>Shared dashboard</b><span class="muted">View-only snapshot of “${esc(String(p.n).slice(0, 100))}”.</span><a href="${esc(location.pathname)}">Make your own dashboard</a></div>`;
      // the snapshot HTML comes from the link, so it is shown in a sandbox without scripts
      const v = $('#viewer'); v.hidden = false;
      v.innerHTML = '<iframe sandbox="allow-popups allow-popups-to-escape-sandbox" title="Shared dashboard"></iframe>';
      v.firstChild.srcdoc = standaloneDoc(String(p.n).slice(0, 100), p.h, await getCSS(), theme, false).replace('<body class="static">', '<body class="static"><base target="_blank">');
      return;
    }
    throw new Error('unsupported link');
  } catch (err) {
    render(); $('#main').insertAdjacentHTML('afterbegin', `<div class="card">That share link could not be opened (${esc(err.message)}). Ask for a new one, or <a href="${esc(location.pathname)}">start your own dashboard</a>.</div>`);
  }
}
boot();
})();
