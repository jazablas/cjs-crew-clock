/* CJ's Crew - Clock — employee time clock prototype.
   Data lives in the shared store (store.js), kept on the sync server and shared with the manager console. */
(() => {
'use strict';
const {ic, VTYPE, LOCS, MIN, HR, DAY, now, startOfDay, at, fTime, fDate, fDay, fDur, fHM, fHrs, money, esc,
  dist, bearing, fDist, venueActive, workedMs} = CC;
const D = () => CC.db;
const ST = () => CC.db.settings;
const commit = () => CC.save();
const periodStart = () => CC.periodStart();
const EMPS = () => D().employees.filter(e => e.active !== false);
const VENUES_ALL = () => D().venues;

/* ---------- State (UI only; records live in the store) ---------- */
const S = {
  user:null, auth:'pick', pickId:null, pin:'', pinErr:false, selfie:null,
  tab:'clock', loc:'dhsp_gate', realPos:null,
  role:null, leftWarned:false, receipt:null,
  demoOpen:false,
  tapPending:null, tapResult:null, tapRemember:true, nfcScan:null,
  get shift(){ return this.user ? CC.liveFor(this.user) || null : null; },
  get history(){ return this.user ? D().punches.filter(p => p.emp === this.user && p.outT && !p.voided) : []; },
  get requests(){ return this.user ? D().requests.filter(r => r.emp === this.user) : []; },
};
function position(){
  if (S.loc === 'real') return S.realPos;
  return LOCS.find(l => l.id === S.loc);
}
function geofence(){
  const p = position();
  if (!p) return {status:'nopos'};
  const list = VENUES_ALL().filter(venueActive).map(v => ({v, d:dist(p,v)})).sort((a,b)=>a.d-b.d);
  const near = list[0];
  if (!near) return {status:'none', pos:p};
  const inside = near.d <= near.v.r;
  const weak = p.acc > near.v.r;
  return {status: inside ? (weak ? 'weak' : 'in') : (weak && near.d - p.acc <= near.v.r ? 'weak' : 'out'), venue:near.v, d:near.d, pos:p, edge:Math.max(0, near.d - near.v.r)};
}

/* ---------- Schedule ---------- */
function scheduleFor(emp){
  const today = startOfDay(now());
  return D().shifts.filter(s => s.emp === emp.id && s.startT >= today && s.startT < today + 7*DAY)
    .sort((a,b)=>a.startT-b.startT).map(s => ({...s, day:startOfDay(s.startT)}));
}
function openShifts(){
  const today = startOfDay(now());
  return D().openShifts.filter(o => o.startT >= today && (o.spots ?? 1) > 0).sort((a,b)=>a.startT-b.startT);
}
function periodSummary(){ return CC.summary(S.user); }

/* ---------- Extension hooks (filled in by app-x.js) ---------- */
const XA = window.XA = {acts:{}, tabs:{}, clockTop:null, onClock:null, schedTop:null, shiftActions:null, openAction:null, meExtra:null, tabBadge:null, inReason:null, outReason:null, afterIn:null, afterOut:null, receiptExtra:null};
/* ---------- Rendering ---------- */
const app = document.getElementById('app');
const demo = document.getElementById('demoPanel');
const sheetRoot = document.getElementById('sheetRoot');
const emp = () => CC.empById(S.user);
const venueById = id => CC.venueById(id);

function render(){
  renderDemo();
  if (S.user && (!emp() || emp().active === false)) { S.user = null; S.auth = 'pick'; }
  if (!S.user) { app.innerHTML = renderAuth(); return; }
  if (S.tapResult) { app.innerHTML = renderTapResult(); return; }
  const body = ({clock:renderClock, sheet:renderTimesheet, sched:renderSchedule, me:renderMe, guide:renderGuide, ...XA.tabs}[S.tab] || renderClock)();
  const off = CC.hasServer && !CC.isOnline() ? `<div class="offline-bar" role="status">${ic('alert')} Offline. Punches are saved on this phone and sync when you&rsquo;re back online.</div>` : '';
  app.innerHTML = `
    <header class="topbar">
      <div class="brand"><div>
        <div class="brand-word">CJ<span>&rsquo;</span>s Crew - Clock</div>
        <div class="brand-sub">The Broaster Kings · Staff</div>
      </div></div>
      <div class="row">
        <button class="icon-btn demo-fab" data-act="demo-toggle" aria-label="Prototype controls">${ic('sliders')}</button>
        <div class="avatar" style="width:38px;height:38px;font-size:13px;border-color:${emp().color}">${emp().initials}</div>
      </div>
    </header>
    ${off}<div class="scroll" id="scroll">${body}</div>
    <nav class="tabbar" aria-label="Sections">
      ${[['clock','clock','Clock'],['sheet','sheet','Timesheet'],['sched','cal','Schedule'],...(XA.tabs.team ? [['team','chat','Team']] : [['guide','info','Guide']]),['me','user','Me']].map(([k,i,l]) => { const n = XA.tabBadge ? XA.tabBadge(k) : 0;
        return `<button class="tab ${S.tab===k?'on':''}" data-act="tab" data-v="${k}" aria-current="${S.tab===k}">${ic(i)}${l}${n ? `<b class="tab-n">${n}</b>` : ''}</button>`; }).join('')}
    </nav>`;
}

/* Auth */
function renderAuth(){
  if (S.auth === 'guide') return `
    <div class="signin" style="padding-top:18px">
      <button class="link" data-act="back-pick" style="align-self:flex-start;margin-bottom:10px">← Back to sign in</button>
      ${renderGuide(true)}
    </div>`;
  if (S.auth === 'pick') return `
    <div class="signin">
      <div class="row between"><span class="proto-tag">Prototype · sample data</span>
        <button class="icon-btn demo-fab" data-act="demo-toggle" aria-label="Prototype controls">${ic('sliders')}</button></div>
      ${S.tapPending ? tapBanner() : `<div style="margin:34px 0 8px" class="hero-word">Boss<br>Crew<br><span>Clock</span></div>`}
      <p class="muted" style="margin-bottom:24px">Punch in and out at any CJ&rsquo;s Wings venue: the Pico kitchen, stadium stands, pop-ups or the truck.</p>
      <button class="guide-cta" data-act="open-guide">${ic('info')}<span><b>New here? How this prototype works</b><small>Features, demo controls and a 5-minute walkthrough</small></span>${ic('chev')}</button>
      <div class="label" style="margin-bottom:10px">${S.tapPending ? 'Who&rsquo;s tapping? (one time on this phone)' : 'Who&rsquo;s clocking in?'}</div>
      ${EMPS().map(e => `
        <button class="emp" data-act="pick" data-v="${e.id}">
          <div class="avatar" style="border-color:${e.color}">${e.initials}</div>
          <div class="grow"><div class="title">${e.name}</div><div class="small muted">${e.roles.map(r=>r.role).join(' · ')} · ${e.id}</div></div>
          ${ic('chev','faint" style="width:18px;height:18px')}
        </button>`).join('')}
      <a class="mgr-cta" href="manager.html">${ic('shield')}<span><b>Manager? Open the manager console</b><small>Live board, approvals, timesheets, schedule, crew, venues, payroll</small></span>${ic('chev')}</a>
      <p class="small faint" style="margin-top:auto;padding-top:22px">In production, each phone is registered to one employee. The picker is here for the demo only.</p>
    </div>`;
  const e = CC.empById(S.pickId);
  if (S.auth === 'pin') return `
    <div class="signin" style="align-items:center;text-align:center">
      <button class="link" data-act="back-pick" style="align-self:flex-start">← Not you?</button>
      <div class="avatar lg" style="margin-top:20px;border-color:${e.color}">${e.initials}</div>
      <div class="title" style="margin-top:12px;font-size:20px">${e.name}</div>
      <div class="muted small">Enter your 4-digit clock PIN</div>
      ${S.tapPending && ST().nfcPairing ? `<label class="check" style="margin-top:12px;text-align:left;max-width:300px"><input type="checkbox" data-act="tap-remember" ${S.tapRemember?'checked':''}><span><b>Remember this phone</b><br><span class="faint small">Next time, just tap the sticker. No PIN needed.</span></span></label>` : ''}
      <div class="pin-dots ${S.pinErr?'shake':''}" aria-label="${S.pin.length} of 4 digits entered">${[0,1,2,3].map(i=>`<i class="${i<S.pin.length?'f':''}"></i>`).join('')}</div>
      ${S.pinErr ? `<div class="small" style="color:var(--bad);margin:-8px 0 12px">That PIN didn&rsquo;t match. Try again.</div>` : ''}
      <div class="keypad">
        ${[1,2,3,4,5,6,7,8,9].map(n=>`<button class="key" data-act="key" data-v="${n}">${n}</button>`).join('')}
        <button class="key fn" data-act="key" data-v="clr">Clear</button>
        <button class="key" data-act="key" data-v="0">0</button>
        <button class="key fn" data-act="key" data-v="del">Delete</button>
      </div>
      <p class="small faint" style="margin-top:18px">Demo PIN for ${e.name.split(' ')[0]}: <b class="num" style="color:var(--muted)">${e.pin}</b></p>
    </div>`;
  if (S.auth === 'selfie') return `
    <div class="signin" style="align-items:center;text-align:center">
      <div class="label">Step 2 of 2 · Photo check</div>
      <div class="title" style="font-size:20px;margin-top:6px">Quick selfie to confirm it&rsquo;s you</div>
      <p class="muted small" style="max-width:290px;margin-top:6px">Stops buddy punching. The photo is attached to your punch so your manager can verify it.</p>
      <div class="selfie ${S.selfie?'ok':''}" id="selfieBox">
        ${S.selfie === 'live' ? '<video id="selfieVid" autoplay playsinline muted></video>' :
          S.selfie ? `<div style="text-align:center">${ic('check','" style="width:54px;height:54px;color:var(--ok)')}<div class="small muted" style="margin-top:6px">${S.selfie==='sim'?'Simulated photo':'Photo captured'}</div></div>` :
          `<div style="text-align:center;color:var(--faint)">${ic('cam','" style="width:44px;height:44px')}<div class="small" style="margin-top:6px">Camera preview</div></div>`}
      </div>
      <div style="width:100%;max-width:320px" class="stack">
        ${S.selfie && S.selfie!=='live' ? `<button class="btn primary" data-act="auth-done">Continue</button>` :
          S.selfie === 'live' ? `<button class="btn primary" data-act="snap">${ic('cam')} Take photo</button>` :
          `<button class="btn primary" data-act="cam">${ic('cam')} Open camera</button>
           <button class="btn ghost" data-act="sim-selfie">Simulate photo (demo)</button>`}
      </div>
    </div>`;
}

/* Geofence card */
function geoCard(g, compact=false){
  if (g.status === 'nopos') return `<div class="card"><div class="alert info">${ic('pin')}<div><b>Waiting for location…</b><br>Allow location access so we can confirm you&rsquo;re at a venue.</div></div></div>`;
  const v = g.venue, t = VTYPE[v.type];
  const R = 46; // px radius of the ring
  const scale = Math.min(g.d / v.r, 3.4);
  const ang = bearing(v, g.pos);
  const px = Math.max(-170, Math.min(170, Math.sin(ang) * scale * R));
  const py = Math.max(-58, Math.min(44, -Math.cos(ang) * scale * R));
  const badge = g.status==='in' ? `<span class="badge ok">${ic('check','" style="width:12px;height:12px')} Inside geofence</span>`
    : g.status==='weak' ? `<span class="badge warn">Weak GPS</span>` : `<span class="badge bad">Outside · ${fDist(g.edge)}</span>`;
  return `
    <div class="card geo">
      ${compact ? '' : `<div class="geo-map" aria-hidden="true">
        <div class="geo-ring"></div><div class="geo-venue"></div>
        <div class="geo-pin" style="left:calc(50% + ${px.toFixed(0)}px);top:calc(55% + ${py.toFixed(0)}px)"></div>
        <div class="geo-caption">${v.type==='truck'?'TRUCK GPS':'VENUE'} · ${v.r} m fence</div>
        <div class="geo-acc num">You · ±${Math.round(g.pos.acc)} m</div>
      </div>`}
      <div class="row">
        <div class="vt">${ic(t.icon)}</div>
        <div class="grow">
          <div class="title ellipsis">${esc(v.name)}</div>
          <div class="small muted ellipsis">${t.label} · ${fDist(g.d)} from center</div>
          <div style="margin-top:6px">${badge}</div>
        </div>
      </div>
      ${g.status==='weak' ? `<div class="alert warn" style="margin-top:12px">${ic('alert')}<div><b>GPS accuracy is ±${Math.round(g.pos.acc)} m.</b> Step outside or near a window. You can still punch, but it will be flagged for review.</div></div>`:''}
      ${g.status==='out' && !compact ? `<div class="alert bad" style="margin-top:12px">${ic('pin')}<div><b>You&rsquo;re not at a venue yet.</b> Clock in unlocks when you&rsquo;re within ${v.r} m of ${esc(v.name)}.</div></div>`:''}
    </div>`;
}

function todaysShift(){
  const e = emp(); const t0 = startOfDay(now());
  return scheduleFor(e).find(s => s.day === t0);
}

/* Clock tab */
function renderClock(){
  const e = emp(), g = geofence();
  if (S.shift) return renderOnClock(e, g);
  const sh = todaysShift();
  if (!S.role) S.role = (sh && e.roles.find(r=>r.role===sh.role)) ? sh.role : e.roles[0].role;
  const st = ST();
  const tooEarly = st.blockEarly && sh && now() < sh.startT - st.earlyMin*MIN;
  const blockUnsched = !st.allowUnscheduled && !sh;
  const blockWeak = !st.allowWeakGps && g.status==='weak';
  const canPunch = (g.status==='in' || g.status==='weak') && !tooEarly && !blockUnsched && !blockWeak;
  const lockMsg = tooEarly ? `Opens ${fTime(sh.startT - st.earlyMin*MIN)}` : blockUnsched ? 'No shift today' : blockWeak ? 'GPS too weak' : 'Not at a venue';
  const shVenue = sh && venueById(sh.venue);
  const wrongVenue = sh && (g.status==='in'||g.status==='weak') && g.venue.id !== sh.venue;
  let timing = '';
  if (sh){
    const diff = now() - sh.startT;
    if (diff < -st.earlyMin*MIN) timing = `<span class="badge info">Starts ${fTime(sh.startT)}</span>`;
    else if (diff <= st.lateGrace*MIN) timing = `<span class="badge ok">On time</span>`;
    else if (now() < sh.endT) timing = `<span class="badge warn">Late ${fHM(diff)}</span>`;
    else timing = `<span class="badge">Shift ended</span>`;
  }
  return `
    <div style="padding:6px 2px 14px">
      <div class="small muted">${fDay(now())}</div>
      <div class="row between" style="margin-top:2px"><div class="title" style="font-size:20px">Hey ${e.name.split(' ')[0]}</div><div class="clock-now num" data-t="now">${fTime(now())}</div></div>
    </div>
    ${announcementCards()}
    ${XA.clockTop ? XA.clockTop(sh) : ''}
    ${geoCard(g)}
    ${sh ? `
    <div class="card">
      <div class="row between"><div class="label">Today&rsquo;s shift</div>${timing}</div>
      <div class="row" style="margin-top:8px">
        <div class="vt">${ic(VTYPE[shVenue.type].icon)}</div>
        <div class="grow"><div class="title ellipsis">${esc(shVenue.name)}</div>
        <div class="small muted">${fTime(sh.startT)} – ${fTime(sh.endT)} · ${sh.role} · ${esc(sh.station)}</div></div>
      </div>
      ${wrongVenue ? `<div class="alert warn" style="margin-top:12px">${ic('alert')}<div>You&rsquo;re scheduled at <b>${esc(shVenue.name)}</b> today, but you&rsquo;re at ${esc(g.venue.name)}. You can still clock in here; your manager will see the venue change.</div></div>` : ''}
    </div>` : `<div class="card"><div class="label">Today&rsquo;s shift</div><div class="small muted" style="margin-top:6px">${st.allowUnscheduled ? 'No shift scheduled today. Unscheduled punches go to your manager for approval.' : 'No shift scheduled today. Your manager has turned off unscheduled punches.'}</div></div>`}

    <div class="card">
      <div class="label" style="margin-bottom:10px">Clocking in as</div>
      <div class="seg" role="radiogroup">${e.roles.map(r => `<button role="radio" aria-checked="${S.role===r.role}" class="${S.role===r.role?'on':''}" data-act="role" data-v="${r.role}">${r.role} <span class="faint num">${money(r.rate)}</span></button>`).join('')}</div>
    </div>

    <div class="punch-wrap">
      <button class="punch" data-act="punch-in" ${canPunch?'':'disabled'} aria-label="Clock in">
        <span class="p1">Clock<br>in</span>
        <span class="p2">${canPunch ? esc(g.venue.name.split(' ·')[0]) : lockMsg}</span>
      </button>
      ${canPunch ? `<p class="small faint" style="margin-top:14px;text-align:center">Location is checked when you punch and while you&rsquo;re on the clock.</p>`
        : st.allowExceptions ? `<button class="link" style="margin-top:16px" data-act="exception">At work but can&rsquo;t clock in? Request an exception</button>` : `<p class="small faint" style="margin-top:14px;text-align:center">Exceptions are turned off. Ask your manager to clock you in.</p>`}
      <div style="width:100%;max-width:320px">${nfcButton()}</div>
    </div>`;
}

const fHrsLabel = h => { const H = Math.floor(h), M = Math.round((h-H)*60); return M ? `${H}h ${M}m` : `${H} hrs`; };
function planBadge(i){
  return {done:`<span class="badge ok">Taken</span>`, taking:`<span class="badge warn">On it now</span>`,
    due:`<span class="badge bad">Due now</span>`, overdue:`<span class="badge bad">Overdue ${fHM(i.lateBy)}</span>`,
    soon:`<span class="badge warn">At ${fTime(i.dueT)}</span>`, later:`<span class="badge">At ${fTime(i.dueT)}</span>`}[i.status] || '';
}
function sheetNfcHelp(){
  openSheet(`<h3>Clock in with an NFC sticker</h3>
    <p class="muted small">Each CJ&rsquo;s venue has a small sticker by the time clock spot.</p>
    <ol class="small muted" style="margin:12px 0 0 18px;line-height:1.6">
      <li>Unlock your phone. You don&rsquo;t need to open this app.</li>
      <li>Hold the top back of your phone to the sticker for a second.</li>
      <li>Tap the notification that pops up. You&rsquo;re clocked in.</li>
    </ol>
    <p class="small faint" style="margin-top:12px">The first time, you&rsquo;ll pick your name and enter your PIN. After that this phone remembers you. Tap again to start a break or clock out. Works on iPhone XS and newer, and most Android phones with NFC turned on.</p>
    <button class="btn primary" style="margin-top:16px" data-act="close">Got it</button>`);
}

function breakState(sh){
  const open = sh.breaks.find(b => !b.end);
  const worked = workedMs(sh);
  const meals = sh.breaks.filter(b=>b.type==='meal');
  const rests = sh.breaks.filter(b=>b.type==='rest');
  const st = ST();
  const restsEarned = Math.floor((worked/HR + st.restPer/2) / st.restPer); // ~1 per 4 hrs, "major fraction"
  const mealDueT = sh.inT + st.mealByHour*HR;
  return {open, worked, meals, rests, restsEarned, mealDueT};
}

function renderOnClock(e, g){
  const sh = S.shift, v = venueById(sh.venue);
  const b = breakState(sh);
  const bs = CC.breakStatus(sh);
  const nRest = CC.nextBreakFor(sh,'rest'), nMeal = CC.nextBreakFor(sh,'meal');
  const brkMin = b.open ? (b.open.min ?? (b.open.type==='meal' ? ST().mealMin : ST().restMin)) : 0;
  const leftVenue = g.status==='out' || (g.status!=='nopos' && g.venue && g.venue.id !== sh.venue && g.status!=='weak');
  const otAt = sh.inT + ST().otDaily*HR + b.meals.reduce((a,m)=>a+((m.end??now())-m.start),0);
  const mealOk = b.meals.some(m => m.start <= b.mealDueT);
  const mealMsg = mealOk ? `<span class="badge ok">Meal taken</span>` :
    now() > b.mealDueT ? `<span class="badge bad">Meal overdue</span>` :
    b.mealDueT - now() < 45*MIN ? `<span class="badge warn">Due ${fTime(b.mealDueT)}</span>` : `<span class="badge">By ${fTime(b.mealDueT)}</span>`;
  const restMsg = b.rests.length >= b.restsEarned ? `<span class="badge ok">${b.rests.length} of ${b.restsEarned} taken</span>` : `<span class="badge warn">${b.rests.length} of ${b.restsEarned} taken</span>`;
  const earned = (b.worked/HR) * sh.rate;
  return `
    ${announcementCards()}
    ${sh.mgrNote ? `<div class="alert info" style="margin:4px 0 12px">${ic('shield')}<div><b>From your manager:</b> ${esc(sh.mgrNote)}</div></div>` : ''}
    ${bs.alert ? `<div class="alert bad brk-alert" style="margin:4px 0 12px">${ic('alert')}<div><b>Time for your ${esc(bs.alert.label.toLowerCase())}.</b> ${bs.alert.status==='overdue' ? `It&rsquo;s ${fHM(bs.alert.lateBy)} overdue.` : `It was due at ${fTime(bs.alert.dueT)}.`} Your name is showing in red on the crew board.
      <div style="margin-top:10px"><button class="btn sm primary" data-act="break-start" data-v="${bs.alert.kind==='meal'?'meal':'rest'}">Start ${esc(bs.alert.label.toLowerCase())}</button></div></div></div>`
      : bs.soon ? `<div class="alert warn" style="margin:4px 0 12px">${ic('clock')}<div><b>${esc(bs.soon.label)} coming up</b> at ${fTime(bs.soon.dueT)}.</div></div>` : ''}
    ${leftVenue ? `<div class="alert bad" style="margin:4px 0 12px">${ic('pin')}<div><b>You left ${esc(v.name)}.</b> ${g.status==='out' ? `You&rsquo;re ${fDist(g.d)} from the nearest venue.` : ''} Still working (like a supply run)? Tell your manager. Otherwise clock out now.
      <div style="margin-top:10px"><button class="btn sm primary" data-act="punch-out">Clock out</button></div></div></div>` : ''}
    <div class="card" style="text-align:center;padding:20px 14px 18px">
      <div class="row" style="justify-content:center;gap:8px"><span class="pulse" style="${b.open?'background:var(--warn)':''}"></span>
        <span class="label" style="color:var(--text)">${b.open ? (b.open.type==='meal'?'On lunch break':`On ${brkMin}-min break`) : 'On the clock'}</span></div>
      ${b.open ? `
        <div class="timer num" style="margin-top:10px;color:var(--mustard)" data-t="break">${fDur(now()-b.open.start)}</div>
        <div class="small muted" style="margin-top:6px">${b.open.type==='meal' ? `Unpaid · ${brkMin} min minimum · back by ${fTime(b.open.start+brkMin*MIN)}` : `Paid · ${brkMin} min · back by ${fTime(b.open.start+brkMin*MIN)}`}</div>
      ` : `
        <div class="timer num" style="margin-top:10px" data-t="worked">${fDur(b.worked)}</div>
        <div class="small muted" style="margin-top:6px">Since ${fTime(sh.inT)} · ${sh.role} · ${money(sh.rate)}/hr</div>
      `}
      <div class="row" style="justify-content:center;gap:6px;margin-top:12px">
        <span class="badge">${ic(VTYPE[v.type].icon,'" style="width:12px;height:12px')} ${esc(v.name)}</span>
        <span class="badge num" data-t="earned">≈ ${money(earned)}</span>
      </div>
    </div>

    ${b.open ? `
      <div style="margin-top:12px"><button class="btn primary" data-act="break-end">${ic('check')} End ${b.open.type} break</button></div>
    ` : `
      <div class="btn-grid" style="margin-top:12px">
        <button class="btn" data-act="break-start" data-v="meal">${ic('meal')} ${nMeal ? esc(nMeal.label) : 'Meal break'}</button>
        <button class="btn" data-act="break-start" data-v="rest">${ic('coffee')} ${nRest ? esc(nRest.label) : 'Rest break'}</button>
      </div>
      <button class="btn primary" style="margin-top:10px" data-act="punch-out">${ic('out')} Clock out</button>
      ${nfcButton()}
      ${XA.onClock ? XA.onClock(sh) : ''}
    `}

    <div class="section-h"><h2>Break check</h2><span class="small faint">CA-style rules</span></div>
    <div class="list">
      ${bs.items.filter(i=>i.status!=='skip').map(i => `<div class="li"><div class="vt" style="width:34px;height:34px">${ic(i.kind==='meal'?'meal':'coffee')}</div><div class="grow"><div class="title" style="font-size:14.5px">${esc(i.label)}</div><div class="meta">${i.min} min · due after ${fHrsLabel(i.at)} worked</div></div>${planBadge(i)}</div>`).join('')}
      <div class="li"><div class="vt" style="width:34px;height:34px">${ic('clock')}</div><div class="grow"><div class="title" style="font-size:14.5px">Overtime</div><div class="meta">After ${ST().otDaily} hrs today, ${ST().otMult}× pay</div></div>${now() >= otAt ? '<span class="badge warn">In overtime</span>' : `<span class="badge">At ${fTime(otAt)}</span>`}</div>
    </div>

    <div class="section-h"><h2>This shift</h2><span class="small faint mono">${sh.id}</span></div>
    <div class="list">
      ${punchLog(sh).map(p => `<div class="li"><div class="grow"><div class="title" style="font-size:14px">${p.label}</div><div class="meta">${p.meta}</div></div><div class="num small">${fTime(p.t)}</div></div>`).join('')}
    </div>`;
}

function punchLog(sh){
  const L = [{t:sh.inT, label:'Clocked in', meta:`${sh.inLoc.method} · ±${Math.round(sh.inLoc.acc)} m${sh.flags?.length ? ' · ' + sh.flags.join(', ') : ''}`}];
  sh.breaks.forEach(b => {
    L.push({t:b.start, label:`${b.type==='meal'?'Meal':'Rest'} break started`, meta:b.type==='meal'?'Unpaid':'Paid'});
    if (b.end) L.push({t:b.end, label:`${b.type==='meal'?'Meal':'Rest'} break ended`, meta:fHM(b.end-b.start)});
  });
  if (sh.outT) L.push({t:sh.outT, label:'Clocked out', meta:sh.outLoc ? `${sh.outLoc.method} · ±${Math.round(sh.outLoc.acc)} m` : ''});
  return L.sort((a,b)=>a.t-b.t);
}

/* Timesheet tab */
function renderTimesheet(){
  const s = periodSummary(), ps = periodStart();
  const e = emp();
  const pend = S.requests.filter(r=>r.status==='Pending').length;
  const appr = (D().approvals[ps]||{})[e.id];
  return `
    <div style="padding:6px 2px 12px">
      <div class="label">Pay period</div>
      <div class="title" style="font-size:20px">${fDate(ps).replace(/^\w+, /,'')} – ${fDate(ps+13*DAY).replace(/^\w+, /,'')}</div>
      <div class="small muted">Payday ${fDate(ps+(ST().periodDays+ST().paydayLag)*DAY)} · ${e.name}</div>
      ${appr ? `<div style="margin-top:6px"><span class="badge ok">${ic('check','" style="width:12px;height:12px')} Approved by manager ${fDate(appr.t)}</span></div>` : ''}
    </div>
    <div class="card">
      <div class="pay-total"><div><div class="label">Estimated gross</div><div class="v num">${money(s.gross)}</div></div>
        <div style="text-align:right"><div class="label">Tips</div><div class="title num">${money(s.tips)}</div></div></div>
      <div style="margin-top:12px">
        <div class="split"><span class="muted">Regular · ${fHrs(s.reg)} hrs</span><span class="num">${money(s.rows.reduce((a,r)=>a+r.r*r.es[0].rate,0))}</span></div>
        <div class="split"><span class="muted">Overtime 1.5× · ${fHrs(s.ot)} hrs</span><span class="num">${money(s.rows.reduce((a,r)=>a+r.o*r.es[0].rate*1.5,0))}</span></div>
        <div class="split"><span class="muted">Double time 2× · ${fHrs(s.dt)} hrs</span><span class="num">${money(s.rows.reduce((a,r)=>a+r.d*r.es[0].rate*2,0))}</span></div>
        <div class="split"><span class="muted">Break premiums</span><span class="num">${money(s.prem)}</span></div>
      </div>
    </div>
    <div class="kpis" style="margin-top:12px">
      <div class="kpi"><div class="v num">${fHrs(s.hours)}</div><div class="k">Hours</div></div>
      <div class="kpi"><div class="v num">${s.rows.length}</div><div class="k">Shifts</div></div>
      <div class="kpi"><div class="v num" style="${pend?'color:var(--warn)':''}">${pend}</div><div class="k">Pending</div></div>
    </div>
    <div class="section-h"><h2>Punches</h2><button class="link" data-act="missed">Missed a punch?</button></div>
    <div class="list">
      ${s.rows.slice().reverse().map(r => r.es.map(en => {
        const v = venueById(en.venue);
        const badges = [];
        if (en.live) badges.push('<span class="badge ok">Live</span>');
        if (r.o > 0 && !en.live) badges.push('<span class="badge warn">OT</span>');
        if (r.d > 0) badges.push('<span class="badge bad">2×</span>');
        if (en.editPending) badges.push('<span class="badge info">Edit pending</span>');
        if (en.exception==='pending') badges.push('<span class="badge warn">Needs OK</span>');
        if (en.flags?.length && !en.exception && !en.reviewed) badges.push('<span class="badge warn">Flagged</span>');
        if (en.attest==='missed') badges.push('<span class="badge bad">Missed break</span>');
        if (en.edited) badges.push('<span class="badge info">Edited by manager</span>');
        if (en.exception==='denied') badges.push('<span class="badge bad">Exception denied</span>');
        return `<button class="li" style="width:100%;text-align:left" data-act="entry" data-v="${en.id}">
          <div class="vt" style="width:36px;height:36px">${ic(VTYPE[v.type].icon)}</div>
          <div class="grow"><div class="title ellipsis" style="font-size:14.5px">${fDate(en.inT)} · ${esc(v.name)}</div>
            <div class="meta num">${fTime(en.inT)} – ${en.live?'now':fTime(en.outT)} · ${en.role}</div>
            ${badges.length?`<div class="row" style="gap:5px;margin-top:5px;flex-wrap:wrap">${badges.join('')}</div>`:''}</div>
          <div class="num" style="font-weight:700">${fHrs(workedMs(en)/HR)}</div>
        </button>`;}).join('')).join('') || '<div class="li muted small">No punches yet this period.</div>'}
    </div>
    <p class="small faint" style="margin:14px 2px 0">Estimates for the employee&rsquo;s view only. Payroll finalizes after manager approval. Daily OT after ${ST().otDaily} hrs, double time after ${ST().dtDaily}, weekly OT after ${ST().otWeekly}.</p>`;
}

/* Schedule tab */
function renderSchedule(){
  const e = emp(), list = scheduleFor(e), t0 = startOfDay(now());
  const shiftRow = (s, extra='') => { const v = venueById(s.venue); return `
    <div class="li">
      <div style="width:46px;text-align:center;flex:none"><div class="label" style="font-size:10.5px">${new Date(s.day).toLocaleDateString('en-US',{weekday:'short'})}</div><div style="font-family:var(--display);font-weight:800;font-size:24px;line-height:1">${new Date(s.day).getDate()}</div></div>
      <div class="grow"><div class="row" style="gap:6px"><div class="title ellipsis" style="font-size:14.5px">${esc(v.name)}</div></div>
        <div class="meta">${fTime(s.startT)} – ${fTime(s.endT)} · ${s.role}</div>
        <div class="meta">${esc(s.station || s.note)}</div>
        <div class="row" style="gap:6px;margin-top:6px"><span class="badge">${ic(VTYPE[v.type].icon,'" style="width:12px;height:12px')} ${VTYPE[v.type].label}</span>
        <a class="link" style="font-size:12px" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${v.lat},${v.lng}">Directions</a></div></div>
      ${extra}
    </div>`; };
  return `
    ${XA.schedTop ? XA.schedTop() : ''}
    <div style="padding:6px 2px 4px"><div class="label">Next 7 days</div><div class="title" style="font-size:20px">Your shifts</div></div>
    <div class="list" style="margin-top:10px">
      ${list.map(s => shiftRow(s, XA.shiftActions ? XA.shiftActions(s) : s.day===t0 ? '<span class="badge ok">Today</span>' : '')).join('') || '<div class="li small muted">No shifts scheduled in the next 7 days.</div>'}
    </div>
    <div class="section-h"><h2>Open shifts</h2><span class="small faint">First come, manager approves</span></div>
    <div class="list">
      ${openShifts().map(o => { const s = {...o, day:startOfDay(o.startT)};
        const req = S.requests.filter(r=>r.ref===o.id).pop();
        if (XA.openAction){ const x = XA.openAction(o, req); if (x != null) return shiftRow(s, x); }
        return shiftRow(s, req ? `<span class="badge ${req.status==='Approved'?'ok':req.status==='Denied'?'bad':'info'}">${req.status==='Pending'?'Requested':req.status}</span>` : `<button class="btn sm" data-act="pickup" data-v="${o.id}">Request</button>`); }).join('') || '<div class="li small muted">No open shifts right now.</div>'}
    </div>
    <p class="small faint" style="margin:14px 2px 0">Your manager builds this schedule in the manager console. Changes show up here right away.</p>
    <button class="btn" style="margin-top:12px" data-act="timeoff">${ic('cal')} Request time off</button>`;
}

/* Me tab */
function renderMe(){
  const e = emp();
  return `
    <div class="card row" style="gap:14px">
      <div class="avatar lg" style="border-color:${e.color}">${e.initials}</div>
      <div class="grow"><div class="title" style="font-size:19px">${e.name}</div><div class="small muted">Employee ${e.id}</div>
      <div class="small muted">Home venue: ${esc(venueById(e.home).name)}</div></div>
    </div>
    <div class="section-h"><h2>Pay rates</h2></div>
    <div class="list">${e.roles.map(r=>`<div class="li"><div class="grow title" style="font-size:14.5px">${r.role}</div><div class="num" style="font-weight:700">${money(r.rate)}/hr</div></div>`).join('')}</div>
    ${ST().allowNfc ? `<div class="section-h"><h2>NFC tap clock-in</h2></div>
    <div class="card row" style="gap:12px">
      <div class="vt" style="width:38px;height:38px">${ic('nfc')}</div>
      <div class="grow"><div class="title" style="font-size:14.5px">${CC.deviceEmp()===e.id ? 'This phone is linked to you' : 'This phone isn&rsquo;t linked'}</div>
        <div class="meta">${CC.deviceEmp()===e.id ? 'Hold it to any CJ&rsquo;s sticker to clock in. No PIN.' : 'Link it so a sticker tap clocks you in without a PIN.'}</div></div>
      ${CC.deviceEmp()===e.id ? `<button class="btn sm" data-act="unlink-phone">Unlink</button>` : ST().nfcPairing ? `<button class="btn sm primary" data-act="link-phone">Link</button>` : ''}
    </div>` : ''}
    ${XA.meExtra ? XA.meExtra() : ''}
    <div class="section-h"><h2>Requests</h2></div>
    <div class="list">
      ${S.requests.slice().reverse().map(r=>`
        <div class="li"><div class="grow"><div class="title" style="font-size:14.5px">${r.kind}</div><div class="meta">${esc(r.detail)}</div>${r.mgrNote?`<div class="meta" style="color:var(--info)">Manager: ${esc(r.mgrNote)}</div>`:''}</div><span class="badge ${r.status==='Pending'?'warn':r.status==='Denied'?'bad':'ok'}">${r.status}</span></div>`).join('') || '<div class="li small muted">No requests.</div>'}
    </div>
    <div class="section-h"><h2>Venues</h2><span class="small faint">${VENUES_ALL().length} geofences</span></div>
    <div class="list">${VENUES_ALL().map(v => `
      <div class="li"><div class="vt" style="width:36px;height:36px">${ic(VTYPE[v.type].icon)}</div>
        <div class="grow"><div class="title ellipsis" style="font-size:14.5px">${esc(v.name)}</div><div class="meta ellipsis">${esc(v.addr)}</div><div class="meta">${VTYPE[v.type].label} · ${v.r} m fence${v.window&&v.window[0]?` · ${v.window[0].slice(5)} to ${v.window[1].slice(5)}`:''}</div></div>
        ${venueActive(v) ? '<span class="badge ok">Active</span>' : `<span class="badge">${v.active===false?'Off':'Ended'}</span>`}</div>`).join('')}</div>
    <div class="section-h"><h2>Your privacy</h2></div>
    <div class="card small muted">
      ${ic('shield','" style="width:18px;height:18px;color:var(--mustard);float:left;margin:2px 10px 0 0')}
      We use your location only to confirm you&rsquo;re at a venue when you punch, and to check you&rsquo;re still on site while you&rsquo;re on the clock. No tracking off the clock. Punch photos and GPS points are kept with your time records for payroll and audits.
    </div>
    <button class="btn" style="margin-top:16px" data-act="signout">${ic('out')} Sign out</button>
    <p class="small faint" style="text-align:center;margin-top:12px">CJ&rsquo;s Crew - Clock · prototype v0.5</p>`;
}


/* Guide tab */
function renderGuide(fromAuth=false){
  const sec = (title, body, open=false) => `<details class="gd" ${open?'open':''}><summary>${title}${ic('chev')}</summary><div class="gd-b">${body}</div></details>`;
  const steps = arr => `<ol class="gd-steps">${arr.map(x=>`<li>${x}</li>`).join('')}</ol>`;
  const demoBtn = `<button class="btn sm" data-act="guide-demo" style="margin-top:10px">${ic('sliders')} Open demo controls</button>`;
  return `
    <div style="padding:6px 2px 12px">
      <span class="proto-tag">Prototype guide</span>
      <div class="title" style="font-size:20px;margin-top:10px">How CJ&rsquo;s Crew - Clock works</div>
      <p class="small muted" style="margin-top:4px">A phone time clock for CJ&rsquo;s Wings crew: punch in and out by location at the restaurant, stadium stands, pop-ups and the food truck.</p>
    </div>

    ${sec('What this prototype can do', `
      <ul class="gd-list">
        <li><b>Sign in that proves who&rsquo;s punching.</b> Employee picks their name, enters a 4-digit PIN, then takes a selfie that&rsquo;s attached to the punch. This stops buddy punching.</li>
        <li><b>Location-locked clock in.</b> The Clock In button only unlocks inside a venue&rsquo;s geofence (a virtual boundary around the venue).</li>
        <li><b>Four kinds of venue.</b> Fixed restaurant (Pico Blvd), stadiums (Dignity Health Sports Park, SoFi), pop-ups that only work on their event dates, and a food truck whose geofence moves with the truck&rsquo;s GPS.</li>
        <li><b>Smart flags, not hard stops.</b> Weak GPS, early punches, unscheduled shifts and working at a different venue than scheduled are allowed but flagged for the manager.</li>
        <li><b>Exceptions.</b> At work but GPS won&rsquo;t cooperate (stadium tunnel, dead phone)? Request an exception; the punch is recorded and sent for approval.</li>
        <li><b>Live shift timer</b> with pay earned so far, role and hourly rate.</li>
        <li><b>Breaks with California-style nudges:</b> 30-min unpaid meal before the 5th hour, 10-min paid rest per 4 hours, overtime countdown.</li>
        <li><b>Leaving-the-venue alert</b> if the phone leaves the geofence mid-shift.</li>
        <li><b>Clock out</b> with cash tip entry, card tips from the register, a break attestation and an hours confirmation, then a receipt.</li>
        <li><b>Timesheet:</b> pay period totals, regular / overtime 1.5× / double time 2×, break premiums, tips, and a GPS audit trail for every punch.</li>
        <li><b>Fix mistakes:</b> request a punch correction or report a missed punch.</li>
        <li><b>Schedule:</b> upcoming shifts with directions, plus open shifts to request.</li>
        <li><b>Me:</b> pay rates by role, request status, venue list and a plain-English privacy note.</li>
        <li><b>Manager console</b> (new): live board of who&rsquo;s on the clock, an approvals inbox, timesheet editing, scheduling, crew and pay rates, venue geofences, payroll export, rules and an activity log. Open it from the sign-in screen.</li>
        <li><b>NFC sticker clock-in</b> (new): hold your phone to the CJ&rsquo;s sticker at the venue. The first tap asks for your name and PIN and remembers the phone; after that one tap clocks you in, opens break and clock-out, or ends your break. Works on iPhone XS and newer and most Android phones without installing anything.</li>
        <li><b>Tablet crew board</b> (new): open <b>display.html</b> on a wall tablet. It shows who&rsquo;s working, who&rsquo;s scheduled today, and turns a name <b style="color:var(--bad)">red</b> when that person is due for a 10-minute, 15-minute or lunch break. It also shows who&rsquo;s on break with a countdown (and flags anyone whose break time is up), the breaks coming up in the next hour, shift-end and overtime heads-ups, and manager announcements. Crew without their phone can tap <b>No phone? Punch here</b> and use their PIN to clock in, take a break or clock out.</li>
        <li><b>Printable sticker labels:</b> each label has a QR code backup, so phones without NFC can scan it with the camera.</li>
        <li><b>Team tab</b> (new): crew chat by venue plus a direct line to the manager with &ldquo;seen by&rdquo; receipts, shared opening and closing checklists with temperature logs and photos, and announcements you confirm with &ldquo;Got it.&rdquo;</li>
        <li><b>Shift trading</b> (new): confirm shifts, offer a swap to a coworker, release a shift, and pick up covered shifts instantly when the manager offers them to you. Set your availability from the Schedule tab.</li>
        <li><b>Me tab extras</b> (new): early pay on hours already worked, sign onboarding paperwork, add your food handler card, take short training lessons, see texts and alerts, and drop an anonymous suggestion.</li>
        <li><b>On the clock</b> (new): switch roles mid-shift (Cashier to Fryer) and the pay rate follows. Late, early or unscheduled punches ask for a quick reason, and you can rate your shift after clocking out.</li>
      </ul>`, true)}

    ${sec('How it works behind the scenes', `
      <ul class="gd-list">
        <li><b>Geofences.</b> Each venue has a center point and a radius: about 75 m for the kitchen, 450 to 500 m for stadiums, 60 m around the truck. The app compares the phone&rsquo;s GPS to the nearest active venue.</li>
        <li><b>GPS accuracy matters.</b> If the phone&rsquo;s accuracy is worse than the venue radius, the punch is allowed but marked &ldquo;Weak GPS&rdquo;.</li>
        <li><b>Location privacy.</b> Location is checked at punch time and while on the clock only. No tracking off the clock.</li>
        <li><b>Pay math.</b> Daily overtime after 8 hours, double time after 12, weekly overtime after 40. Missed or late meal breaks add one hour of pay. These follow common California rules and need payroll/legal review before real use.</li>
        <li><b>Data.</b> Everything is sample data kept on a small demo sync server. Open the crew app and the manager console on any phones or tabs and changes sync between them within a couple of seconds. <b>Reset demo</b> restores the sample data.</li>
      </ul>`)}

    ${sec('Using the demo controls', `
      <p>Because you probably aren&rsquo;t standing at a venue, the prototype lets you fake where the phone is and fast-forward time. These controls are for demos only; real employees wouldn&rsquo;t see them.</p>
      ${steps([
        'Tap the <b>sliders icon</b> at the top right (on a laptop, the controls sit beside the phone).',
        'Under <b>Phone location</b>, pick a venue such as <b>At Dignity Health Sports Park</b>. The Clock screen switches to &ldquo;Inside geofence&rdquo;.',
        'Try <b>Stadium parking lot (far)</b> or <b>At home</b> to see clock in locked, and <b>Pico, weak GPS signal</b> to see a flagged punch.',
        '<b>Use my real location</b> uses your phone&rsquo;s actual GPS. You&rsquo;ll show as outside unless you&rsquo;re at a venue.',
        'Under <b>Clock</b>, tap <b>+15 min</b>, <b>+1 hr</b> or <b>+4 hrs</b> to skip ahead. <b>Real time</b> returns to now.',
        '<b>Reset demo</b> clears everything and returns to sign in.',
      ])}
      <p style="margin-top:8px">Demo PINs: Marcus Bell <b>1234</b> (stadium fryer), Dee Alvarez <b>2468</b> (truck lead), Jordan Price <b>1111</b> (Pico kitchen), Luis Ortega <b>3333</b> (Pico fryer), Ana Ruiz <b>4444</b> (Pico cashier), Rosa Delgado <b>5151</b> (Pico cashier). Under <b>NFC sticker tap</b>, tap a sticker to simulate holding the phone to it.</p>
      ${demoBtn}`)}

    ${sec('5-minute demo for a business partner', `
      <p>A suggested script. Hand them the phone, or share your screen, and walk through it in order.</p>
      ${steps([
        '<b>The problem (30 sec).</b> &ldquo;Our crew works at the Pico kitchen, stadium stands, pop-ups and the truck. Paper sheets and shared tablets don&rsquo;t follow them. This puts the time clock in their pocket, locked to where they actually are.&rdquo;',
        '<b>Identity (30 sec).</b> Sign in as Marcus, PIN 1234, simulate the selfie. Point out: PIN plus photo means no buddy punching.',
        '<b>Location lock (1 min).</b> Show &ldquo;Inside geofence&rdquo; at the stadium. Open demo controls, switch to <b>Stadium parking lot (far)</b>: the button locks. Switch back.',
        '<b>Clock in (30 sec).</b> Tap Clock In and confirm. Point out the venue, role, rate and GPS accuracy on the confirmation.',
        '<b>Breaks and compliance (1 min).</b> Skip ahead <b>+4 hrs</b>. Show the meal break warning. Start a meal break, skip <b>+15 min</b> twice, end it.',
        '<b>Walking off site (30 sec).</b> Switch location to the far parking lot. Show the &ldquo;You left the venue&rdquo; alert.',
        '<b>Clock out (30 sec).</b> Enter tips, answer the break question, confirm hours, show the receipt.',
        '<b>Payroll view (30 sec).</b> Open Timesheet: totals, overtime split, tips and the GPS record on any punch.',
        '<b>The truck (optional).</b> Reset, sign in as Dee (2468) next to Boss Truck 1. The geofence goes wherever the truck parks.',
        '<b>Manager side (1 min).</b> Open <b>manager.html</b> in a second tab, PIN <b>9999</b>. Marcus shows on the Live board. Approve a request in Approvals and watch it change in the crew app.',
        '<b>Sticker and wall board (1 min).</b> Open <b>display.html</b> on a tablet: Luis, Dee and Jordan show red because their breaks are due. Sign out, use <b>NFC sticker tap</b> as Ana (4444) and watch her appear on the board.',
      ])}
      <p style="margin-top:8px"><b>Questions to ask them:</b> Which venues come first? How strict should early/late punches be? Who approves exceptions? Which payroll system should this feed?</p>`)}

    ${sec('What&rsquo;s sample vs. still to build', `
      <ul class="gd-list">
        <li><b>Sample:</b> employees, PINs, pay rates, schedules, venue boundaries, stand numbers and card tips.</li>
        <li><b>Simulated:</b> the selfie when the camera is blocked, and location when using demo controls.</li>
        <li><b>Not built yet:</b> a production database and real accounts (the demo server is shared sample data), payroll export (e.g. Gusto, ADP, Toast), POS tip sync, push notifications (the wall board covers break alerts for now), and a native iPhone/Android wrapper for background location.</li>
      </ul>`)}

    <p class="small faint" style="margin:14px 2px 0">CJ&rsquo;s Crew - Clock · prototype v0.4</p>
    ${fromAuth ? `<button class="btn primary" style="margin-top:14px" data-act="back-pick">Start the demo</button>` : ''}`;
}

/* Demo panel */
function renderDemo(){
  demo.classList.toggle('open', S.demoOpen);
  const g = S.user ? geofence() : null;
  demo.innerHTML = `
    <div class="demo-card">
      <div class="row between"><span class="proto-tag">Prototype controls</span>
        ${S.demoOpen ? `<button class="icon-btn" data-act="demo-toggle" aria-label="Close">${ic('x')}</button>` : ''}</div>
      <p style="margin-top:10px">Not part of the employee app. Use these to fake where the phone is and fast-forward the clock.</p>
    </div>
    <div class="demo-card">
      <h3>Phone location</h3>
      ${LOCS.map(l => `<button class="demo-opt ${S.loc===l.id?'on':''}" data-act="loc" data-v="${l.id}"><span class="dot"></span><span>${l.label}<small>${l.sub}</small></span></button>`).join('')}
      ${g && g.status!=='nopos' ? `<p style="margin-top:8px;font-size:12px">Nearest: ${esc(g.venue.name)} · ${fDist(g.d)}</p>` : ''}
    </div>
    <div class="demo-card">
      <h3>Clock</h3>
      <div class="demo-row">
        <button class="chip-btn" data-act="ff" data-v="15">+15 min</button>
        <button class="chip-btn" data-act="ff" data-v="60">+1 hr</button>
        <button class="chip-btn" data-act="ff" data-v="240">+4 hrs</button>
        <button class="chip-btn" data-act="ff" data-v="0">Real time</button>
      </div>
      <p style="margin-top:8px;font-size:12px" class="num">Simulated: ${fDate(now())}, ${fTime(now())}</p>
    </div>
    <div class="demo-card">
      <h3>NFC sticker tap</h3>
      <p style="font-size:12px;margin-bottom:8px">Pretend the phone was held to a venue sticker. ${CC.deviceEmp() ? `This phone is linked to <b>${esc(CC.empById(CC.deviceEmp())?.name||'')}</b>, so no PIN.` : 'This phone isn’t linked yet, so it asks who you are once.'}</p>
      ${D().nfcTags.filter(t=>t.active!==false).map(t => `<button class="demo-opt" data-act="sim-tap" data-v="${esc(t.code)}"><span class="dot"></span><span>Tap: ${esc(venueById(t.venue).name)}<small>${esc(t.label)}</small></span></button>`).join('') || '<p style="font-size:12px">No active stickers. Add one in the manager console.</p>'}
      ${CC.deviceEmp() ? `<div class="demo-row" style="margin-top:8px"><button class="chip-btn" data-act="unlink-phone">Unlink this phone</button></div>` : ''}
      <p style="font-size:12px;margin-top:8px"><a class="link" href="display.html" target="_blank" rel="noopener" style="font-size:12px">Open the tablet crew board</a></p>
    </div>
    <div class="demo-card">
      <h3>Demo crew</h3>
      ${EMPS().map(e=>`<p style="font-size:12.5px">${esc(e.name)} · PIN <b class="num">${esc(e.pin)}</b></p>`).join('')}
      <p style="font-size:12.5px;margin-top:6px">Manager console · PIN <b class="num">${esc(ST().managerPin)}</b> · <a class="link" href="manager.html" style="font-size:12.5px">Open</a></p>
      <div class="demo-row" style="margin-top:10px"><button class="chip-btn" data-act="reset">Reset demo</button></div>
    </div>`;
}

/* ---------- Sheets ---------- */
function openSheet(html){ sheetRoot.innerHTML = `<div class="scrim" data-act="scrim"><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div></div>`; }
function closeSheet(){ sheetRoot.innerHTML = ''; }

function sheetPunchIn(){
  const e = emp(), g = geofence(), r = e.roles.find(x=>x.role===S.role);
  const sh = todaysShift();
  const flags = [];
  if (g.status==='weak') flags.push('Low GPS accuracy');
  if (sh && now() < sh.startT - ST().earlyMin*MIN) flags.push('Early punch');
  if (!sh) flags.push('Unscheduled');
  if (sh && g.venue.id !== sh.venue) flags.push('Venue change');
  openSheet(`
    <h3>Clock in?</h3>
    <p class="muted small">Check the details, then confirm.</p>
    <div class="receipt" style="margin-top:14px">
      <div class="split"><span class="muted">Time</span><span class="num">${fTime(now())}</span></div>
      <div class="split"><span class="muted">Venue</span><span>${esc(g.venue.name)}</span></div>
      <div class="split"><span class="muted">Role · rate</span><span>${r.role} · ${money(r.rate)}/hr</span></div>
      <div class="split"><span class="muted">Location</span><span class="num">${fDist(g.d)} from center · ±${Math.round(g.pos.acc)} m</span></div>
      <div class="split"><span class="muted">Identity</span><span>PIN + photo</span></div>
    </div>
    ${XA.inReason ? XA.inReason(sh, flags) : ''}
    ${flags.length ? `<div class="alert warn" style="margin-top:12px">${ic('alert')}<div><b>Will be flagged for your manager:</b> ${flags.join(', ')}.</div></div>`:''}
    <div class="btn-grid" style="margin-top:16px">
      <button class="btn" data-act="close">Cancel</button>
      <button class="btn primary" data-act="confirm-in" data-flags="${esc(flags.join('|'))}">Clock in</button>
    </div>`);
}

function sheetException(){
  const e = emp(), sh = todaysShift();
  openSheet(`
    <h3>Request an exception</h3>
    <p class="muted small">Your punch will be recorded now and sent to your manager to approve.</p>
    <label class="field"><span>Where are you working?</span>
      <select class="input" id="exVenue">${VENUES_ALL().filter(venueActive).map(v=>`<option value="${v.id}" ${sh&&sh.venue===v.id?'selected':''}>${esc(v.name)}</option>`).join('')}</select></label>
    <label class="field"><span>What&rsquo;s going on?</span>
      <select class="input" id="exReason">
        <option>GPS shows me in the wrong place</option>
        <option>Venue isn&rsquo;t set up in the app yet</option>
        <option>Working off-site (supply run, catering drop)</option>
        <option>Phone location is turned off</option>
      </select></label>
    <label class="field"><span>Note for your manager (optional)</span><textarea class="input" id="exNote" placeholder="e.g. Inside the stadium tunnel, no signal"></textarea></label>
    <div class="btn-grid" style="margin-top:16px">
      <button class="btn" data-act="close">Cancel</button>
      <button class="btn primary" data-act="confirm-ex">Clock in &amp; send</button>
    </div>`);
}

function sheetPunchOut(){
  const sh = S.shift, b = breakState(sh), g = geofence();
  const end = now();
  const worked = workedMs(sh, end);
  const mealNeeded = worked > ST().mealByHour*HR;
  const mealOk = b.meals.some(m => m.start <= b.mealDueT && (m.end??end) - m.start >= ST().mealMin*MIN - 1e3);
  openSheet(`
    <h3>Clock out</h3>
    <div class="receipt" style="margin-top:10px">
      <div class="split"><span class="muted">In</span><span class="num">${fTime(sh.inT)}</span></div>
      <div class="split"><span class="muted">Out</span><span class="num">${fTime(end)}</span></div>
      <div class="split"><span class="muted">Breaks</span><span>${b.meals.length} meal · ${b.rests.length} rest</span></div>
      <div class="split"><span class="muted">Hours worked</span><span class="num" style="font-weight:700">${fHrs(worked/HR)}</span></div>
      <div class="split"><span class="muted">Location</span><span>${g.status==='in' && g.venue.id===sh.venue ? 'At venue' : `<span style="color:var(--warn)">Off site</span>`}</span></div>
    </div>
    <label class="field"><span>Cash tips received</span><input class="input num" id="tipsCash" inputmode="decimal" placeholder="0.00"></label>
    <div class="small muted" style="margin-top:6px">Card tips from the register: <b class="num" style="color:var(--text)">${money(sh.tipsCard)}</b> (sample, pulled automatically)</div>
    ${XA.outReason ? XA.outReason(sh) : ''}
    <div class="label" style="margin-top:18px">Break attestation</div>
    ${mealNeeded && !mealOk ? `<div class="alert warn" style="margin-top:8px">${ic('alert')}<div>The clock didn&rsquo;t record a full ${ST().mealMin}-min meal break before hour ${ST().mealByHour}.</div></div>`:''}
    <label class="check"><input type="radio" name="att" value="ok" ${(!mealNeeded||mealOk)?'checked':''}><span>I was able to take all my meal and rest breaks.</span></label>
    <label class="check"><input type="radio" name="att" value="missed" ${(mealNeeded&&!mealOk)?'checked':''}><span>I missed or was cut short on a break. <span class="faint">You may be owed an extra hour of pay.</span></span></label>
    <label class="check"><input type="checkbox" id="confirmHrs"><span>These hours are correct.</span></label>
    <div class="btn-grid" style="margin-top:16px">
      <button class="btn" data-act="close">Keep working</button>
      <button class="btn primary" data-act="confirm-out">Clock out</button>
    </div>`);
}

function sheetReceipt(en){
  const v = venueById(en.venue);
  openSheet(`
    <div style="text-align:center">${ic('check','" style="width:46px;height:46px;color:var(--ok)')}</div>
    <h3 style="text-align:center">You&rsquo;re clocked out</h3>
    <p class="muted small" style="text-align:center">Nice work at ${esc(v.name)}. A copy is in your timesheet.</p>
    <div class="receipt" style="margin-top:14px">
      <div class="split"><span class="muted">Shift</span><span class="num">${fTime(en.inT)} – ${fTime(en.outT)}</span></div>
      <div class="split"><span class="muted">Hours</span><span class="num">${fHrs(workedMs(en)/HR)}</span></div>
      <div class="split"><span class="muted">Est. wages</span><span class="num">${money(workedMs(en)/HR*en.rate)}</span></div>
      <div class="split"><span class="muted">Tips</span><span class="num">${money((en.tipsCash||0)+(en.tipsCard||0))}</span></div>
      <div class="split"><span class="muted">Punch ID</span><span class="mono">${en.id}</span></div>
    </div>
    ${XA.receiptExtra ? XA.receiptExtra(en) : ''}
    <button class="btn primary" style="margin-top:16px" data-act="close">Done</button>`);
}

function sheetEntry(id){
  const en = D().punches.find(h=>h.id===id);
  const v = venueById(en.venue);
  openSheet(`
    <h3>${fDate(en.inT)}</h3>
    <p class="muted small">${esc(v.name)} · ${en.role} · ${money(en.rate)}/hr</p>
    ${en.exception ? `<div class="alert ${en.exception==='approved'?'ok':'warn'}" style="margin-top:12px">${ic('info')}<div><b>Exception ${en.exception}.</b> ${esc(en.reason||'')}</div></div>`:''}
    ${en.edited ? `<div class="alert info" style="margin-top:12px">${ic('shield')}<div><b>Edited by your manager</b> ${fDate(en.edited.t)}. ${esc(en.edited.note||'')}</div></div>`:''}
    ${en.editPending ? `<div class="alert info" style="margin-top:12px">${ic('edit')}<div><b>Correction pending:</b> ${esc(en.editPending)}</div></div>`:''}
    <div class="list" style="margin-top:14px">${punchLog(en).map(p=>`<div class="li"><div class="grow"><div class="title" style="font-size:14px">${p.label}</div><div class="meta">${p.meta}</div></div><div class="num small">${fTime(p.t)}</div></div>`).join('')}</div>
    <div class="receipt" style="margin-top:12px">
      <div class="split"><span class="muted">Hours</span><span class="num">${fHrs(workedMs(en)/HR)}</span></div>
      <div class="split"><span class="muted">Tips (cash + card)</span><span class="num">${money((en.tipsCash||0)+(en.tipsCard||0))}</span></div>
      <div class="split"><span class="muted">GPS at punch-in</span><span class="mono">${(en.inLoc?.lat??0).toFixed(5)}, ${(en.inLoc?.lng??0).toFixed(5)}</span></div>
      <div class="split"><span class="muted">Breaks attested</span><span>${en.attest==='missed' ? '<span style="color:var(--bad)">Missed</span>' : en.waived ? 'Meal waived (≤ 6 hrs)' : 'Yes'}</span></div>
    </div>
    ${en.live || en.editPending ? '' : `
    <label class="field"><span>Something wrong? Request a correction</span><textarea class="input" id="fixNote" placeholder="e.g. I clocked out late, I actually left at 7:15 PM"></textarea></label>
    <button class="btn" style="margin-top:12px" data-act="fix" data-v="${en.id}">${ic('edit')} Send to manager</button>`}
    <button class="btn ghost" style="margin-top:8px" data-act="close">Close</button>`);
}

function sheetTimeOff(){
  openSheet(`
    <h3>Request time off</h3>
    <p class="muted small">Your manager will approve or deny it.</p>
    <label class="field"><span>Date</span><input class="input" type="date" id="toDate" value="${CC.toDateInput(now()+7*DAY)}"></label>
    <label class="field"><span>Reason (optional)</span><input class="input" id="toNote" placeholder="e.g. Doctor appointment"></label>
    <div class="btn-grid" style="margin-top:16px"><button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="confirm-timeoff">Send request</button></div>`);
}

function announcementCards(){
  if (XA.annCards) return XA.annCards();
  const e = emp(); const list = D().announcements.filter(a => !a.venue || scheduleFor(e).some(s=>s.venue===a.venue) || e.home===a.venue).slice(0,2);
  return list.map(a => `<div class="alert info" style="margin-bottom:12px">${ic('mega')}<div><b>${a.venue ? esc(venueById(a.venue).name) : 'All crew'}:</b> ${esc(a.text)}<div class="small" style="opacity:.75;margin-top:3px">${fDate(a.t)} · ${fTime(a.t)}</div></div></div>`).join('');
}

function sheetMissed(){
  openSheet(`
    <h3>Missed punch</h3>
    <p class="muted small">Forgot to clock in or out? Tell us when, and your manager will approve it.</p>
    <label class="field"><span>Which punch?</span><select class="input" id="mpType"><option>Clock in</option><option>Clock out</option><option>Meal break start</option><option>Meal break end</option></select></label>
    <label class="field"><span>Date</span><input class="input" type="date" id="mpDate" value="${new Date(now()-DAY).toISOString().slice(0,10)}"></label>
    <label class="field"><span>Time</span><input class="input" type="time" id="mpTime" value="17:00"></label>
    <label class="field"><span>Venue</span><select class="input" id="mpVenue">${VENUES_ALL().filter(v=>v.active!==false).map(v=>`<option value="${v.id}">${esc(v.name)}</option>`).join('')}</select></label>
    <div class="btn-grid" style="margin-top:16px"><button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="confirm-missed">Send request</button></div>`);
}

/* ---------- Actions ---------- */
let toastT;
function toast(msg){ const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(()=>t.classList.remove('show'), 2600); }
let stream = null;
function stopCam(){ if (stream){ stream.getTracks().forEach(t=>t.stop()); stream = null; } }

function startShift(venueId, flags, extra={}){
  const e = emp(), r = e.roles.find(x=>x.role===S.role) || e.roles[0], g = geofence();
  const p = g.pos || {lat:0,lng:0,acc:0};
  const sh = {id:CC.id(`P-${e.id.slice(2)}`), emp:e.id, venue:venueId, role:r.role, rate:r.rate, inT:now(), breaks:[], flags,
    inLoc:{lat:p.lat, lng:p.lng, acc:p.acc, method: extra.exception ? 'Manager exception' : 'GPS geofence'},
    selfie: S.selfie || 'none',
    tipsCard: Math.round((20 + Math.random()*40)*100)/100, ...extra};
  D().punches.push(sh);
  S.leftWarned = false;
  return sh;
}
function addRequest(r){ D().requests.push({id:CC.id('R'), emp:S.user, status:'Pending', t:now(), ...r}); }

function finishAuth(){
  const e = CC.empById(S.pickId);
  S.user = e.id; S.tab='clock'; S.role=null; S.auth='pick';
  S.loc = {dhsp:'dhsp_gate', truck:'truck', pico:'pico', carson:'carson'}[e.home] || S.loc;
  if (S.tapPending){
    const tag = S.tapPending; S.tapPending = null;
    if (S.tapRemember && ST().nfcPairing) linkDevice(e.id);
    doTap(tag, e.id); return;
  }
  toast(`Signed in as ${e.name}`);
}

/* ---------- NFC tap clock-in ----------
   Each sticker holds a link like index.html?tag=PICO-BOH-7K2Q. iPhones (XS and newer) and Android
   phones open that link when held to the sticker, with no app needed. Android Chrome can also read
   stickers from inside the app (Scan NFC sticker). A linked phone skips the PIN. */
function tapBanner(){
  const t = S.tapPending, v = venueById(t.venue);
  return `<div class="tap-banner">${ic('nfc')}<div><b>Sticker tapped at ${esc(v.name)}</b><small>${esc(t.label)} · ${fTime(now())}</small></div><button class="icon-btn" data-act="tap-cancel" aria-label="Cancel tap">${ic('x')}</button></div>`;
}
function linkDevice(empId){
  const k = CC.deviceKey; if (!k) return;
  D().devices[k] = {emp:empId, t:now(), label: /iPhone|iPad/.test(navigator.userAgent) ? 'iPhone' : /Android/.test(navigator.userAgent) ? 'Android phone' : 'Browser'};
  CC.log(CC.empById(empId).name, 'Linked a phone for NFC tap clock-in');
}
function tapMsg(kind, title, sub, extra=''){ S.tapResult = {kind, title, sub, extra, t:now()}; }
function handleTap(code){
  closeSheet(); stopNfcScan();
  const tag = CC.tagByCode(code);
  if (!ST().allowNfc){ S.tapResult = null; toast('NFC clock-in is turned off by your manager'); render(); return; }
  if (!tag || tag.active === false){ if (S.user) { tapMsg('bad', 'Sticker not recognized', 'This NFC sticker isn&rsquo;t active. Ask your manager, or clock in with the button.'); } else toast('That NFC sticker isn’t active. Sign in to clock in.'); render(); return; }
  const v = venueById(tag.venue);
  if (!venueActive(v)){ if (S.user) tapMsg('bad', `${esc(v.name)} is closed`, 'This venue isn&rsquo;t accepting punches right now.'); else toast(`${v.name} isn’t accepting punches right now`); render(); return; }
  const empId = S.user || CC.deviceEmp();
  const linked = CC.deviceEmp();
  if (!empId || (linked && CC.empById(linked)?.active === false)){ S.tapPending = tag; S.auth = 'pick'; S.user = null; render(); return; }
  if (!S.user){
    const e = CC.empById(empId); S.pickId = e.id; S.tapPending = tag;
    if (ST().requireSelfie && ST().nfcSelfie){ S.auth = 'selfie'; S.selfie = null; render(); return; }
    S.selfie = 'skipped'; finishAuth(); render(); return;
  }
  doTap(tag, empId); render();
}
function doTap(tag, empId){
  S.user = empId; S.tab = 'clock';
  const e = emp(), v = venueById(tag.venue), st = ST();
  tag.taps = (tag.taps||0) + 1; tag.lastTapT = now(); tag.lastEmp = e.id;
  const dev = CC.deviceKey && D().devices[CC.deviceKey]; if (dev && dev.emp === e.id) dev.lastTapT = now();
  const live = S.shift;
  if (live){
    const open = live.breaks.find(b=>!b.end);
    if (open){ open.end = now(); commit();
      tapMsg('ok', 'Break ended', `Welcome back, ${esc(e.name.split(' ')[0])}. Your timer is running again.`); return; }
    if (live.venue !== tag.venue){ commit();
      tapMsg('warn', `You&rsquo;re clocked in at ${esc(venueById(live.venue).name)}`, `Clock out there first, then tap again to clock in at ${esc(v.name)}.`, 'menu'); return; }
    commit(); tapMsg('menu', `On the clock at ${esc(v.name)}`, `Since ${fTime(live.inT)} · ${fHM(workedMs(live))} worked. What do you need?`, 'menu'); return;
  }
  const sh = todaysShift();
  if (st.blockEarly && sh && now() < sh.startT - st.earlyMin*MIN){ commit(); tapMsg('bad', 'Too early to clock in', `Your shift starts ${fTime(sh.startT)}. Tap again after ${fTime(sh.startT - st.earlyMin*MIN)}.`); return; }
  if (!st.allowUnscheduled && !sh){ commit(); tapMsg('bad', 'No shift today', 'You&rsquo;re not on the schedule today. Ask your manager to add you.'); return; }
  S.role = (sh && e.roles.find(r=>r.role===sh.role)) ? sh.role : e.roles[0].role;
  const flags = ['Clocked in by NFC tap'];
  if (sh && now() < sh.startT - st.earlyMin*MIN) flags.push('Early punch');
  if (!sh) flags.push('Unscheduled');
  if (sh && tag.venue !== sh.venue) flags.push('Venue change');
  const p = startShift(tag.venue, flags.filter(f=>f!=='Clocked in by NFC tap'), {nfcTag: tag.id});
  p.inLoc = {lat:v.lat, lng:v.lng, acc:0, method:`NFC tag · ${tag.label}`};
  CC.log(e.name, `Clocked in by NFC tap at ${v.name} (${tag.label})`);
  commit();
  tapMsg('in', `Clocked in at ${fTime(p.inT)}`, `${esc(v.name)} · ${esc(p.role)} · ${money(p.rate)}/hr`);
}
function renderTapResult(){
  const r = S.tapResult, e = emp(), live = S.shift;
  const icon = {in:'check', ok:'check', menu:'nfc', warn:'alert', bad:'alert'}[r.kind];
  const nb = live ? CC.nextBreakFor(live,'rest') : null, nm = live ? CC.nextBreakFor(live,'meal') : null;
  return `
    <div class="signin tap-result ${r.kind}" style="align-items:center;text-align:center">
      <div class="row between" style="width:100%"><span class="proto-tag">NFC tap</span>
        <button class="icon-btn demo-fab" data-act="demo-toggle" aria-label="Prototype controls">${ic('sliders')}</button></div>
      <div class="tap-ic">${ic(icon)}</div>
      <div class="avatar" style="border-color:${e.color};margin-top:6px">${e.initials}</div>
      <div class="title" style="font-size:22px;margin-top:10px">${r.title}</div>
      <p class="muted" style="max-width:310px;margin-top:6px">${r.sub}</p>
      <div class="stack" style="width:100%;max-width:330px;margin-top:22px">
        ${r.extra==='menu' && live ? `
          ${nb ? `<button class="btn" data-act="tap-break" data-v="rest">${ic('coffee')} Start ${esc(nb.label.toLowerCase())}</button>` : `<button class="btn" data-act="tap-break" data-v="rest">${ic('coffee')} Start rest break</button>`}
          ${nm ? `<button class="btn" data-act="tap-break" data-v="meal">${ic('meal')} Start ${esc(nm.label.toLowerCase())}</button>` : `<button class="btn" data-act="tap-break" data-v="meal">${ic('meal')} Start meal break</button>`}
          <button class="btn primary" data-act="tap-out">${ic('out')} Clock out</button>` : ''}
        <button class="btn ${r.extra==='menu'?'ghost':'primary'}" data-act="tap-done">${r.kind==='in'||r.kind==='ok' ? 'Done' : 'Close'}</button>
      </div>
      ${r.kind==='in' ? `<p class="small faint" style="margin-top:16px">Tap the sticker again to start a break or clock out.</p>` : ''}
    </div>`;
}
function startNfcScan(){
  if (!('NDEFReader' in window)){ toast('This phone can’t read stickers in the browser. Hold it to the sticker with the app closed.'); return; }
  const ctrl = new AbortController(); S.nfcScan = ctrl;
  openSheet(`<div style="text-align:center"><div class="tap-ic pulse-ring">${ic('nfc')}</div><h3 style="margin-top:12px">Hold your phone to the sticker</h3>
    <p class="muted small">Touch the top back of your phone to the CJ&rsquo;s sticker and hold still for a second.</p>
    <button class="btn" style="margin-top:16px" data-act="nfc-cancel">Cancel</button></div>`);
  try {
    const reader = new NDEFReader();
    reader.scan({signal: ctrl.signal}).then(() => {
      reader.onreading = ev => {
        let code = '';
        for (const rec of ev.message.records){
          try { const txt = new TextDecoder(rec.encoding || 'utf-8').decode(rec.data); const m = txt.match(/[?&#]tag=([^&#\s]+)/); code = m ? decodeURIComponent(m[1]) : txt.trim(); } catch(e){}
          if (code) break;
        }
        if (code) handleTap(code);
      };
      reader.onreadingerror = () => toast('Couldn’t read that sticker. Try again.');
    }).catch(err => { closeSheet(); S.nfcScan = null; toast(err.name === 'NotAllowedError' ? 'NFC permission was blocked' : 'NFC isn’t available right now'); });
  } catch(err){ closeSheet(); S.nfcScan = null; toast('NFC isn’t available right now'); }
}
function stopNfcScan(){ if (S.nfcScan){ try { S.nfcScan.abort(); } catch(e){} S.nfcScan = null; } }
const nfcButton = () => ST().allowNfc ? `<button class="btn ghost" style="margin-top:10px" data-act="nfc-scan">${ic('nfc')} ${'NDEFReader' in window ? 'Scan NFC sticker' : 'How NFC tap works'}</button>` : '';

document.addEventListener('click', async ev => {
  const el = ev.target.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act, v = el.dataset.v;
  if (act === 'scrim'){ if (ev.target === el) closeSheet(); return; }
  switch (act){
    case 'demo-toggle': S.demoOpen = !S.demoOpen; renderDemo(); return;
    case 'tap-remember': S.tapRemember = el.checked; return;
    case 'sim-tap': S.demoOpen = false; handleTap(v); return;
    case 'nfc-scan': if ('NDEFReader' in window) startNfcScan(); else sheetNfcHelp(); return;
    case 'nfc-cancel': stopNfcScan(); closeSheet(); return;
    case 'tap-done': S.tapResult = null; break;
    case 'tap-break': { const nx = CC.nextBreakFor(S.shift, v), min = nx?.min ?? (v==='meal'?ST().mealMin:ST().restMin);
      S.shift.breaks.push({type:v, start:now(), min}); CC.log(emp().name, `Started ${v==='meal'?'lunch':min+'-min break'} by NFC tap`); commit();
      tapMsg('ok', v==='meal' ? 'Lunch started' : `${min}-minute break started`, `Back by <b>${fTime(now()+min*MIN)}</b>. Tap the sticker when you&rsquo;re back to end your break.`); break; }
    case 'tap-out': S.tapResult = null; render(); sheetPunchOut(); return;
    case 'link-phone': linkDevice(S.user); commit(); toast('This phone is linked. Just tap a sticker to clock in.'); break;
    case 'unlink-phone': if (CC.deviceKey) delete D().devices[CC.deviceKey]; commit(); toast('Phone unlinked'); break;
    case 'pick': S.pickId = v; S.pin=''; S.pinErr=false; S.auth='pin'; break;
    case 'back-pick': S.auth='pick'; break;
    case 'tap-cancel': S.tapPending = null; S.auth='pick'; break;
    case 'open-guide': S.auth='guide'; app.scrollTop=0; break;
    case 'guide-demo': S.demoOpen = true; renderDemo(); return;
    case 'key': {
      if (v==='clr') S.pin=''; else if (v==='del') S.pin=S.pin.slice(0,-1); else if (S.pin.length<4) S.pin+=v;
      S.pinErr=false;
      if (S.pin.length===4){
        const e = CC.empById(S.pickId);
        if (S.pin===e.pin){ const needSelfie = S.tapPending ? (ST().requireSelfie && ST().nfcSelfie) : ST().requireSelfie; if (needSelfie){ S.auth='selfie'; S.selfie=null; } else { S.selfie='skipped'; finishAuth(); } }
        else { S.pinErr=true; S.pin=''; }
      }
      break; }
    case 'cam':
      try {
        stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'}});
        S.selfie='live'; render();
        const vid = document.getElementById('selfieVid'); if (vid) vid.srcObject = stream;
      } catch(err){ S.selfie='sim'; toast('Camera unavailable here, so we used a simulated photo'); render(); }
      return;
    case 'snap': stopCam(); S.selfie='real'; break;
    case 'sim-selfie': S.selfie='sim'; break;
    case 'auth-done': finishAuth(); break;
    case 'tab': S.tab = v; break;
    case 'role': S.role = v; break;
    case 'punch-in': sheetPunchIn(); return;
    case 'confirm-in': {
      const flags = el.dataset.flags ? el.dataset.flags.split('|') : [];
      if (XA.inCheck && XA.inCheck() === false) return;
      const nsh = startShift(geofence().venue.id, flags); if (XA.afterIn) XA.afterIn(nsh); commit(); closeSheet(); toast(`Clocked in at ${fTime(now())}`); break; }
    case 'exception': sheetException(); return;
    case 'confirm-ex': {
      const vid = document.getElementById('exVenue').value, reason = document.getElementById('exReason').value, note = document.getElementById('exNote').value.trim();
      const sh = startShift(vid, ['Exception requested'], {exception:'pending', reason: reason + (note?` — ${note}`:'')});
      addRequest({kind:'Clock-in exception', detail:`${venueById(vid).name}: ${reason}${note?` — ${note}`:''}`, punchId:sh.id});
      commit(); closeSheet(); toast('Clocked in. Your manager has been asked to approve.'); break; }
    case 'break-start': { const nx = CC.nextBreakFor(S.shift, v);
      S.shift.breaks.push({type:v, start:now(), min: nx?.min ?? (v==='meal'?ST().mealMin:ST().restMin)}); commit(); toast(v==='meal' ? 'Lunch started. Enjoy.' : `${nx?.label || 'Rest break'} started`); break; }
    case 'break-end': {
      const b = S.shift.breaks.find(x=>!x.end); const len = now()-b.start;
      if (b.type==='meal' && len < ST().mealMin*MIN - 1e3 && !el.dataset.force){
        openSheet(`<h3>End meal break early?</h3><p class="muted small">You&rsquo;ve been on break ${fHM(len)}. Meal breaks should be at least ${ST().mealMin} minutes. Ending early will be flagged.</p>
          <div class="btn-grid" style="margin-top:16px"><button class="btn" data-act="close">Keep resting</button><button class="btn primary" data-act="break-end" data-force="1">End anyway</button></div>`); return; }
      b.end = now(); if (b.type==='meal' && len < ST().mealMin*MIN - 1e3) (S.shift.flags ||= []).push('Short meal break');
      commit(); closeSheet(); toast('Welcome back. Timer resumed.'); break; }
    case 'punch-out': if (S.shift.breaks.some(b=>!b.end)){ S.shift.breaks.find(b=>!b.end).end = now(); commit(); } sheetPunchOut(); return;
    case 'confirm-out': {
      if (!document.getElementById('confirmHrs').checked){ toast('Please confirm your hours are correct'); return; }
      if (XA.outCheck && XA.outCheck() === false) return;
      const att = document.querySelector('input[name=att]:checked').value;
      const g = geofence(), p = g.pos || {lat:0,lng:0,acc:0};
      const en = S.shift;
      Object.assign(en, {outT:now(), tipsCash: parseFloat(document.getElementById('tipsCash').value) || 0, attest:att,
        missed: att==='missed' ? ['Break missed (employee attested)'] : [], outLoc:{lat:p.lat,lng:p.lng,acc:p.acc,method: g.status==='in' ? 'GPS geofence' : 'Off-site'}});
      if (g.status!=='in' || g.venue.id !== en.venue) (en.flags ||= []).push('Clocked out off site');
      if (XA.afterOut) XA.afterOut(en);
      S.role = null; commit();
      sheetReceipt(en); break; }
    case 'entry': sheetEntry(v); return;
    case 'fix': {
      const note = document.getElementById('fixNote').value.trim(); if (!note){ toast('Add a short note first'); return; }
      const en = D().punches.find(h=>h.id===v); en.editPending = note;
      addRequest({kind:'Punch correction', detail:`${fDate(en.inT)}: ${note}`, punchId:en.id}); commit(); closeSheet(); toast('Correction sent to your manager'); break; }
    case 'missed': sheetMissed(); return;
    case 'confirm-missed': {
      const t = document.getElementById('mpType').value, d = document.getElementById('mpDate').value, tm = document.getElementById('mpTime').value, vid = document.getElementById('mpVenue').value, vn = venueById(vid).name;
      addRequest({kind:'Missed punch', detail:`${t} · ${d} ${tm} · ${vn}`, payload:{type:t, date:d, time:tm, venue:vid}}); commit(); closeSheet(); toast('Missed-punch request sent'); break; }
    case 'timeoff': sheetTimeOff(); return;
    case 'confirm-timeoff': { const d = document.getElementById('toDate').value, n = document.getElementById('toNote').value.trim();
      if (!d){ toast('Pick a date'); return; }
      addRequest({kind:'Time off', detail:`Off ${CC.fShort(new Date(d+'T12:00').getTime())}${n?` · ${n}`:''}`, payload:{date:d}}); commit(); closeSheet(); toast('Time-off request sent'); break; }
    case 'pickup': if (XA.acts.pickup && XA.acts.pickup(el, v) === false) return; { const o = D().openShifts.find(x=>x.id===v); addRequest({kind:'Open shift', detail:`${venueById(o.venue).name} · ${o.role} · ${fDate(o.startT)} ${fTime(o.startT)}–${fTime(o.endT)}`, ref:o.id}); commit(); toast('Requested. Your manager will confirm.'); break; }
    case 'signout': stopCam(); Object.assign(S,{user:null, auth:'pick', pin:'', selfie:null, tapPending:null, tapResult:null}); break;
    case 'close': closeSheet(); return;
    case 'loc':
      if (v==='real'){
        if (!navigator.geolocation){ toast('This browser has no location access'); return; }
        toast('Asking for your location…');
        navigator.geolocation.getCurrentPosition(pos => {
          S.realPos = {lat:pos.coords.latitude, lng:pos.coords.longitude, acc:pos.coords.accuracy}; S.loc='real'; render(); toast('Using your real GPS');
        }, err => { toast('Location blocked here. Try opening the app in its own tab.'); }, {enableHighAccuracy:true, timeout:10000});
        return;
      }
      S.loc = v; if (window.innerWidth <= 760) S.demoOpen = false; break;
    case 'ff': D().offsetMs = v==='0' ? 0 : (D().offsetMs||0) + Number(v)*MIN; commit(); toast(v==='0' ? 'Back to real time' : `Jumped ahead ${v>=60?v/60+' hr':v+' min'}`); break;
    default: if (XA.acts[act]){ const r = XA.acts[act](el, v, ev); if (r === false) return; } break;
    case 'reset': stopCam(); CC.reset(); Object.assign(S,{user:null, auth:'pick', pin:'', selfie:null, loc:'dhsp_gate', demoOpen:false, tapPending:null, tapResult:null}); closeSheet(); toast('Demo data reset'); break;
  }
  const sc = document.getElementById('scroll'); const top = sc ? sc.scrollTop : 0;
  render();
  const sc2 = document.getElementById('scroll'); if (sc2 && act !== 'tab') sc2.scrollTop = top;
});

/* ---------- Live ticking ---------- */
let lastMin = -1;
setInterval(() => {
  if (!S.user) return;
  const n = now();
  document.querySelectorAll('[data-t]').forEach(el => {
    const k = el.dataset.t;
    if (k==='now') el.textContent = fTime(n);
    if (S.shift){
      const b = breakState(S.shift);
      if (k==='worked') el.textContent = fDur(b.worked);
      if (k==='break' && b.open) el.textContent = fDur(n - b.open.start);
      if (k==='earned') el.textContent = '≈ ' + money(b.worked/HR*S.shift.rate);
    }
  });
  const m = Math.floor(n/MIN);
  if (m !== lastMin && !sheetRoot.innerHTML){ lastMin = m; const sc = document.getElementById('scroll'); const top = sc?sc.scrollTop:0; render(); const s2=document.getElementById('scroll'); if(s2) s2.scrollTop=top; }
}, 1000);

/* ---------- Sync with the manager console (other tabs) ---------- */
CC.subscribe((prev, next) => {
  if (S.user){
    const was = prev.punches.find(p => p.emp === S.user && !p.outT);
    const nowP = next.punches.find(p => p.emp === S.user && !p.outT);
    if (was && !nowP) toast('Your manager clocked you out');
    else if (!was && nowP) toast('Your manager clocked you in');
    const pr = prev.requests.filter(r=>r.emp===S.user && r.status==='Pending').map(r=>r.id);
    const done = next.requests.find(r => pr.includes(r.id) && r.status !== 'Pending');
    if (done) toast(`${done.kind} ${done.status.toLowerCase()}`);
  }
  if (sheetRoot.innerHTML && !S.shift && document.getElementById('confirmHrs')) closeSheet();
  if (!sheetRoot.innerHTML){ const sc = document.getElementById('scroll'); const top = sc?sc.scrollTop:0; render(); const s2=document.getElementById('scroll'); if(s2) s2.scrollTop=top; }
  else renderDemo();
});

window.APP = {S, render, openSheet, closeSheet, toast, addRequest, emp, scheduleFor, openShifts, venueById, todaysShift, commit, announcementCards, renderGuide, breakState};
const TAG_IN = (location.search.match(/[?&]tag=([^&#]+)/) || location.hash.match(/[#&]tag=([^&]+)/) || [])[1];
if (TAG_IN) { try { history.replaceState(null, '', location.pathname); } catch(e){} }
CC.ready.then(() => { if (TAG_IN) handleTap(decodeURIComponent(TAG_IN)); else render(); });
})();
