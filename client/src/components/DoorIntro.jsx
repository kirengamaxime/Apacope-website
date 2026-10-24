import { useEffect } from 'react';

/**
 * Sign-in "doorway": after a successful login the school logo fills the screen, a pen stroke is drawn
 * down its middle, then the logo splits in two and the halves swing open towards you like double doors,
 * revealing the dashboard that is already waiting behind them.
 *
 * Login.jsx calls markIntro() after a successful sign-in; Layout.jsx shows <DoorIntro /> once and clears the flag.
 */
const KEY = 'apacope-intro';
const LOGO = '/logo.png'; // replace public/logo.png to change the picture on the doors

export const markIntro = () => { try { sessionStorage.setItem(KEY, '1'); } catch { /* storage blocked: no intro */ } };
export const clearIntro = () => { try { sessionStorage.removeItem(KEY); } catch { /* ignore */ } };
export const introPending = () => {
  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false; // respect the visitor's setting
    return sessionStorage.getItem(KEY) === '1';
  } catch { return false; }
};

// Timeline in seconds
const T_STROKE = 0.55; // pen stroke starts
const D_STROKE = 0.7;  // ...and takes this long
const T_OPEN = 1.4;    // doors start to open
const D_OPEN = 1.1;    // ...and take this long
const T_DONE = T_OPEN + D_OPEN + 0.1;

const CSS = `
.di-root{position:fixed;inset:0;z-index:100;overflow:hidden;perspective:2400px;perspective-origin:50% 50%;--s:min(62vw,360px);
  cursor:pointer;animation:di-fade .3s ease-out both}
.di-back{position:absolute;inset:0;background:#fff;animation:di-back-off .02s linear ${T_OPEN}s both}
.di-door{position:absolute;top:0;bottom:0;width:50%;overflow:hidden;background:#fff;backface-visibility:hidden;will-change:transform}
.di-left{left:0;transform-origin:0 50%;animation:di-open-l ${D_OPEN}s cubic-bezier(.6,.02,.2,1) ${T_OPEN}s both}
.di-right{right:0;transform-origin:100% 50%;animation:di-open-r ${D_OPEN}s cubic-bezier(.6,.02,.2,1) ${T_OPEN}s both}
.di-logo{position:absolute;top:50%;width:var(--s);height:auto;transform:translateY(-50%);user-select:none;-webkit-user-drag:none}
.di-left .di-logo{right:calc(var(--s) / -2)}
.di-right .di-logo{left:calc(var(--s) / -2)}
.di-shade{position:absolute;inset:0;opacity:0;pointer-events:none;animation:di-shade ${D_OPEN}s ease-in ${T_OPEN}s both}
.di-left .di-shade{background:linear-gradient(90deg,rgba(15,23,42,.05),rgba(15,23,42,.55))}
.di-right .di-shade{background:linear-gradient(270deg,rgba(15,23,42,.05),rgba(15,23,42,.55))}
.di-logo-in{position:absolute;inset:0;animation:di-pop .45s cubic-bezier(.2,.8,.2,1) both}
.di-pen{position:absolute;left:50%;top:50%;width:26px;height:calc(var(--s) * 1.18);transform:translate(-50%,-50%);pointer-events:none;
  animation:di-pen-out .25s ease-in ${T_OPEN}s both}
.di-pen svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.di-pen path{fill:none;stroke:#14233a;stroke-width:3.2;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:1;
  animation:di-draw ${D_STROKE}s cubic-bezier(.5,0,.3,1) ${T_STROKE}s both}
.di-nib{position:absolute;left:50%;top:0;width:9px;height:9px;margin-left:-4.5px;border-radius:50%;background:#e11d2e;
  box-shadow:0 0 10px 3px rgba(225,29,46,.45);opacity:0;
  animation:di-nib ${D_STROKE}s cubic-bezier(.5,0,.3,1) ${T_STROKE}s both}
@keyframes di-fade{from{opacity:0}to{opacity:1}}
@keyframes di-back-off{from{opacity:1}to{opacity:0}}
@keyframes di-pop{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:scale(1)}}
@keyframes di-draw{to{stroke-dashoffset:0}}
@keyframes di-nib{0%{opacity:1;top:0}99%{opacity:1}100%{opacity:0;top:calc(100% - 9px)}}
@keyframes di-pen-out{to{opacity:0}}
@keyframes di-open-l{to{transform:rotateY(-112deg)}}
@keyframes di-open-r{to{transform:rotateY(112deg)}}
@keyframes di-shade{to{opacity:1}}
`;

function Half({ side }) {
  return (
    <div className={`di-door di-${side}`}>
      <div className="di-logo-in"><img className="di-logo" src={LOGO} alt="" draggable="false" /></div>
      <div className="di-shade" />
    </div>
  );
}

export default function DoorIntro({ onDone }) {
  useEffect(() => {
    const timer = setTimeout(onDone, T_DONE * 1000);
    const skip = (e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') onDone(); };
    window.addEventListener('keydown', skip);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { clearTimeout(timer); window.removeEventListener('keydown', skip); document.body.style.overflow = prev; };
  }, [onDone]);

  return (
    <div className="di-root print:hidden" aria-hidden="true" onClick={onDone} title="Click to skip">
      <style>{CSS}</style>
      <div className="di-back" />
      <Half side="left" />
      <Half side="right" />
      <div className="di-pen">
        <svg viewBox="0 0 26 100" preserveAspectRatio="none">
          <path pathLength="1" d="M13 0 C14.4 18, 11.6 34, 13.3 52 S12 82, 13 100" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="di-nib" />
      </div>
    </div>
  );
}