'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';

/**
 * `next/image` sob o Framer Motion.
 *
 * A base usava `<motion.img>` cru para animar escala e filtro nos pôsteres e
 * backdrops, o que abria mão de redimensionamento, WebP e lazy loading. Isto
 * mantém a animação e devolve o otimizador.
 *
 * Regra de uso: `fill` só quando o elemento pai for posicionado
 * (`relative`/`absolute`/`fixed`) — senão o `position: absolute` que o `fill`
 * aplica escapa para o ancestral posicionado mais próximo e quebra o layout.
 * Onde o pai não for posicionado, passe `width`/`height` explícitos.
 */
export const MotionImage = motion.create(Image);
