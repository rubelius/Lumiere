'use client';
import { Sidebar } from "@/components/layout/Sidebar";
import { motion } from "framer-motion";
import { Server, DownloadCloud, Tv, Key, Shield, Bell, ChevronRight, CheckCircle2, Type, SlidersHorizontal, Palette } from "lucide-react";
import { useState } from "react";

export default function Settings() {
  const [activeTab, setActiveTab] = useState("Reprodução");

  const sections = [
    {
      title: "Servidor de Mídia",
      icon: Server,
      category: "Conexões",
      items: [
        { label: "Plex Media Server", value: "Conectado", status: "success" },
        { label: "Jellyfin", value: "Desconectado", status: "none" },
        { label: "Diretório Base", value: "/mnt/media/movies", status: "default" }
      ]
    },
    {
      title: "Integrações",
      icon: DownloadCloud,
      category: "Provedores",
      items: [
        { label: "Real-Debrid", value: "Premium Ativo", status: "success" },
        { label: "AllDebrid", value: "Não configurado", status: "none" },
        { label: "Premiumize", value: "Não configurado", status: "none" }
      ]
    },
    {
      title: "Preferências de Qualidade",
      icon: Tv,
      category: "Reprodução",
      items: [
        { label: "Qualidade Padrão", value: "REMUX 4K HDR", status: "default" },
        { label: "Priorizar Áudio", value: "Dolby Atmos / TrueHD", status: "default" },
        { label: "Tamanho Máximo", value: "100 GB por filme", status: "default" }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground pl-24 pb-32 selection:bg-primary/30">
      <div className="fixed inset-0 bg-noise opacity-[0.03] mix-blend-overlay pointer-events-none z-50" />
      <Sidebar />

      <main className="max-w-300 mx-auto px-16 pt-20">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-16"
        >
          <h1 className="text-6xl font-serif font-bold text-white mb-4 text-glow">Configurações</h1>
          <p className="text-2xl text-muted-foreground font-light">Gerencie suas integrações e preferências</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Settings Nav */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-4 space-y-2"
          >
            {[
              { icon: Server, label: "Conexões" },
              { icon: DownloadCloud, label: "Provedores" },
              { icon: Tv, label: "Reprodução" },
              { icon: Palette, label: "Aparência" },
              { icon: Type, label: "Legendas" },
              { icon: Key, label: "API Keys" },
              { icon: Shield, label: "Privacidade" },
              { icon: Bell, label: "Notificações" }
            ].map((item) => (
              <button 
                key={item.label}
                onClick={() => setActiveTab(item.label)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl tv-focus transition-all text-lg font-medium
                  ${activeTab === item.label ? 'bg-primary text-white shadow-lg shadow-primary/25' : 'text-muted-foreground hover:bg-white/5 hover:text-white'}
                `}
              >
                <item.icon className="w-6 h-6" />
                {item.label}
              </button>
            ))}
          </motion.div>

          {/* Settings Content */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-8 space-y-12"
          >
            {/* Appearance Customization (New Feature) */}
            {activeTab === "Aparência" && (
              <div className="bg-card/20 border border-white/5 rounded-[3rem] p-12 backdrop-blur-xl shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-125 h-125 bg-primary/5 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/2" />
                
                <div className="flex items-center gap-6 mb-12 relative z-10">
                  <div className="w-16 h-16 rounded-[1.5rem] bg-primary/10 flex items-center justify-center text-primary shadow-inner border border-primary/20">
                    <Palette className="w-8 h-8" />
                  </div>
                  <h2 className="text-4xl font-serif text-white tracking-tight">Temas e Cores</h2>
                </div>

                <div className="space-y-12 relative z-10">
                  <div>
                    <h3 className="text-xl text-white font-medium mb-6">Cor de Destaque</h3>
                    <div className="flex flex-wrap gap-6">
                      {[
                        { name: 'Púrpura Noir', class: 'bg-[#6366f1]', active: true },
                        { name: 'Ouro Cinema', class: 'bg-[#f59e0b]', active: false },
                        { name: 'Vermelho Veludo', class: 'bg-[#ef4444]', active: false },
                        { name: 'Verde Matrix', class: 'bg-[#10b981]', active: false },
                        { name: 'Azul Neon', class: 'bg-[#0ea5e9]', active: false },
                      ].map(color => (
                        <button key={color.name} className={`w-16 h-16 rounded-[1.5rem] ${color.class} tv-focus relative flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl hover:-translate-y-1 border-2 border-transparent ${color.active ? 'border-white scale-110' : ''}`}>
                          {color.active && <CheckCircle2 className="w-8 h-8 text-white absolute drop-shadow-md" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xl text-white font-medium mb-6">Densidade de UI</h3>
                    <div className="grid grid-cols-2 gap-6">
                      <button className="p-6 rounded-[2rem] bg-primary/10 border-2 border-primary text-left tv-focus shadow-[0_0_20px_rgba(99,102,241,0.15)] transition-all hover:scale-[1.02]">
                        <div className="text-white font-bold text-xl mb-2 tracking-wide">Padrão</div>
                        <div className="text-primary/80 text-sm font-medium">Espaçamento generoso otimizado para TV (10-foot UI)</div>
                      </button>
                      <button className="p-6 rounded-[2rem] bg-white/5 border-2 border-white/5 text-left tv-focus hover:bg-white/10 transition-all hover:scale-[1.02] hover:border-white/20">
                        <div className="text-white font-bold text-xl mb-2 tracking-wide">Compacto</div>
                        <div className="text-white/50 text-sm font-medium">Mais densidade de informação (Desktop/Tablet)</div>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-8 rounded-[2rem] bg-white/5 border border-white/10">
                    <div>
                      <h3 className="text-xl text-white font-bold mb-2">Efeitos Visuais Cinematográficos</h3>
                      <p className="text-base text-white/60 font-light">Habilitar blur avançado, glow em textos e transições fluidas</p>
                    </div>
                    <button className="w-16 h-8 bg-primary rounded-full relative tv-focus shadow-[0_0_15px_rgba(99,102,241,0.4)]">
                      <div className="absolute right-1 top-1 w-6 h-6 bg-white rounded-full shadow-sm" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Subtitle Customization */}
            {activeTab === "Legendas" && (
              <div className="bg-card/20 border border-white/5 rounded-[3rem] p-12 backdrop-blur-xl shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-125 h-125 bg-primary/5 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/2" />
                
                <div className="flex items-center gap-6 mb-12 relative z-10">
                  <div className="w-16 h-16 rounded-[1.5rem] bg-primary/10 flex items-center justify-center text-primary shadow-inner border border-primary/20">
                    <Type className="w-8 h-8" />
                  </div>
                  <h2 className="text-4xl font-serif text-white tracking-tight">Aparência das Legendas</h2>
                </div>

                {/* Live Preview */}
                <div className="aspect-21/9 w-full rounded-[2rem] bg-black mb-12 relative overflow-hidden border border-white/10 flex items-end justify-center pb-12 shadow-2xl group">
                  <img src="https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=1200&q=80" className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-1000" alt="" />
                  <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent" />
                  <p className="relative z-10 text-[40px] font-sans font-medium text-white drop-shadow-[0_4px_8px_rgba(0,0,0,1)] bg-black/40 px-6 py-2 rounded-xl tracking-wide">
                    Um cineasta é um homem que está debaixo de água.
                  </p>
                </div>

                <div className="space-y-10 relative z-10">
                  <div className="bg-white/5 p-8 rounded-[2rem] border border-white/5">
                    <div className="flex justify-between mb-6">
                      <label className="text-xl text-white font-bold tracking-wide">Tamanho da Fonte</label>
                      <span className="text-primary font-mono text-xl font-bold bg-primary/10 px-4 py-1 rounded-lg">40px</span>
                    </div>
                    <input type="range" min="16" max="64" defaultValue="40" className="w-full accent-primary h-2 bg-white/10 rounded-lg appearance-none cursor-pointer tv-focus" />
                  </div>
                  
                  <div className="bg-white/5 p-8 rounded-[2rem] border border-white/5">
                    <div className="flex justify-between mb-6">
                      <label className="text-xl text-white font-bold tracking-wide">Opacidade do Fundo</label>
                      <span className="text-primary font-mono text-xl font-bold bg-primary/10 px-4 py-1 rounded-lg">40%</span>
                    </div>
                    <input type="range" min="0" max="100" defaultValue="40" className="w-full accent-primary h-2 bg-white/10 rounded-lg appearance-none cursor-pointer tv-focus" />
                  </div>

                  <div className="flex items-center justify-between p-8 rounded-[2rem] bg-white/5 border border-white/10 tv-focus cursor-pointer hover:bg-white/10 transition-colors hover:border-white/20">
                    <span className="text-xl text-white font-bold tracking-wide">Cor da Legenda</span>
                    <div className="flex gap-4">
                      <div className="w-12 h-12 rounded-full bg-white border-4 border-primary tv-focus shadow-[0_0_15px_rgba(255,255,255,0.3)] hover:scale-110 transition-transform" />
                      <div className="w-12 h-12 rounded-full bg-yellow-400 border-4 border-transparent tv-focus hover:border-white/50 hover:scale-110 transition-all shadow-lg" />
                      <div className="w-12 h-12 rounded-full bg-cyan-400 border-4 border-transparent tv-focus hover:border-white/50 hover:scale-110 transition-all shadow-lg" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Standard Sections */}
            {activeTab !== "Legendas" && activeTab !== "Aparência" && sections.filter(s => s.category === activeTab || (activeTab === 'Reprodução' && !['Legendas', 'Aparência', 'Conexões', 'Provedores'].includes(s.category))).map((section) => (
              <div key={section.title} className="bg-card/20 border border-white/5 rounded-[3rem] p-12 backdrop-blur-xl shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-125 h-125 bg-primary/5 rounded-full blur-[100px] pointer-events-none group-hover:bg-primary/10 transition-colors duration-700 -translate-y-1/2 translate-x-1/2" />
                
                <div className="flex items-center gap-6 mb-10 relative z-10">
                  <div className="w-16 h-16 rounded-[1.5rem] bg-primary/10 flex items-center justify-center text-primary shadow-inner border border-primary/20">
                    <section.icon className="w-8 h-8" />
                  </div>
                  <h2 className="text-4xl font-serif text-white tracking-tight">{section.title}</h2>
                </div>

                <div className="space-y-4 relative z-10">
                  {section.items.map((item, i) => (
                    <motion.button 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      key={item.label} 
                      className="w-full flex items-center justify-between p-6 rounded-[2rem] bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all tv-focus group/btn hover:shadow-lg hover:-translate-y-1"
                    >
                      <span className="text-xl text-white font-medium tracking-wide">{item.label}</span>
                      <div className="flex items-center gap-6">
                        {item.status === 'success' && (
                          <span className="flex items-center gap-2 text-quality-remux bg-quality-remux/10 px-4 py-2 rounded-xl text-sm font-bold tracking-widest uppercase border border-quality-remux/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                            <CheckCircle2 className="w-5 h-5" />
                            {item.value}
                          </span>
                        )}
                        {item.status === 'none' && (
                          <span className="text-white/40 text-sm font-medium tracking-wide uppercase">{item.value}</span>
                        )}
                        {item.status === 'default' && (
                          <span className="text-white/70 text-sm font-bold tracking-wide uppercase bg-white/5 px-4 py-2 rounded-xl border border-white/10">{item.value}</span>
                        )}
                        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover/btn:bg-primary group-hover/btn:text-white transition-colors">
                          <ChevronRight className="w-5 h-5 text-white/50 group-hover/btn:text-white" />
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            ))}
          </motion.div>

        </div>
      </main>
    </div>
  );
}