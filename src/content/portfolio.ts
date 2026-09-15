import type { SectionId } from '../room/types';

/** This is the content template. Both the room and reading view use these entries. */
export const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`;
export const sections: { id: SectionId; title: string; place: string; number: string }[] = [
  { id: 'projects', title: 'Projects', place: 'At the desk', number: '01' },
  { id: 'experience', title: 'Experience', place: 'On the bookshelf', number: '02' },
  { id: 'photography', title: 'Photography', place: 'Through the viewfinder', number: '03' },
  { id: 'about', title: 'About', place: 'A little about me', number: '04' },
];
export const profile = {
  name: 'Michael Lee',
  handle: 'WhirlyFan',
  role: 'Forward Deployed Engineer · Enterprise AI',
  company: 'Handshake',
  intro: 'I build software, work with AI, and look for birds when I step away from the keyboard.',
  email: 'mhykoly@gmail.com',
  github: 'https://github.com/WhirlyFan',
  linkedin: 'https://linkedin.com/in/mhykoly',
  resume: asset('Michael_Lee_Resume.pdf'),
};
export const projects = [
  {
    id: 'music',
    name: 'Music',
    eyebrow: 'A shared soundtrack',
    description:
      'A collaborative desktop music player. Listen on your own, or start a jam and play in sync with friends.',
    details: [
      'A React interface and a local Rust engine in a Tauri desktop app.',
      'Django and WebSockets coordinate shared listening, playlists, and metadata.',
    ],
    tags: ['React', 'Rust', 'Tauri', 'Django'],
    url: 'https://github.com/WhirlyFan/music',
  },
  {
    id: 'lister',
    name: 'Lister',
    eyebrow: 'Lists become conversations',
    description: 'An anime-list community with reviews, followers, and live chat.',
    details: [
      'React and Redux interface with a Flask and SQLAlchemy backend.',
      'Real-time conversations over WebSockets and external anime-data integration.',
    ],
    tags: ['React', 'Flask', 'SQLAlchemy'],
    url: 'https://github.com/WhirlyFan/Lister',
  },
  {
    id: 'breezy',
    name: 'Breezy',
    eyebrow: 'A pocket-sized community',
    description: 'An Android social app for posts, comments, likes, and messages.',
    details: [
      'Built in Kotlin, with Supabase authentication and real-time messaging.',
      'PostgreSQL functions and triggers support the social features.',
    ],
    tags: ['Kotlin', 'Android', 'Supabase'],
    url: null,
  },
];
export const experience = [
  {
    id: 'handshake',
    company: 'Handshake',
    role: profile.role,
    period: 'August 2026–present',
    description:
      'I build and deploy production AI agents for enterprise clients, translating customer workflows into working systems. I own delivery from customer requirements and architecture through evaluations and iteration.',
    tags: ['Enterprise AI', 'Agent architecture', 'Evaluations'],
    current: true,
  },
  {
    id: 'usul',
    company: 'Usul',
    role: 'Founding Engineer',
    period: 'January–July 2026',
    description:
      'Built AI-powered contract search and recommendations, backend architecture, and access controls. Reduced frontend load times by 50% with cache invalidation and real-time updates.',
    tags: ['MCP', 'React', 'LLM workflows', 'PostgreSQL'],
    current: false,
  },
  {
    id: 'ut',
    company: 'UT Austin',
    role: 'Graduate Teaching Assistant',
    period: 'Started August 2025',
    description:
      'Graduate courses in deep learning, machine learning, and planning and search under uncertainty.',
    tags: ['Machine learning', 'Teaching'],
    current: false,
  },
  {
    id: 'nouryon',
    company: 'Nouryon',
    role: 'AI and Data Science Intern',
    period: 'June–August 2025',
    description:
      'Manufacturing simulation with historical data, identifying process bottlenecks and opportunities for improvement.',
    tags: ['Python', 'SimPy', 'Data science'],
    current: false,
  },
  {
    id: 'apero',
    company: 'Apero Health',
    role: 'Full Stack Software Engineer',
    period: 'May–July 2023',
    description: 'Dynamic forms for healthcare clients and a shared frontend component library.',
    tags: ['React', 'TypeScript'],
    current: false,
  },
];
export const photos = [
  {
    id: 'gull',
    title: 'Gull in Flight',
    src: asset('photos/gull-in-flight.jpg'),
    alt: 'A gull gliding low over a field with hills in the background',
  },
  {
    id: 'dove',
    title: 'Mourning Dove',
    src: asset('photos/mourning-dove.jpg'),
    alt: 'A mourning dove foraging on the forest floor in soft light',
  },
];
export const education = [
  {
    institution: 'The University of Texas at Austin',
    degree: 'M.S. Computer Science · GPA 4.0',
    period: 'August 2024–May 2026',
  },
  {
    institution: 'University of California, Irvine',
    degree: 'B.A. Business Economics & International Studies',
    period: 'September 2018–June 2022',
  },
];
export const research = {
  title: 'Making language models more resilient',
  description:
    'In December 2024, I fine-tuned Electra-small with adversarial datasets for natural language inference, achieving an 8.09% accuracy increase on out-of-distribution data.',
};
