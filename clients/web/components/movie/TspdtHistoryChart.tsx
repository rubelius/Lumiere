'use client';
import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";
import { MissingData } from "./MissingData";

const FINE_ART_EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

export const TspdtHistoryChart = ({ history }: { history: any }) => {
  let parsedHistory: any = {};
  
  try {
    if (typeof history === 'string') parsedHistory = JSON.parse(history);
    else if (typeof history === 'object' && history !== null) parsedHistory = history;
  } catch (error) {
    parsedHistory = {};
  }

  const rawEntries = Object.entries(parsedHistory)
    .map(([year, rank]) => ({ year: Number(year), rank: Number(rank) }))
    .filter(e => !isNaN(e.year) && !isNaN(e.rank) && e.rank > 0)
    .sort((a, b) => a.year - b.year);

  if (rawEntries.length === 0) return <MissingData label="HISTÓRICO DE RELEVÂNCIA (TSPDT)" />;

  const minYear = rawEntries[0].year;
  const maxYear = rawEntries[rawEntries.length - 1].year;
  
  const numLabels = 7;
  const yearLabels = [];
  if (minYear === maxYear) {
     yearLabels.push({ year: minYear, x: '50%' });
  } else {
    for (let i=0; i<numLabels; i++) {
        const year = Math.round(minYear + (maxYear - minYear) * (i / (numLabels - 1)));
        const percentage = (i / (numLabels - 1)) * 100;
        yearLabels.push({ year, x: `${percentage}%` });
    }
  }

  const W = 1000;
  const H = 200;
  
  const maxRankData = Math.max(...rawEntries.map(e => e.rank), 1000);
  const bestRankData = Math.min(...rawEntries.map(e => e.rank), 1);

  const mapPoint = (entry: {year: number, rank: number}) => {
    const x = ((entry.year - minYear) / (maxYear - minYear)) * W;
    const rankRatio = maxRankData === bestRankData ? 0.5 : (entry.rank - bestRankData) / (maxRankData - bestRankData);
    const y = 30 + rankRatio * (150 - 30); 
    return { x, y };
  }

  const mappedPoints = rawEntries.map(mapPoint);

  const line = (p1: {x:number, y:number}, p2:{x:number, y:number}) => {
    const lengthX = p2.x - p1.x;
    const lengthY = p2.y - p1.y;
    return { length: Math.sqrt(Math.pow(lengthX, 2) + Math.pow(lengthY, 2)), angle: Math.atan2(lengthY, lengthX) }
  }
  const controlPoint = (p1: {x:number, y:number}, p0:{x:number, y:number}, p2:{x:number, y:number}, reverse = false) => {
    const smoothing = 0.2; 
    const opp = line(p0 || p1, p2 || p1);
    const angle = opp.angle + (reverse ? Math.PI : 0);
    const length = opp.length * smoothing;
    return { x: p1.x + Math.cos(angle) * length, y: p1.y + Math.sin(angle) * length };
  }

  let dStroke = `M ${mappedPoints[0].x},${mappedPoints[0].y}`;
  let curves = "";
  
  for (let i = 1; i < mappedPoints.length; i++) {
    const p1 = mappedPoints[i-1];
    const p2 = mappedPoints[i];
    const cp1 = controlPoint(p1, mappedPoints[i-2], p2);
    const cp2 = controlPoint(p2, p1, mappedPoints[i+1], true);
    curves += ` C ${cp1.x},${cp1.y} ${cp2.x},${cp2.y} ${p2.x},${p2.y}`;
  }
  dStroke += curves;
  
  let dFill = `M ${mappedPoints[0].x},${H}`; 
  dFill += ` L ${mappedPoints[0].x},${mappedPoints[0].y}`; 
  dFill += curves;
  dFill += ` L ${mappedPoints[mappedPoints.length - 1].x},${H}`; 
  dFill += ` Z`; 

  return (
    <div style={{ border: '1px solid rgba(86,84,80,0.3)', backgroundColor: '#040402', padding: '32px 48px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px', position: 'relative', zIndex: 10 }}>
        <div>
          <h4 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', color: '#EDE8DC', margin: '0 0 8px 0' }}>Evolução de Relevância Artística</h4>
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#8C8880', letterSpacing: '0.1em', margin: 0, textTransform: 'uppercase' }}>Histórico Dinâmico They Shoot Pictures, Don't They?</p>
        </div>
        <TrendingUp style={{ width: 24, height: 24, color: '#BF8F3C' }} />
      </div>
      
      <div style={{ position: 'relative', height: 180, width: '100%', borderBottom: '1px solid rgba(237,232,220,0.2)', marginBottom: '40px' }}>
        <svg viewBox="0 0 1000 200" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
          <defs>
              <linearGradient id="gaussian-gradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgba(191,143,60,0.2)" />
                <stop offset="100%" stopColor="rgba(191,143,60,0)" />
              </linearGradient>
              <filter id="gaussian-glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                  </feMerge>
              </filter>
          </defs>
          
          {/* EIXO Y (Linhas e numeração) */}
          <line x1="0" y1="30" x2="1000" y2="30" stroke="rgba(237,232,220,0.05)" strokeWidth="1" strokeDasharray="4 4" />
          <text x="0" y="25" fill="#565450" fontSize="10" fontFamily="monospace">#1</text>
          
          <line x1="0" y1="90" x2="1000" y2="90" stroke="rgba(237,232,220,0.05)" strokeWidth="1" strokeDasharray="4 4" />
          <text x="0" y="85" fill="#565450" fontSize="10" fontFamily="monospace">#500</text>
          
          <line x1="0" y1="150" x2="1000" y2="150" stroke="rgba(237,232,220,0.05)" strokeWidth="1" strokeDasharray="4 4" />
          <text x="0" y="145" fill="#565450" fontSize="10" fontFamily="monospace">#1000</text>

          <motion.path 
              initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ duration: 2, ease: FINE_ART_EASE }}
              d={dFill} fill="url(#gaussian-gradient)"
          />
          <motion.path 
              initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 2, ease: FINE_ART_EASE }}
              d={dStroke} fill="none" stroke="#BF8F3C" strokeWidth="4" strokeLinecap="round" 
              style={{ filter: 'drop-shadow(0 0 8px rgba(191,143,60,0.6))', ...({filter: 'url(#gaussian-glow)'} as any) }}
          />
        </svg>

        <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 0 }}>
          {yearLabels.map((pt) => (
            <motion.div key={pt.year} whileHover="hover" initial="rest" animate="rest" style={{ position: 'absolute', left: pt.x, bottom: -24, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'crosshair', transform: 'translateX(-50%)' }}>
              <motion.span 
                variants={{ rest: { color: '#8C8880', scale: 1 }, hover: { color: '#BF8F3C', scale: 1.3 } }}
                transition={{ duration: 0.2 }}
                style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.1em' }}
              >
                {pt.year}
              </motion.span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};