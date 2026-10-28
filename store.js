/* CJ's Crew Clock — shared data store.
   Used by both the employee app (index.html) and the manager console (manager.html).
   Everything is sample data kept on a small sync server (server.py). Open both apps on
   any tabs or devices and they stay in sync. */
(() => {
'use strict';
const KEY = 'cjcc:v2'; // data version tag

/* ---------- Icons ---------- */
const P = {
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  sheet:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1.2-3.4 3.6-5 6.5-5s5.3 1.6 6.5 5"/><circle cx="17" cy="9" r="2.6"/><path d="M16.5 14.2c2.3.2 4 1.6 5 4.3"/>',
  store:'<path d="M3 9l1.5-5h15L21 9"/><path d="M4 9v11h16V9"/><path d="M3 9h18"/><path d="M9 20v-6h6v6"/>',
  stadium:'<ellipse cx="12" cy="8" rx="9" ry="3.5"/><path d="M3 8v7c0 1.9 4 3.5 9 3.5s9-1.6 9-3.5V8"/><path d="M8 11.2v7M16 11.2v7"/>',
  truck:'<path d="M2 6h11v10H2z"/><path d="M13 9h4l4 4v3h-8"/><circle cx="6" cy="17.5" r="2"/><circle cx="17" cy="17.5" r="2"/>',
  tent:'<path d="M12 3L2 20h20L12 3z"/><path d="M12 3v17M8.5 20L12 13l3.5 7"/>',
  pin:'<path d="M12 21s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  alert:'<path d="M12 3l10 18H2L12 3z"/><path d="M12 10v4M12 17.5v.5"/>',
  check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  coffee:'<path d="M4 8h13v6a5 5 0 01-5 5H9a5 5 0 01-5-5V8z"/><path d="M17 10h1.5a2.5 2.5 0 010 5H17"/>',
  meal:'<path d="M7 3v8M5 3v5a2 2 0 004 0V3M7 11v10"/><path d="M17 3c-2 0-3 2.5-3 6s1 4 3 4v8"/>',
  out:'<path d="M15 12H4M8 8l-4 4 4 4"/><path d="M14 4h5a1 1 0 011 1v14a1 1 0 01-1 1h-5"/>',
  sliders:'<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  shield:'<path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6l8-3z"/>',
  cam:'<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  chev:'<path d="M9 6l6 6-6 6"/>',
  chevL:'<path d="M15 6l-6 6 6 6"/>',
  x:'<path d="M6 6l12 12M18 6L6 18"/>',
  nav:'<path d="M3 11l18-8-8 18-2-8-8-2z"/>',
  edit:'<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M14 6l4 4"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  inbox:'<path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 3h6l1-3h5"/>',
  live:'<circle cx="12" cy="12" r="3"/><path d="M6.3 6.3a8 8 0 000 11.4M17.7 6.3a8 8 0 010 11.4M3.5 3.5a12 12 0 000 17M20.5 3.5a12 12 0 010 17"/>',
  dollar:'<path d="M12 3v18M16.5 7.5c0-1.9-2-3-4.5-3s-4.5 1.2-4.5 3.3c0 4.7 9 2.4 9 7 0 2.1-2 3.4-4.5 3.4s-4.5-1.2-4.5-3.2"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
  mega:'<path d="M3 10v4h3l7 4V6L6 10H3z"/><path d="M16 9a4 4 0 010 6M18.5 6.5a7.5 7.5 0 010 11"/>',
  list:'<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  download:'<path d="M12 4v11M7 10l5 5 5-5"/><path d="M4 19h16"/>',
  lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
  ext:'<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  nfc:'<path d="M6 8.5a5 5 0 010 7M9.5 6a9 9 0 010 12M13 3.5a13 13 0 010 17"/><rect x="16" y="7" width="5" height="10" rx="1.5"/>',
  tablet:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M11 17h2"/>',
  copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
  refresh:'<path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7"/>',
  phone:'<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/>',
  chat:'<path d="M4 5h16v11H9l-5 4V5z"/><path d="M8 9.5h8M8 12.5h5"/>',
  checklist:'<path d="M4 6l1.5 1.5L8 5M4 12l1.5 1.5L8 11M4 18l1.5 1.5L8 17"/><path d="M11 6.5h9M11 12.5h9M11 18.5h9"/>',
  chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  swap:'<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
  star:'<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>',
  doc:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  book:'<path d="M4 5a2 2 0 012-2h13v15H6a2 2 0 00-2 2V5z"/><path d="M4 20a2 2 0 002 2h13v-4"/>',
  brief:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M3 13h18"/>',
  bell:'<path d="M6 16V11a6 6 0 0112 0v5l2 2H4l2-2z"/><path d="M10 20a2 2 0 004 0"/>',
  plug:'<path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 01-12 0V8zM12 17v4"/>',
  spark:'<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18"/>',
  timeline:'<path d="M3 6h8M7 12h11M5 18h6"/><circle cx="14" cy="6" r="1.5"/><circle cx="20" cy="12" r="1.5"/><circle cx="14" cy="18" r="1.5"/>',
  jar:'<path d="M8 3h8M7 6h10l1 3v10a2 2 0 01-2 2H8a2 2 0 01-2-2V9l1-3z"/><path d="M12 11v6M10 13.5c0-.8.9-1.3 2-1.3s2 .5 2 1.3-1 1-2 1.2-2 .5-2 1.3.9 1.3 2 1.3 2-.5 2-1.3"/>',
  heart:'<path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/>',
};
const ic = (n, cls='') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]||''}</svg>`;

const VTYPE = {
  fixed:{label:'Restaurant', icon:'store'},
  stadium:{label:'Stadium', icon:'stadium'},
  truck:{label:'Food truck', icon:'truck'},
  popup:{label:'Pop-up', icon:'tent'},
};
const LOCS = [
  {id:'dhsp_gate', label:'At Dignity Health Sports Park', sub:'Vendor gate, 80 m from stand', lat:33.86500, lng:-118.26150, acc:12},
  {id:'pico', label:'At Pico Blvd Kitchen', sub:'Inside the restaurant', lat:34.04766, lng:-118.34330, acc:9},
  {id:'truck', label:'Next to Boss Truck 1', sub:'Exposition Park', lat:34.01712, lng:-118.28545, acc:14},
  {id:'carson', label:'At Carson Pop-Up', sub:'Temporary venue', lat:33.83185, lng:-118.28150, acc:18},
  {id:'dhsp_far', label:'Stadium parking lot (far)', sub:'About 1 km outside the geofence', lat:33.87380, lng:-118.26400, acc:20},
  {id:'weak', label:'Pico, weak GPS signal', sub:'Accuracy ±160 m', lat:34.04800, lng:-118.34420, acc:160},
  {id:'home', label:'At home', sub:'Not near any venue', lat:33.91920, lng:-118.40070, acc:10},
  {id:'real', label:'Use my real location', sub:'Asks your browser for GPS', real:true},
];
const COLORS = ['#d23a1f','#e3a92b','#7fa8c9','#5fb37a','#c97fb5','#e07b39','#9c8cf0','#4fb3b3'];

/* ---------- Time + format helpers ---------- */
const MIN = 60e3, HR = 36e5, DAY = 864e5;
let db = null;
const now = () => Date.now() + (db?.offsetMs || 0);
const startOfDay = t => { const d = new Date(t); d.setHours(0,0,0,0); return d.getTime(); };
const at = (dayStart, hhmm) => { const [h,m] = hhmm.split(':').map(Number); return dayStart + h*HR + m*MIN; };
const fTime = t => new Date(t).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
const fDate = t => new Date(t).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
const fDay = t => new Date(t).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});
const fShort = t => new Date(t).toLocaleDateString('en-US',{month:'short',day:'numeric'});
const fDur = ms => { ms = Math.max(0,ms); const h = Math.floor(ms/HR), m = Math.floor(ms%HR/MIN), s = Math.floor(ms%MIN/1e3); return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; };
const fHM = ms => { ms = Math.max(0,ms); const h = Math.floor(ms/HR), m = Math.round(ms%HR/MIN); return h ? `${h}h ${m}m` : `${m}m`; };
const fHrs = h => h.toFixed(2);
const money = n => (n<0?'-':'') + '$' + Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pad = n => String(n).padStart(2,'0');
const toDateInput = t => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const toTimeInput = t => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const fromInputs = (date, time) => new Date(`${date}T${time||'00:00'}`).getTime();
const initialsOf = name => name.trim().split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase();

/* ---------- Geo ---------- */
const toRad = d => d*Math.PI/180;
function dist(a,b){ const R=6371e3, dLat=toRad(b.lat-a.lat), dLng=toRad(b.lng-a.lng);
  const x = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(x)); }
function bearing(a,b){ const y=Math.sin(toRad(b.lng-a.lng))*Math.cos(toRad(b.lat));
  const x=Math.cos(toRad(a.lat))*Math.sin(toRad(b.lat))-Math.sin(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.cos(toRad(b.lng-a.lng));
  return Math.atan2(y,x); }
const fDist = m => m < 1000 ? `${Math.round(m)} m` : `${(m/1000).toFixed(1)} km`;
function venueActive(v){
  if (v.active === false) return false;
  if (!v.window || !v.window[0]) return true;
  const t = now(); const [a,b] = v.window;
  return t >= new Date(a+'T00:00').getTime() && t <= new Date(b+'T23:59').getTime();
}

/* ---------- Seed data ---------- */
const DEFAULT_SETTINGS = {
  company:'CJ\u2019s Wings', managerName:'CJ (Owner)', managerPin:'9999',
  otDaily:8, dtDaily:12, otWeekly:40, otMult:1.5, dtMult:2,
  mealByHour:5, mealMin:30, restPer:4, restMin:10, mealPremium:true,
  earlyMin:15, lateGrace:7,
  requireSelfie:true, allowExceptions:true, allowUnscheduled:true, allowWeakGps:true, blockEarly:false,
  autoClockOutHrs:14,
  // Break plan: what the tablet board and crew app alert on. 'at' = hours worked when the break is due.
  breakPlan:[
    {kind:'rest', label:'10-min break', min:10, at:2, minShift:3.5},
    {kind:'meal', label:'Lunch break', min:30, at:4.5, minShift:5},
    {kind:'rest', label:'15-min break', min:15, at:6.5, minShift:6},
  ],
  breakWarnMin:10, breakLateMin:15,
  allowNfc:true, allowKiosk:true, nfcSelfie:false, nfcPairing:true, crewAppUrl:'',
  payAnchor:'2026-10-12', periodDays:14, paydayLag:4,
  // Labor, compliance and team tools
  laborTarget:28, restBetweenHrs:10, noticeDays:14, predictPay:true,
  minorMaxDay:8, minorMaxWeek:48, minorLatest:'22:00', maxOnBreak:1,
  attestLateEarly:true, leaveEarlyMin:15,
  confirmShifts:true, smsReminders:true, remindBeforeMin:60,
  ewaEnabled:true, ewaPct:50, ewaFee:0, ewaAuto:false,
  surveyOnOut:true, tipMethod:'hours', tipRolePct:{Cashier:30, Fryer:30, Prep:20, 'Truck lead':12, Driver:8},
};

function seed(){
  const today = startOfDay(Date.now());
  const TODAY_START = Math.ceil(Date.now() / (5*60e3)) * 5*60e3;
  const venues = [
    {id:'pico', name:'Pico Blvd Kitchen', type:'fixed', addr:'5068 W Pico Blvd, Los Angeles', lat:34.04768, lng:-118.34340, r:75, note:'Clock in from the back-of-house door.'},
    {id:'dhsp', name:'Dignity Health Sports Park', type:'stadium', addr:'18400 Avalon Blvd, Carson', lat:33.86440, lng:-118.26110, r:450, note:'Enter at the vendor gate. Stand 114.'},
    {id:'sofi', name:'SoFi Stadium · Catering', type:'stadium', addr:'1001 Stadium Dr, Inglewood', lat:33.95350, lng:-118.33920, r:500, note:'Truck staging at Lot C (sample).'},
    {id:'truck', name:'Boss Truck 1', type:'truck', addr:'Live GPS: Exposition Park', lat:34.01700, lng:-118.28560, r:60, note:'Geofence follows the truck\u2019s GPS, wherever it parks.'},
    {id:'carson', name:'Carson Preview Pop-Up', type:'popup', addr:'Carson, CA (sample site)', lat:33.83170, lng:-118.28170, r:120, note:'Temporary venue.', window:['2026-10-18','2026-11-01']},
    {id:'aero', name:'Summer Games Pop-Up', type:'popup', addr:'El Segundo (sample site)', lat:33.91900, lng:-118.41600, r:150, note:'Ended. No longer accepts punches.', window:['2026-07-10','2026-07-12']},
  ].map(v => ({active:true, ...v}));
  const employees = [
    {id:'E-1042', name:'Marcus Bell', pin:'1234', initials:'MB', color:'#d23a1f', roles:[{role:'Fryer', rate:21.00},{role:'Cashier', rate:20.00}], home:'dhsp', phone:'(310) 555-0142', active:true},
    {id:'E-1077', name:'Dee Alvarez', pin:'2468', initials:'DA', color:'#e3a92b', roles:[{role:'Truck lead', rate:23.50},{role:'Driver', rate:22.00}], home:'truck', phone:'(323) 555-0177', active:true},
    {id:'E-1103', name:'Jordan Price', pin:'1111', initials:'JP', color:'#7fa8c9', roles:[{role:'Cashier', rate:20.00},{role:'Prep', rate:20.50}], home:'pico', phone:'(424) 555-0103', active:true},
    {id:'E-1118', name:'Luis Ortega', pin:'3333', initials:'LO', color:'#5fb37a', roles:[{role:'Fryer', rate:21.00},{role:'Prep', rate:20.50}], home:'pico', phone:'(213) 555-0118', active:true},
    {id:'E-1124', name:'Ana Ruiz', pin:'4444', initials:'AR', color:'#c97fb5', roles:[{role:'Cashier', rate:20.00}], home:'pico', phone:'(310) 555-0124', active:true, minor:true, birth:'2009-03-14'},
    {id:'E-1131', name:'Rosa Delgado', pin:'5151', initials:'RD', color:'#9fb86a', roles:[{role:'Cashier', rate:20.00},{role:'Prep', rate:20.50}], home:'pico', phone:'(323) 555-0131', active:true},
  ];
  const sched = {
    'E-1042':[[0,'dhsp','15:30','23:00','Fryer','Stand 114 · match day'],[1,'pico','11:00','19:00','Cashier','Front counter'],[3,'sofi','13:00','22:00','Fryer','Truck staging, Lot C'],[4,'dhsp','16:00','23:30','Fryer','Stand 114']],
    'E-1077':[[0,'truck','10:30','18:30','Truck lead','Exposition Park service'],[2,'carson','11:00','17:00','Truck lead','Pop-up service'],[3,'sofi','12:00','22:00','Driver','Catering drop + service']],
    'E-1103':[[0,'pico','10:30','18:30','Prep','Kitchen prep line'],[1,'pico','10:30','18:30','Cashier','Front counter'],[4,'carson','11:00','17:00','Cashier','Pop-up register']],
  };
  const shifts = [];
  Object.entries(sched).forEach(([emp, list]) => list.forEach(([dOff,venue,s,e,role,station],i) => {
    const day = today + dOff*DAY;
    let startT = at(day,s), endT = at(day,e);
    if (dOff === 0){ const len = endT-startT; startT = Math.max(day, TODAY_START); endT = startT + len; }
    shifts.push({id:`S-${emp.slice(2)}-${i+1}`, emp, venue, startT, endT, role, station});
  }));
  // Crew already on the clock right now, so the tablet board and break alerts have something to show.
  const NOW = Date.now();
  const liveSeed = [
    // emp, venue, role, minutes ago, breaks [type, minutes after in, length], shift length hrs
    ['E-1077','truck','Truck lead', 2*60+6, [], 8],
    ['E-1103','pico','Prep', 4*60+33, [['rest',125,10]], 8],
    ['E-1118','pico','Fryer', 7*60+8, [['rest',118,10],['meal',262,30]], 9],
    ['E-1131','pico','Cashier', 60+52, [], 7],
  ];
  const livePunches = liveSeed.map(([empId, venue, role, ago, brs, len], k) => {
    const inT = NOW - ago*MIN; const v = venues.find(x=>x.id===venue); const e = employees.find(x=>x.id===empId);
    const sh = shifts.find(x => x.emp===empId && x.startT >= today && x.startT < today+DAY);
    const sStart = Math.round(inT/(5*MIN))*5*MIN;
    if (sh){ sh.startT = sStart; sh.endT = sStart + len*HR; sh.venue = venue; sh.role = role; }
    else shifts.push({id:`S-${empId.slice(2)}-T`, emp:empId, venue, startT:sStart, endT:sStart + len*HR, role, station:''});
    return {id:`P-${empId.slice(2)}-L${k+1}`, emp:empId, venue, role, rate:e.roles.find(r=>r.role===role).rate, inT,
      breaks: brs.map(([type,off,m]) => ({type, start:inT + off*MIN, end:inT + (off+m)*MIN, min:m})), flags:[],
      inLoc:{lat:v.lat, lng:v.lng, acc:10, method: k===0 ? 'GPS geofence' : 'NFC tag'}, selfie:'none', tipsCard:0};
  });
  shifts.push({id:'S-1124-1', emp:'E-1124', venue:'pico', startT:Math.ceil((NOW + 75*MIN)/(15*MIN))*15*MIN, endT:Math.ceil((NOW + 75*MIN)/(15*MIN))*15*MIN + 6*HR, role:'Cashier', station:'Front counter'});
  const nfcTags = [
    {id:'T-1', code:'PICO-BOH-7K2Q', venue:'pico', label:'Back-of-house door', active:true, taps:0},
    {id:'T-2', code:'TRUCK1-CAB-4M8D', venue:'truck', label:'Truck service window', active:true, taps:0},
    {id:'T-3', code:'DHSP-114-9X3B', venue:'dhsp', label:'Stand 114 register', active:true, taps:0},
    {id:'T-4', code:'SOFI-LOTC-2P6W', venue:'sofi', label:'Lot C staging', active:true, taps:0},
    {id:'T-5', code:'CARSON-POP-5R1T', venue:'carson', label:'Pop-up tent pole', active:true, taps:0},
  ];
  const openShifts = [
    {id:'O1', venue:'sofi', startT:at(today+2*DAY,'14:00'), endT:at(today+2*DAY,'23:00'), role:'Cashier', note:'Concert catering · 2 spots', spots:2},
    {id:'O2', venue:'truck', startT:at(today+5*DAY,'10:00'), endT:at(today+5*DAY,'16:00'), role:'Driver', note:'Weekend market run', spots:1},
  ];
  const tmpDb = {settings:{...DEFAULT_SETTINGS}};
  const ps = periodStartFor(Date.now(), tmpDb.settings);
  const tpl = {
    'E-1042':[
      [0,'pico','Cashier','10:58','19:12',[['meal','14:02',31],['rest','12:15',10],['rest','17:00',10]]],
      [1,'pico','Fryer','11:00','19:34',[['meal','14:30',30],['rest','12:40',10],['rest','17:30',10]]],
      [3,'dhsp','Fryer','15:24','23:58',[['meal','19:05',32],['rest','17:30',10],['rest','21:45',10]]],
      [4,'dhsp','Fryer','15:29','23:41',[['meal','20:51',30],['rest','17:40',10],['rest','22:10',10]], {mealLate:true}],
      [6,'sofi','Fryer','12:55','23:40',[['meal','16:30',30],['meal','21:00',30],['rest','14:45',10],['rest','19:10',10]]],
      [7,'pico','Cashier','11:02','17:05',[['meal','14:00',30],['rest','12:45',10]], {editPending:'Forgot to clock out — left at 5:05 PM'}],
      [8,'dhsp','Fryer','16:01','22:46',[['meal','19:20',30],['rest','17:45',10]], {exception:'approved', reason:'Phone died at gate; manager verified'}],
      [9,'pico','Cashier','10:52','18:58',[['meal','14:10',30],['rest','12:30',10],['rest','16:45',10]], {flags:['Low GPS accuracy']}],
    ],
    'E-1077':[
      [0,'truck','Truck lead','09:40','17:55',[['meal','13:10',30],['rest','11:30',10],['rest','15:40',10]]],
      [2,'truck','Driver','10:15','15:50',[['rest','12:30',10]], {waived:true}],
      [5,'sofi','Truck lead','11:30','23:50',[['meal','15:00',30],['meal','19:30',30],['rest','13:30',10],['rest','17:30',10],['rest','21:30',10]]],
      [7,'carson','Truck lead','10:45','17:20',[['meal','13:30',30],['rest','12:00',10]]],
      [9,'truck','Truck lead','09:50','18:05',[['meal','13:00',30],['rest','11:40',10],['rest','15:50',10]], {flags:['Venue change']}],
    ],
    'E-1103':[
      [0,'pico','Prep','10:28','18:40',[['meal','13:45',30],['rest','12:00',10],['rest','16:15',10]]],
      [1,'pico','Cashier','10:31','18:35',[['meal','14:00',30],['rest','12:10',10],['rest','16:30',10]]],
      [2,'pico','Prep','10:30','16:00',[['rest','13:00',10]], {waived:true}],
      [7,'pico','Cashier','10:29','18:31',[['meal','14:05',30],['rest','12:20',10],['rest','16:40',10]]],
      [8,'pico','Prep','10:05','18:20',[['meal','13:30',30],['rest','12:00',10],['rest','16:00',10]], {flags:['Early punch']}],
    ],
  };
  const punches = [], requests = [];
  Object.entries(tpl).forEach(([empId, list]) => {
    const emp = employees.find(e=>e.id===empId);
    list.forEach(([d,venue,role,i,o,brs,extra={}],k) => {
      const day = ps + d*DAY; if (day >= today) return;
      const inT = at(day,i); let outT = at(day,o); if (outT < inT) outT += DAY;
      const v = venues.find(x=>x.id===venue);
      const rate = emp.roles.find(r=>r.role===role)?.rate ?? emp.roles[0].rate;
      const id = `P-${empId.slice(2)}-${k+101}`;
      punches.push({
        id, emp:empId, venue, role, rate, inT, outT,
        breaks: brs.map(([type,s,m]) => { const st = at(day,s); return {type, start:st, end: st + m*MIN}; }),
        tipsCash: [12,0,24.5,18,31,6,15,9][k%8], tipsCard: [18.4,22,41.25,36.1,58.75,14.2,27.9,19][k%8],
        inLoc:{lat:v.lat + 0.0002, lng:v.lng - 0.0001, acc:[8,11,14,9,22,7,0][k%7] || 12, method: extra.exception ? 'Manager exception' : 'GPS geofence'},
        attest: extra.mealLate ? 'missed' : 'ok', missed: extra.mealLate ? ['Meal started after the 5th hour'] : [],
        flags: extra.flags || [],
        ...extra,
      });
      if (extra.editPending) requests.push({id:`R-${requests.length+1}`, emp:empId, kind:'Punch correction', detail:extra.editPending, status:'Pending', t:outT + 2*HR, punchId:id});
    });
  });
  requests.push({id:`R-${requests.length+1}`, emp:'E-1103', kind:'Time off', detail:`Off ${fShort(today+6*DAY)} · family event`, status:'Pending', t:Date.now() - 5*HR, payload:{date:toDateInput(today+6*DAY)}});
  const base = {
    v:2, seededAt:Date.now(), seedDay:today, offsetMs:0, seq:900,
    settings:{...DEFAULT_SETTINGS},
    employees, venues, shifts, openShifts, punches:[...punches, ...livePunches], requests, nfcTags, devices:{},
    announcements:[{id:'A-1', text:'Match day at Dignity Health Sports Park. Stand 114 opens 90 min before kickoff. Wear the black Boss Crew shirts.', t:Date.now() - 3*HR, venue:'dhsp'}, {id:'A-2', text:'Health inspector may stop by this afternoon. Hairnets on, temp logs filled out, sanitizer buckets fresh.', t:Date.now() - 40*MIN, venue:'pico', urgent:true, board:true, boardUntil: startOfDay(Date.now()) + DAY}],
    approvals:{}, closedPeriods:{},
    log:[{t:Date.now() - 3*HR, who:'Manager', text:'Posted announcement for Dignity Health Sports Park'}],
  };
  return Object.assign(base, seedExtras(base));
}

/* ---------- Extra sample data: availability, sales, chat, checklists, paperwork, training, hiring ----------
   Also used to fill in older saved data that predates these features. */
const hashN = str => { let h = 2166136261; for (const c of String(str)){ h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return ((h >>> 0) % 1000) / 1000; };
const SALES_BASE = { pico:[2900,1900,2000,2100,2300,3300,3600], truck:[2100,1100,1200,1300,1400,1900,2400], carson:[1500,1100,1100,1200,1300,1500,1700] };
const EVENT_BASE = { dhsp:6200, sofi:7800 };
const HOUR_W = {10:2,11:7,12:12,13:11,14:7,15:5,16:6,17:10,18:13,19:12,20:8,21:5,22:2};
function seedExtras(d){
  const today = d.seedDay || startOfDay(Date.now()), NOW = Date.now();
  const T = (dOff, hhmm) => at(today + dOff*DAY, hhmm);
  const X = {};
  const wk = (from, to, offDays=[]) => Object.fromEntries([0,1,2,3,4,5,6].map(i => [i, offDays.includes(i) ? {off:true} : {from, to}]));
  X.availability = {
    'E-1042': {days: wk('11:00','23:59',[2]), note:'Tuesdays are school nights for my kid.', t:NOW - 9*DAY},
    'E-1077': {days: wk('08:00','20:00',[1]), note:'', t:NOW - 20*DAY},
    'E-1103': {days: wk('09:00','19:00',[]), note:'Prefer day shifts.', t:NOW - 4*DAY},
    'E-1118': {days: wk('10:00','23:00',[3]), note:'', t:NOW - 12*DAY},
    'E-1124': {days: {0:{from:'10:00',to:'22:00'},1:{from:'15:30',to:'22:00'},2:{from:'15:30',to:'22:00'},3:{from:'15:30',to:'22:00'},4:{from:'15:30',to:'22:00'},5:{from:'15:30',to:'22:00'},6:{from:'10:00',to:'22:00'}}, note:'In school until 3 PM on weekdays.', t:NOW - 30*DAY},
    'E-1131': {days: wk('10:00','22:00',[0]), note:'', t:NOW - 2*DAY},
  };
  // Today's live shifts were set before these preferences; widen them so only future conflicts show as examples.
  const hhmm = t => { const x = new Date(t); return String(x.getHours()).padStart(2,'0')+':'+String(x.getMinutes()).padStart(2,'0'); };
  (d.shifts||[]).filter(s => s.startT < today + DAY && X.availability[s.emp]).forEach(s => {
    const dw = new Date(s.startT).getDay(), cur = X.availability[s.emp].days[dw] || {}, f = hhmm(s.startT), e = s.endT >= startOfDay(s.startT) + DAY ? '23:59' : hhmm(s.endT);
    X.availability[s.emp].days[dw] = cur.off ? {from:f, to:e} : {from: (cur.from && cur.from < f) ? cur.from : f, to: (cur.to && cur.to > e) ? cur.to : e};
  });
  X.needs = [
    {id:'N-1', venue:'pico', dows:[0,1,2,3,4,5,6], role:'Cashier', from:'10:30', to:'18:30', count:1},
    {id:'N-2', venue:'pico', dows:[0,1,2,3,4,5,6], role:'Fryer', from:'11:00', to:'19:00', count:1},
    {id:'N-3', venue:'pico', dows:[4,5,6], role:'Cashier', from:'16:00', to:'22:00', count:1},
    {id:'N-4', venue:'truck', dows:[0,2,4,5,6], role:'Truck lead', from:'10:30', to:'18:30', count:1},
  ];
  X.published = {};
  const ws = today - ((new Date(today).getDay()+6)%7)*DAY;
  X.published[ws] = {t:NOW - 6*DAY, by:'CJ (Owner)'};
  X.sales = {};
  for (let k = 28; k >= 1; k--){
    const day = today - k*DAY, dow = new Date(day).getDay(), key = toDateInput(day);
    Object.entries(SALES_BASE).forEach(([v, arr]) => { if (v==='carson' && k > 10) return; X.sales[`${v}|${key}`] = Math.round(arr[dow] * (0.88 + hashN(v+key)*0.24)); });
    Object.entries(EVENT_BASE).forEach(([v, b]) => { if (hashN('ev'+v+key) > 0.72) X.sales[`${v}|${key}`] = Math.round(b * (0.85 + hashN(v+key)*0.3)); });
  }
  X.tipPools = [];
  X.channels = [
    {id:'C-all', name:'All crew', venue:null},
    {id:'C-pico', name:'Pico kitchen', venue:'pico'},
    {id:'C-truck', name:'Boss Truck 1', venue:'truck'},
    {id:'C-dhsp', name:'Stadium crew', venue:'dhsp'},
  ];
  X.messages = [
    {id:'M-1', ch:'C-all', from:'mgr', text:'Welcome to team chat. Shift questions, swaps and heads-ups go here.', t:NOW - 2*DAY},
    {id:'M-2', ch:'C-pico', from:'E-1118', text:'Fryer 2 is running hot again, set it to 345.', t:NOW - 3*HR},
    {id:'M-3', ch:'C-pico', from:'E-1103', text:'Got it. Also low on wing sauce, I put it on the order sheet.', t:NOW - 2.8*HR},
    {id:'M-4', ch:'C-pico', from:'mgr', text:'Thanks both. Sauce delivery comes at 3.', t:NOW - 2.5*HR},
    {id:'M-5', ch:'C-truck', from:'E-1077', text:'Parked at Exposition Park, line already forming.', t:NOW - 2*HR},
    {id:'M-6', ch:'DM:E-1131', from:'E-1131', text:'Hi CJ, can I swap my Saturday if Jordan agrees?', t:NOW - 50*MIN},
  ];
  X.reads = {mgr:{'C-all':NOW, 'C-pico':NOW - 2.5*HR, 'C-truck':NOW - 3*HR, 'C-dhsp':NOW}, 'E-1118':{'C-pico':NOW - 3*HR}, 'E-1103':{'C-pico':NOW - 2.8*HR}};
  X.checklists = [
    {id:'CL-1', name:'Opening checklist', venue:'pico', due:'10:45', items:[
      {id:'a', text:'Fryer oil checked and filtered', type:'check'},
      {id:'b', text:'Walk-in cooler temperature', type:'temp', max:41},
      {id:'c', text:'Hot-holding cabinet temperature', type:'temp', min:135},
      {id:'d', text:'Sanitizer buckets mixed (200 ppm)', type:'check'},
      {id:'e', text:'Front counter ready (photo)', type:'photo'}]},
    {id:'CL-2', name:'Closing checklist', venue:'pico', due:'22:30', items:[
      {id:'a', text:'Fryers off and covered', type:'check'},
      {id:'b', text:'Floors swept and mopped', type:'check'},
      {id:'c', text:'Walk-in cooler temperature', type:'temp', max:41},
      {id:'d', text:'Cash drawer counted', type:'check'},
      {id:'e', text:'Back door locked (photo)', type:'photo'}]},
    {id:'CL-3', name:'Truck pre-trip', venue:'truck', due:'10:30', items:[
      {id:'a', text:'Tires and lights checked', type:'check'},
      {id:'b', text:'Propane tank level OK', type:'check'},
      {id:'c', text:'Cooler temperature', type:'temp', max:41},
      {id:'d', text:'Generator fuel topped up', type:'check'}]},
    {id:'CL-4', name:'Stand 114 setup', venue:'dhsp', due:'14:30', items:[
      {id:'a', text:'Menu boards hung', type:'check'},
      {id:'b', text:'POS and card reader online', type:'check'},
      {id:'c', text:'Hot-holding temperature', type:'temp', min:135}]},
  ];
  X.checkRuns = [
    {id:'CR-1', list:'CL-1', day:today, done:{a:{by:'E-1118', t:NOW - 6.8*HR}, b:{by:'E-1118', t:NOW - 6.7*HR, val:38}, d:{by:'E-1103', t:NOW - 4.3*HR}}},
    {id:'CR-2', list:'CL-3', day:today, done:{a:{by:'E-1077', t:NOW - 2*HR}, b:{by:'E-1077', t:NOW - 2*HR}, c:{by:'E-1077', t:NOW - 1.9*HR, val:37}, d:{by:'E-1077', t:NOW - 1.9*HR}}, signed:{by:'E-1077', t:NOW - 1.9*HR}},
    {id:'CR-3', list:'CL-2', day:today - DAY, done:{a:{by:'E-1042',t:NOW-DAY},b:{by:'E-1042',t:NOW-DAY},c:{by:'E-1042',t:NOW-DAY,val:39},d:{by:'E-1042',t:NOW-DAY},e:{by:'E-1042',t:NOW-DAY,photo:true}}, signed:{by:'E-1042', t:NOW - DAY}},
  ];
  X.docTypes = [
    {id:'w4', name:'W-4 tax form', kind:'sign'},
    {id:'i9', name:'I-9 work eligibility', kind:'sign'},
    {id:'dd', name:'Direct deposit form', kind:'sign'},
    {id:'hb', name:'Crew handbook', kind:'sign'},
    {id:'fh', name:'Food handler card', kind:'card', expires:true},
  ];
  const sg = (dAgo) => ({status:'done', t:NOW - dAgo*DAY});
  X.docs = {
    'E-1042': {w4:sg(200), i9:sg(200), dd:sg(200), hb:sg(200), fh:{status:'done', t:NOW-700*DAY, exp:toDateInput(today + 18*DAY), num:'CA-FH-55021'}},
    'E-1077': {w4:sg(400), i9:sg(400), dd:sg(400), hb:sg(400), fh:{status:'done', t:NOW-300*DAY, exp:toDateInput(today + 420*DAY), num:'CA-FH-49110'}},
    'E-1103': {w4:sg(90), i9:sg(90), dd:sg(90), hb:sg(90), fh:{status:'done', t:NOW-90*DAY, exp:toDateInput(today + 640*DAY), num:'CA-FH-61877'}},
    'E-1118': {w4:sg(60), i9:sg(60), hb:sg(60), fh:{status:'done', t:NOW-1000*DAY, exp:toDateInput(today - 6*DAY), num:'CA-FH-40213'}},
    'E-1124': {w4:sg(30), i9:sg(30), dd:sg(30), fh:{status:'done', t:NOW-30*DAY, exp:toDateInput(today + 1000*DAY), num:'CA-FH-70110'}, wp:{status:'done', t:NOW-30*DAY, exp:'2027-06-30'}},
    'E-1131': {w4:sg(3), i9:sg(3)},
  };
  X.courses = [
    {id:'K-1', title:'Food safety basics', mins:6, required:true, body:['Wash hands for 20 seconds before handling food, after touching raw chicken, and after breaks.','Keep cold food at 41°F or below and hot food at 135°F or above. Between those is the danger zone.','Cook chicken to 165°F. Check with a probe thermometer at the thickest part.'],
      quiz:[{q:'What is the safe internal temperature for cooked chicken?', opts:['145°F','155°F','165°F'], a:2},{q:'Cold food must be held at or below…', opts:['41°F','50°F','60°F'], a:0}]},
    {id:'K-2', title:'Fryer safety', mins:4, required:false, roles:['Fryer'], body:['Never add water or ice to hot oil.','Filter oil only after it cools below 120°F, wearing gloves and an apron.','Keep the Class K extinguisher clear. In a fire, turn off the fryer and cover it; never use water.'],
      quiz:[{q:'What should you use on a grease fire?', opts:['Water','A Class K extinguisher or a cover','Flour'], a:1}]},
    {id:'K-3', title:'Your breaks in California', mins:3, required:true, body:['You get a paid 10-minute rest break for every 4 hours worked.','You get a 30-minute unpaid meal break before the end of your 5th hour.','If you miss or cut a break short, tell us at clock-out. You may be owed an extra hour of pay.'],
      quiz:[{q:'When must your meal break start?', opts:['Before the end of hour 5','Any time','After hour 6'], a:0}]},
  ];
  X.training = {
    'E-1042': {'K-1':{t:NOW-150*DAY, score:100}, 'K-2':{t:NOW-150*DAY, score:100}, 'K-3':{t:NOW-150*DAY, score:100}},
    'E-1077': {'K-1':{t:NOW-300*DAY, score:100}, 'K-3':{t:NOW-300*DAY, score:100}},
    'E-1103': {'K-1':{t:NOW-80*DAY, score:100}},
    'E-1118': {'K-1':{t:NOW-50*DAY, score:50}, 'K-2':{t:NOW-50*DAY, score:100}},
  };
  X.feedback = [
    ['E-1103',1,5,'pico',''],['E-1118',1,3,'pico','Fryer 2 ran hot all shift.'],['E-1042',2,4,'pico',''],['E-1077',2,5,'truck','Great crowd at the park.'],
    ['E-1103',3,4,'pico',''],['E-1042',4,2,'dhsp','Stand was short one person at halftime.'],['E-1077',5,4,'sofi',''],['E-1118',6,4,'pico',''],['E-1103',7,5,'pico',''],['E-1042',8,3,'dhsp','Ran out of cups.'],
  ].map(([emp, dAgo, score, venue, note], i) => ({id:`F-${i+1}`, emp, t:NOW - dAgo*DAY, score, venue, note}));
  X.suggestions = [{id:'SG-1', text:'Could we get a second card reader at Stand 114? Lines back up at halftime.', t:NOW - 3*DAY, venue:'dhsp'}];
  X.jobs = [
    {id:'J-1', title:'Cashier', venue:'pico', rate:20, type:'Part-time', status:'Open', t:NOW - 10*DAY, desc:'Front counter, register and to-go orders. Nights and weekends.'},
    {id:'J-2', title:'Stadium fryer (seasonal)', venue:'dhsp', rate:21, type:'Seasonal', status:'Open', t:NOW - 4*DAY, desc:'Match days at Stand 114. Fryer experience a plus.'},
  ];
  X.applicants = [
    {id:'AP-1', job:'J-1', name:'Keisha Monroe', phone:'(310) 555-0190', email:'keisha.m@example.com', stage:'Interview', t:NOW - 6*DAY, note:'2 yrs at a taco shop. Available evenings.', interview:T(1,'15:00')},
    {id:'AP-2', job:'J-1', name:'Tony Ngo', phone:'(213) 555-0144', email:'tony.ngo@example.com', stage:'Applied', t:NOW - 2*DAY, note:'Student, weekends only.'},
    {id:'AP-3', job:'J-2', name:'Dana Brooks', phone:'(424) 555-0163', email:'dbrooks@example.com', stage:'Offer', t:NOW - 3*DAY, note:'Ran a fryer station at the Forum.'},
    {id:'AP-4', job:'J-2', name:'Sam Rivera', phone:'(323) 555-0108', email:'srivera@example.com', stage:'Applied', t:NOW - 1*DAY, note:''},
  ];
  X.advances = [{id:'EW-1', emp:'E-1077', amt:80, fee:0, t:NOW - 20*HR, status:'Paid'}];
  X.integrations = {square:{on:false}, clover:{on:false}, toast:{on:false}, gusto:{on:false}, adp:{on:false}, quickbooks:{on:false}};
  X.outbox = [
    {id:'OB-1', t:NOW - 6*DAY, to:'all', channel:'Push', kind:'schedule', text:'This week\u2019s schedule is posted. Open the app to confirm your shifts.'},
    {id:'OB-2', t:NOW - 3*HR, to:'E-1042', channel:'SMS', kind:'reminder', text:'Reminder: you work at Dignity Health Sports Park today. Check your shift time in the app.'},
  ];
  return X;
}
const EXTRA_KEYS = ['availability','needs','published','sales','tipPools','channels','messages','reads','checklists','checkRuns','docTypes','docs','courses','training','feedback','suggestions','jobs','applicants','advances','integrations','outbox'];

/* ---------- Load / save / sync ----------
   Data lives on a small sync server so every phone and the manager console share it.
   If the server can't be reached the app keeps working in memory on this device. */
const LOCAL = new Set(['localhost','127.0.0.1','[::1]']);
const RAW_API = window.__API_BASE__ || '';
const API = (RAW_API.startsWith('__PORT_') ? (LOCAL.has(location.hostname) ? 'http://localhost:8000' : '') : RAW_API).replace(/\/$/, '');
let rev = -1, saving = 0, online = false, dirty = false;
const subs = [];
function normalize(d){
  if (!d || d.v !== 2) return null;
  d.settings = {...DEFAULT_SETTINGS, ...d.settings}; d.nfcTags ||= []; d.devices ||= {};
  if (EXTRA_KEYS.some(k => !(k in d))){ const x = seedExtras(d); EXTRA_KEYS.forEach(k => { if (!(k in d)) d[k] = x[k]; }); }
  if (d.employees && !d.employees.some(e => 'minor' in e)){ const a = d.employees.find(e => e.id==='E-1124'); if (a){ a.minor = true; a.birth = '2009-03-14'; } }
  return d;
}
async function push(){
  if (!API) return;
  saving++; dirty = false;
  try {
    const r = await fetch(API + '/api/db', {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({db})});
    if (r.ok){ const j = await r.json(); rev = Math.max(rev, j.rev); online = true; }
  } catch(e){ online = false; dirty = true; }
  finally { saving--; }
}
/* Static-host mode (public GitHub copy): no sync server, so keep data in this browser and sync open tabs. */
const LOCAL_MODE = !API && !!window.__LOCAL_MODE__;
const LS_KEY = 'cjcc-demo-db';
const ls = { get(k){ try { return window['local'+'Storage'].getItem(k); } catch(e){ return null; } },
  set(k,v){ try { window['local'+'Storage'].setItem(k,v); } catch(e){} } };
function save(){ if (LOCAL_MODE){ ls.set(LS_KEY, JSON.stringify(db)); online = true; return; } push(); }
function apply(d){ const n = normalize(d); if (!n) return; const prev = db; db = n; subs.forEach(fn => { try { fn(prev, db); } catch(e){ console.warn(e); } }); }
async function pull(){
  if (!API || saving) return;
  try {
    const r = await fetch(API + '/api/db?since=' + rev, {cache:'no-store'});
    if (!r.ok) return; const j = await r.json(); online = true;
    if (saving) return;
    if (dirty){ push(); return; }
    if (j.rev !== rev){ rev = j.rev; if (j.db) apply(j.db); }
  } catch(e){ online = false; }
}
db = seed();
let deviceKey = null;
async function fetchDevice(){
  if (!API){
    if (LOCAL_MODE){ deviceKey = ls.get('cjcc-device'); if (!deviceKey){ deviceKey = 'local-' + Math.random().toString(36).slice(2,10); ls.set('cjcc-device', deviceKey); } return; }
    deviceKey = 'local-' + Math.random().toString(36).slice(2,10); return; }
  try { const r = await fetch(API + '/api/me', {cache:'no-store'}); if (r.ok) deviceKey = (await r.json()).device; } catch(e){}
  if (!deviceKey) deviceKey = 'tmp-' + Math.random().toString(36).slice(2,10);
}
const ready = (async () => {
  await fetchDevice();
  if (LOCAL_MODE){
    online = true;
    try { const n = normalize(JSON.parse(ls.get(LS_KEY) || 'null')); if (n) db = n; else save(); } catch(e){ save(); }
    window.addEventListener('storage', ev => { if (ev.key === LS_KEY && ev.newValue){ try { apply(JSON.parse(ev.newValue)); } catch(e){} } });
    return;
  }
  if (!API) return;
  try {
    const r = await fetch(API + '/api/db', {cache:'no-store'});
    if (r.ok){ const j = await r.json(); online = true; rev = j.rev; const n = normalize(j.db); if (n) db = n; else await push(); }
  } catch(e){ online = false; }
  setInterval(pull, 1200);
})();
function reset(){ db = seed(); save(); }
const isOnline = () => online;
function id(prefix){ db.seq = (db.seq||900) + 1; return `${prefix}-${db.seq}`; }
function log(who, text){ db.log.unshift({t:now(), who, text}); if (db.log.length > 300) db.log.length = 300; }

/* ---------- Domain helpers ---------- */
function periodStartFor(t, st){
  const anchor = new Date((st||db.settings).payAnchor + 'T00:00').getTime();
  const len = ((st||db.settings).periodDays || 14) * DAY;
  const d = startOfDay(t); const k = Math.floor((d - anchor) / len); return anchor + k*len;
}
const periodStart = (t) => periodStartFor(t ?? now());
const periodLen = () => (db.settings.periodDays || 14) * DAY;
const empById = id => db.employees.find(e=>e.id===id);
const venueById = id => db.venues.find(v=>v.id===id) || {id, name:'Removed venue', type:'fixed', r:0, lat:0, lng:0, addr:''};

function workedMs(e, end){
  const stop = end ?? e.outT ?? now();
  const meal = (e.breaks||[]).filter(b=>b.type==='meal').reduce((a,b)=>a + ((b.end ?? stop) - b.start), 0);
  return (stop - e.inT) - meal;
}
function liveFor(empId){ return db.punches.find(p => p.emp === empId && !p.outT); }

/* Pay math (California-style daily + weekly OT) for one employee in one period */
function summary(empId, ps){
  ps = ps ?? periodStart(); const pe = ps + periodLen();
  const st = db.settings;
  const entries = db.punches.filter(p => p.emp === empId && p.inT >= ps && p.inT < pe && !p.voided).map(p => p.outT ? p : {...p, live:true});
  const days = {};
  entries.forEach(e => { const k = startOfDay(e.inT); (days[k] ||= []).push(e); });
  let reg=0, ot=0, dt=0, gross=0, prem=0, tips=0, regPay=0, otPay=0, dtPay=0;
  const weekReg = {};
  const rows = Object.keys(days).map(Number).sort((a,b)=>a-b).map(day => {
    const es = days[day].sort((a,b)=>a.inT-b.inT);
    const hrs = es.reduce((a,e)=>a + workedMs(e)/HR, 0);
    const basePay = es.reduce((a,e)=>a + punchBasePay(e), 0);
    const rate = hrs > 0 ? basePay / hrs : es[0].rate;
    let r = Math.min(hrs, st.otDaily), o = Math.min(Math.max(hrs - st.otDaily, 0), st.dtDaily - st.otDaily), d = Math.max(hrs - st.dtDaily, 0);
    const wk = Math.floor((day-ps)/(7*DAY));
    const prior = weekReg[wk] || 0;
    if (prior + r > st.otWeekly){ const over = prior + r - st.otWeekly; r -= over; o += over; }
    weekReg[wk] = prior + r;
    reg += r; ot += o; dt += d;
    regPay += r*rate; otPay += o*rate*st.otMult; dtPay += d*rate*st.dtMult;
    es.forEach(e => { if (st.mealPremium && e.attest==='missed' && !e.premiumWaived) prem += e.rate * Math.max(1, (e.missed||[]).length); tips += (e.tipsCash||0) + (e.tipsPooled ? 0 : (e.tipsCard||0)); });
    return {day, es, hrs, r, o, d};
  });
  gross = regPay + otPay + dtPay;
  const pool = poolShare(empId, ps, pe), adv = advancesFor(empId, ps, pe);
  const lateChg = st.predictPay ? (db.shifts||[]).filter(s => s.emp===empId && s.lateChange && s.startT >= ps && s.startT < pe && !s.lateChange.waived).reduce((a,s)=>{ const e = empById(empId); return a + (e?.roles.find(r=>r.role===s.role)?.rate ?? e?.roles[0]?.rate ?? 0); }, 0) : 0;
  return {rows, reg, ot, dt, regPay, otPay, dtPay, gross: gross + prem + lateChg, prem, lateChg, tips: tips + pool, pool, adv, hours: reg+ot+dt, entries};
}
function punchIssues(p){
  const iss = [];
  if (p.exception === 'pending') iss.push('Exception needs OK');
  if (p.editPending) iss.push('Correction requested');
  if ((p.flags||[]).length && !p.reviewed) iss.push(...p.flags);
  if (p.attest === 'missed' && !p.reviewed) iss.push('Missed break');
  return iss;
}

/* ---------- Break plan ----------
   Works out which planned breaks a live punch still needs and how urgent each one is.
   status: done | taking | due | overdue | soon | later | skip */
function shiftFor(p){
  const day = startOfDay(p.inT);
  return db.shifts.filter(s => s.emp===p.emp && startOfDay(s.startT)===day).sort((a,b)=>Math.abs(a.startT-p.inT)-Math.abs(b.startT-p.inT))[0] || null;
}
function breakStatus(p, t){
  t = t ?? now();
  const st = db.settings, plan = (st.breakPlan && st.breakPlan.length ? st.breakPlan : DEFAULT_SETTINGS.breakPlan).slice().sort((a,b)=>a.at-b.at);
  const brs = (p.breaks||[]).slice().sort((a,b)=>a.start-b.start);
  const open = brs.find(b => !b.end) || null;
  const sh = shiftFor(p); const planned = sh ? (sh.endT - sh.startT)/HR : null;
  const worked = workedMs(p, p.outT ?? t);
  const used = {rest:0, meal:0};
  const mealsDone = brs.filter(b=>b.type==='meal' && b.end).reduce((a,b)=>a+(b.end-b.start),0);
  const items = plan.map(item => {
    const k = item.kind === 'meal' ? 'meal' : 'rest';
    const match = brs.filter(b => b.type===k)[used[k]];
    const applies = planned == null || planned >= (item.minShift || 0) || worked >= item.at*HR;
    const dueT = p.inT + item.at*HR + mealsDone;
    let status;
    if (match){ used[k]++; status = match.end ? 'done' : 'taking'; }
    else if (!applies) status = 'skip';
    else if (worked >= item.at*HR) status = worked >= item.at*HR + (st.breakLateMin||15)*MIN ? 'overdue' : 'due';
    else if (worked >= item.at*HR - (st.breakWarnMin||10)*MIN) status = 'soon';
    else status = 'later';
    return {...item, status, dueT, brk:match || null, lateBy: Math.max(0, worked - item.at*HR)};
  });
  const alert = open ? null : items.find(i => i.status==='due' || i.status==='overdue') || null;
  const soon = open ? null : items.find(i => i.status==='soon') || null;
  const next = items.find(i => ['due','overdue','soon','later'].includes(i.status)) || null;
  return {items, open, alert, soon, next, worked, planned};
}
const nextBreakFor = (p, kind) => breakStatus(p).items.find(i => (i.kind==='meal'?'meal':'rest')===kind && !['done','taking'].includes(i.status));


/* ---------- Role switching: pay each part of a shift at its own rate ---------- */
function punchBasePay(p){
  const total = workedMs(p)/HR;
  const log = (p.roleLog && p.roleLog.length) ? p.roleLog : null;
  if (!log) return total * p.rate;
  const end = p.outT ?? now(), span = Math.max(1, end - p.inT);
  return log.reduce((a, seg, i) => { const segEnd = log[i+1]?.t ?? end; return a + total * ((segEnd - seg.t) / span) * seg.rate; }, 0);
}

/* ---------- Availability, time off and schedule checks ---------- */
const dowOf = t => new Date(t).getDay();
const weekStartOf = t => { const d = startOfDay(t); return d - ((new Date(d).getDay()+6)%7)*DAY; };
const hm = s => { const [h,m] = String(s||'0:0').split(':').map(Number); return h*60 + (m||0); };
function availFor(empId, day){ const a = db.availability?.[empId]; if (!a) return null; return a.days?.[dowOf(day)] || null; }
function timeOffOn(empId, day){ const k = toDateInput(day); return db.requests.find(r => r.emp===empId && r.kind==='Time off' && r.status==='Approved' && r.payload?.date===k) || null; }
function availCheck(empId, startT, endT){
  const day = startOfDay(startT);
  if (timeOffOn(empId, day)) return {ok:false, why:'Approved time off'};
  const a = availFor(empId, day); if (!a) return {ok:true};
  if (a.off) return {ok:false, why:'Unavailable all day'};
  const s = (startT - day)/MIN, e = (endT - day)/MIN;
  if (s < hm(a.from) || e > hm(a.to) + (hm(a.to) >= 23*60+59 ? 120 : 0)) return {ok:false, why:`Available ${fTimeHM(a.from)}–${fTimeHM(a.to)}`};
  return {ok:true};
}
const fTimeHM = s => { const [h,m] = s.split(':').map(Number); const d = new Date(2000,0,1,h,m); return d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}).replace(':00',''); };
function weekHours(empId, t, skipId){ const ws = weekStartOf(t); return db.shifts.filter(s => s.emp===empId && s.id!==skipId && s.startT>=ws && s.startT<ws+7*DAY).reduce((a,s)=>a+(s.endT-s.startT)/HR,0); }
/* Compliance problems with one scheduled shift. sev: bad | warn | info */
function shiftIssues(s, list){
  const st = db.settings, out = [], e = empById(s.emp); if (!e) return out;
  list = list || db.shifts;
  const mine = list.filter(x => x.emp===s.emp && x.id!==s.id);
  const prev = mine.filter(x => x.endT <= s.startT).sort((a,b)=>b.endT-a.endT)[0];
  const next = mine.filter(x => x.startT >= s.endT).sort((a,b)=>a.startT-b.startT)[0];
  const gap = Math.min(prev ? s.startT - prev.endT : Infinity, next ? next.startT - s.endT : Infinity);
  if (gap < st.restBetweenHrs*HR) out.push({k:'rest', sev:'warn', text:`Only ${fHM(gap)} rest between shifts`});
  const av = availCheck(s.emp, s.startT, s.endT); if (!av.ok) out.push({k:'avail', sev:'warn', text:av.why});
  const len = (s.endT - s.startT)/HR, wkH = weekHours(s.emp, s.startT, s.id) + len;
  if (e.minor){
    if (len > st.minorMaxDay) out.push({k:'minor', sev:'bad', text:`Minor: over ${st.minorMaxDay} hrs in a day`});
    const dow = dowOf(s.startT), school = dow >= 0 && dow <= 4;
    if (school && (s.endT - startOfDay(s.startT))/MIN > hm(st.minorLatest)) out.push({k:'minor', sev:'bad', text:`Minor: works past ${fTimeHM(st.minorLatest)} on a school night`});
    if (wkH > st.minorMaxWeek) out.push({k:'minor', sev:'bad', text:`Minor: over ${st.minorMaxWeek} hrs this week`});
  }
  if (wkH > st.otWeekly) out.push({k:'ot', sev:'info', text:`Puts them at ${wkH.toFixed(1)} hrs this week (overtime)`});
  if (len > st.otDaily) out.push({k:'ot', sev:'info', text:`${len.toFixed(1)}-hr shift: daily overtime`});
  if (s.lateChange && !s.lateChange.waived) out.push({k:'late', sev:'warn', text:`Changed ${fHM(s.startT - s.lateChange.t)} before start: predictability pay`});
  return out;
}
/* Fair Workweek: a change to a published week inside the notice window */
function markScheduleChange(s){
  const st = db.settings, ws = weekStartOf(s.startT);
  if (db.published?.[ws] && s.startT - now() < st.noticeDays*DAY && s.startT > now()) s.lateChange = {t:now()};
}

/* ---------- Sales and labor ---------- */
const salesKey = (v, day) => `${v}|${toDateInput(day)}`;
function salesActual(v, day){ const x = db.sales?.[salesKey(v, day)]; return x == null ? null : x; }
function forecast(v, day){
  if (EVENT_BASE[v]) { const has = db.shifts.some(s => s.venue===v && startOfDay(s.startT)===startOfDay(day)); return has ? Math.round(EVENT_BASE[v] * (0.95 + hashN(v+day)*0.1)) : 0; }
  const ven = venueById(v); if (ven.active === false || (ven.window && ven.window[0] && (day < new Date(ven.window[0]+'T00:00').getTime() || day > new Date(ven.window[1]+'T23:59').getTime()))) return 0;
  const prior = [7,14,21].map(k => salesActual(v, day - k*DAY)).filter(x => x != null);
  if (prior.length) return Math.round(prior.reduce((a,b)=>a+b,0) / prior.length);
  return SALES_BASE[v] ? SALES_BASE[v][dowOf(day)] : 0;
}
const HOURS = Object.keys(HOUR_W).map(Number);
const HW_SUM = Object.values(HOUR_W).reduce((a,b)=>a+b,0);
function salesSoFar(v, t){
  t = t ?? now(); const day = startOfDay(t);
  const a = salesActual(v, day); if (a != null) return a;
  const h = (t - day)/HR; let frac = 0; HOURS.forEach(H => { frac += HOUR_W[H] * Math.min(1, Math.max(0, h - H)); });
  return Math.round(forecast(v, day) * frac / HW_SUM * (0.94 + hashN('t'+v+day)*0.14));
}
function hourlyForecast(v, day){ const f = forecast(v, day); return HOURS.map(H => ({h:H, amt: Math.round(f * HOUR_W[H] / HW_SUM)})); }
function laborActual(v, day){ const d0 = startOfDay(day); return db.punches.filter(p => !p.voided && (!v || p.venue===v) && p.inT>=d0 && p.inT<d0+DAY).reduce((a,p)=>a + punchBasePay(p), 0); }
function laborScheduled(v, day){ const d0 = startOfDay(day); return db.shifts.filter(s => (!v || s.venue===v) && s.startT>=d0 && s.startT<d0+DAY).reduce((a,s)=>{ const e = empById(s.emp); const r = e?.roles.find(x=>x.role===s.role)?.rate ?? e?.roles[0]?.rate ?? 0; return a + (s.endT-s.startT)/HR * r; }, 0); }

/* ---------- Tips and early pay ---------- */
function poolShare(empId, ps, pe){ return (db.tipPools||[]).filter(tp => tp.applied && tp.day >= ps && tp.day < pe).reduce((a,tp) => a + (tp.alloc?.[empId] || 0), 0); }
function advancesFor(empId, ps, pe){ return (db.advances||[]).filter(x => x.emp===empId && x.status!=='Denied' && x.status!=='Pending' && x.t >= ps && x.t < pe).reduce((a,x)=>a + x.amt + (x.fee||0), 0); }
function ewaFor(empId){
  const ps = periodStart(), pe = ps + periodLen(), s = summary(empId, ps);
  const earned = s.gross, taken = advancesFor(empId, ps, pe) + (db.advances||[]).filter(x=>x.emp===empId && x.status==='Pending' && x.t>=ps && x.t<pe).reduce((a,x)=>a+x.amt,0);
  const cap = Math.floor(earned * (db.settings.ewaPct||50) / 100);
  return {earned, taken, cap, avail: Math.max(0, Math.floor(cap - taken))};
}

/* ---------- Notifications (simulated text / push outbox) ---------- */
function notify(to, text, channel='Push', kind='note'){
  (db.outbox ||= []).unshift({id:id('OB'), t:now(), to, channel, kind, text});
  if (db.outbox.length > 250) db.outbox.length = 250;
}
function runReminders(){
  const st = db.settings; if (!st.smsReminders) return false;
  const n = now(); let changed = false;
  db.shifts.forEach(s => { if (!s.reminded && s.startT > n && s.startT - n <= st.remindBeforeMin*MIN){ s.reminded = n; changed = true;
    notify(s.emp, `Reminder: you work ${fTime(s.startT)}–${fTime(s.endT)} at ${venueById(s.venue).name} (${s.role}).`, 'SMS', 'reminder'); } });
  return changed;
}

/* ---------- Team chat ---------- */
const dmId = empId => `DM:${empId}`;
function channelsFor(who){
  if (who === 'mgr') return [...db.channels, ...db.employees.filter(e=>e.active!==false).map(e => ({id:dmId(e.id), name:e.name, dm:e.id}))];
  const e = empById(who); const vs = new Set([e?.home, ...db.shifts.filter(s=>s.emp===who && s.startT > now()-DAY && s.startT < now()+7*DAY).map(s=>s.venue)]);
  return [...db.channels.filter(c => !c.venue || vs.has(c.venue)), {id:dmId(who), name:'Manager', dm:who}];
}
const chMsgs = ch => (db.messages||[]).filter(m => m.ch===ch).sort((a,b)=>a.t-b.t);
function unread(who, ch){ const r = db.reads?.[who]?.[ch] || 0; return chMsgs(ch).filter(m => m.t > r && m.from !== who).length; }
function markRead(who, ch){ const last = chMsgs(ch).slice(-1)[0]; if (!last) return false; const r = (db.reads ||= {})[who] ||= {}; if ((r[ch]||0) >= last.t) return false; r[ch] = last.t; return true; }
function readersOf(m){ return Object.entries(db.reads||{}).filter(([who, chs]) => who !== m.from && (chs[m.ch]||0) >= m.t).map(([who]) => who); }
function postMsg(ch, from, text){ (db.messages ||= []).push({id:id('M'), ch, from, text, t:now()}); markRead(from, ch); if (db.messages.length > 600) db.messages.splice(0, db.messages.length - 600); }

/* ---------- Checklists ---------- */
function runFor(listId, day, create=false){
  day = startOfDay(day ?? now());
  let r = (db.checkRuns||[]).find(x => x.list===listId && x.day===day);
  if (!r && create){ r = {id:id('CR'), list:listId, day, done:{}}; (db.checkRuns ||= []).push(r); }
  return r || null;
}
function listProgress(list, run){
  const n = list.items.length, d = run ? list.items.filter(i => run.done?.[i.id]).length : 0;
  const due = at(startOfDay(run?.day ?? now()), list.due || '23:59');
  const outOfRange = run ? list.items.filter(i => i.type==='temp' && run.done?.[i.id] && ((i.max != null && run.done[i.id].val > i.max) || (i.min != null && run.done[i.id].val < i.min))) : [];
  const complete = !!run?.signed;
  return {n, d, due, complete, late: !complete && now() > due, outOfRange};
}
const checklistsFor = venueId => (db.checklists||[]).filter(c => !venueId || c.venue===venueId);

/* ---------- Paperwork and training ---------- */
function docState(empId, typeId){
  const t = (db.docTypes||[]).find(x=>x.id===typeId), d = db.docs?.[empId]?.[typeId];
  if (!d || d.status !== 'done') return {state:'missing'};
  if (t?.expires || d.exp){ const exp = d.exp ? new Date(d.exp+'T23:59').getTime() : null;
    if (exp && exp < now()) return {state:'expired', exp, d};
    if (exp && exp - now() < 30*DAY) return {state:'expiring', exp, d}; }
  return {state:'done', d, exp: d.exp ? new Date(d.exp+'T23:59').getTime() : null};
}
function docTypesFor(e){ return (db.docTypes||[]).concat(e?.minor ? [{id:'wp', name:'Minor work permit', kind:'card', expires:true}] : []); }
function coursesFor(e){ return (db.courses||[]).filter(c => !c.roles || c.roles.some(r => e?.roles.some(x=>x.role===r))); }

/* ---------- NFC tags ---------- */
const tagByCode = code => db.nfcTags.find(t => t.code.toUpperCase() === String(code||'').trim().toUpperCase());
function newTagCode(venueId){
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let r = ''; for (let i=0;i<8;i++) r += A[Math.floor(Math.random()*A.length)];
  return `${String(venueId||'TAG').toUpperCase().slice(0,6)}-${r.slice(0,4)}-${r.slice(4)}`;
}
function crewAppBase(){
  const u = (db.settings.crewAppUrl||'').trim();
  if (u) return u.replace(/[#?].*$/,'').replace(/\/?$/, u.endsWith('.html') ? '' : '/');
  return location.href.replace(/[#?].*$/,'').replace(/[^/]*$/, '');
}
function tagUrl(tag){ const b = crewAppBase(); return (b.endsWith('.html') ? b : b + 'index.html') + '?tag=' + encodeURIComponent(tag.code); }
const deviceEmp = () => deviceKey ? db.devices[deviceKey]?.emp || null : null;

window.CC = {
  KEY, ic, P, VTYPE, LOCS, COLORS, MIN, HR, DAY,
  get db(){ return db; }, ready, isOnline, hasServer: !!API, save, reset, id, log, subscribe: fn => subs.push(fn),
  now, startOfDay, at, fTime, fDate, fDay, fShort, fDur, fHM, fHrs, money, esc, pad, toDateInput, toTimeInput, fromInputs, initialsOf,
  dist, bearing, fDist, venueActive, periodStart, periodLen, empById, venueById, workedMs, liveFor, summary, punchIssues,
  DEFAULT_SETTINGS, breakStatus, nextBreakFor, shiftFor, tagByCode, newTagCode, tagUrl, crewAppBase, deviceEmp, get deviceKey(){ return deviceKey; },
  punchBasePay, dowOf, weekStartOf, hm, fTimeHM, availFor, timeOffOn, availCheck, weekHours, shiftIssues, markScheduleChange,
  salesKey, salesActual, forecast, salesSoFar, hourlyForecast, laborActual, laborScheduled, HOURS,
  poolShare, advancesFor, ewaFor, notify, runReminders, dmId, channelsFor, chMsgs, unread, markRead, readersOf, postMsg,
  runFor, listProgress, checklistsFor, docState, docTypesFor, coursesFor,
};
})();
