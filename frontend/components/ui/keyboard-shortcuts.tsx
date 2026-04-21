import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Command, X } from "lucide-react";

export function KeyboardShortcuts() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle on ? if not typing in an input
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        setIsOpen(prev => !prev);
      }
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const shortcuts = [
    { key: "⌘ K", desc: "Busca Global" },
    { key: "?", desc: "Mostrar Atalhos" },
    { key: "F", desc: "Tela Cheia" },
    { key: "M", desc: "Mutar Áudio" },
    { key: "Space", desc: "Play/Pause" },
    { key: "Esc", desc: "Fechar Janelas/Modais" },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-200 bg-background/80 backdrop-blur-xl flex items-center justify-center p-4"
          onClick={() => setIsOpen(false)}
        >
          <motion.div 
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="bg-card/80 border border-white/10 rounded-[2rem] p-8 max-w-lg w-full shadow-2xl relative"
            onClick={e => e.stopPropagation()}
          >
            <button onClick={() => setIsOpen(false)} className="absolute top-8 right-8 text-muted-foreground hover:text-white transition-colors">
              <X className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 rounded-2xl bg-primary/20 text-primary flex items-center justify-center border border-primary/30">
                <Command className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-3xl font-serif text-white">Atalhos de Teclado</h2>
                <p className="text-muted-foreground text-sm">Navegue mais rápido pelo Lumière</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              {shortcuts.map(s => (
                <div key={s.key} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                  <span className="text-white/80 font-medium">{s.desc}</span>
                  <kbd className="px-3 py-1.5 rounded-lg bg-black/50 border border-white/10 text-primary font-mono text-sm tracking-wider">{s.key}</kbd>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
