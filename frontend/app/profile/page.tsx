'use client';

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

// 👇 IMPORTS RELATIVOS BLINDADOS (Adeus, erro do TypeScript!)
import { useProfile } from "../../features/profile/hooks/useProfile";
import { 
  ProfileHeader, 
  TelemetryGrid, 
  AnalyticsGrid, 
  ActivityPanels, 
  AuditFooter, 
  LogoutButton, 
  ProfileModals 
} from "../../components/profile/ProfileWidgets";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } }
};

export default function Profile() {
  const router = useRouter();
  
  // O Hook faz todo o trabalho sujo de buscar do Django
  const { data, isLoading, logout } = useProfile();

  const [activeModal, setActiveModal] = useState<"edit" | "lists" | "log" | "achievement" | null>(null);
  const [selectedAchievement, setSelectedAchievement] = useState<any>(null);

  // Função para salvar a edição do perfil (pode plugar na API no futuro)
  const handleSaveProfile = (name: string, bio: string) => {
    console.log("Salvar Perfil:", name, bio);
    // Aqui você chamaria algo como updateProfile({ name, bio })
    setActiveModal(null);
  };

  if (isLoading || !data) {
    return (
      <div style={{ background: '#080806', minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }} style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#BF8F3C', letterSpacing: '0.2em' }}>
          ACESSANDO DOSSIÊ DO OPERADOR...
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#080806', color: '#EDE8DC', paddingBottom: 120 }}>
      <div className="fixed inset-0 bg-noise opacity-[0.03] mix-blend-overlay pointer-events-none z-0" />
      
      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '120px 72px 0', position: 'relative', zIndex: 10 }}>
        <motion.div initial="hidden" animate="visible" variants={containerVariants}>
          
          {/* 1. Cabeçalho */}
          <ProfileHeader 
            user={data.user} 
            onEdit={() => setActiveModal('edit')} 
            onSettings={() => router.push('/settings')} 
          />

          {/* 2. Telemetria Geral */}
          <TelemetryGrid stats={data.stats} />

          {/* 3. Painel de Gráficos Dinâmicos */}
          <AnalyticsGrid charts={data.charts} />

          {/* 4. Listas e Registros */}
          <ActivityPanels 
            history={data.history} 
            onOpenModal={setActiveModal} 
          />

          {/* 5. Auditoria e Logs */}
          <AuditFooter 
            achievements={data.achievements} 
            logs={data.systemLogs} 
            onOpenAchievement={(ach) => { 
              setSelectedAchievement(ach); 
              setActiveModal('achievement'); 
            }} 
          />

          {/* 6. BOTÃO DE DESCONEXÃO TOTAL FUNCIONAL */}
          <LogoutButton onLogout={logout} />

        </motion.div>
      </main>

      {/* ── SEÇÃO DE MODAIS ── */}
      <ProfileModals 
        activeModal={activeModal} 
        onClose={() => setActiveModal(null)} 
        user={data.user} 
        selectedAchievement={selectedAchievement} 
        onSaveProfile={handleSaveProfile} 
      />
    </div>
  );
}