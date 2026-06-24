// src/modules/demanda/SimuladorRapidoBess.tsx
// MÓDULO II — Simulador Expresso de BESS por fatura única (Vite/React 19, estilos inline).
//
// Ferramenta autônoma de dimensionamento + payback a partir de UMA fatura mensal.
// NÃO usa o motorDemanda.ts (que trabalha com 12 meses). As premissas aqui são
// PROPOSITALMENTE diferentes do motor detalhado — esta é a versão "expresso
// paramétrica", com margens conservadoras ajustáveis ao vivo via sliders.
//
// Premissas padrão: PCS ×1,20 · Energia ×1,10 · DoD 0,80 · Eficiência 0,90.
// Payback usa TARIFA COM TRIBUTOS (valor de fatura real), não a líquida da ANEEL.
//
// Trava de segurança por C-Rate (potência mínima para descarregar na janela):
//   - Conservador: divide a CAPACIDADE NOMINAL pelas horas (PCS maior, folga total).
//   - Justo:       divide a ENERGIA ÚTIL pelas horas (PCS pela entrega real).
// O PCS recomendado é o MAIOR entre o pico de demanda (×margem) e essa trava.

import React, { useMemo, useState } from 'react';

// -- Degraus comerciais REAIS (linha WEG C&I) ---------------------------------
// Baterias: módulos modulares de 215 kWh ? 215, 430, 645, 860, 1075...
// Inversores/PCS industriais: 300 kW, 600 kW e múltiplos.
const PASSO_BATERIA_KWH = 215;
const DEGRAUS_PCS_KW = [300, 600, 900, 1200, 1500, 1800];

// Arredonda a capacidade para o próximo múltiplo do módulo de 215 kWh.
function arredondarBateriaKwh(valor: number): number {
  if (!Number.isFinite(valor) || valor <= 0) return 0;
  const n = Math.ceil(valor / PASSO_BATERIA_KWH);
  return n * PASSO_BATERIA_KWH;
}
// Arredonda o PCS para o próximo degrau industrial; acima do maior, usa múltiplo do maior.
function arredondarPcsKw(valor: number): number {
  if (!Number.isFinite(valor) || valor <= 0) return 0;
  for (const d of DEGRAUS_PCS_KW) if (valor <= d) return d;
  const maior = DEGRAUS_PCS_KW[DEGRAUS_PCS_KW.length - 1];
  return Math.ceil(valor / maior) * maior;
}

const fmtBRL = (n: number) =>
  Number.isFinite(n)
    ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
    : '—';

const fmtNum = (n: number, casas = 1) =>
  Number.isFinite(n)
    ? n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
    : '—';

// Converte "63,96" ou "2.574,27" em número. Vazio/ inválido ? NaN.
function parseNum(s: string): number {
  if (!s || s.trim() === '') return NaN;
  const limpo = s.replace(/\./g, '').replace(',', '.');
  const n = Number(limpo);
  return Number.isFinite(n) ? n : NaN;
}

type ModoCRate = 'conservador' | 'justo';

export default function SimuladorRapidoBess() {
  // -- Inputs da fatura --------------------------------------------------------
  const [demandaMedidaPontaKw, setDemandaMedidaPontaKw] = useState('63,96');
  const [consumoPontaKwh, setConsumoPontaKwh] = useState('2.574,27');
  const [tarifaPontaComTributos, setTarifaPontaComTributos] = useState('2,968610');
  const [tarifaForaPontaComTributos, setTarifaForaPontaComTributos] = useState('0,582040');
  const [duracaoPontaHoras, setDuracaoPontaHoras] = useState('3');
  const [diasFaturamento, setDiasFaturamento] = useState('31');
  const [investimentoEstimadoSugerido, setInvestimentoEstimadoSugerido] = useState('220000');

  // -- Função backup (proteção contra apagões) ---------------------------------
  const [frequenciaApagoesAno, setFrequenciaApagoesAno] = useState('2');
  const [prejuizoPorApagao, setPrejuizoPorApagao] = useState('20000');

  // -- Premissas de engenharia (sliders) ---------------------------------------
  const [paramPcs, setParamPcs] = useState(1.20);          // 1,00–1,50
  const [paramEnergia, setParamEnergia] = useState(1.10);  // 1,00–1,30
  const [paramDod, setParamDod] = useState(0.80);          // 0,50–1,00
  const [paramEficiencia, setParamEficiencia] = useState(0.90); // 0,80–1,00

  // Modo de cálculo da trava C-Rate.
  const [modoCRate, setModoCRate] = useState<ModoCRate>('conservador');

  const r = useMemo(() => {
    const demandaPonta = parseNum(demandaMedidaPontaKw);
    const consPonta = parseNum(consumoPontaKwh);
    const tarPonta = parseNum(tarifaPontaComTributos);
    const tarFora = parseNum(tarifaForaPontaComTributos);
    const horasPonta = parseNum(duracaoPontaHoras);
    const dias = parseNum(diasFaturamento);
    const inv = parseNum(investimentoEstimadoSugerido);
    const freqApagoes = parseNum(frequenciaApagoesAno);
    const prejApagao = parseNum(prejuizoPorApagao);

    // -- Dimensionamento de energia --
    const consDiarioPonta = consPonta / dias;
    const energiaDemandadaKwh = consDiarioPonta;
    const energiaAjustada = energiaDemandadaKwh * paramEnergia;
    const capacidadeCalculada = energiaAjustada / (paramDod * paramEficiencia);

    // -- Trava C-Rate: potência mínima para descarregar dentro da janela --
    // 'conservador' usa a capacidade nominal (folga total); 'justo' usa a energia útil.
    const baseCRate = modoCRate === 'conservador' ? capacidadeCalculada : energiaAjustada;
    const potenciaMinimaPeloTempo =
      Number.isFinite(horasPonta) && horasPonta > 0 ? baseCRate / horasPonta : 0;

    // O PCS deve respeitar o MAIOR entre o pico de demanda (×margem) e a taxa temporal.
    const potenciaPcsKw = Math.max(demandaPonta * paramPcs, potenciaMinimaPeloTempo);

    // Qual restrição mandou no PCS (para exibir ao vendedor).
    const limitanteCRate = potenciaMinimaPeloTempo > demandaPonta * paramPcs;

    // -- Recomendação comercial (degraus reais WEG) --
    const pcsComercialKw = arredondarPcsKw(potenciaPcsKw);
    const bateriaComercialKwh = arredondarBateriaKwh(capacidadeCalculada);
    const qtdModulos215 = bateriaComercialKwh / PASSO_BATERIA_KWH;

    // -- Financeiro --
    const economiaBruta = consPonta * (tarPonta - tarFora);
    const custoRecarga = (consPonta / paramEficiencia) * tarFora;
    const economiaLiquida = economiaBruta - custoRecarga;
    const econAnualTarifa = economiaLiquida * 12;

    const prejuizoEvitado = freqApagoes * prejApagao;
    const ganhoTotalAnualCombinado = econAnualTarifa + prejuizoEvitado;

    const paybackPuro = econAnualTarifa > 0 ? inv / econAnualTarifa : NaN;
    const paybackCombinado = ganhoTotalAnualCombinado > 0 ? inv / ganhoTotalAnualCombinado : NaN;

    return {
      consDiarioPonta, energiaAjustada, capacidadeCalculada,
      potenciaMinimaPeloTempo, potenciaPcsKw, limitanteCRate,
      pcsComercialKw, bateriaComercialKwh, qtdModulos215,
      economiaBruta, custoRecarga, economiaLiquida, econAnualTarifa,
      prejuizoEvitado, ganhoTotalAnualCombinado,
      paybackPuro, paybackCombinado, inv,
    };
  }, [
    demandaMedidaPontaKw, consumoPontaKwh, tarifaPontaComTributos, tarifaForaPontaComTributos,
    duracaoPontaHoras, diasFaturamento, investimentoEstimadoSugerido,
    frequenciaApagoesAno, prejuizoPorApagao,
    paramPcs, paramEnergia, paramDod, paramEficiencia, modoCRate,
  ]);

  return (
    <div style={s.page}>
      <h1 style={s.h1}>Simulador Expresso de BESS — Fatura Única</h1>
      <span style={s.helper}>
        Dimensionamento e payback paramétricos a partir de uma só fatura. Use a tarifa <strong>com tributos</strong>.
      </span>

      {/* 1. INPUTS DA FATURA */}
      <section style={s.card}>
        <h2 style={s.h2}>1. Dados da fatura</h2>
        <div style={s.grid}>
          <Campo label="Demanda medida na ponta (kW)" v={demandaMedidaPontaKw} on={setDemandaMedidaPontaKw} ph="ex.: 63,96" />
          <Campo label="Consumo na ponta (kWh)" v={consumoPontaKwh} on={setConsumoPontaKwh} ph="ex.: 2.574,27" />
          <Campo label="Tarifa Ponta c/ tributos (R$/kWh)" v={tarifaPontaComTributos} on={setTarifaPontaComTributos} ph="ex.: 2,968610" />
          <Campo label="Tarifa Fora-Ponta c/ tributos (R$/kWh)" v={tarifaForaPontaComTributos} on={setTarifaForaPontaComTributos} ph="ex.: 0,582040" />
          <Campo label="Duração da ponta (horas)" v={duracaoPontaHoras} on={setDuracaoPontaHoras} ph="3" />
          <Campo label="Dias de faturamento" v={diasFaturamento} on={setDiasFaturamento} ph="31" />
          <Campo label="Investimento estimado (R$)" v={investimentoEstimadoSugerido} on={setInvestimentoEstimadoSugerido} ph="220000" />
        </div>
      </section>

      {/* 2. FUNÇÃO BACKUP */}
      <section style={s.card}>
        <h2 style={s.h2}>2. Função backup (proteção contra apagões)</h2>
        <div style={s.grid}>
          <Campo label="Frequência de apagões / ano" v={frequenciaApagoesAno} on={setFrequenciaApagoesAno} ph="2" />
          <Campo label="Prejuízo por apagão (R$)" v={prejuizoPorApagao} on={setPrejuizoPorApagao} ph="20000" />
        </div>
        <span style={s.helper}>Perda evitada (estoque / faturamento cessante) — entra apenas no payback combinado.</span>
      </section>

      {/* 3. PREMISSAS — SLIDERS + MODO C-RATE */}
      <section style={s.card}>
        <h2 style={s.h2}>3. Premissas de engenharia</h2>
        <Slider label="Margem do PCS / Inversor" valor={paramPcs} min={1.0} max={1.5} step={0.05} on={setParamPcs} sufixo="×" />
        <Slider label="Margem de energia" valor={paramEnergia} min={1.0} max={1.3} step={0.05} on={setParamEnergia} sufixo="×" />
        <Slider label="Profundidade de descarga (DoD)" valor={paramDod} min={0.5} max={1.0} step={0.05} on={setParamDod} pct />
        <Slider label="Eficiência global do sistema" valor={paramEficiencia} min={0.8} max={1.0} step={0.01} on={setParamEficiencia} pct />

        <div style={s.sliderRow}>
          <label style={s.label}>Modo da trava C-Rate (potência mínima pela janela)</label>
          <div style={s.toggleRow}>
            <button
              type="button"
              onClick={() => setModoCRate('conservador')}
              style={modoCRate === 'conservador' ? s.toggleOn : s.toggleOff}
            >
              Conservador (capacidade nominal)
            </button>
            <button
              type="button"
              onClick={() => setModoCRate('justo')}
              style={modoCRate === 'justo' ? s.toggleOn : s.toggleOff}
            >
              Justo (energia útil)
            </button>
          </div>
          <span style={s.helper}>
            <strong>Conservador:</strong> divide a capacidade nominal pelas horas (PCS maior, folga total).{' '}
            <strong>Justo:</strong> divide a energia útil pelas horas (PCS pela entrega real).
          </span>
        </div>

        <span style={s.helper}>
          Padrões conservadores (LFP): PCS 1,20× · Energia 1,10× · DoD 80% · Eficiência 90%. Ajuste e veja os números recalcularem.
        </span>
      </section>

      {/* RESULTADOS — 3 CARDS */}
      <section style={s.cardsRow}>
        {/* CARD 1 — Recomendação comercial */}
        <div style={s.resultCard}>
          <span style={s.resultKicker}>Recomendação comercial</span>
          <div style={s.bigMetric}>{fmtNum(r.pcsComercialKw, 0)} kW <span style={s.bigUnit}>PCS</span></div>
          <div style={s.bigMetric}>{fmtNum(r.bateriaComercialKwh, 0)} kWh <span style={s.bigUnit}>baterias</span></div>
          {r.qtdModulos215 > 0 && (
            <div style={s.tagModulos}>{fmtNum(r.qtdModulos215, 0)}× módulo 215 kWh</div>
          )}
          <div style={s.detalhe}>
            <Linha k="PCS calculado (pré-degrau)" v={`${fmtNum(r.potenciaPcsKw)} kW`} />
            <Linha k="Capacidade nominal calc." v={`${fmtNum(r.capacidadeCalculada)} kWh`} />
            <Linha k="Consumo diário de ponta" v={`${fmtNum(r.consDiarioPonta)} kWh/dia`} />
            <Linha k="Energia ajustada (×margem)" v={`${fmtNum(r.energiaAjustada)} kWh`} />
          </div>
          {r.limitanteCRate ? (
            <div style={s.alertaCRate}>?? PCS definido pela <strong>taxa de descarga (C-Rate)</strong>: a energia exige {fmtNum(r.potenciaMinimaPeloTempo)} kW para descarregar na janela de ponta — acima do pico de demanda.</div>
          ) : (
            <div style={s.infoCRate}>PCS definido pelo <strong>pico de demanda</strong> (×{fmtNum(paramPcs, 2)}). C-Rate dentro do limite.</div>
          )}
        </div>

        {/* CARD 2 — Performance financeira */}
        <div style={s.resultCard}>
          <span style={s.resultKicker}>Performance financeira</span>
          <div style={s.bigMetric}>{fmtBRL(r.economiaLiquida)} <span style={s.bigUnit}>/mês</span></div>
          <div style={s.detalhe}>
            <Linha k="Economia bruta (arbitragem)" v={`${fmtBRL(r.economiaBruta)}/mês`} />
            <Linha k="Custo de recarga (fora-ponta)" v={`- ${fmtBRL(r.custoRecarga)}/mês`} />
            <Linha k="Economia líquida anual" v={fmtBRL(r.econAnualTarifa)} destaque />
            <Linha k="Prejuízo evitado/ano (backup)" v={fmtBRL(r.prejuizoEvitado)} />
            <Linha k="Ganho total combinado/ano" v={fmtBRL(r.ganhoTotalAnualCombinado)} destaque />
          </div>
        </div>

        {/* CARD 3 — Payback comparativo */}
        <div style={s.resultCard}>
          <span style={s.resultKicker}>Payback</span>
          <div style={s.paybackRow}>
            <div style={s.paybackBox}>
              <span style={s.paybackLabel}>Puro (tarifa)</span>
              <strong style={s.paybackValor}>{Number.isFinite(r.paybackPuro) ? `${fmtNum(r.paybackPuro)} anos` : '—'}</strong>
            </div>
            <div style={{ ...s.paybackBox, ...s.paybackBoxDestaque }}>
              <span style={s.paybackLabel}>Combinado c/ backup</span>
              <strong style={s.paybackValor}>{Number.isFinite(r.paybackCombinado) ? `${fmtNum(r.paybackCombinado)} anos` : '—'}</strong>
            </div>
          </div>
          <div style={s.detalhe}>
            <Linha k="Investimento" v={fmtBRL(r.inv)} />
          </div>
          <BarraPayback puro={r.paybackPuro} combinado={r.paybackCombinado} />
        </div>
      </section>

      <span style={s.rodape}>Estimativa Expresso Paramétrica baseada em Fatura Única</span>
    </div>
  );
}

// -- Subcomponentes ------------------------------------------------------------
function Campo({ label, v, on, ph }: { label: string; v: string; on: (x: string) => void; ph?: string }) {
  return (
    <div style={s.field}>
      <label style={s.label}>{label}</label>
      <input value={v} onChange={(e) => on(e.target.value)} placeholder={ph} style={s.input} inputMode="decimal" />
    </div>
  );
}

function Slider({
  label, valor, min, max, step, on, sufixo = '', pct = false,
}: {
  label: string; valor: number; min: number; max: number; step: number;
  on: (x: number) => void; sufixo?: string; pct?: boolean;
}) {
  const exibicao = pct ? `${Math.round(valor * 100)}%` : `${fmtNum(valor, 2)}${sufixo}`;
  return (
    <div style={s.sliderRow}>
      <div style={s.sliderHead}>
        <label style={s.label}>{label}</label>
        <span style={s.sliderValor}>{exibicao}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={valor}
        onChange={(e) => on(Number(e.target.value))}
        style={s.range}
      />
    </div>
  );
}

function Linha({ k, v, destaque = false }: { k: string; v: string; destaque?: boolean }) {
  return (
    <div style={s.linha}>
      <span style={s.linhaK}>{k}</span>
      <span style={{ ...s.linhaV, ...(destaque ? s.linhaVDestaque : {}) }}>{v}</span>
    </div>
  );
}

function BarraPayback({ puro, combinado }: { puro: number; combinado: number }) {
  const max = 15; // escala de referência em anos
  const larguraPuro = Number.isFinite(puro) ? Math.min(100, (puro / max) * 100) : 0;
  const larguraComb = Number.isFinite(combinado) ? Math.min(100, (combinado / max) * 100) : 0;
  return (
    <div style={s.barWrap}>
      <div style={s.barLabelRow}><span style={s.linhaK}>Puro</span></div>
      <div style={s.barTrack}><div style={{ ...s.barFill, width: `${larguraPuro}%`, background: '#2E86C1' }} /></div>
      <div style={s.barLabelRow}><span style={s.linhaK}>Combinado</span></div>
      <div style={s.barTrack}><div style={{ ...s.barFill, width: `${larguraComb}%`, background: 'linear-gradient(135deg, #F39C12 0%, #E67E22 100%)' }} /></div>
      <span style={s.helper}>Escala 0–{max} anos · barra menor = retorno mais rápido.</span>
    </div>
  );
}

// -- Estilos -------------------------------------------------------------------
const s: Record<string, React.CSSProperties> = {
  page: { maxWidth: 980, margin: '0 auto', padding: 16, display: 'grid', gap: 16, color: '#101828' },
  h1: { fontSize: 22, fontWeight: 800, color: '#1B3A6B', margin: 0 },
  h2: { fontSize: 17, fontWeight: 800, color: '#1B3A6B', margin: 0 },
  helper: { fontSize: 12, color: '#475467' },
  card: { padding: 16, borderRadius: 12, background: '#FFFFFF', border: '1px solid #D5E8F3', display: 'grid', gap: 12 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 },
  field: { display: 'grid', gap: 6 },
  label: { fontSize: 13, fontWeight: 700, color: '#1B3A6B' },
  input: { borderRadius: 10, border: '1px solid #D5E8F3', padding: '10px 12px', fontSize: 14, boxSizing: 'border-box', fontVariantNumeric: 'tabular-nums' },
  sliderRow: { display: 'grid', gap: 6 },
  sliderHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  sliderValor: { fontSize: 14, fontWeight: 800, color: '#E67E22', fontVariantNumeric: 'tabular-nums' },
  range: { width: '100%', accentColor: '#F39C12' },
  toggleRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  toggleOn: { padding: '8px 14px', borderRadius: 10, border: '2px solid #2E86C1', background: '#EEF5FF', color: '#1B3A6B', fontWeight: 700, fontSize: 13, cursor: 'pointer' },
  toggleOff: { padding: '8px 14px', borderRadius: 10, border: '1px solid #D5E8F3', background: '#FFFFFF', color: '#475467', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  cardsRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 },
  resultCard: { padding: 16, borderRadius: 12, background: '#FFFFFF', border: '1px solid #D5E8F3', display: 'grid', gap: 10, alignContent: 'start' },
  resultKicker: { fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6, color: '#475467' },
  bigMetric: { fontSize: 26, fontWeight: 800, color: '#1B3A6B', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 },
  bigUnit: { fontSize: 14, fontWeight: 700, color: '#475467' },
  tagModulos: { justifySelf: 'start', padding: '4px 10px', borderRadius: 999, background: '#EEF5FF', color: '#1B3A6B', fontWeight: 700, fontSize: 12 },
  detalhe: { display: 'grid', gap: 6, marginTop: 4 },
  linha: { display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, borderBottom: '1px solid #EEF3F8', paddingBottom: 4 },
  linhaK: { color: '#475467' },
  linhaV: { fontWeight: 700, color: '#101828', fontVariantNumeric: 'tabular-nums' },
  linhaVDestaque: { color: '#1E7E47' },
  alertaCRate: { fontSize: 12, color: '#B54708', background: '#FFFAEB', border: '1px solid #FEDF89', borderRadius: 8, padding: 8 },
  infoCRate: { fontSize: 12, color: '#475467', background: '#F4F6F9', border: '1px solid #D5E8F3', borderRadius: 8, padding: 8 },
  paybackRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  paybackBox: { padding: 12, borderRadius: 10, background: '#F4F6F9', border: '1px solid #D5E8F3', display: 'grid', gap: 4, textAlign: 'center' },
  paybackBoxDestaque: { background: '#FFF7ED', border: '1px solid #E67E22' },
  paybackLabel: { fontSize: 11, fontWeight: 700, color: '#475467' },
  paybackValor: { fontSize: 18, fontWeight: 800, color: '#1B3A6B', fontVariantNumeric: 'tabular-nums' },
  barWrap: { display: 'grid', gap: 4, marginTop: 4 },
  barLabelRow: { display: 'flex', justifyContent: 'space-between' },
  barTrack: { height: 10, borderRadius: 999, background: '#EEF3F8', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999 },
  rodape: { fontSize: 11, color: '#98A2B3', textAlign: 'center', fontStyle: 'italic' },
};
