'use client';
import { motion } from "framer-motion";

const FINE_ART_EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

export const MovieHero = ({ ytId, backgroundUrl }: { ytId: string | null, backgroundUrl: string }) => {
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '85vh', zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {ytId ? (
        <iframe
          src={`https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&loop=1&playlist=${ytId}&controls=0&showinfo=0&rel=0&iv_load_policy=3&disablekb=1`}
          style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) scale(1.5)', width: '100vw', height: '100vh', border: 'none', filter: 'grayscale(100%) contrast(125%) opacity(0.3)', mixBlendMode: 'luminosity' }}
          allow="autoplay; encrypted-media"
        />
      ) : (
        <motion.img
          initial={{ scale: 1.1, opacity: 0 }} animate={{ scale: 1.05, opacity: 0.25 }}
          transition={{ scale: { duration: 20, ease: "linear", repeat: Infinity, repeatType: "reverse" }, opacity: { duration: 1.5, ease: FINE_ART_EASE } }}
          src={backgroundUrl}
          style={{ width: '100%', height: '100%', objectFit: 'cover', mixBlendMode: 'luminosity', filter: 'grayscale(100%) contrast(125%)' }} alt=""
        />
      )}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #080806 0%, rgba(8,8,6,0.8) 40%, transparent 100%)' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, #080806 0%, rgba(8,8,6,0.5) 40%, transparent 100%)' }} />
    </div>
  );
};