'use client'

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

const NAV = [
  { href: "/",         label: "Index",     number: "01" },
  { href: "/library",  label: "Archive",   number: "02" },
  { href: "/session",  label: "Session",   number: "03" },
  { href: "/party",    label: "Screening", number: "04" },
  { href: "/profile",  label: "Profile",   number: "05" },
  { href: "/settings", label: "Settings",  number: "06" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      {/* Sidebar */}
      <motion.aside
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        animate={{ width: expanded ? 200 : 56 }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="fixed left-0 top-0 bottom-0 z-50 flex flex-col overflow-hidden"
        style={{ background: 'rgba(10, 10, 10, 0.96)', backdropFilter: 'blur(24px)' }}
      >
        {/* Right border — filmic accent line */}
        <div
          className="absolute right-0 top-0 bottom-0 w-px"
          style={{
            background: `linear-gradient(
              to bottom,
              transparent 0%,
              rgba(201,169,110,0.12) 20%,
              rgba(201,169,110,0.25) 50%,
              rgba(201,169,110,0.12) 80%,
              transparent 100%
            )`
          }}
        />

        {/* Logo / Brand mark */}
        <div className="flex items-center h-16 px-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* L glyph */}
            <div
              className="flex-shrink-0 flex items-center justify-center"
              style={{ width: 24, height: 24 }}
            >
              <svg viewBox="0 0 24 24" fill="none" style={{ width: 20, height: 20 }}>
                <rect x="4" y="3" width="2" height="18" fill="#C9A96E"/>
                <rect x="4" y="19" width="12" height="2" fill="#C9A96E"/>
              </svg>
            </div>

            <AnimatePresence>
              {expanded && (
                <motion.span
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    color: '#F5F0E8',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Lumière
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(245,240,232,0.06)', marginBottom: 8 }} />

        {/* Navigation */}
        <nav className="flex flex-col gap-0.5 px-2 flex-1 pt-2">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative flex items-center gap-3 rounded-none"
                style={{
                  height: 40,
                  paddingLeft: 8,
                  paddingRight: 8,
                  position: 'relative',
                  transition: 'background 0.2s',
                  background: active ? 'rgba(201,169,110,0.06)' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(245,240,232,0.03)';
                }}
                onMouseLeave={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                {/* Active indicator — left border */}
                {active && (
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 4,
                      bottom: 4,
                      width: 2,
                      background: '#C9A96E',
                    }}
                  />
                )}

                {/* Number */}
                <span
                  style={{
                    fontFamily: "'Inter', system-ui, sans-serif",
                    fontSize: '0.6rem',
                    letterSpacing: '0.08em',
                    color: active ? '#C9A96E' : '#3D3D3D',
                    flexShrink: 0,
                    width: 20,
                    textAlign: 'right',
                    transition: 'color 0.2s',
                    userSelect: 'none',
                  }}
                >
                  {item.number}
                </span>

                {/* Label */}
                <AnimatePresence>
                  {expanded && (
                    <motion.span
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -6 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      style={{
                        fontFamily: "'Inter', system-ui, sans-serif",
                        fontSize: '0.7rem',
                        fontWeight: 500,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        color: active ? '#F5F0E8' : '#888880',
                        whiteSpace: 'nowrap',
                        transition: 'color 0.2s',
                      }}
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            );
          })}
        </nav>

        {/* Bottom — Film stock info */}
        <div
          style={{
            padding: '12px 8px',
            borderTop: '1px solid rgba(245,240,232,0.06)',
          }}
        >
          <AnimatePresence>
            {expanded ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{
                  fontFamily: "'Inter', system-ui, sans-serif",
                  fontSize: '0.6rem',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: '#3D3D3D',
                  lineHeight: 1.6,
                }}
              >
                <div>Personal Cinema</div>
                <div style={{ color: '#C9A96E', marginTop: 2 }}>v 1.0</div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  width: 2,
                  height: 24,
                  background: 'rgba(201,169,110,0.20)',
                  margin: '0 auto',
                }}
              />
            )}
          </AnimatePresence>
        </div>
      </motion.aside>
    </>
  );
}