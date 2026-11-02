/* CJ's Crew - Clock — manager console.
   Shares data with the crew app through store.js and the sync server. */
(() => {
'use strict';
const {ic, VTYPE, COLORS, MIN, HR, DAY, now, startOfDay, at, fTime, fDate, fDay, fShort, fDur, fHM, fHrs, money, esc,
  toDateInput, toTimeInput, fromInputs, initialsOf, venueActive, workedMs, punchIssues} = CC;
const D = () => CC.db;
const ST = () => CC.db.settings;
const emp = id => CC.empById(id);
const venue = id => CC.venueById(id);
const MGR = () => ST().managerName || 'Manager';
function commit(logText){ if (logText) CC.log(MGR(), logText); CC.save(); }

const root = document.getElementById('mroot');
const modalRoot = document.getElementById('modalRoot');

const M = {
  authed: false, pin:'', pinErr:false,
  page: (location.hash.slice(1) || 'live'),
  ps: null,           // selected pay period start (null = current)
  tsEmp: 'all', tsIssues:false,
  apFilter: 'all',
  weekOff: 0,
  navOpen:false, demoOpen:false,
  crewQ:'',
};
const curPs = () => M.ps ?? CC.periodStart();
const isClosed = ps => !!D().closedPeriods[ps];

const PAGES = [
  ['live','live','Live board','Today'],
  ['approvals','inbox','Approvals','Today'],
  ['schedule','cal','Schedule','Schedule & time'],
  ['timesheets','sheet','Timesheets','Schedule & time'],
  ['payroll','dollar','Payroll','Pay'],
  ['crew','users','Crew','Team'],
  ['announce','mega','Announcements','Team'],
  ['venues','pin','Venues','Setup'],
  ['nfc','nfc','NFC stickers','Setup'],
  ['rules','gear','Rules','Setup'],
  ['activity','list','Activity log','Setup'],
];
const GROUPS = ['Today','Schedule & time','Pay','Team','Setup'];
/* Extension points used by manager-x.js (labor, tips, chat, checklists, paperwork, hiring and more) */
const EXT = { fns:{}, acts:{}, changes:{}, req:{}, approve:{}, deny:{}, counts:{}, chip:null, cell:null, schedTools:null, schedBelow:null, shiftModalExtra:null, afterShiftSave:null, exportOpen:null };

/* ---------- Derived data ---------- */
const activeEmps = () => D().employees.filter(e => e.active !== false);
const livePunches = () => D().punches.filter(p => !p.outT && !p.voided);
const pendingReqs = () => D().requests.filter(r => r.status === 'Pending' && r.peer !== 'pending' && r.peer !== 'declined');
const flaggedPunches = () => D().punches.filter(p => p.outT && !p.voided && !p.reviewed && ((p.flags||[]).length || p.attest==='missed') && !p.editPending && p.exception !== 'pending');
const approvalsCount = () => pendingReqs().length + flaggedPunches().length;
function todaysShifts(){
  const t0 = startOfDay(now());
  return D().shifts.filter(s => s.startT >= t0 && s.startT < t0 + DAY).sort((a,b)=>a.startT-b.startT);
}
function shiftStatus(s){
  const t0 = startOfDay(s.startT);
  const p = D().punches.find(x => x.emp === s.emp && !x.voided && x.inT >= t0 - 2*HR && x.inT < t0 + DAY);
  if (p && !p.outT) return {k:'on', label:'On the clock', cls:'ok', p};
  if (p) return {k:'done', label:'Done', cls:'', p};
  const n = now();
  if (n > s.endT) return {k:'noshow', label:'No-show', cls:'bad'};
  if (n > s.startT + ST().lateGrace*MIN) return {k:'late', label:`Late ${fHM(n - s.startT)}`, cls:'warn'};
  return {k:'up', label:`Starts ${fTime(s.startT)}`, cls:'info'};
}
function breakInfo(p){
  const open = (p.breaks||[]).find(b => !b.end);
  const worked = workedMs(p);
  const meals = (p.breaks||[]).filter(b=>b.type==='meal');
  const mealDue = p.inT + ST().mealByHour*HR;
  const mealOk = meals.some(m => m.start <= mealDue);
  let meal = mealOk ? {cls:'ok', t:'Meal taken'} : now() > mealDue ? {cls:'bad', t:'Meal overdue'} : (mealDue - now() < 45*MIN ? {cls:'warn', t:`Meal due ${fTime(mealDue)}`} : {cls:'', t:`Meal by ${fTime(mealDue)}`});
  if (worked < ST().mealByHour*HR && !mealOk && now() <= mealDue) meal = meal;
  return {open, worked, meal, ot: worked > ST().otDaily*HR};
}
function laborCost(p){ return workedMs(p)/HR * p.rate; }
const avatar = (e, size=34) => e ? `<span class="avatar" style="width:${size}px;height:${size}px;font-size:${Math.round(size*.36)}px;border-color:${e.color}">${esc(e.initials)}</span>` : '';
const badge = (t, cls='') => `<span class="badge ${cls}">${t}</span>`;
const vIcon = v => ic((VTYPE[v.type]||VTYPE.fixed).icon);
function weekStart(off=0){ const t = startOfDay(now()); const dow = (new Date(t).getDay()+6)%7; return t - dow*DAY + off*7*DAY; }

/* ---------- Shell ---------- */
function render(){
  if (!M.authed){ root.innerHTML = renderLogin(); return; }
  if (!PAGES.some(p=>p[0]===M.page)) M.page = 'live';
  M.navOpen && document.body.classList.add('nav-lock'); if (!M.navOpen) document.body.classList.remove('nav-lock');
  const cnt = approvalsCount();
  const pageFn = {live:pLive, approvals:pApprovals, timesheets:pTimesheets, schedule:pSchedule, crew:pCrew, venues:pVenues, payroll:pPayroll, announce:pAnnounce, nfc:pNfc, rules:pRules, activity:pActivity, ...EXT.fns}[M.page];
  const title = PAGES.find(p=>p[0]===M.page)[2];
  const stale = startOfDay(Date.now()) !== D().seedDay;
  root.innerHTML = `
  <div class="m-shell ${M.navOpen?'nav-open':''}">
    <aside class="m-side" aria-label="Manager sections">
      <div class="m-brand">
        <div class="brand-word">CJ<span>&rsquo;</span>s Crew - Clock</div>
        <div class="brand-sub">Manager console</div>
      </div>
      <nav class="m-nav">
        ${GROUPS.map(g => `<div class="m-nav-g">${g}</div>` + PAGES.filter(p => p[3]===g).map(([k,i,l]) => { const xc = EXT.counts[k] ? EXT.counts[k]() : 0; return `<button class="m-nav-i ${M.page===k?'on':''}" data-act="page" data-v="${k}" aria-current="${M.page===k}">${ic(i)}<span>${l}</span>${k==='approvals'&&cnt?`<b class="m-count">${cnt}</b>`:''}${k==='live'&&livePunches().length?`<b class="m-count live">${livePunches().length}</b>`:''}${xc?`<b class="m-count">${xc}</b>`:''}</button>`; }).join('')).join('')}
      </nav>
      <div class="m-side-foot">
        <a class="m-nav-i" href="index.html" target="_blank" rel="noopener">${ic('ext')}<span>Open crew app</span></a>
        <a class="m-nav-i" href="display.html" target="_blank" rel="noopener">${ic('tablet')}<span>Open tablet board</span></a>
        <button class="m-nav-i" data-act="signout">${ic('out')}<span>Sign out</span></button>
      </div>
    </aside>
    <div class="m-scrim" data-act="nav-close"></div>
    <main class="m-main">
      <header class="m-top">
        <button class="icon-btn m-burger" data-act="nav" aria-label="Menu">${ic('list')}</button>
        <div class="grow">
          <h1 class="m-title">${title}</h1>
          <div class="small muted num" data-t="now">${fDay(now())} · ${fTime(now())}${D().offsetMs?' <span class="badge warn" style="margin-left:4px">Simulated time</span>':''}</div>
        </div>
        <div class="m-top-r">
          <div class="m-demo">
            <button class="btn sm" data-act="demo-toggle" aria-expanded="${M.demoOpen}">${ic('sliders')} <span class="hide-sm">Demo</span></button>
            ${M.demoOpen ? `<div class="m-pop">
              <div class="label" style="margin-bottom:8px">Simulated clock</div>
              <div class="demo-row">
                <button class="chip-btn" data-act="ff" data-v="15">+15 min</button>
                <button class="chip-btn" data-act="ff" data-v="60">+1 hr</button>
                <button class="chip-btn" data-act="ff" data-v="240">+4 hrs</button>
                <button class="chip-btn" data-act="ff" data-v="0">Real time</button>
              </div>
              <div class="label" style="margin:14px 0 8px">Sample data</div>
              <button class="chip-btn" data-act="reset">Reset demo data</button>
              <p class="small faint" style="margin-top:10px">Shared live with the crew app on any phone or tab. Changes sync within a couple of seconds.</p>
            </div>` : ''}
          </div>
          <div class="m-me">${ic('shield')}<span class="hide-sm">${esc(MGR())}</span></div>
        </div>
      </header>
      <div class="m-body" id="mbody">
        ${stale ? `<div class="alert info" style="margin-bottom:16px">${ic('info')}<div>Sample schedules were created on ${fDate(D().seedDay)}. <button class="link" data-act="reset">Refresh sample data to today</button> to get a fresh demo (this clears changes).</div></div>` : ''}
        ${pageFn()}
      </div>
    </main>
  </div>`;
}

function renderLogin(){
  return `
  <div class="m-login">
    <div class="m-login-card">
      <span class="proto-tag">Prototype · sample data</span>
      <div class="hero-word" style="margin:22px 0 6px">Boss<br>Crew<br><span>Manager</span></div>
      <p class="muted small" style="margin-bottom:18px">Run every CJ&rsquo;s Wings venue from one screen: live headcount, approvals, timesheets, schedules, crew, geofences and payroll.</p>
      <div class="label" style="text-align:center">Manager PIN</div>
      <div class="pin-dots ${M.pinErr?'shake':''}" aria-label="${M.pin.length} of 4 digits entered">${[0,1,2,3].map(i=>`<i class="${i<M.pin.length?'f':''}"></i>`).join('')}</div>
      ${M.pinErr ? `<div class="small" style="color:var(--bad);margin:-8px 0 12px;text-align:center">That PIN didn&rsquo;t match.</div>` : ''}
      <div class="keypad">
        ${[1,2,3,4,5,6,7,8,9].map(n=>`<button class="key" data-act="key" data-v="${n}">${n}</button>`).join('')}
        <button class="key fn" data-act="key" data-v="clr">Clear</button>
        <button class="key" data-act="key" data-v="0">0</button>
        <button class="key fn" data-act="key" data-v="del">Delete</button>
      </div>
      <p class="small faint" style="margin-top:16px;text-align:center">Demo manager PIN: <b class="num" style="color:var(--muted)">${esc(ST().managerPin)}</b></p>
      <a class="link" href="index.html" style="display:block;text-align:center;margin-top:10px">← Back to the crew app</a>
    </div>
  </div>`;
}

/* ---------- Live board ---------- */
function pLive(){
  const live = livePunches();
  const onBreak = live.filter(p => (p.breaks||[]).some(b=>!b.end));
  const today = todaysShifts();
  const late = today.filter(s => ['late','noshow'].includes(shiftStatus(s).k));
  const t0 = startOfDay(now());
  const todayCost = D().punches.filter(p => !p.voided && p.inT >= t0).reduce((a,p)=>a+laborCost(p),0);
  const venues = D().venues.filter(venueActive);
  return `
  <div class="kpi-row">
    ${kpi(live.length, 'On the clock', live.length?'ok':'')}
    ${kpi(onBreak.length, 'On break', onBreak.length?'warn':'')}
    ${kpi(`${today.filter(s=>shiftStatus(s).k!=='up').length}/${today.length}`, 'Shifts started today')}
    ${kpi(late.length, 'Late or no-show', late.length?'bad':'')}
    ${kpi(money(todayCost), 'Labor so far today')}
    ${kpi(approvalsCount(), 'Waiting on you', approvalsCount()?'warn':'', 'approvals')}
  </div>

  <div class="m-sec-h"><h2>On the clock now</h2><button class="btn sm primary" data-act="clockin-open">${ic('plus')} Clock someone in</button></div>
  ${live.length ? `<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Crew</th><th>Venue</th><th>Since</th><th class="r">Worked</th><th>Breaks</th><th>Flags</th><th class="r">Cost</th><th class="r">Actions</th></tr></thead>
    <tbody>${live.map(p => { const e = emp(p.emp), v = venue(p.venue), b = breakInfo(p);
      const long = b.worked > ST().autoClockOutHrs*HR;
      return `<tr>
        <td><div class="row">${avatar(e)}<div><div class="title" style="font-size:14px">${esc(e?.name)}</div><div class="meta">${esc(p.role)} · ${money(p.rate)}/hr</div></div></div></td>
        <td><div class="row" style="gap:8px"><span class="vt sm">${vIcon(v)}</span><span>${esc(v.name)}</span></div></td>
        <td class="num">${fTime(p.inT)}<div class="meta">${esc(p.inLoc?.method||'')}</div></td>
        <td class="r num" style="font-weight:700" data-t="worked" data-id="${p.id}">${fDur(b.worked)}</td>
        <td>${(() => { const bs = CC.breakStatus(p); return bs.alert ? badge(`${esc(bs.alert.label)} ${bs.alert.status==='overdue'?'overdue':'due'}`,'bad')+' ' : bs.soon ? badge(`${esc(bs.soon.label)} soon`,'warn')+' ' : ''; })()}${b.open ? badge(b.open.type==='meal'?`On meal ${fHM(now()-b.open.start)}`:`On rest ${fHM(now()-b.open.start)}`,'warn') : badge(b.meal.t, b.meal.cls)}${b.ot?' '+badge('Overtime','warn'):''}</td>
        <td>${[...(p.flags||[]).map(f=>badge(esc(f),'warn')), p.exception==='pending'?badge('Exception','warn'):'', long?badge(`Over ${ST().autoClockOutHrs} hrs`,'bad'):''].join(' ') || '<span class="faint small">None</span>'}</td>
        <td class="r num">${money(laborCost(p))}</td>
        <td class="r"><div class="row" style="justify-content:flex-end;gap:6px;flex-wrap:wrap">
          ${b.open ? `<button class="btn sm" data-act="end-break" data-v="${p.id}">End break</button>` : ''}
          <button class="btn sm" data-act="note-open" data-v="${p.id}" title="Send a note">${ic('mega')}</button>
          <button class="btn sm" data-act="punch-edit" data-v="${p.id}" title="Edit">${ic('edit')}</button>
          <button class="btn sm primary" data-act="clockout-open" data-v="${p.id}">Clock out</button>
        </div></td>
      </tr>`; }).join('')}</tbody></table></div>`
  : empty('Nobody is on the clock right now.', 'Clock-ins from the crew app appear here instantly.')}

  <div class="m-grid2">
    <section>
      <div class="m-sec-h"><h2>Today&rsquo;s schedule</h2><button class="link" data-act="page" data-v="schedule">Edit schedule</button></div>
      <div class="list">${today.map(s => { const e = emp(s.emp), v = venue(s.venue), st = shiftStatus(s); return `
        <div class="li">${avatar(e,32)}<div class="grow"><div class="title" style="font-size:14px">${esc(e?.name||'Unknown')}</div><div class="meta">${fTime(s.startT)}–${fTime(s.endT)} · ${esc(s.role)} · ${esc(v.name)}</div></div>${badge(st.label, st.cls)}
        ${st.k==='late'||st.k==='noshow' ? `<button class="btn sm" data-act="clockin-open" data-v="${s.emp}" data-shift="${s.id}" title="Clock in for them">${ic('clock')}</button>` : ''}</div>`; }).join('') || '<div class="li small muted">No shifts scheduled today.</div>'}</div>
    </section>
    <section>
      <div class="m-sec-h"><h2>Headcount by venue</h2></div>
      <div class="list">${venues.map(v => { const n = live.filter(p=>p.venue===v.id); const sch = today.filter(s=>s.venue===v.id).length; return `
        <div class="li"><span class="vt sm">${vIcon(v)}</span><div class="grow"><div class="title" style="font-size:14px">${esc(v.name)}</div><div class="meta">${n.map(p=>esc(emp(p.emp)?.name.split(' ')[0])).join(', ') || 'Nobody on site'} · ${sch} scheduled today</div></div><div class="big-n ${n.length?'':'faint'}">${n.length}</div></div>`; }).join('')}</div>
    </section>
  </div>`;
}
const kpi = (v, k, cls='', go='') => `<${go?'button data-act="page" data-v="'+go+'"':'div'} class="kpi m-kpi ${cls}"><div class="v num">${v}</div><div class="k">${k}</div></${go?'button':'div'}>`;
const empty = (t, s='') => `<div class="m-empty">${ic('info')}<div><div class="title" style="font-size:15px">${t}</div>${s?`<div class="small muted">${s}</div>`:''}</div></div>`;

/* ---------- Approvals ---------- */
function pApprovals(){
  const reqs = pendingReqs();
  const flagged = flaggedPunches();
  const kinds = [['all','All'],['Clock-in exception','Exceptions'],['Punch correction','Corrections'],['Missed punch','Missed punches'],['Open shift','Open shifts'],['Time off','Time off'],['Shift swap','Swaps'],['Shift release','Drops'],['Early pay','Early pay'],['flagged','Flagged punches']];
  const countOf = k => k==='all' ? reqs.length + flagged.length : k==='flagged' ? flagged.length : reqs.filter(r=>r.kind===k).length;
  const showReqs = M.apFilter==='all' ? reqs : M.apFilter==='flagged' ? [] : reqs.filter(r=>r.kind===M.apFilter);
  const showFlag = M.apFilter==='all' || M.apFilter==='flagged' ? flagged : [];
  const resolved = D().requests.filter(r => r.status !== 'Pending').sort((a,b)=>(b.resolvedT||0)-(a.resolvedT||0)).slice(0,12);
  return `
  <div class="chips">${kinds.map(([k,l]) => `<button class="chip ${M.apFilter===k?'on':''}" data-act="ap-filter" data-v="${k}">${l}<b>${countOf(k)}</b></button>`).join('')}</div>
  ${showReqs.length || showFlag.length ? '' : empty('You&rsquo;re all caught up.', 'New requests from the crew app land here.')}
  <div class="cards">
    ${showReqs.sort((a,b)=>a.t-b.t).map(reqCard).join('')}
    ${showFlag.map(flagCard).join('')}
  </div>
  ${M.apFilter==='all' && resolved.length ? `<div class="m-sec-h"><h2>Recently resolved</h2></div>
  <div class="list">${resolved.map(r => { const e = emp(r.emp); return `<div class="li">${avatar(e,30)}<div class="grow"><div class="title" style="font-size:14px">${esc(r.kind)} · ${esc(e?.name)}</div><div class="meta">${esc(r.detail)}${r.mgrNote?` · Note: ${esc(r.mgrNote)}`:''}</div></div>${badge(r.status, r.status==='Approved'?'ok':'bad')}<span class="meta num hide-sm">${r.resolvedT?fDate(r.resolvedT):''}</span></div>`; }).join('')}</div>` : ''}`;
}
function reqCard(r){
  const e = emp(r.emp); const p = r.punchId && D().punches.find(x=>x.id===r.punchId);
  let ctx = '', actions = '';
  const deny = `<button class="btn sm" data-act="req-deny" data-v="${r.id}">Deny</button>`;
  if (r.kind === 'Clock-in exception'){
    ctx = p ? `<div class="meta">Punch ${esc(p.id)} · ${fDate(p.inT)} ${fTime(p.inT)} at ${esc(venue(p.venue).name)}${p.outT?` – ${fTime(p.outT)}`:' · still on the clock'}</div>` : '';
    actions = `${deny}<button class="btn sm primary" data-act="req-approve" data-v="${r.id}">${ic('check')} Approve</button>`;
  } else if (r.kind === 'Punch correction'){
    ctx = p ? `<div class="meta">Current record: ${fDate(p.inT)} · ${fTime(p.inT)} – ${p.outT?fTime(p.outT):'now'} · ${fHrs(workedMs(p)/HR)} hrs at ${esc(venue(p.venue).name)}</div>` : '';
    actions = `${deny}<button class="btn sm primary" data-act="req-fix" data-v="${r.id}">${ic('edit')} Edit &amp; approve</button>`;
  } else if (r.kind === 'Missed punch'){
    actions = `${deny}<button class="btn sm primary" data-act="req-fix" data-v="${r.id}">${ic('edit')} Fix punch &amp; approve</button>`;
  } else if (r.kind === 'Open shift'){
    const o = D().openShifts.find(x=>x.id===r.ref);
    ctx = o ? `<div class="meta">${o.spots ?? 1} spot${(o.spots??1)===1?'':'s'} left · ${esc(o.note||'')}</div>` : `<div class="meta" style="color:var(--bad)">This open shift was removed or filled.</div>`;
    actions = `${deny}<button class="btn sm primary" data-act="req-approve" data-v="${r.id}" ${o&&(o.spots??1)>0?'':'disabled'}>${ic('check')} Assign shift</button>`;
  } else if (r.kind === 'Time off'){
    const d = r.payload?.date; const t0 = d ? new Date(d+'T00:00').getTime() : 0;
    const conflicts = D().shifts.filter(s => s.emp===r.emp && s.startT >= t0 && s.startT < t0+DAY);
    ctx = conflicts.length ? `<div class="meta" style="color:var(--warn)">Has ${conflicts.length} shift${conflicts.length>1?'s':''} that day. Approving turns ${conflicts.length>1?'them':'it'} into open shift${conflicts.length>1?'s':''}.</div>` : `<div class="meta">No shifts that day.</div>`;
    actions = `${deny}<button class="btn sm primary" data-act="req-approve" data-v="${r.id}">${ic('check')} Approve</button>`;
  } else if (EXT.req[r.kind]){
    const x = EXT.req[r.kind](r); ctx = x.ctx || ''; actions = x.actions || `${deny}<button class="btn sm primary" data-act="req-approve" data-v="${r.id}">${ic('check')} Approve</button>`;
  } else {
    actions = `${deny}<button class="btn sm primary" data-act="req-approve" data-v="${r.id}">${ic('check')} Approve</button>`;
  }
  return `<article class="req">
    <div class="row between"><div class="row">${avatar(e)}<div><div class="title" style="font-size:14.5px">${esc(e?.name||'Unknown')}</div><div class="meta">${fDate(r.t)} · ${fTime(r.t)}</div></div></div>${badge(esc(r.kind), r.kind==='Clock-in exception'||r.kind==='Missed punch'?'warn':'info')}</div>
    <p class="req-d">${esc(r.detail)}</p>${ctx}
    <input class="input sm" id="note-${r.id}" placeholder="Note to ${esc(e?.name.split(' ')[0]||'employee')} (optional)">
    <div class="row" style="justify-content:flex-end;gap:8px;margin-top:10px">${actions}</div>
  </article>`;
}
function flagCard(p){
  const e = emp(p.emp), v = venue(p.venue);
  const iss = [...(p.flags||[]), p.attest==='missed' ? 'Missed break (premium owed)' : ''].filter(Boolean);
  return `<article class="req">
    <div class="row between"><div class="row">${avatar(e)}<div><div class="title" style="font-size:14.5px">${esc(e?.name)}</div><div class="meta">${fDate(p.inT)} · ${fTime(p.inT)} – ${fTime(p.outT)} · ${fHrs(workedMs(p)/HR)} hrs</div></div></div>${badge('Flagged punch','warn')}</div>
    <p class="req-d">${esc(v.name)} · ${esc(p.role)}</p>
    <div class="row" style="gap:6px;flex-wrap:wrap">${iss.map(i=>badge(esc(i),'warn')).join('')}</div>
    <div class="row" style="justify-content:flex-end;gap:8px;margin-top:12px">
      <button class="btn sm" data-act="punch-edit" data-v="${p.id}">${ic('edit')} Edit</button>
      <button class="btn sm primary" data-act="flag-ok" data-v="${p.id}">${ic('check')} Mark reviewed</button>
    </div>
  </article>`;
}

/* ---------- Timesheets ---------- */
function periodNav(){
  const ps = curPs(), pe = ps + CC.periodLen() - DAY;
  return `<div class="pnav">
    <button class="icon-btn" data-act="ps" data-v="-1" aria-label="Previous period">${ic('chevL')}</button>
    <div><div class="label">Pay period</div><div class="title num">${fShort(ps)} – ${fShort(pe)}</div></div>
    <button class="icon-btn" data-act="ps" data-v="1" aria-label="Next period">${ic('chev')}</button>
    ${M.ps!==null && M.ps!==CC.periodStart() ? `<button class="link" data-act="ps" data-v="0">Current</button>` : ''}
    ${isClosed(ps) ? badge(`${ic('lock','" style="width:11px;height:11px')} Closed`, 'bad') : badge('Open','ok')}
  </div>`;
}
function pTimesheets(){
  const ps = curPs(), pe = ps + CC.periodLen(), closed = isClosed(ps);
  const emps = D().employees;
  let rows = D().punches.filter(p => !p.voided && p.inT >= ps && p.inT < pe && (M.tsEmp==='all' || p.emp===M.tsEmp));
  if (M.tsIssues) rows = rows.filter(p => punchIssues(p).length);
  rows.sort((a,b)=>b.inT-a.inT);
  const showEmps = M.tsEmp==='all' ? emps.filter(e => e.active!==false || D().punches.some(p=>p.emp===e.id && p.inT>=ps && p.inT<pe)) : emps.filter(e=>e.id===M.tsEmp);
  return `
  <div class="toolbar">
    ${periodNav()}
    <div class="row" style="gap:8px;flex-wrap:wrap">
      <select class="input sm" data-act-change="ts-emp" aria-label="Employee"><option value="all">All crew</option>${emps.map(e=>`<option value="${e.id}" ${M.tsEmp===e.id?'selected':''}>${esc(e.name)}</option>`).join('')}</select>
      <label class="toggle"><input type="checkbox" data-act-change="ts-issues" ${M.tsIssues?'checked':''}><span>Only issues</span></label>
      <button class="btn sm primary" data-act="punch-new" ${closed?'disabled':''}>${ic('plus')} Add punch</button>
    </div>
  </div>
  ${closed ? `<div class="alert bad" style="margin-bottom:14px">${ic('lock')}<div><b>This period is closed for payroll.</b> Reopen it on the Payroll page to make changes.</div></div>` : ''}
  <div class="emp-sum">${showEmps.map(e => { const s = CC.summary(e.id, ps); const ap = (D().approvals[ps]||{})[e.id]; const iss = s.entries.filter(p=>punchIssues(p).length).length; return `
    <div class="es">
      <div class="row">${avatar(e)}<div class="grow"><div class="title" style="font-size:14.5px">${esc(e.name)}</div><div class="meta">${s.rows.length} days · ${fHrs(s.hours)} hrs${s.ot+s.dt?` · ${fHrs(s.ot+s.dt)} OT`:''}</div></div></div>
      <div class="row between" style="margin-top:10px"><div class="num" style="font-weight:700;font-size:18px">${money(s.gross)}</div>
      ${ap ? badge('Approved','ok') : iss ? badge(`${iss} issue${iss>1?'s':''}`,'warn') : ''}</div>
      <div style="margin-top:10px">${ap ? `<button class="btn sm" data-act="ts-unapprove" data-v="${e.id}" ${closed?'disabled':''}>Undo approval</button>` : `<button class="btn sm primary" data-act="ts-approve" data-v="${e.id}" ${closed||!s.rows.length?'disabled':''}>${ic('check')} Approve timesheet</button>`}</div>
    </div>`; }).join('')}</div>
  <div class="m-sec-h"><h2>Punches</h2><span class="small faint">${rows.length} record${rows.length===1?'':'s'}</span></div>
  ${rows.length ? `<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Date</th><th>Crew</th><th>Venue · role</th><th>In</th><th>Out</th><th>vs schedule</th><th>Breaks</th><th class="r">Hours</th><th class="r">Tips</th><th>Status</th><th class="r"></th></tr></thead>
    <tbody>${rows.map(p => { const e = emp(p.emp), v = venue(p.venue), iss = punchIssues(p);
      const meals = (p.breaks||[]).filter(b=>b.type==='meal'), rests = (p.breaks||[]).filter(b=>b.type==='rest');
      return `<tr>
      <td class="num">${fDate(p.inT)}</td>
      <td><div class="row" style="gap:8px">${avatar(e,28)}<span>${esc(e?.name)}</span></div></td>
      <td>${esc(v.name)}<div class="meta">${esc(p.role)} · ${money(p.rate)}</div></td>
      <td class="num">${fTime(p.inT)}</td>
      <td class="num">${p.outT ? fTime(p.outT) : badge('Live','ok')}</td>
      <td class="small">${schedVar(p)}</td>
      <td class="small">${meals.length}M · ${rests.length}R${meals.length?`<div class="meta">${fHM(meals.reduce((a,m)=>a+((m.end??now())-m.start),0))} meal</div>`:''}</td>
      <td class="r num" style="font-weight:700">${fHrs(workedMs(p)/HR)}</td>
      <td class="r num">${money((p.tipsCash||0)+(p.tipsCard||0))}</td>
      <td>${iss.length ? iss.slice(0,2).map(i=>badge(esc(i),'warn')).join(' ') + (iss.length>2?` <span class="faint small">+${iss.length-2}</span>`:'') : p.edited ? badge('Edited','info') : p.exception==='approved' ? badge('Exception OK','ok') : '<span class="faint small">OK</span>'}</td>
      <td class="r"><div class="row" style="justify-content:flex-end;gap:6px">
        <button class="btn sm" data-act="punch-edit" data-v="${p.id}" ${closed?'disabled':''} aria-label="Edit punch">${ic('edit')}</button>
        <button class="btn sm" data-act="punch-del" data-v="${p.id}" ${closed?'disabled':''} aria-label="Delete punch">${ic('trash')}</button>
      </div></td></tr>`; }).join('')}</tbody></table></div>` : empty('No punches match.', 'Try another employee, period or filter.')}`;
}

function schedVar(p){
  const s = CC.shiftFor(p); if (!s) return '<span class="faint">Unscheduled</span>';
  const fmt = ms => { const m = Math.round(ms/MIN); return m === 0 ? 'on time' : (m > 0 ? '+' : '−') + fHM(Math.abs(ms)); };
  const din = p.inT - s.startT, dout = (p.outT ?? now()) - s.endT;
  const sched = (s.endT - s.startT)/HR, act = workedMs(p)/HR, diff = act - sched;
  const cls = Math.abs(diff) > 0.5 ? 'color:var(--warn)' : '';
  return `<div class="num">${fTime(s.startT).replace(':00','')}–${fTime(s.endT).replace(':00','')}</div><div class="meta">In ${fmt(din)}${p.outT?` · out ${fmt(dout)}`:''}</div><div class="meta num" style="${cls}">${diff>=0?'+':'−'}${Math.abs(diff).toFixed(2)} h vs plan</div>`;
}

/* ---------- Schedule ---------- */
function pSchedule(){
  const ws = weekStart(M.weekOff), days = [...Array(7)].map((_,i)=>ws+i*DAY), t0 = startOfDay(now());
  const emps = activeEmps();
  const inWeek = s => s.startT >= ws && s.startT < ws+7*DAY;
  const cell = (list, empId, d) => {
    const items = list.filter(s => s.startT >= d && s.startT < d+DAY).sort((a,b)=>a.startT-b.startT);
    return `<td class="sc ${d===t0?'today':''}">${items.map(s => { const v = venue(s.venue); return `
      <button class="shift-chip ${empId==='open'?'open':''}" data-act="${empId==='open'?'open-edit':'shift-edit'}" data-v="${s.id}" style="${empId!=='open'?`border-left-color:${emp(s.emp)?.color||'var(--line)'}`:''}">
        <b class="num">${fTime(s.startT).replace(':00','')}–${fTime(s.endT).replace(':00','')}</b><span>${esc(s.role)}</span><span class="faint">${esc(v.name.split(' ·')[0])}</span>${empId==='open'?`<span class="badge warn" style="margin-top:3px">${s.spots??1} open</span>`:''}${EXT.chip ? EXT.chip(s, empId==='open') : ''}
      </button>`; }).join('')}${EXT.cell && empId!=='open' ? EXT.cell(empId, d, items) : ''}
      <button class="add-cell" data-act="${empId==='open'?'open-new':'shift-new'}" data-v="${empId}" data-d="${d}" aria-label="Add shift">${ic('plus')}</button></td>`;
  };
  const weekHrs = id => D().shifts.filter(s=>s.emp===id && inWeek(s)).reduce((a,s)=>a+(s.endT-s.startT)/HR,0);
  const weekCost = D().shifts.filter(inWeek).reduce((a,s)=>{ const e = emp(s.emp); const r = e?.roles.find(x=>x.role===s.role)?.rate ?? e?.roles[0]?.rate ?? 0; return a + (s.endT-s.startT)/HR*r; },0);
  return `
  <div class="toolbar">
    <div class="pnav">
      <button class="icon-btn" data-act="wk" data-v="-1" aria-label="Previous week">${ic('chevL')}</button>
      <div><div class="label">Week of</div><div class="title num">${fShort(ws)} – ${fShort(ws+6*DAY)}</div></div>
      <button class="icon-btn" data-act="wk" data-v="1" aria-label="Next week">${ic('chev')}</button>
      ${M.weekOff ? `<button class="link" data-act="wk" data-v="0">This week</button>` : ''}
    </div>
    <div class="row" style="gap:8px;flex-wrap:wrap">
      <span class="small muted">Scheduled labor: <b class="num" style="color:var(--text)">${money(weekCost)}</b></span>
      ${EXT.schedTools ? EXT.schedTools(ws) : ''}
      <button class="btn sm" data-act="copy-week">Copy last week</button>
      <button class="btn sm" data-act="open-new" data-v="open" data-d="${Math.max(ws,t0)}">${ic('plus')} Open shift</button>
      <button class="btn sm primary" data-act="shift-new" data-v="" data-d="${Math.max(ws,t0)}">${ic('plus')} Add shift</button>
    </div>
  </div>
  <div class="tbl-wrap"><table class="sched">
    <thead><tr><th class="sc-h">Crew</th>${days.map(d=>`<th class="${d===t0?'today':''}"><div class="label" style="font-size:10.5px">${new Date(d).toLocaleDateString('en-US',{weekday:'short'})}</div><div class="num" style="font-family:var(--display);font-size:22px;font-weight:800">${new Date(d).getDate()}</div></th>`).join('')}</tr></thead>
    <tbody>
      ${emps.map(e => `<tr><th class="sc-h"><div class="row" style="gap:8px">${avatar(e,30)}<div><div style="font-size:13.5px;font-weight:700">${esc(e.name)}</div><div class="meta num">${fHrs(weekHrs(e.id))} hrs</div></div></div></th>
        ${days.map(d => cell(D().shifts.filter(s=>s.emp===e.id), e.id, d)).join('')}</tr>`).join('')}
      <tr class="open-row"><th class="sc-h"><div style="font-size:13.5px;font-weight:700">Open shifts</div><div class="meta">Crew can request</div></th>
        ${days.map(d => cell(D().openShifts.filter(o=>(o.spots??1)>0), 'open', d)).join('')}</tr>
    </tbody></table></div>
  ${EXT.schedBelow ? EXT.schedBelow(ws, days) : ''}
  <p class="small faint" style="margin-top:10px">Tap a shift to edit, move or delete it. Changes show in each employee&rsquo;s Schedule tab right away.</p>`;
}

/* ---------- Crew ---------- */
function pCrew(){
  const ps = CC.periodStart();
  const q = M.crewQ.toLowerCase();
  const list = D().employees.filter(e => !q || e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q) || e.roles.some(r=>r.role.toLowerCase().includes(q)));
  return `
  <div class="toolbar">
    <div class="search">${ic('search')}<input class="input sm" placeholder="Search name, ID or role" value="${esc(M.crewQ)}" data-act-input="crew-q" aria-label="Search crew"></div>
    <button class="btn sm primary" data-act="emp-new">${ic('plus')} Add crew member</button>
  </div>
  <div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Name</th><th>Roles · rates</th><th>Home venue</th><th>PIN</th><th class="r">Hours this period</th><th>Status</th><th class="r"></th></tr></thead>
    <tbody>${list.map(e => { const s = CC.summary(e.id, ps); const live = CC.liveFor(e.id); return `<tr class="${e.active===false?'dim':''}">
      <td><div class="row">${avatar(e)}<div><div class="title" style="font-size:14px">${esc(e.name)}</div><div class="meta">${esc(e.id)}${e.phone?` · ${esc(e.phone)}`:''}</div></div></div></td>
      <td>${e.roles.map(r=>`<div class="small">${esc(r.role)} <span class="num muted">${money(r.rate)}</span></div>`).join('')}</td>
      <td class="small">${esc(venue(e.home).name)}</td>
      <td class="num mono">${'•'.repeat(e.pin.length)}</td>
      <td class="r num">${fHrs(s.hours)}</td>
      <td>${e.active===false ? badge('Inactive') : live ? badge('On the clock','ok') : badge('Active','info')}</td>
      <td class="r"><button class="btn sm" data-act="emp-edit" data-v="${e.id}">${ic('edit')} Edit</button></td>
    </tr>`; }).join('') || `<tr><td colspan="7" class="muted small">No crew match “${esc(M.crewQ)}”.</td></tr>`}</tbody></table></div>`;
}

/* ---------- Venues ---------- */
function pVenues(){
  return `
  <div class="toolbar"><p class="small muted" style="max-width:560px">Each venue is a geofence: a center point and a radius. Crew can only clock in inside an active venue&rsquo;s fence.</p>
    <button class="btn sm primary" data-act="venue-new">${ic('plus')} Add venue</button></div>
  <div class="cards">${D().venues.map(v => { const t = VTYPE[v.type]||VTYPE.fixed; const on = venueActive(v); const live = livePunches().filter(p=>p.venue===v.id).length; return `
    <article class="req venue-card ${on?'':'dim'}">
      <div class="row between"><div class="row"><span class="vt">${ic(t.icon)}</span><div><div class="title" style="font-size:15px">${esc(v.name)}</div><div class="meta">${t.label} · ${v.r} m fence</div></div></div>
        ${on ? badge('Active','ok') : badge(v.active===false?'Turned off':'Outside dates')}</div>
      <p class="req-d">${esc(v.addr)}</p>
      <div class="meta mono">${Number(v.lat).toFixed(5)}, ${Number(v.lng).toFixed(5)}</div>
      ${v.window&&v.window[0] ? `<div class="meta" style="margin-top:4px">Runs ${fShort(new Date(v.window[0]+'T12:00'))} – ${fShort(new Date(v.window[1]+'T12:00'))}</div>` : ''}
      ${v.note ? `<div class="meta" style="margin-top:4px">${esc(v.note)}</div>` : ''}
      <div class="row between" style="margin-top:12px"><span class="small muted">${live} on site now</span>
        <div class="row" style="gap:6px"><a class="btn sm" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${v.lat},${v.lng}">${ic('pin')} Map</a>
        <button class="btn sm" data-act="venue-edit" data-v="${v.id}">${ic('edit')} Edit</button></div></div>
    </article>`; }).join('')}</div>`;
}

/* ---------- Payroll ---------- */
function pPayroll(){
  const ps = curPs(), pe = ps + CC.periodLen(), closed = isClosed(ps);
  const emps = D().employees.filter(e => e.active!==false || D().punches.some(p=>p.emp===e.id && p.inT>=ps && p.inT<pe));
  const sums = emps.map(e => ({e, s:CC.summary(e.id, ps), ap:(D().approvals[ps]||{})[e.id]}));
  const T = k => sums.reduce((a,x)=>a+x.s[k],0);
  const allAp = sums.filter(x=>x.s.rows.length).every(x=>x.ap);
  const live = sums.some(x=>x.s.entries.some(p=>!p.outT));
  const byVenue = {};
  D().punches.filter(p=>!p.voided && p.inT>=ps && p.inT<pe).forEach(p => { const k = p.venue; byVenue[k] ||= {h:0,c:0}; byVenue[k].h += workedMs(p)/HR; byVenue[k].c += laborCost(p); });
  const maxC = Math.max(1, ...Object.values(byVenue).map(x=>x.c));
  return `
  <div class="toolbar">${periodNav()}
    <div class="row" style="gap:8px;flex-wrap:wrap">
      <button class="btn sm primary" data-act="export-open">${ic('download')} Export for payroll</button>
      <button class="btn sm" data-act="csv" data-v="summary">${ic('download')} Summary CSV</button>
      <button class="btn sm" data-act="csv" data-v="detail">${ic('download')} Punch detail CSV</button>
      ${closed ? `<button class="btn sm" data-act="period-reopen">Reopen period</button>` : `<button class="btn sm" data-act="ap-all">${ic('check')} Approve all</button><button class="btn sm primary" data-act="period-close">${ic('lock')} Close period</button>`}
    </div></div>
  ${!closed && !allAp ? `<div class="alert warn" style="margin-bottom:14px">${ic('alert')}<div>Some timesheets aren&rsquo;t approved yet. Approve them before closing the period.</div></div>` : ''}
  ${live && !closed ? `<div class="alert info" style="margin-bottom:14px">${ic('info')}<div>Someone is still on the clock this period. Their totals include the live shift.</div></div>` : ''}
  <div class="kpi-row">
    ${kpi(money(T('gross')), 'Gross wages')}
    ${kpi(money(T('tips')), 'Tips')}
    ${kpi(fHrs(T('hours')), 'Total hours')}
    ${kpi(fHrs(T('ot')+T('dt')), 'Overtime hours', T('ot')+T('dt')?'warn':'')}
    ${kpi(money(T('prem')), 'Break premiums', T('prem')?'bad':'')}
  </div>
  <div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Crew</th><th class="r">Reg hrs</th><th class="r">OT ${ST().otMult}×</th><th class="r">DT ${ST().dtMult}×</th><th class="r">Reg pay</th><th class="r">OT pay</th><th class="r">DT pay</th><th class="r">Premiums</th><th class="r">Tips</th><th class="r">Gross</th><th class="r">Early pay</th><th>Status</th></tr></thead>
    <tbody>${sums.map(({e,s,ap}) => `<tr>
      <td><div class="row" style="gap:8px">${avatar(e,28)}<span>${esc(e.name)}</span></div></td>
      <td class="r num">${fHrs(s.reg)}</td><td class="r num">${fHrs(s.ot)}</td><td class="r num">${fHrs(s.dt)}</td>
      <td class="r num">${money(s.regPay)}</td><td class="r num">${money(s.otPay)}</td><td class="r num">${money(s.dtPay)}</td>
      <td class="r num">${money(s.prem + s.lateChg)}${s.lateChg?`<div class="meta">incl. ${money(s.lateChg)} schedule-change pay</div>`:''}</td><td class="r num">${money(s.tips)}${s.pool?`<div class="meta">${money(s.pool)} from pool</div>`:''}</td><td class="r num" style="font-weight:700">${money(s.gross)}</td><td class="r num">${s.adv?`−${money(s.adv)}`:'<span class="faint">—</span>'}</td>
      <td>${ap ? badge('Approved','ok') : s.rows.length ? `<button class="btn sm" data-act="ts-approve" data-v="${e.id}" ${closed?'disabled':''}>Approve</button>` : '<span class="faint small">No hours</span>'}</td></tr>`).join('')}
      <tr class="tot"><td>Total</td><td class="r num">${fHrs(T('reg'))}</td><td class="r num">${fHrs(T('ot'))}</td><td class="r num">${fHrs(T('dt'))}</td><td class="r num">${money(T('regPay'))}</td><td class="r num">${money(T('otPay'))}</td><td class="r num">${money(T('dtPay'))}</td><td class="r num">${money(T('prem')+T('lateChg'))}</td><td class="r num">${money(T('tips'))}</td><td class="r num">${money(T('gross'))}</td><td class="r num">${T('adv')?`−${money(T('adv'))}`:''}</td><td></td></tr>
    </tbody></table></div>
  <div class="m-sec-h"><h2>Labor by venue</h2></div>
  <div class="card">${Object.entries(byVenue).sort((a,b)=>b[1].c-a[1].c).map(([id,x]) => `<div class="bar-row"><div class="bar-l">${esc(venue(id).name)}</div><div class="bar"><i style="width:${(x.c/maxC*100).toFixed(1)}%"></i></div><div class="bar-v num">${money(x.c)} <span class="faint">· ${fHrs(x.h)} h</span></div></div>`).join('') || '<div class="small muted">No hours this period.</div>'}</div>
  <p class="small faint" style="margin-top:12px">Pay rules: daily OT after ${ST().otDaily} hrs, double time after ${ST().dtDaily}, weekly OT after ${ST().otWeekly}. Change them on the Rules page. Estimates for review; confirm with your payroll provider.</p>`;
}

/* ---------- Announcements ---------- */
/* ---------- NFC stickers ---------- */
function pNfc(){
  const tags = D().nfcTags || [], devs = Object.entries(D().devices || {});
  const canWrite = 'NDEFReader' in window;
  const venues = D().venues;
  const groups = venues.map(v => [v, tags.filter(t => t.venue === v.id)]).filter(([v, ts]) => ts.length || venueActive(v));
  return `
  <div class="card nfc-how">
    <div class="row" style="gap:14px;align-items:flex-start">${ic('nfc')}<div>
      <div class="title" style="font-size:15px">How stickers work</div>
      <div class="small muted">Each sticker holds a link to the crew app with its own code. Crew hold their phone to it (iPhone XS or newer, most Android phones, no app needed). The first tap asks for name and PIN and remembers that phone; after that one tap clocks in, opens the break menu, ends a break or clocks out. Taps count as on-site, so no GPS check is needed.</div>
      ${ST().allowNfc ? '' : `<div class="alert bad" style="margin-top:10px">NFC clock-in is turned off in Rules. Taps will be refused.</div>`}
      <div class="small faint" style="margin-top:6px">Links point to <span class="mono">${esc(CC.crewAppBase())}</span>${ST().crewAppUrl ? '' : ' (this app&rsquo;s current address; set a permanent one in Rules once the app is published)'}.</div>
    </div></div>
  </div>
  <div class="m-sec-h"><h2>Stickers</h2><div class="row" style="gap:8px"><a class="btn sm" href="labels.html" target="_blank" rel="noopener">${ic('sheet')} Print labels</a><button class="btn sm primary" data-act="tag-new">${ic('plus')} Add a sticker</button></div></div>
  ${groups.map(([v, ts]) => `
    <div class="label" style="margin:14px 0 8px">${esc(v.name)}</div>
    <div class="list">${ts.map(t => { const url = CC.tagUrl(t), le = t.lastEmp && emp(t.lastEmp); return `
      <div class="li nfc-li ${t.active===false?'off':''}">
        <span class="vt sm">${ic('nfc')}</span>
        <div class="grow" style="min-width:0">
          <div class="title" style="font-size:14px">${esc(t.label)} ${t.active===false ? badge('Off','') : badge('Active','ok')}</div>
          <div class="meta mono">${esc(url)}</div>
          <div class="meta">${t.taps||0} taps${t.lastTapT ? ` · last ${fDate(t.lastTapT)} ${fTime(t.lastTapT)}${le ? ' by ' + esc(le.name) : ''}` : ' · not tapped yet'}</div>
        </div>
        <div class="row" style="gap:6px;flex-wrap:wrap;justify-content:flex-end">
          <button class="btn sm" data-act="tag-copy" data-v="${t.id}">${ic('copy')} Copy link</button>
          ${canWrite ? `<button class="btn sm" data-act="tag-write" data-v="${t.id}">${ic('nfc')} Write to sticker</button>` : ''}
          <button class="btn sm" data-act="tag-test" data-v="${t.id}" title="Open the link as a tap">${ic('ext')} Test</button>
          <button class="btn sm" data-act="tag-rotate" data-v="${t.id}" title="New code; the old sticker stops working">${ic('refresh')} New code</button>
          <button class="btn sm" data-act="tag-toggle" data-v="${t.id}">${t.active===false ? 'Turn on' : 'Turn off'}</button>
          <button class="btn sm" data-act="tag-del" data-v="${t.id}" aria-label="Delete sticker">${ic('trash')}</button>
        </div>
      </div>`; }).join('') || `<div class="li small muted">No stickers at this venue yet.</div>`}</div>`).join('')}
  <p class="small faint" style="margin-top:10px">${canWrite ? 'Write to sticker: tap the button, then hold a blank NTAG213/215 sticker to the back of this phone.' : 'To program a sticker: copy its link, open the free NFC Tools app on a phone, choose Write &rarr; Add a record &rarr; URL, paste, then hold the phone to a blank NTAG213 or NTAG215 sticker. On Android Chrome, the Write to sticker button appears here.'}</p>

  <div class="m-sec-h" style="margin-top:22px"><h2>Remembered phones</h2></div>
  <div class="list">${devs.map(([k, d]) => { const e = emp(d.emp); return `
    <div class="li">${avatar(e,32)}<div class="grow"><div class="title" style="font-size:14px">${esc(e?.name || 'Removed crew member')}</div><div class="meta">${esc(d.label||'Phone')} · linked ${fDate(d.t)}${d.lastTapT ? ` · last tap ${fTime(d.lastTapT)}` : ''}</div></div>
      <button class="btn sm" data-act="dev-unlink" data-v="${esc(k)}">Unlink</button></div>`; }).join('') || '<div class="li small muted">No phones yet. A phone is remembered after its first sticker tap with PIN.</div>'}</div>`;
}
function modalTag(){
  const vs = D().venues.filter(venueActive);
  openModal(`${mHead('Add a sticker', 'Creates a new code and link for one NFC sticker.')}
    <div class="fgrid" style="margin-top:6px">
      <label class="field"><span>Venue</span><select class="input" id="tg-venue">${vs.map(v=>`<option value="${v.id}">${esc(v.name)}</option>`).join('')}</select></label>
      <label class="field"><span>Where it&rsquo;s stuck</span><input class="input" id="tg-label" placeholder="e.g. Back door, by the time sheet"></label>
    </div>
    <div class="row" style="justify-content:flex-end;gap:8px;margin-top:18px"><button class="btn sm" data-act="close">Cancel</button><button class="btn sm primary" data-act="tag-save">${ic('check')} Add sticker</button></div>`);
}
function pAnnounce(){
  return `
  <div class="card">
    <div class="label">New announcement</div>
    <textarea class="input" id="anText" style="margin-top:10px" placeholder="e.g. Pico kitchen closes early Friday for deep clean. Thursday crew: 30 min extra prep."></textarea>
    <div class="row between" style="margin-top:10px;flex-wrap:wrap;gap:10px">
      <select class="input sm" id="anVenue" style="max-width:280px"><option value="">All crew</option>${D().venues.filter(v=>v.active!==false).map(v=>`<option value="${v.id}">${esc(v.name)} crew</option>`).join('')}</select>
      <button class="btn sm primary" data-act="an-post">${ic('mega')} Post</button>
    </div>
    <div class="an-opts">
      <label class="check"><input type="checkbox" id="anBoard" checked><span><b>Show on the tablet board</b><br><span class="faint small">Appears at the top of the crew board for the venue.</span></span></label>
      <label class="field" style="margin-top:10px"><span>Keep it on the board</span><select class="input sm" id="anUntil"><option value="today">Until end of today</option><option value="3">For 3 days</option><option value="7">For a week</option></select></label>
      <label class="check"><input type="checkbox" id="anUrgent"><span><b>Mark urgent</b><br><span class="faint small">Highlighted in amber on the board and shown first.</span></span></label>
      <label class="check"><input type="checkbox" id="anAck"><span><b>Ask crew to confirm they read it</b><br><span class="faint small">Crew tap &ldquo;Got it&rdquo;. You see who has and hasn&rsquo;t.</span></span></label>
      <label class="check"><input type="checkbox" id="anSms"><span><b>Also send as a text message</b><br><span class="faint small">Simulated in this preview. Shows in Notifications.</span></span></label>
    </div>
  </div>
  <div class="m-sec-h"><h2>Posted</h2><span class="small faint">Shows on the crew Clock screen and, if chosen, the tablet board</span></div>
  <div class="list">${D().announcements.map(a => `<div class="li"><span class="vt sm">${ic('mega')}</span><div class="grow"><div class="title" style="font-size:14px">${a.venue?esc(venue(a.venue).name):'All crew'} ${a.urgent?badge('Urgent','warn'):''} ${a.board!==false && (a.boardUntil ? a.boardUntil > now() : now()-a.t < 3*DAY) ? badge(`On board${a.boardUntil?' until '+fDate(a.boardUntil):''}`,'ok') : ''}</div><div class="small">${esc(a.text)}</div><div class="meta">${fDate(a.t)} · ${fTime(a.t)}</div>${readLine(a)}</div><button class="btn sm" data-act="an-del" data-v="${a.id}" aria-label="Delete">${ic('trash')}</button></div>`).join('') || '<div class="li small muted">No announcements yet.</div>'}</div>`;
}

function audience(vid){ return activeEmps().filter(e => !vid || e.home===vid || D().shifts.some(s=>s.emp===e.id && s.venue===vid && s.startT > now()-DAY && s.startT < now()+7*DAY)); }
function readLine(a){
  const aud = audience(a.venue), rb = a.readBy || {};
  const seen = aud.filter(e => rb[e.id]), not = aud.filter(e => !rb[e.id]);
  return `<div class="meta" style="margin-top:4px">${ic('check','" style="width:12px;height:12px;vertical-align:-2px')} ${a.ack?'Confirmed':'Seen'} by ${seen.length} of ${aud.length}${not.length && not.length <= 4 ? ` · waiting on ${not.map(e=>esc(e.name.split(' ')[0])).join(', ')}` : ''}</div>`;
}

/* ---------- Rules ---------- */
const bpRow = (b={kind:'rest',label:'',min:10,at:2,minShift:0}) => `<div class="bp-row">
  <select class="input bp-kind" aria-label="Type"><option value="rest" ${b.kind!=='meal'?'selected':''}>Rest break</option><option value="meal" ${b.kind==='meal'?'selected':''}>Meal / lunch</option></select>
  <input class="input bp-label" aria-label="Name on board" value="${esc(b.label||'')}" placeholder="10-min break">
  <input class="input num bp-min" aria-label="Minutes" type="number" min="1" value="${b.min}">
  <input class="input num bp-at" aria-label="Due after hours worked" type="number" min="0" step="0.25" value="${b.at}">
  <input class="input num bp-ms" aria-label="Minimum shift length" type="number" min="0" step="0.5" value="${b.minShift||0}">
  <button class="btn sm" data-act="bp-del" aria-label="Remove break">${ic('trash')}</button></div>`;
function pRules(){
  const s = ST();
  const num = (k, label, hint, step=1) => `<label class="field"><span>${label}</span><input class="input num" type="number" step="${step}" min="0" id="st-${k}" value="${s[k]}">${hint?`<small class="faint">${hint}</small>`:''}</label>`;
  const tog = (k, label, hint) => `<label class="check"><input type="checkbox" id="st-${k}" ${s[k]?'checked':''}><span><b>${label}</b><br><span class="faint small">${hint}</span></span></label>`;
  return `
  <div class="rules">
    <section class="card"><h3 class="card-h">Overtime</h3>
      <div class="fgrid">${num('otDaily','Daily overtime after (hrs)')}${num('dtDaily','Double time after (hrs)')}${num('otWeekly','Weekly overtime after (hrs)')}${num('otMult','Overtime multiplier','',0.1)}${num('dtMult','Double time multiplier','',0.1)}</div></section>
    <section class="card"><h3 class="card-h">Breaks</h3>
      <div class="fgrid">${num('mealByHour','Meal break must start by hour')}${num('mealMin','Meal break length (min)')}${num('restPer','One rest break per (hrs)')}${num('restMin','Rest break length (min)')}</div>
      ${tog('mealPremium','Pay a premium hour for missed breaks','Adds one hour of pay when a crew member attests a missed or late meal.')}</section>
    <section class="card bp-card"><h3 class="card-h">Break alerts (tablet board &amp; crew app)</h3>
      <p class="small muted" style="margin-bottom:10px">When someone has worked long enough for a break on this list and hasn&rsquo;t taken it, their name turns red on the tablet board and their phone shows an alert. Breaks only apply to shifts at least as long as &ldquo;Shift length&rdquo;.</p>
      <div class="bp-head small faint"><span>Type</span><span>Name on board</span><span>Minutes</span><span>Due after (hrs worked)</span><span>Shift length (hrs)</span><span></span></div>
      <div id="bpRows">${(s.breakPlan||[]).map(bpRow).join('')}</div>
      <button class="btn sm" data-act="bp-add" style="margin-top:8px">${ic('plus')} Add a break</button>
      <div class="fgrid" style="margin-top:12px">${num('breakWarnMin','Warn this many minutes before (amber)')}${num('breakLateMin','Mark overdue after (min)')}</div></section>
    <section class="card"><h3 class="card-h">NFC stickers &amp; tablet board</h3>
      ${tog('allowNfc','Allow clock-in by NFC sticker','Crew hold their phone to a sticker at the venue to clock in, start a break or clock out.')}
      ${tog('allowKiosk','Allow punching on the tablet board','Crew without their phone enter their PIN on the wall tablet to clock in, take a break or clock out.')}
      ${tog('nfcPairing','Remember phones after the first tap','First tap asks for name and PIN once; after that the phone clocks in with one tap.')}
      ${tog('nfcSelfie','Ask for the PIN on every tap','Stricter: a remembered phone still needs the PIN each time.')}
      <label class="field" style="margin-top:10px"><span>Crew app address for sticker links</span><input class="input" id="st-crewAppUrl" placeholder="https://your-app.pplx.app/" value="${esc(s.crewAppUrl||'')}"><small class="faint">Leave blank to use this app&rsquo;s current address. Set it to your permanent published address before writing stickers.</small></label></section>
    <section class="card"><h3 class="card-h">Clock-in rules</h3>
      <div class="fgrid">${num('earlyMin','Early punch window (min)','Punches earlier than this are flagged or blocked')}${num('lateGrace','Late grace period (min)')}${num('autoClockOutHrs','Flag shifts longer than (hrs)')}</div>
      ${tog('blockEarly','Block early clock-ins','Crew can&rsquo;t punch before the early window opens.')}
      ${tog('allowUnscheduled','Allow unscheduled punches','Crew without a shift today can still clock in (flagged).')}
      ${tog('allowWeakGps','Allow punches with weak GPS','Allowed but flagged. Turn off to require a clear signal.')}
      ${tog('allowExceptions','Allow exception requests','Crew can clock in from outside a geofence with a reason.')}
      ${tog('requireSelfie','Require a selfie at sign-in','Stops buddy punching. Turn off to use PIN only.')}</section>
    <section class="card"><h3 class="card-h">Pay period &amp; account</h3>
      <div class="fgrid">
        <label class="field"><span>Pay period starts on</span><input class="input" type="date" id="st-payAnchor" value="${s.payAnchor}"></label>
        <label class="field"><span>Period length</span><select class="input" id="st-periodDays"><option value="7" ${s.periodDays==7?'selected':''}>Weekly</option><option value="14" ${s.periodDays==14?'selected':''}>Every 2 weeks</option></select></label>
        ${num('paydayLag','Payday (days after period ends)')}
        <label class="field"><span>Manager name</span><input class="input" id="st-managerName" value="${esc(s.managerName)}"></label>
        <label class="field"><span>Manager PIN (4 digits)</span><input class="input num" id="st-managerPin" inputmode="numeric" maxlength="4" value="${esc(s.managerPin)}"></label>
      </div></section>
  </div>
  <div class="row" style="justify-content:flex-end;gap:8px;margin-top:16px;position:sticky;bottom:0;padding:12px 0;background:linear-gradient(transparent,var(--bg) 30%)">
    <button class="btn sm" data-act="rules-default">Restore defaults</button>
    <button class="btn sm primary" data-act="rules-save">${ic('check')} Save rules</button>
  </div>`;
}

/* ---------- Activity ---------- */
function pActivity(){
  return `<div class="list">${D().log.slice(0,150).map(l => `<div class="li"><div class="num small muted" style="width:130px;flex:none">${fDate(l.t)} · ${fTime(l.t)}</div><div class="grow small"><b>${esc(l.who)}</b> ${esc(l.text)}</div></div>`).join('') || '<div class="li small muted">No activity yet.</div>'}</div>`;
}

/* ---------- Modals ---------- */
function openModal(html, wide=false){ modalRoot.innerHTML = `<div class="scrim m-scrim2" data-act="scrim"><div class="modal ${wide?'wide':''}" role="dialog" aria-modal="true">${html}</div></div>`; const f = modalRoot.querySelector('input:not([type=hidden]),select,textarea'); if (f) setTimeout(()=>f.focus(),30); }
function closeModal(){ modalRoot.innerHTML = ''; }
const val = id => document.getElementById(id)?.value ?? '';
const chk = id => !!document.getElementById(id)?.checked;
const mHead = (t, sub='') => `<div class="row between" style="align-items:flex-start"><div><h3>${t}</h3>${sub?`<p class="muted small">${sub}</p>`:''}</div><button class="icon-btn" data-act="close" aria-label="Close">${ic('x')}</button></div>`;
const venueOpts = sel => D().venues.map(v=>`<option value="${v.id}" ${sel===v.id?'selected':''}>${esc(v.name)}${venueActive(v)?'':' (inactive)'}</option>`).join('');
const roleOpts = (e, sel) => (e?.roles||[]).map(r=>`<option value="${esc(r.role)}" data-rate="${r.rate}" ${sel===r.role?'selected':''}>${esc(r.role)} · ${money(r.rate)}</option>`).join('');

/* Punch editor (new or existing). opts: {reqId, prefill} */
function modalPunch(id, opts={}){
  const p = id ? D().punches.find(x=>x.id===id) : null;
  const pre = opts.prefill || {};
  const e0 = emp(p?.emp || pre.emp || M.tsEmp!=='all'&&M.tsEmp || activeEmps()[0]?.id);
  const inT = p?.inT ?? pre.inT ?? at(startOfDay(now()-DAY), '10:00');
  const outT = p ? p.outT : (pre.outT ?? inT + 8*HR);
  const breaks = (p?.breaks || pre.breaks || []).map(b=>({...b}));
  const req = opts.reqId && D().requests.find(r=>r.id===opts.reqId);
  M.editBreaks = breaks;
  openModal(`
    ${mHead(p ? 'Edit punch' : 'Add punch', p ? `${esc(p.id)} · ${esc(emp(p.emp)?.name)}` : 'Create a time record by hand')}
    ${req ? `<div class="alert info" style="margin-top:12px">${ic('inbox')}<div><b>${esc(req.kind)} from ${esc(emp(req.emp)?.name)}:</b> ${esc(req.detail)}</div></div>` : ''}
    <div class="fgrid" style="margin-top:6px">
      <label class="field"><span>Crew member</span><select class="input" id="pe-emp" ${p?'disabled':''} data-act-change="pe-emp">${D().employees.map(e=>`<option value="${e.id}" ${e0?.id===e.id?'selected':''}>${esc(e.name)}</option>`).join('')}</select></label>
      <label class="field"><span>Venue</span><select class="input" id="pe-venue">${venueOpts(p?.venue || pre.venue || e0?.home)}</select></label>
      <label class="field"><span>Role</span><select class="input" id="pe-role" data-act-change="pe-role">${roleOpts(e0, p?.role || pre.role)}</select></label>
      <label class="field"><span>Hourly rate</span><input class="input num" id="pe-rate" type="number" step="0.25" value="${(p?.rate ?? e0?.roles.find(r=>r.role===pre.role)?.rate ?? e0?.roles[0]?.rate ?? 0).toFixed(2)}"></label>
      <label class="field"><span>Date</span><input class="input" type="date" id="pe-date" value="${toDateInput(inT)}"></label>
      <label class="field"><span>Clock in</span><input class="input" type="time" id="pe-in" value="${toTimeInput(inT)}"></label>
      <label class="field"><span>Clock out ${p && !p.outT ? '<span class="faint">(blank = still on clock)</span>' : ''}</span><input class="input" type="time" id="pe-out" value="${outT ? toTimeInput(outT) : ''}"></label>
      <label class="field"><span>Cash tips</span><input class="input num" id="pe-cash" type="number" step="0.01" value="${(p?.tipsCash||0).toFixed(2)}"></label>
      <label class="field"><span>Card tips</span><input class="input num" id="pe-card" type="number" step="0.01" value="${(p?.tipsCard||0).toFixed(2)}"></label>
      <label class="field"><span>Break attestation</span><select class="input" id="pe-att"><option value="ok" ${p?.attest!=='missed'?'selected':''}>All breaks taken</option><option value="missed" ${p?.attest==='missed'?'selected':''}>Missed a break (premium owed)</option></select></label>
    </div>
    <div class="row between" style="margin-top:16px"><div class="label">Breaks</div><div class="row" style="gap:6px"><button class="btn sm" data-act="pe-addbrk" data-v="meal">${ic('plus')} Meal</button><button class="btn sm" data-act="pe-addbrk" data-v="rest">${ic('plus')} Rest</button></div></div>
    <div id="pe-brks">${brkRows()}</div>
    <label class="field"><span>Reason for this change ${p?'(saved to the audit log and shown to the employee)':''}</span><input class="input" id="pe-note" value="${esc(opts.note || '')}" placeholder="e.g. Forgot to clock out; verified with shift lead"></label>
    <div class="row between" style="margin-top:18px;gap:8px">
      ${p ? `<button class="btn sm danger" data-act="punch-del" data-v="${p.id}">${ic('trash')} Delete</button>` : '<span></span>'}
      <div class="row" style="gap:8px"><button class="btn sm" data-act="close">Cancel</button><button class="btn sm primary" data-act="pe-save" data-v="${p?.id||''}" data-req="${req?.id||''}">${ic('check')} ${req?'Save &amp; approve':'Save punch'}</button></div>
    </div>`, true);
}
function brkRows(){
  const b = M.editBreaks || [];
  if (!b.length) return '<div class="small faint" style="padding:8px 0">No breaks recorded.</div>';
  return b.map((x,i) => `<div class="brk-row">
    <span class="badge ${x.type==='meal'?'warn':'info'}">${x.type==='meal'?'Meal · unpaid':'Rest · paid'}</span>
    <label><span class="faint small">Start</span><input class="input sm" type="time" data-brk="${i}" data-k="start" value="${toTimeInput(x.start)}"></label>
    <label><span class="faint small">Minutes</span><input class="input sm num" type="number" min="0" data-brk="${i}" data-k="min" value="${x.end?Math.round((x.end-x.start)/MIN):''}" placeholder="open"></label>
    <button class="icon-btn" data-act="pe-delbrk" data-v="${i}" aria-label="Remove break">${ic('x')}</button></div>`).join('');
}
function syncBrks(){
  document.querySelectorAll('[data-brk]').forEach(inp => {
    const b = M.editBreaks[+inp.dataset.brk]; if (!b) return;
    if (inp.dataset.k==='start'){ b._st = inp.value; } else { b._min = inp.value; }
  });
}
function savePunch(id, reqId){
  syncBrks();
  const empId = id ? D().punches.find(x=>x.id===id).emp : val('pe-emp');
  const date = val('pe-date'), tin = val('pe-in'), tout = val('pe-out');
  if (!date || !tin){ toast('Add a date and clock-in time'); return; }
  const inT = fromInputs(date, tin);
  let outT = tout ? fromInputs(date, tout) : null; if (outT !== null && outT <= inT) outT += DAY;
  if (!id && outT === null && CC.liveFor(empId)){ toast(`${emp(empId).name} is already on the clock`); return; }
  if (id && outT === null && D().punches.some(x => x.emp===empId && !x.outT && x.id!==id)){ toast('They already have another live shift'); return; }
  const ps = CC.periodStart(inT); if (isClosed(ps)){ toast('That pay period is closed. Reopen it on Payroll first.'); return; }
  const breaks = (M.editBreaks||[]).map(b => {
    const st = b._st !== undefined ? fromInputs(date, b._st) : b.start; let s = st; if (s < inT - HR) s += DAY;
    const mins = b._min !== undefined ? b._min : (b.end ? Math.round((b.end-b.start)/MIN) : '');
    return {type:b.type, start:s, ...(mins!=='' && mins!==null ? {end: s + Number(mins)*MIN} : {})};
  });
  const note = val('pe-note').trim();
  const fields = {venue:val('pe-venue'), role:val('pe-role'), rate:parseFloat(val('pe-rate'))||0, inT, outT, breaks,
    tipsCash:parseFloat(val('pe-cash'))||0, tipsCard:parseFloat(val('pe-card'))||0, attest:val('pe-att')};
  fields.missed = fields.attest==='missed' ? ['Break missed'] : [];
  let p;
  if (id){
    p = D().punches.find(x=>x.id===id);
    Object.assign(p, fields); if (!p.outT) delete p.outT;
    p.edited = {t:now(), by:MGR(), note}; p.reviewed = true; delete p.editPending;
    if (p.exception==='pending') p.exception = 'approved';
  } else {
    p = {id:CC.id(`P-${empId.slice(2)}`), emp:empId, ...fields, flags:['Added by manager'], reviewed:true,
      inLoc:{lat:venue(fields.venue).lat, lng:venue(fields.venue).lng, acc:0, method:'Manager entry'}, edited:{t:now(), by:MGR(), note}};
    if (!p.outT) delete p.outT;
    D().punches.push(p);
  }
  if (reqId){ const r = D().requests.find(x=>x.id===reqId); resolveReq(r, 'Approved', note); }
  delete (D().approvals[ps]||{})[empId];
  commit(`${id?'Edited':'Added'} punch ${p.id} for ${emp(empId).name} (${fDate(inT)} ${fTime(inT)}–${outT?fTime(outT):'live'})${note?` · ${note}`:''}`);
  closeModal(); toast(id ? 'Punch updated' : 'Punch added'); render();
}
function resolveReq(r, status, note){ if (!r) return; r.status = status; r.resolvedT = now(); r.resolvedBy = MGR(); if (note) r.mgrNote = note; }

function modalShift(id, isOpen, empId, day){
  const list = isOpen ? D().openShifts : D().shifts;
  const s = id ? list.find(x=>x.id===id) : null;
  const d = s ? startOfDay(s.startT) : (Number(day) || startOfDay(now()));
  const e0 = emp(s?.emp || empId || activeEmps()[0]?.id);
  const roles = isOpen ? [...new Set(D().employees.flatMap(e=>e.roles.map(r=>r.role)))] : (e0?.roles||[]).map(r=>r.role);
  openModal(`
    ${mHead(s ? (isOpen?'Edit open shift':'Edit shift') : (isOpen?'New open shift':'New shift'), isOpen ? 'Crew can request it in their Schedule tab.' : '')}
    <div class="fgrid" style="margin-top:6px">
      ${isOpen ? '' : `<label class="field"><span>Crew member</span><select class="input" id="sh-emp" data-act-change="sh-emp">${activeEmps().map(e=>`<option value="${e.id}" ${e0?.id===e.id?'selected':''}>${esc(e.name)}</option>`).join('')}</select></label>`}
      <label class="field"><span>Venue</span><select class="input" id="sh-venue">${venueOpts(s?.venue || e0?.home)}</select></label>
      <label class="field"><span>Role</span><select class="input" id="sh-role">${roles.map(r=>`<option ${s?.role===r?'selected':''}>${esc(r)}</option>`).join('')}</select></label>
      <label class="field"><span>Date</span><input class="input" type="date" id="sh-date" value="${toDateInput(d)}"></label>
      <label class="field"><span>Start</span><input class="input" type="time" id="sh-start" value="${s?toTimeInput(s.startT):'11:00'}"></label>
      <label class="field"><span>End</span><input class="input" type="time" id="sh-end" value="${s?toTimeInput(s.endT):'19:00'}"></label>
      ${isOpen ? `<label class="field"><span>Spots</span><input class="input num" type="number" min="1" id="sh-spots" value="${s?.spots ?? 1}"></label>` : ''}
      <label class="field" style="grid-column:1/-1"><span>${isOpen?'Note for crew':'Station or note'}</span><input class="input" id="sh-station" value="${esc(s?.station || s?.note || '')}" placeholder="e.g. Stand 114 · match day"></label>
    </div>
    ${EXT.shiftModalExtra ? EXT.shiftModalExtra(s, isOpen) : ''}
    <div id="sh-warn"></div>
    <div class="row between" style="margin-top:18px;gap:8px">
      ${s ? `<button class="btn sm danger" data-act="shift-del" data-v="${s.id}" data-open="${isOpen?1:''}">${ic('trash')} Delete</button>` : '<span></span>'}
      <div class="row" style="gap:8px"><button class="btn sm" data-act="close">Cancel</button><button class="btn sm primary" data-act="shift-save" data-v="${s?.id||''}" data-open="${isOpen?1:''}">${ic('check')} Save shift</button></div>
    </div>`);
}
function saveShift(id, isOpen){
  const date = val('sh-date'), a = val('sh-start'), b = val('sh-end');
  if (!date || !a || !b){ toast('Add a date, start and end'); return; }
  const startT = fromInputs(date, a); let endT = fromInputs(date, b); if (endT <= startT) endT += DAY;
  const base = {venue:val('sh-venue'), role:val('sh-role'), startT, endT};
  if (isOpen){
    Object.assign(base, {note:val('sh-station'), spots:Math.max(1, parseInt(val('sh-spots'))||1)});
    if (id) Object.assign(D().openShifts.find(x=>x.id===id), base); else D().openShifts.push({id:CC.id('O'), ...base});
    commit(`${id?'Updated':'Posted'} open shift: ${venue(base.venue).name} · ${base.role} · ${fDate(startT)} ${fTime(startT)}–${fTime(endT)}`);
  } else {
    const empId = val('sh-emp');
    Object.assign(base, {emp:empId, station:val('sh-station')});
    const clash = D().shifts.find(s => s.emp===empId && s.id!==id && s.startT < endT && s.endT > startT);
    if (clash){ toast(`${emp(empId).name} already has a shift then`); return; }
    const probe = {id:id||'_new', ...base};
    const hard = CC.shiftIssues(probe).filter(i => i.sev==='bad' || i.k==='avail' || i.k==='rest');
    const ok = document.getElementById('sh-ok');
    if (hard.length && !(ok && ok.checked)){
      const box = document.getElementById('sh-warn');
      if (box){ box.innerHTML = `<div class="alert warn" style="margin-top:14px">${ic('alert')}<div><b>Check before saving:</b> ${hard.map(i=>esc(i.text)).join('; ')}.<label class="check" style="margin-top:6px"><input type="checkbox" id="sh-ok"><span>Schedule anyway</span></label></div></div>`; return; }
    }
    const prevS = id ? {...D().shifts.find(x=>x.id===id)} : null;
    let saved;
    if (id){ saved = Object.assign(D().shifts.find(x=>x.id===id), base); } else { saved = {id:CC.id('S'), ...base}; D().shifts.push(saved); }
    if (!prevS || prevS.startT!==saved.startT || prevS.endT!==saved.endT || prevS.emp!==saved.emp || prevS.venue!==saved.venue){ CC.markScheduleChange(saved); delete saved.confirmed; delete saved.reminded; }
    if (EXT.afterShiftSave) EXT.afterShiftSave(saved, prevS);
    commit(`${id?'Updated':'Scheduled'} ${emp(empId).name}: ${venue(base.venue).name} · ${fDate(startT)} ${fTime(startT)}–${fTime(endT)}`);
  }
  closeModal(); toast('Schedule saved'); render();
}

function modalEmp(id){
  const e = id ? emp(id) : null;
  M.editRoles = e ? e.roles.map(r=>({...r})) : [{role:'Cashier', rate:20}];
  const color = e?.color || COLORS[D().employees.length % COLORS.length];
  openModal(`
    ${mHead(e ? 'Edit crew member' : 'Add crew member', e ? esc(e.id) : 'They can sign in to the crew app right away.')}
    <div class="fgrid" style="margin-top:6px">
      <label class="field"><span>Full name</span><input class="input" id="em-name" value="${esc(e?.name||'')}" placeholder="e.g. Tasha Moore"></label>
      <label class="field"><span>Clock PIN (4 digits)</span><input class="input num" id="em-pin" inputmode="numeric" maxlength="4" value="${esc(e?.pin||String(Math.floor(1000+Math.random()*9000)))}"></label>
      <label class="field"><span>Phone</span><input class="input" id="em-phone" value="${esc(e?.phone||'')}" placeholder="(310) 555-0100"></label>
      <label class="field"><span>Home venue</span><select class="input" id="em-home">${venueOpts(e?.home || 'pico')}</select></label>
    </div>
    <div class="label" style="margin-top:16px">Badge color</div>
    <div class="row" style="gap:8px;margin-top:8px;flex-wrap:wrap">${COLORS.map(c=>`<label class="swatch"><input type="radio" name="em-color" value="${c}" ${c===color?'checked':''}><i style="background:${c}"></i></label>`).join('')}</div>
    <div class="row between" style="margin-top:16px"><div class="label">Roles &amp; pay rates</div><button class="btn sm" data-act="em-addrole">${ic('plus')} Role</button></div>
    <div id="em-roles">${roleRows()}</div>
    <label class="check" style="margin-top:14px"><input type="checkbox" id="em-minor" ${e?.minor?'checked':''}><span><b>Under 18</b><br><span class="faint small">Turns on minor-hour checks in the schedule and asks for a work permit.</span></span></label>
    <div class="label" style="margin-top:16px">Availability</div>
    <div class="av-grid">${[1,2,3,4,5,6,0].map(d => { const a = (D().availability?.[e?.id]?.days||{})[d]; const nm = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]; return `<div class="av-day"><label class="check" style="margin:0"><input type="checkbox" class="av-on" data-d="${d}" ${!a || !a.off ? 'checked':''}><span>${nm}</span></label><input class="input sm av-f" data-d="${d}" type="time" value="${a?.from||'00:00'}"><input class="input sm av-t" data-d="${d}" type="time" value="${a?.to||'23:59'}"></div>`; }).join('')}</div>
    ${D().availability?.[e?.id]?.note ? `<p class="small muted" style="margin-top:6px">Their note: &ldquo;${esc(D().availability[e.id].note)}&rdquo;</p>` : '<p class="small faint" style="margin-top:6px">Crew can also update this from the Schedule tab of the crew app.</p>'}
    ${e ? `<label class="check" style="margin-top:14px"><input type="checkbox" id="em-active" ${e.active!==false?'checked':''}><span><b>Active</b><br><span class="faint small">Inactive crew can&rsquo;t sign in and are hidden from scheduling. Their records are kept.</span></span></label>` : ''}
    <div class="row between" style="margin-top:18px;gap:8px">
      ${e ? `<button class="btn sm danger" data-act="emp-del" data-v="${e.id}">${ic('trash')} Delete</button>` : '<span></span>'}
      <div class="row" style="gap:8px"><button class="btn sm" data-act="close">Cancel</button><button class="btn sm primary" data-act="emp-save" data-v="${e?.id||''}">${ic('check')} Save</button></div>
    </div>`, true);
}
function roleRows(){
  return (M.editRoles||[]).map((r,i) => `<div class="brk-row">
    <label class="grow"><span class="faint small">Role</span><input class="input sm" data-role="${i}" data-k="role" value="${esc(r.role)}"></label>
    <label><span class="faint small">Rate / hr</span><input class="input sm num" type="number" step="0.25" data-role="${i}" data-k="rate" value="${Number(r.rate).toFixed(2)}"></label>
    <button class="icon-btn" data-act="em-delrole" data-v="${i}" aria-label="Remove role" ${(M.editRoles.length<2)?'disabled':''}>${ic('x')}</button></div>`).join('');
}
function syncRoles(){ document.querySelectorAll('[data-role]').forEach(inp => { const r = M.editRoles[+inp.dataset.role]; if (r) r[inp.dataset.k] = inp.dataset.k==='rate' ? parseFloat(inp.value)||0 : inp.value; }); }
function saveEmp(id){
  syncRoles();
  const name = val('em-name').trim(), pin = val('em-pin').trim();
  if (!name){ toast('Add a name'); return; }
  if (!/^\d{4}$/.test(pin)){ toast('PIN must be 4 digits'); return; }
  if (D().employees.some(x => x.pin===pin && x.id!==id && x.active!==false)){ toast('Another crew member uses that PIN'); return; }
  if (pin === ST().managerPin){ toast('That PIN is the manager PIN'); return; }
  const roles = M.editRoles.filter(r=>r.role.trim()).map(r=>({role:r.role.trim(), rate:r.rate}));
  if (!roles.length){ toast('Add at least one role'); return; }
  const color = document.querySelector('input[name=em-color]:checked')?.value || COLORS[0];
  const data = {name, pin, phone:val('em-phone').trim(), home:val('em-home'), roles, color, initials:initialsOf(name), minor:chk('em-minor')};
  const avDays = {}; document.querySelectorAll('.av-on').forEach(c => { const d = c.dataset.d; avDays[d] = c.checked ? {from:document.querySelector(`.av-f[data-d="${d}"]`).value||'00:00', to:document.querySelector(`.av-t[data-d="${d}"]`).value||'23:59'} : {off:true}; });
  if (id){ const e = emp(id); const was = e.active!==false; Object.assign(e, data, {active:chk('em-active')});
    (D().availability ||= {})[id] = {...(D().availability[id]||{}), days:avDays, t:now()};
    commit(`Updated crew member ${name}${was && !e.active ? ' (deactivated)' : !was && e.active ? ' (reactivated)' : ''}`); }
  else { const n = Math.max(1000, ...D().employees.map(x=>parseInt(x.id.slice(2))||0)) + 1;
    D().employees.push({id:`E-${n}`, active:true, ...data}); (D().availability ||= {})[`E-${n}`] = {days:avDays, t:now()}; (D().docs ||= {})[`E-${n}`] = {}; commit(`Added crew member ${name} (E-${n})`); }
  closeModal(); toast('Crew saved'); render();
}

function modalVenue(id){
  const v = id ? D().venues.find(x=>x.id===id) : null;
  openModal(`
    ${mHead(v ? 'Edit venue' : 'Add venue', 'Set the center point and fence radius. Tip: right-click a spot in Google Maps to copy its coordinates.')}
    <div class="fgrid" style="margin-top:6px">
      <label class="field" style="grid-column:1/-1"><span>Venue name</span><input class="input" id="vn-name" value="${esc(v?.name||'')}" placeholder="e.g. Crypto.com Arena · Section 112"></label>
      <label class="field"><span>Type</span><select class="input" id="vn-type">${Object.entries(VTYPE).map(([k,t])=>`<option value="${k}" ${v?.type===k?'selected':''}>${t.label}</option>`).join('')}</select></label>
      <label class="field"><span>Fence radius (m)</span><input class="input num" type="number" min="20" id="vn-r" value="${v?.r ?? 100}"></label>
      <label class="field" style="grid-column:1/-1"><span>Address</span><input class="input" id="vn-addr" value="${esc(v?.addr||'')}"></label>
      <label class="field"><span>Latitude</span><input class="input num" id="vn-lat" value="${v?.lat ?? ''}" placeholder="34.04768"></label>
      <label class="field"><span>Longitude</span><input class="input num" id="vn-lng" value="${v?.lng ?? ''}" placeholder="-118.34340"></label>
      <label class="field"><span>Active from (pop-ups)</span><input class="input" type="date" id="vn-w0" value="${v?.window?.[0]||''}"></label>
      <label class="field"><span>Active until</span><input class="input" type="date" id="vn-w1" value="${v?.window?.[1]||''}"></label>
      <label class="field" style="grid-column:1/-1"><span>Note for crew</span><input class="input" id="vn-note" value="${esc(v?.note||'')}" placeholder="e.g. Enter at the vendor gate"></label>
    </div>
    <div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn sm" data-act="vn-here">${ic('nav')} Use my current location</button></div>
    <label class="check" style="margin-top:12px"><input type="checkbox" id="vn-active" ${v?.active!==false?'checked':''}><span><b>Accept punches here</b><br><span class="faint small">Turn off to close the geofence without deleting the venue.</span></span></label>
    <div class="row between" style="margin-top:18px;gap:8px">
      ${v ? `<button class="btn sm danger" data-act="venue-del" data-v="${v.id}">${ic('trash')} Delete</button>` : '<span></span>'}
      <div class="row" style="gap:8px"><button class="btn sm" data-act="close">Cancel</button><button class="btn sm primary" data-act="venue-save" data-v="${v?.id||''}">${ic('check')} Save venue</button></div>
    </div>`, true);
}
function saveVenue(id){
  const name = val('vn-name').trim(), lat = parseFloat(val('vn-lat')), lng = parseFloat(val('vn-lng')), r = parseInt(val('vn-r'));
  if (!name){ toast('Add a venue name'); return; }
  if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat)>90 || Math.abs(lng)>180){ toast('Enter a valid latitude and longitude'); return; }
  if (!(r >= 20)){ toast('Radius should be at least 20 m'); return; }
  const w0 = val('vn-w0'), w1 = val('vn-w1');
  if ((w0 && !w1) || (!w0 && w1) || (w0 && w1 && w1 < w0)){ toast('Set both dates, with the end after the start'); return; }
  const data = {name, type:val('vn-type'), r, addr:val('vn-addr').trim(), lat, lng, note:val('vn-note').trim(), active:chk('vn-active'), window: w0 ? [w0,w1] : null};
  if (id) Object.assign(D().venues.find(x=>x.id===id), data);
  else D().venues.push({id:CC.id('V'), ...data});
  commit(`${id?'Updated':'Added'} venue ${name} (${r} m fence)`);
  closeModal(); toast('Venue saved'); render();
}

function modalClockIn(empId, shiftId){
  const off = activeEmps().filter(e => !CC.liveFor(e.id));
  if (!off.length){ toast('Everyone is already on the clock'); return; }
  const sh = shiftId && D().shifts.find(s=>s.id===shiftId);
  const e0 = emp(empId && off.some(e=>e.id===empId) ? empId : off[0].id);
  openModal(`
    ${mHead('Clock someone in', 'Use when a phone is dead or GPS won&rsquo;t cooperate. The punch is marked as a manager entry.')}
    <div class="fgrid" style="margin-top:6px">
      <label class="field"><span>Crew member</span><select class="input" id="ci-emp" data-act-change="ci-emp">${off.map(e=>`<option value="${e.id}" ${e.id===e0.id?'selected':''}>${esc(e.name)}</option>`).join('')}</select></label>
      <label class="field"><span>Venue</span><select class="input" id="ci-venue">${venueOpts(sh?.venue || e0.home)}</select></label>
      <label class="field"><span>Role</span><select class="input" id="ci-role">${roleOpts(e0, sh?.role)}</select></label>
      <label class="field"><span>Clock-in time</span><input class="input" type="time" id="ci-time" value="${toTimeInput(sh && sh.startT < now() ? sh.startT : now())}"></label>
      <label class="field" style="grid-column:1/-1"><span>Reason</span><input class="input" id="ci-note" placeholder="e.g. Phone died at the gate"></label>
    </div>
    <div class="row" style="justify-content:flex-end;gap:8px;margin-top:18px"><button class="btn sm" data-act="close">Cancel</button><button class="btn sm primary" data-act="ci-save">${ic('clock')} Clock in</button></div>`);
}
function modalClockOut(id){
  const p = D().punches.find(x=>x.id===id), e = emp(p.emp);
  openModal(`
    ${mHead(`Clock out ${esc(e.name.split(' ')[0])}`, `On the clock since ${fTime(p.inT)} · ${fHrs(workedMs(p)/HR)} hrs`)}
    <div class="fgrid" style="margin-top:6px">
      <label class="field"><span>Clock-out time</span><input class="input" type="time" id="co-time" value="${toTimeInput(now())}"></label>
      <label class="field"><span>Cash tips</span><input class="input num" type="number" step="0.01" id="co-cash" placeholder="0.00"></label>
      <label class="field" style="grid-column:1/-1"><span>Reason</span><input class="input" id="co-note" placeholder="e.g. Forgot to clock out, left at close"></label>
    </div>
    <div class="row" style="justify-content:flex-end;gap:8px;margin-top:18px"><button class="btn sm" data-act="close">Cancel</button><button class="btn sm primary" data-act="co-save" data-v="${p.id}">${ic('out')} Clock out</button></div>`);
}
function modalNote(id){
  const p = D().punches.find(x=>x.id===id), e = emp(p.emp);
  openModal(`
    ${mHead(`Message ${esc(e.name.split(' ')[0])}`, 'Shows at the top of their Clock screen while they&rsquo;re on this shift.')}
    <label class="field"><span>Message</span><textarea class="input" id="nt-text" placeholder="e.g. Take your meal break now, Dee is covering the fryer">${esc(p.mgrNote||'')}</textarea></label>
    <div class="row between" style="margin-top:18px;gap:8px">${p.mgrNote?`<button class="btn sm" data-act="nt-clear" data-v="${p.id}">Clear message</button>`:'<span></span>'}
    <div class="row" style="gap:8px"><button class="btn sm" data-act="close">Cancel</button><button class="btn sm primary" data-act="nt-save" data-v="${p.id}">${ic('mega')} Send</button></div></div>`);
}
function confirmModal(title, body, act, v, label='Delete'){
  openModal(`${mHead(title)}<p class="muted small" style="margin-top:4px">${body}</p>
    <div class="row" style="justify-content:flex-end;gap:8px;margin-top:18px"><button class="btn sm" data-act="close">Cancel</button><button class="btn sm danger" data-act="${act}" data-v="${v}" data-ok="1">${label}</button></div>`);
}

/* ---------- CSV ---------- */
function csv(kind){
  const ps = curPs(), pe = ps + CC.periodLen();
  const q = s => `"${String(s ?? '').replace(/"/g,'""')}"`;
  let rows;
  if (kind === 'summary'){
    rows = [['Employee ID','Name','Regular hrs','OT hrs','DT hrs','Regular pay','OT pay','DT pay','Break premiums','Tips','Gross','Approved']];
    D().employees.forEach(e => { const s = CC.summary(e.id, ps); if (!s.rows.length) return;
      rows.push([e.id, e.name, fHrs(s.reg), fHrs(s.ot), fHrs(s.dt), s.regPay.toFixed(2), s.otPay.toFixed(2), s.dtPay.toFixed(2), s.prem.toFixed(2), s.tips.toFixed(2), s.gross.toFixed(2), (D().approvals[ps]||{})[e.id] ? 'Yes':'No']); });
  } else {
    rows = [['Punch ID','Employee ID','Name','Date','Venue','Role','Rate','Clock in','Clock out','Meal minutes','Hours','Cash tips','Card tips','Flags','Edited by manager']];
    D().punches.filter(p=>!p.voided && p.inT>=ps && p.inT<pe).sort((a,b)=>a.inT-b.inT).forEach(p => {
      const meal = (p.breaks||[]).filter(b=>b.type==='meal').reduce((a,b)=>a+((b.end??now())-b.start),0)/MIN;
      rows.push([p.id, p.emp, emp(p.emp)?.name, toDateInput(p.inT), venue(p.venue).name, p.role, p.rate.toFixed(2), toTimeInput(p.inT), p.outT?toTimeInput(p.outT):'LIVE', Math.round(meal), fHrs(workedMs(p)/HR), (p.tipsCash||0).toFixed(2), (p.tipsCard||0).toFixed(2), (p.flags||[]).join('; '), p.edited?'Yes':'No']); });
  }
  const blob = new Blob([rows.map(r=>r.map(q).join(',')).join('\n')], {type:'text/csv'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `cjs-crew-clock-${kind}-${toDateInput(ps)}.csv`; document.body.appendChild(a); a.click(); a.remove();
  commit(`Exported ${kind === 'summary' ? 'payroll summary' : 'punch detail'} CSV for ${fShort(ps)} period`);
  toast('CSV downloaded');
}

/* ---------- Toast ---------- */
let toastT;
function toast(msg){ const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(()=>t.classList.remove('show'), 2600); }

/* ---------- Events ---------- */
document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act, v = el.dataset.v;
  if (act === 'scrim'){ if (ev.target === el) closeModal(); return; }
  if (M.demoOpen && act !== 'demo-toggle' && !el.closest('.m-pop')) M.demoOpen = false;
  const r = v && D().requests.find(x=>x.id===v);
  switch (act){
    case 'key': {
      if (v==='clr') M.pin=''; else if (v==='del') M.pin=M.pin.slice(0,-1); else if (M.pin.length<4) M.pin+=v;
      M.pinErr=false;
      if (M.pin.length===4){ if (M.pin===ST().managerPin){ M.authed=true; M.pin=''; CC.log(MGR(),'Signed in to the manager console'); CC.save(); toast(`Welcome back, ${MGR()}`);} else { M.pinErr=true; M.pin=''; } }
      break; }
    case 'signout': M.authed=false; break;
    case 'page': M.page = v; M.navOpen=false; history.replaceState(null,'','#'+v); window.scrollTo(0,0); break;
    case 'nav': M.navOpen = !M.navOpen; break;
    case 'nav-close': M.navOpen = false; break;
    case 'demo-toggle': M.demoOpen = !M.demoOpen; break;
    case 'ff': D().offsetMs = v==='0' ? 0 : (D().offsetMs||0) + Number(v)*MIN; CC.save(); toast(v==='0' ? 'Back to real time' : `Jumped ahead ${v>=60?v/60+' hr':v+' min'}`); break;
    case 'reset': if (!el.dataset.ok){ confirmModal('Reset demo data?', 'This restores the sample crew, venues, schedule and punches, and clears every change made in the crew app and the manager console.', 'reset', '', 'Reset'); return; }
      CC.reset(); closeModal(); M.demoOpen=false; toast('Demo data reset'); break;
    case 'close': closeModal(); return;

    /* live */
    case 'end-break': { const p = D().punches.find(x=>x.id===v); const b = p.breaks.find(x=>!x.end); if (b){ b.end = now(); commit(`Ended ${b.type} break for ${emp(p.emp).name}`); toast('Break ended'); } break; }
    case 'clockin-open': modalClockIn(v, el.dataset.shift); return;
    case 'ci-save': {
      const empId = val('ci-emp'), e = emp(empId), role = val('ci-role'), vid = val('ci-venue');
      const t = fromInputs(toDateInput(now()), val('ci-time')); const note = val('ci-note').trim();
      if (t > now() + MIN){ toast('Clock-in time can&rsquo;t be in the future'.replace('&rsquo;','\u2019')); return; }
      const rate = e.roles.find(x=>x.role===role)?.rate ?? e.roles[0].rate; const vv = venue(vid);
      D().punches.push({id:CC.id(`P-${empId.slice(2)}`), emp:empId, venue:vid, role, rate, inT:t, breaks:[], flags:['Manager clock-in'], reviewed:true,
        inLoc:{lat:vv.lat, lng:vv.lng, acc:0, method:'Manager clock-in'}, tipsCard:0, edited:{t:now(), by:MGR(), note}, mgrNote: note ? `Clocked in by manager: ${note}` : 'Clocked in by your manager'});
      commit(`Clocked in ${e.name} at ${vv.name} (${fTime(t)})${note?` · ${note}`:''}`); closeModal(); toast(`${e.name} is on the clock`); break; }
    case 'clockout-open': modalClockOut(v); return;
    case 'co-save': {
      const p = D().punches.find(x=>x.id===v); let t = fromInputs(toDateInput(p.inT), val('co-time')); if (t < p.inT) t += DAY;
      if (t > now() + MIN){ toast('Clock-out time can\u2019t be in the future'); return; }
      (p.breaks||[]).forEach(b => { if (!b.end) b.end = Math.min(t, now()); });
      const note = val('co-note').trim();
      Object.assign(p, {outT:t, tipsCash:parseFloat(val('co-cash'))||0, attest:p.attest||'ok', missed:p.missed||[], outLoc:{lat:0,lng:0,acc:0,method:'Manager clock-out'}, edited:{t:now(), by:MGR(), note}});
      (p.flags ||= []).push('Clocked out by manager'); p.reviewed = true;
      commit(`Clocked out ${emp(p.emp).name} at ${fTime(t)}${note?` · ${note}`:''}`); closeModal(); toast('Clocked out'); break; }
    case 'note-open': modalNote(v); return;
    case 'nt-save': { const p = D().punches.find(x=>x.id===v); const t = val('nt-text').trim(); if (!t){ toast('Write a message first'); return; } p.mgrNote = t; commit(`Messaged ${emp(p.emp).name}: “${t}”`); closeModal(); toast('Message sent'); break; }
    case 'nt-clear': { const p = D().punches.find(x=>x.id===v); delete p.mgrNote; commit(`Cleared message for ${emp(p.emp).name}`); closeModal(); break; }

    /* approvals */
    case 'ap-filter': M.apFilter = v; break;
    case 'req-approve': {
      const note = val('note-'+v).trim();
      if (r.kind === 'Clock-in exception'){ const p = D().punches.find(x=>x.id===r.punchId); if (p){ p.exception='approved'; p.reviewed=true; } }
      if (r.kind === 'Open shift'){ const o = D().openShifts.find(x=>x.id===r.ref); if (!o || (o.spots??1) < 1){ toast('That open shift is no longer available'); return; }
        const e = emp(r.emp); if (!e.roles.some(x=>x.role===o.role)) e.roles.push({role:o.role, rate:e.roles[0].rate});
        D().shifts.push({id:CC.id('S'), emp:r.emp, venue:o.venue, startT:o.startT, endT:o.endT, role:o.role, station:o.note||'Picked up open shift'}); o.spots = (o.spots??1) - 1; }
      if (EXT.approve[r.kind] && EXT.approve[r.kind](r, note) === false) return;
      if (r.kind === 'Time off'){ const t0 = new Date(r.payload.date+'T00:00').getTime();
        const cs = D().shifts.filter(s => s.emp===r.emp && s.startT>=t0 && s.startT<t0+DAY);
        cs.forEach(s => { D().openShifts.push({id:CC.id('O'), venue:s.venue, startT:s.startT, endT:s.endT, role:s.role, note:`Covering for ${emp(r.emp).name.split(' ')[0]}`, spots:1}); });
        D().shifts = D().shifts.filter(s => !cs.includes(s));
        if (cs.length) toast(`${cs.length} shift${cs.length>1?'s':''} moved to open shifts`); }
      resolveReq(r, 'Approved', note); commit(`Approved ${r.kind.toLowerCase()} for ${emp(r.emp).name}: ${r.detail}`);
      if (r.kind !== 'Time off') toast('Approved'); break; }
    case 'req-deny': {
      const note = val('note-'+v).trim();
      if (r.kind === 'Clock-in exception'){ const p = D().punches.find(x=>x.id===r.punchId); if (p){ p.exception='denied'; } }
      if (r.kind === 'Punch correction'){ const p = D().punches.find(x=>x.id===r.punchId); if (p) delete p.editPending; }
      if (EXT.deny[r.kind]) EXT.deny[r.kind](r, note);
      resolveReq(r, 'Denied', note); commit(`Denied ${r.kind.toLowerCase()} for ${emp(r.emp).name}${note?` · ${note}`:''}`); toast('Denied'); break; }
    case 'req-fix': {
      if (r.kind === 'Punch correction'){ modalPunch(r.punchId, {reqId:r.id, note:'Approved correction request'}); return; }
      const pl = r.payload || {}; const date = pl.date || toDateInput(r.t); const t = fromInputs(date, pl.time || '17:00');
      const d0 = new Date(date+'T00:00').getTime();
      const same = D().punches.find(p => p.emp===r.emp && !p.voided && p.inT>=d0 && p.inT<d0+DAY);
      if (same && /out/i.test(pl.type||'')){ modalPunch(same.id, {reqId:r.id, note:'Approved missed punch'}); setTimeout(()=>{ const o = document.getElementById('pe-out'); if (o) o.value = pl.time; }, 0); return; }
      if (same && /in/i.test(pl.type||'') && !/break/i.test(pl.type||'')){ modalPunch(same.id, {reqId:r.id, note:'Approved missed punch'}); setTimeout(()=>{ const o = document.getElementById('pe-in'); if (o) o.value = pl.time; }, 0); return; }
      if (same){ modalPunch(same.id, {reqId:r.id, note:'Approved missed punch'}); return; }
      const sch = D().shifts.find(s => s.emp===r.emp && s.startT>=d0 && s.startT<d0+DAY);
      const inT = /out/i.test(pl.type||'') ? (sch?.startT ?? t - 8*HR) : t;
      const outT = /out/i.test(pl.type||'') ? t : (sch?.endT ?? t + 8*HR);
      modalPunch(null, {reqId:r.id, note:'Approved missed punch', prefill:{emp:r.emp, inT, outT, venue:pl.venue, role:sch?.role}}); return; }
    case 'flag-ok': { const p = D().punches.find(x=>x.id===v); p.reviewed = true; commit(`Reviewed flagged punch ${p.id} for ${emp(p.emp).name}`); toast('Marked reviewed'); break; }

    /* timesheets */
    case 'ps': M.ps = v==='0' ? null : curPs() + Number(v)*CC.periodLen(); break;
    case 'punch-new': modalPunch(null); return;
    case 'punch-edit': { const p = D().punches.find(x=>x.id===v); if (isClosed(CC.periodStart(p.inT))){ toast('That period is closed. Reopen it on Payroll first.'); return; } modalPunch(v); return; }
    case 'pe-addbrk': { syncBrks(); const date = val('pe-date'), tin = val('pe-in'); const base = fromInputs(date, tin) + (v==='meal'?4*HR:2*HR); M.editBreaks.push({type:v, start:base, end:base + (v==='meal'?ST().mealMin:ST().restMin)*MIN}); applyBrkSync(); document.getElementById('pe-brks').innerHTML = brkRows(); return; }
    case 'pe-delbrk': { syncBrks(); M.editBreaks.splice(+v,1); applyBrkSync(); document.getElementById('pe-brks').innerHTML = brkRows(); return; }
    case 'pe-save': savePunch(v, el.dataset.req); return;
    case 'punch-del': {
      const p = D().punches.find(x=>x.id===v);
      if (!el.dataset.ok){ confirmModal('Delete this punch?', `${esc(emp(p.emp)?.name)} · ${fDate(p.inT)} ${fTime(p.inT)}–${p.outT?fTime(p.outT):'live'}. It&rsquo;s removed from timesheets and payroll. The deletion is kept in the activity log.`, 'punch-del', v); return; }
      p.voided = true; D().requests.filter(x=>x.punchId===v && x.status==='Pending').forEach(x=>resolveReq(x,'Denied','Punch removed'));
      commit(`Deleted punch ${p.id} for ${emp(p.emp)?.name} (${fDate(p.inT)})`); closeModal(); toast('Punch deleted'); break; }
    case 'ts-approve': { const ps = curPs(); (D().approvals[ps] ||= {})[v] = {t:now(), by:MGR()}; commit(`Approved timesheet for ${emp(v).name} (${fShort(ps)} period)`); toast('Timesheet approved'); break; }
    case 'ts-unapprove': { const ps = curPs(); delete (D().approvals[ps]||{})[v]; commit(`Removed timesheet approval for ${emp(v).name}`); break; }

    /* schedule */
    case 'wk': M.weekOff = v==='0' ? 0 : M.weekOff + Number(v); break;
    case 'shift-new': modalShift(null, false, v, el.dataset.d); return;
    case 'shift-edit': modalShift(v, false); return;
    case 'open-new': modalShift(null, true, null, el.dataset.d); return;
    case 'open-edit': modalShift(v, true); return;
    case 'shift-save': saveShift(v, !!el.dataset.open); return;
    case 'shift-del': {
      const isOpen = !!el.dataset.open;
      if (isOpen) D().openShifts = D().openShifts.filter(x=>x.id!==v); else { const s = D().shifts.find(x=>x.id===v); D().shifts = D().shifts.filter(x=>x.id!==v); CC.log(MGR(), `Removed shift for ${emp(s.emp)?.name} on ${fDate(s.startT)}`); }
      commit(isOpen ? 'Removed an open shift' : null); closeModal(); toast('Shift deleted'); break; }
    case 'copy-week': {
      const ws = weekStart(M.weekOff), prev = D().shifts.filter(s => s.startT >= ws-7*DAY && s.startT < ws);
      if (!prev.length){ toast('Last week has no shifts to copy'); return; }
      let n = 0; prev.forEach(s => { const ns = {...s, id:CC.id('S'), startT:s.startT+7*DAY, endT:s.endT+7*DAY};
        if (!D().shifts.some(x => x.emp===ns.emp && x.startT < ns.endT && x.endT > ns.startT)){ D().shifts.push(ns); n++; } });
      commit(`Copied ${n} shift${n===1?'':'s'} into week of ${fShort(ws)}`); toast(n ? `Copied ${n} shift${n===1?'':'s'}` : 'Those shifts are already scheduled'); break; }

    /* crew */
    case 'emp-new': modalEmp(null); return;
    case 'emp-edit': modalEmp(v); return;
    case 'em-addrole': syncRoles(); M.editRoles.push({role:'', rate:20}); document.getElementById('em-roles').innerHTML = roleRows(); return;
    case 'em-delrole': syncRoles(); if (M.editRoles.length>1) M.editRoles.splice(+v,1); document.getElementById('em-roles').innerHTML = roleRows(); return;
    case 'emp-save': saveEmp(v); return;
    case 'emp-del': {
      const e = emp(v); const has = D().punches.some(p=>p.emp===v && !p.voided);
      if (CC.liveFor(v)){ toast('Clock them out first'); return; }
      if (!el.dataset.ok){ confirmModal(`Delete ${esc(e.name)}?`, has ? 'They have time records, so they&rsquo;ll be set to inactive instead. Their punches stay in payroll history and their future shifts are removed.' : 'This removes them and their future shifts.', 'emp-del', v, has?'Deactivate':'Delete'); return; }
      D().shifts = D().shifts.filter(s => !(s.emp===v && s.startT >= startOfDay(now())));
      if (has) e.active = false; else D().employees = D().employees.filter(x=>x.id!==v);
      commit(`${has?'Deactivated':'Deleted'} crew member ${e.name}`); closeModal(); toast(has?'Set to inactive':'Deleted'); break; }

    /* venues */
    case 'venue-new': modalVenue(null); return;
    case 'venue-edit': modalVenue(v); return;
    case 'venue-save': saveVenue(v); return;
    case 'vn-here':
      if (!navigator.geolocation){ toast('This browser has no location access'); return; }
      toast('Asking for your location…');
      navigator.geolocation.getCurrentPosition(pos => { document.getElementById('vn-lat').value = pos.coords.latitude.toFixed(5); document.getElementById('vn-lng').value = pos.coords.longitude.toFixed(5); toast('Location filled in'); },
        () => toast('Location blocked here. Enter coordinates instead.'), {enableHighAccuracy:true, timeout:10000});
      return;
    case 'venue-del': {
      const vv = D().venues.find(x=>x.id===v);
      const used = D().punches.some(p=>p.venue===v) || D().shifts.some(s=>s.venue===v) || livePunches().some(p=>p.venue===v);
      if (!el.dataset.ok){ confirmModal(`Delete ${esc(vv.name)}?`, used ? 'This venue has punches or shifts, so it will be turned off instead. Its history stays intact.' : 'This removes the geofence.', 'venue-del', v, used?'Turn off':'Delete'); return; }
      if (used) vv.active = false; else D().venues = D().venues.filter(x=>x.id!==v);
      commit(`${used?'Turned off':'Deleted'} venue ${vv.name}`); closeModal(); toast(used?'Venue turned off':'Venue deleted'); break; }

    /* payroll */
    case 'csv': csv(v); return;
    case 'ap-all': { const ps = curPs(); const pe = ps + CC.periodLen(); let n=0;
      D().employees.forEach(e => { if (D().punches.some(p=>p.emp===e.id && !p.voided && p.inT>=ps && p.inT<pe)){ (D().approvals[ps] ||= {})[e.id] = {t:now(), by:MGR()}; n++; } });
      commit(`Approved all ${n} timesheets for ${fShort(ps)} period`); toast(`${n} timesheets approved`); break; }
    case 'period-close': { const ps = curPs();
      if (!el.dataset.ok){ confirmModal('Close this pay period?', 'Timesheets for this period are locked. You can reopen it later if something needs fixing.', 'period-close', '', 'Close period'); return; }
      D().closedPeriods[ps] = {t:now(), by:MGR()}; commit(`Closed pay period starting ${fShort(ps)}`); closeModal(); toast('Period closed'); break; }
    case 'period-reopen': { const ps = curPs(); delete D().closedPeriods[ps]; commit(`Reopened pay period starting ${fShort(ps)}`); toast('Period reopened'); break; }

    /* announcements */
    case 'an-post': { const t = val('anText').trim(); if (!t){ toast('Write the announcement first'); return; } const vid = val('anVenue') || null;
      const until = val('anUntil'), board = chk('anBoard');
      const boardUntil = until==='today' ? startOfDay(now()) + DAY : now() + parseInt(until)*DAY;
      D().announcements.unshift({id:CC.id('A'), text:t, t:now(), venue:vid, board, boardUntil, urgent:chk('anUrgent'), ack:chk('anAck'), readBy:{}});
      if (chk('anSms')) audience(vid).forEach(e => CC.notify(e.id, `${ST().company}: ${t}`, 'SMS', 'announcement')); commit(`Posted announcement${vid?` for ${venue(vid).name}`:' to all crew'}`); toast('Posted to the crew app'); break; }
    case 'an-del': D().announcements = D().announcements.filter(a=>a.id!==v); commit('Deleted an announcement'); break;

    /* rules */
    case 'rules-save': {
      const s = ST(); const n = k => { const x = parseFloat(val('st-'+k)); return isFinite(x) ? x : s[k]; };
      const pin = val('st-managerPin').trim();
      if (!/^\d{4}$/.test(pin)){ toast('Manager PIN must be 4 digits'); return; }
      if (D().employees.some(e=>e.pin===pin && e.active!==false)){ toast('A crew member already uses that PIN'); return; }
      const next = {...s, otDaily:n('otDaily'), dtDaily:n('dtDaily'), otWeekly:n('otWeekly'), otMult:n('otMult'), dtMult:n('dtMult'), mealByHour:n('mealByHour'), mealMin:n('mealMin'), restPer:n('restPer'), restMin:n('restMin'),
        earlyMin:n('earlyMin'), lateGrace:n('lateGrace'), autoClockOutHrs:n('autoClockOutHrs'), paydayLag:n('paydayLag'), periodDays:parseInt(val('st-periodDays'))||14, payAnchor:val('st-payAnchor')||s.payAnchor,
        mealPremium:chk('st-mealPremium'), blockEarly:chk('st-blockEarly'), allowUnscheduled:chk('st-allowUnscheduled'), allowWeakGps:chk('st-allowWeakGps'), allowExceptions:chk('st-allowExceptions'), requireSelfie:chk('st-requireSelfie'),
        managerName:val('st-managerName').trim()||s.managerName, managerPin:pin,
        breakWarnMin:n('breakWarnMin'), breakLateMin:n('breakLateMin'), allowNfc:chk('st-allowNfc'), allowKiosk:chk('st-allowKiosk'), nfcPairing:chk('st-nfcPairing'), nfcSelfie:chk('st-nfcSelfie'), crewAppUrl:val('st-crewAppUrl').trim(),
        breakPlan:[...document.querySelectorAll('#bpRows .bp-row')].map(r => { const kind = r.querySelector('.bp-kind').value, min = parseFloat(r.querySelector('.bp-min').value)||10;
          return {kind, label:r.querySelector('.bp-label').value.trim() || (kind==='meal' ? 'Lunch break' : `${min}-min break`), min, at:parseFloat(r.querySelector('.bp-at').value)||0, minShift:parseFloat(r.querySelector('.bp-ms').value)||0}; }).sort((a,b)=>a.at-b.at)};
      if (next.crewAppUrl && !/^https?:\/\//i.test(next.crewAppUrl)){ toast('Crew app address must start with https://'); return; }
      if (next.dtDaily <= next.otDaily){ toast('Double time must start after daily overtime'); return; }
      if (next.restPer <= 0){ toast('Rest break interval must be above zero'); return; }
      const changed = Object.keys(next).filter(k => k!=='managerPin' && JSON.stringify(next[k]) !== JSON.stringify(s[k]));
      D().settings = next; commit(`Updated rules${changed.length?`: ${changed.join(', ')}`:''}`); M.ps = null; toast('Rules saved'); break; }
    case 'bp-add': document.getElementById('bpRows').insertAdjacentHTML('beforeend', bpRow()); return;
    case 'bp-del': el.closest('.bp-row').remove(); return;
    /* nfc */
    case 'tag-new': modalTag(); return;
    case 'tag-save': { const vid = val('tg-venue'), label = val('tg-label').trim(); if (!vid){ toast('Pick a venue'); return; } if (!label){ toast('Say where the sticker is'); return; }
      D().nfcTags.push({id:CC.id('T'), code:CC.newTagCode(vid), venue:vid, label, active:true, taps:0, lastTapT:null, lastEmp:null}); closeModal(); commit(`Added NFC sticker "${label}" at ${venue(vid).name}`); toast('Sticker added. Copy its link to program it.'); break; }
    case 'tag-copy': { const t = D().nfcTags.find(x=>x.id===v); const url = CC.tagUrl(t);
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(()=>toast('Link copied'), ()=>{ openModal(`${mHead('Sticker link','Copy this link into NFC Tools.')}<input class="input mono" readonly value="${esc(url)}" onfocus="this.select()"><div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn sm" data-act="close">Done</button></div>`); }); return; }
    case 'tag-test': { const t = D().nfcTags.find(x=>x.id===v); window.open(CC.tagUrl(t), '_blank', 'noopener'); return; }
    case 'tag-write': { const t = D().nfcTags.find(x=>x.id===v); toast('Hold a blank sticker to the back of the phone');
      try { new NDEFReader().write({records:[{recordType:'url', data:CC.tagUrl(t)}]}).then(()=>{ CC.log(MGR(), `Wrote NFC sticker "${t.label}"`); CC.save(); toast('Sticker written'); }, e=>toast('Could not write: ' + (e.message||'try again'))); } catch(e){ toast("This browser can't write stickers"); }
      return; }
    case 'tag-rotate': { const t = D().nfcTags.find(x=>x.id===v); t.code = CC.newTagCode(t.venue); commit(`Issued a new code for sticker "${t.label}"`); toast('New code. Rewrite this sticker; the old one no longer works.'); break; }
    case 'tag-toggle': { const t = D().nfcTags.find(x=>x.id===v); t.active = t.active === false; commit(`Turned ${t.active?'on':'off'} sticker "${t.label}"`); break; }
    case 'tag-del': { const t = D().nfcTags.find(x=>x.id===v); if (!el.dataset.sure){ el.dataset.sure = '1'; el.innerHTML = 'Delete?'; el.classList.add('danger'); return; }
      D().nfcTags = D().nfcTags.filter(x=>x.id!==v); commit(`Deleted sticker "${t.label}"`); toast('Sticker deleted'); break; }
    case 'dev-unlink': { const d = D().devices[v]; delete D().devices[v]; commit(`Unlinked a phone for ${emp(d?.emp)?.name || 'a crew member'}`); toast('Phone unlinked'); break; }
    default: if (EXT.acts[act]){ const res = EXT.acts[act](el, v, ev); if (res === false) return; } break;
    case 'rules-default': { const pin = ST().managerPin, name = ST().managerName; D().settings = {...CC.DEFAULT_SETTINGS, managerPin:pin, managerName:name}; commit('Restored default rules'); toast('Defaults restored'); break; }
  }
  const y = window.scrollY; render(); window.scrollTo(0, y);
});
function applyBrkSync(){
  const date = val('pe-date');
  (M.editBreaks||[]).forEach(b => { if (b._st !== undefined){ b.start = fromInputs(date, b._st); delete b._st; } if (b._min !== undefined){ b.end = b._min==='' ? undefined : b.start + Number(b._min)*MIN; if (b.end===undefined) delete b.end; delete b._min; } });
}
document.addEventListener('change', ev => {
  const el = ev.target.closest('[data-act-change]'); if (!el) return;
  const a = el.dataset.actChange;
  if (a === 'ts-emp'){ M.tsEmp = el.value; render(); }
  if (a === 'ts-issues'){ M.tsIssues = el.checked; render(); }
  if (a === 'pe-emp' || a === 'ci-emp'){ const e = emp(el.value); const sel = document.getElementById(a==='pe-emp'?'pe-role':'ci-role'); sel.innerHTML = roleOpts(e); const rt = document.getElementById('pe-rate'); if (rt) rt.value = (e.roles[0]?.rate||0).toFixed(2); const vn = document.getElementById(a==='pe-emp'?'pe-venue':'ci-venue'); if (vn) vn.value = e.home; }
  if (a === 'pe-role'){ const o = el.selectedOptions[0]; const rt = document.getElementById('pe-rate'); if (o && rt) rt.value = Number(o.dataset.rate).toFixed(2); }
  if (EXT.changes[a]){ EXT.changes[a](el, ev); return; }
  if (a === 'sh-emp'){ const e = emp(el.value); document.getElementById('sh-role').innerHTML = e.roles.map(r=>`<option>${esc(r.role)}</option>`).join(''); document.getElementById('sh-venue').value = e.home; }
});
document.addEventListener('input', ev => {
  const el = ev.target.closest('[data-act-input]'); if (!el) return;
  if (el.dataset.actInput === 'crew-q'){ M.crewQ = el.value; const pos = el.selectionStart; render(); const n = document.querySelector('[data-act-input=crew-q]'); if (n){ n.focus(); n.setSelectionRange(pos,pos); } }
});
document.addEventListener('keydown', ev => {
  if (ev.key === 'Escape' && modalRoot.innerHTML) closeModal();
  if (!M.authed && /^[0-9]$/.test(ev.key) && !modalRoot.innerHTML){ document.querySelector(`[data-act=key][data-v="${ev.key}"]`)?.click(); }
});
window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (h && h !== M.page){ M.page = h; render(); } });

/* ---------- Live updates ---------- */
CC.subscribe((prev, next) => {
  if (M.authed){
    const newReq = next.requests.filter(r => r.status==='Pending' && !prev.requests.some(x=>x.id===r.id));
    const newIn = next.punches.filter(p => !p.outT && !prev.punches.some(x=>x.id===p.id));
    const newOut = next.punches.filter(p => p.outT && prev.punches.some(x=>x.id===p.id && !x.outT));
    if (newReq.length) toast(`New request: ${newReq[0].kind} from ${emp(newReq[0].emp)?.name}`);
    else if (newIn.length) toast(`${emp(newIn[0].emp)?.name} clocked in at ${venue(newIn[0].venue).name}`);
    else if (newOut.length) toast(`${emp(newOut[0].emp)?.name} clocked out`);
  }
  if (!modalRoot.innerHTML){ const y = window.scrollY; render(); window.scrollTo(0,y); }
});
let lastMin = -1;
setInterval(() => {
  if (!M.authed) return;
  document.querySelectorAll('[data-t=worked]').forEach(el => { const p = D().punches.find(x=>x.id===el.dataset.id); if (p) el.textContent = fDur(workedMs(p)); });
  const m = Math.floor(now()/MIN);
  if (m !== lastMin && !modalRoot.innerHTML && !M.demoOpen && !document.activeElement?.matches('input,textarea,select')){ lastMin = m; const y = window.scrollY; render(); window.scrollTo(0,y); }
}, 1000);

window.MGR = {M, EXT, PAGES, D, ST, emp, venue, MGR, commit, toast, openModal, closeModal, mHead, val, chk, avatar, badge, kpi, empty, vIcon, render,
  weekStart, venueOpts, roleOpts, activeEmps, livePunches, todaysShifts, shiftStatus, laborCost, curPs, periodNav, isClosed, audience, resolveReq, csv,
  addPage(key, icon, label, group, fn, after){ const i = after ? PAGES.findIndex(p=>p[0]===after) : -1; const row = [key, icon, label, group]; if (i >= 0) PAGES.splice(i+1, 0, row); else PAGES.push(row); EXT.fns[key] = fn; },
};
CC.ready.then(() => setTimeout(render, 0));
})();
