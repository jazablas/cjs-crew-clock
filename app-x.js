/* CJ's Crew Clock — crew app additions: team chat, checklists, announcements with read receipts,
   shift confirm / swap / release / instant pick-up, availability, early pay, paperwork, training,
   notifications, suggestion box, role switching, late / early reasons and the post-shift survey. */
(() => {
'use strict';
const {ic, MIN, HR, DAY, now, startOfDay, at, fTime, fDate, money, esc} = CC;
const A = window.APP, XA = window.XA, S = A.S;
const D = () => CC.db, ST = () => CC.db.settings;
const commit = () => CC.save();
const me = () => A.emp();
const EMPS = () => D().employees.filter(e => e.active !== false);
const first = e => e ? e.name.split(' ')[0] : 'Someone';
const nameOf = id => id === 'mgr' ? 'Manager' : CC.empById(id)?.name || 'Crew';
const realShift = id => D().shifts.find(x => x.id === id);
const val = id => document.getElementById(id)?.value ?? '';
const badge = (t, k='') => `<span class="badge ${k}">${t}</span>`;
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
let saveT = null; const softSave = () => { clearTimeout(saveT); saveT = setTimeout(commit, 50); };

/* ---------- Announcements with seen / confirm ---------- */
function myAnns(){
  const e = me(); const mine = A.scheduleFor(e).map(s=>s.venue);
  return D().announcements.filter(a => !a.venue || mine.includes(a.venue) || e.home === a.venue);
}
XA.annCards = () => {
  const list = myAnns().slice(0, 3); let changed = false;
  const html = list.map(a => { a.readBy ||= {};
    if (!a.ack && !a.readBy[S.user]){ a.readBy[S.user] = now(); changed = true; }
    const need = a.ack && !a.readBy[S.user];
    return `<div class="alert ${a.urgent?'bad':'info'}" style="margin-bottom:12px">${ic('mega')}<div class="grow"><b>${a.venue ? esc(A.venueById(a.venue).name) : 'All crew'}:</b> ${esc(a.text)}
      <div class="small" style="opacity:.75;margin-top:3px">${fDate(a.t)} · ${fTime(a.t)}${a.ack && !need ? ' · You confirmed' : ''}</div>
      ${need ? `<button class="btn sm primary" style="margin-top:10px;width:auto" data-act="ann-ack" data-v="${a.id}">${ic('check')} Got it</button>` : ''}</div></div>`; }).join('');
  if (changed) softSave();
  return html;
};
XA.acts['ann-ack'] = (el, v) => { const a = D().announcements.find(x=>x.id===v); if (a){ (a.readBy ||= {})[S.user] = now(); CC.log(me().name, `Confirmed announcement: ${a.text.slice(0,40)}`); commit(); A.toast('Thanks, your manager can see you read it'); } };

/* ---------- Clock tab extras ---------- */
function checklistNudge(venueId){
  const lists = CC.checklistsFor(venueId); if (!lists.length) return '';
  const rows = lists.map(c => { const r = CC.runFor(c.id, now()), p = CC.listProgress(c, r); return {c, p}; }).filter(x => !x.p.complete && x.p.due - now() < 3*HR && x.p.due - now() > -6*HR);
  return rows.map(({c, p}) => `<button class="card cl-nudge ${p.late?'late':''}" data-act="cl-open" data-v="${c.id}">
    <span class="vt" style="width:36px;height:36px">${ic('checklist')}</span>
    <span class="grow" style="text-align:left"><span class="title" style="font-size:14.5px;display:block">${esc(c.name)}</span><span class="meta">${p.d} of ${p.n} done · ${p.late ? `<b style="color:var(--bad)">was due ${fTime(p.due)}</b>` : `due ${fTime(p.due)}`}</span></span>${ic('chev')}</button>`).join('');
}
XA.clockTop = sh => {
  let h = '';
  if (sh && ST().confirmShifts){ const r = realShift(sh.id);
    if (r && !r.confirmed) h += `<div class="alert warn" style="margin-bottom:12px">${ic('cal')}<div class="grow"><b>Confirm today&rsquo;s shift</b> so your manager knows you&rsquo;re coming.<div style="margin-top:10px"><button class="btn sm primary" style="width:auto" data-act="sh-confirm" data-v="${r.id}">${ic('check')} I&rsquo;ll be there</button></div></div></div>`; }
  return h + (sh ? checklistNudge(sh.venue) : '');
};
XA.onClock = sh => {
  const e = me();
  return `${e.roles.length > 1 ? `<button class="btn ghost" style="margin-top:10px" data-act="switch-role">${ic('swap')} Switch role (now ${esc(sh.role)})</button>` : ''}
    <div style="margin-top:12px">${checklistNudge(sh.venue)}</div>`;
};
XA.acts['switch-role'] = () => { const e = me(), sh = S.shift;
  A.openSheet(`<h3>Switch role</h3><p class="muted small">Moving to a different station? Your hours from now on are paid at that role&rsquo;s rate.</p>
    <div class="list" style="margin-top:12px">${e.roles.map(r => `<button class="li" style="width:100%;text-align:left" data-act="do-switch" data-v="${esc(r.role)}" ${r.role===sh.role?'disabled':''}><div class="grow"><div class="title" style="font-size:14.5px">${esc(r.role)}</div><div class="meta">${money(r.rate)}/hr</div></div>${r.role===sh.role?badge('Current','ok'):ic('chev')}</button>`).join('')}</div>
    <button class="btn ghost" style="margin-top:12px" data-act="close">Cancel</button>`); return false; };
XA.acts['do-switch'] = (el, v) => { const sh = S.shift, r = me().roles.find(x=>x.role===v); if (!sh || !r) return;
  sh.roleLog ||= [{t:sh.inT, role:sh.role, rate:sh.rate}]; sh.roleLog.push({t:now(), role:r.role, rate:r.rate});
  sh.role = r.role; sh.rate = r.rate; CC.log(me().name, `Switched role to ${r.role} mid-shift`); commit(); A.closeSheet(); A.toast(`Now working as ${r.role}`); };
XA.acts['sh-confirm'] = (el, v) => { const s = realShift(v); if (s){ s.confirmed = now(); CC.log(me().name, `Confirmed shift ${fDate(s.startT)} ${fTime(s.startT)}`); commit(); A.toast('Shift confirmed'); } };

/* ---------- Late / early / unscheduled reasons ---------- */
const LATE = ['Traffic or transit delay','Family or personal emergency','Manager asked me to come later','Forgot to clock in on time','Other'];
const UNSCHED = ['Manager asked me to come in','Covering for a coworker','Event or catering pickup','Other'];
const EARLY = ['Manager sent me home (slow)','Not feeling well','Personal or family emergency','Finished my tasks, manager OK’d it','Other'];
XA.inReason = (sh, flags) => { if (!ST().attestLateEarly) return '';
  const late = sh && now() > sh.startT + ST().lateGrace*MIN && now() < sh.endT;
  if (!late && sh) return '';
  return `<label class="field"><span>${late ? `You&rsquo;re ${CC.fHM(now()-sh.startT)} late. What happened?` : 'You&rsquo;re not on the schedule. Why are you coming in?'}</span>
    <select class="input" id="inReason" data-k="${late?'late':'unscheduled'}">${(late?LATE:UNSCHED).map(o=>`<option>${o}</option>`).join('')}</select></label>`;
};
XA.afterIn = p => { const el = document.getElementById('inReason'); if (!el) return;
  (p.attestations ||= []).push({kind:el.dataset.k, reason:el.value, t:now()}); if (el.dataset.k==='late') (p.flags ||= []).push('Clocked in late'); };
XA.outReason = p => { if (!ST().attestLateEarly) return ''; const sh = A.todaysShift();
  if (!sh || now() >= sh.endT - ST().leaveEarlyMin*MIN || now() < sh.startT) return '';
  return `<label class="field"><span>Your shift ends at ${fTime(sh.endT)}. Why are you leaving early?</span><select class="input" id="outReason">${EARLY.map(o=>`<option>${o}</option>`).join('')}</select></label>`;
};
XA.afterOut = p => { const el = document.getElementById('outReason'); if (!el) return;
  (p.attestations ||= []).push({kind:'early', reason:el.value, t:now()}); (p.flags ||= []).push('Left early'); };
XA.receiptExtra = en => !ST().surveyOnOut ? '' : `<div class="card survey" id="survey" style="margin-top:14px;text-align:center"><div class="label">How was your shift?</div>
  <div class="row" style="justify-content:center;gap:6px;margin-top:10px">${[1,2,3,4,5].map(n => `<button class="rate" data-act="rate" data-v="${n}" data-p="${en.id}" aria-label="${n} of 5">${n}</button>`).join('')}</div>
  <div class="row between small faint" style="margin-top:6px"><span>Rough</span><span>Great</span></div>
  <input class="input" id="rateNote" style="margin-top:10px" placeholder="Anything we should know? (optional)"></div>`;
XA.acts.rate = (el, v) => { const p = D().punches.find(x=>x.id===el.dataset.p);
  D().feedback.push({id:CC.id('F'), emp:S.user, t:now(), score:+v, venue:p?.venue, note:val('rateNote').trim(), punch:p?.id}); commit();
  const s = document.getElementById('survey'); if (s) s.innerHTML = `<div class="small">${ic('check','" style="width:16px;height:16px;color:var(--ok);vertical-align:-3px')} Thanks. Your manager sees these to fix rough shifts.</div>`; return false; };

/* ---------- Schedule tab ---------- */
const pendingFor = sid => S.requests.filter(r => r.status==='Pending' && ((r.kind==='Shift swap' && r.payload?.shift===sid) || (r.kind==='Shift release' && r.ref===sid)));
XA.shiftActions = s => {
  const t0 = startOfDay(now()), r = realShift(s.id), out = [];
  if (s.day === t0) out.push(badge('Today','ok'));
  if (r && r.startT > now()){
    const pend = pendingFor(r.id)[0];
    if (pend) out.push(badge(pend.kind==='Shift swap' ? (pend.peer==='pending' ? 'Swap offered' : 'Swap: manager review') : 'Release pending', 'info'));
    else {
      if (ST().confirmShifts) out.push(r.confirmed ? badge('Confirmed','ok') : `<button class="btn sm primary" data-act="sh-confirm" data-v="${r.id}">Confirm</button>`);
      out.push(`<button class="btn sm" data-act="sh-trade" data-v="${r.id}">Swap or drop</button>`);
    }
  }
  return `<div class="sh-acts">${out.join('')}</div>`;
};
XA.schedTop = () => {
  const offers = D().requests.filter(r => r.kind==='Shift swap' && r.status==='Pending' && r.peer==='pending' && r.payload?.to===S.user);
  const av = D().availability?.[S.user];
  return `${offers.map(r => { const s = realShift(r.payload.shift), th = r.payload.theirShift && realShift(r.payload.theirShift); if (!s) return '';
    return `<div class="alert info" style="margin-bottom:12px">${ic('swap')}<div class="grow"><b>${esc(first(CC.empById(r.emp)))} wants to swap.</b> You&rsquo;d take ${fDate(s.startT)} ${fTime(s.startT)}–${fTime(s.endT)} · ${esc(s.role)} at ${esc(A.venueById(s.venue).name)}${th ? `, and they&rsquo;d take your ${fDate(th.startT)} ${fTime(th.startT)} shift` : ''}.
      <div class="row" style="gap:8px;margin-top:10px"><button class="btn sm primary" style="width:auto" data-act="swap-yes" data-v="${r.id}">Accept</button><button class="btn sm" style="width:auto" data-act="swap-no" data-v="${r.id}">No thanks</button></div></div></div>`; }).join('')}
    <div class="card row" style="gap:12px;margin-bottom:12px"><span class="vt" style="width:38px;height:38px">${ic('cal')}</span><div class="grow"><div class="title" style="font-size:14.5px">Your availability</div><div class="meta">${av ? `Updated ${fDate(av.t)}. Your manager schedules around it.` : 'Tell your manager when you can work.'}</div></div><button class="btn sm" data-act="av-open">Edit</button></div>`;
};
XA.openAction = (o, req) => { if (!o.auto) return null;
  if (o.from === S.user) return badge('You released this','info');
  if (o.eligible && !o.eligible.includes(S.user)) return badge('Not eligible');
  return `<button class="btn sm primary" data-act="pickup" data-v="${o.id}">Pick up</button>`; };
XA.acts.pickup = (el, v) => { const o = D().openShifts.find(x=>x.id===v); if (!o?.auto) return true;
  if (o.eligible && !o.eligible.includes(S.user)){ A.toast('This shift is offered to other crew'); return false; }
  const e = me(); const role = e.roles.find(r=>r.role===o.role) ? o.role : e.roles[0].role;
  if (o.from){ const old = D().shifts.find(s => s.emp===o.from && s.startT===o.startT && s.venue===o.venue); if (old){ old.emp = e.id; old.role = role; old.confirmed = now(); CC.markScheduleChange(old); } else D().shifts.push({id:CC.id('S'), emp:e.id, venue:o.venue, startT:o.startT, endT:o.endT, role, station:o.note||'', confirmed:now()});
    D().requests.filter(r => r.kind==='Shift release' && r.emp===o.from && r.status==='Approved').forEach(r => r.mgrNote = `Picked up by ${e.name}`); CC.notify(o.from, `${e.name} picked up your ${fDate(o.startT)} shift. You're off it.`, 'Push', 'swap'); }
  else D().shifts.push({id:CC.id('S'), emp:e.id, venue:o.venue, startT:o.startT, endT:o.endT, role, station:o.note||'', confirmed:now()});
  o.spots = (o.spots ?? 1) - 1; if (o.spots <= 0) D().openShifts = D().openShifts.filter(x => x.id !== o.id);
  CC.notify('mgr', `${e.name} picked up ${fDate(o.startT)} ${fTime(o.startT)}–${fTime(o.endT)} at ${A.venueById(o.venue).name}.`, 'Push', 'swap');
  CC.log(e.name, `Picked up open shift ${fDate(o.startT)} ${fTime(o.startT)}`); commit(); A.toast('It’s yours. Added to your schedule.'); A.render(); return false; };
XA.acts['sh-trade'] = (el, v) => { const s = realShift(v), e = me();
  const mates = EMPS().filter(x => x.id !== e.id && x.roles.some(r => r.role === s.role)).sort((a,b) => !!CC.availCheck(a.id, s.startT, s.endT) - !!CC.availCheck(b.id, s.startT, s.endT));
  A.openSheet(`<h3>Swap or drop</h3><p class="muted small">${fDate(s.startT)} · ${fTime(s.startT)}–${fTime(s.endT)} · ${esc(s.role)} at ${esc(A.venueById(s.venue).name)}</p>
    <div class="label" style="margin-top:16px">Swap with a coworker</div>
    <label class="field"><span>Who?</span><select class="input" id="swTo">${mates.map(m => `<option value="${m.id}">${esc(m.name)}${CC.availCheck(m.id, s.startT, s.endT) ? ' · not available' : ''}</option>`).join('')}</select></label>
    <label class="field"><span>Take one of their shifts in return? (optional)</span><select class="input" id="swTheir"><option value="">No, they just take mine</option></select></label>
    <button class="btn primary" style="margin-top:12px" data-act="swap-send" data-v="${s.id}" ${mates.length?'':'disabled'}>${ic('swap')} Send swap offer</button>
    <div class="label" style="margin-top:20px">Or give it up</div>
    <p class="small muted" style="margin-top:4px">Your manager approves, then it&rsquo;s offered to eligible crew. You stay on it until someone picks it up.</p>
    <button class="btn" style="margin-top:10px" data-act="rel-send" data-v="${s.id}">Release this shift</button>
    <button class="btn ghost" style="margin-top:8px" data-act="close">Cancel</button>`);
  const fill = () => { const to = val('swTo'), sel = document.getElementById('swTheir'); if (!sel) return;
    sel.innerHTML = '<option value="">No, they just take mine</option>' + D().shifts.filter(x => x.emp===to && x.startT > now() && x.startT < now()+14*DAY).sort((a,b)=>a.startT-b.startT).map(x => `<option value="${x.id}">${fDate(x.startT)} ${fTime(x.startT)}–${fTime(x.endT)} · ${esc(x.role)}</option>`).join(''); };
  document.getElementById('swTo')?.addEventListener('change', fill); fill(); return false; };
XA.acts['swap-send'] = (el, v) => { const s = realShift(v), to = val('swTo'), th = val('swTheir'); const m = CC.empById(to); if (!m) return false;
  A.addRequest({kind:'Shift swap', detail:`${fDate(s.startT)} ${fTime(s.startT)}–${fTime(s.endT)} with ${m.name}${th ? ` (I take their ${fDate(realShift(th).startT)})` : ''}`, payload:{shift:s.id, to, theirShift:th||null}, peer:'pending'});
  CC.notify(to, `${me().name} wants to swap shifts with you. Open the Schedule tab to answer.`, 'Push', 'swap'); commit(); A.closeSheet(); A.toast(`Offer sent to ${first(m)}`); };
XA.acts['rel-send'] = (el, v) => { const s = realShift(v);
  A.addRequest({kind:'Shift release', detail:`${fDate(s.startT)} ${fTime(s.startT)}–${fTime(s.endT)} · ${s.role} at ${A.venueById(s.venue).name}`, ref:s.id}); commit(); A.closeSheet(); A.toast('Sent to your manager'); };
XA.acts['swap-yes'] = (el, v) => { const r = D().requests.find(x=>x.id===v); if (!r) return; r.peer = 'accepted'; r.peerT = now();
  CC.notify(r.emp, `${me().name} accepted your swap. Waiting on your manager.`, 'Push', 'swap'); CC.notify('mgr', `Swap ready to approve: ${CC.empById(r.emp).name} and ${me().name}.`, 'Push', 'swap'); commit(); A.toast('Accepted. Your manager will approve it.'); };
XA.acts['swap-no'] = (el, v) => { const r = D().requests.find(x=>x.id===v); if (!r) return; r.peer = 'declined'; r.peerT = now(); r.status = 'Denied'; r.mgrNote = `${me().name} declined`;
  CC.notify(r.emp, `${me().name} can't take your swap.`, 'Push', 'swap'); commit(); A.toast('Declined'); };
XA.acts['av-open'] = () => { const a = D().availability?.[S.user] || {days:{}};
  A.openSheet(`<h3>Your availability</h3><p class="muted small">Your manager sees this when building the schedule.</p>
    <div class="av-list" style="margin-top:12px">${[1,2,3,4,5,6,0].map(d => { const x = a.days?.[d]; const on = !x || !x.off; return `<div class="av-r"><label class="check" style="margin:0"><input type="checkbox" class="avc" data-d="${d}" ${on?'checked':''}><span><b>${DOW[d]}</b></span></label>
      <input class="input sm avf" data-d="${d}" type="time" value="${x?.from||'08:00'}" aria-label="${DOW[d]} from"><span class="faint">to</span><input class="input sm avt" data-d="${d}" type="time" value="${x?.to||'23:00'}" aria-label="${DOW[d]} to"></div>`; }).join('')}</div>
    <label class="field"><span>Note for your manager (optional)</span><input class="input" id="avNote" value="${esc(a.note||'')}" placeholder="e.g. Class Tue and Thu until 2 PM"></label>
    <div class="btn-grid" style="margin-top:16px"><button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="av-save">Save</button></div>`); return false; };
XA.acts['av-save'] = () => { const days = {};
  document.querySelectorAll('.avc').forEach(c => { const d = c.dataset.d; days[d] = c.checked ? {from:document.querySelector(`.avf[data-d="${d}"]`).value||'00:00', to:document.querySelector(`.avt[data-d="${d}"]`).value||'23:59'} : {off:true}; });
  (D().availability ||= {})[S.user] = {days, note:val('avNote').trim(), t:now()};
  CC.notify('mgr', `${me().name} updated their availability.`, 'Push', 'avail'); CC.log(me().name, 'Updated availability'); commit(); A.closeSheet(); A.toast('Availability saved'); };

/* ---------- Team tab: chat, checklists, news ---------- */
const TS = {sub:'chat', ch:null};
function chUnread(){ return CC.channelsFor(S.user).reduce((a,c)=>a + CC.unread(S.user, c.id), 0); }
XA.tabBadge = k => k==='team' ? chUnread() + myAnns().filter(a => a.ack && !(a.readBy||{})[S.user]).length : k==='me' ? myTodo() : 0;
function renderTeam(){
  const subs = [['chat','Chat', chUnread()], ['lists','Checklists', 0], ['news','News', myAnns().filter(a => a.ack && !(a.readBy||{})[S.user]).length]];
  return `<div class="seg team-seg" role="tablist">${subs.map(([k,l,n]) => `<button role="tab" aria-selected="${TS.sub===k}" class="${TS.sub===k?'on':''}" data-act="team-sub" data-v="${k}">${l}${n?` <b class="tab-n in">${n}</b>`:''}</button>`).join('')}</div>
    <div style="margin-top:14px">${TS.sub==='chat' ? renderChat() : TS.sub==='lists' ? renderLists() : renderNews()}</div>`;
}
XA.tabs.team = renderTeam;
XA.acts['team-sub'] = (el, v) => { TS.sub = v; TS.ch = null; };
function renderChat(){
  const chs = CC.channelsFor(S.user);
  if (!TS.ch) return `<div class="list">${chs.map(c => { const last = CC.chMsgs(c.id).slice(-1)[0], n = CC.unread(S.user, c.id);
    return `<button class="li ch-row" data-act="ch-open" data-v="${c.id}"><span class="vt" style="width:38px;height:38px">${ic(c.dm?'user':'chat')}</span><div class="grow" style="min-width:0;text-align:left"><div class="title" style="font-size:14.5px">${esc(c.dm ? 'Message your manager' : c.name)}</div><div class="meta ellipsis">${last ? `${esc(last.from===S.user?'You':first({name:nameOf(last.from)}))}: ${esc(last.text)}` : 'No messages yet'}</div></div>${n ? `<b class="tab-n in">${n}</b>` : last ? `<span class="small faint">${fTime(last.t)}</span>` : ''}</button>`; }).join('')}</div>`;
  const c = chs.find(x=>x.id===TS.ch); if (!c){ TS.ch = null; return renderChat(); }
  if (CC.markRead(S.user, c.id)) softSave();
  const msgs = CC.chMsgs(c.id).slice(-60);
  return `<div class="row" style="gap:10px;margin-bottom:10px"><button class="icon-btn" data-act="ch-back" aria-label="Back to channels">${ic('chev','" style="transform:rotate(180deg)')}</button><div class="title" style="font-size:17px">${esc(c.dm ? 'Your manager' : c.name)}</div></div>
    <div class="cmsgs">${msgs.map(m => { const mine = m.from===S.user, rd = mine ? CC.readersOf(m) : [];
      return `<div class="cmsg ${mine?'mine':''}">${mine?'':`<div class="small faint">${esc(nameOf(m.from))} · ${fTime(m.t)}</div>`}<div class="cb">${esc(m.text)}</div>${mine?`<div class="small faint">${fTime(m.t)}${rd.length ? ` · Seen by ${rd.length===1 ? esc(first({name:nameOf(rd[0])})) : rd.length}` : ''}</div>`:''}</div>`; }).join('') || '<p class="small muted">Say hi to the crew.</p>'}</div>
    <div class="ccomp"><input class="input" id="chText" placeholder="Message" autocomplete="off" maxlength="500"><button class="btn primary" style="width:auto" data-act="ch-send" aria-label="Send">${ic('chev')}</button></div>`;
}
XA.acts['ch-open'] = (el, v) => { TS.ch = v; setTimeout(() => { const m = document.querySelector('.cmsgs'); if (m) m.scrollTop = m.scrollHeight; const sc = document.getElementById('scroll'); if (sc) sc.scrollTop = sc.scrollHeight; }, 0); };
XA.acts['ch-back'] = () => { TS.ch = null; };
XA.acts['ch-send'] = () => { const t = val('chText').trim(); if (!t) return false; CC.postMsg(TS.ch, S.user, t); commit(); A.render();
  setTimeout(() => { const sc = document.getElementById('scroll'); if (sc) sc.scrollTop = sc.scrollHeight; document.getElementById('chText')?.focus(); }, 0); return false; };
document.addEventListener('keydown', ev => { if (ev.key==='Enter' && ev.target.id==='chText'){ ev.preventDefault(); XA.acts['ch-send'](); } });

function myVenues(){ const e = me(); const t0 = startOfDay(now()); return [...new Set([S.shift?.venue, ...A.scheduleFor(e).filter(s=>s.day===t0).map(s=>s.venue), e.home].filter(Boolean))]; }
function renderLists(){
  const vs = myVenues(), lists = (D().checklists||[]).filter(c => vs.includes(c.venue));
  return `<p class="small muted" style="margin:0 2px 10px">Today&rsquo;s lists for where you&rsquo;re working. Everyone on shift can check items off.</p>
    <div class="list">${lists.map(c => { const r = CC.runFor(c.id, now()), p = CC.listProgress(c, r);
      return `<button class="li" data-act="cl-open" data-v="${c.id}"><span class="vt" style="width:38px;height:38px">${ic('checklist')}</span><div class="grow" style="text-align:left"><div class="title" style="font-size:14.5px">${esc(c.name)}</div><div class="meta">${esc(A.venueById(c.venue).name)} · due ${fTime(p.due)}</div><div class="prog sm"><i style="width:${p.n?p.d/p.n*100:0}%"></i></div></div>${p.complete ? badge('Done','ok') : p.late ? badge(`${p.d}/${p.n} late`,'bad') : badge(`${p.d}/${p.n}`)}</button>`; }).join('') || '<div class="li small muted">No checklists for your venue.</div>'}</div>`;
}
function clSheet(id){
  const c = D().checklists.find(x=>x.id===id), r = CC.runFor(id, now()), p = CC.listProgress(c, r);
  const item = i => { const d = r?.done?.[i.id], bad = d && i.type==='temp' && ((i.max!=null && d.val>i.max) || (i.min!=null && d.val<i.min));
    const meta = d ? `<div class="meta">${esc(first(CC.empById(d.by)))} · ${fTime(d.t)}</div>` : '';
    if (i.type==='temp') return `<div class="cl-i ${d?'done':''} ${bad?'bad':''}"><div class="grow"><div class="title" style="font-size:14px">${esc(i.text)}</div><div class="meta">${i.max!=null?`Must be ${i.max}°F or colder`:`Must be ${i.min}°F or hotter`}</div>${meta}${bad?`<div class="meta" style="color:var(--bad)">Out of range. Tell your manager now.</div>`:''}</div>
      <div class="row" style="gap:6px"><input class="input sm num" style="width:76px" id="tmp-${i.id}" inputmode="decimal" value="${d?.val ?? ''}" placeholder="°F" aria-label="Temperature for ${esc(i.text)}"><button class="btn sm" style="width:auto" data-act="cl-temp" data-v="${c.id}" data-i="${i.id}">Log</button></div></div>`;
    if (i.type==='photo') return `<div class="cl-i ${d?'done':''}"><div class="grow"><div class="title" style="font-size:14px">${esc(i.text)}</div>${meta}${typeof d?.photo==='string' ? `<img class="cl-ph" src="${d.photo}" alt="Checklist photo">` : ''}</div>
      <label class="btn sm" style="width:auto">${ic('cam')} ${d?'Retake':'Photo'}<input type="file" accept="image/*" capture="environment" class="sr-only cl-photo" data-v="${c.id}" data-i="${i.id}"></label></div>`;
    return `<button class="cl-i ${d?'done':''}" data-act="cl-tick" data-v="${c.id}" data-i="${i.id}"><span class="cl-box">${d?ic('check'):''}</span><div class="grow" style="text-align:left"><div class="title" style="font-size:14px">${esc(i.text)}</div>${meta}</div></button>`; };
  A.openSheet(`<h3>${esc(c.name)}</h3><p class="muted small">${esc(A.venueById(c.venue).name)} · due ${fTime(p.due)} · ${p.d} of ${p.n} done</p>
    <div class="cl-list" style="margin-top:12px">${c.items.map(item).join('')}</div>
    ${r?.signed ? `<div class="alert ok" style="margin-top:12px">${ic('check')}<div>Signed off by <b>${esc(CC.empById(r.signed.by)?.name)}</b> at ${fTime(r.signed.t)}.</div></div>`
      : `<button class="btn primary" style="margin-top:14px" data-act="cl-sign" data-v="${c.id}" ${p.d===p.n?'':'disabled'}>${ic('check')} Sign off as ${esc(me().name)}</button>${p.d<p.n?`<p class="small faint" style="text-align:center;margin-top:6px">Finish every item to sign off.</p>`:''}`}
    <button class="btn ghost" style="margin-top:8px" data-act="close">Close</button>`);
}
XA.acts['cl-open'] = (el, v) => { clSheet(v); return false; };
XA.acts['cl-tick'] = (el, v) => { const r = CC.runFor(v, now(), true), i = el.dataset.i; if (r.signed) return false;
  if (r.done[i]) delete r.done[i]; else r.done[i] = {by:S.user, t:now()}; commit(); clSheet(v); return false; };
XA.acts['cl-temp'] = (el, v) => { const i = el.dataset.i, x = parseFloat(val('tmp-'+i)); if (!isFinite(x)){ A.toast('Enter a temperature'); return false; }
  const r = CC.runFor(v, now(), true); r.done[i] = {by:S.user, t:now(), val:x}; const c = D().checklists.find(y=>y.id===v), it = c.items.find(y=>y.id===i);
  if ((it.max!=null && x>it.max) || (it.min!=null && x<it.min)) CC.notify('mgr', `${it.text} at ${A.venueById(c.venue).name} logged ${x}°F by ${me().name}.`, 'Push', 'checklist');
  commit(); clSheet(v); return false; };
XA.acts['cl-sign'] = (el, v) => { const r = CC.runFor(v, now(), true); r.signed = {by:S.user, t:now()}; const c = D().checklists.find(y=>y.id===v);
  CC.log(me().name, `Signed off ${c.name}`); commit(); A.closeSheet(); A.toast(`${c.name} signed off`); };
document.addEventListener('change', ev => { const f = ev.target.closest?.('.cl-photo'); if (!f || !f.files[0]) return;
  const id = f.dataset.v, item = f.dataset.i, img = new Image(), url = URL.createObjectURL(f.files[0]);
  img.onload = () => { const k = Math.min(1, 360 / Math.max(img.width, img.height)), cv = document.createElement('canvas'); cv.width = Math.round(img.width*k); cv.height = Math.round(img.height*k);
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
    const r = CC.runFor(id, now(), true); r.done[item] = {by:S.user, t:now(), photo:cv.toDataURL('image/jpeg', .6)}; commit(); clSheet(id); };
  img.onerror = () => { A.toast('Couldn’t read that photo'); }; img.src = url; });
function renderNews(){
  const list = myAnns();
  return `<div class="list">${list.map(a => { const need = a.ack && !(a.readBy||{})[S.user];
    return `<div class="li" style="align-items:flex-start"><span class="vt" style="width:36px;height:36px">${ic('mega')}</span><div class="grow"><div class="meta">${a.venue ? esc(A.venueById(a.venue).name) : 'All crew'} · ${fDate(a.t)} ${fTime(a.t)}${a.urgent?' · <b style="color:var(--bad)">Urgent</b>':''}</div><div style="font-size:14.5px;margin-top:3px">${esc(a.text)}</div>
      ${need ? `<button class="btn sm primary" style="margin-top:8px;width:auto" data-act="ann-ack" data-v="${a.id}">${ic('check')} Got it</button>` : a.ack ? `<div class="meta" style="color:var(--ok);margin-top:4px">You confirmed</div>` : ''}</div></div>`; }).join('') || '<div class="li small muted">No announcements.</div>'}</div>`;
}

/* ---------- Me tab: early pay, paperwork, training, notifications, suggestions ---------- */
function myTodo(){ const e = me(); if (!e) return 0;
  return CC.docTypesFor(e).filter(t => ['missing','expired'].includes(CC.docState(e.id, t.id).state)).length + CC.coursesFor(e).filter(c => c.required && !(D().training?.[e.id]?.[c.id]?.score >= 100)).length; }
XA.meExtra = () => {
  const e = me(), w = CC.ewaFor(e.id), st = ST();
  const adv = (D().advances||[]).filter(x => x.emp===e.id).sort((a,b)=>b.t-a.t).slice(0,3);
  const docs = CC.docTypesFor(e).map(t => ({t, s:CC.docState(e.id, t.id)}));
  const courses = CC.coursesFor(e).map(c => ({c, r:D().training?.[e.id]?.[c.id]}));
  const inbox = (D().outbox||[]).filter(o => o.to===e.id).slice(0,5);
  const dState = {done:['Done','ok'], missing:['To do','warn'], expiring:['Expiring','warn'], expired:['Expired','bad']};
  return `
  ${st.ewaEnabled ? `<div class="section-h"><h2>Early pay</h2><span class="small faint">Pay period so far</span></div>
    <div class="card"><div class="row between"><div><div class="label">Available now</div><div style="font-family:var(--display);font-weight:800;font-size:34px;line-height:1.1" class="num">${money(w.avail)}</div></div>
      <button class="btn sm primary" style="width:auto" data-act="ewa-open" ${w.avail>=5?'':'disabled'}>${ic('dollar')} Get it now</button></div>
      <div class="meta" style="margin-top:6px">You&rsquo;ve earned ${money(w.earned)} this period. You can take up to ${st.ewaPct}% before payday${st.ewaFee ? `, ${money(st.ewaFee)} fee` : ', no fee'}. It comes out of your next check.</div>
      ${adv.length ? `<div class="list" style="margin-top:10px">${adv.map(a => `<div class="li"><div class="grow"><div class="title num" style="font-size:14px">${money(a.amt)}</div><div class="meta">${fDate(a.t)}</div></div>${badge(a.status, a.status==='Paid'?'ok':a.status==='Denied'?'bad':'warn')}</div>`).join('')}</div>` : ''}</div>` : ''}
  <div class="section-h"><h2>Paperwork</h2><span class="small faint">${docs.filter(d=>d.s.state==='done').length} of ${docs.length} done</span></div>
  <div class="list">${docs.map(({t, s}) => `<button class="li" data-act="doc-open" data-v="${t.id}"><span class="vt" style="width:36px;height:36px">${ic('doc')}</span><div class="grow" style="text-align:left"><div class="title" style="font-size:14.5px">${esc(t.name)}</div><div class="meta">${s.state==='done' || s.state==='expiring' ? (s.exp ? `Expires ${fDate(s.exp)}` : `Signed ${fDate(s.d.t)}`) : s.state==='expired' ? `Expired ${fDate(s.exp)}. Upload your new one.` : t.kind==='card' ? 'Add your card number and expiration' : 'Read and sign'}</div></div>${badge(...dState[s.state])}</button>`).join('')}</div>
  <div class="section-h"><h2>Training</h2><span class="small faint">Short lessons</span></div>
  <div class="list">${courses.map(({c, r}) => `<button class="li" data-act="course-open" data-v="${c.id}"><span class="vt" style="width:36px;height:36px">${ic('book')}</span><div class="grow" style="text-align:left"><div class="title" style="font-size:14.5px">${esc(c.title)}</div><div class="meta">${c.mins} min${c.required?' · Required':''}${r ? ` · Score ${r.score}%` : ''}</div></div>${r?.score>=100 ? badge('Passed','ok') : r ? badge('Retake','warn') : badge(c.required?'To do':'Optional', c.required?'warn':'')}</button>`).join('')}</div>
  <div class="section-h"><h2>Notifications</h2><span class="small faint">Texts and alerts</span></div>
  <div class="list">${inbox.map(o => `<div class="li"><span class="vt" style="width:34px;height:34px">${ic(o.channel==='SMS'?'chat':'bell')}</span><div class="grow"><div class="small">${esc(o.text)}</div><div class="meta">${o.channel} · ${fDate(o.t)} ${fTime(o.t)}</div></div></div>`).join('') || '<div class="li small muted">Nothing yet. Shift reminders and schedule changes show up here.</div>'}</div>
  <div class="btn-grid" style="margin-top:14px"><button class="btn" data-act="sugg-open">${ic('heart')} Suggestion box</button><button class="btn" data-act="tab" data-v="guide">${ic('info')} How it works</button></div>`;
};
XA.acts['ewa-open'] = () => { const w = CC.ewaFor(S.user), st = ST();
  A.openSheet(`<h3>Get early pay</h3><p class="muted small">Up to <b>${money(w.avail)}</b> of what you&rsquo;ve already earned. ${st.ewaAuto ? 'Sent right away.' : 'Your manager approves it, usually the same day.'}</p>
    <label class="field"><span>Amount</span><input class="input num" id="ewaAmt" inputmode="decimal" value="${Math.min(w.avail, 50)}"></label>
    <div class="receipt" style="margin-top:12px"><div class="split"><span class="muted">Fee</span><span class="num">${money(st.ewaFee||0)}</span></div><div class="split"><span class="muted">Comes out of</span><span>Your next paycheck</span></div></div>
    <p class="small faint" style="margin-top:10px">Demo only. A real launch connects a payout partner for instant transfers.</p>
    <div class="btn-grid" style="margin-top:16px"><button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="ewa-send">Request</button></div>`); return false; };
XA.acts['ewa-send'] = () => { const w = CC.ewaFor(S.user), amt = Math.floor(parseFloat(val('ewaAmt'))*100)/100;
  if (!isFinite(amt) || amt < 5){ A.toast('Minimum is $5'); return false; } if (amt > w.avail){ A.toast(`You can take up to ${money(w.avail)}`); return false; }
  const auto = !!ST().ewaAuto, a = {id:CC.id('EW'), emp:S.user, amt, fee:ST().ewaFee||0, t:now(), status: auto ? 'Paid' : 'Pending'}; if (auto) a.paidT = now();
  D().advances.push(a); if (!auto) A.addRequest({kind:'Early pay', detail:`${money(amt)} early pay`, ref:a.id});
  CC.log(me().name, `Requested ${money(amt)} early pay`); commit(); A.closeSheet(); A.toast(auto ? `${money(amt)} sent` : 'Sent to your manager'); };
XA.acts['doc-open'] = (el, v) => { const e = me(), t = CC.docTypesFor(e).find(x=>x.id===v), s = CC.docState(e.id, v), d = D().docs?.[e.id]?.[v];
  const BODY = {w4:'Federal tax withholding. Your filing status and allowances set how much tax comes out of each check.', i9:'Confirms you&rsquo;re allowed to work in the U.S. Bring your ID documents to your manager on your first shift.', dd:'Where your pay goes. Enter your bank&rsquo;s routing and account number with your manager.', hb:'Our crew handbook: breaks, uniforms, food safety, call-outs and how we treat each other.'};
  if (t.kind==='card') A.openSheet(`<h3>${esc(t.name)}</h3><p class="muted small">California requires a food handler card within 30 days of hire. Keep it current.</p>
    <label class="field"><span>Card number</span><input class="input" id="dcNum" value="${esc(d?.num||'')}" placeholder="e.g. CA-FH-12345"></label>
    <label class="field"><span>Expiration date</span><input class="input" type="date" id="dcExp" value="${esc(d?.exp||'')}"></label>
    <div class="btn-grid" style="margin-top:16px"><button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="doc-save" data-v="${v}">Save</button></div>`);
  else A.openSheet(`<h3>${esc(t.name)}</h3><p class="muted small">${BODY[v] || 'Read and sign.'}</p>
    ${s.state==='done' ? `<div class="alert ok" style="margin-top:12px">${ic('check')}<div>Signed ${fDate(d.t)}${d.sig?` as <b>${esc(d.sig)}</b>`:''}.</div></div><button class="btn ghost" style="margin-top:12px" data-act="close">Close</button>`
    : `<label class="field"><span>Type your full name to sign</span><input class="input" id="dcSig" placeholder="${esc(e.name)}" autocomplete="name"></label>
    <label class="check"><input type="checkbox" id="dcOk"><span>I&rsquo;ve read this and the information is correct.</span></label>
    <div class="btn-grid" style="margin-top:16px"><button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="doc-save" data-v="${v}">Sign</button></div>`}`);
  return false; };
XA.acts['doc-save'] = (el, v) => { const e = me(), t = CC.docTypesFor(e).find(x=>x.id===v), docs = (D().docs ||= {})[e.id] ||= {};
  if (t.kind==='card'){ const exp = val('dcExp'); if (!exp){ A.toast('Add the expiration date'); return false; } docs[v] = {status:'done', t:now(), num:val('dcNum').trim(), exp}; }
  else { const sig = val('dcSig').trim(); if (sig.length < 3){ A.toast('Type your full name'); return false; } if (!document.getElementById('dcOk').checked){ A.toast('Check the box to confirm'); return false; } docs[v] = {status:'done', t:now(), sig}; }
  CC.log(e.name, `Completed ${t.name}`); commit(); A.closeSheet(); A.toast(`${t.name} saved`); };
XA.acts['course-open'] = (el, v) => { const c = D().courses.find(x=>x.id===v);
  A.openSheet(`<h3>${esc(c.title)}</h3><p class="muted small">${c.mins} min · then a quick check</p>
    <ol class="gd-steps" style="margin-top:12px">${c.body.map(b=>`<li>${esc(b)}</li>`).join('')}</ol>
    ${c.quiz.map((q, qi) => `<fieldset class="quiz"><legend>${qi+1}. ${esc(q.q)}</legend>${q.opts.map((o, oi) => `<label class="check"><input type="radio" name="q${qi}" value="${oi}"><span>${esc(o)}</span></label>`).join('')}</fieldset>`).join('')}
    <div class="btn-grid" style="margin-top:16px"><button class="btn" data-act="close">Later</button><button class="btn primary" data-act="course-done" data-v="${c.id}">Submit</button></div>`); return false; };
XA.acts['course-done'] = (el, v) => { const c = D().courses.find(x=>x.id===v);
  const ans = c.quiz.map((q, qi) => document.querySelector(`input[name=q${qi}]:checked`)?.value); if (ans.some(a => a == null)){ A.toast('Answer every question'); return false; }
  const score = Math.round(c.quiz.filter((q, qi) => +ans[qi] === q.a).length / c.quiz.length * 100);
  ((D().training ||= {})[S.user] ||= {})[c.id] = {t:now(), score}; CC.log(me().name, `Finished training "${c.title}" (${score}%)`); commit(); A.closeSheet();
  A.toast(score >= 100 ? 'Passed. Nice work.' : `You scored ${score}%. Take another look and retake it.`); };
XA.acts['sugg-open'] = () => { A.openSheet(`<h3>Suggestion box</h3><p class="muted small">Ideas, problems, shout-outs. Your name isn&rsquo;t attached.</p>
  <label class="field"><span>Your suggestion</span><textarea class="input" id="sgText" maxlength="600" placeholder="e.g. A second card reader at Stand 114 would cut the halftime line"></textarea></label>
  <div class="btn-grid" style="margin-top:16px"><button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="sugg-send">Send anonymously</button></div>`); return false; };
XA.acts['sugg-send'] = () => { const t = val('sgText').trim(); if (t.length < 4){ A.toast('Write a little more'); return false; }
  D().suggestions.push({id:CC.id('SG'), text:t, t:now(), venue:me().home}); commit(); A.closeSheet(); A.toast('Thanks. Sent anonymously.'); };
})();
