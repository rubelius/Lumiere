'use client';
import { useState } from "react";
import { FINE_ART_EASE } from '@/lib/motion';
import Image from 'next/image';
import { motion, AnimatePresence } from "framer-motion";
import { Play, CheckCircle2, Bookmark, Plus, Heart, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { FestivalLaurels } from "@/components/movie/FestivalLaurels";


export const MovieSidebar = ({ movie, posterUrl, ytId, onPlayTrailer }: { movie: any, posterUrl: string, ytId: string | null, onPlayTrailer: () => void }) => {
  const router = useRouter();
  const [isCollectionOpen, setIsCollectionOpen] = useState(false);
  const [escolhaAberta, setEscolhaAberta] = useState(false);

  // Toca agora quer dizer duas coisas, e as duas servem: já há link na conta,
  // ou o acervo do Real-Debrid tem o arquivo e importar leva ~2 segundos.
  const tocaAgora = Boolean(movie.available_instantly || movie.cached_in_realdebrid);

  const projetar = () => {
    if (tocaAgora) {
      router.push(`/player?id=${movie.id}`);
      return;
    }
    // Sem nada imediato, começar a tocar seria prometer o que não se pode
    // cumprir. A escolha é do usuário, e as duas saídas têm custo diferente.
    setEscolhaAberta(true);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1, ease: FINE_ART_EASE }} style={{ width: '320px', flexShrink: 0 }}> 
      <motion.div whileHover={{ y: -5, boxShadow: '0 20px 60px rgba(0,0,0,1)' }} transition={{ duration: 0.4, ease: FINE_ART_EASE }} style={{ position: 'relative', aspectRatio: '2/3', backgroundColor: 'var(--void)', border: '1px solid rgba(191,143,60,0.3)', padding: '8px', marginBottom: '32px', overflow: 'hidden', boxShadow: '0 0 50px rgba(0,0,0,0.8)' }} className="group"> 
        <div style={{ position: 'relative', width: '100%', height: '100%', border: '1px solid rgba(86,84,80,0.3)', overflow: 'hidden' }}> 
          <Image src={posterUrl} alt="Poster" fill sizes="(max-width: 768px) 40vw, 300px" style={{ objectFit: 'cover', filter: 'contrast(110%) saturate(110%)', transition: 'all 0.7s' }} className="group-hover:scale-105" /> 
          <motion.div animate={{ y: ['-10%', '110%'] }} transition={{ repeat: Infinity, duration: 4, ease: 'linear' }} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '1px', backgroundColor: 'var(--gold)', boxShadow: '0 0 10px rgba(191,143,60,0.8)', opacity: 0 }} className="group-hover:opacity-100" /> 
        </div> 
        
        {ytId && (
          <motion.button  
            onClick={onPlayTrailer} 
            whileTap={{ scale: 0.9 }}
            style={{ position: 'absolute', inset: 0, margin: 'auto', width: '80px', height: '80px', backgroundColor: 'rgba(4,4,2,0.8)', border: '1px solid var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)', cursor: 'pointer', transition: 'all 0.4s', opacity: 0, backdropFilter: 'blur(8px)' }} 
            className="group-hover:opacity-100 hover:bg-[var(--gold)] hover:text-[var(--void)] hover:scale-110" 
          > 
            <Play style={{ width: 32, height: 32, marginLeft: '4px' }} fill="currentColor" /> 
          </motion.button> 
        )}
      </motion.div> 
        
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}> 
        <motion.button  
          onClick={projetar} 
          whileHover={{ backgroundColor: tocaAgora ? 'var(--gold)' : 'rgba(237,232,220,0.05)', color: tocaAgora ? 'var(--void)' : 'var(--film)', scale: 1.02 }} whileTap={{ scale: 0.98 }}  
          style={{ width: '100%', padding: '16px 0', backgroundColor: 'transparent', border: `1px solid ${tocaAgora ? 'var(--gold)' : 'var(--m3)'}`, color: tocaAgora ? 'var(--gold)' : 'var(--m2)', fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.2em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', cursor: 'pointer', transition: 'all 0.3s', position: 'relative' }} 
        > 
          {/* A pulsação era incondicional, e o botão prometia projeção
              imediata mesmo quando o player ia responder "nenhuma fonte
              disponível". Agora ela só acontece quando há de fato uma cópia
              que toca na hora. */}
          {tocaAgora && (
            <motion.div animate={{ opacity: [0, 0.5, 0], scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 2 }} style={{ position: 'absolute', inset: 0, border: '1px solid var(--gold)', pointerEvents: 'none' }} />
          )}
          <Play style={{ width: 16, height: 16 }} /> [ INICIAR PROJEÇÃO ] 
        </motion.button>

        <AnimatePresence>
          {escolhaAberta && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              style={{ border: '1px solid rgba(86,84,80,0.5)', backgroundColor: 'var(--void)', padding: '16px' }}
            >
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: 'var(--m3)', letterSpacing: '0.15em', lineHeight: 1.9, marginBottom: 16 }}>
                NENHUMA CÓPIA TOCA AGORA. O REAL-DEBRID NÃO TEM NENHUMA DELAS NO ACERVO.
              </div>
              <motion.button
                onClick={() => { setEscolhaAberta(false); router.push(`/movie/${movie.id}#copias`); }}
                whileHover={{ x: 4 }}
                style={{ width: '100%', textAlign: 'left', background: 'transparent', border: '1px solid rgba(191,143,60,0.4)', color: 'var(--gold)', padding: '12px 14px', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', cursor: 'pointer', marginBottom: 10, lineHeight: 1.8 }}
              >
                [ BAIXAR PARA O CACHE PRIMEIRO ]
                <div style={{ color: 'var(--m3)', fontSize: '8px', marginTop: 6 }}>
                  ESCOLHA UMA CÓPIA NA ABA 03 E IMPORTE. O REAL-DEBRID BAIXA, E DEPOIS TOCA SEM ENGASGO.
                </div>
              </motion.button>
              <div
                title="Ainda não construído"
                style={{ width: '100%', textAlign: 'left', border: '1px solid rgba(86,84,80,0.3)', color: 'var(--m3)', padding: '12px 14px', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', lineHeight: 1.8, opacity: 0.6 }}
              >
                [ TOCAR DIRETO DO TORRENT ]
                <div style={{ fontSize: '8px', marginTop: 6 }}>
                  AINDA NÃO EXISTE. EXIGE UM MOTOR DE TORRENT QUE SIRVA O ARQUIVO ENQUANTO BAIXA — E COM POUCOS SEMEADORES A REPRODUÇÃO TRAVA.
                </div>
              </div>
              <button
                onClick={() => setEscolhaAberta(false)}
                style={{ marginTop: 12, background: 'transparent', border: 'none', color: 'var(--m3)', fontFamily: "'DM Mono', monospace", fontSize: '8px', letterSpacing: '0.2em', cursor: 'pointer' }}
              >
                [ FECHAR ]
              </button>
            </motion.div>
          )}
        </AnimatePresence>
          
        <div style={{ position: 'relative' }}> 
          <motion.button  
            onClick={() => setIsCollectionOpen(!isCollectionOpen)} 
            whileHover={{ backgroundColor: 'rgba(237,232,220,0.05)', borderColor: 'var(--film)', color: 'var(--film)', scale: 1.02 }} whileTap={{ scale: 0.98 }} 
            style={{ width: '100%', padding: '16px 0', backgroundColor: 'var(--void)', border: '1px solid var(--m3)', color: 'var(--m2)', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', cursor: 'pointer', transition: 'all 0.3s' }} 
          > 
            {movie.in_plex ? <CheckCircle2 style={{ width: 16, height: 16, color: 'var(--gold)' }} /> : <Bookmark style={{ width: 16, height: 16 }} />} 
            {movie.in_plex ? '[ ARQUIVADO ]' : '[ CATALOGAR ]'} 
          </motion.button> 
          <AnimatePresence> 
            {isCollectionOpen && ( 
              <motion.div  
                initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }} transition={{ duration: 0.2 }} 
                style={{ position: 'absolute', top: '100%', left: 0, width: '100%', marginTop: '8px', backgroundColor: 'var(--void)', border: '1px solid rgba(191,143,60,0.5)', padding: '8px', zIndex: 50, boxShadow: '0 10px 40px rgba(0,0,0,0.8)' }} 
              > 
                <motion.button whileHover={{ x: 4, backgroundColor: 'rgba(191,143,60,0.1)' }} whileTap={{ scale: 0.98 }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', backgroundColor: 'transparent', border: 'none', color: 'var(--film)', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', cursor: 'pointer', textAlign: 'left', transition: 'background-color 0.2s' }}> 
                  <Heart style={{ width: 12, height: 12, color: 'var(--gold)' }} /> FAVORITOS 
                </motion.button> 
                <motion.button whileHover={{ x: 4, backgroundColor: 'rgba(191,143,60,0.1)' }} whileTap={{ scale: 0.98 }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', backgroundColor: 'transparent', border: 'none', color: 'var(--film)', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', cursor: 'pointer', textAlign: 'left', transition: 'background-color 0.2s' }}> 
                  <Clock style={{ width: 12, height: 12, color: 'var(--m2)' }} /> ASSISTIR DEPOIS 
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