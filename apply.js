/* CJ's Crew - Clock: step-by-step employment application (live mode).
   Answers are saved on this device as the applicant goes, so they can stop and come back.
   Nothing reaches management until the last step is signed and sent. */
(() => {
'use strict';
const {ic, esc, money} = CC;
const API = (window.__CC__ && window.__CC__.api || '').replace(/\/$/, '');
const root = document.getElementById('ap');
const want = new URLSearchParams(location.search).get('job');
const toast = m => { const t = document.getElementById('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2800); };
const store = (() => { try { const s = window['local' + 'Storage']; s.setItem('__t', '1'); s.removeItem('__t'); return s; } catch (e) { return null; } })();
const KEY = 'cjcc-apply-draft';
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SLOTS = [['am', 'Morning'], ['pm', 'Afternoon'], ['eve', 'Evening']];
const SKILLS = ['Fryer / broaster', 'Cashier / POS', 'Food prep', 'Grill', 'Dish & cleaning', 'Food truck', 'Catering & events', 'Stadium concessions', 'Speaks Spanish', 'Can drive a truck'];
const STEPS = ['Job', 'About you', 'Availability', 'Experience', 'References', 'Review & sign'];

const blankJob = () => ({employer: '', title: '', city: '', from: '', to: '', current: false, duties: '', why: '', contact: 'yes'});
const blankRef = () => ({name: '', rel: '', phone: ''});
let F = {
  job: '', type: '', start: '', hours: '',
  first: '', last: '', phone: '', email: '', street: '', city: '', zip: '', contact: 'Text',
  adult: '', workAuth: '',
  avail: Object.fromEntries(DAYS.map(d => [d, []])), events: '', transport: '', availNote: '',
  noExp: false, jobs: [blankJob()], foodCard: '', foodCardExp: '', skills: [],
  school: '', schoolLevel: '', schoolNote: '',
  refs: [blankRef(), blankRef()], heard: '', heardOther: '', extra: '',
  certify: false, signature: '', step: 0
};
let JOBS = [], COMPANY = "CJ's Wings", resumeFile = null, sending = false;

function load(){ if (!store) return; try { const d = JSON.parse(store.getItem(KEY) || 'null'); if (d && typeof d === 'object') F = {...F, ...d, avail: {...F.avail, ...(d.avail || {})}}; } catch (e) {} }
function save(){ if (!store) return; try { store.setItem(KEY, JSON.stringify(F)); } catch (e) {} }
function clearDraft(){ if (store) try { store.removeItem(KEY); } catch (e) {} }
const digits = s => String(s || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
const fmtPhone = s => { const d = digits(s); return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : s; };
const fmtMonth = s => { const m = /^(\d{4})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, 1).toLocaleDateString('en-US', {month: 'short', year: 'numeric'}) : (s || ''); };
const fullName = () => `${F.first} ${F.last}`.replace(/[<>"&`]/g, '').replace(/\s+/g, ' ').trim();
const jobById = id => JOBS.find(j => j.id === id);

/* ---------- field helpers ---------- */
const inp = (k, label, o = {}) => `<label class="field"><span>${label}${o.opt ? ' <em class="faint">(optional)</em>' : ''}</span><input class="input" data-k="${k}" value="${esc(get(k) ?? '')}" ${o.type ? `type="${o.type}"` : ''} ${o.ph ? `placeholder="${esc(o.ph)}"` : ''} ${o.ac ? `autocomplete="${o.ac}"` : ''} ${o.im ? `inputmode="${o.im}"` : ''} maxlength="${o.max || 120}"></label>`;
const area = (k, label, o = {}) => `<label class="field"><span>${label}${o.opt ? ' <em class="faint">(optional)</em>' : ''}</span><textarea class="input" data-k="${k}" maxlength="${o.max || 1000}" ${o.ph ? `placeholder="${esc(o.ph)}"` : ''}>${esc(get(k) ?? '')}</textarea></label>`;
const sel = (k, label, opts, o = {}) => `<label class="field"><span>${label}${o.opt ? ' <em class="faint">(optional)</em>' : ''}</span><select class="input" data-k="${k}"><option value="">Choose…</option>${opts.map(x => `<option ${get(k) === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>`;
const yn = (k, label, sub = '') => `<div class="field"><span>${label}</span>${sub ? `<div class="faint small" style="margin:-2px 0 6px">${sub}</div>` : ''}<div class="seg">${['Yes', 'No'].map(x => `<button type="button" class="${get(k) === x ? 'on' : ''}" data-set="${k}" data-v="${x}">${x}</button>`).join('')}</div></div>`;
function get(k){ return k.split('.').reduce((o, p) => o == null ? o : o[p], F); }
function set(k, v){ const ps = k.split('.'); let o = F; ps.slice(0, -1).forEach(p => { o = o[p]; }); o[ps[ps.length - 1]] = v; save(); }

/* ---------- steps ---------- */
function stepJob(){
  return `<h2 class="ap-h">Which job?</h2>
  <div class="jobs" role="radiogroup">${JOBS.map(j => `<label class="job"><input type="radio" name="job" value="${esc(j.id)}" ${F.job === j.id ? 'checked' : ''}><span><b>${esc(j.title)}</b><span class="meta">${esc(j.venue)} · ${esc(j.type)} · ${money(j.rate)}/hr</span><span class="meta" style="color:var(--text);margin-top:4px;display:block">${esc(j.desc || '')}</span></span></label>`).join('')}</div>
  <div class="fgrid2" style="margin-top:14px">
    ${sel('type', 'Looking for', ['Part-time', 'Full-time', 'Seasonal / event days', 'Any'])}
    ${inp('start', 'Earliest start date', {type: 'date'})}
  </div>
  ${sel('hours', 'Hours you want each week', ['Under 15', '15 to 25', '25 to 35', '35 to 40', '40 or more'])}`;
}
function stepAbout(){
  return `<h2 class="ap-h">About you</h2>
  <div class="fgrid2">${inp('first', 'First name', {ac: 'given-name', max: 40})}${inp('last', 'Last name', {ac: 'family-name', max: 40})}</div>
  <div class="fgrid2">${inp('phone', 'Mobile number', {type: 'tel', ac: 'tel', ph: '(310) 555-0100', max: 20})}${inp('email', 'Email', {type: 'email', ac: 'email', ph: 'you@example.com', opt: true})}</div>
  ${inp('street', 'Street address', {ac: 'street-address', opt: true})}
  <div class="fgrid2">${inp('city', 'City', {ac: 'address-level2', max: 60})}${inp('zip', 'ZIP code', {ac: 'postal-code', im: 'numeric', max: 10})}</div>
  ${sel('contact', 'Best way to reach you', ['Text', 'Phone call', 'Email'])}
  ${yn('adult', 'Are you 18 or older?', 'If you&rsquo;re 16 or 17 you can still apply. You&rsquo;ll need a work permit from your school.')}
  ${yn('workAuth', 'Are you legally allowed to work in the United States?', 'If hired, you&rsquo;ll show proof on your first day (Form I-9).')}`;
}
function stepAvail(){
  return `<h2 class="ap-h">When can you work?</h2>
  <p class="muted small" style="margin-bottom:10px">Tap every time you could usually work.</p>
  <div class="av-grid"><div></div>${SLOTS.map(s => `<div class="av-h">${s[1]}</div>`).join('')}
  ${DAYS.map(d => `<div class="av-d">${d}</div>${SLOTS.map(([s, l]) => `<button type="button" class="av-c ${F.avail[d].includes(s) ? 'on' : ''}" data-av="${d}" data-s="${s}" aria-pressed="${F.avail[d].includes(s)}" aria-label="${d} ${l}">${F.avail[d].includes(s) ? ic('check') : ''}</button>`).join('')}`).join('')}</div>
  ${yn('events', 'Can you work stadium and event days?', 'Event days at SoFi and Dignity Health Sports Park are often nights and weekends.')}
  ${yn('transport', 'Do you have a reliable way to get to work?')}
  ${area('availNote', 'Anything else about your schedule?', {opt: true, ph: 'e.g. School until 3 pm on weekdays', max: 400})}`;
}
function stepExp(){
  return `<h2 class="ap-h">Work experience</h2>
  <label class="check"><input type="checkbox" data-chk="noExp" ${F.noExp ? 'checked' : ''}><span>I don&rsquo;t have work experience yet. <span class="faint">That&rsquo;s fine, lots of our crew started here.</span></span></label>
  ${F.noExp ? '' : F.jobs.map((j, i) => `<div class="card ap-card"><div class="row between"><b>Job ${i + 1}${i === 0 ? ' (most recent)' : ''}</b>${F.jobs.length > 1 ? `<button type="button" class="link" data-rmjob="${i}">Remove</button>` : ''}</div>
    <div class="fgrid2">${inp(`jobs.${i}.employer`, 'Employer', {max: 80})}${inp(`jobs.${i}.title`, 'Your job title', {max: 60})}</div>
    ${inp(`jobs.${i}.city`, 'City', {opt: true, max: 60})}
    <div class="fgrid2">${inp(`jobs.${i}.from`, 'Started', {type: 'month'})}${j.current ? '<div class="field"><span>Ended</span><div class="input faint" style="display:flex;align-items:center">Still working here</div></div>' : inp(`jobs.${i}.to`, 'Ended', {type: 'month'})}</div>
    <label class="check" style="margin-top:0"><input type="checkbox" data-chk="jobs.${i}.current" ${j.current ? 'checked' : ''}><span>I still work here</span></label>
    ${area(`jobs.${i}.duties`, 'What did you do there?', {max: 600, ph: 'e.g. Ran the fryer, took orders, closed the store'})}
    ${area(`jobs.${i}.why`, j.current ? 'Why are you looking?' : 'Why did you leave?', {opt: true, max: 300})}
    ${sel(`jobs.${i}.contact`, 'May we contact this employer?', ['yes', 'no', 'after an offer'])}
  </div>`).join('')}
  ${F.noExp || F.jobs.length >= 3 ? '' : `<button type="button" class="btn" style="margin-top:10px" data-addjob="1">${ic('plus')} Add another job</button>`}
  <h3 class="ap-h3">Skills & certificates</h3>
  ${yn('foodCard', 'Do you have a California Food Handler card?', 'No card yet? You can get one within 30 days of starting.')}
  ${F.foodCard === 'Yes' ? inp('foodCardExp', 'Card expires', {type: 'month', opt: true}) : ''}
  <div class="field"><span>Skills <em class="faint">(tap all that fit)</em></span><div class="chips-wrap">${SKILLS.map(s => `<button type="button" class="chip-t ${F.skills.includes(s) ? 'on' : ''}" data-skill="${esc(s)}">${esc(s)}</button>`).join('')}</div></div>`;
}
function stepRefs(){
  return `<h2 class="ap-h">References & more</h2>
  <p class="muted small" style="margin-bottom:6px">Two people who know how you work, like a past manager, teacher or coach. Not family. Optional, but it helps.</p>
  ${F.refs.map((r, i) => `<div class="card ap-card"><b>Reference ${i + 1}</b>
    <div class="fgrid2">${inp(`refs.${i}.name`, 'Name', {opt: true, max: 60})}${inp(`refs.${i}.rel`, 'How you know them', {opt: true, max: 60, ph: 'e.g. Manager at Taco Spot'})}</div>
    ${inp(`refs.${i}.phone`, 'Phone or email', {opt: true, max: 80})}</div>`).join('')}
  <h3 class="ap-h3">School</h3>
  <div class="fgrid2">${sel('schoolLevel', 'Highest level', ['In high school', 'High school / GED', 'Some college', 'Trade school', 'College degree', 'Prefer not to say'], {opt: true})}${inp('school', 'School name', {opt: true, max: 80})}</div>
  <h3 class="ap-h3">Last few things</h3>
  ${sel('heard', 'How did you hear about us?', ['A friend or crew member', 'Walked in / saw a sign', 'Instagram or social media', 'Job website', 'At a stadium or event', 'Other'], {opt: true})}
  ${F.heard === 'Other' || F.heard === 'A friend or crew member' ? inp('heardOther', F.heard === 'Other' ? 'Where?' : 'Who referred you?', {opt: true, max: 80}) : ''}
  ${area('extra', 'Anything else you want us to know?', {opt: true, max: 1200})}
  ${resumeFile ? `<div class="field"><span>Resume</span><div class="check" style="align-items:center;margin-top:0"><span class="ic-s">${ic('doc')}</span><span class="grow" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(resumeFile.name)}</span><button type="button" class="link" data-rmres="1">Remove</button></div></div>`
  : `<label class="field"><span>Resume <em class="faint">(optional · PDF, Word or photo, up to 10 MB)</em></span><input class="input" id="apResume" type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.heic,.webp,.txt,application/pdf,image/*"></label>`}
  <p class="faint small">Attach your resume on this step. Files aren&rsquo;t saved with your draft.</p>`;
}
const row = (k, v) => v ? `<div class="rv-r"><span>${k}</span><b>${esc(v)}</b></div>` : '';
function availText(){ const parts = DAYS.map(d => F.avail[d].length ? `${d} ${F.avail[d].map(s => SLOTS.find(x => x[0] === s)[1].toLowerCase()).join('/')}` : '').filter(Boolean); return parts.join(', ') || 'Not given'; }
function stepReview(){
  const j = jobById(F.job);
  const edit = n => `<button type="button" class="link" data-go="${n}">Edit</button>`;
  return `<h2 class="ap-h">Review & sign</h2>
  <div class="card ap-card"><div class="row between"><b>Job</b>${edit(0)}</div>${row('Position', j ? `${j.title} · ${j.venue}` : '')}${row('Looking for', F.type)}${row('Start', F.start)}${row('Hours a week', F.hours)}</div>
  <div class="card ap-card"><div class="row between"><b>About you</b>${edit(1)}</div>${row('Name', fullName())}${row('Phone', fmtPhone(F.phone))}${row('Email', F.email)}${row('Address', [F.street, F.city, F.zip].filter(Boolean).join(', '))}${row('18 or older', F.adult)}${row('Allowed to work in US', F.workAuth)}</div>
  <div class="card ap-card"><div class="row between"><b>Availability</b>${edit(2)}</div>${row('Usually free', availText())}${row('Event days', F.events)}${row('Reliable ride', F.transport)}${row('Notes', F.availNote)}</div>
  <div class="card ap-card"><div class="row between"><b>Experience</b>${edit(3)}</div>${F.noExp ? row('Experience', 'None yet') : F.jobs.filter(x => x.employer).map(x => row(x.employer, `${x.title}${x.from ? ` · ${fmtMonth(x.from)} to ${x.current ? 'now' : fmtMonth(x.to) || '?'}` : ''}`)).join('')}${row('Food Handler card', F.foodCard)}${row('Skills', F.skills.join(', '))}</div>
  <div class="card ap-card"><div class="row between"><b>References & more</b>${edit(4)}</div>${F.refs.filter(r => r.name).map(r => row(r.name, [r.rel, r.phone].filter(Boolean).join(' · '))).join('') || row('References', 'None given')}${row('School', [F.schoolLevel, F.school].filter(Boolean).join(' · '))}${row('Heard about us', [F.heard, F.heardOther].filter(Boolean).join(': '))}${row('Resume', resumeFile ? resumeFile.name : 'Not attached')}</div>
  <details class="card small ap-card" style="line-height:1.55"><summary style="cursor:pointer"><b>How we use your information</b></summary>
    <p style="margin-top:8px">We use what you share only to review your application and contact you about working at ${esc(COMPANY)}. It goes only to our hiring managers, is stored privately and is never sold. If you aren&rsquo;t hired we keep it for up to 4 years, as California employment rules require, then delete it. To get a copy, fix or delete what we have, use the request form in our <a href="privacy.html#request" target="_blank" rel="noopener">privacy notice</a>.</p>
    <p style="margin-top:8px">${esc(COMPANY)} is an equal opportunity employer. Following the California Fair Chance Act, we don&rsquo;t ask about conviction history on this application, and we consider qualified applicants with arrest or conviction records. We don&rsquo;t ask about your pay history.</p>
  </details>
  <label class="check"><input type="checkbox" data-chk="certify" ${F.certify ? 'checked' : ''}><span>I confirm everything in this application is true and complete. I understand that false or missing information could affect a job offer, and that a job here is at-will, meaning either side can end it at any time.</span></label>
  <label class="field" style="margin-top:12px"><span>Sign by typing your full name: <b>${esc(fullName() || 'your name')}</b></span><input class="input sig" data-k="signature" value="${esc(F.signature)}" autocomplete="off" maxlength="80" placeholder="${esc(fullName())}"></label>
  <p class="faint small">Signed ${new Date().toLocaleDateString('en-US', {month: 'long', day: 'numeric', year: 'numeric'})}</p>
  <label style="position:absolute;left:-9999px" aria-hidden="true">Website <input id="apWeb" tabindex="-1" autocomplete="off"></label>`;
}
const VIEWS = [stepJob, stepAbout, stepAvail, stepExp, stepRefs, stepReview];

/* ---------- checks before moving on ---------- */
function check(n){
  if (n === 0){ if (!jobById(F.job)) return 'Pick a job'; if (!F.type) return 'Choose part-time, full-time or seasonal'; if (!F.hours) return 'Choose how many hours you want'; }
  if (n === 1){
    if (F.first.trim().length < 1 || F.last.trim().length < 1) return 'Add your first and last name';
    if (digits(F.phone).length !== 10) return 'Add a 10-digit mobile number';
    if (F.email && !/^\S+@\S+\.\S+$/.test(F.email)) return 'That email looks off';
    if (F.contact === 'Email' && !F.email) return 'Add your email, or choose a different way to reach you';
    if (!F.city.trim()) return 'Add your city';
    if (!/^\d{5}$/.test(F.zip.trim())) return 'Add a 5-digit ZIP code';
    if (!F.adult) return 'Tell us if you are 18 or older'; if (!F.workAuth) return 'Answer the work eligibility question';
  }
  if (n === 2){ if (!DAYS.some(d => F.avail[d].length)) return 'Tap at least one time you can work'; if (!F.events || !F.transport) return 'Answer both questions'; }
  if (n === 3){
    if (!F.noExp){ const j = F.jobs[0]; if (!j.employer.trim() || !j.title.trim()) return 'Add your most recent employer and job title, or check "no work experience yet"';
      if (F.jobs.some(x => x.employer && !x.from)) return 'Add when each job started'; }
    if (!F.foodCard) return 'Tell us if you have a Food Handler card';
  }
  if (n === 5){
    if (!F.certify) return 'Check the box to confirm your answers';
    if (F.signature.replace(/\s+/g, ' ').trim().toLowerCase() !== fullName().toLowerCase()) return `Type your full name exactly: ${fullName()}`;
  }
  return '';
}

/* ---------- render ---------- */
function render(){
  const n = F.step;
  root.innerHTML = `
    <div class="brand-word" style="font-size:18px">CJ<span>&rsquo;</span>s · The Broaster Kings</div>
    <h1 style="margin-top:14px">Join the <span>crew</span></h1>
    ${n === 0 ? `<p class="lead">Fill out the application right here. It takes about 10 minutes, and your answers are saved on this device as you go, so you can finish later.</p>` : ''}
    <div class="ap-prog" aria-label="Step ${n + 1} of ${STEPS.length}"><div class="row between small"><b>Step ${n + 1} of ${STEPS.length} · ${STEPS[n]}</b><span class="faint">${n < 5 ? 'Saved on this device' : 'Last step'}</span></div><div class="prog"><i style="width:${(n + 1) / STEPS.length * 100}%"></i></div></div>
    <form id="apf" novalidate>${VIEWS[n]()}
      <div class="ap-nav">${n > 0 ? `<button type="button" class="btn" data-nav="back">Back</button>` : '<span></span>'}
      ${n < 5 ? `<button type="submit" class="btn primary">Next</button>` : `<button type="submit" class="btn primary" id="apSend" ${sending ? 'disabled' : ''}>${sending ? 'Sending…' : `${ic('check')} Submit application`}</button>`}</div>
    </form>
    ${n === 0 && hasDraft() ? `<p class="small faint" style="margin-top:16px;text-align:center">Started an application before? Your answers were restored. <button type="button" class="link" data-reset="1">Start over</button></p>` : ''}
    <footer>Your info goes only to the ${esc(COMPANY)} hiring managers.</footer>`;
}
function hasDraft(){ return !!(F.first || F.phone || F.city); }
function go(n){ F.step = Math.max(0, Math.min(5, n)); save(); render(); window.scrollTo(0, 0); }

root.addEventListener('input', e => { const k = e.target.dataset.k; if (k) set(k, e.target.value); });
root.addEventListener('change', e => {
  const t = e.target;
  if (t.name === 'job'){ F.job = t.value; const j = jobById(t.value); if (j && !F.type) F.type = /season/i.test(j.type) ? 'Seasonal / event days' : j.type; save(); render(); }
  else if (t.dataset.chk){ set(t.dataset.chk, t.checked); if (t.dataset.chk !== 'certify') render(); }
  else if (t.dataset.k && t.tagName === 'SELECT'){ set(t.dataset.k, t.value); if (t.dataset.k === 'heard' || t.dataset.k === 'type') render(); }
  else if (t.id === 'apResume'){ const f = t.files[0]; if (f && f.size > 10 * 1024 * 1024){ t.value = ''; toast('Your resume must be 10 MB or smaller'); return; } resumeFile = f || null; render(); }
});
root.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.set){ set(b.dataset.set, b.dataset.v); render(); }
  else if (b.dataset.av){ const a = F.avail[b.dataset.av], s = b.dataset.s; const i = a.indexOf(s); if (i >= 0) a.splice(i, 1); else a.push(s); save(); render(); }
  else if (b.dataset.skill){ const i = F.skills.indexOf(b.dataset.skill); if (i >= 0) F.skills.splice(i, 1); else F.skills.push(b.dataset.skill); save(); render(); }
  else if (b.dataset.rmres){ resumeFile = null; render(); }
  else if (b.dataset.addjob){ F.jobs.push(blankJob()); save(); render(); }
  else if (b.dataset.rmjob){ F.jobs.splice(+b.dataset.rmjob, 1); save(); render(); }
  else if (b.dataset.go){ go(+b.dataset.go); }
  else if (b.dataset.nav === 'back'){ go(F.step - 1); }
  else if (b.dataset.reset){ if (confirm('Clear your saved answers and start over?')){ clearDraft(); location.reload(); } }
});
root.addEventListener('submit', async e => {
  e.preventDefault();
  const msg = check(F.step); if (msg){ toast(msg); return; }
  if (F.step < 5){ go(F.step + 1); return; }
  for (let i = 0; i < 5; i++){ const m = check(i); if (m){ go(i); setTimeout(() => toast(m), 50); return; } }
  if (sending) return;
  sending = true; render();
  const j = jobById(F.job);
  const form = {
    type: F.type, start: F.start, hours: F.hours,
    street: F.street, city: F.city, zip: F.zip, contact: F.contact, adult: F.adult, workAuth: F.workAuth,
    avail: F.avail, availText: availText(), events: F.events, transport: F.transport, availNote: F.availNote,
    noExp: F.noExp, jobs: F.noExp ? [] : F.jobs.filter(x => x.employer.trim()), foodCard: F.foodCard, foodCardExp: F.foodCardExp, skills: F.skills,
    schoolLevel: F.schoolLevel, school: F.school, refs: F.refs.filter(r => r.name.trim()), heard: F.heard, heardOther: F.heardOther, extra: F.extra,
    certify: F.certify === true, signature: F.signature.trim()
  };
  const fd = new FormData();
  fd.append('job', F.job); fd.append('name', fullName()); fd.append('phone', F.phone); fd.append('email', F.email);
  fd.append('avail', availText().slice(0, 300)); fd.append('note', [F.hours && `Wants ${F.hours} hrs/wk`, F.type, F.noExp ? 'No experience yet' : F.jobs[0].employer && `Last job: ${F.jobs[0].title} at ${F.jobs[0].employer}`].filter(Boolean).join(' · ').slice(0, 1500));
  fd.append('age', 'yes'); fd.append('website', document.getElementById('apWeb')?.value || ''); fd.append('form', JSON.stringify(form));
  if (resumeFile) fd.append('resume', resumeFile);
  let r = null, res = {};
  try { r = await fetch(API + '/apply', {method: 'POST', body: fd}); res = await r.json().catch(() => ({})); } catch (err) { r = null; }
  sending = false;
  if (!r || !r.ok){ render(); toast(res.error || 'Couldn’t send. Check your connection and try again. Your answers are still saved.'); return; }
  const first = F.first, phone = F.phone; clearDraft();
  root.innerHTML = `<div class="done">${ic('check')}<h2>Thanks, ${esc(first)}</h2><p class="muted">Your application for <b style="color:var(--text)">${esc(j ? j.title : 'the job')}</b> is with our hiring managers. If it&rsquo;s a fit, we&rsquo;ll reach out at ${esc(fmtPhone(phone))} to set up an interview.</p></div><footer>You can close this page.</footer>`;
  window.scrollTo(0, 0);
});

/* ---------- start ---------- */
window.CC_APPLY_START = async function(){
  load();
  let data;
  try { const r = await fetch(API + '/public/jobs', {cache: 'no-store'}); data = await r.json(); }
  catch (e) { root.innerHTML = '<p class="muted">Couldn’t load jobs. Check your connection and refresh.</p>'; return; }
  JOBS = data.jobs || []; if (data.company) COMPANY = data.company;
  if (!JOBS.length){ root.innerHTML = `<h1>Work at <span>CJ&rsquo;s</span></h1><p class="lead">We&rsquo;re not hiring right now. Check back soon, or stop by the Pico Blvd kitchen and say hi.</p>`; return; }
  if (want && jobById(want) && F.step === 0) F.job = want;
  if (!jobById(F.job)){ F.job = JOBS[0].id; if (F.step > 0) F.step = 0; }
  if (!F.type){ const j = jobById(F.job); F.type = /season/i.test(j.type) ? 'Seasonal / event days' : (['Part-time', 'Full-time'].includes(j.type) ? j.type : ''); }
  render();
};
})();
