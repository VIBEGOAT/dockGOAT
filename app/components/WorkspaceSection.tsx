'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Database, UploadCloud } from 'lucide-react';

interface WorkspaceSectionProps {
  onFormTabClick?: () => void;
}

export default function WorkspaceSection({ onFormTabClick }: WorkspaceSectionProps) {
  const [activeTab, setActiveTab] = useState<'queue' | 'form'>('queue');

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
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

  return (
    <motion.section
      id="workspace"
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-100px' }}
      className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
    >
      {/* Section header */}
      <motion.div variants={itemVariants} className="mb-12 text-center">
        <h2 className="text-4xl sm:text-5xl font-bold text-black mb-4 tracking-tight">
          Workspace
        </h2>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Submit docking jobs and monitor the processing queue in real-time.
        </p>
      </motion.div>

      {/* Tab switcher */}
      <motion.div
        variants={itemVariants}
        className="flex gap-4 mb-8 bg-gray-100 rounded-full p-1 w-fit mx-auto"
      >
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setActiveTab('queue')}
          className={`px-6 py-2.5 rounded-full font-semibold transition-all duration-300 ${
            activeTab === 'queue'
              ? 'bg-white text-black shadow-md'
              : 'text-gray-600 hover:text-black'
          }`}
        >
          Processing Queue
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            setActiveTab('form');
            onFormTabClick?.();
          }}
          className={`px-6 py-2.5 rounded-full font-semibold transition-all duration-300 ${
            activeTab === 'form'
              ? 'bg-white text-black shadow-md'
              : 'text-gray-600 hover:text-black'
          }`}
        >
          Submit Job
        </motion.button>
      </motion.div>

      {/* Content grid */}
      <motion.div
        variants={containerVariants}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        {/* Queue Status Widget - Takes 2 columns on desktop */}
        {activeTab === 'queue' && (
          <motion.div
            variants={itemVariants}
            layoutId="queue-widget"
            className="lg:col-span-2 rounded-3xl bg-white border border-black/5 p-8 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center">
                  <Database className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-black">Processing Queue</h3>
                  <p className="text-sm text-gray-500">Real-time job monitoring</p>
                </div>
              </div>
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="flex items-center gap-2"
              >
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm font-medium text-gray-600">Active</span>
              </motion.div>
            </div>

            {/* Queue status display */}
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Jobs in Queue', value: '0', color: 'blue' },
                  { label: 'Completed', value: '0', color: 'green' },
                  { label: 'Failed', value: '0', color: 'red' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-gray-50 rounded-2xl p-4 text-center">
                    <p className="text-2xl font-bold text-black">{stat.value}</p>
                    <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* Empty state */}
              <div className="text-center py-12 bg-gray-50 rounded-2xl">
                <Database className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">No jobs in queue</p>
                <p className="text-sm text-gray-500 mt-1">Submit a job to get started</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Form Widget - Takes 2 columns on desktop when shown, or 1 column when queue is shown */}
        {activeTab === 'form' && (
          <motion.div
            variants={itemVariants}
            layoutId="form-widget"
            className="lg:col-span-2 rounded-3xl bg-white border border-black/5 p-8 shadow-sm"
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center">
                <UploadCloud className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-black">Submit Docking Job</h3>
                <p className="text-sm text-gray-500">PDBQT format required</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Placeholder for actual form - will be replaced with JobForm component */}
              <div className="space-y-4">
                <div className="relative">
                  <label className="text-sm font-semibold text-black block mb-2">
                    Target Disease <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Cancer, COVID-19, Alzheimer's"
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                  />
                </div>

                <div className="relative">
                  <label className="text-sm font-semibold text-black block mb-2">
                    Ligand File <span className="text-red-500">*</span>
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:border-blue-500 transition-colors cursor-pointer">
                    <UploadCloud className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-600">Drop file here or click to upload</p>
                    <p className="text-xs text-gray-500 mt-1">.pdbqt or .sdf</p>
                  </div>
                </div>

                <button className="w-full px-6 py-3.5 rounded-full bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors active:scale-95">
                  Submit to Queue
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Info cards - Right sidebar */}
        <motion.div
          variants={containerVariants}
          className="space-y-6"
        >
          {[
            {
              title: 'Grid Center',
              description: 'Configure search space coordinates and box dimensions',
              icon: '📍',
            },
            {
              title: 'Algorithm Params',
              description: 'Adjust exhaustiveness and energy range settings',
              icon: '⚙️',
            },
            {
              title: 'Results Export',
              description: 'Download affinity data and binding modes',
              icon: '📊',
            },
          ].map((card, idx) => (
            <motion.div
              key={idx}
              variants={itemVariants}
              whileHover={{ y: -4 }}
              className="rounded-2xl bg-white border border-black/5 p-6 shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex items-start gap-4">
                <span className="text-2xl">{card.icon}</span>
                <div>
                  <h4 className="font-semibold text-black mb-1">{card.title}</h4>
                  <p className="text-sm text-gray-600">{card.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </motion.section>
  );
}
