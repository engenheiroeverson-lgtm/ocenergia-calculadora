// src/modules/ui/TelaPrincipal.tsx
// SHELL multi-módulo da Plataforma OCENERGIA.
//
// Hierarquia em 3 níveis (substitui o plano achatado de abas):
//   Nível 1 — MÓDULO         : seletor de topo (5 módulos; inativos = "em breve")
//   Nível 2 — PERFIL         : toggle Leigo (B2C) / Profissional (B2B)
//   Nível 3 — ENTRADA        : sub-abas internas (hoje só o módulo de Capacitores)
//
// PRINCÍPIO: este shell APENAS embrulha os componentes já existentes. Não altera
// o interior de nenhum deles. Por isso NÃO injeta o prop `perfil` nos módulos
// (eles ainda não o aceitam) — em modo Leigo, exibe um aviso honesto e mantém a
// versão técnica utilizável. As visões Leigo serão construídas módulo a módulo.

import React, { useState } from 'react';
import FormularioManual from './FormularioManual';
import UploadFatura from './UploadFatura';
import UploadRelatorioMassa from './UploadRelatorioMassa';
import CalculadoraHibridaFP from './CalculadoraHibridaFP';
import PaginaDemanda from '../demanda/PaginaDemanda';

type Modulo = 'offgrid' | 'bess' | 'capacitores' | 'ongrid' | 'residencial';
type Perfil = 'leigo' | 'profissional';
type AbaEntrada = 'manual' | 'fatura' | 'massa' | 'hibrida';

interface ModuloDef {
  id: Modulo;
  label: string;
  titulo: string;
  badges: string[];
  ativo: boolean; // false = "em breve" (botão desabilitado)
}

// Os 5 módulos do escopo. Off-grid (I) e os módulos IV/V entram como "em breve"
// até serem portados/construídos neste repositório.
const MODULOS: ModuloDef[] = [
  { id: 'offgrid', label: 'Solar Off-grid', titulo: 'Dimensionamento Solar Off-grid (sistemas isolados)', badges: ['Off-grid', 'Baterias LFP'], ativo: false },
  { id: 'bess', label: 'Gestão de Demanda / BESS', titulo: 'Gestão de Demanda e dimensionamento BESS (Grupo A)', badges: ['BESS WEG', 'Grupo A'], ativo: true },
  { id: 'capacitores', label: 'Fator de Potência', titulo: 'Calculadora industrial de Fator de Potência', badges: ['FP alvo: 0,95', 'BT / MT / AT'], ativo: true },
  { id: 'ongrid', label: 'Solar On-grid', titulo: 'Simulador Solar On-grid (Lei 14.300)', badges: ['Geração Distribuída', 'Lei 14.300'], ativo: false },
  { id: 'residencial', label: 'Residencial', titulo: 'Instalações residenciais (NBR 5410)', badges: ['NBR 5410', 'Quadro de cargas'], ativo: false },
];

export default function TelaPrincipal() {
  const [modulo, setModulo] = useState<Modulo>('capacitores');
  const [perfil, setPerfil] = useState<Perfil>('profissional');
  const [abaEntrada, setAbaEntrada] = useState<AbaEntrada>('manual');

  const def = MODULOS.find((m) => m.id === modulo) ?? MODULOS[2];

  return (
    <div style={styles.pagina}>
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <img src="/LOGO_OCENERGIA01.png" alt="OCENERGIA SOLAR" style={styles.logo} />
          <div>
            <h1 style={styles.headerTitle}>OCENERGIA SOLAR</h1>
            <p style={styles.headerSubtitle}>Plataforma de Engenharia Energética</p>
          </div>
        </div>
      </header>

      <div style={styles.banner}>
        <img src="/geminifalai2_edit_output.png" alt="Banner OCENERGIA" style={styles.bannerImg} />
      </div>

      <main style={styles.main}>
        {/* ── NÍVEL 1 — Seletor de módulo ───────────────────────────────── */}
        <nav style={styles.moduloNav} aria-label="Módulos">
          {MODULOS.map((m) => {
            const ativoSel = modulo === m.id;
            return (
              <button
                key={m.id}
                type="button"
                disabled={!m.ativo}
                onClick={() => m.ativo && setModulo(m.id)}
                title={m.ativo ? m.titulo : 'Em breve'}
                style={{
                  ...styles.moduloBtn,
                  ...(ativoSel ? styles.moduloBtnAtivo : {}),
                  ...(!m.ativo ? styles.moduloBtnDisabled : {}),
                }}
              >
                {m.label}
                {!m.ativo && <span style={styles.emBreve}>em breve</span>}
              </button>
            );
          })}
        </nav>

        {/* ── Cartão de contexto + NÍVEL 2 (perfil) ─────────────────────── */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.cardHeaderInfo}>
              <span style={styles.cardKicker}>Padrão técnico</span>
              <h2 style={styles.cardTitle}>{def.titulo}</h2>
            </div>
            <div style={styles.badges}>
              {def.badges.map((b) => (
                <span key={b} style={styles.badge}>{b}</span>
              ))}
            </div>
          </div>

          <div style={styles.perfilRow}>
            <span style={styles.perfilLabel}>Modo de uso</span>
            <div style={styles.perfilToggle}>
              <button
                type="button"
                onClick={() => setPerfil('leigo')}
                style={perfil === 'leigo' ? styles.perfilOn : styles.perfilOff}
              >
                👤 Cliente (B2C)
              </button>
              <button
                type="button"
                onClick={() => setPerfil('profissional')}
                style={perfil === 'profissional' ? styles.perfilOn : styles.perfilOff}
              >
                🔧 Técnico (B2B)
              </button>
            </div>
          </div>
        </div>

        {/* ── Aviso honesto: visão Leigo ainda em construção ────────────── */}
        {perfil === 'leigo' && (
          <div style={styles.avisoLeigo}>
            A versão <strong>simplificada (Cliente / B2C)</strong> deste módulo está em
            desenvolvimento. Abaixo segue a <strong>versão técnica completa</strong>, que
            permanece totalmente utilizável.
          </div>
        )}

        {/* ── NÍVEL 3 — Sub-abas de entrada (apenas Capacitores) ────────── */}
        {modulo === 'capacitores' && (
          <div style={styles.abas}>
            <button
              type="button"
              style={{ ...styles.aba, ...(abaEntrada === 'manual' ? styles.abaAtiva : {}) }}
              onClick={() => setAbaEntrada('manual')}
            >
              Entrada manual
            </button>
            <button
              type="button"
              style={{ ...styles.aba, ...(abaEntrada === 'fatura' ? styles.abaAtiva : {}) }}
              onClick={() => setAbaEntrada('fatura')}
            >
              Fatura de energia
            </button>
            <button
              type="button"
              style={{ ...styles.aba, ...(abaEntrada === 'massa' ? styles.abaAtiva : {}) }}
              onClick={() => setAbaEntrada('massa')}
            >
              Relatório de massa
            </button>
            <button
              type="button"
              style={{ ...styles.aba, ...(abaEntrada === 'hibrida' ? styles.abaAtiva : {}) }}
              onClick={() => setAbaEntrada('hibrida')}
            >
              Híbrida (Trafo / Motor) 🆕
            </button>
          </div>
        )}

        {/* ── Conteúdo do módulo ativo ──────────────────────────────────── */}
        <div style={styles.conteudo}>
          {modulo === 'capacitores' && abaEntrada === 'manual' && <FormularioManual />}
          {modulo === 'capacitores' && abaEntrada === 'fatura' && <UploadFatura />}
          {modulo === 'capacitores' && abaEntrada === 'massa' && <UploadRelatorioMassa />}
          {modulo === 'capacitores' && abaEntrada === 'hibrida' && <CalculadoraHibridaFP />}
          {modulo === 'bess' && <PaginaDemanda />}
        </div>
      </main>

      <footer style={styles.footer}>
        <p style={styles.footerText}>
          OCENERGIA SOLAR — Plataforma de Engenharia Energética (Off-grid, BESS/Demanda,
          Fator de Potência, On-grid e Residencial)
        </p>
      </footer>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  pagina: { minHeight: '100vh', display: 'grid', gridTemplateRows: 'auto auto 1fr auto', background: '#F4F6F9' },
  header: { background: 'linear-gradient(135deg, #1B3A6B 0%, #2E86C1 100%)', padding: '16px 24px', boxShadow: '0 4px 16px rgba(27,58,107,0.18)' },
  headerInner: { display: 'flex', alignItems: 'center', gap: 16, maxWidth: 1200, margin: '0 auto' },
  logo: { height: 56, width: 'auto', objectFit: 'contain' },
  headerTitle: { margin: 0, fontSize: 22, fontWeight: 800, color: '#FFFFFF', letterSpacing: 0.5 },
  headerSubtitle: { margin: '4px 0 0', fontSize: 13, color: '#B3D4F5', fontWeight: 500 },
  banner: { width: '100%', maxHeight: 220, overflow: 'hidden', background: '#1B3A6B' },
  bannerImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  main: { maxWidth: 1200, margin: '0 auto', padding: '24px 16px', display: 'grid', gap: 20, width: '100%' },

  // Nível 1 — módulos
  moduloNav: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  moduloBtn: { position: 'relative', padding: '12px 18px', borderRadius: 12, border: '1px solid #D5E8F3', background: '#FFFFFF', color: '#1B3A6B', cursor: 'pointer', fontWeight: 800, fontSize: 14 },
  moduloBtnAtivo: { background: 'linear-gradient(135deg, #1B3A6B 0%, #2E86C1 100%)', color: '#FFFFFF', border: '1px solid transparent', boxShadow: '0 4px 12px rgba(27,58,107,0.18)' },
  moduloBtnDisabled: { background: '#EEF3F8', color: '#98A6B5', cursor: 'not-allowed', borderStyle: 'dashed' },
  emBreve: { marginLeft: 8, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6, background: '#D5E8F3', color: '#5C7A99', borderRadius: 999, padding: '2px 7px' },

  card: { background: '#FFFFFF', borderRadius: 16, padding: 20, border: '1px solid #D5E8F3', boxShadow: '0 4px 16px rgba(27,58,107,0.07)', display: 'grid', gap: 16 },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  cardHeaderInfo: { display: 'grid', gap: 4 },
  cardKicker: { fontSize: 11, fontWeight: 800, letterSpacing: 1.4, color: '#F39C12', textTransform: 'uppercase' },
  cardTitle: { margin: 0, fontSize: 20, fontWeight: 800, color: '#1B3A6B' },
  badges: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  badge: { padding: '6px 14px', borderRadius: 999, background: 'linear-gradient(135deg, #F39C12 0%, #E67E22 100%)', color: '#FFFFFF', fontWeight: 800, fontSize: 13 },

  // Nível 2 — perfil
  perfilRow: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', borderTop: '1px solid #EEF3F8', paddingTop: 12 },
  perfilLabel: { fontSize: 13, fontWeight: 800, color: '#475467', textTransform: 'uppercase', letterSpacing: 0.6 },
  perfilToggle: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  perfilOn: { padding: '10px 16px', borderRadius: 10, border: '2px solid #2E86C1', background: '#EEF5FF', color: '#1B3A6B', fontWeight: 700, cursor: 'pointer' },
  perfilOff: { padding: '10px 16px', borderRadius: 10, border: '1px solid #D5E8F3', background: '#FFFFFF', color: '#475467', fontWeight: 600, cursor: 'pointer' },

  avisoLeigo: { padding: 14, borderRadius: 10, background: '#FFFAEB', border: '1px solid #FEDF89', color: '#B54708', fontSize: 14, lineHeight: 1.5 },

  // Nível 3 — entrada
  abas: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  aba: { padding: '12px 20px', borderRadius: 10, border: '1px solid #D5E8F3', background: '#FFFFFF', color: '#475467', cursor: 'pointer', fontWeight: 700, fontSize: 14 },
  abaAtiva: { background: 'linear-gradient(135deg, #1B3A6B 0%, #2E86C1 100%)', color: '#FFFFFF', border: '1px solid transparent', boxShadow: '0 4px 12px rgba(27,58,107,0.18)' },

  conteudo: { display: 'grid', gap: 16 },
  footer: { background: '#1B3A6B', padding: '16px 24px', marginTop: 24 },
  footerText: { margin: 0, color: '#B3D4F5', fontSize: 13, textAlign: 'center' },
};
