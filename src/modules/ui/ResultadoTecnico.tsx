import React, { useEffect, useState } from 'react';
import type { ResultadoCalculadoraIndustrial } from '../../types/types';
import CadastroLead, { type DadosLead } from './CadastroLead';

const cores = {
  azulEscuro: '#1B3A6B',
  azulMedio: '#2E86C1',
  laranja: '#F39C12',
  laranjaEscuro: '#E67E22',
  branco: '#FFFFFF',
  cinzaFundo: '#F4F6F9',
  cinzaBorda: '#D5E8F3',
  cinzaTexto: '#475467',
  verde: '#027A48',
  verdeFundo: '#ECFDF3',
  verdeBorda: '#A6F4C5',
  amareloFundo: '#FFFAEB',
  amareloBorda: '#FEDF89',
  amareloTexto: '#B54708',
  vermelhoFundo: '#FEF3F2',
  vermelhoBorda: '#FECDCA',
  vermelhoTexto: '#B42318',
};

export default function ResultadoTecnico({
  resultado,
}: {
  resultado: ResultadoCalculadoraIndustrial;
}) {
  const {
    fpAtual,
    fpAlvo,
    potenciaAtivaKw,
    tensaoV,
    nivelTensao,
    qcKvar,
    qcComMargemKvar,
    tipoBancoRecomendado,
    tipoLigacaoSugerida,
    tensaoTrabalhoCapacitor,
    normaAplicavel,
    banco,
    precisaCorrecao,
    mensagem,
    observacoesTecnicas,
  } = resultado;

  const [lead, setLead] = useState<DadosLead | null>(null);

  // Recuperar lead salvo no localStorage
  useEffect(() => {
    try {
      const salvo = localStorage.getItem('ocenergia_lead');
      if (salvo) setLead(JSON.parse(salvo));
    } catch (_) {}
  }, []);

  function handleSalvarLead(dados: DadosLead) {
    setLead(dados);
  }

  const corStatus = precisaCorrecao ? cores.vermelhoFundo : cores.verdeFundo;
  const bordaStatus = precisaCorrecao ? cores.vermelhoBorda : cores.verdeBorda;
  const textoStatus = precisaCorrecao ? cores.vermelhoTexto : cores.verde;
  const labelStatus = precisaCorrecao ? 'Correção necessária' : 'FP adequado';

  const nomeLead = lead?.nome ?? '';

  const assuntoEmail = encodeURIComponent(
    'Orçamento / dúvida técnica - OCENERGIA SOLAR',
  );

  const corpoEmail = encodeURIComponent(
    `Olá, equipe OCENERGIA SOLAR,

${nomeLead ? `Meu nome é ${nomeLead}.` : ''}
Gostaria de solicitar um orçamento com base no cálculo abaixo:

- Potência ativa: ${potenciaAtivaKw.toFixed(2)} kW
- FP atual: ${fpAtual.toFixed(3)}
- FP alvo: ${fpAlvo.toFixed(2)}
- Tensão: ${tensaoV.toLocaleString('pt-BR')} V
- Nível de tensão: ${nivelTensao}
- Qc calculado: ${qcKvar.toFixed(2)} kVAr
- Qc com margem: ${qcComMargemKvar.toFixed(2)} kVAr
- Tipo de banco: ${tipoBancoRecomendado}
- Ligação sugerida: ${tipoLigacaoSugerida}
- Tensão de trabalho dos capacitores: ${tensaoTrabalhoCapacitor}
- Norma técnica: ${normaAplicavel}
${lead?.whatsapp ? `\nWhatsApp para contato: ${lead.whatsapp}` : ''}
${lead?.empresa ? `Empresa: ${lead.empresa}` : ''}
${lead?.cidade ? `Cidade: ${lead.cidade}` : ''}
${lead?.estado ? `Estado: ${lead.estado}` : ''}

Aguardo retorno.`,
  );

  const whatsappTexto = encodeURIComponent(
    `Olá, OCENERGIA SOLAR!${nomeLead ? ` Meu nome é ${nomeLead}.` : ''}

Acabei de usar a calculadora de banco de capacitores e gostaria de um orçamento.

Resumo do cálculo:
- Potência: ${potenciaAtivaKw.toFixed(2)} kW
- FP atual: ${fpAtual.toFixed(3)}
- FP alvo: ${fpAlvo.toFixed(2)}
- Tensão: ${tensaoV.toLocaleString('pt-BR')} V
- Qc com margem: ${qcComMargemKvar.toFixed(2)} kVAr
- Tipo de banco: ${tipoBancoRecomendado}`,
  );

  return (
    <div style={styles.container}>

      {/* Cabeçalho */}
      <div style={styles.header}>
        <span style={styles.kicker}>Resultado técnico</span>
        <h2 style={styles.title}>
          Dimensionamento do banco de capacitores
        </h2>
      </div>

      {/* Status */}
      <div style={{
        ...styles.statusBox,
        background: corStatus,
        border: `1px solid ${bordaStatus}`,
      }}>
        <span style={{ ...styles.statusLabel, color: textoStatus }}>
          {labelStatus}
        </span>
        <p style={{ ...styles.statusMsg, color: textoStatus }}>
          {mensagem}
        </p>
      </div>

      {/* Cards principais */}
      <div style={styles.grid4}>
        <Card label="FP ATUAL" value={fpAtual.toFixed(3)} destaque={!precisaCorrecao} />
        <Card label="FP ALVO" value={fpAlvo.toFixed(2)} />
        <Card label="POTÊNCIA ATIVA" value={`${potenciaAtivaKw.toFixed(2)} kW`} />
        <Card label="TENSÃO" value={`${tensaoV.toLocaleString('pt-BR')} V`} />
      </div>

      <div style={styles.grid2}>
        <Card label="NÍVEL DE TENSÃO" value={nivelTensao.toUpperCase()} />
        <Card label="LIGAÇÃO SUGERIDA" value={tipoLigacaoSugerida} />
      </div>

      {/* Tensão de trabalho e norma */}
      <div style={styles.tensaoBox}>
        <div style={styles.tensaoItem}>
          <span style={styles.tensaoLabel}>
            Tensão de trabalho dos capacitores
          </span>
          <strong style={styles.tensaoValor}>{tensaoTrabalhoCapacitor}</strong>
        </div>
        <div style={styles.tensaoItem}>
          <span style={styles.tensaoLabel}>Norma técnica aplicável</span>
          <strong style={styles.tensaoValor}>{normaAplicavel}</strong>
        </div>
      </div>

      {/* Recomendação */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Recomendação principal</h3>
        <div style={styles.grid3}>
          <InfoItem label="Tipo de banco" value={tipoBancoRecomendado} />
          <InfoItem label="Qc calculado" value={`${qcKvar.toFixed(2)} kVAr`} />
          <InfoItem label="Qc com margem (5%)" value={`${qcComMargemKvar.toFixed(2)} kVAr`} />
        </div>
      </div>

      {/* Banco recomendado */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Banco recomendado</h3>
        <div style={styles.grid2}>
          <InfoItem label="Estratégia" value={banco.estrategia} />
          <InfoItem label="Total instalado" value={`${banco.totalKvarInstalado.toFixed(2)} kVAr`} />
        </div>

        {banco.etapas.length > 0 ? (
          <div style={styles.tabelaWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Etapa</th>
                  <th style={styles.th}>kVAr / etapa</th>
                  <th style={styles.th}>Qtd</th>
                  <th style={styles.th}>Total</th>
                  <th style={styles.th}>Tensão trabalho</th>
                  <th style={styles.th}>Ligação</th>
                </tr>
              </thead>
              <tbody>
                {banco.etapas.map((etapa, idx) => (
                  <tr key={idx} style={idx % 2 === 0 ? styles.trPar : styles.trImpar}>
                    <td style={styles.td}>{idx + 1}</td>
                    <td style={styles.td}>{etapa.kvar.toFixed(2)} kVAr</td>
                    <td style={styles.td}>{etapa.quantidade}</td>
                    <td style={styles.td}>{(etapa.kvar * etapa.quantidade).toFixed(2)} kVAr</td>
                    <td style={styles.td}>{tensaoTrabalhoCapacitor}</td>
                    <td style={styles.td}>{tipoLigacaoSugerida}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={styles.semEtapas}>
            Nenhuma etapa de banco necessária com os dados informados.
          </div>
        )}

        {banco.alerta && (
          <div style={styles.alertaBox}>
            <strong>Atenção:</strong> {banco.alerta}
          </div>
        )}
      </div>

      {/* Observações técnicas */}
      {observacoesTecnicas.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Observações técnicas</h3>
          <ul style={styles.obsList}>
            {observacoesTecnicas.map((obs, idx) => (
              <li key={idx} style={styles.obsItem}>{obs}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ─── CADASTRO DE LEAD ─────────────────────────────────────────── */}
      <CadastroLead
        onSalvar={handleSalvarLead}
        dadosSalvos={lead}
      />

      {/* ─── CONTATO / CTA ────────────────────────────────────────────── */}
      <div style={styles.contatoBox}>
        <div style={styles.contatoHeader}>
          <span style={styles.contatoKicker}>
            Transformar este cálculo em projeto e instalação?
          </span>
          <h3 style={styles.contatoTitle}>
            Fale agora com a equipe OCENERGIA SOLAR
          </h3>
          <p style={styles.contatoTexto}>
            Nossa equipe técnica transforma este resultado em orçamento
            completo de banco de capacitores (fornecimento + instalação).
            Envie agora e receba atendimento personalizado.
          </p>
        </div>

        <div style={styles.contatoGrid}>
          <a
            href={`mailto:contato@ocenergiasolar.com.br?subject=${assuntoEmail}&body=${corpoEmail}`}
            target="_blank"
            rel="noreferrer"
            style={styles.contatoBotaoEmail}
          >
            Pedir orçamento por e-mail (contato@)
          </a>
          <a
            href={`mailto:comercial@ocenergia.com.br?subject=${assuntoEmail}&body=${corpoEmail}`}
            target="_blank"
            rel="noreferrer"
            style={styles.contatoBotaoEmail}
          >
            Falar com setor comercial (comercial@)
          </a>
          <a
            href={`https://wa.me/5565996180250?text=${whatsappTexto}`}
            target="_blank"
            rel="noreferrer"
            style={styles.contatoBotaoWhatsapp}
          >
            Falar agora no WhatsApp (65) 99618-0250
          </a>
        </div>

        <div style={styles.contatoRodape}>
          <strong>WhatsApp:</strong> (65) 99618-0250 &nbsp;|&nbsp;
          <strong>E-mail:</strong> contato@ocenergiasolar.com.br
        </div>
      </div>

      {/* Rodapé técnico */}
      <div style={styles.rodape}>
        <span style={styles.rodapeTexto}>
          OCENERGIA SOLAR — Cálculo gerado conforme padrão técnico
          interno. Este resultado não substitui laudo ou projeto assinado
          por engenheiro habilitado.
        </span>
      </div>
    </div>
  );
}

function Card({ label, value, destaque = false }: {
  label: string; value: string; destaque?: boolean;
}) {
  return (
    <div style={{
      ...styles.card,
      background: destaque
        ? 'linear-gradient(135deg, #027A48 0%, #039855 100%)'
        : cores.branco,
    }}>
      <span style={{
        ...styles.cardLabel,
        color: destaque ? 'rgba(255,255,255,0.8)' : cores.cinzaTexto,
      }}>
        {label}
      </span>
      <strong style={{
        ...styles.cardValue,
        color: destaque ? cores.branco : cores.azulEscuro,
      }}>
        {value}
      </strong>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.infoItem}>
      <span style={styles.infoLabel}>{label}</span>
      <strong style={styles.infoValue}>{value}</strong>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'grid', gap: 16, padding: 20, borderRadius: 16, background: cores.cinzaFundo, border: `1px solid ${cores.cinzaBorda}` },
  header: { display: 'grid', gap: 4 },
  kicker: { fontSize: 11, fontWeight: 800, letterSpacing: 1.4, color: cores.laranja, textTransform: 'uppercase' },
  title: { margin: 0, fontSize: 22, fontWeight: 800, color: cores.azulEscuro },
  statusBox: { padding: 16, borderRadius: 12, display: 'grid', gap: 6 },
  statusLabel: { fontSize: 12, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase' },
  statusMsg: { margin: 0, fontSize: 15, fontWeight: 600, lineHeight: 1.5 },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 },
  card: { padding: 16, borderRadius: 12, border: `1px solid ${cores.cinzaBorda}`, display: 'grid', gap: 6, boxShadow: '0 2px 8px rgba(27,58,107,0.06)', background: cores.branco },
  cardLabel: { fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase' },
  cardValue: { fontSize: 20, fontWeight: 800 },
  tensaoBox: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, padding: 16, borderRadius: 12, background: '#EEF5FF', border: `1px solid ${cores.cinzaBorda}` },
  tensaoItem: { display: 'grid', gap: 4 },
  tensaoLabel: { fontSize: 12, fontWeight: 700, color: cores.cinzaTexto, textTransform: 'uppercase', letterSpacing: 0.8 },
  tensaoValor: { fontSize: 16, fontWeight: 800, color: cores.azulEscuro },
  section: { padding: 16, borderRadius: 12, background: cores.branco, border: `1px solid ${cores.cinzaBorda}`, display: 'grid', gap: 12 },
  sectionTitle: { margin: 0, fontSize: 17, fontWeight: 800, color: cores.azulEscuro },
  infoItem: { padding: 12, borderRadius: 10, background: cores.cinzaFundo, border: `1px solid ${cores.cinzaBorda}`, display: 'grid', gap: 4 },
  infoLabel: { fontSize: 12, fontWeight: 700, color: cores.cinzaTexto, textTransform: 'uppercase', letterSpacing: 0.8 },
  infoValue: { fontSize: 15, fontWeight: 800, color: cores.azulEscuro },
  tabelaWrapper: { overflowX: 'auto', borderRadius: 10, border: `1px solid ${cores.cinzaBorda}` },
  table: { width: '100%', borderCollapse: 'collapse', background: cores.branco },
  th: { textAlign: 'left', padding: '12px 14px', fontSize: 13, fontWeight: 800, color: cores.azulEscuro, background: cores.cinzaFundo, borderBottom: `1px solid ${cores.cinzaBorda}`, whiteSpace: 'nowrap' },
  td: { padding: '12px 14px', fontSize: 14, color: '#101828', borderBottom: '1px solid #EEF2F6', whiteSpace: 'nowrap' },
  trPar: { background: cores.branco },
  trImpar: { background: cores.cinzaFundo },
  semEtapas: { padding: 14, borderRadius: 10, background: cores.verdeFundo, border: `1px solid ${cores.verdeBorda}`, color: cores.verde, fontWeight: 600 },
  alertaBox: { padding: 14, borderRadius: 10, background: cores.amareloFundo, border: `1px solid ${cores.amareloBorda}`, color: cores.amareloTexto, fontWeight: 600 },
  obsList: { margin: 0, padding: '0 0 0 18px', display: 'grid', gap: 8 },
  obsItem: { fontSize: 14, color: '#101828', lineHeight: 1.6 },
  contatoBox: { padding: 16, borderRadius: 12, background: 'linear-gradient(135deg, #1B3A6B 0%, #2E86C1 100%)', border: '1px solid rgba(255,255,255,0.12)', display: 'grid', gap: 14 },
  contatoHeader: { display: 'grid', gap: 6 },
  contatoKicker: { fontSize: 11, fontWeight: 800, letterSpacing: 1.4, color: '#B3D4F5', textTransform: 'uppercase' },
  contatoTitle: { margin: 0, fontSize: 18, fontWeight: 800, color: cores.branco },
  contatoTexto: { margin: 0, color: '#D9EAFB', lineHeight: 1.5, fontSize: 14 },
  contatoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 },
  contatoBotaoEmail: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '12px 14px', borderRadius: 10, background: cores.branco, color: cores.azulEscuro, fontWeight: 800, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.22)', textAlign: 'center' },
  contatoBotaoWhatsapp: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '12px 14px', borderRadius: 10, background: cores.laranja, color: cores.branco, fontWeight: 800, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.22)', textAlign: 'center' },
  contatoRodape: { paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.18)', color: '#EAF4FF', fontSize: 14 },
  rodape: { padding: 12, borderRadius: 10, background: cores.cinzaFundo, border: `1px solid ${cores.cinzaBorda}` },
  rodapeTexto: { fontSize: 12, color: cores.cinzaTexto, lineHeight: 1.5 },
};