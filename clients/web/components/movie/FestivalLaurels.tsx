"use client";

import React, { useState } from "react";
import { getFestivalDictionary } from "../icons/FestivalIcons";

interface FestivalLaurelsProps {
  awards: any[]; // Usamos any[] aqui para o componente mastigar o que vier da API
  maxVisible?: number;
}

export const FestivalLaurels = ({ awards, maxVisible = 6 }: FestivalLaurelsProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!awards || !Array.isArray(awards) || awards.length === 0) return null;

  // 1. O Tanque de Guerra: Normaliza os dados e identifica Vencedores
  const enrichedAwards = awards
    .map((award) => {
      // Cenário A: A API mandou só um array de textos ex: ["Cannes", "TIFF"]
      if (typeof award === "string") {
        const dict = getFestivalDictionary(award);
        return { category: "Seleção Oficial", isWinner: false, ...dict }; 
      }

      // Cenário B: Objetos do Django
      if (typeof award === "object" && award !== null) {
        const rawName = award.festival || award.name || award.title || "Festival";
        const rawCategory = String(award.category || award.award || "Seleção Oficial");
        const rawYear = String(award.year || "");
        
        // O PULO DO GATO: Lemos a string do ano ou categoria para ver se tem "Vencedor" (ou variações em inglês)
        const isWinner = rawYear.toLowerCase().includes("vencedor") || 
                         rawCategory.toLowerCase().includes("vencedor") ||
                         rawYear.toLowerCase().includes("winner") ||
                         rawCategory.toLowerCase().includes("won");

        const searchString = `${rawName} ${rawCategory}`;
        const dict = getFestivalDictionary(searchString);

        // Lógica inteligente para o fallback (Tier C)
        let finalLabel = dict.label;
        if (dict.weight === 10) {
          if (rawName === "International Recognition") {
             const words = rawCategory.split(" ");
             const smartLabel = words.length >= 2 ? `${words[0]} ${words[1]}` : rawCategory;
             finalLabel = smartLabel.length > 22 ? smartLabel.substring(0, 22) + "..." : smartLabel;
          } else {
             finalLabel = rawName.length > 22 ? rawName.substring(0, 22) + "..." : rawName;
          }
        }

        return { 
          category: rawCategory, 
          year: rawYear, 
          isWinner, // Passamos a flag para a próxima etapa
          ...dict,
          label: finalLabel
        };
      }

      return null;
    })
    .filter(Boolean) as any[]; 

  if (enrichedAwards.length === 0) return null;

  // 2. ORDENAÇÃO DUPLA (Vencedor > Indicado. Depois: Tier S+ > Tier C)
  const sortedAwards = enrichedAwards.sort((a, b) => {
    // Regra 1: Se 'A' ganhou e 'B' não, 'A' sobe. Se 'B' ganhou e 'A' não, 'B' sobe.
    if (a.isWinner && !b.isWinner) return -1;
    if (!a.isWinner && b.isWinner) return 1;
    
    // Regra 2: Empate (os dois ganharam ou os dois perderam). Quem tem o festival mais VIP ganha.
    return b.weight - a.weight;
  });

  // 3. Regra de Corte
  const visibleAwards = isExpanded ? sortedAwards : sortedAwards.slice(0, maxVisible);
  const hiddenCount = sortedAwards.length - maxVisible;

  return (
    <div className="w-full flex flex-col items-center">
      {/* Container de Prêmios */}
      <div className="flex flex-wrap justify-center gap-x-8 gap-y-10 transition-all duration-500 ease-in-out">
        {visibleAwards.map((award, index) => {
          const Icon = award.Icon;

          return (
            <div
              key={index}
              className="flex flex-col items-center justify-center w-36 text-center animate-fade-in"
            >
              {/* O Ícone / Louro */}
              <div className="w-24 h-24 mb-3 flex items-center justify-center text-yellow-500/90 dark:text-yellow-600 drop-shadow-md">
                <Icon className="w-full h-full object-contain" />
              </div>

              {/* Informações Tipográficas */}
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-800 dark:text-slate-200">
                  {award.label}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-medium">
                  {award.category} {award.year ? `· ${award.year}` : ""}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Botão de Expansão */}
      {hiddenCount > 0 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-10 px-6 py-2 text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:text-yellow-600 dark:hover:text-yellow-500 transition-colors border border-transparent hover:border-yellow-600/30 rounded-full"
        >
          {isExpanded
            ? "Ocultar seleções"
            : `+ Ver todas as ${hiddenCount} seleções`}
        </button>
      )}
    </div>
  );
};