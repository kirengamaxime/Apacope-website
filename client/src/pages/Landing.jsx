import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, Clock, ChevronDown, Mail, MapPin, Menu, Phone, X, LogIn, FileText, CircleHelp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { site, about, programs, portalPoints, admissionSteps, gallery, heroImage, faqs } from '../data/siteContent';

/* ------------------------------------------------------------------ helpers */
const scrollToId = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
const go = (id) => (e) => { e.preventDefault(); scrollToId(id); };
const hasContact = Object.values(site.contact).some(Boolean);

/** Resolve which of the listed image files actually exist */
function useExistingImages(srcs) {
  const [ok, setOk] = useState([]);
  useEffect(() => {
    let live = true;
    Promise.all(srcs.map((src) => new Promise((res) => {
      const img = new Image();
      img.onload = () => res(src);
      img.onerror = () => res(null);
      img.src = src;
    }))).then((r) => live && setOk(r.filter(Boolean)));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcs.join('|')]);
  return ok;
}

function useActiveSection(ids) {
  const [active, setActive] = useState('');
  useEffect(() => {
    const els = ids.map((i) => document.getElementById(i)).filter(Boolean);
    if (!('IntersectionObserver' in window) || !els.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); });
    }, { rootMargin: '-40% 0px -55% 0px' });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ids.join('|')]);
  return active;
}

const Container = ({ children, className = '' }) => <div className={`mx-auto max-w-7xl px-6 ${className}`}>{children}</div>;

function SectionHead({ title, lead, className = '' }) {
  return (
    <div className={`max-w-2xl ${className}`}>
      <h2 className="text-3xl font-medium leading-tight sm:text-4xl">{title}</h2>
      {lead && <p className="mt-4 text-lg leading-relaxed text-ink-700">{lead}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------- header */
function Header({ links, active }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const { contact } = site;
  return (
    <header className="sticky top-0 z-40 border-b border-ink-200 bg-white">
      {(contact.phone || contact.email) && (
        <div className="hidden bg-ink-900 text-[13px] text-white/80 md:block">
          <Container className="flex h-8 items-center justify-between">
            <div className="flex items-center gap-6">
              {contact.phone && <a className="flex items-center gap-1.5 hover:text-white" href={`tel:${contact.phone.replace(/\s/g, '')}`}><Phone className="h-3.5 w-3.5" aria-hidden="true" />{contact.phone}</a>}
              {contact.email && <a className="flex items-center gap-1.5 hover:text-white" href={`mailto:${contact.email}`}><Mail className="h-3.5 w-3.5" aria-hidden="true" />{contact.email}</a>}
            </div>
            {contact.hours && <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" aria-hidden="true" />{contact.hours}</span>}
          </Container>
        </div>
      )}
      <Container className="flex h-[68px] items-center justify-between gap-4">
        <a href="#top" onClick={go('top')} className="flex items-center gap-3" aria-label={`${site.name}, back to top`}>
          <img src="/logo.png" alt="" className="h-12 w-12 object-contain" />
          <span className="whitespace-nowrap font-serif text-base font-semibold leading-tight sm:text-[17px]">Groupe Scolaire<span className="block text-brand-600">APACOPE</span></span>
        </a>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {links.map(([id, label]) => (
            <a key={id} href={`#${id}`} onClick={go(id)} aria-current={active === id ? 'true' : undefined}
              className={`relative px-3 py-2 text-sm font-medium transition-colors ${active === id ? 'text-ink-900' : 'text-ink-500 hover:text-ink-900'}`}>
              {label}
              {active === id && <span className="absolute inset-x-3 -bottom-[13px] h-0.5 bg-brand-600" aria-hidden="true" />}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link to={user ? '/dashboard' : '/login'} className="btn-primary"><LogIn className="hidden h-4 w-4 sm:block" aria-hidden="true" />{user ? 'My portal' : <><span className="sm:hidden">Log in</span><span className="hidden sm:inline">Portal login</span></>}</Link>
          <button className="btn-ghost px-2.5 lg:hidden" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Menu">{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
        </div>
      </Container>
      {open && (
        <nav className="border-t border-ink-200 bg-white lg:hidden" aria-label="Mobile">
          <Container className="py-2">
            {links.map(([id, label]) => (
              <a key={id} href={`#${id}`} onClick={(e) => { go(id)(e); setOpen(false); }} className="block border-b border-ink-100 py-3 text-base font-medium last:border-0">{label}</a>
            ))}
          </Container>
        </nav>
      )}
    </header>
  );
}

/* --------------------------------------------------------------------- hero */
const fmtDay = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric' });
const fmtMon = (d) => new Date(d).toLocaleDateString('en-GB', { month: 'short' });

function HeroPanel({ events, photo }) {
  const { user } = useAuth();
  const shortcuts = [
    { icon: LogIn, label: user ? 'Open your portal' : 'Sign in to the portal', to: user ? '/dashboard' : '/login' },
    { icon: FileText, label: 'Ask about admission', id: 'contact' },
    { icon: CircleHelp, label: 'Read common questions', id: 'faq' },
  ];
  return (
    <div className="overflow-hidden rounded-lg bg-white text-ink-900 shadow-xl">
      {photo && <img src={photo} alt="" className="h-48 w-full object-cover" />}
      <div className="p-5 sm:p-6">
        {events?.length > 0 ? (
          <>
            <h2 className="text-xl">Coming up at the school</h2>
            <ul className="mt-3 divide-y divide-ink-100">
              {events.slice(0, 3).map((e) => (
                <li key={e._id} className="flex items-center gap-4 py-3">
                  <div className="w-11 shrink-0 text-center leading-none"><p className="font-serif text-2xl font-semibold">{fmtDay(e.start)}</p><p className="mt-1 text-xs font-medium text-brand-700">{fmtMon(e.start)}</p></div>
                  <p className="font-medium leading-snug">{e.title}</p>
                </li>
              ))}
            </ul>
            <a href="#events" onClick={go('events')} className="mt-3 inline-block text-sm font-semibold text-brand-700 hover:underline">See the full calendar</a>
          </>
        ) : (
          <>
            <h2 className="text-xl">Where would you like to start?</h2>
            <ul className="mt-3 divide-y divide-ink-100">
              {shortcuts.map(({ icon: Icon, label, to, id }) => (
                <li key={label}>
                  {to ? (
                    <Link to={to} className="flex items-center gap-3 py-3 font-medium hover:text-brand-700"><Icon className="h-4 w-4 text-brand-600" aria-hidden="true" />{label}<ChevronRight className="ml-auto h-4 w-4 text-ink-300" aria-hidden="true" /></Link>
                  ) : (
                    <a href={`#${id}`} onClick={go(id)} className="flex items-center gap-3 py-3 font-medium hover:text-brand-700"><Icon className="h-4 w-4 text-brand-600" aria-hidden="true" />{label}<ChevronRight className="ml-auto h-4 w-4 text-ink-300" aria-hidden="true" /></a>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function Hero({ events, photo }) {
  return (
    <section id="top" className="ruled relative overflow-hidden bg-ink-900 text-white">
      <Container className="relative">
        <span aria-hidden="true" className="margin-line absolute inset-y-0 left-3 hidden w-px bg-brand-500 sm:block" />
        <div className="grid gap-12 py-16 sm:pl-10 sm:py-20 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:py-28">
          <div>
            <h1 className="hero-in max-w-3xl text-[2.5rem] font-medium leading-[1.08] sm:text-5xl lg:text-[3.6rem]" style={{ '--d': '350ms' }}>{site.headline}</h1>
            <p className="hero-in mt-6 max-w-xl text-lg leading-relaxed text-white/75" style={{ '--d': '550ms' }}>{site.intro}</p>
            <div className="hero-in mt-9 flex flex-wrap gap-3" style={{ '--d': '750ms' }}>
              <a href="#contact" onClick={go('contact')} className="btn-primary px-6 py-3 text-base">Apply for admission</a>
              <a href="#programs" onClick={go('programs')} className="btn border border-white/30 px-6 py-3 text-base text-white hover:bg-white/10">See our programs</a>
            </div>
          </div>
          <div className="hero-in" style={{ '--d': '900ms' }}><HeroPanel events={events} photo={photo} /></div>
        </div>
      </Container>
    </section>
  );
}

/* -------------------------------------------------------------------- about */
function About() {
  return (
    <section id="about" className="scroll-mt-24 bg-white py-20 sm:py-28">
      <Container className="grid gap-12 lg:grid-cols-[5fr_6fr] lg:gap-20">
        <SectionHead title={about.title} lead={about.story} />
        <dl className="divide-y divide-ink-200 border-y border-ink-200">
          {about.items.map((i) => (
            <div key={i.term} className="grid gap-1 py-6 sm:grid-cols-[110px_1fr] sm:gap-6">
              <dt className="font-serif text-xl font-semibold">{i.term}</dt>
              <dd className="text-ink-700">{i.text}</dd>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  );
}

/* ----------------------------------------------------------------- programs */
function Programs({ onAsk }) {
  const [active, setActive] = useState(programs[0].id);
  const p = programs.find((x) => x.id === active);
  return (
    <section id="programs" className="scroll-mt-24 border-y border-ink-200 bg-ink-50 py-20 sm:py-28">
      <Container>
        <SectionHead title="Programs" lead="Choose a program to see what learners study at each level." />
        <div className="mt-12 grid gap-8 lg:grid-cols-[280px_1fr]">
          <div role="tablist" aria-label="Programs" aria-orientation="vertical" className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-0 lg:overflow-visible lg:border-l lg:border-ink-200 lg:pb-0">
            {programs.map((x) => {
              const on = active === x.id;
              return (
                <button key={x.id} role="tab" aria-selected={on} onClick={() => setActive(x.id)}
                  className={`shrink-0 rounded-md border px-4 py-3 text-left text-[15px] transition-colors lg:-ml-px lg:rounded-none lg:border-0 lg:border-l-2 lg:py-4 ${on ? 'border-ink-900 bg-ink-900 font-semibold text-white lg:border-brand-600 lg:bg-transparent lg:text-ink-900' : 'border-ink-200 bg-white text-ink-700 hover:text-ink-900 lg:border-transparent lg:bg-transparent'}`}>
                  {x.title}
                </button>
              );
            })}
          </div>

          <div role="tabpanel" key={p.id} className="rounded-lg border border-ink-200 bg-white">
            <div className="p-6 sm:p-8">
              <h3 className="font-serif text-3xl font-medium">{p.title}</h3>
              <p className="mt-3 max-w-2xl text-lg text-ink-700">{p.blurb}</p>
              <ul className="mt-6 grid gap-x-8 gap-y-2 sm:grid-cols-2">
                {p.highlights.map((h) => <li key={h} className="flex items-start gap-2.5"><Check className="mt-1 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />{h}</li>)}
              </ul>
            </div>
            <table className="w-full border-t border-ink-200 text-left text-[15px]">
              <caption className="sr-only">What is studied at each level of {p.title}</caption>
              <thead><tr className="bg-ink-50 text-sm text-ink-500"><th scope="col" className="w-32 px-6 py-3 font-semibold sm:px-8">Level</th><th scope="col" className="px-6 py-3 font-semibold sm:px-8">Focus</th></tr></thead>
              <tbody className="divide-y divide-ink-100">
                {p.levels.map((l) => <tr key={l.name}><th scope="row" className="px-6 py-4 font-semibold sm:px-8">{l.name}</th><td className="px-6 py-4 text-ink-700 sm:px-8">{l.focus}</td></tr>)}
              </tbody>
            </table>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-200 bg-ink-50 px-6 py-4 sm:px-8">
              <p className="text-sm text-ink-500">Places and start dates vary by term.</p>
              <button className="btn-primary" onClick={() => onAsk(p.title)}>Ask about {p.title}</button>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------- portal */
function Portal() {
  const { user } = useAuth();
  return (
    <section id="portal" className="scroll-mt-24 bg-white py-20 sm:py-28">
      <Container className="grid gap-12">
        <div>
          <SectionHead title="Follow your child's progress from any phone" lead="Every family receives a secure account. You see only your own children's information." />
          <ul className="mt-8 space-y-3">
            {portalPoints.map((t) => <li key={t} className="flex items-start gap-3"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white"><Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" /></span>{t}</li>)}
          </ul>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link to={user ? '/dashboard' : '/login'} className="btn-primary px-6 py-3">{user ? 'Open your portal' : 'Sign in to the portal'}</Link>
            {!user && <Link to="/forgot-password" className="btn-ghost px-6 py-3">I forgot my password</Link>}
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------ gallery */
function Gallery({ photos }) {
  const [i, setI] = useState(null);
  const n = photos.length;
  const titleOf = (src) => gallery.find((g) => g.src === src)?.title || '';
  const textOf = (src) => gallery.find((g) => g.src === src)?.text || '';
  useEffect(() => {
    if (i === null) return;
    const h = (e) => {
      if (e.key === 'Escape') setI(null);
      if (e.key === 'ArrowRight') setI((x) => (x + 1) % n);
      if (e.key === 'ArrowLeft') setI((x) => (x - 1 + n) % n);
    };
    window.addEventListener('keydown', h);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = ''; };
  }, [i, n]);
  const feature = n >= 5;
  const empty = n === 0;
  const gaps = feature ? (3 - ((n - 3) % 3)) % 3 : 0; // empty cells the last tile should fill
  return (
    <section id="gallery" className="scroll-mt-24 border-t border-ink-200 bg-ink-50 py-20 sm:py-28">
      <Container>
        <SectionHead title="Life at the school" lead={empty ? 'Photos of our campus, classes and events are coming soon.' : 'Select a photo to view it larger.'} />
        <div className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-3">
          {empty && gallery.map((g) => (
            <div key={g.src} className="ruled relative flex items-end overflow-hidden rounded-lg border border-ink-200 bg-white" style={{ aspectRatio: '4 / 3' }}>
              <span className="p-3 text-sm text-ink-500">{g.title}<span className="block text-xs text-ink-300">Photo coming soon</span></span>
            </div>
          ))}
          {photos.map((src, idx) => (
            <button key={src} onClick={() => setI(idx)} className={`group relative overflow-hidden rounded-lg bg-ink-100 ${feature && idx === 0 ? 'col-span-2 row-span-2' : ''} ${feature && idx === n - 1 && gaps === 1 ? 'col-span-2' : ''}`} style={{ aspectRatio: feature && idx === n - 1 && gaps === 1 ? '8 / 3' : '4 / 3' }}>
              <img src={src} alt={titleOf(src)} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-900/80 to-transparent p-3 pt-8 text-left text-sm font-medium text-white">{titleOf(src)}</span>
            </button>
          ))}
        </div>
      </Container>
      {i !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/95 p-4" onClick={() => setI(null)} role="dialog" aria-modal="true" aria-label={titleOf(photos[i])}>
          <button className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" onClick={() => setI(null)} aria-label="Close"><X className="h-5 w-5" /></button>
          {n > 1 && <button className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20" onClick={(e) => { e.stopPropagation(); setI((i - 1 + n) % n); }} aria-label="Previous photo"><ChevronLeft className="h-6 w-6" /></button>}
          <figure className="max-w-5xl text-center" onClick={(e) => e.stopPropagation()}>
            <img src={photos[i]} alt={titleOf(photos[i])} className="max-h-[78vh] rounded-md object-contain" />
            <figcaption className="mt-3 text-white/85"><span className="block font-semibold">{titleOf(photos[i])} <span className="font-normal text-white/50">({i + 1} of {n})</span></span><span className="mx-auto mt-1 block max-w-2xl text-sm text-white/70">{textOf(photos[i])}</span></figcaption>
          </figure>
          {n > 1 && <button className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20" onClick={(e) => { e.stopPropagation(); setI((i + 1) % n); }} aria-label="Next photo"><ChevronRight className="h-6 w-6" /></button>}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------- events */
const EVENT_LABEL = { term: 'Term', holiday: 'Holiday', exam: 'Exams', meeting: 'Meeting', makerspace: 'Maker Space', other: 'School' };
function Events({ events }) {
  return (
    <section id="events" className="scroll-mt-24 bg-white py-20 sm:py-28">
      <Container className="grid gap-12 lg:grid-cols-[5fr_7fr] lg:gap-20">
        <SectionHead title="School calendar" lead="Terms, exams, meetings and Maker Space activities, kept up to date by the school office." />
        <ul className="divide-y divide-ink-200 border-y border-ink-200">
          {events.map((e) => (
            <li key={e._id} className="flex items-center gap-5 py-5">
              <div className="w-14 shrink-0 text-center leading-none"><p className="font-serif text-3xl font-semibold">{fmtDay(e.start)}</p><p className="mt-1.5 text-sm font-medium text-brand-700">{fmtMon(e.start)}</p></div>
              <div className="min-w-0 flex-1"><p className="font-semibold">{e.title}</p>{e.description && <p className="truncate text-sm text-ink-500">{e.description}</p>}</div>
              <span className="hidden shrink-0 text-sm text-ink-500 sm:block">{EVENT_LABEL[e.type] || 'School'}</span>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

/* ---------------------------------------------------------------------- faq */
function FAQ() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="scroll-mt-24 border-y border-ink-200 bg-ink-50 py-20 sm:py-28">
      <Container className="grid gap-12 lg:grid-cols-[5fr_7fr] lg:gap-20">
        <SectionHead title="Common questions" lead="Cannot find your answer? Send us a message below." />
        <div className="divide-y divide-ink-200 border-y border-ink-200">
          {faqs.map((f, idx) => {
            const on = open === idx;
            return (
              <div key={f.q}>
                <h3 className="font-sans"><button className="flex w-full items-center justify-between gap-4 py-5 text-left text-[17px] font-semibold" aria-expanded={on} onClick={() => setOpen(on ? -1 : idx)}>
                  {f.q}<ChevronDown className={`h-5 w-5 shrink-0 text-ink-500 transition-transform duration-200 ${on ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button></h3>
                <div className={`grid transition-[grid-template-rows] duration-300 ${on ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}><div className="overflow-hidden"><p className="pb-5 pr-9 text-ink-700">{f.a}</p></div></div>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------ contact */
function Contact({ inquiry }) {
  const blank = { name: '', email: '', phone: '', topic: 'admission', message: '' };
  const [f, setF] = useState(blank);
  const [state, setState] = useState({ busy: false, done: '', error: '' });
  useEffect(() => { if (inquiry.nonce) setF((x) => ({ ...x, topic: 'admission', message: inquiry.message })); }, [inquiry.nonce]);
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, done: '', error: '' });
    try {
      const d = await api.post('/public/contact', f);
      setState({ busy: false, done: d.message, error: '' });
      setF(blank);
    } catch (er) { setState({ busy: false, done: '', error: er.message }); }
  };
  const c = site.contact;
  const rows = [[MapPin, 'Address', c.address], [Phone, 'Phone', c.phone], [Mail, 'Email', c.email], [Clock, 'Office hours', c.hours]].filter((r) => r[2]);
  return (
    <section id="contact" className="scroll-mt-24 bg-white py-20 sm:py-28">
      <Container className="grid gap-12 lg:grid-cols-[5fr_7fr] lg:gap-20">
        <div>
          <SectionHead title="Admissions and enquiries" lead="Send us a message and the school office will reply as soon as possible." />
          <ol className="mt-10 space-y-6 border-l border-ink-200 pl-6">
            {admissionSteps.map((s, idx) => (
              <li key={s.title} className="relative">
                <span className="absolute -left-[37px] flex h-6 w-6 items-center justify-center rounded-full border border-ink-200 bg-white text-xs font-semibold text-brand-700">{idx + 1}</span>
                <p className="font-semibold">{s.title}</p><p className="text-ink-700">{s.text}</p>
              </li>
            ))}
          </ol>
          {rows.length > 0 && (
            <dl className="mt-10 space-y-3 border-t border-ink-200 pt-6">
              {rows.map(([Icon, k, v]) => <div key={k} className="flex items-start gap-3"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" /><div><dt className="sr-only">{k}</dt><dd>{v}</dd></div></div>)}
            </dl>
          )}
          {c.mapUrl && <iframe title="School location" src={c.mapUrl} className="mt-6 h-56 w-full rounded-lg border border-ink-200" loading="lazy" />}
        </div>

        <div className="rounded-lg border border-ink-200 bg-ink-50 p-6 sm:p-8">
          {state.done ? (
            <div className="py-10 text-center" role="status">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white"><Check className="h-6 w-6" aria-hidden="true" /></span>
              <h3 className="mt-5 text-2xl">Message sent</h3>
              <p className="mx-auto mt-2 max-w-sm text-ink-700">{state.done}</p>
              <button className="btn-ghost mt-6" onClick={() => setState({ busy: false, done: '', error: '' })}>Send another message</button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4" noValidate={false}>
              {state.error && <div role="alert" className="rounded-md border-l-4 border-brand-600 bg-brand-50 px-3 py-2.5 text-sm text-brand-900">{state.error}</div>}
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label className="label" htmlFor="c-name">Your name</label><input id="c-name" className="input py-2.5" required value={f.name} onChange={up('name')} autoComplete="name" /></div>
                <div><label className="label" htmlFor="c-topic">About</label>
                  <select id="c-topic" className="input py-2.5" value={f.topic} onChange={up('topic')}><option value="admission">Admission</option><option value="fees">Fees</option><option value="general">A general question</option><option value="other">Something else</option></select></div>
                <div><label className="label" htmlFor="c-email">Email</label><input id="c-email" type="email" className="input py-2.5" value={f.email} onChange={up('email')} autoComplete="email" /></div>
                <div><label className="label" htmlFor="c-phone">Phone</label><input id="c-phone" type="tel" className="input py-2.5" value={f.phone} onChange={up('phone')} autoComplete="tel" /></div>
              </div>
              <p className="-mt-1 text-[13px] text-ink-500">Give an email or a phone number so we can reply.</p>
              <div><label className="label" htmlFor="c-msg">Message</label><textarea id="c-msg" rows={6} required minLength={5} maxLength={2000} className="input" value={f.message} onChange={up('message')} /></div>
              <button className="btn-primary w-full py-3 text-base" disabled={state.busy}>{state.busy ? 'Sending' : 'Send message'}</button>
            </form>
          )}
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------- footer */
function Footer({ links }) {
  const { contact } = site;
  return (
    <footer className="bg-ink-900 text-white/75">
      <Container className="grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-md bg-white p-1"><img src="/logo.png" alt="" className="h-full w-full object-contain" /></span>
            <p className="font-serif text-lg font-semibold leading-tight text-white">Groupe Scolaire<br />APACOPE</p>
          </div>
          <p className="mt-4 max-w-xs text-sm">Practical, competency-based technical education.</p>
        </div>
        <nav aria-label="Footer">
          <p className="mb-3 text-sm font-semibold text-white">On this site</p>
          <ul className="space-y-2 text-sm">
            {links.map(([id, label]) => <li key={id}><a className="hover:text-white" href={`#${id}`} onClick={go(id)}>{label}</a></li>)}
            <li><Link className="hover:text-white" to="/login">Portal login</Link></li>
          </ul>
        </nav>
        <div>
          <p className="mb-3 text-sm font-semibold text-white">Contact</p>
          <ul className="space-y-2 text-sm">
            {contact.address && <li>{contact.address}</li>}
            {contact.phone && <li>{contact.phone}</li>}
            {contact.email && <li>{contact.email}</li>}
            {contact.hours && <li>{contact.hours}</li>}
            {!hasContact && <li><a className="hover:text-white" href="#contact" onClick={go('contact')}>Send us a message</a></li>}
          </ul>
        </div>
      </Container>
      <div className="border-t border-white/10"><Container className="py-5 text-[13px] text-white/50">&copy; {new Date().getFullYear()} {site.name}. All rights reserved.</Container></div>
    </footer>
  );
}

/* --------------------------------------------------------------------- page */
export default function Landing() {
  const [events, setEvents] = useState(null);
  const [inquiry, setInquiry] = useState({ nonce: 0, message: '' });
  const srcs = useMemo(() => gallery.map((g) => g.src), []);
  const photos = useExistingImages(srcs);
  const heroOk = useExistingImages(useMemo(() => [heroImage], []));

  useEffect(() => { document.title = `${site.name} | Technical education in Rwanda`; }, []);
  useEffect(() => { api.get('/public/events').then(setEvents).catch(() => setEvents([])); }, []);

  const links = [
    ['about', 'About'], ['programs', 'Programs'], ['portal', 'Parent portal'],
    ['gallery', 'Gallery'],
    ...(events?.length ? [['events', 'Calendar']] : []),
    ['faq', 'Questions'], ['contact', 'Contact'],
  ];
  const active = useActiveSection(links.map((l) => l[0]));

  const ask = (title) => { setInquiry({ nonce: Date.now(), message: `I would like to know more about the ${title} program.` }); scrollToId('contact'); };

  return (
    <div className="bg-white">
      <Header links={links} active={active} />
      <main>
        <Hero events={events} photo={heroOk[0]} />
        <About />
        <Programs onAsk={ask} />
        <Portal />
        <Gallery photos={photos} />
        {events?.length > 0 && <Events events={events} />}
        <FAQ />
        <Contact inquiry={inquiry} />
      </main>
      <Footer links={links} />
    </div>
  );
}