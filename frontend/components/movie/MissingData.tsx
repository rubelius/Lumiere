'use client';
import { motion } from "framer-motion";
import { AlertCircle } from "lucide-react";

export const MissingData = ({ label }: { label: string }) => (
  <motion.div 
    initial={{ opacity: 0, scale: 0.98 }}
    animate={{ opacity: 1, scale: 1 }}
    whileHover={{ backgroundColor: 'rgba(191,143,60,0.05)', borderColor: 'rgba(191,143,60,0.5)' }}
    style={{ 
      width: '100%', padding: '32px', border: '1px dashed rgba(86,84,80,0.4)', 
      backgroundColor: 'rgba(4,4,2,0.3)', display: 'flex', flexDirection: 'column', 
      alignItems: 'center', justifyContent: 'center', gap: '12px', transition: 'all 0.3s'
    }}
  >
    <AlertCircle style={{ width: 24, height: 24, color: '#8C8880' }} />
    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#8C8880', letterSpacing: '0.2em', textTransform: 'uppercase', textAlign: 'center' }}>
      [ REGISTRO INCOMPLETO: "{label}" NÃO LOCALIZADO NO BANCO DE DADOS ]
    </span>
  </motion.div>
);