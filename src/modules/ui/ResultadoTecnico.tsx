import React from 'react';
import type { ResultadoCalculadoraIndustrial } from '../../types/types';

export default function ResultadoTecnico({
  resultado,
}: {
  resultado: ResultadoCalculadoraIndustrial;
}) {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <p style={styles.kicker}>Resultado técnico</p>
          <h2 style={styles.title}>Dimensionamento do banco de capacitores</h2>
          <p style={styles.subtitle}>{resultado.mensagem}</p>
        </div>
        <div style={{
          ...styles.badge,
          background: resultado.precisaCorrecao ? '#FFF4E5' : '#ECFDF3',
          color: resultado.precisaCorrecao ? '#B54708' : '#027A48',
        }}>
          {resultado.precisaCorrecao ? 'Correção necessária' : 'FP já adequado'}
        </div>
      </div>

      <div style={styles.gridResumo}>
        <Card label="FP atual" value={resultado.fpAtual.toFixed(2)} />
        <Card label="FP alvo" value={resultado.fpAlvo.toFixed(2)} />
        <Card label="Potência ativa" value={`${resultado.potenciaAtivaKw.toFixed(2)} kW`} />
        <Card label="Tensão" value={`${resultado.tensaoV.toFixed(0)} V`} />
        <Card label="Nível de tensão" value={resultado.nivelTensao.toUpperCase()} />
        <Card label="Ligação sugerida" value={resultado.tipoLigacaoSugerida} />
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Recomendação principal</h3>
        <div style={styles.recomendacaoBox}>
          <p style={styles.linha}><strong>Tipo de banco:</strong> {resultado.tipoBancoRecomendado}</p>
          <p style={styles.linha}><strong>Qc calculado:</strong> {resultado.qcKvar.toFixed(2)} kVAr</p>
          <p style={styles.linha}><strong>Qc com margem:</strong> {resultado.qcComMargemKvar.toFixed(2)} kVAr</p>
          {resultado.banco.alerta && (
            <div style={styles.alertaBox}><strong>Alerta:</strong> {resultado.banco.alerta}</div>
          )}
        </div>
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Banco recomendado</h3>
        <div style={styles.bancoBox}>
          <p style={styles.linha}><strong>Estratégia:</strong> {resultado.banco.estrategia}</p>
          <p style={styles.linha}><strong>Total instalado:</strong> {resultado.banco.totalKvarInstalado.toFixed(2)} kVAr</p>
        </div>
        {resultado.banco.etapas.length > 0 ? (
          <div style={styles.tabelaWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Etapa</th>
                  <th style={styles.th}>kVAr por etapa</th>
                  <th style={styles.th}>Quantidade</th>
                  <th style={styles.th}>Total</th>
                </tr>
              </thead>
              <tbody>
                {resultado.banco.etapas.map((etapa, index) => (
                  <tr key={index}>
                    <td style={styles.td}>{index + 1}</td>
                    <td style={styles.td}>{etapa.kvar.toFixed(2)} kVAr</td>
                    <td style={styles.td}>{etapa.quantidade}</td>
                    <td style={styles.td}>{(etapa.kvar * etapa.quantidade).toFixed(2)} kVAr</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: '#475467' }}>Nenhuma etapa necessária.</p>
        )}
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Observações técnicas</h3>
        <ul style={styles.lista}>
          {resultado.observacoesTecnicas.map((obs, index) => (
            <li key={index} style={styles.itemLista}>{obs}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.card}>
      <span style={styles.cardLabel}>{label}</span>
      <strong style={styles.cardValue}>{value}</strong>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'grid', gap: 16, padding: 20, borderRadius: 16, background: '#FFFFFF', border: '1px solid #D5E8F3', boxShadow: '0 8px 24px rgba(27,58,107,0.08)', marginTop: 20 },
  header: { display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' },
  kicker: { margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: 1.2, color: '#F39C12', textTransform: 'uppercase' },
  title: { margin: '4px 0 0', fontSize: 24, fontWeight: 800, color: '#1B3A6B' },
  subtitle: { margin: '8px 0 0', color: '#475467', lineHeight: 1.5 },
  badge: { padding: '10px 14px', borderRadius: 999, fontWeight: 800, fontSize: 13, whiteSpace: 'nowrap' },
  gridResumo: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 },
  card: { padding: 14, borderRadius: 12, background: '#F4F6F9', border: '1px solid #D5E8F3', display: 'grid', gap: 6 },
  cardLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4, color: '#475467', fontWeight: 700 },
  cardValue: { fontSize: 15, color: '#101828', wordBreak: 'break-word' },
  section: { display: 'grid', gap: 10 },
  sectionTitle: { margin: 0, fontSize: 18, fontWeight: 800, color: '#1B3A6B' },
  recomendacaoBox: { padding: 16, borderRadius: 14, background: '#EEF5FF', border: '1px solid #D5E8F3' },
  bancoBox: { padding: 16, borderRadius: 14, background: '#F4F6F9', border: '1px solid #D5E8F3' },
  linha: { margin: '0 0 8px', color: '#101828', lineHeight: 1.5 },
  alertaBox: { marginTop: 10, padding: 12, borderRadius: 12, background: '#FFF7ED', border: '1px solid #FEDF89', color: '#B54708', fontWeight: 600 },
  tabelaWrapper: { overflowX: 'auto', borderRadius: 12, border: '1px solid #D5E8F3' },
  table: { width: '100%', borderCollapse: 'collapse', background: '#FFFFFF' },
  th: { textAlign: 'left', padding: '12px 14px', fontSize: 13, fontWeight: 800, color: '#1B3A6B', background: '#F4F6F9', borderBottom: '1px solid #D5E8F3', whiteSpace: 'nowrap' },
  td: { padding: '12px 14px', fontSize: 14, color: '#101828', borderBottom: '1px solid #EEF2F6', whiteSpace: 'nowrap' },
  lista: { margin: 0, paddingLeft: 20, display: 'grid', gap: 8 },
  itemLista: { color: '#101828', lineHeight: 1.5 },
};