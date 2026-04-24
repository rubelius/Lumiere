'use client'

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

/* ============================================
   QUALITY BADGE (Refined)
   ============================================ */

type QualityType = "REMUX" | "ATMOS" | "4K" | "HDR" | "DV"

interface QualityBadgeProps {
  type: QualityType
  size?: "sm" | "md"
  className?: string
}

const qualityConfig: Record<QualityType, { color: string; label: string }> = {
  REMUX: { 
    color: "bg-success/10 text-success border-success/20", 
    label: "REMUX" 
  },
  ATMOS: { 
    color: "bg-[#8B5CF6]/10 text-[#8B5CF6] border-[#8B5CF6]/20", 
    label: "ATMOS" 
  },
  "4K": { 
    color: "bg-accent-500/10 text-accent-500 border-accent-500/20", 
    label: "4K" 
  },
  HDR: { 
    color: "bg-error/10 text-error border-error/20", 
    label: "HDR" 
  },
  DV: { 
    color: "bg-[#A855F7]/10 text-[#A855F7] border-[#A855F7]/20", 
    label: "DV" 
  },
}

export function QualityBadge({ type, size = "sm", className }: QualityBadgeProps) {
  const config = qualityConfig[type]
  
  return (
    <motion.span
      whileHover={{ scale: 1.05 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "inline-flex items-center justify-center",
        "px-2 py-1",
        "text-xs font-bold uppercase tracking-wider",
        "rounded-md border backdrop-blur-sm",
        "transition-all duration-200",
        config.color,
        size === "md" && "px-3 py-1.5 text-sm",
        className
      )}
    >
      {config.label}
    </motion.span>
  )
}

/* ============================================
   MOVIE CARD (World-Class)
   ============================================ */

interface MovieCardProps {
  id: string | number
  title: string
  year?: string
  imageUrl: string
  qualities?: QualityType[]
  className?: string
  index?: number
  priority?: boolean
}

export function MovieCard({ 
  id, 
  title, 
  year, 
  imageUrl, 
  qualities = [], 
  className = "", 
  index = 0,
  priority = false
}: MovieCardProps) {
  const [imageLoaded, setImageLoaded] = React.useState(false)
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.5, 
        delay: index * 0.08,
        ease: [0.4, 0.0, 0.2, 1] 
      }}
      className={cn("h-full", className)}
    >
      <Link 
        href={`/movie/${id}`}
        className="group relative block aspect-[2/3] rounded-xl overflow-hidden bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-100 transition-all duration-300 w-full h-full"
        data-testid={`card-movie-${id}`}
      >
        {/* Image Container */}
        <div className="absolute inset-0">
          {/* Skeleton Loader */}
          {!imageLoaded && (
            <div className="absolute inset-0 bg-neutral-300 animate-pulse z-0" />
          )}
          
          {/* Next.js Image */}
          <Image 
            src={imageUrl} 
            alt={`${title} (${year}) poster`}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw"
            priority={priority || index < 4}
            className={cn(
              "object-cover transition-all duration-700 ease-out z-10",
              "group-hover:scale-105 group-focus-visible:scale-105",
              !imageLoaded ? "opacity-0" : "opacity-100"
            )}
            onLoad={() => setImageLoaded(true)}
          />
          
          {/* Subtle gradient overlays */}
          <div className="absolute inset-0 z-20 pointer-events-none bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-60 group-hover:opacity-40 transition-opacity duration-500" />
          <div className="absolute inset-0 z-20 pointer-events-none bg-gradient-to-b from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        </div>
        
        {/* Quality Badges - Top Right */}
        {qualities.length > 0 && (
          <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-30">
            {qualities.map((quality) => (
              <QualityBadge key={quality} type={quality} />
            ))}
          </div>
        )}
        
        {/* Content - Bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-4 transform translate-y-1 group-hover:translate-y-0 group-focus-visible:translate-y-0 transition-transform duration-500 ease-out z-30">
          <h3 className="font-heading text-lg font-semibold text-white mb-1 line-clamp-2 leading-snug drop-shadow-lg">
            {title}
          </h3>
          {year && (
            <p className="text-sm text-accent-500 font-medium">
              {year}
            </p>
          )}
        </div>
        
        {/* Subtle border */}
        <div className="absolute inset-0 z-40 border border-neutral-400/20 group-hover:border-neutral-500/40 group-focus-visible:border-primary-400/50 rounded-xl transition-colors duration-500 pointer-events-none" />
      </Link>
    </motion.div>
  )
}

/* ============================================
   SKELETON (LOADING STATE)
   ============================================ */

export function MovieCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("aspect-[2/3] rounded-xl overflow-hidden bg-neutral-200 animate-pulse", className)}>
      <div className="h-full w-full bg-neutral-300" />
    </div>
  )
}

/* ============================================
   LARGE FEATURED CARD (Hero Variant)
   ============================================ */

interface FeaturedMovieCardProps extends MovieCardProps {
  description?: string
  watchProgress?: number
}

export function FeaturedMovieCard({
  id,
  title,
  year,
  imageUrl,
  qualities = [],
  description,
  watchProgress,
  className = "",
  index = 0
}: FeaturedMovieCardProps) {
  const [imageLoaded, setImageLoaded] = React.useState(false)
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.5, 
        delay: index * 0.08 
      }}
      className={cn("h-full", className)}
    >
      <Link
        href={`/movie/${id}`}
        className="group relative block aspect-video rounded-2xl overflow-hidden bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-100 transition-all duration-300"
      >
        {/* Image Container */}
        <div className="absolute inset-0">
          {!imageLoaded && (
            <div className="absolute inset-0 bg-neutral-300 animate-pulse z-0" />
          )}
          
          <Image 
            src={imageUrl}
            alt={`${title} (${year}) backdrop`}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            priority={index < 2}
            className={cn(
              "object-cover transition-transform duration-700 ease-out z-10",
              "group-hover:scale-105",
              !imageLoaded ? "opacity-0" : "opacity-100"
            )}
            onLoad={() => setImageLoaded(true)}
          />
          
          <div className="absolute inset-0 z-20 pointer-events-none bg-gradient-to-t from-black via-black/40 to-transparent opacity-80 group-hover:opacity-70 transition-opacity duration-500" />
        </div>
        
        {/* Quality Badges */}
        {qualities.length > 0 && (
          <div className="absolute top-4 right-4 flex gap-2 z-30">
            {qualities.map((quality) => (
              <QualityBadge key={quality} type={quality} size="md" />
            ))}
          </div>
        )}
        
        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-6 z-30">
          <div className="max-w-2xl">
            <h3 className="font-heading text-2xl font-semibold text-white mb-2 line-clamp-2 drop-shadow-lg">
              {title}
            </h3>
            
            {description && (
              <p className="text-neutral-900 text-base line-clamp-2 mb-3 leading-relaxed">
                {description}
              </p>
            )}
            
            <div className="flex items-center gap-4">
              {year && (
                <span className="text-sm text-accent-500 font-medium">
                  {year}
                </span>
              )}
              
              {watchProgress !== undefined && (
                <div className="flex items-center gap-2">
                  <div className="h-1 w-32 bg-neutral-500 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary-400 transition-all duration-300"
                      style={{ width: `${watchProgress}%` }}
                    />
                  </div>
                  <span className="text-xs text-neutral-800 font-medium">
                    {watchProgress}%
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Border */}
        <div className="absolute inset-0 z-40 border border-neutral-400/20 group-hover:border-neutral-500/40 rounded-2xl transition-colors duration-500 pointer-events-none" />
      </Link>
    </motion.div>
  )
}

