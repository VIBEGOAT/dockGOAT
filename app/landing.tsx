'use client';

import React from 'react';
import { ArrowRight, Zap, Shield, Clock, Beaker } from 'lucide-react';
import Link from 'next/link';

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Beaker className="w-6 h-6 text-gray-900" />
              <h1 className="text-2xl font-bold text-gray-900">dockGOAT</h1>
            </div>
            <nav className="flex items-center gap-6 text-sm">
              <a href="#features" className="text-gray-600 hover:text-gray-900">
                Features
              </a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900">
                Pricing
              </a>
              <a href="/app" className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800">
                Launch App
              </a>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 md:py-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Molecular Docking Made Simple
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
            Professional molecular docking simulations powered by AutoDock Vina. Built on free tiers for zero cost. No credit card required.
          </p>
          <Link
            href="/app"
            className="inline-flex items-center gap-2 px-8 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 font-medium text-lg"
          >
            Start Docking <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50 border-t border-gray-200">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-3xl md:text-4xl font-bold text-gray-900 mb-12 text-center">
            Built for Scale
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="p-6 bg-white rounded-lg border border-gray-200">
              <Zap className="w-8 h-8 text-gray-900 mb-4" />
              <h4 className="font-semibold text-gray-900 mb-2">Lightning Fast</h4>
              <p className="text-gray-600 text-sm">Results in minutes, not hours. Optimized for speed.</p>
            </div>
            <div className="p-6 bg-white rounded-lg border border-gray-200">
              <Shield className="w-8 h-8 text-gray-900 mb-4" />
              <h4 className="font-semibold text-gray-900 mb-2">Secure</h4>
              <p className="text-gray-600 text-sm">Enterprise-grade security with zero data retention.</p>
            </div>
            <div className="p-6 bg-white rounded-lg border border-gray-200">
              <Clock className="w-8 h-8 text-gray-900 mb-4" />
              <h4 className="font-semibold text-gray-900 mb-2">Real-time Updates</h4>
              <p className="text-gray-600 text-sm">Track job progress with live status updates.</p>
            </div>
            <div className="p-6 bg-white rounded-lg border border-gray-200">
              <Beaker className="w-8 h-8 text-gray-900 mb-4" />
              <h4 className="font-semibold text-gray-900 mb-2">AutoDock Vina</h4>
              <p className="text-gray-600 text-sm">Industry-standard docking engine built-in.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-3xl md:text-4xl font-bold text-gray-900 mb-12 text-center">
            Free Forever
          </h3>
          <div className="max-w-md mx-auto p-8 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="text-2xl font-bold text-gray-900 mb-4">Free Tier</h4>
            <ul className="space-y-3 mb-8">
              <li className="flex items-center gap-3 text-gray-700">
                <span className="text-gray-900">✓</span> Unlimited jobs
              </li>
              <li className="flex items-center gap-3 text-gray-700">
                <span className="text-gray-900">✓</span> Full AutoDock Vina access
              </li>
              <li className="flex items-center gap-3 text-gray-700">
                <span className="text-gray-900">✓</span> 10 GB storage
              </li>
              <li className="flex items-center gap-3 text-gray-700">
                <span className="text-gray-900">✓</span> Real-time tracking
              </li>
              <li className="flex items-center gap-3 text-gray-700">
                <span className="text-gray-900">✓</span> No credit card required
              </li>
            </ul>
            <Link
              href="/app"
              className="block w-full px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 font-medium text-center"
            >
              Get Started
            </Link>
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50 border-t border-gray-200">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            Built with Free Tiers
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <p className="font-semibold text-gray-900 mb-1">Frontend</p>
              <p className="text-gray-600 text-sm">Next.js + Vercel</p>
            </div>
            <div>
              <p className="font-semibold text-gray-900 mb-1">Database</p>
              <p className="text-gray-600 text-sm">MongoDB Atlas M0</p>
            </div>
            <div>
              <p className="font-semibold text-gray-900 mb-1">Storage</p>
              <p className="text-gray-600 text-sm">Supabase</p>
            </div>
            <div>
              <p className="font-semibold text-gray-900 mb-1">Compute</p>
              <p className="text-gray-600 text-sm">Hugging Face Spaces</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center">
          <h3 className="text-3xl font-bold text-gray-900 mb-6">Ready to dock?</h3>
          <p className="text-gray-600 mb-8 text-lg">Launch the app and start your first molecular docking simulation now.</p>
          <Link
            href="/app"
            className="inline-flex items-center gap-2 px-8 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 font-medium text-lg"
          >
            Open App <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">About</h4>
              <p className="text-gray-600 text-sm">
                dockGOAT is a commercial-grade molecular docking platform built on free cloud tiers.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Resources</h4>
              <ul className="text-gray-600 text-sm space-y-1">
                <li><a href="#" className="hover:text-gray-900">Documentation</a></li>
                <li><a href="https://github.com/VIBEGOAT/dockGOAT" target="_blank" rel="noopener noreferrer" className="hover:text-gray-900">GitHub</a></li>
                <li><a href="#" className="hover:text-gray-900">Support</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Legal</h4>
              <ul className="text-gray-600 text-sm space-y-1">
                <li><a href="#" className="hover:text-gray-900">Privacy</a></li>
                <li><a href="#" className="hover:text-gray-900">Terms</a></li>
                <li><a href="#" className="hover:text-gray-900">License</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-200 pt-8 text-center text-gray-600 text-sm">
            <p>© 2026 dockGOAT. MIT License. Open source.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
