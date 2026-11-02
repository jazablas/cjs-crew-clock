/* Small "Install the app" banner. Shows on phones that haven't installed CJ's Crew yet; dismissible. */
(() => {
  const ls = (() => { try { return window['local' + 'Storage']; } catch (e) { return null; } })();
  const KEY = 'cjcc-install-hide';
  const standalone = matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone;
  if (standalone || location.protocol !== 'https:') return;
  try { if (ls && Number(ls.getItem(KEY) || 0) > Date.now()) return; } catch (e) {}
  const ua = navigator.userAgent, ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const mobile = ios || /Android/.test(ua);
  let deferred = null;
  const css = `.cc-inst{position:fixed;left:12px;right:12px;bottom:calc(76px + env(safe-area-inset-bottom));z-index:60;max-width:460px;margin:0 auto;background:var(--surface,#fff);color:var(--text,#222);border:1px solid var(--line,#ddd);border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.18);padding:12px 14px;display:flex;gap:12px;align-items:center;font:500 14px/1.35 var(--body,system-ui)}
.cc-inst img{width:40px;height:40px;border-radius:10px;flex:none}.cc-inst b{display:block;font-size:15px}.cc-inst .g{flex:1}.cc-inst button{font:700 14px var(--body,system-ui);border-radius:10px;padding:8px 12px;border:0;cursor:pointer}
.cc-inst .go{background:var(--sauce,#d23a1f);color:#fff}.cc-inst .x{background:transparent;color:var(--muted,#777);padding:6px}`;
  function show(html, withBtn){
    if (document.querySelector('.cc-inst')) return;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const el = document.createElement('div'); el.className = 'cc-inst'; el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'Install the app');
    el.innerHTML = `<img src="icons/icon-192.png" alt=""><div class="g">${html}</div>${withBtn ? '<button class="go" type="button">Install</button>' : ''}<button class="x" type="button" aria-label="Not now">&#x2715;</button>`;
    document.body.appendChild(el);
    el.querySelector('.x').onclick = () => { el.remove(); try { ls && ls.setItem(KEY, String(Date.now() + 14 * 864e5)); } catch (e) {} };
    const go = el.querySelector('.go'); if (go) go.onclick = async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice.catch(() => {}); deferred = null; el.remove(); };
  }
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; setTimeout(() => show('<b>Install CJ\u2019s Crew</b>Opens full screen from your home screen.', true), 2500); });
  addEventListener('appinstalled', () => { const el = document.querySelector('.cc-inst'); if (el) el.remove(); });
  if (ios && mobile) setTimeout(() => show('<b>Add CJ\u2019s Crew to your home screen</b>Tap <b style="display:inline">Share</b> <span aria-hidden="true">&#x2191;</span>, then <b style="display:inline">Add to Home Screen</b>.', false), 3000);
})();
