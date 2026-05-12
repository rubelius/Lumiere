"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Search, Filter, Check } from "lucide-react";

const FINE_ART_EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

export interface FilterState {
  category: string;
  viewMode: "grid" | "list";
  search: string;
  qualities: string[];
  genres: string[];
  decades: string[];
  curations: string[];
}

interface LibraryFiltersProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  isFilterOpen: boolean;
  setIsFilterOpen: (isOpen: boolean) => void;
}

export function LibraryFilters({ filters, setFilters, isFilterOpen, setIsFilterOpen }: LibraryFiltersProps) {
  
  const categories = ["Acervo Completo", "Longas-Metragem", "Curtas-Metragem", "Ganhadores de Festivais", "Nacionais"];
  
  // Dicionários para popular o painel
  const filterOptions = {
    qualities: ["REMUX", "4K", "HDR", "Dolby Vision", "Dolby Atmos", "WEB-DL"],
    genres: ["Drama", "Ficção Científica", "Terror", "Suspense", "Comédia", "Ação", "Documentário", "Romance"],
    decades: ["2020s", "2010s", "2000s", "1990s", "1980s", "1970s", "Clássicos (Pré-70)"],
    curations: ["MUBI", "Criterion Collection", "Seleção do Oscar", "Seleção de Cannes", "Teste de Bechdel", "Disponível Imediatamente"]
  };

  const toggleArrayFilter = (key: keyof FilterState, value: string) => {
    setFilters(prev => {
      const currentArray = prev[key] as string[];
      const newArray = currentArray.includes(value) 
        ? currentArray.filter(i => i !== value) 
        : [...currentArray, value];
      return { ...prev, [key]: newArray };
    });
  };

  // Sub-componente para os checkboxes
  const FilterGroup = ({ title, options, filterKey }: { title: string, options: string[], filterKey: keyof FilterState }) => (
    <div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#BF8F3C', marginBottom: 24, letterSpacing: '0.2em' }}>
        [ {title} ]
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
        {options.map((opt) => {
          const isSelected = (filters[filterKey] as string[]).includes(opt);
          return (
            <label key={opt} onClick={() => toggleArrayFilter(filterKey, opt)} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
              <div style={{ width: 14, height: 14, border: isSelected ? '1px solid #BF8F3C' : '1px solid rgba(237,232,220,0.15)', background: isSelected ? 'rgba(191,143,60,0.1)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                {isSelected && <Check style={{ width: 10, height: 10, color: '#BF8F3C' }} />}
              </div>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: isSelected ? '#EDE8DC' : '#565450', letterSpacing: '0.15em', transition: 'color 0.2s' }}>{opt}</span>
            </label>
          )
        })}
      </div>
    </div>
  );

  return (
    <div style={{ marginBottom: 40 }}>
      {/* ── BARRA DE COMANDOS SUPERIOR ── */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.8, ease: FINE_ART_EASE }}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(237,232,220,0.05)', paddingBottom: 24 }}
      >
        {/* Categorias Editoriais */}
        <div style={{ display: 'flex', gap: 32 }}>
          {categories.map((cat) => {
            const isActive = filters.category === cat;
            return (
              <button 
                key={cat}
                onClick={() => setFilters(prev => ({ ...prev, category: cat }))} 
                style={{ 
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase',
                  color: isActive ? '#BF8F3C' : '#565450',
                  borderBottom: isActive ? '1px solid rgba(191,143,60,0.3)' : '1px solid transparent',
                  paddingBottom: 4, transition: 'color 0.3s, border-color 0.3s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#EDE8DC' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = isActive ? '#BF8F3C' : '#565450' }}
              >
                {cat}
              </button>
            )
          })}
        </div>

        {/* Comandos da Direita */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <div style={{ display: 'flex', gap: 16, fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            <button 
              onClick={() => setFilters(prev => ({ ...prev, viewMode: "grid" }))}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: filters.viewMode === 'grid' ? '#EDE8DC' : '#565450', transition: 'color 0.3s' }}
            >
              [ GRADE ]
            </button>
            <button 
              onClick={() => setFilters(prev => ({ ...prev, viewMode: "list" }))}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: filters.viewMode === 'list' ? '#EDE8DC' : '#565450', transition: 'color 0.3s' }}
            >
              [ LISTA ]
            </button>
          </div>

          <div style={{ position: 'relative', width: 280 }}>
            <Search style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#565450' }} />
            <input 
              type="text" 
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              placeholder="CONSULTAR ACERVO..." 
              style={{ 
                width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(237,232,220,0.1)',
                padding: '8px 8px 8px 24px', color: '#EDE8DC', fontFamily: "'DM Mono', monospace", fontSize: '10px', 
                letterSpacing: '0.15em', outline: 'none', transition: 'border-color 0.3s'
              }}
              onFocus={(e) => e.target.style.borderBottom = '1px solid #BF8F3C'}
              onBlur={(e) => e.target.style.borderBottom = '1px solid rgba(237,232,220,0.1)'}
            />
          </div>

          <button 
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            style={{ 
              background: isFilterOpen ? 'rgba(191,143,60,0.1)' : 'transparent', 
              border: isFilterOpen ? '1px solid rgba(191,143,60,0.4)' : '1px solid rgba(237,232,220,0.1)', 
              color: isFilterOpen ? '#BF8F3C' : '#8C8880', 
              padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
              fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', transition: 'all 0.3s'
            }}
          >
            <Filter style={{ width: 12, height: 12 }} />
            PARÂMETROS
          </button>
        </div>
      </motion.div>

      {/* ── PAINEL EXPANSÍVEL (O Mega Menu) ── */}
      <AnimatePresence>
        {isFilterOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.6, ease: FINE_ART_EASE }} style={{ overflow: 'hidden' }}>
            <div style={{ border: '1px solid rgba(237,232,220,0.05)', background: '#040402', padding: '48px 64px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 40 }}>
              <FilterGroup title="ESPECIFICAÇÕES" options={filterOptions.qualities} filterKey="qualities" />
              <FilterGroup title="GÊNEROS" options={filterOptions.genres} filterKey="genres" />
              <FilterGroup title="DÉCADAS" options={filterOptions.decades} filterKey="decades" />
              <FilterGroup title="CURADORIA & PREMIAÇÕES" options={filterOptions.curations} filterKey="curations" />
            </div>
            
            {/* Botão de Limpar Filtros */}
            <div style={{ background: '#040402', padding: '0 64px 32px', display: 'flex', justifyContent: 'flex-end', borderLeft: '1px solid rgba(237,232,220,0.05)', borderRight: '1px solid rgba(237,232,220,0.05)', borderBottom: '1px solid rgba(237,232,220,0.05)' }}>
               <button 
                  onClick={() => setFilters(prev => ({ ...prev, qualities: [], genres: [], decades: [], curations: [] }))}
                  style={{ background: 'transparent', border: 'none', color: '#565450', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.15em', cursor: 'pointer', textTransform: 'uppercase' }}
                >
                  [ REDEFINIR PARÂMETROS ]
               </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}