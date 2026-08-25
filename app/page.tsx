'use client';

import React, { useState } from 'react';
import Header from './components/Header';
import JobForm from './components/JobForm';
import JobList from './components/JobList';

export default function Home() {
  const [jobListRefresh, setJobListRefresh] = useState<string>('');

  const handleJobSubmitted = (jobId: string) => {
    // Trigger job list refresh
    setJobListRefresh(jobId);
  };

  return (
    <main className="min-h-screen flex flex-col">
      <Header />

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column: Job Form */}
          <div className="lg:col-span-1">
            <JobForm onJobSubmitted={handleJobSubmitted} />
          </div>

          {/* Right column: Job List */}
          <div className="lg:col-span-2">
            <JobList refreshTrigger={jobListRefresh} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900/50 border-t border-slate-700 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="font-semibold text-white mb-4">About</h3>
              <p className="text-slate-400 text-sm">
                Commercial-grade molecular docking SaaS powered by AutoDock Vina.
                $0/month with free tiers.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">Technology</h3>
              <ul className="text-slate-400 text-sm space-y-2">
                <li>• Next.js + Vercel</li>
                <li>• MongoDB Atlas</li>
                <li>• Supabase Storage</li>
                <li>• Hugging Face Spaces</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">Documentation</h3>
              <ul className="text-slate-400 text-sm space-y-2">
                <li>• <a href="#" className="text-blue-400 hover:underline">Architecture</a></li>
                <li>• <a href="#" className="text-blue-400 hover:underline">API Docs</a></li>
                <li>• <a href="#" className="text-blue-400 hover:underline">Deployment</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-700 mt-8 pt-8 text-center text-slate-400 text-sm">
            <p>© 2026 dockGOAT. MIT License.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
