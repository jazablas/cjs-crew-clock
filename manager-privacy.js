/* CJ's Crew - Clock — manager console: privacy requests (copy / correct / delete my data). */
(() => {
'use strict';
const X = window.MGR; if (!X) return;
const {ic, esc} = CC;
const {EXT, D, toast, openModal, closeModal, mHead, val, avatar, badge, kpi, empty, render} = X;
const PV = {list: null, loading: false, err: ''};
const KIND = {copy: 'Send a copy', correct: 'Correct info', delete: 'Delete data', optout: 'Stop optional data'};
const WHO = {applicant: 'Applicant', crew: 'Current crew', former: 'Former crew', other: 'Other'};
const digits = p => String(p || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
const fPhone = p => { const d = digits(p); return d.length === 10 ? `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}` : esc(p || ''); };
const fWhen = t => new Date(t).toLocaleString('en-US', {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'});
const daysOpen = t => Math.floor((Date.now() - new Date(t).getTime()) / 86400000);

async function load(force){
  if (PV.loading || (PV.list && !force)) return;
  PV.loading = true; PV.err = '';
  const r = await CC.admin.privacy();
  PV.loading = false;
  if (r.ok) PV.list = r.requests || []; else { PV.list = PV.list || []; PV.err = r.error || 'Couldn’t load requests.'; }
  if (X.M.page === 'privacy') render();
}
const openCount = () => (PV.list || []).filter(r => (r.status || 'open') === 'open').length;
EXT.counts.privacy = () => { if (!PV.list) load(); return openCount(); };

function matches(r){
  const d = digits(r.phone);
  const aps = (D().applicants || []).filter(a => digits(a.phone) === d);
  const crew = (D().employees || []).filter(e => digits(e.phone) === d);
  return {aps, crew};
}

function card(r){
  const {aps, crew} = matches(r), open = (r.status || 'open') === 'open', age = daysOpen(r.created_at);
  const due = open ? (age >= 30 ? badge(`${age} days open`, 'bad') : age >= 7 ? badge(`${age} days open`, 'warn') : badge('New', 'info')) : badge(r.status === 'declined' ? 'Declined' : 'Done', r.status === 'declined' ? 'warn' : 'ok');
  const found = [
    ...aps.map(a => `<div class="li"><span class="vt sm">${ic('brief')}</span><div class="grow"><div class="title" style="font-size:14px">Applicant: ${esc(a.name)}</div><div class="meta">${esc(a.status || 'new')}${a.resume ? ' · resume on file' : ''}</div></div>
      <button class="btn sm" data-act="app-view" data-v="${esc(a.id)}">${ic('doc')} View</button>
      ${r.kind === 'delete' ? `<button class="btn sm danger" data-act="pv-erase" data-v="${esc(a.id)}" data-r="${esc(r.id)}">${ic('trash')} Erase</button>` : ''}</div>`),
    ...crew.map(e => `<div class="li">${avatar(e, 28)}<div class="grow"><div class="title" style="font-size:14px">Crew: ${esc(e.name)}${e.active === false ? ' (inactive)' : ''}</div><div class="meta">Time and pay records must be kept 4 years. Delete optional items, documents and chat; leave punches and payroll.</div></div><button class="btn sm" data-act="emp-edit" data-v="${esc(e.id)}">${ic('edit')} Open</button></div>`),
  ].join('') || `<div class="li small muted">No applicant or crew member with this phone number. Check by name.</div>`;
  return `<div class="card" style="margin-bottom:12px">
    <div class="row between" style="align-items:flex-start;gap:10px;flex-wrap:wrap">
      <div><div class="title">${esc(KIND[r.kind] || r.kind)} · ${esc(r.name)}</div>
        <div class="small muted">${esc(WHO[r.who] || r.who || '')} · ${fPhone(r.phone)}${r.email ? ` · ${esc(r.email)}` : ''} · ${fWhen(r.created_at)} · ${esc(r.id)}</div></div>
      <div class="row" style="gap:6px">${due}</div>
    </div>
    ${r.detail ? `<p class="small" style="margin:10px 0 0;white-space:pre-wrap">${esc(r.detail)}</p>` : ''}
    ${open ? `<div class="list" style="margin-top:10px">${found}</div>` : ""}
    ${!open && r.note ? `<p class="small muted" style="margin-top:8px">${esc(r.done_by || '')}${r.done_at ? ' · ' + fWhen(r.done_at) : ''}: ${esc(r.note)}</p>` : ''}
    <div class="row" style="gap:8px;justify-content:flex-end;margin-top:10px">${open ? `<button class="btn sm primary" data-act="pv-close" data-v="${esc(r.id)}">${ic('check')} Mark handled</button>` : `<button class="btn sm" data-act="pv-reopen" data-v="${esc(r.id)}">Reopen</button>`}</div>
  </div>`;
}

function pPrivacy(){
  if (!PV.list){ load(); return empty('Loading privacy requests…'); }
  const list = PV.list, open = list.filter(r => (r.status || 'open') === 'open'), done = list.filter(r => (r.status || 'open') !== 'open');
  const late = open.filter(r => daysOpen(r.created_at) >= 30).length;
  return `
  <div class="kpi-row">${kpi(open.length, 'Open requests', open.length ? 'warn' : '')}${kpi(late, 'Open 30+ days', late ? 'bad' : '')}${kpi(done.length, 'Handled')}</div>
  <div class="card small" style="margin-bottom:14px;line-height:1.55"><b>How to handle these.</b> First check the request is real by calling or texting the phone number. Then:
    <ul style="margin:6px 0 0 18px"><li><b>Copy:</b> for applicants, open the application and print or save it as a PDF. For crew, export their timesheets and pay from Payroll and download their documents.</li>
    <li><b>Correct:</b> fix it in Crew or Hiring.</li>
    <li><b>Delete:</b> applicants can be erased completely, including their application, resume and files. For crew, the law requires keeping time and pay records for 4 years, so delete only optional items.</li></ul>
    Reply within 10 business days, and no later than 45 days. <a href="privacy.html" target="_blank" rel="noopener">View the privacy notice</a>.</div>
  ${PV.err ? `<div class="alert bad" style="margin-bottom:12px">${ic('alert')}<div>${esc(PV.err)}</div></div>` : ''}
  <div class="m-sec-h"><h2>Open</h2><button class="btn sm" data-act="pv-refresh">${ic('refresh')} Refresh</button></div>
  ${open.map(card).join('') || empty('No open privacy requests.', 'Applicants and crew can send one from the privacy notice.')}
  ${done.length ? `<div class="m-sec-h" style="margin-top:18px"><h2>Handled</h2></div>${done.slice(0, 40).map(card).join('')}` : ''}`;
}
X.addPage('privacy', 'shield', 'Privacy requests', 'Team', pPrivacy, 'feedback');

EXT.acts['pv-refresh'] = () => { load(true); toast('Refreshing…'); return false; };
EXT.acts['pv-close'] = (el, v) => {
  openModal(`${mHead('Mark request handled', 'Add a short note about what you did. It’s kept with the request.')}
    <label class="field" style="margin-top:10px"><span>Note</span><textarea class="input" id="pvNote" rows="3" maxlength="1000" placeholder="e.g. Verified by phone. Sent a PDF of the application by email."></textarea></label>
    <div class="row" style="gap:8px;justify-content:flex-end;margin-top:12px"><button class="btn" data-act="pv-set" data-v="${esc(v)}" data-s="declined">Decline</button><button class="btn primary" data-act="pv-set" data-v="${esc(v)}" data-s="done">${ic('check')} Done</button></div>`);
  return false;
};
EXT.acts['pv-reopen'] = (el, v) => { setStatus(v, 'open', ''); return false; };
EXT.acts['pv-set'] = (el, v) => {
  const note = val('pvNote').trim();
  if (el.dataset.s === 'declined' && !note){ toast('Add a note saying why it was declined.'); return false; }
  setStatus(v, el.dataset.s, note); return false;
};
async function setStatus(id, status, note){
  const r = await CC.admin.privacyUpdate(id, status, note);
  if (!r.ok){ toast(r.error || 'Couldn’t save.'); return; }
  closeModal(); toast(status === 'open' ? 'Reopened.' : 'Saved.'); load(true);
}
EXT.acts['pv-erase'] = (el, v) => {
  const a = (D().applicants || []).find(x => x.id === v); if (!a) return false;
  openModal(`${mHead('Erase applicant data?', 'This can’t be undone.')}
    <p style="margin-top:10px">This permanently deletes <b>${esc(a.name)}</b>'s applicant record, full application, resume and any uploaded files. Older saved versions are cleaned too.</p>
    <p class="small muted">Weekly backups made before today still contain it for up to 6 months, then they're replaced automatically.</p>
    <label class="field" style="margin-top:10px"><span>Type <b>ERASE</b> to confirm</span><input class="input" id="pvConfirm" autocomplete="off"></label>
    <div class="row" style="gap:8px;justify-content:flex-end;margin-top:12px"><button class="btn" data-act="close">Cancel</button><button class="btn danger" data-act="pv-erase-go" data-v="${esc(v)}" data-r="${esc(el.dataset.r || '')}">${ic('trash')} Erase permanently</button></div>`);
  return false;
};
EXT.acts['pv-erase-go'] = async (el, v) => {
  if (val('pvConfirm').trim().toUpperCase() !== 'ERASE'){ toast('Type ERASE to confirm.'); return false; }
  el.disabled = true;
  const r = await CC.admin.eraseApplicant(v);
  if (!r.ok){ el.disabled = false; toast(r.error || 'Couldn’t erase.'); return false; }
  const rid = el.dataset.r;
  if (rid) await CC.admin.privacyUpdate(rid, 'done', `Applicant record, application and ${r.files || 0} file(s) erased.`);
  if (CC.pull) await CC.pull();
  closeModal(); toast('Applicant data erased.'); load(true); render(); return false;
};
})();
