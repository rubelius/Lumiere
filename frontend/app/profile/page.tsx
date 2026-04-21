'use client';
import { Sidebar } from "@/components/layout/Sidebar";
import { motion } from "framer-motion";
import { User, Clock, Film, HardDrive, Edit3, Settings, Award, Star, Flame, Trophy, BarChart3, Activity, Bookmark, History, CalendarDays } from "lucide-react";

export default function Profile() {
  const stats = [
    { label: "Horas Assistidas", value: "342", icon: Clock },
    { label: "Títulos na Biblioteca", value: "128", icon: Film },
    { label: "Armazenamento", value: "4.2 TB", icon: HardDrive },
  ];

  const achievements = [
    { title: "Maratonista", desc: "Assistiu 5 filmes no mesmo dia", icon: Flame, color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/20" },
    { title: "Cinéfilo Noir", desc: "Assistiu 10 clássicos noir", icon: Star, color: "text-purple-500", bg: "bg-purple-500/10", border: "border-purple-500/20" },
    { title: "Audiófilo", desc: "100 horas de áudio Atmos", icon: Award, color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20" },
    { title: "Arquivista", desc: "Atingiu 4TB de mídia", icon: Trophy, color: "text-yellow-500", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground pl-24 pb-32 selection:bg-primary/30">
      <div className="fixed inset-0 bg-noise opacity-[0.03] mix-blend-overlay pointer-events-none z-50" />
      <Sidebar />
      
      {/* Abstract Background Glow */}
      <div className="absolute top-0 right-0 w-200 h-150 bg-primary/10 rounded-full blur-[150px] pointer-events-none -z-10" />

      <main className="max-w-350 mx-auto px-16 pt-20">
        
        {/* Profile Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row items-center md:items-start gap-10 mb-24 bg-card/30 p-10 rounded-[3rem] border border-white/5 backdrop-blur-md relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-linear-to-r from-primary/10 to-transparent pointer-events-none" />
          
          <div className="relative group">
            <div className="w-48 h-48 rounded-[2rem] overflow-hidden border-4 border-white/10 shadow-[0_0_50px_rgba(99,102,241,0.4)] group-hover:border-primary/50 transition-colors duration-500">
              <img src={"/images/hero-backdrop.png"} alt="Profile" className="w-full h-full object-cover filter grayscale mix-blend-luminosity group-hover:grayscale-0 group-hover:mix-blend-normal transition-all duration-700" />
            </div>
            <button className="absolute -bottom-4 -right-4 w-14 h-14 bg-primary rounded-full flex items-center justify-center text-white shadow-xl tv-focus hover:scale-110 transition-transform border-4 border-background">
              <Edit3 className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 text-center md:text-left pt-4 md:pl-6">
            <h1 className="text-6xl font-serif font-bold text-white mb-4 text-glow tracking-tight">Cinéfilo</h1>
            <p className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary font-bold tracking-[0.2em] text-sm uppercase mb-8">
              <Award className="w-4 h-4" /> Membro Premium
            </p>
            <p className="text-white/60 text-xl max-w-3xl leading-relaxed font-light">
              Apaixonado por clássicos noir e ficção científica contemplativa. Colecionador de edições <span className="text-white font-medium">REMUX</span> e áudio <span className="text-white font-medium">Atmos</span>.
            </p>
          </div>
          
          <button className="hidden md:flex p-5 rounded-[2rem] bg-white/5 border border-white/10 text-white tv-focus hover:bg-white/10 hover:border-white/30 transition-all shadow-lg hover:shadow-[0_0_30px_rgba(255,255,255,0.1)]">
            <Settings className="w-8 h-8" />
          </button>
        </motion.div>

        {/* Stats & Dashboard (Enhanced Feature) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
          {stats.map((stat, i) => (
            <motion.div 
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + (i * 0.1) }}
              className="bg-card/20 border border-white/5 p-10 rounded-[3rem] backdrop-blur-xl flex items-center gap-8 group hover:border-primary/30 transition-all duration-500 hover:shadow-[0_0_40px_rgba(99,102,241,0.15)] tv-focus cursor-pointer"
            >
              <div className="w-20 h-20 rounded-[2rem] bg-primary/10 flex items-center justify-center text-primary shadow-inner group-hover:bg-primary group-hover:text-white transition-colors duration-500 group-hover:scale-110">
                <stat.icon className="w-10 h-10" />
              </div>
              <div>
                <p className="text-5xl font-serif font-bold text-white mb-2 tracking-tight group-hover:text-primary transition-colors">{stat.value}</p>
                <p className="text-white/50 uppercase tracking-[0.2em] text-xs font-bold">{stat.label}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Extended Stats / Charts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mb-24 grid grid-cols-1 lg:grid-cols-2 gap-8"
        >
          <div className="bg-card/30 border border-white/5 p-8 rounded-3xl backdrop-blur-sm">
            <h3 className="text-2xl font-serif text-white mb-6 flex items-center gap-3">
              <BarChart3 className="w-6 h-6 text-primary" />
              Gêneros Favoritos
            </h3>
            <div className="space-y-5">
              {[
                { label: 'Sci-Fi', percent: 85, color: 'bg-blue-500' },
                { label: 'Noir', percent: 65, color: 'bg-purple-500' },
                { label: 'Drama', percent: 45, color: 'bg-green-500' },
                { label: 'Mistério', percent: 30, color: 'bg-orange-500' },
              ].map(genre => (
                <div key={genre.label}>
                  <div className="flex justify-between text-sm font-medium text-white mb-2">
                    <span>{genre.label}</span>
                    <span className="text-muted-foreground">{genre.percent}%</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      whileInView={{ width: `${genre.percent}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className={`h-full ${genre.color} rounded-full`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card/30 border border-white/5 p-8 rounded-3xl backdrop-blur-sm">
            <h3 className="text-2xl font-serif text-white mb-6 flex items-center gap-3">
              <Activity className="w-6 h-6 text-primary" />
              Hábitos de Visualização
            </h3>
            <div className="h-full flex items-end gap-3 pb-8 pt-4">
              {[40, 60, 30, 80, 100, 50, 70].map((h, i) => (
                <div key={i} className="flex-1 flex flex-col justify-end items-center gap-3 group">
                  <motion.div 
                    initial={{ height: 0 }}
                    whileInView={{ height: `${h}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: i * 0.1 }}
                    className="w-full bg-primary/30 rounded-t-lg group-hover:bg-primary transition-colors relative"
                  >
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 text-xs font-bold text-white bg-black/80 px-2 py-1 rounded">
                      {h}h
                    </div>
                  </motion.div>
                  <span className="text-xs font-medium text-muted-foreground uppercase">
                    {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'][i]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Lists & Diary (New Feature) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 mb-24">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-serif text-white flex items-center gap-3">
                <Bookmark className="w-8 h-8 text-primary" /> Listas Pessoais
              </h2>
              <button className="text-sm font-medium text-primary hover:text-white transition-colors">Ver todas</button>
            </div>
            
            <div className="space-y-4">
              {[
                { title: "Filmes Essenciais Noir", count: 24, bg: "bg-gradient-to-br from-gray-800 to-black" },
                { title: "Sessão Dupla: Anos 70", count: 12, bg: "bg-gradient-to-br from-purple-900 to-black" },
                { title: "Para Assistir no Outono", count: 8, bg: "bg-gradient-to-br from-orange-900 to-black" },
              ].map((list, i) => (
                <div key={i} className="flex items-center gap-6 p-4 rounded-2xl bg-card/30 border border-white/5 tv-focus group cursor-pointer hover:bg-card/50 transition-colors">
                  <div className={`w-20 h-20 rounded-xl ${list.bg} border border-white/10 flex items-center justify-center relative overflow-hidden group-hover:scale-105 transition-transform`}>
                    <Film className="w-8 h-8 text-white/30" />
                  </div>
                  <div>
                    <h3 className="text-xl font-serif text-white mb-1 group-hover:text-primary transition-colors">{list.title}</h3>
                    <p className="text-muted-foreground text-sm">{list.count} títulos</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.45 }}
          >
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-serif text-white flex items-center gap-3">
                <CalendarDays className="w-8 h-8 text-primary" /> Diário de Filmes
              </h2>
              <button className="text-sm font-medium text-primary hover:text-white transition-colors">Abrir Diário</button>
            </div>

            <div className="space-y-4">
              {[
                { title: "O Sétimo Selo", date: "15 Out", rating: 5, review: true },
                { title: "A Doce Vida", date: "12 Out", rating: 4, review: false },
                { title: "Acossado", date: "10 Out", rating: 4, review: true },
                { title: "Os Incompreendidos", date: "05 Out", rating: 5, review: true },
              ].map((entry, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-white/5 hover:bg-white/5 transition-colors group cursor-pointer">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-mono text-muted-foreground w-12">{entry.date}</span>
                    <h4 className="font-medium text-white group-hover:text-primary transition-colors">{entry.title}</h4>
                    {entry.review && <span className="p-1 bg-white/10 rounded"><History className="w-3 h-3 text-muted-foreground" /></span>}
                  </div>
                  <div className="flex text-primary/80">
                    {[...Array(5)].map((_, j) => (
                      <Star key={j} className={`w-4 h-4 ${j < entry.rating ? 'fill-current' : 'opacity-30'}`} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* Achievements / Badges (New Feature) */}
          <motion.section
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h2 className="text-3xl font-serif text-white mb-8 flex items-center gap-3">
              <Award className="w-8 h-8 text-primary" /> Conquistas
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {achievements.map((ach, i) => (
                <div key={i} className={`p-5 rounded-2xl border ${ach.border} ${ach.bg} flex flex-col gap-4 tv-focus hover:scale-[1.02] transition-transform cursor-pointer`}>
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center bg-background/50 ${ach.color} shadow-inner`}>
                    <ach.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className={`text-lg font-bold mb-1 ${ach.color}`}>{ach.title}</h4>
                    <p className="text-sm text-white/70">{ach.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.section>

          {/* Recent Activity Timeline (New Feature) */}
          <motion.section
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            <h2 className="text-3xl font-serif text-white mb-8">Linha do Tempo</h2>
            <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-linear-to-b before:from-transparent before:via-white/10 before:to-transparent">
              {[
                { title: "Assistiu L'Aventura", time: "Ontem, 21:30", badge: "REMUX", icon: "🎬" },
                { title: "Adicionou à coleção", time: "Há 2 dias", badge: "Sci-Fi", icon: "❤️" },
                { title: "Completou Maratona", time: "Há 5 dias", badge: "Conquista", icon: "🏆" },
              ].map((item, i) => (
                <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  {/* Icon */}
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white/20 bg-card text-lg text-slate-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 group-hover:bg-primary group-hover:border-primary transition-colors">
                    {item.icon}
                  </div>
                  {/* Card */}
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-5 rounded-2xl bg-card/30 border border-white/5 backdrop-blur-sm group-hover:bg-card/50 transition-colors tv-focus cursor-pointer">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-bold text-white text-lg">{item.title}</h4>
                      <span className="text-xs font-bold px-2 py-1 rounded bg-white/5 text-primary">{item.badge}</span>
                    </div>
                    <time className="font-mono text-sm text-muted-foreground">{item.time}</time>
                  </div>
                </div>
              ))}
            </div>
          </motion.section>
        </div>

      </main>
    </div>
  );
}