'use client';

import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseRadius: number;
  pulseSpeed: number;
  pulsePhase: number;
}

export default function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: 0, y: 0, isMoving: false });
  const animationRef = useRef<number>();
  const lastMoveTime = useRef<number>(Date.now());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Initialize particles with more variety
    const initParticles = () => {
      particlesRef.current = [];
      const particleCount = Math.min(Math.floor((canvas.width * canvas.height) / 12000), 80);
      
      for (let i = 0; i < particleCount; i++) {
        const baseRadius = Math.random() * 1.2 + 0.8;
        particlesRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.6,
          vy: (Math.random() - 0.5) * 0.6,
          radius: baseRadius,
          baseRadius: baseRadius,
          pulseSpeed: 0.02 + Math.random() * 0.03,
          pulsePhase: Math.random() * Math.PI * 2,
        });
      }
    };
    initParticles();

    // Mouse move listener with movement detection
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY, isMoving: true };
      lastMoveTime.current = Date.now();
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Check if mouse stopped moving
    const checkMouseMovement = () => {
      if (Date.now() - lastMoveTime.current > 100) {
        mouseRef.current.isMoving = false;
      }
    };

    // Animation loop
    const animate = () => {
      checkMouseMovement();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Check dark mode
      const isDark = document.documentElement.classList.contains('dark');
      
      const particles = particlesRef.current;
      const mouse = mouseRef.current;

      // Update and draw particles
      particles.forEach((particle, i) => {
        // Update position
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Bounce off walls
        if (particle.x - particle.radius < 0 || particle.x + particle.radius > canvas.width) {
          particle.vx *= -1;
          particle.x = Math.max(particle.radius, Math.min(canvas.width - particle.radius, particle.x));
        }
        if (particle.y - particle.radius < 0 || particle.y + particle.radius > canvas.height) {
          particle.vy *= -1;
          particle.y = Math.max(particle.radius, Math.min(canvas.height - particle.radius, particle.y));
        }

        // Cursor interaction - stronger repulsion when moving
        const dx = particle.x - mouse.x;
        const dy = particle.y - mouse.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const repelDistance = mouse.isMoving ? 150 : 100;

        if (distance < repelDistance) {
          const angle = Math.atan2(dy, dx);
          const force = (repelDistance - distance) / repelDistance;
          const strength = mouse.isMoving ? 0.5 : 0.3;
          particle.vx += Math.cos(angle) * force * strength;
          particle.vy += Math.sin(angle) * force * strength;
          
          // Pulse effect near cursor
          particle.radius = particle.baseRadius * (1 + force * 0.5);
        } else {
          // Return to base size
          particle.radius += (particle.baseRadius - particle.radius) * 0.1;
        }

        // Subtle pulsing animation
        particle.pulsePhase += particle.pulseSpeed;
        const pulseAmount = Math.sin(particle.pulsePhase) * 0.15;
        particle.radius = particle.baseRadius * (1 + pulseAmount);

        // Apply friction
        particle.vx *= 0.99;
        particle.vy *= 0.99;

        // Draw particle with glow effect
        const gradient = ctx.createRadialGradient(
          particle.x, particle.y, 0,
          particle.x, particle.y, particle.radius * 3
        );
        
        if (isDark) {
          gradient.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
          gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.08)');
          gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        } else {
          gradient.addColorStop(0, 'rgba(0, 0, 0, 0.12)');
          gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.06)');
          gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        }
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius * 3, 0, Math.PI * 2);
        ctx.fill();

        // Draw solid center
        ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)';
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw connections between nearby particles
      ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';
      ctx.lineWidth = 0.8;

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const maxDistance = 120;

          if (distance < maxDistance) {
            const opacity = (1 - distance / maxDistance) * 0.5;
            ctx.strokeStyle = isDark 
              ? `rgba(255, 255, 255, ${opacity * 0.15})` 
              : `rgba(0, 0, 0, ${opacity * 0.12})`;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw cursor glow effect when moving
      if (mouse.isMoving) {
        const cursorGradient = ctx.createRadialGradient(
          mouse.x, mouse.y, 0,
          mouse.x, mouse.y, 100
        );
        
        if (isDark) {
          cursorGradient.addColorStop(0, 'rgba(147, 197, 253, 0.08)');
          cursorGradient.addColorStop(1, 'rgba(147, 197, 253, 0)');
        } else {
          cursorGradient.addColorStop(0, 'rgba(59, 130, 246, 0.05)');
          cursorGradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
        }
        
        ctx.fillStyle = cursorGradient;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 100, 0, Math.PI * 2);
        ctx.fill();
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none bg-[#f5f5f7] dark:bg-black transition-colors duration-500"
    />
  );
}
