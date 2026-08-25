import React from 'react';
import { Beaker, Github } from 'lucide-react';

export default function Header() {
  return (
    <header className="bg-slate-900/50 border-b border-slate-700 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-lg">
              <Beaker className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">dockGOAT</h1>
              <p className="text-slate-400 text-sm">Molecular Docking Platform</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              title="GitHub"
            >
              <Github className="w-5 h-5 text-slate-300" />
            </a>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
            <p className="text-slate-400 text-sm">Database</p>
            <p className="text-white font-semibold">MongoDB Atlas</p>
          </div>
          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
            <p className="text-slate-400 text-sm">Storage</p>
            <p className="text-white font-semibold">Supabase</p>
          </div>
          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
            <p className="text-slate-400 text-sm">Compute</p>
            <p className="text-white font-semibold">HF Spaces</p>
          </div>
        </div>
      </div>
    </header>
  );
}
