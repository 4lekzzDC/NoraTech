import { useState, useEffect, useMemo } from 'react';
import SolucoesHeader from '../components/SolucoesHeader';
import SolucoesSidebar from '../components/SolucoesSidebar';
import SolucaoCard from '../components/SolucaoCard';
import { HUB_SECTIONS, HUB_MODULES } from '../constants';

// Página principal da suite Soluções Contábeis.
// Mostra os módulos do Autonomy agrupados por seção, com cards clicáveis
// que levam à rota dedicada do módulo (real ou placeholder).

export default function SolucoesContabeisHub() {
  const [activeSection, setActiveSection] = useState(HUB_SECTIONS[0]?.id || 'sistema');

  const modulesBySection = useMemo(() => {
    return HUB_SECTIONS.map((section) => ({
      ...section,
      modules: HUB_MODULES.filter((m) => m.section === section.id),
    }));
  }, []);

  // Marca a seção em foco conforme o scroll passa por cada bloco.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        const top = visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        const id = top.target.id?.replace('section-', '');
        if (id) setActiveSection(id);
      },
      { rootMargin: '-30% 0px -55% 0px', threshold: 0 },
    );
    HUB_SECTIONS.forEach((s) => {
      const el = document.getElementById(`section-${s.id}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const handleSectionClick = (sectionId) => {
    setActiveSection(sectionId);
    const el = document.getElementById(`section-${sectionId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div style={{ minHeight: '100vh', background: '#08080a', color: '#eeede9', fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        body { -webkit-font-smoothing: antialiased; }
        a { color: inherit; }
        .solucao-card:hover { border-color: rgba(124, 58, 237,0.32) !important; background: rgba(255,255,255,0.04) !important; transform: translateY(-2px); }
        .solucao-card { transition: all 0.18s ease !important; }
        @media (max-width: 880px) { .hub-shell { flex-direction: column; } .hub-sidebar { display: none; } }
      `}</style>

      {/* Background glow (mesma vibe da Área do Cliente) */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', width: 720, height: 720, top: '-20%', right: '-10%', background: 'radial-gradient(circle, rgba(124, 58, 237,0.035) 0%, transparent 60%)', filter: 'blur(50px)' }} />
        <div style={{ position: 'absolute', width: 520, height: 520, bottom: '-10%', left: '-10%', background: 'radial-gradient(circle, rgba(37, 99, 235,0.025) 0%, transparent 60%)', filter: 'blur(50px)' }} />
      </div>

      <SolucoesHeader subtitle="Suite contábil migrada do Autonomy" />

      <div className="hub-shell" style={{ maxWidth: 1240, margin: '0 auto', padding: '0 32px', display: 'flex', gap: 32, position: 'relative', zIndex: 1 }}>
        <div className="hub-sidebar">
          <SolucoesSidebar activeSection={activeSection} onSectionClick={handleSectionClick} />
        </div>

        <main style={{ flex: 1, minWidth: 0, padding: '36px 0 80px' }}>
          {/* Intro */}
          <section style={{ marginBottom: 36 }}>
            <span style={{
              display: 'inline-block',
              fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1.5,
              color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase',
              marginBottom: 12,
            }}>
              Suite contratada
            </span>
            <h1 style={{ fontSize: '2.2rem', fontWeight: 800, letterSpacing: -0.8, marginBottom: 10 }}>
              Soluções Contábeis
            </h1>
            <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.55)', maxWidth: 680, lineHeight: 1.55 }}>
              Hub central dos módulos contábeis, fiscais, financeiros, de gestão e pessoal
              migrados do Autonomy para a infraestrutura da NoraTech. Selecione um sistema
              abaixo para começar.
            </p>
          </section>

          {/* Seções com cards */}
          {modulesBySection.map((section) => (
            <section
              key={section.id}
              id={`section-${section.id}`}
              style={{ marginBottom: 44, scrollMarginTop: 92 }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16, gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: -0.3 }}>
                    {section.title}
                  </h2>
                  <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
                    {section.subtitle}
                  </p>
                </div>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase' }}>
                  {section.modules.length} {section.modules.length === 1 ? 'módulo' : 'módulos'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
                {section.modules.map((module) => (
                  <SolucaoCard key={module.slug} module={module} />
                ))}
              </div>
            </section>
          ))}
        </main>
      </div>
    </div>
  );
}
