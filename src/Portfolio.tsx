import { useMemo, useState, type ReactNode } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { Menu, X, Mail, ExternalLink, ChevronRight, Sparkles } from 'lucide-react'

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" />
    </svg>
  )
}
function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286ZM5.337 7.433a2.062 2.062 0 1 1 0-4.125 2.062 2.062 0 0 1 0 4.125ZM6.84 20.452H3.834V9H6.84v11.452Z" />
    </svg>
  )
}

/* ─── Design Tokens (DESIGN.md) ─── */
const t = {
  surface: '#fbfaeb',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f5f4e6',
  surfaceContainerHigh: '#e9e8da',
  surfaceContainerHighest: '#e4e3d5',
  primary: '#013011',
  primaryContainer: '#1b4725',
  primaryFixedDim: '#2d6b3f',
  onPrimary: '#ffffff',
  onSurface: '#1b1c13',
  secondary: '#4caf50',
  secondaryContainer: '#c8e6c9',
  onSecondaryContainer: '#1b3a1d',
  outlineVariant: '#c4c4b0',
} as const

const ease = [0.22, 1, 0.36, 1] as [number, number, number, number]
const stagger = { show: { transition: { staggerChildren: 0.06 } } }
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
}

const font = {
  display: "'Newsreader', serif",
  body: "'Manrope', sans-serif",
  label: "'Space Grotesk', sans-serif",
}
const grad = `linear-gradient(135deg, ${t.primary}, ${t.primaryContainer})`
const shadow = `0 8px 40px ${t.onSurface}06`

export default function Portfolio() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { scrollYProgress } = useScroll()
  const navBlur = useTransform(scrollYProgress, [0, 0.03], [0, 1])

  const navItems = useMemo(
    () => [
      { label: 'Skills', href: '#skills' },
      { label: 'Projects', href: '#projects' },
      { label: 'Experience', href: '#experience' },
      { label: 'Awards', href: '#awards' },
      { label: 'Education', href: '#education' },
      { label: 'Contact', href: '#contact' },
    ],
    [],
  )

  const skillGroups = [
    { title: 'Backend', items: ['PHP 8.x', 'Symfony', 'Laravel', 'Golang', 'Rust', 'Drupal 7–10'] },
    {
      title: 'Blockchain',
      items: ['Rust', 'Move', 'Sui', 'Solana', 'Solidity', 'ZKLogin', 'Passkey'],
    },
    { title: 'API & Security', items: ['REST', 'GraphQL', 'OAuth2', 'JWT', 'SSO'] },
    { title: 'Data', items: ['MySQL', 'PostgreSQL', 'Redis', 'Elasticsearch', 'DynamoDB'] },
    { title: 'Cloud', items: ['AWS', 'Docker', 'Jenkins', 'CI/CD', 'Lambda'] },
    { title: 'Quality', items: ['OOP/SOLID', '12-Factor', 'Secure Coding', 'Observability'] },
  ]

  const projects = [
    {
      title: 'TaskOS',
      sub: 'SuiHub HCMC Bootcamp · 1st Prize',
      desc: 'Sui-based productivity platform with modern auth flows and object-centric architecture for Web3-native task experiences.',
      tags: ['SUI', 'WALRUS', 'SEAL', 'Passkey', 'ZKLogin'],
    },
    {
      title: 'Walagora',
      sub: 'Move in Practice · 1st Prize',
      desc: 'Premium Web3 product built around secure assets, user-friendly onboarding, and payment utilities on Sui.',
      tags: ['SUI', 'WALRUS', 'SEAL', 'Payment Kit'],
    },
    {
      title: 'Datex',
      sub: 'First Movers 2026 · Best UX/UI',
      desc: 'Polished blockchain experience emphasizing usability and secure architecture across Sui and Nautilus.',
      tags: ['SUI', 'WALRUS', 'NAUTILUS'],
    },
    {
      title: 'WP Beep Plugin',
      sub: 'Beep HCMC · 2nd Prize',
      desc: 'WordPress Web3 integration enabling accessible payment and blockchain utility for mainstream CMS.',
      tags: ['BEEP SDK', 'SUI', 'WordPress'],
    },
  ]

  const experiences = [
    {
      company: 'Monimedia (Tagww)',
      role: 'Senior PHP Developer',
      period: 'Feb 2018 – Jul 2025',
      location: 'Hong Kong / UK',
      highlights: [
        'Led Drupal 7→10 upgrades and backend delivery for British Council platforms.',
        'Built reporting APIs, multilingual systems, and resilient content platforms.',
        'Drove API versioning, auth flows, secure coding, and observability practices.',
        'Implemented AWS Lambda + DynamoDB workflows for invoice processing.',
      ],
    },
    {
      company: 'Sendo.vn',
      role: 'Senior Backend Developer',
      period: 'Nov 2016 – Feb 2018',
      location: 'Vietnam',
      highlights: [
        'Built Go services and optimized e-commerce workflows at scale.',
        'Integrated RabbitMQ, Redis, Elasticsearch, and SQL Server pipelines.',
        'Improved monitoring and incident response for high-traffic systems.',
      ],
    },
    {
      company: 'Sutrix Solutions',
      role: 'Senior PHP Developer',
      period: 'Nov 2013 – Jun 2016',
      location: 'France / Vietnam',
      highlights: [
        'Led Symfony product work for chat, payments, SSO, and push systems.',
        'Migrated legacy ASP.NET to Drupal with architecture modernization.',
        'Implemented Docker/Jenkins CI/CD pipelines to AWS and Acquia.',
      ],
    },
  ]

  const awards: [string, string][] = [
    ['First Movers Sprint 2026', 'Best UX/UI'],
    ['Beep HCMC Bootcamp', '2nd Prize'],
    ['Move in Practice', '1st Prize'],
    ['SuiHub HCMC Bootcamp', '1st Prize'],
    ['VietBUIDL 2025', '2nd Prize'],
    ['HDBank Hackathon 2025', '3rd Prize'],
  ]

  const education: [string, string, string][] = [
    ['Lạc Hồng University', "Master's, Computer & Information Sciences", '2014 – 2016'],
    ['Gia Định IT University', 'B.Eng, Information Technology', '2011 – 2013'],
    ['HCMC Industry & Trade College', 'Diploma, Information Technology', '2007 – 2010'],
  ]

  return (
    <main
      className="min-h-screen selection:bg-emerald-200/40"
      style={{ background: t.surface, color: t.onSurface, fontFamily: font.body }}
    >
      {/* ── Nav ── */}
      <motion.header
        className="fixed inset-x-0 top-0 z-50"
        style={{
          background: useTransform(navBlur, (v) => `rgba(251,250,235,${0.6 + v * 0.35})`),
          backdropFilter: useTransform(navBlur, (v) => `blur(${v * 20}px)`),
        }}
      >
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <a href="#home" className="flex items-center gap-2.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ background: grad }}
            >
              <Sparkles className="h-4 w-4" style={{ color: t.onPrimary }} />
            </div>
            <span
              className="text-[13px] font-bold tracking-[0.2em]"
              style={{ color: t.primary, fontFamily: font.label }}
            >
              MY PROFILE
            </span>
          </a>

          <div className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="px-3 py-1.5 text-[13px] font-medium tracking-wide transition-colors duration-200 cursor-pointer"
                style={{ color: t.onSurface, fontFamily: font.label }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = t.primary
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = t.onSurface
                }}
              >
                {item.label}
              </a>
            ))}
          </div>

          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-lg md:hidden cursor-pointer"
            style={{ background: t.surfaceContainerHigh }}
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </nav>

        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-6 pb-4 md:hidden"
            style={{ background: t.surfaceContainerLow }}
          >
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="block rounded-md px-3 py-2.5 text-[14px] font-medium cursor-pointer"
                style={{ color: t.onSurface, fontFamily: font.label }}
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </a>
            ))}
          </motion.div>
        )}
      </motion.header>

      {/* ── Hero ── */}
      <section
        id="home"
        className="mx-auto max-w-5xl px-6"
        style={{ paddingTop: 140, paddingBottom: 80 }}
      >
        <motion.div initial="hidden" animate="show" variants={stagger}>
          <motion.div
            variants={fadeUp}
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[12px] font-medium tracking-wide"
            style={{ background: t.surfaceContainerLow, color: t.primary, fontFamily: font.label }}
          >
            <span className="relative flex h-2 w-2">
              <span
                className="absolute inline-flex h-full w-full rounded-full opacity-50"
                style={{ background: t.secondary, animation: 'pulse-dot 4s ease-in-out infinite' }}
              />
              <span
                className="relative inline-flex h-2 w-2 rounded-full"
                style={{ background: t.secondary }}
              />
            </span>
            Available for opportunities
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="mt-8 text-[clamp(2.8rem,6vw,5rem)] font-light leading-[1.02] tracking-[-0.025em]"
            style={{ fontFamily: font.display, color: t.primary }}
          >
            Phú, Long
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mt-3 text-[clamp(0.95rem,1.6vw,1.15rem)] font-medium tracking-wide"
            style={{ fontFamily: font.label, color: t.primaryFixedDim }}
          >
            Senior Backend Developer · Blockchain Builder
          </motion.p>

          <motion.p
            variants={fadeUp}
            className="mt-6 max-w-[520px] text-[16px] leading-[1.85]"
            style={{ color: t.onSurface }}
          >
            Building scalable APIs and blockchain experiences with{' '}
            <em style={{ fontFamily: font.display, fontStyle: 'italic', color: t.primary }}>
              Symfony, Go, Rust, Solidity,
            </em>{' '}
            and{' '}
            <em style={{ fontFamily: font.display, fontStyle: 'italic', color: t.primary }}>
              Sui Move.
            </em>
          </motion.p>

          <motion.div variants={fadeUp} className="mt-8 flex flex-wrap gap-3">
            <a
              href="mailto:longphu257@gmail.com"
              className="rounded-lg px-6 py-3 text-[13px] font-semibold tracking-wide transition-all duration-200 hover:-translate-y-px cursor-pointer"
              style={{ background: grad, color: t.onPrimary, fontFamily: font.label }}
            >
              Get in Touch
            </a>
            <a
              href="https://github.com/longphu25"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-[13px] font-semibold tracking-wide transition-all duration-200 hover:-translate-y-px cursor-pointer"
              style={{
                background: t.surfaceContainerHighest,
                color: t.primary,
                fontFamily: font.label,
              }}
            >
              <GithubIcon className="h-4 w-4" /> GitHub
            </a>
            <a
              href="https://linkedin.com/in/longphu"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-[13px] font-semibold tracking-wide transition-all duration-200 hover:-translate-y-px cursor-pointer"
              style={{
                background: t.surfaceContainerHighest,
                color: t.primary,
                fontFamily: font.label,
              }}
            >
              <LinkedinIcon className="h-4 w-4" /> LinkedIn
            </a>
          </motion.div>

          {/* Stats */}
          <motion.div variants={fadeUp} className="mt-14 flex flex-wrap gap-10">
            {(
              [
                ['10+', 'Years'],
                ['10+', 'Hackathon wins'],
                ['Global', 'Delivery'],
              ] as const
            ).map(([val, label]) => (
              <div key={label}>
                <div
                  className="text-[2rem] font-semibold leading-none"
                  style={{ color: t.primary, fontFamily: font.display }}
                >
                  {val}
                </div>
                <div
                  className="mt-1 text-[12px] tracking-wide"
                  style={{ color: t.outlineVariant, fontFamily: font.label }}
                >
                  {label}
                </div>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* ── Skills ── */}
      <Sec id="skills" bg={t.surfaceContainerLow}>
        <Header eyebrow="Skills" title="Core capabilities" />
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.1 }}
          variants={stagger}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {skillGroups.map((g) => (
            <motion.div
              key={g.title}
              variants={fadeUp}
              className="rounded-lg p-5"
              style={{ background: t.surfaceContainerLowest, boxShadow: shadow }}
            >
              <h3
                className="text-[17px] font-semibold"
                style={{ color: t.primary, fontFamily: font.display }}
              >
                {g.title}
              </h3>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {g.items.map((item) => (
                  <span
                    key={item}
                    className="rounded-full px-3 py-1 text-[11px] font-medium tracking-wide transition-colors duration-200 cursor-default"
                    style={{
                      background: t.surfaceContainerHighest,
                      color: t.onSurface,
                      fontFamily: font.label,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = t.secondaryContainer
                      e.currentTarget.style.color = t.onSecondaryContainer
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = t.surfaceContainerHighest
                      e.currentTarget.style.color = t.onSurface
                    }}
                  >
                    {item}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </Sec>

      {/* ── Projects ── */}
      <Sec id="projects" bg={t.surface}>
        <Header eyebrow="Projects" title="Featured work" />
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.05 }}
          variants={stagger}
          className="grid gap-5 lg:grid-cols-2"
        >
          {projects.map((p) => (
            <motion.div
              key={p.title}
              variants={fadeUp}
              className="group rounded-lg overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
              style={{ background: t.surfaceContainerLow }}
            >
              <div className="p-5 pb-4" style={{ background: grad }}>
                <p
                  className="text-[11px] uppercase tracking-[0.25em]"
                  style={{ color: `${t.onPrimary}77`, fontFamily: font.label }}
                >
                  Showcase
                </p>
                <p
                  className="mt-2 text-[22px] font-semibold"
                  style={{ color: t.onPrimary, fontFamily: font.display }}
                >
                  {p.title}
                </p>
                <p
                  className="mt-1 text-[12px] font-medium tracking-wide"
                  style={{ color: `${t.onPrimary}aa`, fontFamily: font.label }}
                >
                  {p.sub}
                </p>
              </div>
              <div className="p-5">
                <p className="text-[14px] leading-[1.75]" style={{ color: t.onSurface }}>
                  {p.desc}
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {p.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full px-2.5 py-0.5 text-[10px] font-medium tracking-wide"
                      style={{
                        background: t.surfaceContainerHighest,
                        color: t.onSurface,
                        fontFamily: font.label,
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div
                  className="mt-4 inline-flex items-center gap-1 text-[12px] font-semibold tracking-wide"
                  style={{ color: t.primary, fontFamily: font.label }}
                >
                  View project{' '}
                  <ChevronRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </Sec>

      {/* ── Experience ── */}
      <Sec id="experience" bg={t.surfaceContainerLow}>
        <Header eyebrow="Experience" title="Career journey" />
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.1 }}
          variants={stagger}
          className="flex flex-col"
          style={{ gap: 40 }}
        >
          {experiences.map((item, idx) => (
            <motion.div
              key={item.company}
              variants={fadeUp}
              className="grid gap-5 rounded-lg p-6 lg:grid-cols-[200px_1fr]"
              style={{ background: t.surfaceContainerLowest, boxShadow: shadow }}
            >
              <div>
                <span
                  className="text-[11px] font-bold uppercase tracking-[0.25em]"
                  style={{ color: t.primaryFixedDim, fontFamily: font.label }}
                >
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <p
                  className="mt-2 text-[18px] font-semibold"
                  style={{ color: t.primary, fontFamily: font.display }}
                >
                  {item.role}
                </p>
                <p className="mt-1 text-[13px]" style={{ color: t.onSurface }}>
                  {item.company}
                </p>
                <div
                  className="mt-3 inline-block rounded-md px-2.5 py-1"
                  style={{ background: t.surfaceContainerHigh }}
                >
                  <p
                    className="text-[11px] font-medium tracking-wide"
                    style={{ color: t.onSurface, fontFamily: font.label }}
                  >
                    {item.period}
                  </p>
                </div>
                <p
                  className="mt-1.5 text-[12px]"
                  style={{ color: t.outlineVariant, fontFamily: font.label }}
                >
                  {item.location}
                </p>
              </div>
              <ul className="space-y-2">
                {item.highlights.map((h) => (
                  <li
                    key={h}
                    className="flex gap-2.5 text-[14px] leading-[1.7]"
                    style={{ color: t.onSurface }}
                  >
                    <span
                      className="mt-[8px] h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: t.primaryFixedDim }}
                    />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </motion.div>
      </Sec>

      {/* ── Awards ── */}
      <Sec id="awards" bg={t.surface}>
        <Header eyebrow="Recognition" title="Hackathons & awards" />
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.15 }}
          variants={stagger}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {awards.map(([title, prize]) => (
            <motion.div
              key={title}
              variants={fadeUp}
              className="flex items-center justify-between gap-3 rounded-lg p-4 cursor-default"
              style={{ background: t.surfaceContainerLow }}
            >
              <span
                className="text-[15px] font-semibold leading-snug"
                style={{ color: t.primary, fontFamily: font.display }}
              >
                {title}
              </span>
              <span
                className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide"
                style={{
                  background: t.secondaryContainer,
                  color: t.onSecondaryContainer,
                  fontFamily: font.label,
                }}
              >
                {prize}
              </span>
            </motion.div>
          ))}
        </motion.div>
      </Sec>

      {/* ── Education ── */}
      <Sec id="education" bg={t.surfaceContainerLow}>
        <Header eyebrow="Education" title="Academic background" />
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.15 }}
          variants={stagger}
          className="grid gap-4 md:grid-cols-3"
        >
          {education.map(([school, degree, period]) => (
            <motion.div
              key={school}
              variants={fadeUp}
              className="rounded-lg p-5"
              style={{ background: t.surfaceContainerLowest, boxShadow: shadow }}
            >
              <p
                className="text-[11px] uppercase tracking-[0.2em]"
                style={{ color: t.outlineVariant, fontFamily: font.label }}
              >
                {period}
              </p>
              <h3
                className="mt-2 text-[17px] font-semibold leading-snug"
                style={{ color: t.primary, fontFamily: font.display }}
              >
                {school}
              </h3>
              <p className="mt-2 text-[14px] leading-[1.65]" style={{ color: t.onSurface }}>
                {degree}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </Sec>

      {/* ── Contact ── */}
      <Sec id="contact" bg={t.surface}>
        <Header eyebrow="Contact" title="Let's build something together" />
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
          variants={fadeUp}
          className="rounded-xl p-8 md:p-10"
          style={{ background: grad }}
        >
          <p className="max-w-lg text-[15px] leading-[1.8]" style={{ color: `${t.onPrimary}cc` }}>
            Open to senior backend, platform, and blockchain engineering opportunities.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <CLink
              href="mailto:longphu257@gmail.com"
              icon={<Mail className="h-4 w-4" />}
              label="Email"
            />
            <CLink
              href="https://linkedin.com/in/longphu"
              icon={<LinkedinIcon className="h-4 w-4" />}
              label="LinkedIn"
              external
            />
            <CLink
              href="https://github.com/longphu25"
              icon={<GithubIcon className="h-4 w-4" />}
              label="GitHub"
              external
            />
          </div>
        </motion.div>
      </Sec>

      {/* ── Footer ── */}
      <footer className="py-8 text-center" style={{ background: t.surfaceContainerLow }}>
        <p
          className="text-[11px] tracking-[0.15em]"
          style={{ color: t.outlineVariant, fontFamily: font.label }}
        >
          © 2025 Long Phú
        </p>
      </footer>
    </main>
  )
}

/* ── Components ── */

function Sec({ id, bg, children }: { id?: string; bg: string; children: ReactNode }) {
  return (
    <section id={id} style={{ background: bg, paddingTop: 72, paddingBottom: 72 }}>
      <div className="mx-auto max-w-5xl px-6">{children}</div>
    </section>
  )
}

function Header({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.3 }}
      variants={fadeUp}
      className="mb-8"
    >
      <p
        className="mb-2 text-[11px] font-bold uppercase tracking-[0.3em]"
        style={{ color: t.primaryFixedDim, fontFamily: font.label }}
      >
        {eyebrow}
      </p>
      <h2
        className="text-[clamp(1.5rem,3vw,2.25rem)] font-semibold leading-[1.15] tracking-[-0.01em]"
        style={{ color: t.primary, fontFamily: font.display }}
      >
        {title}
      </h2>
    </motion.div>
  )
}

function CLink({
  href,
  icon,
  label,
  external = false,
}: {
  href: string
  icon: ReactNode
  label: string
  external?: boolean
}) {
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
      className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[12px] font-semibold tracking-wide transition-all duration-200 hover:-translate-y-px cursor-pointer"
      style={{ background: `${t.onPrimary}15`, color: t.onPrimary, fontFamily: font.label }}
    >
      {icon} {label}
      {external && <ExternalLink className="h-3 w-3 opacity-50" />}
    </a>
  )
}
