'use client'

import { HeroProgramme } from '@/components/home/HeroProgramme'
import { CinemaMarquee, FilmProgramme, FilmEntry } from '@/components/home/FilmProgramme'
import { NowProjecting, AdmitOne, LibraryCount, SessionRow} from '@/components/home/Sections'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useState } from 'react'

/* ─────────────────────────────────────────────────────────────
   HOME PAGE
   
   Section sequence (deliberate rhythm):
   
   1. HERO — Full viewport. Dominant. Poster bleeds right.
   2. MARQUEE — Breathing pause. Film titles scroll past.
   3. PROGRAMME — The main list. Archival, editorial. 
   4. NOW PROJECTING — Continue watching. Screen metaphor.
   5. ADMIT ONE — Session ticket. Siena.film tribute.
   6. LIBRARY COUNT — Silence + scale. A single giant number.
   7. FOOTER — Minimal stamp.
   ───────────────────────────────────────────────────────────── */


const FEATURED_FILMS: FilmEntry[] = [
  {
    id: 1, number: '001',
    title: 'L\'Avventura', originalTitle: 'L\'Avventura',
    director: 'Antonioni', year: '1960', country: 'IT',
    runtime: '143m', qualities: ['REMUX', '4K'],
    posterSrc: '/images/posters/lavventura.jpg', 
    backgroundSrc: '/images/backgrounds/lavventura.jpg', genre: 'Drama',
    synopsis: 'Uma mulher desaparece no meio de uma viagem de barco no Mediterrâneo. Durante a busca pela mulher, seu namorado e sua melhor amiga ficam atraídos um pelo outro. Um grupo de ricos italianos saem numa viagem de iate para uma ilha vulcânica deserta no Mediterrâneo. Quando eles estão prestes a deixar a ilha eles se dão conta de que Anna, o personagem principal até este ponto, desapareceu. Sandro, o namorado de Anna, e Claudia, a amiga de Anna, tentam sem sucesso encontrá-la. Enquanto procuravam a amiga desaparecido, Claudia e Sandro desenvolvem uma atração entre eles. Quando voltam à terra continuam a busca sem sucesso. Sandro e Claudia se tornam amantes, e quase esquecem a Anna desaparecida.'
  },
  {
    id: 2, number: '002',
    title: 'Stalker', originalTitle: 'Сталкер',
    director: 'Tarkovsky', year: '1979', country: 'USSR',
    runtime: '162m', qualities: ['REMUX'],
    posterSrc: '/images/posters/stalker.jpg',
    backgroundSrc: '/images/backgrounds/stalker.jpg', genre: 'Sci-Fi',
    synopsis: 'Um misterioso acidente deixou um lugar inabitável. Para evitar a aproximação de curiosos o lugar foi isolado e é protegido por soldados o tempo todo, sendo conhecido como A Zona. Existe a promessa de que em algum lugar da Zona há um quarto onde o desejo de qualquer pessoa será realizado, mas o caminho até ele está cheio de armadilhas, e apenas os homens conhecidos como Stalkers são capazes de guiar outros homens até lá.'
  },
  {
    id: 3, number: '003',
    title: 'Persona',
    director: 'Bergman', year: '1966', country: 'SE',
    runtime: '85m', qualities: ['REMUX', '4K'],
    posterSrc: '/images/posters/persona.jpg',
    backgroundSrc: '/images/backgrounds/persona.jpg', genre: 'Drama',
    synopsis: 'Uma atriz teatral de sucesso sofre uma crise emocional e para de falar. Uma enfermeira é designada a cuidar dela em uma casa reclusa, perto da praia, onde as duas permanecem sozinhas. Para quebrar o silêncio, a enfermeira começa a falar incessantemente, narrando diversos episódios relevantes de sua vida, mas quando descobre que a atriz usa seus depoimentos como fonte de análise, a cumplicidade entre as duas se transforma em embate.'
  },
  {
    id: 4, number: '004',
    title: 'Barry Lyndon',
    director: 'Kubrick', year: '1975', country: 'UK',
    runtime: '185m', qualities: ['4K', 'HDR'],
    posterSrc: '/images/posters/barry-lyndon.jpg',
    backgroundSrc: '', genre: 'Period Drama',
    synopsis: ''
  },
  {
    id: 5, number: '005',
    title: 'Jeanne Dielman', originalTitle: 'Jeanne Dielman, 23, quai du Commerce',
    director: 'Akerman', year: '1975', country: 'BE',
    runtime: '201m', qualities: ['REMUX'],
    posterSrc: '/images/posters/jeanne-dilman.jpg',
    backgroundSrc: '', genre: 'Drama',
    synopsis: 'Considerado como a obra-prima de Akerman, traz a atriz Delphine Seyrig no papel de Jeanne Dielman, uma jovem viúva que vive com seu filho Sylvain seguindo uma ordem imutável: à tarde, enquanto seu filho está na escola, ela cuida do apartamento e recebe os clientes.'
  },
  {
    id: 6, number: '006',
    title: 'Mulholland Drive',
    director: 'Lynch', year: '2001', country: 'US',
    runtime: '147m', qualities: ['4K', 'ATMOS'],
    posterSrc: '/images/posters/mulholland.jpg',
    backgroundSrc: '', genre: 'Neo-Noir',
    synopsis: ''
  },
  {
    id: 7, number: '007',
    title: 'Au Hasard Balthazar',
    director: 'Bresson', year: '1966', country: 'FR',
    runtime: '95m', qualities: ['REMUX'],
    posterSrc: '/images/posters/balthazar.jpg',
    backgroundSrc: '', genre: 'Drama',
    synopsis: ''
  },
]

/* Weekly sessions preview */
const UPCOMING_SESSIONS = [
  { number: 'S·001', title: 'Noite Tarkovsky',        films: 2, duration: '5h 20m', date: 'Sáb · 20:00' },
  { number: 'S·002', title: 'Clássicos do Noir',       films: 3, duration: '6h 45m', date: 'Dom · 19:00' },
  { number: 'S·003', title: 'A Trilogia da Solidão',   films: 3, duration: '7h 10m', date: 'Sex · 21:00' },
]

const FINE_ART_EASE = [0.22, 1, 0.36, 1] as [number, number, number, number]

export default function HomePage() {
  const [hoveredSessionId, setHoveredSessionId] = useState<string | number | null>(null)
  return (
    
    <div
      style={{
        background: '#080806',
        color: '#EDE8DC',
        minHeight: '100dvh',
        display: 'flex',
      }}
    >
      {/* Film strip nav — fixed left */}

      
      {/* Main content */}
      <main
        style={{
          flex: 1,
          minWidth: 0,
          marginLeft: 0, 
        }}
      >
        {/* ── 1. HERO ───────────────────────────────────── */}
        <HeroProgramme
          programmeNumber="001"
          title="2001"
          subtitle="Uma Odisséia no Espaço"
          director="Stanley Kubrick"
          year="1968"
          country="UK / US"
          runtime="149m"
          synopsis="Uma jornada do ser humano primitivo ao limiar da transcendência, mediada por monólitos silenciosos e uma inteligência artificial que aprendeu a temer a morte."
          qualities={['4K', 'REMUX', 'ATMOS']}
          backdropSrc="/images/backdrops/2001.jpg"
          posterSrc="/images/posters/2001.jpg"
          href="/player"
        />

        {/* ── 2. MARQUEE ────────────────────────────────── */}
        <CinemaMarquee />

        {/* ── 3. PROGRAMME ──────────────────────────────── */}
        <FilmProgramme
          /* subtitle="Curadoria desta semana" */
          title="Programme de la Semaine"
          films={FEATURED_FILMS}
        />

        {/* ── 4. NOW PROJECTING ─────────────────────────── */}
        <NowProjecting
          title="Stalker"
          director="Andrei Tarkovsky"
          year="1979"
          progress={34}
          remainingTime="1h 47m"
          frameSrc="/images/backdrops/stalker.jpg"
          href="/player"
        />

        {/* Você precisa declarar isso no topo do componente pai: 
            const [hoveredSessionId, setHoveredSessionId] = useState<string | number | null>(null) 
        */}

        {/* ── 5. SESSIONS (Editorial Layout) ───────────────────────────────── */}
        <section style={{ padding: '72px 72px 120px' }}>

          {/* Cabeçalho da Seção */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              marginBottom: 48, // Mais espaço respirável
              paddingBottom: 24,
              borderBottom: '1px solid rgba(237,232,220,0.05)',
            }}
          >
            <div style={{ overflow: 'hidden' }}>
              <motion.h2
                initial={{ y: '100%' }} whileInView={{ y: '0%' }} viewport={{ once: true }} transition={{ duration: 1.2, ease: FINE_ART_EASE }}
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: 'clamp(2rem, 3vw, 2.8rem)',
                  fontWeight: 400,
                  color: '#EDE8DC',
                  lineHeight: 1,
                  letterSpacing: '-0.01em',
                  margin: 0
                }}
              >
                Próximas Projeções
              </motion.h2>
            </div>
            
            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 1, delay: 0.3 }}>
              <Link href="/session" style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: '10px',
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: '#565450',
                textDecoration: 'none',
                borderBottom: '1px solid rgba(237,232,220,0.07)',
                paddingBottom: 2,
                transition: 'color 0.2s, border-color 0.2s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#BF8F3C'; e.currentTarget.style.borderColor = 'rgba(191,143,60,0.3)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#565450'; e.currentTarget.style.borderColor = 'rgba(237,232,220,0.07)' }}
              >
                Ver calendário →
              </Link>
            </motion.div>
          </div>

          {/* Lista de Sessões */}
          <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {UPCOMING_SESSIONS.map((s, i) => (
              <motion.div
                key={s.number}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-5%" }}
                transition={{ delay: i * 0.08, duration: 0.8, ease: FINE_ART_EASE }}
              >
                <SessionRow 
                  session={s} 
                  isHovered={hoveredSessionId === s.number}
                  isDimmed={hoveredSessionId !== null && hoveredSessionId !== s.number}
                  onHover={setHoveredSessionId}
                />
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── 6. ADMIT ONE ──────────────────────────────── */}
        <AdmitOne
          sessionTitle="Mestres do Tempo"
          filmCount={3}
          totalDuration="5h 42m"
          date="28 ABR 2026"
          sessionNumber="004"
          href="/session/4"
          filmList={['Stalker', 'A Árvore da Vida', 'Jeanne Dielman']} // <-- Os títulos entram aqui!
        />

        {/* ── 7. LIBRARY COUNT ──────────────────────────── */}
        <LibraryCount count={128} />

        {/* ── FOOTER (Editorial Colophon) ────────────────────────────────────── */}
        <footer
          style={{
            padding: '120px 72px 40px', // Muito respiro superior
            background: '#040402', // Um tom ainda mais escuro para afundar a página
            borderTop: '1px solid rgba(237,232,220,0.05)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Topo do Footer: Marca e Navegação */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr auto', 
            gap: 64, 
            borderBottom: '1px solid rgba(237,232,220,0.05)', 
            paddingBottom: 64, 
            marginBottom: 32,
            alignItems: 'end'
          }}>
            
            {/* Esquerda: O Selo Tipográfico */}
            <div>
              <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 1, ease: FINE_ART_EASE }}
                style={{ 
                  fontFamily: "'Cormorant Garamond', serif", 
                  fontSize: 'clamp(4rem, 8vw, 7rem)', 
                  color: '#EDE8DC', 
                  margin: 0, 
                  lineHeight: 0.85, 
                  letterSpacing: '-0.02em' 
                }}
              >
                Lumière.
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1, delay: 0.3, ease: FINE_ART_EASE }}
                style={{ 
                  fontFamily: "'Cormorant Garamond', serif", 
                  fontSize: '1.4rem', 
                  color: '#8C8880', 
                  fontStyle: 'italic', 
                  marginTop: 24,
                  margin: '24px 0 0 0'
                }}
              >
                A preservação da memória através da luz e do tempo.
              </motion.p>
            </div>

            {/* Direita: Links de Diretório (Estilo Terminal) */}
            <div style={{ display: 'flex', gap: 80 }}>
              
              {/* Coluna 1 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#BF8F3C', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>
                  [ Diretório ]
                </span>
                {['Arquivo Completo', 'Sessões Programadas', 'O Manifesto'].map((item) => (
                  <Link 
                    key={item} href="#" 
                    style={{ 
                      fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#565450', letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none', transition: 'color 0.3s' 
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#EDE8DC'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#565450'}
                  >
                    {item}
                  </Link>
                ))}
              </div>

              {/* Coluna 2 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#BF8F3C', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>
                  [ Sistema ]
                </span>
                {['Acessar Terminal', 'Configurações', 'Diagnóstico'].map((item) => (
                  <Link 
                    key={item} href="#" 
                    style={{ 
                      fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#565450', letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none', transition: 'color 0.3s' 
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#EDE8DC'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#565450'}
                  >
                    {item}
                  </Link>
                ))}
              </div>

            </div>
          </div>

          {/* Base do Footer: Créditos e Metadados Técnicos */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            fontFamily: "'DM Mono', monospace", 
            fontSize: '9px', 
            letterSpacing: '0.15em', 
            textTransform: 'uppercase', 
            color: '#4A4844' // Cor bem escura para não roubar atenção, típica de metadados
          }}>
            <span>© 2026 Lumière Personal Cinema</span>
            
            <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              Desenvolvido por Edwin G. David 
              <span style={{ color: '#BF8F3C' }}>//</span> 
              Porto Alegre, RS
            </span>
            
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <motion.span 
                animate={{ opacity: [1, 0.2, 1] }} 
                transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                style={{ width: 4, height: 4, backgroundColor: '#BF8F3C', borderRadius: '50%', display: 'inline-block' }}
              />
              Status: Operacional
            </span>
          </div>
        </footer>
      </main>
    </div>
  )
}