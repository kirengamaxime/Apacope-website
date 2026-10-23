/* Which language dates are written in. LanguageProvider sets it; fmtDate in ui.jsx and the top bar read it. */
let current = 'en-GB';
export const setDateLocale = (l) => { current = l; };
export const getDateLocale = () => current;

// Browsers have no Kinyarwanda date names, so they are written here
const RW_MONTHS = ['Mutarama', 'Gashyantare', 'Werurwe', 'Mata', 'Gicurasi', 'Kamena', 'Nyakanga', 'Kanama', 'Nzeri', 'Ukwakira', 'Ugushyingo', 'Ukuboza'];
const RW_DAYS = ['Ku cyumweru', 'Kuwa mbere', 'Kuwa kabiri', 'Kuwa gatatu', 'Kuwa kane', 'Kuwa gatanu', 'Kuwa gatandatu'];

/** formatDate(value) gives "21 Oct 2026"; formatDate(value, true) gives "Friday 23 October 2026", in the chosen language */
export function formatDate(value, long = false) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  if (current.startsWith('rw')) {
    const base = `${d.getDate()} ${RW_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    return long ? `${RW_DAYS[d.getDay()]}, ${base}` : base;
  }
  return d.toLocaleDateString(current, long ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' } : { day: '2-digit', month: 'short', year: 'numeric' });
}