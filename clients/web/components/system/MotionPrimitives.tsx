'use client'

import { motion, HTMLMotionProps } from 'framer-motion'
import { varProjector, varAmbient, ease, duration } from '@/lib/motion'
import { ReactNode } from 'react'

interface MotionProps extends HTMLMotionProps<"div"> {
  children: ReactNode
  delay?: number
  className?: string
  as?: any // Framer Motion component type
}

/**
 * THE PROJECTOR
 * Content emerges from the void with a slight blur and upward drift.
 * Use for cards, metadata blocks, and standard UI reveals.
 */
export function ProjectorReveal({ 
  children, 
  delay = 0, 
  className,
  ...props 
}: MotionProps) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-10%" }} // Triggers slightly before entering frame
      variants={varProjector}
      custom={delay}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  )
}

/**
 * EDITORIAL TEXT REVEAL
 * Masks text and slides it up from an invisible baseline. 
 * Mimics a physical film print running through a projector gate.
 * Use STRICTLY for H1/H2 titles.
 */
interface EditorialTextProps {
  lines: string[]
  delay?: number
  className?: string
  stagger?: number
  tag?: 'h1' | 'h2' | 'h3' | 'p'
}

export function EditorialTextReveal({ 
  lines, 
  delay = 0, 
  className, 
  stagger = 0.12,
  tag = 'h1'
}: EditorialTextProps) {
  const Tag = tag

  return (
    <Tag className={className}>
      {lines.map((line, i) => (
        <div key={i} className="overflow-hidden leading-[1.05]">
          <motion.div
            initial={{ y: '105%', opacity: 0, rotateZ: 1.5 }}
            whileInView={{ y: '0%', opacity: 1, rotateZ: 0 }}
            viewport={{ once: true }}
            transition={{
              duration: duration.scene,
              delay: delay + (i * stagger),
              ease: ease.projector,
            }}
            className="origin-bottom-left block"
          >
            {line}
          </motion.div>
        </div>
      ))}
    </Tag>
  )
}

/**
 * AMBIENT MOTION
 * Slow, barely perceptible fades for background elements.
 */
export function SlowBurn({ children, className, ...props }: MotionProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={varAmbient}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  )
}

/**
 * FILM SEQUENCE
 * Staggers a list of children automatically. 
 * Use for rows of sessions or archive lists.
 */
export function FilmSequence({ children, delay = 0, className }: MotionProps) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-5%" }}
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: 0.06,
            delayChildren: delay,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/**
 * SEQUENCE CHILD
 * An individual item inside a FilmSequence.
 */
export function SequenceChild({ children, className }: { children: ReactNode, className?: string }) {
  return (
    <motion.div
      variants={{
        hidden:  { opacity: 0, y: 12, filter: 'blur(1px)' },
        visible: {
          opacity: 1, y: 0, filter: 'blur(0px)',
          transition: { duration: 0.65, ease: ease.dolly },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}