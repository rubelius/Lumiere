'use client'
import { QualityBadge } from "./quality-badge";
import Link from "next/link";
import { motion } from "framer-motion";

interface MovieCardProps {
  id: string | number;
  title: string;
  year?: string;
  imageUrl: string;
  qualities?: ("REMUX" | "ATMOS" | "4K" | "HDR")[];
  className?: string;
  index?: number;
}

export function MovieCard({ id, title, year, imageUrl, qualities = [], className = "", index = 0 }: MovieCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: [0.21, 1.11, 0.81, 0.99] }}
      className={className}
    >
      <Link 
        href={`/movie/${id}`}
        className={`group relative block aspect-2/3 rounded-2xl overflow-hidden bg-card movie-card focus:outline-none w-full h-full`}
        data-testid={`card-movie-${id}`}
      >
        <img 
          src={imageUrl} 
          alt={title} 
          className="absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-out group-hover:scale-110 group-focus:scale-110 group-hover:rotate-1"
        />
        
        {/* Subtle noise overlay */}
        <div className="absolute inset-0 bg-noise mix-blend-overlay opacity-20 pointer-events-none" />
        
        {/* Richer Gradient Overlay */}
        <div className="absolute inset-0 bg-linear-to-t from-black via-black/50 to-transparent opacity-80 group-hover:opacity-90 transition-opacity duration-500" />
        <div className="absolute inset-0 bg-linear-to-b from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        {/* Quality Badges - Top Right */}
        <div className="absolute top-4 right-4 flex flex-col gap-2 items-end opacity-90 group-hover:opacity-100 group-focus:opacity-100 transition-all duration-500 transform -translate-y-2.5 group-hover:translate-y-0">
          {qualities.map((q, i) => (
            <motion.div 
              key={q}
              initial={false}
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.2 }}
            >
              <QualityBadge type={q} compact />
            </motion.div>
          ))}
        </div>

        {/* Content - Bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-6 transform translate-y-4 group-hover:translate-y-0 group-focus:translate-y-0 transition-transform duration-500 ease-out">
          <h3 className="font-serif text-2xl text-white font-medium line-clamp-2 text-glow leading-snug drop-shadow-lg">{title}</h3>
          {year && (
            <p className="text-primary/90 font-medium text-sm mt-2 uppercase tracking-widest">{year}</p>
          )}
        </div>
        
        {/* Inner border for depth */}
        <div className="absolute inset-0 border border-white/10 rounded-2xl pointer-events-none group-hover:border-white/20 transition-colors duration-500" />
      </Link>
    </motion.div>
  );
}
