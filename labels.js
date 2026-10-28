/* Printable NFC sticker labels with a QR code backup for phones without NFC. */
(() => {
'use strict';
const {ic, esc} = CC; const D = () => CC.db;
const root = document.getElementById('lroot');
const L = { authed:false, pin:'', err:false, venue:'all' };

function qrSvg(text){
  try { const q = qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({cellSize:4, margin:0, scalable:true}); }
  catch(e){ return '<div class="lb-noqr">QR unavailable</div>'; }
}
function render(){
  if (!L.authed){
    root.innerHTML = `<div class="lb-lock"><div class="brand-word" style="font-size:30px">CJ<span>&rsquo;</span>s Sticker Labels</div>
      <p class="muted" style="margin-top:6px">Enter the manager PIN to print sticker labels.</p>
      <div class="pin-dots ${L.err?'shake':''}">${[0,1,2,3].map(i=>`<i class="${i<L.pin.length?'f':''}"></i>`).join('')}</div>
      <div class="keypad">${[1,2,3,4,5,6,7,8,9].map(n=>`<button class="key" data-act="key" data-v="${n}">${n}</button>`).join('')}
        <span></span><button class="key" data-act="key" data-v="0">0</button><button class="key fn" data-act="key" data-v="del">Delete</button></div></div>`;
    return;
  }
  const tags = D().nfcTags.filter(t => t.active !== false && (L.venue==='all' || t.venue===L.venue));
  const vs = D().venues.filter(v => D().nfcTags.some(t => t.venue===v.id));
  root.innerHTML = `
  <div class="lb-bar">
    <div><div class="brand-word" style="font-size:26px">CJ<span>&rsquo;</span>s Sticker Labels</div>
      <div class="small muted">Print, cut out and stick each label next to (or over) its NFC sticker. Phones without NFC can scan the QR code with the camera instead.</div></div>
    <div class="row" style="gap:8px;flex-wrap:wrap">
      <select class="input" id="lbVenue" style="width:auto;min-height:40px"><option value="all">All venues</option>${vs.map(v=>`<option value="${v.id}" ${L.venue===v.id?'selected':''}>${esc(v.name)}</option>`).join('')}</select>
      <button class="btn sm primary" data-act="print">${ic('sheet')} Print labels</button>
    </div>
  </div>
  ${CC.db.settings.crewAppUrl ? '' : `<div class="alert warn lb-warn">${ic('alert')}<div>These codes point to <b>${esc(CC.crewAppBase())}</b>. Set your permanent crew app address in Rules before printing, or the labels will stop working when this preview address changes.</div></div>`}
  <div class="lb-grid">${tags.map(t => { const v = CC.venueById(t.venue), url = CC.tagUrl(t); return `
    <div class="lb-card">
      <div class="lb-top"><span class="lb-brand">CJ<span>&rsquo;</span>s Wings</span><span class="lb-crew">Crew clock</span></div>
      <div class="lb-tap"><span class="lb-nfc">${ic('nfc')}</span><div><b>Tap phone here</b><small>to clock in, take a break or clock out</small></div></div>
      <div class="lb-qr">${qrSvg(url)}</div>
      <div class="lb-or">No NFC? Scan with your camera</div>
      <div class="lb-where"><b>${esc(v.name)}</b><span>${esc(t.label)}</span></div>
      <div class="lb-code">${esc(t.code)}</div>
    </div>`; }).join('') || '<p class="muted">No active stickers. Add one on the NFC stickers page of the manager console.</p>'}</div>`;
}
document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act, v = el.dataset.v;
  if (act==='key'){
    if (v==='del') L.pin = L.pin.slice(0,-1); else if (L.pin.length<4) L.pin += v;
    L.err = false;
    if (L.pin.length===4){ if (L.pin === D().settings.managerPin){ L.authed = true; } else { L.err = true; L.pin=''; } }
    render();
  } else if (act==='print'){ window.print(); }
});
document.addEventListener('change', ev => { if (ev.target.id==='lbVenue'){ L.venue = ev.target.value; render(); } });
CC.subscribe(() => { if (L.authed) render(); });
CC.ready.then(render);
})();
