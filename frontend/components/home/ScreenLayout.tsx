'use client'

import { ReactNode, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePathname } from 'next/navigation'
import { FilmStripNav } from '@/components/layout/FilmStripNav'
import { AmbientLayer } from '@/components/system/AmbientLayer'
import { pageTransitions, type TransitionMode } from '@/lib/motion'

/**
 * SCREEN LAYOUT
 * 
 * The global container for every screen.
 * Contains:
 * - AmbientLayer (always running)
 * - FilmStripNav (always present)
 * - PageTransition wrapper
 * 
 * The transition mode is determined by where you're going:
 * - Home:     dolly (grand reveal)
 * - Library:  pan-left (going deeper)
 * - Session:  pan-left (deeper)
 * - Party:    pan-left (deeper)
 * - Settings: fade (utility screen)
 * - Movie:    dolly (entering a world)
 */

const routeTransitions: Record<string, TransitionMode> = {
  '/':         'dolly',
  '/library':  'pan-left',
  '/session':  'pan-left',
  '/party':    'pan-left',
  '/profile':  'pan-right',
  '/settings': 'fade',
}

interface ScreenLayoutProps {
  children: ReactNode
}

export function ScreenLayout({ children }: ScreenLayoutProps) {
  const pathname = usePathname()
  const mode = routeTransitions[pathname] || 'fade'
  const t = pageTransitions[mode]

  return (
    <div
      style={{
        background: '#080806',
        color: '#EDE8DC',
        minHeight: '100dvh',
        display: 'flex',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* The always-present ambient life */}
      <AmbientLayer />

      {/* Navigation — above ambient, below content */}
      <div style={{ position: 'relative', zIndex: 10, flexShrink: 0 }}>
        <FilmStripNav />
      </div>

      {/* Page content with transitions */}
      <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 5 }}>
        <AnimatePresence mode="wait">
          <motion.main
            key={pathname}
            initial={t.initial as any}   
            animate={t.animate as any}   
            exit={t.exit as any}         
            transition={t.transition as any} 
            style={{
              width: '100%',
              minHeight: '100dvh',
              position: 'relative',
            }}
          >
            {children}
          </motion.main>
        </AnimatePresence>
      </div>
    </div>
  )
}

/**
 * SECTION REVEAL
 * 
 * Wraps any section that should animate in as it enters the viewport.
 * Uses Intersection Observer for trigger.
 * Motion: projector-style, bottom-up reveal.
 */

interface SectionRevealProps {
  children: ReactNode
  delay?: number
  className?: string
  style?: React.CSSProperties
}

export function SectionReveal({ children, delay = 0, className, style }: SectionRevealProps) {
  const [visible, setVisible] = useState(false)
  const [ref, setRef] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!ref) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.1 }
    )
    observer.observe(ref)
    return () => observer.disconnect()
  }, [ref])

  return (
    <motion.div
      ref={setRef}
      animate={visible ? 'visible' : 'hidden'}
      initial="hidden"
      variants={{
        hidden:  { opacity: 0, y: 28, filter: 'blur(2px)' },
        visible: {
          opacity: 1, y: 0, filter: 'blur(0px)',
          transition: {
            duration: 0.85,
            delay,
            ease: [0.16, 1, 0.30, 1],
          },
        },
      }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  )
}

/**
 * TEXT REVEAL
 * 
 * Each line of a title reveals from behind a clip mask.
 * Like film credits rolling in.
 * Use this for H1/H2 display text.
 */

interface TextRevealProps {
  lines: string[]
  tag?: 'h1' | 'h2' | 'h3' | 'p'
  style?: React.CSSProperties
  lineStyle?: React.CSSProperties
  stagger?: number
  delay?: number
}

export function TextReveal({
  lines,
  tag = 'h1',
  style,
  lineStyle,
  stagger = 0.12,
  delay = 0,
}: TextRevealProps) {
  const Tag = tag

  return (
    <Tag style={style}>
      {lines.map((line, i) => (
        <div
          key={i}
          style={{ overflow: 'hidden', lineHeight: '1.05', ...lineStyle }}
        >
          <motion.span
            initial={{ y: '108%', opacity: 0 }}
            animate={{ y: '0%', opacity: 1 }}
            transition={{
              duration: 1.1,
              delay: delay + i * stagger,
              ease: [0.22, 1.4, 0.36, 1],
            }}
            style={{ display: 'block' }}
          >
            {line}
          </motion.span>
        </div>
      ))}
    </Tag>
  )
}

/**
 * FILM SEQUENCE
 * 
 * Stagger container for lists of items.
 * Each child animates with a film-like sequence.
 */

interface FilmSequenceProps {
  children: ReactNode
  stagger?: number
  delay?: number
  style?: React.CSSProperties
}

export function FilmSequence({ children, stagger = 0.06, delay = 0, style }: FilmSequenceProps) {
  const [visible, setVisible] = useState(false)
  const [ref, setRef] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!ref) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.05 }
    )
    observer.observe(ref)
    return () => observer.disconnect()
  }, [ref])

  return (
    <motion.div
      ref={setRef}
      animate={visible ? 'visible' : 'hidden'}
      initial="hidden"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: stagger,
            delayChildren: delay,
          },
        },
      }}
      style={style}
    >
      {children}
    </motion.div>
  )
}

/**
 * SEQUENCE CHILD
 * 
 * An individual item inside FilmSequence.
 */
export function SequenceChild({
  children,
  style,
}: {
  children: ReactNode
  style?: React.CSSProperties
}) {
  return (
    <motion.div
      variants={{
        hidden:  { opacity: 0, y: 12, filter: 'blur(1px)' },
        visible: {
          opacity: 1, y: 0, filter: 'blur(0px)',
          transition: { duration: 0.65, ease: [0.16, 1, 0.30, 1] },
        },
      }}
      style={style}
    >
      {children}
    </motion.div>
  )
}