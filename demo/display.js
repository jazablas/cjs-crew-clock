/* CJ's Crew Board: a wall/tablet display showing who's working, who's scheduled today,
   and who needs a break (in red) so crew without their phone handy can see it. */
(() => {
'use strict';
const {ic, MIN, HR, DAY, now, startOfDay, fTime, fDay, fHM, esc, workedMs} = CC;
const D = () => CC.db, ST = () => CC.db.settings;
const root = document.getElementById('board'), modalRoot = document.getElementById('modalRoot');
const qs = new URLSearchParams(location.search);
const B = { venue: qs.get('venue') || null, started: !!qs.get('venue'), sound: false, pin:'', pinErr:false, alertIds: new Set(), wake:null };

const emp = id => CC.empById(id);
const venue = id => CC.venueById(id);
const inScope = vid => !B.venue || B.venue === 'all' || vid === B.venue;
const firstLast = n => n;

function toast(msg){ const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(()=>t.classList.remove('show'), 2600); }

/* ---------- Data ---------- */
function liveRows(){
  return D().punches.filter(p => !p.outT && !p.voided && inScope(p.venue) && emp(p.emp)).map(p => {
    const bs = CC.breakStatus(p);
    return {p, e:emp(p.emp), bs};
  }).sort((a,b) => (b.bs.alert?1:0) - (a.bs.alert?1:0) || a.p.inT - b.p.inT);
}
function todayRows(){
  const d0 = startOfDay(now()), d1 = d0 + DAY, t = now(), st = ST();
  return D().shifts.filter(s => s.startT >= d0 && s.startT < d1 && inScope(s.venue) && emp(s.emp) && emp(s.emp).active !== false)
    .sort((a,b)=>a.startT-b.startT).map(s => {
      const live = D().punches.find(p => p.emp===s.emp && !p.outT && !p.voided);
      const done = D().punches.find(p => p.emp===s.emp && p.outT && !p.voided && p.inT >= d0 && p.inT < d1);
      let k, label;
      if (live){ k='on'; label = live.breaks.some(b=>!b.end) ? 'On break' : 'Working'; }
      else if (done && t > s.startT){ k='done'; label = `Done ${fTime(done.outT)}`; }
      else if (t > s.endT){ k='noshow'; label = 'No-show'; }
      else if (t > s.startT + (st.lateGrace||7)*MIN){ k='late'; label = `Late ${fHM(t - s.startT)}`; }
      else if (t >= s.startT - 15*MIN){ k='soon'; label = t >= s.startT ? 'Starting now' : `In ${fHM(s.startT - t)}`; }
      else { k='later'; label = `In ${fHM(s.startT - t)}`; }
      return {s, e:emp(s.emp), k, label};
    });
}

const mmss = ms => { ms = Math.max(0, ms); const m = Math.floor(ms/MIN), sec = Math.floor(ms%MIN/1000); return m >= 60 ? fHM(ms) : `${m}:${String(sec).padStart(2,'0')}`; };
const brMinOf = b => b.min ?? (b.type==='meal' ? ST().mealMin : ST().restMin);
const brName = b => b.type==='meal' ? 'lunch' : `${brMinOf(b)}-min break`;
function shiftFlags(p){
  const st = ST(), t = now(), sh = CC.shiftFor(p), w = workedMs(p), out = [];
  if (w >= st.otDaily*HR) out.push({cls:'warn', t:'In overtime'});
  else if (w >= st.otDaily*HR - 30*MIN) out.push({cls:'warn', t:`Overtime in ${fHM(st.otDaily*HR - w)}`});
  if (sh){
    if (t > sh.endT + 5*MIN) out.push({cls:'warn', t:`Past shift end ${fHM(t - sh.endT)}`});
    else if (t >= sh.endT - 15*MIN) out.push({cls:'info', t: t >= sh.endT ? 'Shift ends now' : `Shift ends ${fTime(sh.endT)}`});
  }
  return out;
}
function upcomingBreaks(live){
  const t = now(), rows = [];
  live.forEach(({p, e, bs}) => { if (bs.open || bs.alert) return;
    const nx = bs.items.find(i => i.status==='soon' || i.status==='later');
    if (nx && nx.dueT - t <= 75*MIN) rows.push({p, e, nx}); });
  return rows.sort((a,b) => a.nx.dueT - b.nx.dueT);
}
function boardNotes(){
  const t = now();
  return (D().announcements||[]).filter(a => a.board !== false && (a.boardUntil ? a.boardUntil > t : t - a.t < 3*DAY) && (!a.venue || inScope(a.venue)))
    .sort((a,b) => (b.urgent?1:0) - (a.urgent?1:0) || b.t - a.t).slice(0, 3);
}

/* ---------- Rendering ---------- */
function render(){
  if (!B.started){ root.innerHTML = renderSetup(); return; }
  const live = liveRows(), sched = todayRows();
  const alerts = live.filter(r => r.bs.alert);
  const overrun = live.filter(r => r.bs.open && now() > r.bs.open.start + brMinOf(r.bs.open)*MIN + 2*MIN);
  const upcoming = upcomingBreaks(live), notes = boardNotes();
  const onBreak = live.filter(r => r.bs.open);
  const toCome = sched.filter(r => r.k==='later' || r.k==='soon' || r.k==='late');
  const vName = !B.venue || B.venue==='all' ? 'All venues' : venue(B.venue).name;
  chime(alerts);
  root.innerHTML = `
  <div class="bd ${alerts.length ? 'has-alerts' : ''}">
    <header class="bd-top">
      <div class="bd-brand"><div class="brand-word">CJ<span>&rsquo;</span>s Crew Board</div><div class="bd-venue">${esc(vName)}</div></div>
      <div class="bd-kpis">
        ${kpi(live.length, 'Working')}${kpi(onBreak.length, 'On break', 'warn')}${kpi(alerts.length, 'Need a break', alerts.length ? 'bad' : '')}${kpi(toCome.length, 'Still to come')}
      </div>
      <div class="bd-clock"><div class="bd-time num" id="bdTime">${fTime(now())}</div><div class="bd-date">${fDay(now())}</div></div>
    </header>

    ${notes.length ? `<section class="bd-notes">${notes.map(a => `<div class="bd-note ${a.urgent?'urgent':''}">${ic('mega')}<div><b>${a.urgent ? 'Heads up' : 'From the manager'}${a.venue && showVenue() ? ` · ${esc(venue(a.venue).name)}` : ''}</b><span>${esc(a.text)}</span></div></div>`).join('')}</section>` : ''}

    ${alerts.length ? `
    <section class="bd-alerts" aria-live="assertive">
      <h2 class="bd-h bad">${ic('alert')} Break needed</h2>
      <div class="bd-alert-grid">${alerts.map(alertCard).join('')}</div>
    </section>` : ''}

    ${overrun.length ? `
    <section class="bd-over">
      <h2 class="bd-h warn">${ic('clock')} Break time is up</h2>
      <div class="bd-over-grid">${overrun.map(({p, e, bs}) => `<div class="bd-over-card"><b>${esc(e.name)}</b><span>${brName(bs.open)[0].toUpperCase() + brName(bs.open).slice(1)} ended ${fTime(bs.open.start + brMinOf(bs.open)*MIN)} · over <span class="num" data-since="${bs.open.start + brMinOf(bs.open)*MIN}">${mmss(now() - bs.open.start - brMinOf(bs.open)*MIN)}</span></span></div>`).join('')}</div>
    </section>` : ''}

    <div class="bd-cols">
      <section class="bd-col">
        <h2 class="bd-h">On the clock now <span>${live.length}</span></h2>
        <div class="bd-list">${live.map(liveRow).join('') || `<div class="bd-empty">Nobody is clocked in${B.venue && B.venue!=='all' ? ' here' : ''} yet.</div>`}</div>
        <h2 class="bd-h" style="margin-top:18px">Breaks coming up <span>${upcoming.length}</span></h2>
        <div class="bd-list">${upcoming.map(({p, e, nx}) => `<div class="bd-up ${nx.status==='soon'?'soon':''}"><span class="bd-up-t num">${fTime(nx.dueT)}</span><span class="bd-up-n">${esc(e.name)}</span><span class="bd-up-k">${esc(nx.label)}</span><span class="bd-up-in num">${nx.dueT <= now() ? 'now' : 'in ' + fHM(nx.dueT - now())}</span></div>`).join('') || '<div class="bd-empty sm">No breaks due in the next hour.</div>'}</div>
      </section>
      <section class="bd-col">
        <h2 class="bd-h">Scheduled today <span>${sched.length}</span></h2>
        <div class="bd-list">${sched.map(schedRow).join('') || '<div class="bd-empty">No shifts on the schedule today.</div>'}</div>
        ${boardLists()}
      </section>
    </div>

    <footer class="bd-foot">
      ${ST().allowKiosk !== false ? `<button class="btn primary bd-punch" data-act="kiosk">${ic('clock')} No phone? Punch here</button>` : ''}
      <span>${ic('nfc')} Tap your phone on the CJ&rsquo;s sticker to clock in, start a break or clock out.</span>
      <span class="bd-legend"><i class="lg-bad"></i>Red = take your break now</span>
      <span class="bd-sync ${CC.isOnline() ? 'on' : ''}">${CC.isOnline() ? 'Live' : 'Offline'}</span>
      <button class="bd-gear" data-act="settings" aria-label="Board settings">${ic('gear')}</button>
    </footer>
  </div>`;
}
function boardLists(){
  const lists = (D().checklists||[]).filter(c => inScope(c.venue)).map(c => { const r = CC.runFor(c.id, now()), p = CC.listProgress(c, r); return {c, r, p}; })
    .filter(x => x.p.due - now() < 4*HR);
  if (!lists.length) return '';
  return `<h2 class="bd-h" style="margin-top:18px">Checklists <span>${lists.filter(x=>x.p.complete).length}/${lists.length}</span></h2>
    <div class="bd-list">${lists.map(({c, r, p}) => `<div class="bd-cl ${p.complete?'ok':p.late?'late':''}"><div class="bd-cl-n"><b>${esc(c.name)}</b>${showVenue() ? `<span>${esc(venue(c.venue).name)}</span>` : ''}</div>
      <div class="bd-cl-bar"><i style="width:${p.n?p.d/p.n*100:0}%"></i></div>
      <span class="bd-cl-s num">${p.complete ? `Done ${fTime(r.signed.t)}` : p.late ? `Overdue · ${p.d}/${p.n}` : `${p.d}/${p.n} · due ${fTime(p.due)}`}</span>
      ${p.outOfRange.length ? `<span class="bd-cl-temp">${ic('alert')} ${p.outOfRange.map(i => `${esc(i.text)} ${r.done[i.id].val}°F`).join(', ')}</span>` : ''}</div>`).join('')}</div>`;
}
const kpi = (v, k, cls='') => `<div class="bd-kpi ${cls}"><b class="num">${v}</b><span>${k}</span></div>`;
const showVenue = () => !B.venue || B.venue === 'all';

function alertCard({p, e, bs}){
  const a = bs.alert;
  return `<div class="bd-alert ${a.status}">
    <div class="bd-alert-name">${esc(e.name)}</div>
    <div class="bd-alert-what">${esc(a.label)}${a.kind==='meal' ? '' : ''}</div>
    <div class="bd-alert-when">${a.status==='overdue' ? `Overdue ${fHM(a.lateBy)}` : `Due now · since ${fTime(a.dueT)}`}${showVenue() ? ` · ${esc(venue(p.venue).name)}` : ''}</div>
  </div>`;
}
function liveRow({p, e, bs}){
  const open = bs.open;
  const brMin = open ? (open.min ?? (open.type==='meal' ? ST().mealMin : ST().restMin)) : 0;
  const backT = open ? open.start + brMin*MIN : 0;
  let chip;
  if (bs.alert) chip = `<span class="bd-chip bad">${esc(bs.alert.label)} ${bs.alert.status==='overdue' ? 'overdue' : 'due'}</span>`;
  else if (open) chip = now() > backT ? `<span class="bd-chip warn">Break over · <span class="num" data-since="${backT}">${mmss(now()-backT)}</span></span>` : `<span class="bd-chip brk">On ${open.type==='meal'?'lunch':brMin+'-min break'} · <span class="num" data-until="${backT}">${mmss(backT-now())}</span> left</span>`;
  else chip = `<span class="bd-chip ok">Working</span>`;
  const nx = !open && !bs.alert ? bs.next : null;
  const extra = shiftFlags(p).map(f => `<span class="bd-chip ${f.cls} sm">${f.t}</span>`).join('');
  return `<div class="bd-row ${bs.alert ? 'alert' : ''} ${open ? 'brk' : ''}">
    <div class="avatar" style="border-color:${e.color}">${e.initials}</div>
    <div class="bd-row-main">
      <div class="bd-name">${esc(e.name)}</div>
      <div class="bd-meta">${esc(p.role)}${showVenue() ? ` · ${esc(venue(p.venue).name)}` : ''} · in at ${fTime(p.inT)}${nx ? ` · <span class="${nx.status==='soon'?'soon':''}">next: ${esc(nx.label.toLowerCase())} ${fTime(nx.dueT)}</span>` : ''}</div>
    </div>
    <div class="bd-row-side"><div class="bd-worked num" data-id="${p.id}">${fHM(workedMs(p))}</div>${chip}${extra}</div>
  </div>`;
}
function schedRow({s, e, k, label}){
  return `<div class="bd-row sched ${k}">
    <div class="avatar" style="border-color:${e.color}">${e.initials}</div>
    <div class="bd-row-main">
      <div class="bd-name">${esc(e.name)}</div>
      <div class="bd-meta">${fTime(s.startT)} – ${fTime(s.endT)} · ${esc(s.role)}${showVenue() ? ` · ${esc(venue(s.venue).name)}` : ''}</div>
    </div>
    <div class="bd-row-side"><span class="bd-chip ${{on:'ok', done:'', noshow:'warn', late:'warn', soon:'info', later:''}[k]}">${label}</span></div>
  </div>`;
}

function renderSetup(){
  const vs = D().venues.filter(v => v.active !== false);
  const base = location.href.replace(/[?#].*$/,'');
  return `<div class="bd-setup">
    <div class="brand-word" style="font-size:40px">CJ<span>&rsquo;</span>s Crew Board</div>
    <p class="muted" style="margin-top:6px;max-width:520px">Mount a tablet where the crew can see it. It shows who&rsquo;s working, who&rsquo;s due today, and puts a name in red when that person needs a 10-minute, 15-minute or lunch break.</p>
    <div class="label" style="margin:26px 0 10px">Which venue is this tablet at?</div>
    <div class="bd-venues">
      <button class="bd-vopt ${(!B.venue||B.venue==='all')?'on':''}" data-act="pick-venue" data-v="all">${ic('users')}<span><b>All venues</b><small>Good for the office or manager&rsquo;s tablet</small></span></button>
      ${vs.map(v => `<button class="bd-vopt ${B.venue===v.id?'on':''}" data-act="pick-venue" data-v="${v.id}">${ic(CC.VTYPE[v.type].icon)}<span><b>${esc(v.name)}</b><small>${esc(v.addr)}</small></span></button>`).join('')}
    </div>
    <label class="check" style="max-width:520px;margin-top:18px"><input type="checkbox" id="bdSound" ${B.sound?'checked':''}><span><b>Chime when someone needs a break</b><br><span class="faint small">Plays a short tone each time a new name turns red.</span></span></label>
    <button class="btn primary" style="margin-top:20px;max-width:520px" data-act="start">${ic('tablet')} Start crew board</button>
    <p class="small faint" style="margin-top:14px;max-width:520px">Tip: bookmark <span class="mono">${esc(base)}?venue=${esc(B.venue && B.venue!=='all' ? B.venue : 'pico')}</span> to open straight to a venue. On iPad, use Guided Access to keep the board on screen.</p>
  </div>`;
}

function pinModal(){
  modalRoot.innerHTML = `<div class="scrim m-scrim2" data-act="scrim"><div class="modal bd-pin" role="dialog" aria-modal="true">
    <h3>Manager PIN</h3><p class="muted small">Enter the manager PIN to change this board.</p>
    <div class="pin-dots ${B.pinErr?'shake':''}">${[0,1,2,3].map(i=>`<i class="${i<B.pin.length?'f':''}"></i>`).join('')}</div>
    <div class="keypad">${[1,2,3,4,5,6,7,8,9].map(n=>`<button class="key" data-act="key" data-v="${n}">${n}</button>`).join('')}
      <button class="key fn" data-act="close">Cancel</button><button class="key" data-act="key" data-v="0">0</button><button class="key fn" data-act="key" data-v="del">Delete</button></div>
  </div></div>`;
}

/* ---------- Tablet punch (kiosk) ---------- */
const K = { step:null, pin:'', err:false, emp:null, msg:null, idle:null, fails:0, lockUntil:0 };
function kOpen(){ K.step='pin'; K.pin=''; K.err=false; K.emp=null; K.msg=null; kRender(); }
function kClose(){ K.step=null; clearTimeout(K.idle); modalRoot.innerHTML=''; render(); }
function kIdle(ms=30000){ clearTimeout(K.idle); K.idle = setTimeout(kClose, ms); }
const kLive = id => D().punches.find(p => p.emp===id && !p.outT && !p.voided);
const kShift = id => { const d0 = startOfDay(now()); return D().shifts.filter(s=>s.emp===id && s.startT>=d0 && s.startT<d0+DAY).sort((a,b)=>Math.abs(a.startT-now())-Math.abs(b.startT-now()))[0] || null; };
function kVenue(e){
  if (B.venue && B.venue !== 'all') return B.venue;
  const sh = kShift(e.id); return sh ? sh.venue : e.home;
}
function kRender(){
  kIdle(K.step==='done' ? 6000 : 30000);
  let body = '';
  if (K.step==='pin'){
    body = `<h3>Punch on this tablet</h3><p class="muted small">Enter your 4-digit PIN.</p>
      <div class="pin-dots ${K.err?'shake':''}">${[0,1,2,3].map(i=>`<i class="${i<K.pin.length?'f':''}"></i>`).join('')}</div>
      ${K.err ? '<p class="small" style="color:var(--bad);text-align:center;margin:-8px 0 10px">PIN not recognized. Try again.</p>' : ''}
      <div class="keypad">${[1,2,3,4,5,6,7,8,9].map(n=>`<button class="key" data-act="kkey" data-v="${n}">${n}</button>`).join('')}
        <button class="key fn" data-act="kclose">Cancel</button><button class="key" data-act="kkey" data-v="0">0</button><button class="key fn" data-act="kkey" data-v="del">Delete</button></div>`;
  } else if (K.step==='menu'){
    const e = K.emp, p = kLive(e.id), v = venue(p ? p.venue : kVenue(e));
    const head = `<div class="k-who"><div class="avatar" style="border-color:${e.color}">${e.initials}</div><div><div class="title" style="font-size:20px">${esc(e.name)}</div><div class="small muted">${p ? `On the clock at ${esc(v.name)} since ${fTime(p.inT)} · ${fHM(workedMs(p))}` : `Not clocked in · ${esc(v.name)}`}</div></div></div>`;
    let btns;
    if (!p){
      const sh = kShift(e.id);
      btns = `${sh ? `<p class="small muted">Today: ${fTime(sh.startT)}–${fTime(sh.endT)} · ${esc(sh.role)} · ${esc(venue(sh.venue).name)}</p>` : '<p class="small muted">You&rsquo;re not on the schedule today.</p>'}
        <button class="btn primary" data-act="kin">${ic('clock')} Clock in at ${esc(v.name)}</button>`;
    } else {
      const bs = CC.breakStatus(p), open = bs.open;
      if (open){
        const min = open.min ?? (open.type==='meal' ? ST().mealMin : ST().restMin);
        btns = `<p class="small muted">On ${open.type==='meal'?'lunch':min+'-min break'} since ${fTime(open.start)}, back by ${fTime(open.start+min*MIN)}.</p>
          <button class="btn primary" data-act="kend">${ic('check')} End my break</button>`;
      } else {
        const nr = CC.nextBreakFor(p,'rest'), nm = CC.nextBreakFor(p,'meal');
        btns = `${bs.alert ? `<div class="alert bad" style="margin-bottom:10px">${esc(bs.alert.label)} is due now.</div>` : ''}
          <button class="btn ${bs.alert && bs.alert.kind!=='meal'?'primary':''}" data-act="kbrk" data-v="rest">${ic('coffee')} Start ${esc((nr?.label || 'rest break').toLowerCase())}</button>
          ${nm || !p.breaks.some(b=>b.type==='meal') ? `<button class="btn ${bs.alert && bs.alert.kind==='meal'?'primary':''}" data-act="kbrk" data-v="meal">${ic('meal')} Start ${esc((nm?.label || 'meal break').toLowerCase())}</button>` : ''}
          <button class="btn" data-act="kout1">${ic('out')} Clock out</button>`;
      }
    }
    body = `${head}<div class="stack" style="margin-top:14px">${btns}<button class="btn ghost" data-act="kclose">Not me / cancel</button></div>`;
  } else if (K.step==='out'){
    const e = K.emp, p = kLive(e.id);
    body = `<h3>Clock out</h3><p class="muted small">${esc(e.name)} · ${fHM(workedMs(p))} worked today.</p>
      <label class="field" style="margin-top:12px"><span>Cash tips received</span><input class="input num" id="kTips" inputmode="decimal" placeholder="0.00"></label>
      <div class="label" style="margin-top:14px">Did you get all your breaks today?</div>
      <div class="stack" style="margin-top:8px">
        <button class="btn primary" data-act="kout" data-v="ok">${ic('check')} Yes, clock me out</button>
        <button class="btn" data-act="kout" data-v="missed">No, I missed a break</button>
        <button class="btn ghost" data-act="kclose">Cancel</button></div>`;
  } else if (K.step==='done'){
    body = `<div style="text-align:center"><div class="tap-ic k-ok">${ic(K.msg.icon||'check')}</div><h3 style="margin-top:12px">${K.msg.title}</h3><p class="muted">${K.msg.sub}</p>
      <button class="btn primary" style="margin-top:16px" data-act="kclose">Done</button></div>`;
  }
  modalRoot.innerHTML = `<div class="scrim m-scrim2" data-act="kscrim"><div class="modal k-modal" role="dialog" aria-modal="true">${body}</div></div>`;
}
function kDone(icon, title, sub){ K.step='done'; K.msg={icon, title, sub}; CC.save(); kRender(); }
function kIn(){
  const e = K.emp, st = ST(), sh = kShift(e.id), vid = kVenue(e), v = venue(vid);
  if (!CC.venueActive(v)){ kDone('alert', `${esc(v.name)} is closed`, 'This venue isn&rsquo;t accepting punches right now.'); return; }
  if (st.blockEarly && sh && now() < sh.startT - st.earlyMin*MIN){ kDone('alert','Too early to clock in', `Your shift starts ${fTime(sh.startT)}. Try again after ${fTime(sh.startT - st.earlyMin*MIN)}.`); return; }
  if (!st.allowUnscheduled && !sh){ kDone('alert','No shift today','You&rsquo;re not on the schedule today. Ask your manager.'); return; }
  const r = (sh && e.roles.find(x=>x.role===sh.role)) || e.roles[0];
  const flags = ['Tablet punch'];
  if (sh && now() < sh.startT - st.earlyMin*MIN) flags.push('Early punch');
  if (!sh) flags.push('Unscheduled');
  if (sh && vid !== sh.venue) flags.push('Venue change');
  const p = {id:CC.id(`P-${e.id.slice(2)}`), emp:e.id, venue:vid, role:r.role, rate:r.rate, inT:now(), breaks:[], flags,
    inLoc:{lat:v.lat, lng:v.lng, acc:0, method:'Tablet board'}, selfie:'none', tipsCard:0};
  D().punches.push(p); CC.log(e.name, `Clocked in on the tablet board at ${v.name}`);
  kDone('check', `Clocked in at ${fTime(p.inT)}`, `${esc(v.name)} · ${esc(r.role)}. Have a good shift, ${esc(e.name.split(' ')[0])}.`);
}

/* ---------- Chime + wake lock ---------- */
let audioCtx = null;
function chime(alerts){
  const ids = new Set(alerts.map(a => a.p.id + ':' + a.bs.alert.label));
  const fresh = [...ids].some(id => !B.alertIds.has(id));
  B.alertIds = ids;
  if (!fresh || !B.sound || !audioCtx) return;
  try {
    [0, .22].forEach((off, i) => { const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.frequency.value = i ? 660 : 880; o.type = 'sine';
      g.gain.setValueAtTime(0.0001, audioCtx.currentTime + off); g.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + off + .02); g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + off + .2);
      o.connect(g).connect(audioCtx.destination); o.start(audioCtx.currentTime + off); o.stop(audioCtx.currentTime + off + .22); });
  } catch(e){}
}
async function keepAwake(){ try { if ('wakeLock' in navigator) B.wake = await navigator.wakeLock.request('screen'); } catch(e){} }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && B.started) keepAwake(); });

/* ---------- Events ---------- */
document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act, v = el.dataset.v;
  switch (act){
    case 'scrim': if (ev.target === el){ modalRoot.innerHTML = ''; } return;
    case 'close': modalRoot.innerHTML = ''; return;
    case 'pick-venue': B.venue = v; render(); return;
    case 'start':
      B.sound = document.getElementById('bdSound').checked;
      if (B.sound){ try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){} }
      B.started = true; B.alertIds = new Set(liveRows().filter(r=>r.bs.alert).map(r=>r.p.id + ':' + r.bs.alert.label));
      keepAwake(); render(); return;
    case 'kiosk': if (Date.now() < K.lockUntil){ toast('Too many wrong PINs. Try again in a minute.'); return; } kOpen(); return;
    case 'kscrim': if (ev.target === el) kClose(); return;
    case 'kclose': kClose(); return;
    case 'kkey':
      if (v==='del') K.pin = K.pin.slice(0,-1); else if (K.pin.length < 4) K.pin += v;
      K.err = false;
      if (K.pin.length === 4){ const e = D().employees.find(x => x.pin === K.pin && x.active !== false);
        if (e){ K.emp = e; K.step = 'menu'; K.fails = 0; } else { K.err = true; K.pin = ''; if (++K.fails >= 5){ K.fails = 0; K.lockUntil = Date.now() + 60000; kClose(); toast('Too many wrong PINs. Try again in a minute.'); return; } } }
      kRender(); return;
    case 'kin': kIn(); return;
    case 'kend': { const p = kLive(K.emp.id), o = p.breaks.find(b=>!b.end); o.end = now(); CC.log(K.emp.name, 'Ended break on the tablet board');
      kDone('check', 'Break ended', `Welcome back, ${esc(K.emp.name.split(' ')[0])}. Your timer is running again.`); return; }
    case 'kbrk': { const p = kLive(K.emp.id), nx = CC.nextBreakFor(p, v), min = nx?.min ?? (v==='meal' ? ST().mealMin : ST().restMin);
      p.breaks.push({type:v, start:now(), min}); CC.log(K.emp.name, `Started ${v==='meal'?'lunch':min+'-min break'} on the tablet board`);
      kDone(v==='meal'?'meal':'coffee', v==='meal' ? 'Lunch started' : `${min}-minute break started`, `Back by <b>${fTime(now()+min*MIN)}</b>. Punch here again when you&rsquo;re back.`); return; }
    case 'kout1': K.step = 'out'; kRender(); return;
    case 'kout': { const p = kLive(K.emp.id), tips = parseFloat((document.getElementById('kTips')||{}).value) || 0;
      Object.assign(p, {outT:now(), tipsCash:tips, attest:v, missed: v==='missed' ? ['Break missed (employee attested)'] : [], outLoc:{lat:0,lng:0,acc:0,method:'Tablet board'}});
      CC.log(K.emp.name, `Clocked out on the tablet board${v==='missed'?' (attested a missed break)':''}`);
      kDone('out', `Clocked out at ${fTime(p.outT)}`, `${fHM(workedMs(p))} worked today. Thanks, ${esc(K.emp.name.split(' ')[0])}.`); return; }
    case 'settings': B.pin=''; B.pinErr=false; pinModal(); return;
    case 'key':
      if (v==='del') B.pin = B.pin.slice(0,-1); else if (B.pin.length < 4) B.pin += v;
      B.pinErr = false;
      if (B.pin.length === 4){ if (B.pin === ST().managerPin){ modalRoot.innerHTML=''; B.started = false; render(); return; } B.pinErr = true; B.pin = ''; }
      pinModal(); return;
  }
});

CC.subscribe(() => { if (!modalRoot.innerHTML || !B.started) render(); });
document.addEventListener('input', () => { if (K.step) kIdle(); });
setInterval(() => {
  const t = document.getElementById('bdTime'); if (t) t.textContent = fTime(now());
  document.querySelectorAll('[data-until]').forEach(el => { const left = +el.dataset.until - now(); if (left <= 0 && !modalRoot.innerHTML) { render(); return; } el.textContent = mmss(left); });
  document.querySelectorAll('[data-since]').forEach(el => { el.textContent = mmss(now() - +el.dataset.since); });
}, 1000);
setInterval(() => { if (B.started && CC.runReminders()) CC.save(); if (B.started && !modalRoot.innerHTML) render(); }, 10000);
CC.ready.then(() => { if (B.started) keepAwake(); render(); });
})();
