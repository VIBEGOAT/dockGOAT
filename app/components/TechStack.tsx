'use client';

import React from 'react';
import { motion } from 'framer-motion';

const stack = [
  { name: 'Next.js 16', detail: 'App Router · Turbopack' },
  { name: 'React 19', detail: 'Server & Client Components' },
  { name: 'MongoDB Atlas', detail: 'Scalable document store' },
  { name: 'AutoDock Vina', detail: 'Empirical scoring · GA' },
  { name: 'Supabase', detail: 'Real-time file storage' },
  { name: 'Framer Motion', detail: 'Physics-based animation' },
  { name: 'Tailwind CSS 4', detail: 'Utility-first styling' },
  { name: 'TypeScript', detail: 'Fully typed codebase' },
];

export default function TechStack() {
  return (
    <section className="relative py-20 px-4 sm:px-6 lg:px-8">
      {/* Top rule */}
      <div className="max-w-7xl mx-auto">
        <div className="w-full h-px bg-black/[0.06] dark:bg-white/[0.07] mb-16" />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          className="mb-10 text-center"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-[#86868B] dark:text-[#6e6e73]">
            Built with
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.05 } },
          }}
          className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-px bg-black/[0.05] dark:bg-white/[0.05] rounded-2xl overflow-hidden border border-black/[0.05] dark:border-white/[0.05]"
        >
          {stack.map((item) => (
            <motion.div
              key={item.name}
              variants={{
                hidden: { opacity: 0 },
                visible: { opacity: 1, transition: { duration: 0.4 } },
              }}
              whileHover={{ backgroundColor: 'rgba(0,0,0,0.015)' }}
              className="group flex flex-col items-center justify-center gap-1 px-4 py-6 bg-white dark:bg-[#0a0a0a] transition-colors duration-200"
            >
              <span className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e5e5e7] text-center leading-snug">
                {item.name}
              </span>
              <span className="text-[11px] text-[#86868B] dark:text-[#6e6e73] text-center leading-snug hidden sm:block">
                {item.detail}
              </span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
