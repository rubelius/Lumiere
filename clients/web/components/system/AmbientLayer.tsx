'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

/**
 * AMBIENT LAYER
 * 
 * The layer that makes the UI feel ALIVE.
 * Always present, never distracting.
 * 
 * Layers (bottom to top):
 * 1. Deep void gradient — shifts slowly with mouse
 * 2. Warm projector bloom — radial, drifts
 * 3. Film grain — subtle opacity oscillation
 * 4. Scan lines — barely visible
 * 
 * This is NOT decorative — it creates the cinema atmosphere
 * that makes everything above it feel immersive.
 */

export function AmbientLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef({ x: 0.5, y: 0.5 })
  const frameRef = useRef<number>(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    const handleMouse = (e: MouseEvent) => {
      mouseRef.current = {
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      }
    }
    window.addEventListener('mousemove', handleMouse, { passive: true })
    return () => window.removeEventListener('mousemove', handleMouse)
  }, [])

  // Film grain canvas
  useEffect(() => {
    if (!mounted) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let time = 0

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const drawGrain = () => {
      const { width, height } = canvas

      // Clear
      ctx.clearRect(0, 0, width, height)

      // Generate grain — only on a portion for performance
      const imageData = ctx.createImageData(width, height)
      const data = imageData.data

      // Time-varying opacity for shimmer
      const opacity = 7 + Math.sin(time * 0.8) * 2 + Math.sin(time * 1.3) * 1.5

      for (let i = 0; i < data.length; i += 4) {
        const noise = Math.random() * 255
        data[i]     = noise  // R
        data[i + 1] = noise  // G
        data[i + 2] = Math.round(noise * 0.95) // B — slight warm tint
        data[i + 3] = opacity
      }

      ctx.putImageData(imageData, 0, 0)
      time += 0.016

      frameRef.current = requestAnimationFrame(drawGrain)
    }

    drawGrain()

    return () => {
      cancelAnimationFrame(frameRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [mounted])

  if (!mounted) return null

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Layer 1: Deep void — mouse-responsive warmth */}
      <motion.div
        animate={{
          background: [
            'radial-gradient(ellipse 80% 60% at 20% 30%, rgba(14,10,6,0.8) 0%, transparent 70%)',
            'radial-gradient(ellipse 80% 60% at 80% 70%, rgba(14,10,6,0.8) 0%, transparent 70%)',
            'radial-gradient(ellipse 80% 60% at 20% 30%, rgba(14,10,6,0.8) 0%, transparent 70%)',
          ]
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: 'linear',
        }}
        style={{
          position: 'absolute',
          inset: 0,
          background: '#080806',
        }}
      />

      {/* Layer 2: Warm projector bloom */}
      <motion.div
        animate={{
          opacity: [0.04, 0.07, 0.04, 0.06, 0.04],
          scale: [1, 1.08, 1, 1.05, 1],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 50% 40% at 50% 50%, rgba(191,143,60,1) 0%, transparent 70%)',
          mixBlendMode: 'screen',
        }}
      />

      {/* Layer 3: Film grain */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          mixBlendMode: 'overlay',
          opacity: 1,
        }}
      />

      {/* Layer 4: Scan lines — barely there */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'repeating-linear-gradient(0deg, rgba(4,4,2,0.03) 0px, rgba(4,4,2,0.03) 1px, transparent 1px, transparent 4px)',
          mixBlendMode: 'multiply',
        }}
      />
    </div>
  )
}

/**
 * POSTER HOVER REVEAL
 * 
 * The floating poster that follows cursor on hover.
 * Creates a physical sense of the film's presence.
 * Motion: spring physics, follows cursor with lag.
 */

interface PosterRevealProps {
  src: string
  visible: boolean
  mouseX: number
  mouseY: number
}

export function PosterReveal({ src, visible, mouseX, mouseY }: PosterRevealProps) {
  return (
    <motion.div
      animate={{
        opacity: visible ? 1 : 0,
        scale: visible ? 1 : 0.88,
        filter: visible ? 'blur(0px)' : 'blur(4px)',
      }}
      transition={{
        opacity: { duration: 0.2, ease: [0.16, 1, 0.30, 1] },
        scale:   { type: 'spring', stiffness: 400, damping: 30 },
        filter:  { duration: 0.2 },
      }}
      style={{
        position: 'fixed',
        left: mouseX + 24,
        top: mouseY - 80,
        width: 90,
        height: 135,
        zIndex: 9999,
        pointerEvents: 'none',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(4,4,2,0.85)',
        borderRadius: 1,
      }}
    >
      <img
        src={src}
        alt=""
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          filter: 'saturate(0.72) contrast(1.1)',
          display: 'block',
        }}
      />
    </motion.div>
  )
}