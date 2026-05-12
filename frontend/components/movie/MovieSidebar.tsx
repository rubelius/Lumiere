'use client';
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, CheckCircle2, Bookmark, Plus, Heart, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { FestivalLaurels } from "@/components/movie/FestivalLaurels";

const FINE_ART_EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

export const MovieSidebar = ({ movie, posterUrl, ytId, onPlayTrailer }: { movie: any, posterUrl: string, ytId: string | null, onPlayTrailer: () => void }) => {
  const router = useRouter();
  const [isCollectionOpen, setIsCollectionOpen] = useState(false); 

  return (
    <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1, ease: FINE_ART_EASE }} style={{ width: '320px', flexShrink: 0 }}> 
      <motion.div whileHover={{ y: -5, boxShadow: '0 20px 60px rgba(0,0,0,1)' }} transition={{ duration: 0.4, ease: FINE_ART_EASE }} style={{ position: 'relative', aspectRatio: '2/3', backgroundColor: '#040402', border: '1px solid rgba(191,143,60,0.3)', padding: '8px', marginBottom: '32px', overflow: 'hidden', boxShadow: '0 0 50px rgba(0,0,0,0.8)' }} className="group"> 
        <div style={{ position: 'relative', width: '100%', height: '100%', border: '1px solid rgba(86,84,80,0.3)', overflow: 'hidden' }}> 
          <img src={posterUrl} alt="Poster" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'contrast(110%) saturate(110%)', transition: 'all 0.7s' }} className="group-hover:scale-105" /> 
          <motion.div animate={{ y: ['-10%', '110%'] }} transition={{ repeat: Infinity, duration: 4, ease: 'linear' }} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '1px', backgroundColor: '#BF8F3C', boxShadow: '0 0 10px rgba(191,143,60,0.8)', opacity: 0 }} className="group-hover:opacity-100" /> 
        </div> 
        
        {ytId && (
          <motion.button  
            onClick={onPlayTrailer} 
            whileTap={{ scale: 0.9 }}
            style={{ position: 'absolute', inset: 0, margin: 'auto', width: '80px', height: '80px', backgroundColor: 'rgba(4,4,2,0.8)', border: '1px solid #BF8F3C', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#BF8F3C', cursor: 'pointer', transition: 'all 0.4s', opacity: 0, backdropFilter: 'blur(8px)' }} 
            className="group-hover:opacity-100 hover:bg-[#BF8F3C] hover:text-[#040402] hover:scale-110" 
          > 
            <Play style={{ width: 32, height: 32, marginLeft: '4px' }} fill="currentColor" /> 
          </motion.button> 
        )}
      </motion.div> 
        
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}> 
        <motion.button  
          onClick={() => router.push('/player')} 
          whileHover={{ backgroundColor: '#BF8F3C', color: '#040402', scale: 1.02, boxShadow: '0 0 20px rgba(191,143,60,0.4)' }} whileTap={{ scale: 0.98 }}  
          style={{ width: '100%', padding: '16px 0', backgroundColor: 'transparent', border: '1px solid #BF8F3C', color: '#BF8F3C', fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.2em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', cursor: 'pointer', transition: 'all 0.3s', position: 'relative' }} 
        > 
          <motion.div animate={{ opacity: [0, 0.5, 0], scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 2 }} style={{ position: 'absolute', inset: 0, border: '1px solid #BF8F3C', pointerEvents: 'none' }} />
          <Play style={{ width: 16, height: 16 }} /> [ INICIAR PROJEÇÃO ] 
        </motion.button> 
          
        <div style={{ position: 'relative' }}> 
          <motion.button  
            onClick={() => setIsCollectionOpen(!isCollectionOpen)} 
            whileHover={{ backgroundColor: 'rgba(237,232,220,0.05)', borderColor: '#EDE8DC', color: '#EDE8DC', scale: 1.02 }} whileTap={{ scale: 0.98 }} 
            style={{ width: '100%', padding: '16px 0', backgroundColor: '#040402', border: '1px solid #565450', color: '#8C8880', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', cursor: 'pointer', transition: 'all 0.3s' }} 
          > 
            {movie.in_plex ? <CheckCircle2 style={{ width: 16, height: 16, color: '#BF8F3C' }} /> : <Bookmark style={{ width: 16, height: 16 }} />} 
            {movie.in_plex ? '[ ARQUIVADO ]' : '[ CATALOGAR ]'} 
          </motion.button> 
          <AnimatePresence> 
            {isCollectionOpen && ( 
              <motion.div  
                initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }} transition={{ duration: 0.2 }} 
                style={{ position: 'absolute', top: '100%', left: 0, width: '100%', marginTop: '8px', backgroundColor: '#040402', border: '1px solid rgba(191,143,60,0.5)', padding: '8px', zIndex: 50, boxShadow: '0 10px 40px rgba(0,0,0,0.8)' }} 
              > 
                <motion.button whileHover={{ x: 4, backgroundColor: 'rgba(191,143,60,0.1)' }} whileTap={{ scale: 0.98 }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', backgroundColor: 'transparent', border: 'none', color: '#EDE8DC', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', cursor: 'pointer', textAlign: 'left', transition: 'background-color 0.2s' }}> 
                  <Heart style={{ width: 12, height: 12, color: '#BF8F3C' }} /> FAVORITOS 
                </motion.button> 
                <motion.button whileHover={{ x: 4, backgroundColor: 'rgba(191,143,60,0.1)' }} whileTap={{ scale: 0.98 }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', backgroundColor: 'transparent', border: 'none', color: '#EDE8DC', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', cursor: 'pointer', textAlign: 'left', transition: 'background-color 0.2s' }}> 
                  <Clock style={{ width: 12, height: 12, color: '#8C8880' }} /> ASSISTIR DEPOIS 
                </motion.button> 
              </motion.div> 
            )} 
          </AnimatePresence> 
        </div> 
      </div> 

      <div className="mt-8">
        <FestivalLaurels awards={movie.awards || movie.festivals || []} />
      </div>

    </motion.div> 
  );
};