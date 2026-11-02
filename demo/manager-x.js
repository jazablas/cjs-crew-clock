/* CJ's Crew - Clock — manager console, part 2.
   Break planner, team chat, labor vs sales, compliance, tip pooling, checklists, paperwork & training,
   hiring, feedback, integrations, notifications, shift swaps, auto-scheduling and payroll export. */
(() => {
'use strict';
const X = window.MGR; if (!X) return;
const {ic, MIN, HR, DAY, now, startOfDay, at, fTime, fDate, fDay, fShort, fHM, fHrs, money, esc, toDateInput, toTimeInput, fromInputs, workedMs, venueActive} = CC;
const {M, EXT, D, ST, emp, venue, commit, toast, openModal, closeModal, mHead, val, chk, avatar, badge, kpi, empty, vIcon, activeEmps} = X;
const MGRN = () => X.MGR();
const firstName = e => esc((e?.name || '').split(' ')[0]);
const pct = (a, b) => b > 0 ? a / b * 100 : 0;
const fPct = x => `${x.toFixed(1)}%`;
const btns = (...b) => `<div class="row" style="justify-content:flex-end;gap:8px;margin-top:16px;flex-wrap:wrap">${b.join('')}</div>`;
const venuesOn = () => D().venues.filter(venueActive);
const rateOf = (e, role) => e?.roles.find(r=>r.role===role)?.rate ?? e?.roles[0]?.rate ?? 0;
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

Object.assign(M, {bpVenue:'pico', chat:'C-pico', lbVenue:'all', tipDay:null, tipVenue:'pico', hrTab:'docs', obEmp:'all', jobQ:'all'});

/* =====================================================================
   Break planner: who's due when, overlaps, and floor coverage
   ===================================================================== */
function plannedBreaks(entry){
  // entry: {emp, shift, punch}
  const st = ST(), out = [];
  if (entry.punch){
    const bs = CC.breakStatus(entry.punch);
    (entry.punch.breaks||[]).forEach(b => out.push({kind:b.type, start:b.start, end:b.end ?? now(), actual:true, open:!b.end, label: b.type==='meal' ? 'Lunch' : 'Rest'}));
    bs.items.filter(i => ['due','overdue','soon','later'].includes(i.status)).forEach(i => { const s = Math.max(i.dueT, ['due','overdue'].includes(i.status) ? now() : i.dueT); out.push({kind:i.kind, start:s, end:s + i.min*MIN, actual:false, label:i.label, status:i.status}); });
  } else if (entry.shift){
    const len = (entry.shift.endT - entry.shift.startT)/HR; let mealShift = 0;
    (st.breakPlan||[]).slice().sort((a,b)=>a.at-b.at).forEach(i => { if (len < (i.minShift||0)) return; const s = entry.shift.startT + i.at*HR + mealShift; out.push({kind:i.kind, start:s, end:s + i.min*MIN, actual:false, label:i.label}); if (i.kind==='meal') mealShift += i.min*MIN; });
  }
  return out;
}
function plannerRows(vid){
  const t0 = startOfDay(now());
  const shifts = D().shifts.filter(s => s.venue===vid && s.startT>=t0 && s.startT<t0+DAY);
  const punches = D().punches.filter(p => p.venue===vid && !p.voided && p.inT>=t0-6*HR && (!p.outT || p.outT>=t0));
  const ids = [...new Set([...shifts.map(s=>s.emp), ...punches.map(p=>p.emp)])];
  return ids.map(id => { const punch = punches.filter(p=>p.emp===id).sort((a,b)=>b.inT-a.inT)[0] || null; const shift = shifts.find(s=>s.emp===id) || null;
    return {e:emp(id), shift, punch, brks:plannedBreaks({emp:id, shift, punch: punch && !punch.outT ? punch : null})}; })
    .filter(r => r.e).sort((a,b)=>(a.shift?.startT ?? a.punch.inT) - (b.shift?.startT ?? b.punch.inT));
}
function breakConflicts(rows){
  const maxOn = ST().maxOnBreak || 1, list = rows.flatMap(r => r.brks.filter(b => !b.actual || b.open).map(b => ({...b, e:r.e})));
  const out = [];
  list.sort((a,b)=>a.start-b.start).forEach((b, i) => {
    const over = list.filter((c, j) => j !== i && c.start < b.end && c.end > b.start);
    if (over.length >= maxOn && !out.some(o => o.ids.includes(b.e.id) && o.ids.some(x => over.some(c=>c.e.id===x)))){
      const first = [b, ...over].sort((x,y)=>x.start-y.start); const later = first[first.length-1]; const moveTo = first.slice(0,-1).reduce((m,x)=>Math.max(m,x.end), 0);
      out.push({ids:first.map(x=>x.e.id), names:first.map(x=>x.e.name.split(' ')[0]), t:b.start, move:later, moveTo});
    }
  });
  return out;
}
function pBreaks(){
  const vs = venuesOn(), vid = vs.some(v=>v.id===M.bpVenue) ? M.bpVenue : vs[0]?.id; M.bpVenue = vid;
  const rows = plannerRows(vid), t0 = startOfDay(now());
  const starts = rows.map(r => r.shift?.startT ?? r.punch?.inT).filter(Boolean), ends = rows.map(r => Math.max(r.shift?.endT || 0, r.punch?.outT || now()));
  let a = starts.length ? Math.floor((Math.min(...starts) - t0)/HR) : 9, b = ends.length ? Math.ceil((Math.max(...ends) - t0)/HR) : 22;
  a = Math.max(0, Math.min(a, 23)); b = Math.min(30, Math.max(b, a+4));
  const A = t0 + a*HR, span = (b - a)*HR, X0 = t => Math.max(0, Math.min(100, (t - A)/span*100));
  const conf = breakConflicts(rows);
  const slots = []; for (let t = A; t < A + span; t += 30*MIN){ const on = rows.filter(r => { const s = r.punch && (!r.punch.outT || r.punch.outT > t) && r.punch.inT <= t ? true : (!r.punch && r.shift && r.shift.startT <= t && r.shift.endT > t); return s; });
    const brk = on.filter(r => r.brks.some(x => x.start <= t && x.end > t)); slots.push({t, n:on.length - brk.length, b:brk.length}); }
  const maxN = Math.max(1, ...slots.map(s=>s.n + s.b));
  return `
  <div class="toolbar"><div class="chips">${vs.map(v => `<button class="chip ${vid===v.id?'on':''}" data-act="bp-venue" data-v="${v.id}">${esc(v.name)}</button>`).join('')}</div>
    <span class="small muted">Up to <b>${ST().maxOnBreak||1}</b> on break at once · <button class="link" data-act="page" data-v="compliance">change</button></span></div>
  ${conf.length ? conf.map(c => `<div class="alert warn" style="margin-bottom:10px">${ic('alert')}<div class="grow"><b>${c.names.join(' and ')}</b> are both due for a break around ${fTime(c.t)}. Move ${esc(c.move.e.name.split(' ')[0])}&rsquo;s ${esc(c.move.label.toLowerCase())} to about <b>${fTime(c.moveTo)}</b> so the floor stays covered.</div><button class="btn sm" data-act="bp-nudge" data-v="${c.move.e.id}" data-t="${c.moveTo}" data-l="${esc(c.move.label)}">${ic('chat')} Tell ${esc(c.move.e.name.split(' ')[0])}</button></div>`).join('') : rows.length ? `<div class="alert ok" style="margin-bottom:10px">${ic('check')}<div>No break overlaps today at ${esc(venue(vid).name)}.</div></div>` : ''}
  ${rows.length ? `<div class="card tl">
    <div class="tl-axis">${[...Array(b-a+1)].map((_,i) => `<span style="left:${i/(b-a)*100}%">${fTime(A + i*HR).replace(':00','')}</span>`).join('')}</div>
    ${rows.map(r => `<div class="tl-row"><div class="tl-name">${avatar(r.e,26)}<span>${esc(r.e.name)}</span></div><div class="tl-track">
      ${r.shift ? `<i class="tl-shift" style="left:${X0(r.shift.startT)}%;width:${X0(r.shift.endT)-X0(r.shift.startT)}%" title="Scheduled ${fTime(r.shift.startT)}–${fTime(r.shift.endT)}"></i>` : ''}
      ${r.punch ? `<i class="tl-work" style="left:${X0(r.punch.inT)}%;width:${X0(r.punch.outT||now())-X0(r.punch.inT)}%"></i>` : ''}
      ${r.brks.map(x => `<i class="tl-brk ${x.kind==='meal'?'meal':''} ${x.actual?'act':''} ${x.status==='overdue'||x.status==='due'?'due':''}" style="left:${X0(x.start)}%;width:${Math.max(.8, X0(x.end)-X0(x.start))}%" title="${esc(x.label)} ${x.actual?'taken':'planned'} ${fTime(x.start)}"></i>`).join('')}
    </div></div>`).join('')}
    <div class="tl-row"><div class="tl-name small muted">On the floor</div><div class="tl-track cov">${slots.map(s => `<i style="left:${X0(s.t)}%;width:${100/slots.length}%;height:${(s.n/maxN*100).toFixed(0)}%" class="${s.n<=1 && s.n+s.b>0?'thin':''}" title="${fTime(s.t)}: ${s.n} working, ${s.b} on break"></i>`).join('')}</div></div>
    ${now() >= A && now() <= A+span ? `<div class="tl-now" style="left:calc(var(--tl-l) + (100% - var(--tl-l)) * ${X0(now())/100})"></div>` : ''}
  </div>
  <div class="tl-legend small muted"><span><i class="tl-shift"></i> Scheduled</span><span><i class="tl-work"></i> On the clock</span><span><i class="tl-brk act"></i> Break taken</span><span><i class="tl-brk"></i> Break planned</span><span><i class="tl-brk meal"></i> Lunch planned</span><span><i class="tl-brk due"></i> Due now</span></div>` : empty('Nobody is scheduled here today.', 'Pick another venue above.')}
  <p class="small faint" style="margin-top:10px">Planned times come from the break plan on the Rules page. The bottom row shows how many people are working, not on break, every half hour; amber means only one person is covering.</p>`;
}
EXT.acts['bp-venue'] = (el, v) => { M.bpVenue = v; };
EXT.acts['bp-nudge'] = (el, v) => { CC.postMsg(CC.dmId(v), 'mgr', `Heads-up: please take your ${el.dataset.l.toLowerCase()} at about ${fTime(Number(el.dataset.t))} so we stay covered. Thanks.`); CC.notify(v, `CJ: please take your ${el.dataset.l.toLowerCase()} at about ${fTime(Number(el.dataset.t))}.`, 'Push', 'break'); commit(`Asked ${emp(v).name} to move a break`); toast('Message sent'); };

/* =====================================================================
   Team chat with read receipts
   ===================================================================== */
const who = id => id==='mgr' ? {name:MGRN(), initials:'CJ', color:'#e3a92b'} : emp(id);
function pChat(){
  const chs = CC.channelsFor('mgr');
  if (!chs.some(c=>c.id===M.chat)) M.chat = chs[0].id;
  const cur = chs.find(c=>c.id===M.chat), msgs = CC.chMsgs(M.chat);
  if (CC.markRead('mgr', M.chat)) CC.save();
  const lastMine = msgs.filter(m=>m.from==='mgr').slice(-1)[0];
  const seen = lastMine ? CC.readersOf(lastMine).map(id=>who(id)?.name.split(' ')[0]).filter(Boolean) : [];
  const item = c => { const u = CC.unread('mgr', c.id), last = CC.chMsgs(c.id).slice(-1)[0]; return `<button class="ch-i ${c.id===M.chat?'on':''}" data-act="chat-open" data-v="${c.id}">${c.dm ? avatar(emp(c.dm),28) : `<span class="vt sm">${ic(c.venue ? 'pin' : 'users')}</span>`}<span class="grow"><b>${esc(c.name)}</b><span class="meta ellipsis">${last ? esc((last.from==='mgr'?'You: ':'') + last.text) : 'No messages yet'}</span></span>${u?`<b class="m-count">${u}</b>`:''}</button>`; };
  return `<div class="chat">
    <aside class="ch-list"><div class="label" style="padding:4px 6px 8px">Channels</div>${chs.filter(c=>!c.dm).map(item).join('')}<div class="label" style="padding:14px 6px 8px">Direct messages</div>${chs.filter(c=>c.dm).map(item).join('')}</aside>
    <section class="ch-pane">
      <header class="ch-h"><div class="title" style="font-size:16px">${esc(cur.name)}</div><div class="meta">${cur.dm ? 'Private conversation' : cur.venue ? `Crew who work at ${esc(venue(cur.venue).name)}` : 'Everyone on the crew'}</div></header>
      <div class="ch-msgs" id="chMsgs">${msgs.map(m => { const w = who(m.from), mine = m.from==='mgr'; return `<div class="msg ${mine?'mine':''}">${mine?'':avatar(w,28)}<div><div class="meta">${esc(w?.name||'Former crew')} · ${fDate(m.t)} ${fTime(m.t)}</div><div class="bubble">${esc(m.text)}</div></div></div>`; }).join('') || '<div class="small muted" style="padding:20px">Say hello. Crew see this in the Team tab of the crew app.</div>'}
      ${lastMine ? `<div class="meta seen">${seen.length ? `Seen by ${seen.join(', ')}` : 'Not seen yet'}</div>` : ''}</div>
      <div class="ch-comp"><input class="input" id="chatText" placeholder="Message ${esc(cur.name)}" autocomplete="off"><button class="btn primary sm" data-act="chat-send">Send</button></div>
    </section></div>`;
}
EXT.acts['chat-open'] = (el, v) => { M.chat = v; };
EXT.acts['chat-send'] = () => { const t = val('chatText').trim(); if (!t){ toast('Type a message first'); return false; } CC.postMsg(M.chat, 'mgr', t); if (M.chat.startsWith('DM:')) CC.notify(M.chat.slice(3), `New message from ${MGRN()}: ${t}`, 'Push', 'chat'); commit(); setTimeout(() => { const b = document.getElementById('chMsgs'); if (b) b.scrollTop = b.scrollHeight; document.getElementById('chatText')?.focus(); }, 0); };
EXT.counts.chat = () => CC.channelsFor('mgr').reduce((a,c)=>a + CC.unread('mgr', c.id), 0);
document.addEventListener('keydown', ev => { if (ev.key==='Enter' && ev.target.id==='chatText'){ ev.preventDefault(); document.querySelector('[data-act=chat-send]')?.click(); } });

/* =====================================================================
   Labor vs sales
   ===================================================================== */
function laborPct(sales, labor){ return sales > 0 ? labor / sales * 100 : null; }
const pctCls = p => p == null ? '' : p > ST().laborTarget + 4 ? 'bad' : p > ST().laborTarget ? 'warn' : 'ok';
function pLabor(){
  const vs = venuesOn().filter(v => v.type !== 'x'), sel = M.lbVenue, list = sel==='all' ? vs.map(v=>v.id) : [sel];
  const t0 = startOfDay(now()), sum = f => list.reduce((a,v)=>a+f(v),0);
  const salesNow = sum(v => CC.salesSoFar(v)), laborNow = sum(v => CC.laborActual(v, t0));
  const fc = sum(v => CC.forecast(v, t0)), sch = sum(v => CC.laborScheduled(v, t0));
  const pNow = laborPct(salesNow, laborNow), pProj = laborPct(fc, sch);
  const hours = CC.HOURS, hf = hours.map(h => ({h, amt: list.reduce((a,v)=>a + CC.hourlyForecast(v, t0).find(x=>x.h===h).amt, 0),
    staff: D().shifts.filter(s => list.includes(s.venue) && s.startT < t0 + (h+1)*HR && s.endT > t0 + h*HR).length}));
  const maxA = Math.max(1, ...hf.map(x=>x.amt)), maxS = Math.max(1, ...hf.map(x=>x.staff));
  const curH = (now() - t0)/HR;
  const ws = X.weekStart(0), days = [...Array(7)].map((_,i)=>ws+i*DAY);
  return `
  <div class="toolbar"><div class="chips"><button class="chip ${sel==='all'?'on':''}" data-act="lb-venue" data-v="all">All venues</button>${vs.map(v => `<button class="chip ${sel===v.id?'on':''}" data-act="lb-venue" data-v="${v.id}">${esc(v.name)}</button>`).join('')}</div>
    <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn sm" data-act="sales-import">${ic('download')} Import POS sales (CSV)</button><button class="btn sm primary" data-act="sales-open">${ic('plus')} Enter sales</button></div></div>
  <div class="kpi-row">
    ${kpi(money(salesNow), 'Sales so far today')}
    ${kpi(money(laborNow), 'Labor so far today')}
    ${salesNow < fc*0.12 ? kpi(pNow==null?'—':fPct(pNow), 'Labor % now · prep hours, rush not here yet') : kpi(pNow==null?'—':fPct(pNow), 'Labor % right now', pctCls(pNow))}
    ${kpi(money(fc), 'Forecast sales today')}
    ${kpi(pProj==null?'—':fPct(pProj), 'Projected labor % today', pctCls(pProj))}
    ${kpi(`${ST().laborTarget}%`, 'Your labor target')}
  </div>
  <div class="m-sec-h"><h2>Today by the hour</h2><span class="small faint">Bars: forecast sales · dots: people scheduled</span></div>
  <div class="card hr-chart">${hf.map(x => `<div class="hc ${x.h <= curH && curH < x.h+1 ? 'now' : x.h+1 <= curH ? 'past' : ''}"><div class="hc-bar"><i style="height:${(x.amt/maxA*100).toFixed(0)}%"></i>${x.staff ? `<b style="bottom:${(x.staff/maxS*86).toFixed(0)}%" title="${x.staff} scheduled">${x.staff}</b>` : ''}</div><div class="hc-l num">${money(x.amt).replace('.00','')}</div><div class="hc-h">${x.h%12||12}${x.h<12?'a':'p'}</div></div>`).join('')}</div>
  <div class="m-sec-h"><h2>This week</h2><span class="small faint">Target ${ST().laborTarget}% · change it on Compliance</span></div>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Day</th><th class="r">Forecast sales</th><th class="r">Actual sales</th><th class="r">Scheduled labor</th><th class="r">Actual labor</th><th class="r">Labor %</th><th></th></tr></thead><tbody>
    ${days.map(d => { const f = sum(v=>CC.forecast(v,d)), a = d < t0 ? sum(v=>CC.salesActual(v,d) ?? 0) : d===t0 ? salesNow : null, s = sum(v=>CC.laborScheduled(v,d)), la = d <= t0 ? sum(v=>CC.laborActual(v,d)) : null;
      const p = d < t0 ? laborPct(a, la) : laborPct(f, s); return `<tr class="${d===t0?'today-row':''}"><td>${fDate(d)}${d===t0?' '+badge('Today','info'):''}</td><td class="r num">${money(f)}</td><td class="r num">${a==null?'<span class="faint">—</span>':money(a)}</td><td class="r num">${s || d >= t0 ? money(s) : '<span class="faint">—</span>'}</td><td class="r num">${la==null?'<span class="faint">—</span>':money(la)}</td>
      <td class="r">${p==null?'<span class="faint">—</span>':badge(fPct(p), pctCls(p))}${d>=t0?'<div class="meta">projected</div>':''}</td><td class="r">${d<=t0?`<button class="btn sm" data-act="sales-open" data-d="${d}">Edit sales</button>`:''}</td></tr>`; }).join('')}
  </tbody></table></div>
  <p class="small faint" style="margin-top:10px">Forecasts use the average of the same weekday over the last three weeks. Stadium venues forecast an event only on days with shifts scheduled. Sales for past days are sample data until you enter real numbers, import a CSV from your register, or connect a register on the Integrations page.</p>`;
}
EXT.acts['lb-venue'] = (el, v) => { M.lbVenue = v; };
EXT.acts['sales-open'] = (el) => { const d = Number(el.dataset.d) || startOfDay(now()); const vid = M.lbVenue==='all' ? 'pico' : M.lbVenue;
  openModal(`${mHead('Enter sales', 'Net sales for one venue and day.')}<div class="fgrid" style="margin-top:6px">
    <label class="field"><span>Venue</span><select class="input" id="sl-v">${venuesOn().map(v=>`<option value="${v.id}" ${v.id===vid?'selected':''}>${esc(v.name)}</option>`).join('')}</select></label>
    <label class="field"><span>Date</span><input class="input" type="date" id="sl-d" value="${toDateInput(d)}"></label>
    <label class="field"><span>Net sales ($)</span><input class="input num" id="sl-a" inputmode="decimal" value="${CC.salesActual(vid, d) ?? ''}" placeholder="e.g. 2450"></label></div>
    ${btns(`<button class="btn sm" data-act="close">Cancel</button>`, `<button class="btn sm primary" data-act="sales-save">${ic('check')} Save</button>`)}`); return false; };
EXT.acts['sales-save'] = () => { const v = val('sl-v'), d = val('sl-d'), a = parseFloat(val('sl-a')); if (!d || !isFinite(a)){ toast('Enter a date and amount'); return false; } D().sales[`${v}|${d}`] = Math.round(a*100)/100; commit(`Entered sales for ${venue(v).name} on ${d}: ${money(a)}`); closeModal(); toast('Sales saved'); };
EXT.acts['sales-import'] = () => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.csv,text/csv';
  inp.onchange = () => { const f = inp.files[0]; if (!f) return; f.text().then(txt => { let n = 0; txt.split(/\r?\n/).forEach(line => { const [d, v, a] = line.split(',').map(x => x && x.trim().replace(/^"|"$/g,'')); const vid = D().venues.find(x => x.id===v || x.name.toLowerCase()===String(v||'').toLowerCase())?.id; const amt = parseFloat(a); if (/^\d{4}-\d{2}-\d{2}$/.test(d||'') && vid && isFinite(amt)){ D().sales[`${vid}|${d}`] = amt; n++; } });
    commit(`Imported ${n} sales rows from CSV`); toast(n ? `Imported ${n} days of sales` : 'No rows found. Use: date,venue,amount'); X.render(); }); };
  inp.click(); return false; };

/* =====================================================================
   Compliance: rest between shifts, minors, Fair Workweek, attestations
   ===================================================================== */
function pCompliance(){
  const st = ST(), t0 = startOfDay(now()), ws = X.weekStart(0);
  const upcoming = D().shifts.filter(s => s.startT >= t0 && s.startT < ws + 14*DAY).sort((a,b)=>a.startT-b.startT);
  const issues = upcoming.map(s => ({s, iss:CC.shiftIssues(s).filter(i => i.k!=='ot' || i.text.includes('week'))})).filter(x => x.iss.length);
  const lateCh = D().shifts.filter(s => s.lateChange && !s.lateChange.waived && s.startT >= CC.periodStart());
  const ps = CC.periodStart(), pe = ps + CC.periodLen();
  const prem = D().punches.filter(p => !p.voided && p.attest==='missed' && p.inT>=ps && p.inT<pe);
  const atts = D().punches.filter(p => (p.attestations||[]).length && p.inT >= now() - 14*DAY).sort((a,b)=>b.inT-a.inT);
  const docsBad = activeEmps().flatMap(e => CC.docTypesFor(e).filter(t => t.expires).map(t => ({e, t, d:CC.docState(e.id, t.id)}))).filter(x => ['expired','expiring'].includes(x.d.state));
  const num = (k, label, hint='', step=1) => `<label class="field"><span>${label}</span><input class="input num" type="number" min="0" step="${step}" id="cp-${k}" value="${st[k]}">${hint?`<small class="faint">${hint}</small>`:''}</label>`;
  const tog = (k, label, hint) => `<label class="check"><input type="checkbox" id="cp-${k}" ${st[k]?'checked':''}><span><b>${label}</b><br><span class="faint small">${hint}</span></span></label>`;
  return `
  <div class="kpi-row">
    ${kpi(issues.length, 'Shifts with issues (2 weeks)', issues.length?'warn':'ok')}
    ${kpi(lateCh.length, 'Late schedule changes', lateCh.length?'warn':'')}
    ${kpi(prem.length, 'Missed-break premiums', prem.length?'bad':'')}
    ${kpi(activeEmps().filter(e=>e.minor).length, 'Minors on the crew')}
    ${kpi(docsBad.length, 'Cards expiring or expired', docsBad.length?'bad':'')}
  </div>
  <div class="m-grid2">
  <section><div class="m-sec-h"><h2>Upcoming shift issues</h2></div>
    <div class="list">${issues.map(({s, iss}) => { const e = emp(s.emp); return `<div class="li">${avatar(e,30)}<div class="grow"><div class="title" style="font-size:14px">${esc(e.name)} · ${fDate(s.startT)} ${fTime(s.startT)}–${fTime(s.endT)}</div><div class="row" style="gap:6px;flex-wrap:wrap;margin-top:4px">${iss.map(i=>badge(esc(i.text), i.sev==='bad'?'bad':i.sev==='warn'?'warn':'info')).join('')}</div></div><button class="btn sm" data-act="shift-edit" data-v="${s.id}">${ic('edit')}</button></div>`; }).join('') || '<div class="li small muted">No problems on the next two weeks of the schedule.</div>'}</div>
    <div class="m-sec-h"><h2>Predictability pay (Fair Workweek)</h2></div>
    <div class="list">${lateCh.map(s => { const e = emp(s.emp); return `<div class="li">${avatar(e,30)}<div class="grow"><div class="title" style="font-size:14px">${esc(e.name)} · ${fDate(s.startT)}</div><div class="meta">Changed ${fDate(s.lateChange.t)} ${fTime(s.lateChange.t)}, ${fHM(s.startT - s.lateChange.t)} before the shift. Owes 1 hr at ${money(rateOf(e, s.role))}.</div></div><button class="btn sm" data-act="lc-waive" data-v="${s.id}" title="Employee asked for the change">Waive</button></div>`; }).join('') || `<div class="li small muted">No changes inside the ${st.noticeDays}-day notice window this pay period.</div>`}</div>
  </section>
  <section><div class="m-sec-h"><h2>Late, early &amp; unscheduled reasons</h2></div>
    <div class="list">${atts.map(p => { const e = emp(p.emp); return `<div class="li">${avatar(e,30)}<div class="grow"><div class="title" style="font-size:14px">${esc(e.name)} · ${fDate(p.inT)}</div>${p.attestations.map(a=>`<div class="meta"><b>${esc(a.kind)}:</b> ${esc(a.reason)}</div>`).join('')}</div></div>`; }).join('') || '<div class="li small muted">Nobody has clocked in late or left early with a reason in the last two weeks.</div>'}</div>
    <div class="m-sec-h"><h2>Food handler cards &amp; permits</h2><button class="link" data-act="page" data-v="hr">Paperwork</button></div>
    <div class="list">${docsBad.map(x => `<div class="li">${avatar(x.e,30)}<div class="grow"><div class="title" style="font-size:14px">${esc(x.e.name)}</div><div class="meta">${esc(x.t.name)} ${x.d.state==='expired'?'expired':'expires'} ${fDate(x.d.exp)}</div></div>${badge(x.d.state==='expired'?'Expired':'Expiring', x.d.state==='expired'?'bad':'warn')}</div>`).join('') || '<div class="li small muted">All cards are current.</div>'}</div>
  </section></div>
  <div class="m-sec-h"><h2>Compliance settings</h2></div>
  <div class="rules">
    <section class="card"><h3 class="card-h">Rest &amp; scheduling notice</h3><div class="fgrid">${num('restBetweenHrs','Minimum rest between shifts (hrs)','Flags a close-then-open')}${num('noticeDays','Schedule notice (days)','Fair Workweek notice window')}</div>
      ${tog('predictPay','Add predictability pay for late changes','One hour of pay when a published shift changes inside the notice window.')}${tog('confirmShifts','Ask crew to confirm shifts','Crew tap Confirm on each shift in their Schedule tab.')}</section>
    <section class="card"><h3 class="card-h">Minors (under 18)</h3><div class="fgrid">${num('minorMaxDay','Max hours per day')}${num('minorMaxWeek','Max hours per week')}<label class="field"><span>Latest end on school nights</span><input class="input" type="time" id="cp-minorLatest" value="${st.minorLatest}"></label></div><p class="small faint">Mark a crew member as a minor on the Crew page. Check your city and state rules.</p></section>
    <section class="card"><h3 class="card-h">Attendance &amp; breaks</h3><div class="fgrid">${num('leaveEarlyMin','Ask for a reason when leaving this early (min)')}${num('maxOnBreak','Max people on break at once')}${num('laborTarget','Labor target (% of sales)','',0.5)}</div>
      ${tog('attestLateEarly','Ask for a reason when late, early or unscheduled','Crew pick a reason at clock-in or clock-out. Saved with the punch.')}</section>
  </div>
  <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn sm primary" data-act="cp-save">${ic('check')} Save compliance settings</button></div>
  <p class="small faint" style="margin-top:10px">These checks help you follow California-style rules. They aren&rsquo;t legal advice; confirm the rules for each city where you operate.</p>`;
}
EXT.acts['lc-waive'] = (el, v) => { const s = D().shifts.find(x=>x.id===v); s.lateChange.waived = true; commit(`Waived predictability pay for ${emp(s.emp).name} (${fDate(s.startT)})`); toast('Waived'); };
EXT.acts['cp-save'] = () => { const s = ST(), n = k => { const x = parseFloat(val('cp-'+k)); return isFinite(x) ? x : s[k]; };
  Object.assign(s, {restBetweenHrs:n('restBetweenHrs'), noticeDays:n('noticeDays'), minorMaxDay:n('minorMaxDay'), minorMaxWeek:n('minorMaxWeek'), minorLatest:val('cp-minorLatest')||s.minorLatest, leaveEarlyMin:n('leaveEarlyMin'), maxOnBreak:Math.max(1, n('maxOnBreak')), laborTarget:n('laborTarget'),
    predictPay:chk('cp-predictPay'), confirmShifts:chk('cp-confirmShifts'), attestLateEarly:chk('cp-attestLateEarly')});
  commit('Updated compliance settings'); toast('Saved'); };

/* =====================================================================
   Tip pooling
   ===================================================================== */
function tipScope(day, vid){
  const ps = D().punches.filter(p => !p.voided && p.outT && p.venue===vid && startOfDay(p.inT)===day);
  return {ps, open: ps.filter(p => !p.tipsPooled), card: ps.filter(p => !p.tipsPooled).reduce((a,p)=>a+(p.tipsCard||0),0)};
}
function distribute(punches, total, method, rolePct){
  const byEmp = {}; punches.forEach(p => { const h = workedMs(p)/HR; (byEmp[p.emp] ||= {h:0, roles:{}}).h += h; byEmp[p.emp].roles[p.role] = (byEmp[p.emp].roles[p.role]||0) + h; });
  const alloc = {};
  if (method === 'role'){
    const roleHrs = {}; Object.values(byEmp).forEach(x => Object.entries(x.roles).forEach(([r,h]) => roleHrs[r] = (roleHrs[r]||0) + h));
    const used = Object.keys(roleHrs), wsum = used.reduce((a,r)=>a+(rolePct[r]||0),0) || 1;
    Object.entries(byEmp).forEach(([id, x]) => { alloc[id] = Object.entries(x.roles).reduce((a,[r,h]) => a + total * ((rolePct[r]||0)/wsum) * (h/roleHrs[r]), 0); });
  } else { const H = Object.values(byEmp).reduce((a,x)=>a+x.h,0) || 1; Object.entries(byEmp).forEach(([id, x]) => alloc[id] = total * x.h / H); }
  Object.keys(alloc).forEach(k => alloc[k] = Math.round(alloc[k]*100)/100);
  return {alloc, byEmp};
}
function pTips(){
  const vs = venuesOn(), st = ST();
  if (!M.tipDay){ const cand = D().punches.filter(p => p.outT && !p.voided && !p.tipsPooled && (p.tipsCard||0) > 0).sort((a,b)=>b.inT-a.inT)[0]; M.tipDay = cand ? startOfDay(cand.inT) : startOfDay(now()-DAY); if (cand) M.tipVenue = cand.venue; }
  const day = M.tipDay, vid = M.tipVenue, sc = tipScope(day, vid);
  const cash = parseFloat(M.tipCash || 0) || 0, total = Math.round((sc.card + cash)*100)/100;
  const {alloc, byEmp} = distribute(sc.open, total, st.tipMethod, st.tipRolePct||{});
  const roles = [...new Set(D().employees.flatMap(e=>e.roles.map(r=>r.role)))];
  const pools = (D().tipPools||[]).slice().sort((a,b)=>b.t-a.t);
  return `
  <div class="card">
    <div class="fgrid">
      <label class="field"><span>Day</span><input class="input" type="date" id="tp-day" value="${toDateInput(day)}" data-act-change="tp-day"></label>
      <label class="field"><span>Venue</span><select class="input" id="tp-venue" data-act-change="tp-venue">${vs.map(v=>`<option value="${v.id}" ${v.id===vid?'selected':''}>${esc(v.name)}</option>`).join('')}</select></label>
      <label class="field"><span>Split by</span><select class="input" id="tp-method" data-act-change="tp-method"><option value="hours" ${st.tipMethod!=='role'?'selected':''}>Hours worked (everyone equal per hour)</option><option value="role" ${st.tipMethod==='role'?'selected':''}>Percentage by role, then hours</option></select></label>
      <label class="field"><span>Cash tips to add ($)</span><input class="input num" id="tp-cash" inputmode="decimal" value="${M.tipCash||''}" placeholder="0.00" data-act-change="tp-cash"></label>
    </div>
    ${st.tipMethod==='role' ? `<div class="label" style="margin-top:14px">Role percentages</div><div class="fgrid" style="margin-top:6px">${roles.map(r => `<label class="field"><span>${esc(r)}</span><input class="input num tp-role" data-r="${esc(r)}" type="number" min="0" value="${(st.tipRolePct||{})[r]||0}"></label>`).join('')}</div><button class="btn sm" data-act="tp-roles" style="margin-top:8px">Save percentages</button>` : ''}
  </div>
  <div class="kpi-row" style="margin-top:14px">${kpi(money(sc.card), 'Card tips from the register')}${kpi(money(cash), 'Cash added')}${kpi(money(total), 'Pool total', total?'ok':'')}${kpi(Object.keys(alloc).length, 'People sharing')}</div>
  ${sc.open.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Crew</th><th>Roles</th><th class="r">Hours</th><th class="r">Own card tips</th><th class="r">Pool share</th></tr></thead><tbody>
    ${Object.entries(byEmp).map(([id, x]) => { const e = emp(id), own = sc.open.filter(p=>p.emp===id).reduce((a,p)=>a+(p.tipsCard||0),0); return `<tr><td><div class="row" style="gap:8px">${avatar(e,28)}<span>${esc(e.name)}</span></div></td><td class="small">${Object.keys(x.roles).map(esc).join(', ')}</td><td class="r num">${fHrs(x.h)}</td><td class="r num">${money(own)}</td><td class="r num" style="font-weight:700">${money(alloc[id])}</td></tr>`; }).join('')}
  </tbody></table></div>
  <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn sm primary" data-act="tp-apply" ${total>0?'':'disabled'}>${ic('check')} Apply to payroll</button></div>` : empty(sc.ps.length ? 'Tips for this day and venue are already pooled.' : 'No finished shifts here that day.', 'Pick another day or venue.')}
  <div class="m-sec-h"><h2>Pools applied</h2></div>
  <div class="list">${pools.map(tp => `<div class="li"><span class="vt sm">${ic('dollar')}</span><div class="grow"><div class="title" style="font-size:14px">${esc(venue(tp.venue).name)} · ${fDate(tp.day)} · ${money(tp.total)}</div><div class="meta">${tp.method==='role'?'By role':'By hours'} · ${Object.entries(tp.alloc).map(([id,a])=>`${firstName(emp(id))} ${money(a)}`).join(', ')}</div></div><button class="btn sm" data-act="tp-undo" data-v="${tp.id}">Undo</button></div>`).join('') || '<div class="li small muted">No pools yet. Applied shares show in Payroll under Tips.</div>'}</div>
  <p class="small faint" style="margin-top:10px">Pooled card tips replace each person&rsquo;s own card tips in payroll. Managers and owners are never included. Check your state&rsquo;s tip-pool rules before choosing roles.</p>`;
}
EXT.changes['tp-day'] = el => { M.tipDay = startOfDay(new Date(el.value+'T12:00').getTime()); X.render(); };
EXT.changes['tp-venue'] = el => { M.tipVenue = el.value; X.render(); };
EXT.changes['tp-method'] = el => { ST().tipMethod = el.value; commit(); X.render(); };
EXT.changes['tp-cash'] = el => { M.tipCash = el.value; X.render(); };
EXT.acts['tp-roles'] = () => { const r = {}; document.querySelectorAll('.tp-role').forEach(i => r[i.dataset.r] = parseFloat(i.value)||0); ST().tipRolePct = r; commit('Updated tip-pool role percentages'); toast('Saved'); };
EXT.acts['tp-apply'] = () => { const sc = tipScope(M.tipDay, M.tipVenue), cash = parseFloat(M.tipCash||0)||0, total = Math.round((sc.card+cash)*100)/100;
  const {alloc} = distribute(sc.open, total, ST().tipMethod, ST().tipRolePct||{}); const pid = CC.id('TP');
  D().tipPools.push({id:pid, day:M.tipDay, venue:M.tipVenue, method:ST().tipMethod, total, cash, alloc, applied:true, t:now(), punchIds:sc.open.map(p=>p.id)});
  sc.open.forEach(p => p.tipsPooled = pid); Object.entries(alloc).forEach(([id,a]) => CC.notify(id, `Tip pool for ${fDate(M.tipDay)} at ${venue(M.tipVenue).name}: your share is ${money(a)}.`, 'Push', 'tips'));
  M.tipCash = ''; commit(`Applied ${money(total)} tip pool at ${venue(M.tipVenue).name} for ${fDate(M.tipDay)}`); toast('Tip pool applied'); };
EXT.acts['tp-undo'] = (el, v) => { const tp = D().tipPools.find(x=>x.id===v); D().punches.forEach(p => { if (p.tipsPooled===v) delete p.tipsPooled; }); D().tipPools = D().tipPools.filter(x=>x.id!==v); commit(`Undid tip pool for ${fDate(tp.day)}`); toast('Pool removed'); };

/* =====================================================================
   Checklists
   ===================================================================== */
function pChecklists(){
  const lists = D().checklists, t0 = startOfDay(now());
  const lateN = lists.filter(c => CC.listProgress(c, CC.runFor(c.id, t0)).late).length;
  return `
  <div class="toolbar"><p class="small muted" style="max-width:600px">Crew complete these in the Team tab of the crew app: tick items, log temperatures and take photos, then sign. Overdue lists show on the tablet board.</p>
    <button class="btn sm primary" data-act="cl-edit">${ic('plus')} New checklist</button></div>
  ${lateN ? `<div class="alert bad" style="margin-bottom:12px">${ic('alert')}<div><b>${lateN} checklist${lateN>1?'s are':' is'} overdue today.</b></div></div>` : ''}
  <div class="cards">${lists.map(c => { const run = CC.runFor(c.id, t0), pr = CC.listProgress(c, run); return `
    <article class="req"><div class="row between"><div class="row"><span class="vt sm">${ic('checklist')}</span><div><div class="title" style="font-size:15px">${esc(c.name)}</div><div class="meta">${esc(venue(c.venue).name)} · due ${fTime(pr.due)}</div></div></div>
      ${pr.complete ? badge('Done','ok') : pr.late ? badge('Overdue','bad') : pr.d ? badge('In progress','warn') : badge('Not started')}</div>
      <div class="prog"><i style="width:${pr.n?pr.d/pr.n*100:0}%"></i></div><div class="meta">${pr.d} of ${pr.n} done${run?.signed?` · signed by ${esc(emp(run.signed.by)?.name)} at ${fTime(run.signed.t)}`:''}</div>
      ${pr.outOfRange.length ? `<div class="alert bad" style="margin-top:8px">${ic('alert')}<div>${pr.outOfRange.map(i=>`${esc(i.text)}: <b>${run.done[i.id].val}°F</b>`).join('; ')}</div></div>` : ''}
      <ul class="cl-items">${c.items.map(i => { const d = run?.done?.[i.id]; return `<li class="${d?'done':''}">${ic(d?'check':'x')}<span>${esc(i.text)}${d?.val!=null?` <b class="num">${d.val}°F</b>`:''}${d?.photo?' · photo':''}${d?`<span class="faint"> · ${firstName(emp(d.by))} ${fTime(d.t)}</span>`:''}</span></li>`; }).join('')}</ul>
      <div class="row" style="justify-content:flex-end;gap:6px;margin-top:10px"><button class="btn sm" data-act="cl-hist" data-v="${c.id}">History</button><button class="btn sm" data-act="cl-edit" data-v="${c.id}">${ic('edit')} Edit</button></div>
    </article>`; }).join('')}</div>`;
}
const clItemRow = (i={type:'check', text:''}) => `<div class="cl-row"><select class="input sm cl-t"><option value="check" ${i.type==='check'?'selected':''}>Tick box</option><option value="temp" ${i.type==='temp'?'selected':''}>Temperature</option><option value="photo" ${i.type==='photo'?'selected':''}>Photo</option></select><input class="input sm cl-x" value="${esc(i.text)}" placeholder="What to do"><input class="input sm num cl-min" placeholder="Min °F" value="${i.min??''}"><input class="input sm num cl-max" placeholder="Max °F" value="${i.max??''}"><button class="btn sm" data-act="cl-delrow" aria-label="Remove">${ic('trash')}</button></div>`;
EXT.acts['cl-edit'] = (el, v) => { const c = v ? D().checklists.find(x=>x.id===v) : null;
  openModal(`${mHead(c?'Edit checklist':'New checklist')}<div class="fgrid" style="margin-top:6px"><label class="field"><span>Name</span><input class="input" id="cl-name" value="${esc(c?.name||'')}" placeholder="e.g. Mid-shift temp log"></label><label class="field"><span>Venue</span><select class="input" id="cl-venue">${X.venueOpts(c?.venue||'pico')}</select></label><label class="field"><span>Due by</span><input class="input" type="time" id="cl-due" value="${c?.due||'11:00'}"></label></div>
  <div class="label" style="margin-top:14px">Items</div><div id="cl-rows">${(c?.items||[{type:'check',text:''}]).map(clItemRow).join('')}</div><button class="btn sm" data-act="cl-addrow" style="margin-top:8px">${ic('plus')} Add item</button>
  <div class="row between" style="margin-top:16px">${c?`<button class="btn sm danger" data-act="cl-del" data-v="${c.id}">${ic('trash')} Delete</button>`:'<span></span>'}<div class="row" style="gap:8px"><button class="btn sm" data-act="close">Cancel</button><button class="btn sm primary" data-act="cl-save" data-v="${c?.id||''}">${ic('check')} Save</button></div></div>`, true); return false; };
EXT.acts['cl-addrow'] = () => { document.getElementById('cl-rows').insertAdjacentHTML('beforeend', clItemRow()); return false; };
EXT.acts['cl-delrow'] = el => { el.closest('.cl-row').remove(); return false; };
EXT.acts['cl-save'] = (el, v) => { const name = val('cl-name').trim(); if (!name){ toast('Name the checklist'); return false; }
  const old = v ? D().checklists.find(x=>x.id===v) : null;
  const items = [...document.querySelectorAll('#cl-rows .cl-row')].map((r, k) => { const t = r.querySelector('.cl-t').value, x = r.querySelector('.cl-x').value.trim(), mn = parseFloat(r.querySelector('.cl-min').value), mx = parseFloat(r.querySelector('.cl-max').value);
    const keep = old?.items.find(i => i.text===x); return x ? {id: keep?.id || 'i'+Date.now().toString(36)+k, type:t, text:x, ...(t==='temp' && isFinite(mn) ? {min:mn} : {}), ...(t==='temp' && isFinite(mx) ? {max:mx} : {})} : null; }).filter(Boolean);
  if (!items.length){ toast('Add at least one item'); return false; }
  const rec = {name, venue:val('cl-venue'), due:val('cl-due')||'23:00', items};
  if (old) Object.assign(old, rec); else D().checklists.push({id:CC.id('CL'), ...rec});
  closeModal(); commit(`${old?'Updated':'Created'} checklist "${name}"`); toast('Checklist saved'); };
EXT.acts['cl-del'] = (el, v) => { const c = D().checklists.find(x=>x.id===v); D().checklists = D().checklists.filter(x=>x.id!==v); closeModal(); commit(`Deleted checklist "${c.name}"`); };
EXT.acts['cl-hist'] = (el, v) => { const c = D().checklists.find(x=>x.id===v), t0 = startOfDay(now());
  openModal(`${mHead(esc(c.name)+' · last 14 days')}<div class="list" style="margin-top:8px">${[...Array(14)].map((_,k) => { const d = t0 - k*DAY, r = CC.runFor(c.id, d), pr = CC.listProgress(c, r); return `<div class="li"><div class="grow"><div class="title" style="font-size:14px">${fDate(d)}</div><div class="meta">${pr.d}/${pr.n} items${r?.signed?` · signed ${esc(emp(r.signed.by)?.name)} ${fTime(r.signed.t)}`:''}</div></div>${pr.complete?badge('Done','ok'):k===0&&!pr.late?badge('Open'):badge(pr.d?'Incomplete':'Missed', 'bad')}</div>`; }).join('')}</div>`); return false; };
EXT.counts.checklists = () => D().checklists.filter(c => CC.listProgress(c, CC.runFor(c.id, now())).late).length;

/* =====================================================================
   Paperwork & training
   ===================================================================== */
function docChip(e, t){ const s = CC.docState(e.id, t.id);
  const lab = {done: s.exp ? `Until ${fShort(s.exp)}` : 'Done', missing:'Missing', expiring:`Expires ${fShort(s.exp)}`, expired:`Expired ${fShort(s.exp)}`}[s.state];
  return `<button class="doc-chip ${s.state}" data-act="doc-open" data-v="${e.id}" data-t="${t.id}">${lab}</button>`; }
function pHr(){
  const emps = activeEmps(), types = D().docTypes, tab = M.hrTab;
  const extra = emps.some(e=>e.minor) ? [{id:'wp', name:'Minor work permit', kind:'card', expires:true}] : [];
  const cols = [...types, ...extra];
  const courses = D().courses;
  const missing = emps.reduce((a,e)=>a + CC.docTypesFor(e).filter(t => CC.docState(e.id,t.id).state !== 'done').length, 0);
  return `
  <div class="chips"><button class="chip ${tab==='docs'?'on':''}" data-act="hr-tab" data-v="docs">Paperwork<b>${missing}</b></button><button class="chip ${tab==='train'?'on':''}" data-act="hr-tab" data-v="train">Training<b>${courses.length}</b></button></div>
  ${tab==='docs' ? `
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Crew</th>${cols.map(t=>`<th>${esc(t.name)}</th>`).join('')}<th class="r"></th></tr></thead><tbody>
    ${emps.map(e => `<tr><td><div class="row" style="gap:8px">${avatar(e,28)}<div><div>${esc(e.name)}</div>${e.minor?`<div class="meta">${badge('Minor','warn')}</div>`:''}</div></div></td>${cols.map(t => `<td>${t.id==='wp' && !e.minor ? '<span class="faint small">n/a</span>' : docChip(e,t)}</td>`).join('')}
      <td class="r"><button class="btn sm" data-act="doc-remind" data-v="${e.id}" ${CC.docTypesFor(e).some(t=>CC.docState(e.id,t.id).state!=='done')?'':'disabled'}>${ic('bell')} Remind</button></td></tr>`).join('')}
  </tbody></table></div>
  <p class="small faint" style="margin-top:10px">Crew sign forms in the Me tab of the crew app. New hires get every form as soon as they&rsquo;re added. Tap a cell to mark something received or update an expiry date. This preview stores typed signatures only; real tax and I-9 forms need a payroll provider.</p>` : `
  <div class="toolbar"><span class="small muted">Short lessons with a quiz. Required ones show as a to-do in the crew app.</span><button class="btn sm primary" data-act="course-new">${ic('plus')} New lesson</button></div>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Crew</th>${courses.map(c=>`<th>${esc(c.title)}${c.required?' <span class="badge warn">Required</span>':''}</th>`).join('')}</tr></thead><tbody>
    ${emps.map(e => `<tr><td><div class="row" style="gap:8px">${avatar(e,28)}<span>${esc(e.name)}</span></div></td>${courses.map(c => { const applies = CC.coursesFor(e).includes(c), r = D().training?.[e.id]?.[c.id];
      return `<td>${!applies ? '<span class="faint small">n/a</span>' : r ? badge(`${r.score}% · ${fShort(r.t)}`, r.score >= 80 ? 'ok' : 'warn') : badge('Not started', c.required ? 'bad' : '')}</td>`; }).join('')}</tr>`).join('')}
  </tbody></table></div>
  <div class="cards" style="margin-top:14px">${courses.map(c => `<article class="req"><div class="title" style="font-size:15px">${esc(c.title)}</div><div class="meta">${c.mins} min · ${c.quiz.length} question${c.quiz.length>1?'s':''}${c.roles?` · ${c.roles.join(', ')} only`:''}</div><p class="req-d">${esc(c.body[0])}</p><div class="row" style="justify-content:flex-end"><button class="btn sm" data-act="course-del" data-v="${c.id}">${ic('trash')}</button></div></article>`).join('')}</div>`}`;
}
EXT.acts['hr-tab'] = (el, v) => { M.hrTab = v; };
EXT.acts['doc-open'] = (el, v) => { const e = emp(v), t = CC.docTypesFor(e).find(x=>x.id===el.dataset.t), d = D().docs?.[v]?.[t.id] || {};
  openModal(`${mHead(`${esc(t.name)} · ${esc(e.name)}`)}<div class="fgrid" style="margin-top:6px"><label class="field"><span>Status</span><select class="input" id="dc-s"><option value="missing" ${d.status!=='done'?'selected':''}>Missing</option><option value="done" ${d.status==='done'?'selected':''}>Received / signed</option></select></label>
    ${t.expires ? `<label class="field"><span>Expires</span><input class="input" type="date" id="dc-exp" value="${d.exp||''}"></label><label class="field"><span>Card number</span><input class="input" id="dc-num" value="${esc(d.num||'')}"></label>` : ''}</div>
    ${d.sig ? `<p class="small muted" style="margin-top:10px">Signed &ldquo;${esc(d.sig)}&rdquo; on ${fDate(d.t)} ${fTime(d.t)}.</p>` : ''}
    ${btns(`<button class="btn sm" data-act="close">Cancel</button>`, `<button class="btn sm primary" data-act="doc-save" data-v="${v}" data-t="${t.id}">${ic('check')} Save</button>`)}`); return false; };
EXT.acts['doc-save'] = (el, v) => { const t = el.dataset.t, d = ((D().docs ||= {})[v] ||= {}); const prev = d[t] || {};
  d[t] = {...prev, status:val('dc-s'), t: prev.t || now(), ...(document.getElementById('dc-exp') ? {exp:val('dc-exp'), num:val('dc-num')} : {})};
  closeModal(); commit(`Updated ${t} paperwork for ${emp(v).name}`); toast('Saved'); };
EXT.acts['doc-remind'] = (el, v) => { const e = emp(v), miss = CC.docTypesFor(e).filter(t => CC.docState(v,t.id).state !== 'done').map(t=>t.name);
  CC.notify(v, `Please finish your paperwork in the crew app (Me tab): ${miss.join(', ')}.`, 'SMS', 'paperwork'); commit(`Sent a paperwork reminder to ${e.name}`); toast(`Reminder sent to ${e.name.split(' ')[0]}`); };
EXT.acts['course-new'] = () => { openModal(`${mHead('New lesson', 'Crew read it on their phone, then answer one question.')}<div class="fgrid" style="margin-top:6px">
  <label class="field" style="grid-column:1/-1"><span>Title</span><input class="input" id="co-t" placeholder="e.g. Closing the register"></label>
  <label class="field" style="grid-column:1/-1"><span>Lesson (one point per line)</span><textarea class="input" id="co-b" rows="4"></textarea></label>
  <label class="field" style="grid-column:1/-1"><span>Quiz question</span><input class="input" id="co-q"></label>
  <label class="field"><span>Right answer</span><input class="input" id="co-a0"></label><label class="field"><span>Wrong answer</span><input class="input" id="co-a1"></label><label class="field"><span>Wrong answer</span><input class="input" id="co-a2"></label></div>
  <label class="check"><input type="checkbox" id="co-r" checked><span>Required for everyone</span></label>
  ${btns(`<button class="btn sm" data-act="close">Cancel</button>`, `<button class="btn sm primary" data-act="course-save">${ic('check')} Publish lesson</button>`)}`, true); return false; };
EXT.acts['course-save'] = () => { const t = val('co-t').trim(), body = val('co-b').split('\n').map(x=>x.trim()).filter(Boolean), q = val('co-q').trim(), a = [val('co-a0'),val('co-a1'),val('co-a2')].map(x=>x.trim());
  if (!t || !body.length || !q || a.some(x=>!x)){ toast('Fill in the title, lesson, question and all three answers'); return false; }
  const order = [0,1,2].sort(() => Math.random()-.5);
  D().courses.push({id:CC.id('K'), title:t, mins:Math.max(1, Math.round(body.join(' ').split(' ').length/120)), required:chk('co-r'), body, quiz:[{q, opts:order.map(i=>a[i]), a:order.indexOf(0)}]});
  activeEmps().forEach(e => CC.notify(e.id, `New lesson in the crew app: ${t}`, 'Push', 'training'));
  closeModal(); commit(`Published lesson "${t}"`); toast('Lesson published'); };
EXT.acts['course-del'] = (el, v) => { D().courses = D().courses.filter(c=>c.id!==v); commit('Deleted a lesson'); };
EXT.counts.hr = () => activeEmps().reduce((a,e)=>a + CC.docTypesFor(e).filter(t => ['expired','missing'].includes(CC.docState(e.id,t.id).state)).length, 0);

/* =====================================================================
   Hiring
   ===================================================================== */
const STAGES = ['Applied','Interview','Offer','Hired'];
function applyUrl(job){ return CC.crewAppBase().replace(/index\.html$/,'') + 'apply.html?job=' + encodeURIComponent(job.id); }
function pHiring(){
  const jobs = D().jobs, apps = D().applicants.filter(a => M.jobQ==='all' || a.job===M.jobQ);
  return `
  <div class="toolbar"><div class="chips"><button class="chip ${M.jobQ==='all'?'on':''}" data-act="job-q" data-v="all">All jobs<b>${D().applicants.filter(a=>a.stage!=='Rejected'&&a.stage!=='Hired').length}</b></button>${jobs.map(j => `<button class="chip ${M.jobQ===j.id?'on':''}" data-act="job-q" data-v="${j.id}">${esc(j.title)}<b>${D().applicants.filter(a=>a.job===j.id&&a.stage!=='Rejected'&&a.stage!=='Hired').length}</b></button>`).join('')}</div>
    <button class="btn sm primary" data-act="job-new">${ic('plus')} Post a job</button></div>
  <div class="cards">${jobs.filter(j => M.jobQ==='all' || j.id===M.jobQ).map(j => `<article class="req"><div class="row between"><div><div class="title" style="font-size:15px">${esc(j.title)}</div><div class="meta">${esc(venue(j.venue).name)} · ${esc(j.type)} · ${money(j.rate)}/hr</div></div>${badge(j.status, j.status==='Open'?'ok':'')}</div><p class="req-d">${esc(j.desc)}</p>
    <div class="row" style="justify-content:flex-end;gap:6px;flex-wrap:wrap"><button class="btn sm" data-act="job-link" data-v="${j.id}">${ic('copy')} Copy apply link</button><a class="btn sm" href="apply.html?job=${j.id}" target="_blank" rel="noopener">${ic('ext')} Preview</a><button class="btn sm" data-act="job-toggle" data-v="${j.id}">${j.status==='Open'?'Close':'Reopen'}</button></div></article>`).join('')}</div>
  <div class="pipe">${STAGES.map(st => `<section class="pipe-col"><div class="label">${st} <b>${apps.filter(a=>a.stage===st).length}</b></div>${apps.filter(a=>a.stage===st).sort((a,b)=>b.t-a.t).map(a => { const j = jobs.find(x=>x.id===a.job); return `
    <article class="app-card"><div class="title" style="font-size:14px">${esc(a.name)}</div><div class="meta">${esc(j?.title||'')} · applied ${fShort(a.t)}</div>${a.note?`<div class="small" style="margin-top:4px">${esc(a.note)}</div>`:''}<div class="meta">${esc(a.phone)}${a.email?` · ${esc(a.email)}`:''}</div>
      ${a.interview && a.stage==='Interview' ? `<div class="meta" style="color:var(--info)">Interview ${fDate(a.interview)} ${fTime(a.interview)}</div>` : ''}
      <div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap">${st==='Applied'?`<button class="btn sm" data-act="app-int" data-v="${a.id}">Interview</button>`:''}${st==='Interview'?`<button class="btn sm" data-act="app-move" data-v="${a.id}" data-s="Offer">Make offer</button>`:''}${st==='Offer'?`<button class="btn sm primary" data-act="app-hire" data-v="${a.id}">Hire</button>`:''}${st!=='Hired'?`<button class="btn sm" data-act="app-move" data-v="${a.id}" data-s="Rejected">Pass</button>`:''}</div>
    </article>`; }).join('') || '<div class="small faint" style="padding:8px">None</div>'}</section>`).join('')}</div>
  ${apps.some(a=>a.stage==='Rejected') ? `<p class="small faint" style="margin-top:10px">${apps.filter(a=>a.stage==='Rejected').length} passed: ${apps.filter(a=>a.stage==='Rejected').map(a=>esc(a.name)).join(', ')}</p>` : ''}`;
}
EXT.acts['job-q'] = (el, v) => { M.jobQ = v; };
EXT.acts['job-toggle'] = (el, v) => { const j = D().jobs.find(x=>x.id===v); j.status = j.status==='Open' ? 'Closed' : 'Open'; commit(`${j.status==='Open'?'Reopened':'Closed'} job post ${j.title}`); };
EXT.acts['job-link'] = (el, v) => { const url = applyUrl(D().jobs.find(x=>x.id===v)); (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(()=>toast('Apply link copied'), ()=>openModal(`${mHead('Apply link')}<input class="input mono" readonly value="${esc(url)}" onfocus="this.select()">`)); return false; };
EXT.acts['job-new'] = () => { openModal(`${mHead('Post a job','Share the apply link on Indeed, Instagram or a QR code at the counter.')}<div class="fgrid" style="margin-top:6px">
  <label class="field"><span>Job title</span><input class="input" id="jb-t" placeholder="e.g. Prep cook"></label><label class="field"><span>Venue</span><select class="input" id="jb-v">${X.venueOpts('pico')}</select></label>
  <label class="field"><span>Pay ($/hr)</span><input class="input num" id="jb-r" value="20.00"></label><label class="field"><span>Type</span><select class="input" id="jb-ty"><option>Part-time</option><option>Full-time</option><option>Seasonal</option></select></label>
  <label class="field" style="grid-column:1/-1"><span>Description</span><textarea class="input" id="jb-d"></textarea></label></div>
  ${btns(`<button class="btn sm" data-act="close">Cancel</button>`, `<button class="btn sm primary" data-act="job-save">${ic('check')} Post</button>`)}`); return false; };
EXT.acts['job-save'] = () => { const t = val('jb-t').trim(); if (!t){ toast('Add a job title'); return false; } D().jobs.push({id:CC.id('J'), title:t, venue:val('jb-v'), rate:parseFloat(val('jb-r'))||20, type:val('jb-ty'), status:'Open', t:now(), desc:val('jb-d').trim()}); closeModal(); commit(`Posted job: ${t}`); toast('Job posted'); };
EXT.acts['app-move'] = (el, v) => { const a = D().applicants.find(x=>x.id===v); a.stage = el.dataset.s; commit(`Moved applicant ${a.name} to ${a.stage}`); };
EXT.acts['app-int'] = (el, v) => { const a = D().applicants.find(x=>x.id===v);
  openModal(`${mHead(`Interview ${esc(a.name)}`)}<div class="fgrid" style="margin-top:6px"><label class="field"><span>Date</span><input class="input" type="date" id="ai-d" value="${toDateInput(now()+DAY)}"></label><label class="field"><span>Time</span><input class="input" type="time" id="ai-t" value="15:00"></label></div>
  <label class="check"><input type="checkbox" id="ai-sms" checked><span>Text ${esc(a.name.split(' ')[0])} the time (simulated)</span></label>${btns(`<button class="btn sm" data-act="close">Cancel</button>`, `<button class="btn sm primary" data-act="app-int-save" data-v="${v}">${ic('check')} Schedule</button>`)}`); return false; };
EXT.acts['app-int-save'] = (el, v) => { const a = D().applicants.find(x=>x.id===v); a.interview = fromInputs(val('ai-d'), val('ai-t')); a.stage = 'Interview';
  if (chk('ai-sms')) CC.notify(a.phone, `Hi ${a.name.split(' ')[0]}, this is ${ST().company}. Your interview is ${fDate(a.interview)} at ${fTime(a.interview)}.`, 'SMS', 'hiring');
  closeModal(); commit(`Scheduled interview with ${a.name}`); toast('Interview scheduled'); };
EXT.acts['app-hire'] = (el, v) => { const a = D().applicants.find(x=>x.id===v), j = D().jobs.find(x=>x.id===a.job); const pin = String(1000 + Math.floor(Math.random()*9000));
  openModal(`${mHead(`Hire ${esc(a.name)}`, 'Adds them to the crew. They get a welcome text and every onboarding form in the crew app.')}<div class="fgrid" style="margin-top:6px">
  <label class="field"><span>Role</span><input class="input" id="hi-role" value="${esc(j?.title.replace(/\s*\(.*\)/,'')||'Cashier')}"></label><label class="field"><span>Rate ($/hr)</span><input class="input num" id="hi-rate" value="${(j?.rate||20).toFixed(2)}"></label>
  <label class="field"><span>Home venue</span><select class="input" id="hi-v">${X.venueOpts(j?.venue||'pico')}</select></label><label class="field"><span>Starting PIN</span><input class="input num" id="hi-pin" value="${pin}" maxlength="4"></label></div>
  <label class="check"><input type="checkbox" id="hi-minor"><span>Under 18 (adds a work permit and minor-hour checks)</span></label>
  ${btns(`<button class="btn sm" data-act="close">Cancel</button>`, `<button class="btn sm primary" data-act="app-hire-save" data-v="${v}">${ic('check')} Hire and start onboarding</button>`)}`); return false; };
EXT.acts['app-hire-save'] = (el, v) => { const a = D().applicants.find(x=>x.id===v), pin = val('hi-pin').trim();
  if (!/^\d{4}$/.test(pin) || D().employees.some(e=>e.pin===pin) || pin===ST().managerPin){ toast('Pick a 4-digit PIN nobody else uses'); return false; }
  const nums = D().employees.map(e => parseInt(e.id.slice(2))||0), id = `E-${Math.max(...nums)+7}`;
  const col = CC.COLORS[D().employees.length % CC.COLORS.length];
  D().employees.push({id, name:a.name, pin, initials:CC.initialsOf(a.name), color:col, roles:[{role:val('hi-role').trim()||'Cashier', rate:parseFloat(val('hi-rate'))||20}], home:val('hi-v'), phone:a.phone, active:true, minor:chk('hi-minor'), hiredT:now()});
  (D().docs ||= {})[id] = {}; a.stage = 'Hired'; a.emp = id;
  CC.notify(id, `Welcome to ${ST().company}, ${a.name.split(' ')[0]}. Open the crew app, pick your name and use PIN ${pin}. Your onboarding forms are in the Me tab.`, 'SMS', 'hiring');
  closeModal(); commit(`Hired ${a.name} (${id})`); toast(`${a.name.split(' ')[0]} added to the crew`); };

/* =====================================================================
   Feedback
   ===================================================================== */
function pFeedback(){
  const fb = D().feedback.filter(f => f.t >= now() - 14*DAY).sort((a,b)=>b.t-a.t), avg = fb.length ? fb.reduce((a,f)=>a+f.score,0)/fb.length : 0;
  const byV = {}; fb.forEach(f => { (byV[f.venue] ||= []).push(f.score); });
  const faces = ['','Rough','Not great','Okay','Good','Great'];
  return `
  <div class="kpi-row">${kpi(avg ? avg.toFixed(1)+' / 5' : '—', 'Average shift rating (14 days)', avg>=4?'ok':avg>=3?'warn':avg?'bad':'')}${kpi(fb.length, 'Responses')}${kpi(fb.filter(f=>f.score<=2).length, 'Rough shifts', fb.some(f=>f.score<=2)?'bad':'')}${kpi(D().suggestions.length, 'Suggestions')}</div>
  <div class="m-grid2"><section><div class="m-sec-h"><h2>By venue</h2></div><div class="card">${Object.entries(byV).map(([v, arr]) => { const a = arr.reduce((x,y)=>x+y,0)/arr.length; return `<div class="bar-row"><div class="bar-l">${esc(venue(v).name)}</div><div class="bar"><i style="width:${a/5*100}%"></i></div><div class="bar-v num">${a.toFixed(1)} <span class="faint">· ${arr.length}</span></div></div>`; }).join('') || '<div class="small muted">No ratings yet.</div>'}</div>
    <div class="m-sec-h"><h2>Suggestion box</h2><span class="small faint">Anonymous</span></div><div class="list">${D().suggestions.slice().sort((a,b)=>b.t-a.t).map(s => `<div class="li"><span class="vt sm">${ic('heart')}</span><div class="grow"><div class="small">${esc(s.text)}</div><div class="meta">${fDate(s.t)}${s.venue?` · ${esc(venue(s.venue).name)}`:''}</div></div></div>`).join('') || '<div class="li small muted">Nothing yet.</div>'}</div></section>
  <section><div class="m-sec-h"><h2>Recent shifts</h2><label class="toggle"><input type="checkbox" data-act-change="fb-toggle" ${ST().surveyOnOut?'checked':''}><span>Ask at clock-out</span></label></div>
    <div class="list">${fb.map(f => { const e = emp(f.emp); return `<div class="li">${avatar(e,30)}<div class="grow"><div class="title" style="font-size:14px">${esc(e?.name)} · ${esc(venue(f.venue).name)}</div>${f.note?`<div class="small">${esc(f.note)}</div>`:''}<div class="meta">${fDate(f.t)}</div></div>${badge(`${f.score} · ${faces[f.score]}`, f.score>=4?'ok':f.score===3?'':'bad')}</div>`; }).join('') || '<div class="li small muted">No responses in the last 14 days.</div>'}</div></section></div>`;
}
EXT.changes['fb-toggle'] = el => { ST().surveyOnOut = el.checked; commit(`${el.checked?'Turned on':'Turned off'} the clock-out survey`); X.render(); };

/* =====================================================================
   Integrations (simulated in this preview)
   ===================================================================== */
const INTS = [
  {id:'square', name:'Square', kind:'pos', desc:'Pull sales and card tips from Square POS.'},
  {id:'clover', name:'Clover', kind:'pos', desc:'Pull sales and card tips from Clover.'},
  {id:'toast', name:'Toast', kind:'pos', desc:'Pull sales, tips and punches from Toast.'},
  {id:'gusto', name:'Gusto', kind:'pay', desc:'Send approved hours, tips and premiums to Gusto payroll.'},
  {id:'adp', name:'ADP RUN', kind:'pay', desc:'Send approved hours to ADP RUN.'},
  {id:'quickbooks', name:'QuickBooks Payroll', kind:'pay', desc:'Send hours and pay to QuickBooks.'},
];
function pIntegrations(){
  const I = D().integrations;
  const card = x => { const s = I[x.id] || {}; return `<article class="req"><div class="row between"><div class="row"><span class="vt sm">${ic(x.kind==='pos'?'store':'dollar')}</span><div><div class="title" style="font-size:15px">${x.name}</div><div class="meta">${x.kind==='pos'?'Register (POS)':'Payroll'}</div></div></div>${s.on?badge('Connected · demo','ok'):badge('Not connected')}</div>
    <p class="req-d">${x.desc}</p>${s.last?`<div class="meta">Last sync ${fDate(s.last)} ${fTime(s.last)}${s.note?` · ${esc(s.note)}`:''}</div>`:''}
    <div class="row" style="justify-content:flex-end;gap:6px;margin-top:10px">${s.on?`<button class="btn sm" data-act="int-sync" data-v="${x.id}">${ic('refresh')} ${x.kind==='pos'?'Sync now':'Send this period'}</button><button class="btn sm" data-act="int-toggle" data-v="${x.id}">Disconnect</button>`:`<button class="btn sm primary" data-act="int-toggle" data-v="${x.id}">${ic('plug')} Connect (demo)</button>`}</div></article>`; };
  return `<div class="alert info" style="margin-bottom:14px">${ic('info')}<div>In this preview, connections are simulated so you can see the flow. A live connection needs your Square, Toast, Gusto or ADP account and its API keys. Until then, use <b>Import POS sales</b> on Labor &amp; sales and <b>Export for payroll</b> on Payroll.</div></div>
  <div class="m-sec-h"><h2>Registers</h2></div><div class="cards">${INTS.filter(x=>x.kind==='pos').map(card).join('')}</div>
  <div class="m-sec-h"><h2>Payroll</h2></div><div class="cards">${INTS.filter(x=>x.kind==='pay').map(card).join('')}</div>`;
}
EXT.acts['int-toggle'] = (el, v) => { const I = D().integrations; I[v] = {...(I[v]||{}), on:!I[v]?.on}; commit(`${I[v].on?'Connected':'Disconnected'} ${INTS.find(x=>x.id===v).name} (demo)`); toast(I[v].on ? 'Connected (demo)' : 'Disconnected'); };
EXT.acts['int-sync'] = (el, v) => { const x = INTS.find(i=>i.id===v), I = D().integrations[v];
  if (x.kind==='pos'){ const t0 = startOfDay(now()); let n = 0; venuesOn().forEach(ven => { const a = CC.salesSoFar(ven.id); if (a > 0){ D().sales[CC.salesKey(ven.id, t0)] = a; n++; } }); I.note = `${n} venues updated`; }
  else { const ps = X.curPs(); const ap = Object.keys(D().approvals[ps]||{}).length; I.note = `${ap} approved timesheets sent for ${fShort(ps)} period`; }
  I.last = now(); commit(`${x.name} sync (demo): ${I.note}`); toast(`${x.name}: ${I.note}`); };

/* =====================================================================
   Notifications outbox
   ===================================================================== */
function pOutbox(){
  const st = ST(), list = D().outbox.filter(o => M.obEmp==='all' || o.to===M.obEmp);
  const toName = to => to==='all' ? 'All crew' : emp(to)?.name || esc(to);
  return `
  <div class="card"><div class="row between" style="flex-wrap:wrap;gap:10px"><div><div class="title" style="font-size:15px">Shift reminders</div><div class="small muted">Texts each person before their shift starts. Simulated in this preview; real texting needs a messaging account such as Twilio.</div></div>
    <div class="row" style="gap:10px;flex-wrap:wrap"><label class="toggle"><input type="checkbox" data-act-change="ob-sms" ${st.smsReminders?'checked':''}><span>On</span></label>
    <select class="input sm" data-act-change="ob-min" aria-label="When">${[30,60,120,720].map(m=>`<option value="${m}" ${st.remindBeforeMin==m?'selected':''}>${m<60?m+' min':m/60+' hr'} before</option>`).join('')}</select></div></div></div>
  <div class="toolbar" style="margin-top:14px"><select class="input sm" data-act-change="ob-emp" aria-label="Person"><option value="all">Everyone</option>${activeEmps().map(e=>`<option value="${e.id}" ${M.obEmp===e.id?'selected':''}>${esc(e.name)}</option>`).join('')}</select><button class="btn sm" data-act="ob-test">${ic('bell')} Send a test text</button></div>
  <div class="list">${list.slice(0,80).map(o => `<div class="li"><span class="vt sm">${ic(o.channel==='SMS'?'phone':'bell')}</span><div class="grow"><div class="title" style="font-size:14px">${esc(toName(o.to))} ${badge(o.channel, o.channel==='SMS'?'info':'')} <span class="faint small">${esc(o.kind)}</span></div><div class="small">${esc(o.text)}</div><div class="meta">${fDate(o.t)} · ${fTime(o.t)}</div></div></div>`).join('') || '<div class="li small muted">Nothing sent yet.</div>'}</div>`;
}
EXT.changes['ob-sms'] = el => { ST().smsReminders = el.checked; commit(); X.render(); };
EXT.changes['ob-min'] = el => { ST().remindBeforeMin = parseInt(el.value); commit(); X.render(); };
EXT.changes['ob-emp'] = el => { M.obEmp = el.value; X.render(); };
EXT.acts['ob-test'] = () => { const to = M.obEmp==='all' ? activeEmps()[0].id : M.obEmp; CC.notify(to, `Test message from ${ST().company}.`, 'SMS', 'test'); commit(); toast('Test text added'); };

/* =====================================================================
   Schedule add-ons: availability, confirmations, issues, publish, auto-schedule, staffing needs, replacements
   ===================================================================== */
EXT.chip = (s, isOpen) => {
  if (isOpen) return s.auto ? `<span class="badge info" style="margin-top:3px">Offered</span>` : '';
  const iss = CC.shiftIssues(s), worst = iss.find(i=>i.sev==='bad') || iss.find(i=>i.sev==='warn');
  return `<span class="chip-marks">${ST().confirmShifts ? (s.confirmed ? `<i class="cm ok" title="Confirmed">${ic('check')}</i>` : s.startT > now() ? `<i class="cm q" title="Not confirmed yet">?</i>` : '') : ''}${worst ? `<i class="cm ${worst.sev}" title="${esc(iss.map(i=>i.text).join(' · '))}">${ic('alert')}</i>` : ''}${s.lateChange && !s.lateChange.waived ? `<i class="cm warn" title="Changed inside the notice window">${ic('clock')}</i>` : ''}</span>`;
};
EXT.cell = (empId, d, items) => {
  const off = CC.timeOffOn(empId, d); if (off) return `<div class="av off">Time off</div>`;
  const a = CC.availFor(empId, d); if (!a) return '';
  if (a.off) return `<div class="av off">Unavailable</div>`;
  if (items.length) return '';
  return `<div class="av">Free ${CC.fTimeHM(a.from)}–${CC.fTimeHM(a.to)}</div>`;
};
EXT.schedTools = ws => { const pub = D().published?.[ws]; return `
  ${pub ? `<span class="badge ok" title="Published by ${esc(pub.by)}">${ic('check','" style="width:11px;height:11px')} Published ${fShort(pub.t)}</span><button class="btn sm" data-act="sch-publish" data-v="${ws}">Re-send</button>` : `<button class="btn sm primary" data-act="sch-publish" data-v="${ws}">${ic('mega')} Publish &amp; notify</button>`}
  <button class="btn sm" data-act="sch-auto" data-v="${ws}">${ic('spark')} Auto-schedule</button>
  <button class="btn sm" data-act="sch-needs">${ic('users')} Staffing needs</button>`; };
EXT.schedBelow = (ws, days) => { const t0 = startOfDay(now()); const vs = venuesOn().map(v=>v.id);
  const row = days.map(d => { const f = vs.reduce((a,v)=>a+CC.forecast(v,d),0), s = vs.reduce((a,v)=>a+CC.laborScheduled(v,d),0), p = laborPct(f, s);
    const unconf = D().shifts.filter(x => startOfDay(x.startT)===d && !x.confirmed && x.startT > now()).length;
    return `<div class="sb-d ${d===t0?'today':''}"><div class="label" style="font-size:10.5px">${DOW[new Date(d).getDay()]}</div><div class="num small">${money(f).replace('.00','')} <span class="faint">sales</span></div><div class="num small">${money(s).replace('.00','')} <span class="faint">labor</span></div>${p==null?'<span class="faint small">—</span>':badge(fPct(p), pctCls(p))}${ST().confirmShifts && unconf ? `<div class="meta">${unconf} unconfirmed</div>` : ''}</div>`; }).join('');
  return `<div class="sched-below"><div class="sb-h"><b>Forecast vs labor</b><span class="meta">Target ${ST().laborTarget}% · <button class="link" data-act="page" data-v="labor">details</button></span></div><div class="sb-row">${row}</div>
  <div class="sb-legend small faint"><span><i class="cm ok">${ic('check')}</i> confirmed</span><span><i class="cm q">?</i> not confirmed</span><span><i class="cm warn">${ic('alert')}</i> rest, availability or overtime issue</span><span><i class="cm bad">${ic('alert')}</i> minor-hour rule</span><span><i class="cm warn">${ic('clock')}</i> changed late</span></div></div>`; };
EXT.shiftModalExtra = (s, isOpen) => { if (!s || isOpen) return ''; const iss = CC.shiftIssues(s);
  return `${iss.length ? `<div class="alert warn" style="margin-top:14px">${ic('alert')}<div>${iss.map(i=>esc(i.text)).join('<br>')}</div></div>` : ''}
  <div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap">${s.confirmed ? badge(`Confirmed ${fShort(s.confirmed)} ${fTime(s.confirmed)}`,'ok') : s.startT > now() ? badge('Not confirmed yet') : ''}
  ${s.startT > now() ? `<button class="btn sm" data-act="find-rep" data-v="${s.id}">${ic('swap')} Find a replacement</button>` : ''}</div>`; };
EXT.afterShiftSave = (s, prev) => { const ws = CC.weekStartOf(s.startT); if (!D().published?.[ws]) return;
  CC.notify(s.emp, `${prev ? 'Schedule change' : 'New shift'}: ${fDate(s.startT)} ${fTime(s.startT)}–${fTime(s.endT)} at ${venue(s.venue).name}.`, 'Push', 'schedule');
  if (prev && prev.emp !== s.emp) CC.notify(prev.emp, `Your ${fDate(prev.startT)} shift was given to someone else.`, 'Push', 'schedule'); };
EXT.acts['sch-publish'] = (el, v) => { const ws = Number(v), list = D().shifts.filter(s => s.startT>=ws && s.startT<ws+7*DAY);
  (D().published ||= {})[ws] = {t:now(), by:MGRN()}; const by = {}; list.forEach(s => (by[s.emp] ||= []).push(s));
  Object.entries(by).forEach(([id, ss]) => CC.notify(id, `Your schedule for the week of ${fShort(ws)} is posted: ${ss.length} shift${ss.length>1?'s':''}. Open the app to confirm.`, 'Push', 'schedule'));
  commit(`Published the schedule for the week of ${fShort(ws)}`); toast(`Published. ${Object.keys(by).length} people notified.`); };
function eligibleFor(sh, skip){
  return activeEmps().filter(e => e.id !== skip && e.roles.some(r=>r.role===sh.role) && !D().shifts.some(x => x.emp===e.id && x.startT < sh.endT && x.endT > sh.startT))
    .map(e => { const probe = {...sh, id:'_p', emp:e.id}; const iss = CC.shiftIssues(probe); return {e, iss, ok: !iss.some(i => i.sev==='bad' || i.k==='avail' || i.k==='rest'), wk: CC.weekHours(e.id, sh.startT)}; })
    .sort((a,b) => (b.ok - a.ok) || (a.wk - b.wk));
}
EXT.acts['find-rep'] = (el, v) => { const s = D().shifts.find(x=>x.id===v), list = eligibleFor(s, s.emp);
  openModal(`${mHead('Find a replacement', `${esc(emp(s.emp).name)} · ${fDate(s.startT)} ${fTime(s.startT)}–${fTime(s.endT)} · ${esc(s.role)}`)}
  <div class="list" style="margin-top:10px">${list.map(x => `<div class="li">${avatar(x.e,30)}<div class="grow"><div class="title" style="font-size:14px">${esc(x.e.name)}</div><div class="meta">${x.wk.toFixed(1)} hrs this week${x.iss.length?' · '+x.iss.map(i=>esc(i.text)).join(' · '):''}</div></div>${x.ok?badge('Eligible','ok'):badge('Check','warn')}<button class="btn sm" data-act="rep-assign" data-v="${s.id}" data-e="${x.e.id}">Assign</button></div>`).join('') || '<div class="li small muted">Nobody else has this role and is free.</div>'}</div>
  ${btns(`<button class="btn sm" data-act="close">Cancel</button>`, `<button class="btn sm primary" data-act="rep-offer" data-v="${s.id}" ${list.some(x=>x.ok)?'':'disabled'}>${ic('mega')} Offer to everyone eligible (${list.filter(x=>x.ok).length})</button>`)}
  <p class="small faint" style="margin-top:8px">Offering posts it as an open shift. The first eligible person to tap Pick up in the crew app gets it, no approval needed.</p>`, true); return false; };
EXT.acts['rep-assign'] = (el, v) => { const s = D().shifts.find(x=>x.id===v), from = s.emp; s.emp = el.dataset.e; delete s.confirmed; CC.markScheduleChange(s);
  CC.notify(s.emp, `You've been added to ${fDate(s.startT)} ${fTime(s.startT)}–${fTime(s.endT)} at ${venue(s.venue).name}.`, 'Push', 'schedule'); CC.notify(from, `Your ${fDate(s.startT)} shift is covered by ${emp(s.emp).name}.`, 'Push', 'schedule');
  closeModal(); commit(`Reassigned ${fDate(s.startT)} shift from ${emp(from).name} to ${emp(s.emp).name}`); toast('Replacement assigned'); };
EXT.acts['rep-offer'] = (el, v) => { const s = D().shifts.find(x=>x.id===v), list = eligibleFor(s, s.emp).filter(x=>x.ok);
  D().openShifts.push({id:CC.id('O'), venue:s.venue, startT:s.startT, endT:s.endT, role:s.role, note:`Covering for ${emp(s.emp).name.split(' ')[0]}`, spots:1, auto:true, eligible:list.map(x=>x.e.id), from:s.emp});
  D().shifts = D().shifts.filter(x=>x.id!==v);
  list.forEach(x => CC.notify(x.e.id, `Shift up for grabs: ${fDate(s.startT)} ${fTime(s.startT)}–${fTime(s.endT)} at ${venue(s.venue).name}. First to tap Pick up gets it.`, 'SMS', 'replacement'));
  closeModal(); commit(`Offered ${emp(s.emp).name}'s ${fDate(s.startT)} shift to ${list.length} people`); toast(`Offered to ${list.length} people`); };

function autoPlan(ws){
  const t0 = startOfDay(now()), props = [], unfilled = [], temp = D().shifts.slice();
  (D().needs||[]).forEach(n => { for (let k = 0; k < 7; k++){ const d = ws + k*DAY; if (d < t0 || !n.dows.includes(new Date(d).getDay())) continue;
    const ven = venue(n.venue); if (!venueActive(ven)) continue;
    const startT = at(d, n.from), endT = at(d, n.to) <= startT ? at(d, n.to) + DAY : at(d, n.to);
    const have = temp.filter(s => s.venue===n.venue && s.role===n.role && s.startT < endT && s.endT > startT && (Math.min(endT,s.endT) - Math.max(startT,s.startT)) >= (endT-startT)/2).length;
    for (let i = have; i < n.count; i++){
      const sh = {venue:n.venue, role:n.role, startT, endT};
      const cands = activeEmps().filter(e => e.roles.some(r=>r.role===n.role) && !temp.some(x => x.emp===e.id && startOfDay(x.startT)===d))
        .map(e => { const probe = {...sh, id:'_p', emp:e.id}; const iss = CC.shiftIssues(probe, temp); const wk = temp.filter(x=>x.emp===e.id && x.startT>=ws && x.startT<ws+7*DAY).reduce((a,x)=>a+(x.endT-x.startT)/HR,0);
          return {e, iss, wk, ok: !iss.some(z => z.sev==='bad' || z.k==='avail' || z.k==='rest') && wk + (endT-startT)/HR <= ST().otWeekly}; })
        .filter(c => c.ok).sort((a,b) => (a.wk - b.wk) || ((b.e.home===n.venue) - (a.e.home===n.venue)));
      if (cands[0]){ const p = {...sh, id:'_a'+props.length, emp:cands[0].e.id, station:'Auto-scheduled', why:`${cands[0].wk.toFixed(1)} hrs so far, available`}; props.push(p); temp.push(p); }
      else unfilled.push(sh);
    } } });
  return {props, unfilled};
}
EXT.acts['sch-auto'] = (el, v) => { const ws = Number(v), {props, unfilled} = autoPlan(ws); M.autoPlan = {ws, props, unfilled};
  openModal(`${mHead('Auto-schedule', `Fills the staffing needs for the week of ${fShort(ws)} using availability, time off, rest between shifts, minor-hour rules and overtime.`)}
  ${props.length ? `<div class="list" style="margin-top:10px">${props.map((p,i) => { const e = emp(p.emp); return `<label class="li" style="cursor:pointer"><input type="checkbox" class="ap-c" data-i="${i}" checked>${avatar(e,28)}<div class="grow"><div class="title" style="font-size:14px">${esc(e.name)} · ${esc(p.role)}</div><div class="meta">${fDate(p.startT)} ${fTime(p.startT)}–${fTime(p.endT)} · ${esc(venue(p.venue).name)} · ${esc(p.why)}</div></div></label>`; }).join('')}</div>` : `<div class="alert ok" style="margin-top:10px">${ic('check')}<div>Every staffing need this week is already covered.</div></div>`}
  ${unfilled.length ? `<div class="alert warn" style="margin-top:10px">${ic('alert')}<div><b>${unfilled.length} slot${unfilled.length>1?'s':''} nobody can fill</b> without breaking a rule: ${unfilled.slice(0,4).map(u=>`${fDate(u.startT)} ${esc(u.role)} at ${esc(venue(u.venue).name)}`).join('; ')}${unfilled.length>4?'…':''}<label class="check" style="margin-top:6px"><input type="checkbox" id="ap-open" checked><span>Post them as open shifts</span></label></div></div>` : ''}
  ${btns(`<button class="btn sm" data-act="close">Cancel</button>`, `<button class="btn sm primary" data-act="sch-auto-go" ${props.length||unfilled.length?'':'disabled'}>${ic('check')} Add to schedule</button>`)}`, true); return false; };
EXT.acts['sch-auto-go'] = () => { const P = M.autoPlan; if (!P) return false; const pick = new Set([...document.querySelectorAll('.ap-c')].filter(c=>c.checked).map(c=>+c.dataset.i));
  let n = 0; P.props.forEach((p,i) => { if (!pick.has(i)) return; const s = {id:CC.id('S'), emp:p.emp, venue:p.venue, startT:p.startT, endT:p.endT, role:p.role, station:'Auto-scheduled'}; D().shifts.push(s); CC.markScheduleChange(s); n++; });
  let o = 0; if (chk('ap-open')) P.unfilled.forEach(u => { D().openShifts.push({id:CC.id('O'), ...u, note:'Needs coverage', spots:1}); o++; });
  closeModal(); commit(`Auto-scheduled ${n} shifts${o?` and posted ${o} open shifts`:''} for the week of ${fShort(P.ws)}`); toast(`${n} shifts added${o?`, ${o} open shifts posted`:''}`); M.autoPlan = null; };
const needRow = (n={venue:'pico', role:'Cashier', dows:[1,2,3,4,5], from:'11:00', to:'19:00', count:1}) => `<div class="nd-row">
  <select class="input sm nd-v">${venuesOn().map(v=>`<option value="${v.id}" ${n.venue===v.id?'selected':''}>${esc(v.name)}</option>`).join('')}</select>
  <select class="input sm nd-r">${[...new Set(D().employees.flatMap(e=>e.roles.map(r=>r.role)))].map(r=>`<option ${n.role===r?'selected':''}>${esc(r)}</option>`).join('')}</select>
  <span class="nd-days">${DOW.map((d,i)=>`<label><input type="checkbox" value="${i}" ${n.dows.includes(i)?'checked':''}><span>${d[0]}</span></label>`).join('')}</span>
  <input class="input sm nd-f" type="time" value="${n.from}"><input class="input sm nd-t" type="time" value="${n.to}"><input class="input sm num nd-c" type="number" min="1" value="${n.count}" aria-label="People">
  <button class="btn sm" data-act="nd-del" aria-label="Remove">${ic('trash')}</button></div>`;
EXT.acts['sch-needs'] = () => { openModal(`${mHead('Staffing needs', 'How many people you need, by venue, role, day and time. Auto-schedule fills these.')}
  <div class="nd-head small faint"><span>Venue</span><span>Role</span><span>Days</span><span>From</span><span>To</span><span>People</span><span></span></div><div id="ndRows">${(D().needs||[]).map(needRow).join('')}</div>
  <button class="btn sm" data-act="nd-add" style="margin-top:8px">${ic('plus')} Add a need</button>${btns(`<button class="btn sm" data-act="close">Cancel</button>`, `<button class="btn sm primary" data-act="nd-save">${ic('check')} Save needs</button>`)}`, true); return false; };
EXT.acts['nd-add'] = () => { document.getElementById('ndRows').insertAdjacentHTML('beforeend', needRow()); return false; };
EXT.acts['nd-del'] = el => { el.closest('.nd-row').remove(); return false; };
EXT.acts['nd-save'] = () => { D().needs = [...document.querySelectorAll('#ndRows .nd-row')].map((r,i) => ({id:'N-'+(i+1), venue:r.querySelector('.nd-v').value, role:r.querySelector('.nd-r').value, dows:[...r.querySelectorAll('.nd-days input:checked')].map(x=>+x.value), from:r.querySelector('.nd-f').value, to:r.querySelector('.nd-t').value, count:Math.max(1, parseInt(r.querySelector('.nd-c').value)||1)})).filter(n => n.dows.length);
  closeModal(); commit(`Updated staffing needs (${D().needs.length})`); toast('Staffing needs saved'); };

/* =====================================================================
   Requests: shift swaps, drops and early pay
   ===================================================================== */
const shiftLine = s => s ? `${fDate(s.startT)} ${fTime(s.startT)}–${fTime(s.endT)} · ${esc(s.role)} · ${esc(venue(s.venue).name)}` : '<span style="color:var(--bad)">Shift no longer exists</span>';
EXT.req['Shift swap'] = r => { const s = D().shifts.find(x=>x.id===r.payload?.shift), th = r.payload?.theirShift && D().shifts.find(x=>x.id===r.payload.theirShift), to = emp(r.payload?.to);
  const probe = s && {...s, id:'_p', emp:to?.id}; const iss = probe ? CC.shiftIssues(probe).filter(i=>i.sev!=='info') : [];
  return {ctx:`<div class="meta"><b>Gives:</b> ${shiftLine(s)}</div>${th?`<div class="meta"><b>Takes:</b> ${shiftLine(th)}</div>`:''}<div class="meta" style="color:var(--ok)">${esc(to?.name)} accepted ${r.peerT?fTime(r.peerT):''}</div>${iss.length?`<div class="meta" style="color:var(--warn)">${iss.map(i=>esc(i.text)).join(' · ')}</div>`:''}`}; };
X.EXT.approve['Shift swap'] = r => { const s = D().shifts.find(x=>x.id===r.payload?.shift), th = r.payload?.theirShift && D().shifts.find(x=>x.id===r.payload.theirShift);
  if (!s){ toast('That shift no longer exists'); return false; }
  s.emp = r.payload.to; delete s.confirmed; CC.markScheduleChange(s); if (th){ th.emp = r.emp; delete th.confirmed; }
  [r.emp, r.payload.to].forEach(id => CC.notify(id, `Shift swap approved: ${fDate(s.startT)}${th?` and ${fDate(th.startT)}`:''}.`, 'Push', 'swap')); toast('Swap approved'); };
EXT.req['Shift release'] = r => { const s = D().shifts.find(x=>x.id===r.ref); return {ctx:`<div class="meta">${shiftLine(s)}</div><div class="meta">Approving posts it as an open shift for eligible crew.</div>`}; };
EXT.approve['Shift release'] = r => { const s = D().shifts.find(x=>x.id===r.ref); if (!s){ toast('That shift no longer exists'); return false; }
  const list = eligibleFor(s, s.emp).filter(x=>x.ok);
  D().openShifts.push({id:CC.id('O'), venue:s.venue, startT:s.startT, endT:s.endT, role:s.role, note:`Released by ${emp(s.emp).name.split(' ')[0]}`, spots:1, auto:true, eligible:list.map(x=>x.e.id), from:s.emp});
  D().shifts = D().shifts.filter(x=>x!==s); list.forEach(x => CC.notify(x.e.id, `Shift up for grabs: ${fDate(s.startT)} ${fTime(s.startT)}–${fTime(s.endT)} at ${venue(s.venue).name}.`, 'Push', 'replacement'));
  toast(`Posted. ${list.length} eligible people notified.`); };
EXT.req['Early pay'] = r => { const w = CC.ewaFor(r.emp); return {ctx:`<div class="meta">Earned so far this period: ${money(w.earned)} · limit ${ST().ewaPct}% (${money(w.cap)})</div><div class="meta">Deducted from the next paycheck.</div>`}; };
EXT.approve['Early pay'] = r => { const a = D().advances.find(x=>x.id===r.ref); if (a){ a.status = 'Paid'; a.paidT = now(); } CC.notify(r.emp, `Early pay of ${money(a?.amt||0)} is on its way to your account.`, 'Push', 'pay'); toast('Early pay sent (demo)'); };
EXT.deny['Early pay'] = r => { const a = D().advances.find(x=>x.id===r.ref); if (a) a.status = 'Denied'; };

/* =====================================================================
   Payroll export with provider formats and column picker
   ===================================================================== */
const COLS = [
  ['id','Employee ID', s=>s.e.id], ['name','Name', s=>s.e.name], ['reg','Regular hours', s=>fHrs(s.s.reg)], ['ot','Overtime hours', s=>fHrs(s.s.ot)], ['dt','Double time hours', s=>fHrs(s.s.dt)],
  ['regPay','Regular pay', s=>s.s.regPay.toFixed(2)], ['otPay','Overtime pay', s=>s.s.otPay.toFixed(2)], ['dtPay','Double time pay', s=>s.s.dtPay.toFixed(2)],
  ['prem','Break premiums', s=>s.s.prem.toFixed(2)], ['late','Predictability pay', s=>s.s.lateChg.toFixed(2)], ['tips','Tips', s=>s.s.tips.toFixed(2)], ['pool','Pooled tips', s=>s.s.pool.toFixed(2)],
  ['adv','Early pay deduction', s=>s.s.adv.toFixed(2)], ['gross','Gross wages', s=>s.s.gross.toFixed(2)], ['ap','Approved', s=>s.ap?'Yes':'No'],
];
const PRESETS = {
  generic:{name:'Generic CSV', cols:['id','name','reg','ot','dt','regPay','otPay','dtPay','prem','late','tips','adv','gross','ap']},
  gusto:{name:'Gusto', cols:['id','name','reg','ot','dt','prem','tips','adv'], h:{id:'employee_id', name:'employee_name', reg:'regular_hours', ot:'overtime_hours', dt:'double_overtime_hours', prem:'bonus', tips:'paycheck_tips', adv:'reimbursement_deduction'}},
  adp:{name:'ADP RUN', cols:['id','name','reg','ot','dt','tips','prem'], h:{id:'Co Code/File #', name:'Employee Name', reg:'Reg Hours', ot:'O/T Hours', dt:'D/T Hours', tips:'Tips', prem:'Premium Pay'}},
  qb:{name:'QuickBooks Time', cols:['name','reg','ot','dt','tips'], h:{name:'Employee', reg:'Regular', ot:'Overtime', dt:'Doubletime', tips:'Tips'}},
  toast:{name:'Toast Payroll', cols:['id','name','reg','ot','tips','prem'], h:{id:'Employee Number', name:'Employee', reg:'Regular Hours', ot:'Overtime Hours', tips:'Declared Tips', prem:'Premium'}},
};
EXT.acts['export-open'] = () => { const p = M.expPreset || 'generic'; const cols = new Set(M.expCols || PRESETS[p].cols);
  openModal(`${mHead('Export for payroll', `Pay period ${fShort(X.curPs())} – ${fShort(X.curPs()+CC.periodLen()-DAY)}`)}
  <label class="field" style="margin-top:6px"><span>Format</span><select class="input" id="ex-p" data-act-change="ex-preset">${Object.entries(PRESETS).map(([k,v])=>`<option value="${k}" ${k===p?'selected':''}>${v.name}</option>`).join('')}</select></label>
  <div class="label" style="margin-top:14px">Columns</div><div class="ex-cols">${COLS.map(([k,l]) => `<label class="check"><input type="checkbox" class="ex-c" value="${k}" ${cols.has(k)?'checked':''}><span>${l}</span></label>`).join('')}</div>
  <label class="check"><input type="checkbox" id="ex-ap"><span>Only approved timesheets</span></label>
  ${btns(`<button class="btn sm" data-act="close">Cancel</button>`, `<button class="btn sm primary" data-act="export-go">${ic('download')} Download CSV</button>`)}`); return false; };
EXT.changes['ex-preset'] = el => { M.expPreset = el.value; M.expCols = null; EXT.acts['export-open'](); };
EXT.acts['export-go'] = () => { const p = PRESETS[val('ex-p')] || PRESETS.generic, pick = [...document.querySelectorAll('.ex-c')].filter(c=>c.checked).map(c=>c.value); M.expCols = pick;
  const ps = X.curPs(), cols = COLS.filter(c => pick.includes(c[0])), onlyAp = chk('ex-ap');
  const rows = D().employees.map(e => ({e, s:CC.summary(e.id, ps), ap:(D().approvals[ps]||{})[e.id]})).filter(x => x.s.rows.length && (!onlyAp || x.ap));
  const q = s => `"${String(s ?? '').replace(/"/g,'""')}"`;
  const out = [cols.map(c => (p.h && p.h[c[0]]) || c[1]), ...rows.map(r => cols.map(c => c[2](r)))].map(r => r.map(q).join(',')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([out], {type:'text/csv'})); a.download = `cjs-payroll-${p.name.toLowerCase().replace(/\W+/g,'-')}-${toDateInput(ps)}.csv`; document.body.appendChild(a); a.click(); a.remove();
  closeModal(); commit(`Exported payroll (${p.name}) for ${fShort(ps)} period`); toast(`${p.name} file downloaded`); };

/* ---------- Register pages ---------- */
X.addPage('breaks', 'timeline', 'Break planner', 'Today', pBreaks, 'live');
X.addPage('chat', 'chat', 'Team chat', 'Today', pChat, 'approvals');
X.addPage('labor', 'chart', 'Labor & sales', 'Schedule & time', pLabor, 'timesheets');
X.addPage('compliance', 'shield', 'Compliance', 'Schedule & time', pCompliance, 'labor');
X.addPage('tips', 'dollar', 'Tip pool', 'Pay', pTips, 'payroll');
X.addPage('checklists', 'checklist', 'Checklists', 'Team', pChecklists, 'announce');
X.addPage('hr', 'doc', 'Paperwork & training', 'Team', pHr, 'checklists');
X.addPage('hiring', 'brief', 'Hiring', 'Team', pHiring, 'hr');
X.addPage('feedback', 'star', 'Feedback', 'Team', pFeedback, 'hiring');
X.addPage('integrations', 'plug', 'Integrations', 'Setup', pIntegrations, 'nfc');
X.addPage('outbox', 'bell', 'Notifications', 'Setup', pOutbox, 'integrations');
// Tip pool icon differs from payroll
X.PAGES.find(p=>p[0]==='tips')[1] = 'jar';

/* ---------- Background: shift reminders ---------- */
setInterval(() => { if (CC.runReminders()) CC.save(); }, 30000);
CC.ready.then(() => { if (CC.runReminders()) CC.save(); });
})();
