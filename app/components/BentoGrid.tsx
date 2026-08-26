'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Database, Zap, Shield, Cpu } from 'lucide-react';

export default function BentoGrid() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6 },
    },
  };

  const cards = [
    {
      id: 1,
      title: 'Next.js 16',
      description: 'Server components & Turbopack',
      icon: Zap,
      span: 'col-span-1',
      color: 'from-blue-500/20 to-blue-500/5',
    },
    {
      id: 2,
      title: 'MongoDB Atlas',
      description: 'Scalable document database',
      icon: Database,
      span: 'col-span-1',
      color: 'from-green-500/20 to-green-500/5',
    },
    {
      id: 3,
      title: 'AutoDock Vina',
      description: 'Empirical scoring & GA',
      icon: Cpu,
      span: 'col-span-1 row-span-2',
      color: 'from-purple-500/20 to-purple-500/5',
    },
    {
      id: 4,
      title: 'Supabase',
      description: 'Real-time storage',
      icon: Shield,
      span: 'col-span-1',
      color: 'from-amber-500/20 to-amber-500/5',
    },
    {
      id: 5,
      title: 'Flexible Docking',
      description: 'Semi-flexible & full ligand flexibility',
      icon: Zap,
      span: 'col-span-2',
      color: 'from-rose-500/20 to-rose-500/5',
    },
  ];

  return (
    <motion.section
      id="features"
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-100px' }}
      className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
    >
      {/* Section header */}
      <motion.div variants={itemVariants} className="mb-16 text-center">
        <h2 className="text-4xl sm:text-5xl font-bold text-black dark:text-white mb-4 tracking-tight">
          Technology Stack
        </h2>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Built with modern tools and frameworks for scalable, high-performance molecular docking simulations.
        </p>
      </motion.div>

      {/* Bento Grid */}
      <motion.div
        variants={containerVariants}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {cards.map((card) => {
          const IconComponent = card.icon;
          return (
            <motion.div
              key={card.id}
              variants={itemVariants}
              whileHover={{ y: -8, transition: { duration: 0.3 } }}
              className={`${card.span} relative group`}
            >
              <div className="h-full rounded-3xl overflow-hidden">
                {/* Background gradient */}
                <div className={`absolute inset-0 bg-gradient-to-br ${card.color}`} />
                
                {/* Border */}
                <div className="absolute inset-0 border border-black/5 dark:border-white/10 rounded-3xl" />

                {/* Content */}
                <div className="relative h-full p-8 flex flex-col justify-between">
                  <div className="space-y-4">
                    <motion.div
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      className="w-12 h-12 rounded-xl bg-white dark:bg-white/10 shadow-sm flex items-center justify-center"
                    >
                      <IconComponent className="w-6 h-6 text-gray-900 dark:text-white" />
                    </motion.div>
                    <div>
                      <h3 className="text-xl font-bold text-black dark:text-white mb-1">{card.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{card.description}</p>
                    </div>
                  </div>

                  {/* Decorative element */}
                  <div className="absolute bottom-0 right-0 w-24 h-24 opacity-5 rounded-full bg-gradient-to-br from-blue-600 to-blue-400 blur-2xl" />
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </motion.section>
  );
}
