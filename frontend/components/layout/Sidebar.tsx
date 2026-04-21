'use client'
import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Film, Home, Search, PlayCircle, Users, User, Settings, Bell, Download, Play, Pause, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { SearchModal } from "@/components/ui/search-modal";

export function Sidebar() {
  const [location] = usePathname();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isDownloadsOpen, setIsDownloadsOpen] = useState(false);
  const [showMiniPlayer, setShowMiniPlayer] = useState(true);

  const navItems = [
    { icon: Home, label: "Home", href: "/" },
    { icon: Search, label: "Library", href: "/library" },
    { icon: PlayCircle, label: "Session", href: "/session" },
    { icon: Users, label: "Party Mode", href: "/party" },
    { icon: User, label: "Profile", href: "/profile" },
  ];

  const notifications = [
    { id: 1, title: "Download Concluído", desc: "Solaris (1972) - REMUX 4K", time: "2 min atrás", unread: true },
    { id: 2, title: "Convite para Party", desc: "Ana convidou você para assistir Persona", time: "1 hr atrás", unread: true },
    { id: 3, title: "Novo Release", desc: "Barry Lyndon em 4K HDR já disponível", time: "5 hrs atrás", unread: false },
  ];

  return (
    <>
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      
      <motion.nav 
        initial={{ x: -100 }}
        animate={{ x: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="fixed left-0 top-0 bottom-0 w-24 hover:w-72 bg-background/80 backdrop-blur-2xl border-r border-white/5 transition-all duration-500 z-50 flex flex-col group overflow-visible"
      >
        {/* Noise overlay */}
        <div className="absolute inset-0 bg-noise opacity-[0.02] mix-blend-overlay pointer-events-none" />
        
        <div className="relative flex-1 py-8 px-4 flex flex-col gap-6 overflow-y-auto hide-scrollbar">
          <div className="mb-8 px-2 flex items-center gap-4 text-primary shrink-0">
            <Film className="w-8 h-8 shrink-0 drop-shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
            <span className="font-serif text-3xl font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-500 whitespace-nowrap text-white text-glow">Lumière</span>
          </div>

          {/* Quick Search Action */}
          <button 
            onClick={() => setIsSearchOpen(true)}
            className="flex items-center gap-4 px-3 py-3 rounded-2xl tv-focus outline-none relative overflow-hidden text-muted-foreground hover:text-white bg-white/5 border border-white/5 hover:bg-white/10 transition-all mb-4"
          >
            <Search className="w-6 h-6 shrink-0 relative z-10" />
            <span className="text-lg font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-500 whitespace-nowrap relative z-10 flex-1 text-left">Busca Rápida</span>
            <kbd className="hidden group-hover:block opacity-0 group-hover:opacity-100 text-xs font-mono bg-black/30 px-2 py-1 rounded text-muted-foreground transition-opacity">⌘K</kbd>
          </button>

          {navItems.map((item, i) => (
            <Link 
              key={item.href} 
              href={item.href}
              className={`flex items-center gap-4 px-3 py-3 rounded-2xl tv-focus outline-none relative overflow-hidden group/item
                ${location === item.href ? 'text-white' : 'text-muted-foreground hover:text-white'}
              `}
              data-testid={`link-${item.label.toLowerCase()}`}
            >
              {location === item.href && (
                <motion.div 
                  layoutId="active-nav"
                  className="absolute inset-0 bg-primary/20 rounded-2xl border border-primary/20"
                  initial={false}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              {location !== item.href && (
                <div className="absolute inset-0 bg-white/0 group-hover/item:bg-white/5 transition-colors rounded-2xl" />
              )}
              
              <item.icon className="w-6 h-6 shrink-0 relative z-10" />
              <span className="text-lg font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-500 whitespace-nowrap relative z-10">{item.label}</span>
            </Link>
          ))}
        </div>

        <div className="relative p-4 pb-8 border-t border-white/5 space-y-2">
          {/* Downloads Toggle (New Feature 9) */}
          <div className="relative">
            <button 
              onClick={() => setIsDownloadsOpen(!isDownloadsOpen)}
              className={`w-full flex items-center gap-4 px-3 py-3 rounded-2xl tv-focus outline-none relative overflow-hidden group/item transition-colors
                ${isDownloadsOpen ? 'bg-white/10 text-white' : 'text-muted-foreground hover:bg-white/5 hover:text-white'}
              `}
            >
              <div className="relative">
                <Download className="w-6 h-6 shrink-0 relative z-10" />
                <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-primary rounded-full border-2 border-background" />
              </div>
              <span className="text-lg font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-500 whitespace-nowrap relative z-10">Downloads</span>
            </button>

            <AnimatePresence>
              {isDownloadsOpen && (
                <motion.div 
                  initial={{ opacity: 0, x: -20, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -20, scale: 0.95 }}
                  className="absolute bottom-0 left-[calc(100%+1rem)] w-80 bg-card/90 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden z-50"
                >
                  <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
                    <h3 className="font-serif text-lg text-white">Downloads Ativos</h3>
                    <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full font-bold">1 baixando</span>
                  </div>
                  <div className="p-4">
                    <div className="flex gap-4 mb-3">
                      <div className="w-12 h-16 rounded overflow-hidden shrink-0">
                        <img src={"/images/poster-2.png"} className="w-full h-full object-cover" alt="" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-bold text-white leading-tight mb-1">Solaris</h4>
                        <p className="text-xs text-muted-foreground mb-2">4K REMUX • 75.2 GB</p>
                        <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: '68%' }} />
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-[10px] text-muted-foreground font-mono">14.2 MB/s</span>
                          <span className="text-[10px] text-primary font-bold">68%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Notifications Toggle */}
          <div className="relative">
            <button 
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className={`w-full flex items-center gap-4 px-3 py-3 rounded-2xl tv-focus outline-none relative overflow-hidden group/item transition-colors
                ${isNotificationsOpen ? 'bg-white/10 text-white' : 'text-muted-foreground hover:bg-white/5 hover:text-white'}
              `}
            >
              <div className="relative">
                <Bell className="w-6 h-6 shrink-0 relative z-10" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-destructive rounded-full border-2 border-background" />
              </div>
              <span className="text-lg font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-500 whitespace-nowrap relative z-10">Notificações</span>
            </button>

            {/* Notifications Popover */}
            <AnimatePresence>
              {isNotificationsOpen && (
                <motion.div 
                  initial={{ opacity: 0, x: -20, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -20, scale: 0.95 }}
                  className="absolute bottom-0 left-[calc(100%+1rem)] w-80 bg-card/90 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden z-50"
                >
                  <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
                    <h3 className="font-serif text-lg text-white">Notificações</h3>
                    <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full font-bold">2 novas</span>
                  </div>
                  <div className="max-h-[60vh] overflow-y-auto p-2">
                    {notifications.map(notif => (
                      <div key={notif.id} className="p-3 rounded-xl hover:bg-white/5 transition-colors cursor-pointer relative group/notif">
                        {notif.unread && <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-primary rounded-full" />}
                        <div className={`pl-4 ${notif.unread ? 'text-white' : 'text-muted-foreground'}`}>
                          <p className="text-sm font-medium mb-1">{notif.title}</p>
                          <p className="text-xs opacity-70 mb-2">{notif.desc}</p>
                          <p className="text-[10px] font-mono opacity-50">{notif.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 border-t border-white/10 bg-black/20">
                    <button className="w-full text-center text-sm text-primary hover:text-white transition-colors">Marcar todas como lidas</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Link 
            href="/settings"
            className={`w-full flex items-center gap-4 px-3 py-3 rounded-2xl tv-focus outline-none relative overflow-hidden group/item transition-colors mb-4
              ${location === '/settings' ? 'text-white' : 'text-muted-foreground hover:text-white'}
            `}
          >
            {location === '/settings' && (
              <motion.div 
                layoutId="active-nav"
                className="absolute inset-0 bg-primary/20 rounded-2xl border border-primary/20"
                initial={false}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
            {location !== '/settings' && (
              <div className="absolute inset-0 bg-white/0 group-hover/item:bg-white/5 transition-colors rounded-2xl" />
            )}
            
            <Settings className="w-6 h-6 shrink-0 relative z-10" />
            <span className="text-lg font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-500 whitespace-nowrap relative z-10">Configurações</span>
          </Link>

          {/* Mini Player (New Feature 10) */}
          <AnimatePresence>
            {showMiniPlayer && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="w-full aspect-video rounded-2xl overflow-hidden relative group/mini mt-4 shrink-0 hidden group-hover:block"
              >
                <img src={"/images/poster-2.png"} className="w-full h-full object-cover opacity-60" alt="" />
                <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/40 to-transparent" />
                <button onClick={() => setShowMiniPlayer(false)} className="absolute top-2 right-2 text-white/50 hover:text-white opacity-0 group-hover/mini:opacity-100 transition-opacity">
                  <X className="w-4 h-4" />
                </button>
                <div className="absolute bottom-3 left-3 right-3">
                  <h4 className="text-xs font-bold text-white truncate mb-1">Solaris</h4>
                  <div className="flex items-center gap-2">
                    <button className="text-white hover:text-primary"><Play className="w-4 h-4" fill="currentColor" /></button>
                    <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                      <div className="h-full bg-primary w-1/3" />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.nav>
    </>
  );
}
