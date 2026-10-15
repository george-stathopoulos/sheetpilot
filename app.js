(() => {
'use strict';
const KEY = 'sheetpilot.v1';
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => Math.random().toString(36).slice(2, 10);

/* ---------- state ---------- */
let state = { sheets: [], current: null };
let ui = { tab: 'today', sort: null, q: '', sf: '', drawer: null };
try { state = JSON.parse(localStorage.getItem(KEY)) || state; } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} };
const sheet = () => state.sheets.find(s => s.id === state.current);

/* ---------- dates & numbers ---------- */
const pad = n => String(n).padStart(2, '0');
const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayISO = () => isoOf(new Date());
const toUTC = iso => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const addDays = (iso, n) => new Date(toUTC(iso) + n * 864e5).toISOString().slice(0, 10);
const diffDays = (a, b) => Math.round((toUTC(b) - toUTC(a)) / 864e5); // b - a
function parseDate(v) {
  if (v instanceof Date) return isNaN(v) ? null : isoOf(v);
  const s = String(v ?? '').trim();
  let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/))) return valid(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/))) {
    let a = +m[1], b = +m[2], y = +m[3]; if (y < 100) y += 2000;
    return a > 12 ? valid(y, b, a) : b > 12 ? valid(y, a, b) : valid(y, a, b); // ambiguous: month first
  }
  return null;
}
function valid(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? `${y}-${pad(m)}-${pad(d)}` : null;
}
function num(v) {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').replace(/[^\d.,\-]/g, '');
  if (!s) return null;
  const n = parseFloat(s.includes(',') && s.includes('.') ? s.replace(/,/g, '') : s.replace(/,(?=\d{3}\b)/g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
}
const fmtNum = n => n == null ? '' : new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);

/* ---------- parsing ---------- */
function parseTable(text) {
  text = text.replace(/^﻿/, '');
  const first = text.split(/\r?\n/, 1)[0];
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
  return rows.filter(r => r.some(c => c.trim() !== ''));
}

const DONE_RE = /^(won|lost|closed|done|paid|complete[d]?|resolved|inactive|left|terminated|cancel+ed|archived|rejected)$/i;
function inferType(name, vals) {
  const v = vals.filter(x => String(x).trim() !== '');
  if (!v.length) return 'text';
  const frac = f => v.filter(f).length / v.length;
  if (frac(x => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(x).trim())) > .8) return 'email';
  if (frac(x => parseDate(x)) > .8) return 'date';
  if (/status|stage|state$/i.test(name)) return 'status';
  if (frac(x => num(x) != null && /^[\s$€£]*-?[\d.,]+\s*[$€£%]?$/.test(String(x))) > .9) {
    return /salary|price|amount|value|cost|revenue|total|pay|fee|budget|bonus|wage/i.test(name) || v.some(x => /[$€£]/.test(x)) ? 'money' : 'number';
  }
  const uniq = new Set(v.map(x => String(x).trim().toLowerCase()));
  if (uniq.size <= 8 && uniq.size < v.length / 2) return 'status';
  return 'text';
}

function buildSheet(name, table) {
  const headers = table[0].map((h, i) => (h || '').trim() || `Column ${i + 1}`);
  const seen = {}; const names = headers.map(h => { seen[h] = (seen[h] || 0) + 1; return seen[h] > 1 ? `${h} ${seen[h]}` : h; });
  const body = table.slice(1);
  const columns = names.map((n, i) => ({ name: n, type: inferType(n, body.map(r => r[i] ?? '')) }));
  const now = new Date().toISOString();
  const rows = body.map(r => ({
    id: uid(), touched: now, notes: [], handled: {},
    cells: Object.fromEntries(columns.map((c, i) => [c.name, c.type === 'date' ? (parseDate(r[i]) || (r[i] ?? '').trim()) : (r[i] ?? '').trim()]))
  }));
  const pick = t => columns.find(c => c.type === t)?.name || '';
  const statusCol = pick('status');
  const doneStatuses = statusCol ? [...new Set(rows.map(r => r.cells[statusCol]).filter(v => DONE_RE.test(v)))].join(', ') : '';
  return {
    id: uid(), name, columns, rows, statusCol, doneStatuses,
    titleCol: (columns.find(c => c.type === 'text') || columns[0]).name,
    amountCol: pick('money') || pick('number'),
    lastCol: columns.find(c => c.type === 'date' && /last|contact|touch/i.test(c.name))?.name || '',
    staleDays: 0,
    watches: columns.filter(c => c.type === 'date' && /follow|due|review|renew|next|expir|deadline|remind|end/i.test(c.name)).map(c => ({ col: c.name, offset: 0 }))
  };
}

/* ---------- workflow logic ---------- */
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
const title = (s, r) => r.cells[s.titleCol] || '(untitled)';

/* ---------- rendering ---------- */
function render() {
  const sel = $('#wsSelect');
  sel.innerHTML = state.sheets.map(s => `<option value="${s.id}" ${s.id === state.current ? 'selected' : ''}>${esc(s.name)}</option>`).join('') || '<option>No sheets yet</option>';
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === ui.tab));
  const s = sheet(); const m = $('#main');
  if (!s) { m.innerHTML = `<div class="card"><h2>Turn any sheet into a tracked workflow</h2><p class="muted">Import a CSV or Excel file, paste cells, or try a sample (customers, salaries). SheetPilot detects dates, money and statuses, then gives you reminders and insights.</p><button class="primary" data-act="import">Import a sheet</button></div>`; renderDrawer(); return; }
  m.innerHTML = { today: viewToday, table: viewTable, insights: viewInsights, setup: viewSetup }[ui.tab](s);
  renderDrawer();
}

function rem(s, it, kind) {
  const label = kind === 'overdue' ? `${-it.diff}d overdue` : kind === 'today' ? 'today' : `in ${it.diff}d`;
  const cls = kind === 'overdue' ? 'red' : kind === 'today' ? 'amber' : 'green';
  return `<div class="item"><div class="t"><a data-act="open" data-r="${it.r.id}">${esc(title(s, it.r))}</a><div class="muted">${esc(it.w.col)}: ${esc(it.due)}${s.statusCol ? ' · ' + esc(it.r.cells[s.statusCol]) : ''}</div></div>
    <span class="badge ${cls}">${label}</span>
    <button data-act="snooze" data-r="${it.r.id}" data-w="${esc(it.w.col)}" title="Move the date 7 days later">+7d</button>
    <button data-act="handled" data-r="${it.r.id}" data-w="${esc(it.w.col)}">Done</button></div>`;
}
function section(h, items, fn) { return `<h2>${h} (${items.length})</h2><div class="list">${items.length ? items.map(fn).join('') : '<div class="empty">Nothing here.</div>'}</div>`; }

function viewToday(s) {
  const a = analyse(s);
  const active = s.rows.filter(r => !isDone(s, r));
  let h = `<div class="cards">
    <div class="card red"><div class="n">${a.overdue.length}</div>Overdue</div>
    <div class="card amber"><div class="n">${a.today.length}</div>Due today</div>
    <div class="card green"><div class="n">${a.soon.length}</div>Next 14 days</div>
    <div class="card"><div class="n">${s.staleDays > 0 ? a.stale.length : '–'}</div>${s.staleDays > 0 ? `Untouched ${s.staleDays}+ days` : 'Stale rule off'}</div>
    <div class="card"><div class="n">${active.length}</div>Active rows</div></div>`;
  if (!s.watches.length) h += `<div class="card">No date columns are being watched yet. Open <a href="#" data-tab-go="setup">Setup</a> and tick the dates that should trigger reminders (for example <i>Follow-up date</i> or <i>Review date</i>).</div>`;
  h += section('Overdue', a.overdue, it => rem(s, it, 'overdue')) + section('Due today', a.today, it => rem(s, it, 'today')) + section('Coming up', a.soon, it => rem(s, it, 'soon'));
  if (s.staleDays > 0) h += section('Gone quiet', a.stale, it => `<div class="item"><div class="t"><a data-act="open" data-r="${it.r.id}">${esc(title(s, it.r))}</a></div><span class="badge amber">${it.age}d no activity</span></div>`);
  return h;
}

function visibleRows(s) {
  let rows = s.rows.slice();
  const q = ui.q.toLowerCase();
  if (q) rows = rows.filter(r => Object.values(r.cells).some(v => String(v).toLowerCase().includes(q)));
  if (ui.sf && s.statusCol) rows = rows.filter(r => r.cells[s.statusCol] === ui.sf);
  if (ui.sort) {
    const c = s.columns.find(x => x.name === ui.sort.col); const k = ui.sort.dir;
    rows.sort((a, b) => {
      let x = a.cells[c.name], y = b.cells[c.name];
      if (c.type === 'number' || c.type === 'money') { x = num(x) ?? -Infinity; y = num(y) ?? -Infinity; }
      else { x = String(x ?? '').toLowerCase(); y = String(y ?? '').toLowerCase(); }
      return (x > y ? 1 : x < y ? -1 : 0) * k;
    });
  }
  return rows;
}
function viewTable(s) {
  const statuses = s.statusCol ? [...new Set(s.rows.map(r => r.cells[s.statusCol]).filter(Boolean))] : [];
  const rows = visibleRows(s); const t = todayISO();
  const watched = new Set(s.watches.map(w => w.col));
  return `<div class="tools"><input id="q" placeholder="Search…" value="${esc(ui.q)}">
    ${statuses.length ? `<select id="sf"><option value="">All ${esc(s.statusCol)}</option>${statuses.map(v => `<option ${v === ui.sf ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>` : ''}
    <div class="spacer"></div><span class="muted">${rows.length} of ${s.rows.length} rows · click a cell to edit</span><button data-act="addrow">+ Row</button></div>
  <div class="tablewrap"><table><thead><tr><th></th>${s.columns.map(c => `<th data-sort="${esc(c.name)}">${esc(c.name)}${ui.sort?.col === c.name ? (ui.sort.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('')}</tr></thead>
  <tbody>${rows.map(r => `<tr class="${isDone(s, r) ? 'muted' : ''}"><td><a data-act="open" data-r="${r.id}" style="cursor:pointer">↗</a></td>${s.columns.map(c => {
      const v = r.cells[c.name] ?? ''; const isNum = c.type === 'number' || c.type === 'money';
      const over = c.type === 'date' && watched.has(c.name) && !isDone(s, r) && parseDate(v) && parseDate(v) < t && r.handled?.[c.name] !== parseDate(v);
      return `<td data-r="${r.id}" data-c="${esc(c.name)}" class="${isNum ? 'num' : ''} ${c.type === 'date' ? 'date' : ''} ${over ? 'over' : ''}">${esc(isNum ? fmtNum(num(v)) || v : v)}</td>`;
    }).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function viewInsights(s) {
  const a = analyse(s); const active = s.rows.filter(r => !isDone(s, r));
  const amt = r => (s.amountCol ? num(r.cells[s.amountCol]) : null) ?? 0;
  let h = `<div class="cards"><div class="card"><div class="n">${s.rows.length}</div>Rows</div><div class="card"><div class="n">${active.length}</div>Active</div>
    ${s.amountCol ? `<div class="card"><div class="n">${fmtNum(active.reduce((t, r) => t + amt(r), 0))}</div>${esc(s.amountCol)} (active)</div>` : ''}
    <div class="card red"><div class="n">${a.overdue.length}</div>Overdue</div></div>`;
  if (s.statusCol) {
    const g = {}; for (const r of s.rows) { const k = r.cells[s.statusCol] || '(empty)'; (g[k] ||= { n: 0, sum: 0 }); g[k].n++; g[k].sum += amt(r); }
    const key = s.amountCol ? 'sum' : 'n'; const max = Math.max(...Object.values(g).map(x => x[key]), 1);
    h += `<h2>By ${esc(s.statusCol)}</h2><div class="list">${Object.entries(g).sort((x, y) => y[1][key] - x[1][key]).map(([k, v]) =>
      `<div class="item"><div style="width:140px">${esc(k)}</div><div class="t"><div class="bar" style="width:${v[key] / max * 100}%"></div></div><div>${v.n} rows${s.amountCol ? ' · ' + fmtNum(v.sum) : ''}</div></div>`).join('')}</div>`;
  }
  const nums = s.columns.filter(c => c.type === 'number' || c.type === 'money');
  if (nums.length) {
    h += `<h2>Numeric columns</h2><div class="tablewrap"><table class="coltab"><thead><tr><th>Column</th><th>Sum</th><th>Average</th><th>Min</th><th>Max</th></tr></thead><tbody>${nums.map(c => {
      const v = s.rows.map(r => num(r.cells[c.name])).filter(x => x != null);
      const sum = v.reduce((x, y) => x + y, 0);
      return `<tr><td>${esc(c.name)}</td><td>${fmtNum(sum)}</td><td>${fmtNum(v.length ? sum / v.length : null)}</td><td>${fmtNum(Math.min(...v))}</td><td>${fmtNum(Math.max(...v))}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  }
  if (s.amountCol) {
    const top = active.slice().sort((x, y) => amt(y) - amt(x)).slice(0, 5);
    h += `<h2>Top 5 active by ${esc(s.amountCol)}</h2><div class="list">${top.map(r => `<div class="item"><div class="t"><a data-act="open" data-r="${r.id}">${esc(title(s, r))}</a></div><div>${fmtNum(amt(r))}</div></div>`).join('')}</div>`;
  }
  return h;
}

function viewSetup(s) {
  const opts = (sel, filter = () => true, none = '— none —') => `<option value="">${none}</option>` + s.columns.filter(filter).map(c => `<option ${c.name === sel ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
  const dates = s.columns.filter(c => c.type === 'date');
  return `<div class="setup">
    <label>Sheet name<input data-set="name" value="${esc(s.name)}"></label>
    <label>Title column <span>Shown as the name of each row.</span><select data-set="titleCol">${opts(s.titleCol, () => true, '—')}</select></label>
    <label>Status column <span>Stage of each row (Lead, Active, On review…).</span><select data-set="statusCol">${opts(s.statusCol)}</select></label>
    <label>Finished statuses <span>Comma-separated. Rows with these statuses are left out of reminders and totals.</span><input data-set="doneStatuses" value="${esc(s.doneStatuses)}"></label>
    <label>Amount column <span>Money value to total (deal value, salary, cost…).</span><select data-set="amountCol">${opts(s.amountCol, c => c.type === 'money' || c.type === 'number')}</select></label>
    <label>Last contacted column <span>Optional. Used by the "gone quiet" rule.</span><select data-set="lastCol">${opts(s.lastCol, c => c.type === 'date')}</select></label>
    <label>Flag rows with no activity for (days) <span>0 turns it off. Editing a row or adding a note counts as activity.</span><input type="number" min="0" data-set="staleDays" value="${s.staleDays}"></label>
    <div><b>Dates that trigger reminders</b><div class="muted">Offset shifts the reminder: <code>3</code> = three days after the date, <code>-30</code> = thirty days before (e.g. contract end).</div>
      ${dates.length ? dates.map(c => { const w = s.watches.find(x => x.col === c.name); return `<div class="row" style="margin-top:6px"><label class="row" style="font-weight:400"><input type="checkbox" data-watch="${esc(c.name)}" ${w ? 'checked' : ''}> ${esc(c.name)}</label><input type="number" data-offset="${esc(c.name)}" value="${w ? w.offset : 0}" style="width:80px" ${w ? '' : 'disabled'}> <span class="muted">days</span></div>`; }).join('') : '<div class="muted">No date columns detected. Change a column type below to Date.</div>'}</div>
    <div><b>Column types</b><div class="tablewrap" style="margin-top:6px"><table class="coltab"><tbody>${s.columns.map(c => `<tr><td>${esc(c.name)}</td><td><select data-type="${esc(c.name)}">${['text', 'number', 'money', 'date', 'status', 'email'].map(t => `<option ${t === c.type ? 'selected' : ''}>${t}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div></div>
  </div>`;
}

function renderDrawer() {
  const d = $('#drawer'); const s = sheet(); const r = s && s.rows.find(x => x.id === ui.drawer);
  if (!r) { d.hidden = true; return; }
  d.hidden = false;
  d.innerHTML = `<div class="row"><h3 style="flex:1">${esc(title(s, r))}</h3><button data-act="close">Close</button></div>
    <div class="kv">${s.columns.map(c => `<div class="muted">${esc(c.name)}</div><div>${esc(r.cells[c.name] ?? '')}</div>`).join('')}</div>
    <h3>Activity</h3>
    <div class="row"><input id="noteIn" placeholder="Add a note (counts as activity)" style="flex:1"><button class="primary" data-act="addnote">Add</button></div>
    ${r.notes.slice().reverse().map(n => `<div class="note"><div class="muted">${esc(new Date(n.t).toLocaleString())}</div>${esc(n.text)}</div>`).join('') || '<p class="muted">No notes yet.</p>'}
    <p><button class="danger" data-act="delrow">Delete row</button></p>`;
}

/* ---------- actions ---------- */
const findRow = id => sheet()?.rows.find(r => r.id === id);
function setCell(r, col, val) {
  const c = sheet().columns.find(x => x.name === col);
  r.cells[col] = c.type === 'date' ? (parseDate(val) || val.trim()) : val.trim();
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
  const th = t.closest('th[data-sort]');
  if (th) { const c = th.dataset.sort; ui.sort = ui.sort?.col === c ? (ui.sort.dir > 0 ? { col: c, dir: -1 } : null) : { col: c, dir: 1 }; render(); return; }
  const td = t.closest('td[data-c]'); if (td && !t.closest('input')) { startEdit(td); return; }
  const a = t.closest('[data-act]'); if (!a) return;
  const s = sheet(), r = a.dataset.r && findRow(a.dataset.r);
  switch (a.dataset.act) {
    case 'import': openImport(); break;
    case 'open': ui.drawer = a.dataset.r; renderDrawer(); break;
    case 'close': ui.drawer = null; renderDrawer(); break;
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
  else if (t.dataset.set) { s[t.dataset.set] = t.dataset.set === 'staleDays' ? Math.max(0, +t.value || 0) : t.value; save(); render(); }
  else if (t.dataset.watch) {
    const col = t.dataset.watch;
    if (t.checked) s.watches.push({ col, offset: 0 }); else s.watches = s.watches.filter(w => w.col !== col);
    save(); render();
  }
  else if (t.dataset.offset) { s.watches.find(w => w.col === t.dataset.offset).offset = +t.value || 0; save(); }
  else if (t.dataset.type) {
    const c = s.columns.find(x => x.name === t.dataset.type); c.type = t.value;
    if (c.type === 'date') s.rows.forEach(r => { r.cells[c.name] = parseDate(r.cells[c.name]) || r.cells[c.name]; });
    save(); render();
  }
});
$('#wsSelect').addEventListener('change', e => { state.current = e.target.value; ui = { tab: ui.tab, sort: null, q: '', sf: '', drawer: null }; save(); render(); });
$('#btnDelete').addEventListener('click', () => { const s = sheet(); if (s && confirm(`Delete "${s.name}"? This cannot be undone.`)) { state.sheets = state.sheets.filter(x => x !== s); state.current = state.sheets[0]?.id || null; save(); render(); } });
$('#btnExport').addEventListener('click', () => {
  const s = sheet(); if (!s) return;
  const q = v => /[",\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : v;
  const csv = [s.columns.map(c => q(c.name)).join(','), ...s.rows.map(r => s.columns.map(c => q(r.cells[c.name] ?? '')).join(','))].join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `${s.name}.csv`; a.click();
});

/* ---------- import ---------- */
const dlg = $('#importDlg');
function openImport() { $('#importMsg').textContent = ''; $('#pasteIn').value = ''; $('#fileIn').value = ''; $('#nameIn').value = ''; dlg.showModal(); }
$('#btnImport').addEventListener('click', openImport);
function addSheet(name, table) {
  if (table.length < 2) { $('#importMsg').textContent = 'Need a header row and at least one data row.'; return false; }
  const s = buildSheet(name, table); state.sheets.push(s); state.current = s.id;
  ui = { tab: s.watches.length ? 'today' : 'setup', sort: null, q: '', sf: '', drawer: null }; save(); render(); return true;
}
async function fileToTable(f) {
  if (/\.xlsx?$/i.test(f.name)) {
    if (!window.XLSX) await new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; sc.onload = res; sc.onerror = () => rej(new Error('Could not load the Excel reader (offline?). Save as CSV instead.')); document.head.append(sc); });
    const wb = XLSX.read(await f.arrayBuffer(), { cellDates: true });
    return parseTable(XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]], { dateNF: 'yyyy-mm-dd' }));
  }
  return parseTable(await f.text());
}
$('#goImport').addEventListener('click', async () => {
  try {
    const f = $('#fileIn').files[0], pasted = $('#pasteIn').value.trim();
    if (!f && !pasted) { $('#importMsg').textContent = 'Choose a file or paste some cells first.'; return; }
    const table = f ? await fileToTable(f) : parseTable(pasted);
    const name = $('#nameIn').value.trim() || (f ? f.name.replace(/\.[^.]+$/, '') : 'Pasted sheet');
    if (addSheet(name, table)) dlg.close();
  } catch (err) { $('#importMsg').textContent = err.message; }
});
const off = n => addDays(todayISO(), n);
const SAMPLES = {
  customers: () => ['Name,Email,Status,Quote value,Quote sent,Next follow-up,Last contacted', `Acme Roofing,sam@acme.example,Quote sent,"$4,200",${off(-6)},${off(-3)},${off(-6)}`, `Bright Cafe,hello@bright.example,Lead,"$1,500",,${off(0)},${off(-2)}`, `Cole & Sons,cole@sons.example,Negotiating,"$12,000",${off(-12)},${off(5)},${off(-12)}`, `Dune Studio,team@dune.example,Won,"$7,800",${off(-30)},${off(-20)},${off(-20)}`, `Evergreen Ltd,ops@evergreen.example,Quote sent,"$3,100",${off(-9)},${off(-1)},${off(-40)}`, `Fjord Design,hi@fjord.example,Lost,"$2,000",${off(-25)},${off(-15)},${off(-15)}`, `Gamma Plumbing,gp@gamma.example,Lead,$900,,${off(9)},${off(-1)}`].join('\n'),
  salaries: () => ['Employee,Department,Role,Salary,Status,Hire date,Next review,Contract end', `Anna Lopez,Engineering,Developer,"72,000",Active,2021-03-01,${off(-10)},`, `Ben Carter,Sales,Account Exec,"58,500",Active,2022-06-15,${off(12)},`, `Chloe Nguyen,Engineering,Lead,"95,000",Active,2019-01-10,${off(0)},`, `Dev Patel,Support,Agent,"41,000",On review,2023-02-20,${off(-4)},${off(25)}`, `Eva Rossi,Marketing,Manager,"67,000",Active,2020-09-01,${off(40)},`, `Femi Adeyemi,Sales,Intern,"24,000",Active,2024-05-01,${off(30)},${off(20)}`, `Gus Berg,Support,Agent,"39,500",Left,2021-11-11,,`].join('\n')
};
dlg.addEventListener('click', e => {
  const k = e.target.dataset?.sample; if (!k) return;
  if (addSheet(k === 'customers' ? 'Sample customers' : 'Sample salaries', parseTable(SAMPLES[k]()))) dlg.close();
});

render();
})();
