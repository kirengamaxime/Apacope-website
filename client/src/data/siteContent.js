/**
 * ===================================================================
 *  EDIT THIS FILE to change what the public website says.
 *  Text marked (PLACEHOLDER) is sample wording. Replace it with the
 *  school's real details before the site goes live.
 *  Empty contact fields are simply hidden from the page.
 * ===================================================================
 */
export const site = {
  name: 'Groupe Scolaire APACOPE',
  headline: 'Technical education that gets learners ready for work.', // (PLACEHOLDER)
  intro:
    'We teach practical skills in classrooms, labs and workshops, so graduates can start a job, continue their studies or build their own business.', // (PLACEHOLDER)
  contact: {
    address: '', // e.g. 'KG 123 St, Kigali, Rwanda'
    phone: '', // e.g. '+250 788 000 000'
    email: '', // e.g. 'info@apacope.rw'
    hours: '', // e.g. 'Monday to Friday, 7:30 to 17:00'
    mapUrl: '', // paste a Google Maps "embed" link to show a map
  },
};

export const about = {
  title: 'Solid theory, practised every day', // (PLACEHOLDER)
  story:
    'Groupe Scolaire APACOPE exists to give young people the practical skills the job market asks for. Every module combines teaching with hands-on practice, and every learner is assessed on what they can actually do.', // (PLACEHOLDER)
  items: [
    { term: 'Mission', text: 'To train skilled, disciplined and innovative graduates through competency-based education that meets the needs of employers and the community.' },
    { term: 'Vision', text: 'To be a school of technical and vocational excellence, known for graduates who create jobs as well as fill them.' },
    { term: 'Values', text: 'Discipline, integrity, teamwork, creativity and respect, practised by learners, trainers and parents alike.' },
  ], // (PLACEHOLDER)
};

export const programs = [
  {
    id: 'sod',
    title: 'Software Development',
    blurb: 'Learners design, build and test websites, applications and databases, working on real projects from the first term.',
    highlights: ['Web design and programming', 'Databases and data structures', 'Project work in the Maker Space', 'Business analysis basics'],
    levels: [
      { name: 'Level 3', focus: 'Web fundamentals, HTML and CSS, introductory programming' },
      { name: 'Level 4', focus: 'Databases, data structures, algorithms, web applications' },
      { name: 'Level 5', focus: 'Full applications, system analysis, team projects' },
    ],
  },
  {
    id: 'csn',
    title: 'Computer Systems and Networking',
    blurb: 'Learners install, secure and maintain computers and networks for schools, offices and small businesses.',
    highlights: ['Hardware and troubleshooting', 'Network design and cabling', 'System administration', 'Safe and secure computing'],
    levels: [
      { name: 'Level 3', focus: 'Computer hardware, operating systems, basic troubleshooting' },
      { name: 'Level 4', focus: 'Local networks, cabling, user and server administration' },
      { name: 'Level 5', focus: 'Network security, monitoring, service management' },
    ],
  },
  {
    id: 'short',
    title: 'Short courses',
    blurb: 'Focused training for adults and out-of-school youth who want a practical skill without a full program.',
    highlights: ['Computer literacy', 'Office applications', 'Flexible weekday and weekend classes', 'Certificate on completion'],
    levels: [
      { name: 'Weekday', focus: 'Daytime classes in small groups' },
      { name: 'Weekend', focus: 'Saturday classes for people who work' },
    ],
  },
]; // (PLACEHOLDER) - replace with the trades and levels the school really offers

export const portalPoints = [
  'See attendance as soon as the trainer saves the register',
  'Read results with totals, grades and competency',
  'Check fee balances and receipts',
  'Receive school notices and confirm you have read them',
];

export const admissionSteps = [
  { title: 'Send an enquiry', text: 'Tell us which program interests you, using the form on this page.' },
  { title: 'Visit the school office', text: 'Bring your last school report and identity document so we can discuss placement.' },
  { title: 'Complete registration', text: 'Pay the registration fee, receive your receipt and get your portal account.' },
]; // (PLACEHOLDER)

/**
 * Gallery photos: the files live in client/public/images/ with these names
 * (gallery-1.jpg to gallery-5.jpg). Each entry has a short title and a
 * description shown when the photo is opened. To add a photo, copy the file
 * into that folder and add one more entry here. Optional: hero.jpg adds a
 * photo to the top of the page.
 */
export const gallery = [
  { src: '/images/gallery-1.jpg', title: 'Maker Space open day', text: 'Learners present their robotics and technology projects to visitors and guests during the Maker Space open day.' },
  { src: '/images/gallery-2.jpg', title: 'Top national examination performer', text: 'An APACOPE learner who achieved the highest mark in the national examinations is awarded by NESA.' },
  { src: '/images/gallery-3.jpg', title: 'A school event', text: 'Learners perform traditional drumming and dance at a school event.' },
  { src: '/images/gallery-4.jpg', title: 'Maker Space open day presentation', text: 'Learners demonstrate their work on the computer to guests at the Maker Space open day.' },
  { src: '/images/gallery-5.jpg', title: 'Kwibuka commemoration', text: 'Learners and guests take part in the school\'s Kwibuka programme, remembering and honouring the victims of the Genocide against the Tutsi.' },
];
export const heroImage = '/images/hero.jpg';

export const faqs = [
  { q: 'How do I apply for admission?', a: 'Send an enquiry with the form on this page, or visit the school office with your last school report and identity document. We will explain the available places and the next steps.' }, // (PLACEHOLDER)
  { q: 'Which levels and trades can I choose from?', a: 'The Programs section lists the trades and levels we teach. If you are unsure which suits you, ask us and a trainer will advise.' },
  { q: 'How can parents follow their child\'s progress?', a: 'Every parent receives a secure portal account. After signing in you can see attendance, results, fee balances and school notices for your own children only.' },
  { q: 'How are fees paid, and do I get a receipt?', a: 'Fees are paid at the accountant\'s office, or by the methods the school announces each term. Every payment is recorded and receipted in the portal.' }, // (PLACEHOLDER)
];