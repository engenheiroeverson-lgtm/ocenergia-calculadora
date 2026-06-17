import React, { useState } from 'react';
import FormularioManual from './FormularioManual';
import UploadFatura from './UploadFatura';
import UploadRelatorioMassa from './UploadRelatorioMassa';

type Aba = 'manual' | 'fatura' | 'massa';

export default function TelaPrincipal() {
  const [abaAtiva, setAbaAtiva] = useState<Aba>('manual');

  return (
    <div style={styles.pagina}>
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <img src="/LOGO_OCENERGIA01.png" alt="OCENERGIA SOLAR" style={styles.logo} />
          <div>
            <h1 style={styles.headerTitle}>OCENERGIA SOLAR</h1>
            <p style={styles.headerSubtitle}>Sistema de dimensionamento de banco de capacitores</p>
          </div>
        </div>
      </header>

      <div style={styles.banner}>
        <img src="/geminifalai2_edit_output.png" alt="Banner OCENERGIA" style={styles.bannerImg} />
      </div>

      <main style={styles.main}>
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.cardHeaderInfo}>
              <span style={styles.cardKicker}>Padrão técnico</span>
              <h2 style={styles.cardTitle}>Calculadora industrial de FP</h2>
            </div>
            <div style={styles.badges}>
              <span style={styles.badge}>FP alvo: 0,95</span>
              <span style={styles.badge}>BT / MT / AT</span>
            </div>
          </div>
        </div>

        <div style={styles.abas}>
          <button
            type="button"
            style={{ ...styles.aba, ...(abaAtiva === 'manual' ? styles.abaAtiva : {}) }}
            onClick={() => setAbaAtiva('manual')}
          >
            Entrada manual
          </button>
          <button
            type="button"
            style={{ ...styles.aba, ...(abaAtiva === 'fatura' ? styles.abaAtiva : {}) }}
            onClick={() => setAbaAtiva('fatura')}
          >
            Fatura de energia
          </button>
          <button
            type="button"
            style={{ ...styles.aba, ...(abaAtiva === 'massa' ? styles.abaAtiva : {}) }}
            onClick={() => setAbaAtiva('massa')}
          >
            Relatório de massa
          </button>
        </div>

        <div style={styles.conteudo}>
          {abaAtiva === 'manual' && <FormularioManual />}
          {abaAtiva === 'fatura' && <UploadFatura />}
          {abaAtiva === 'massa' && <UploadRelatorioMassa />}
        </div>
      </main>

      <footer style={styles.footer}>
        <p style={styles.footerText}>
          OCENERGIA SOLAR — Sistema técnico de dimensionamento de banco de capacitores
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
  card: { background: '#FFFFFF', borderRadius: 16, padding: 20, border: '1px solid #D5E8F3', boxShadow: '0 4px 16px rgba(27,58,107,0.07)' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  cardHeaderInfo: { display: 'grid', gap: 4 },
  cardKicker: { fontSize: 11, fontWeight: 800, letterSpacing: 1.4, color: '#F39C12', textTransform: 'uppercase' },
  cardTitle: { margin: 0, fontSize: 20, fontWeight: 800, color: '#1B3A6B' },
  badges: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  badge: { padding: '6px 14px', borderRadius: 999, background: 'linear-gradient(135deg, #F39C12 0%, #E67E22 100%)', color: '#FFFFFF', fontWeight: 800, fontSize: 13 },
  abas: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  aba: { padding: '12px 20px', borderRadius: 10, border: '1px solid #D5E8F3', background: '#FFFFFF', color: '#475467', cursor: 'pointer', fontWeight: 700, fontSize: 14 },
  abaAtiva: { background: 'linear-gradient(135deg, #1B3A6B 0%, #2E86C1 100%)', color: '#FFFFFF', border: '1px solid transparent', boxShadow: '0 4px 12px rgba(27,58,107,0.18)' },
  conteudo: { display: 'grid', gap: 16 },
  footer: { background: '#1B3A6B', padding: '16px 24px', marginTop: 24 },
  footerText: { margin: 0, color: '#B3D4F5', fontSize: 13, textAlign: 'center' },
};