/**
 * LUMIÈRE MOTION SYSTEM
 * 
 * Core motion language for the entire product.
 * Every animation in the UI derives from these principles.
 * 
 * Philosophy: Motion as cinematography, not decoration.
 * The interface behaves like a directed film — cuts are intentional,
 * reveals are choreographed, ambient life is always present.
 */

// ─────────────────────────────────────────────────────────────
// 1. EASING CURVES
// Named after their cinematic analogs
// ─────────────────────────────────────────────────────────────

export const ease = {
  // "Dolly In" — slow start, confident arrival
  // Use: element entries, page transitions
  dolly: [0.16, 1, 0.30, 1] as const,

  // "Cut" — instant. Hard edit.
  // Use: major navigation transitions
  cut: [0.00, 0.00, 1.00, 1.00] as const,

  // "Focus Pull" — anticipation then snap
  // Use: TV focus changes, hover effects
  focusPull: [0.34, 1.56, 0.64, 1] as const,

  // "Slow Burn" — barely perceptible movement
  // Use: ambient background layers
  burn: [0.25, 0.10, 0.10, 1.00] as const,

  // "Projector" — snap open, drift close
  // Use: content reveals
  projector: [0.22, 1.4, 0.36, 1] as const,

  // "Pan" — smooth, weighted, continuous
  // Use: horizontal scroll, parallax
  pan: [0.45, 0.00, 0.55, 1.00] as const,
} as const

// ─────────────────────────────────────────────────────────────
// 2. DURATIONS
// Measured in film terms (24fps reference)
// ─────────────────────────────────────────────────────────────

export const duration = {
  instant:  0.0,   // 0 frames — hard cut
  flash:    0.08,  // 2 frames — subliminal
  snap:     0.15,  // ~4 frames — click feedback
  beat:     0.25,  // 6 frames — UI response
  phrase:   0.45,  // 11 frames — element transition
  sentence: 0.70,  // 17 frames — section reveal
  scene:    1.10,  // 26 frames — major transition
  slow:     1.80,  // 43 frames — ambient, deliberate
  breath:   3.50,  // 84 frames — background life
} as const

// ─────────────────────────────────────────────────────────────
// 3. SPRING CONFIGS
// Tuned for physical, not mechanical feel
// ─────────────────────────────────────────────────────────────

export const spring = {
  // TV focus ring — bouncy, physical, aware
  focus: {
    type: 'spring' as const,
    stiffness: 380,
    damping: 28,
    mass: 0.8,
  },

  // Content entry — weighted, cinematic
  content: {
    type: 'spring' as const,
    stiffness: 200,
    damping: 30,
    mass: 1.2,
  },

  // Hover micro — fast, precise
  hover: {
    type: 'spring' as const,
    stiffness: 500,
    damping: 35,
    mass: 0.5,
  },

  // Page transition — slow, majestic
  page: {
    type: 'spring' as const,
    stiffness: 100,
    damping: 25,
    mass: 1.5,
  },
} as const

// ─────────────────────────────────────────────────────────────
// 4. MOTION VARIANTS
// Reusable animation states for Framer Motion
// ─────────────────────────────────────────────────────────────

// The Projector: content emerges from void
export const varProjector = {
  hidden: {
    opacity: 0,
    y: 24,
    filter: 'blur(3px)',
  },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: duration.sentence,
      delay: i * 0.08,
      ease: ease.dolly,
    },
  }),
  exit: {
    opacity: 0,
    y: -12,
    filter: 'blur(2px)',
    transition: {
      duration: duration.phrase,
      ease: ease.pan,
    },
  },
}

// Film Cut: instant arrival, no easing
export const varCut = {
  hidden: { opacity: 0, clipPath: 'inset(0 100% 0 0)' },
  visible: {
    opacity: 1,
    clipPath: 'inset(0 0% 0 0)',
    transition: { duration: duration.phrase, ease: ease.cut },
  },
  exit: {
    opacity: 0,
    clipPath: 'inset(0 0 0 100%)',
    transition: { duration: duration.beat, ease: ease.cut },
  },
}

// Reveal: text emerges from below a mask (editorial style)
export const varReveal = {
  hidden: { y: '105%', opacity: 0 },
  visible: (i: number = 0) => ({
    y: '0%',
    opacity: 1,
    transition: {
      duration: duration.scene,
      delay: i * 0.12,
      ease: ease.projector,
    },
  }),
}

// Stagger container
export const varStagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.1,
    },
  },
}

// Fade frame: background/ambient elements
export const varAmbient = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: duration.slow, ease: ease.burn },
  },
}

// Scale focus: TV focus state
export const varFocus = {
  unfocused: {
    scale: 1,
    borderColor: 'rgba(237,232,220,0.06)',
    transition: spring.focus,
  },
  focused: {
    scale: 1.02,
    borderColor: 'rgba(191,143,60,0.5)',
    transition: spring.focus,
  },
}

// ─────────────────────────────────────────────────────────────
// 5. PAGE TRANSITION SYSTEM
// Each page has a cinematic entry/exit persona
// ─────────────────────────────────────────────────────────────

export type TransitionMode = 'dolly' | 'cut' | 'pan-left' | 'pan-right' | 'fade'

export const pageTransitions: Record<TransitionMode, {
  initial: object
  animate: object
  exit: object
  transition: object
}> = {
  // Home: grand reveal — from bottom
  dolly: {
    initial: { opacity: 0, y: 32 },
    animate: { opacity: 1, y: 0 },
    exit:    { opacity: 0, y: -16 },
    transition: { duration: duration.scene, ease: ease.dolly },
  },

  // Cut: instant — no ceremony
  cut: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit:    { opacity: 0 },
    transition: { duration: duration.flash, ease: ease.cut },
  },

  // Pan left: move to a deeper section
  'pan-left': {
    initial: { opacity: 0, x: 40 },
    animate: { opacity: 1, x: 0 },
    exit:    { opacity: 0, x: -40 },
    transition: { duration: duration.sentence, ease: ease.pan },
  },

  // Pan right: move back
  'pan-right': {
    initial: { opacity: 0, x: -40 },
    animate: { opacity: 1, x: 0 },
    exit:    { opacity: 0, x: 40 },
    transition: { duration: duration.sentence, ease: ease.pan },
  },

  // Fade: neutral transition
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit:    { opacity: 0 },
    transition: { duration: duration.phrase, ease: ease.burn },
  },
}

// ─────────────────────────────────────────────────────────────
// 6. AMBIENT MOTION SEQUENCES
// For background life — slow, non-distracting
// ─────────────────────────────────────────────────────────────

// Gold hairline pulse — on the nav strip
export const hairlinePulse = {
  animate: {
    opacity: [0.28, 0.45, 0.28],
    transition: {
      duration: 4,
      repeat: Infinity,
      ease: ease.burn,
    },
  },
}

// Background radial shift — warm light moving slowly
export const backgroundDrift = {
  animate: {
    backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'],
    transition: {
      duration: 20,
      repeat: Infinity,
      ease: 'linear',
    },
  },
}

// Grain shimmer — film grain opacity modulation
export const grainShimmer = {
  animate: {
    opacity: [0.035, 0.055, 0.030, 0.048, 0.035],
    transition: {
      duration: 0.8,
      repeat: Infinity,
      ease: 'linear',
    },
  },
}

// ─────────────────────────────────────────────────────────────
// 7. INTERACTION TIMING
// How long before intent is registered
// ─────────────────────────────────────────────────────────────

export const intentDelay = {
  hover:   150,  // ms before hover triggers preview
  press:   80,   // ms for press feedback
  release: 200,  // ms for release spring-back
  focus:   0,    // ms for focus — instant
}

// ─────────────────────────────────────────────────────────────
// 8. UTILITY
// ─────────────────────────────────────────────────────────────

/** Create a stagger delay for list items */
export const staggerDelay = (index: number, base = 0.06) => index * base

/** Combine a spring with a specific property */
export const springTransition = (
  stiffness: number,
  damping: number,
  delay = 0
) => ({
  type: 'spring' as const,
  stiffness,
  damping,
  delay,
})

/** Check if reduced motion is preferred */
export const prefersReducedMotion = () =>
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false