// src/modules/ui/CalculadoraHibridaFP.tsx
// MÓDULO III (HÍBRIDO) — Calculadora de Fator de Potência com dois modos.
// Componente ISOLADO: não altera FormularioManual/ResultadoTecnico de produção.
// Quando validado, basta trocar o import na TelaPrincipal.
//
// MODO 1 — Projeto Padrão (Transformador): casamento exato kVA + tensão no
//   CATALOGO_TRAFOS → injeta o kit de engenharia pronto (passos, disjuntor,
//   caixa, trafo de comando, ventilação) com isProjetoPadrao = true.
// MODO 2 — Customizado (kVA avulso / Motor CV / Motor HP): converte para kW e
//   chama o motor de produção calcularBancoCapacitorIndustrial → banco em etapas,
//   norma, ligação, classe de tensão e alerta de harmônicos.

import React, { useMemo, useState } from 'react';
import { CATALOGO_TRAFOS, type ProjektPadraoTrafo, type ConfigPasso } from '../../data/catalogoTrafos';
import { calcularBancoCapacitorIndustrial } from '../calculadora/calculadoraIndustrial';
import type {
  DadosNormalizadosFP,
  ResultadoCalculadoraIndustrial,
  EtapaBanco,
} from '../../types/types';

type ModoEntrada = 'trafo_catalogo' | 'kva_custom' | 'motor_cv' | 'motor_hp';

// Fatores de conversão (potência mecânica → kW).
const FATOR_CV = 0.7355; // 1 CV ≈ 0,7355 kW
const FATOR_HP = 0.7457; // 1 HP ≈ 0,7457 kW

const TENSOES_CATALOGO = [220, 380, 440];

const num = (s: string) => {
  if (!s || s.trim() === '') return NaN;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};

const fmt = (n: number, casas = 2) =>
  Number.isFinite(n) ? n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }) : '—';

// Resultado unificado: ou vem do catálogo (kit), ou do motor (cálculo).
interface ResultadoHibrido {
  isProjetoPadrao: boolean;
  // Projeto padrão (catálogo)
  trafo?: ProjektPadraoTrafo;
  // Customizado (motor)
  motor?: ResultadoCalculadoraIndustrial;
  // Comum
  potenciaKwConvertida?: number;
}

export default function CalculadoraHibridaFP() {
  const [modo, setModo] = useState<ModoEntrada>('trafo_catalogo');

  // Entrada unificada de potência (kVA, kVA, CV ou HP conforme o modo).
  const [potenciaInput, setPotenciaInput] = useState('');
  const [tensaoSelecionada, setTensaoSelecionada] = useState(380); // p/ catálogo
  const [tensaoCustomV, setTensaoCustomV] = useState('380');       // p/ motor
  const [fpAtual, setFpAtual] = useState('0,85');
  const [fpAlvo, setFpAlvo] = useState('0,95');
  const [cosPhiKva, setCosPhiKva] = useState('0,85'); // p/ converter kVA→kW no modo kva_custom
  const [temInversores, setTemInversores] = useState(false);

  const [resultado, setResultado] = useState<ResultadoHibrido | null>(null);
  const [erro, setErro] = useState('');

  const labelPotencia =
    modo === 'trafo_catalogo' ? 'Potência do transformador (kVA)'
    : modo === 'kva_custom' ? 'Potência aparente (kVA)'
    : modo === 'motor_cv' ? 'Potência do motor (CV)'
    : 'Potência do motor (HP)';

  const phPotencia =
    modo === 'trafo_catalogo' ? 'ex.: 300'
    : modo === 'kva_custom' ? 'ex.: 250'
    : modo === 'motor_cv' ? 'ex.: 100'
    : 'ex.: 100';

  function calcular() {
    setErro('');
    setResultado(null);

    const valor = num(potenciaInput);
    if (!Number.isFinite(valor) || valor <= 0) {
      setErro('Informe uma potência válida.');
      return;
    }

    // ── MODO PROJETO PADRÃO: casamento exato kVA + tensão no catálogo ──
    if (modo === 'trafo_catalogo') {
      const achado = CATALOGO_TRAFOS.find(
        (t) => t.potenciaTrafoKva === valor && t.tensaoVca === tensaoSelecionada,
      );
      if (!achado) {
        setErro(
          `Não há kit de catálogo para ${fmt(valor, 0)} kVA em ${tensaoSelecionada} V. ` +
          'Confira a potência/tensão ou use o modo "kVA Customizado" para cálculo teórico.',
        );
        return;
      }
      setResultado({ isProjetoPadrao: true, trafo: achado });
      return;
    }

    // ── MODOS CUSTOMIZADOS: converte para kW e chama o motor de produção ──
    const fpA = num(fpAtual);
    const fpAl = num(fpAlvo);
    const tensaoV = num(tensaoCustomV);

    if (!Number.isFinite(fpA) || fpA <= 0 || fpA >= 1) {
      setErro('FP atual deve estar entre 0 e 1 (ex.: 0,85).');
      return;
    }
    if (!Number.isFinite(fpAl) || fpAl <= 0 || fpAl > 1) {
      setErro('FP alvo deve estar entre 0 e 1 (ex.: 0,95).');
      return;
    }
    if (!Number.isFinite(tensaoV) || tensaoV <= 0) {
      setErro('Informe a tensão (V) — necessária para norma, ligação e classe do capacitor.');
      return;
    }

    let potenciaKw: number;
    if (modo === 'motor_cv') {
      potenciaKw = valor * FATOR_CV;
    } else if (modo === 'motor_hp') {
      potenciaKw = valor * FATOR_HP;
    } else {
      // kva_custom: P(kW) = kVA × cosφ
      const cosPhi = num(cosPhiKva);
      if (!Number.isFinite(cosPhi) || cosPhi <= 0 || cosPhi > 1) {
        setErro('Para kVA customizado, informe o cosφ atual (ex.: 0,85) para converter kVA → kW.');
        return;
      }
      potenciaKw = valor * cosPhi;
    }

    const dados: DadosNormalizadosFP = {
      potenciaAtivaKw: potenciaKw,
      fpAtual: fpA,
      fpAlvo: fpAl,
      tensaoV,
      origemDados: 'manual',
      temInversores,
    };

    const res = calcularBancoCapacitorIndustrial(dados, { fpAlvo: fpAl });
    setResultado({ isProjetoPadrao: false, motor: res, potenciaKwConvertida: potenciaKw });
  }

  // Tabela unificada de etapas (catálogo usa potenciaKvar/quantidade; motor usa kvar/quantidade).
  const linhasEtapas = useMemo(() => {
    if (!resultado) return [];
    if (resultado.isProjetoPadrao && resultado.trafo) {
      return resultado.trafo.passos.map((p: ConfigPasso) => ({
        kvar: p.potenciaKvar,
        quantidade: p.quantidade,
      }));
    }
    if (!resultado.isProjetoPadrao && resultado.motor) {
      return resultado.motor.banco.etapas.map((e: EtapaBanco) => ({
        kvar: e.kvar,
        quantidade: e.quantidade,
      }));
    }
    return [];
  }, [resultado]);

  return (
    <div style={s.page}>
      <h1 style={s.h1}>Calculadora Híbrida de Fator de Potência</h1>
      <span style={s.helper}>
        <strong>Projeto Padrão</strong>: kit de engenharia pronto do catálogo (casamento exato kVA + tensão).{' '}
        <strong>Customizado</strong>: cálculo teórico do banco a partir de kVA, CV ou HP.
      </span>

      {/* SELETOR DE MODO */}
      <section style={s.card}>
        <h2 style={s.h2}>1. Tipo de referência</h2>
        <div style={s.modoRow}>
          <ModoBtn ativo={modo === 'trafo_catalogo'} on={() => setModo('trafo_catalogo')}>Transformador (kVA)</ModoBtn>
          <ModoBtn ativo={modo === 'kva_custom'} on={() => setModo('kva_custom')}>kVA Customizado</ModoBtn>
          <ModoBtn ativo={modo === 'motor_cv'} on={() => setModo('motor_cv')}>Motor (CV)</ModoBtn>
          <ModoBtn ativo={modo === 'motor_hp'} on={() => setModo('motor_hp')}>Motor (HP)</ModoBtn>
        </div>
        {modo === 'trafo_catalogo' ? (
          <div style={s.infoModo}>📦 <strong>Kit de Engenharia:</strong> busca exata no catálogo. Sem cálculo teórico — entrega o projeto pronto (passos, disjuntor, caixa, comando, ventilação).</div>
        ) : (
          <div style={s.infoModo}>🧮 <strong>Cálculo Teórico:</strong> dimensiona o banco pela fórmula Q = P·(tanφ₁ − tanφ₂) usando o motor industrial (etapas, norma, harmônicos).</div>
        )}
      </section>

      {/* ENTRADAS */}
      <section style={s.card}>
        <h2 style={s.h2}>2. Dados de entrada</h2>
        <div style={s.grid}>
          <div style={s.field}>
            <label style={s.label}>{labelPotencia}</label>
            <input value={potenciaInput} onChange={(e) => setPotenciaInput(e.target.value)} placeholder={phPotencia} style={s.input} inputMode="decimal" />
          </div>

          {modo === 'trafo_catalogo' && (
            <div style={s.field}>
              <label style={s.label}>Tensão (V)</label>
              <select value={tensaoSelecionada} onChange={(e) => setTensaoSelecionada(Number(e.target.value))} style={s.input}>
                {TENSOES_CATALOGO.map((t) => <option key={t} value={t}>{t} V</option>)}
              </select>
            </div>
          )}

          {modo !== 'trafo_catalogo' && (
            <>
              <div style={s.field}>
                <label style={s.label}>Tensão (V)</label>
                <input value={tensaoCustomV} onChange={(e) => setTensaoCustomV(e.target.value)} placeholder="ex.: 380" style={s.input} inputMode="decimal" />
              </div>
              <div style={s.field}>
                <label style={s.label}>FP atual (cosφ₁)</label>
                <input value={fpAtual} onChange={(e) => setFpAtual(e.target.value)} placeholder="0,85" style={s.input} inputMode="decimal" />
              </div>
              <div style={s.field}>
                <label style={s.label}>FP desejado (cosφ₂)</label>
                <input value={fpAlvo} onChange={(e) => setFpAlvo(e.target.value)} placeholder="0,95" style={s.input} inputMode="decimal" />
              </div>
              {modo === 'kva_custom' && (
                <div style={s.field}>
                  <label style={s.label}>cosφ p/ converter kVA→kW</label>
                  <input value={cosPhiKva} onChange={(e) => setCosPhiKva(e.target.value)} placeholder="0,85" style={s.input} inputMode="decimal" />
                </div>
              )}
              <div style={s.field}>
                <label style={s.label}>Cargas não-lineares (inversores)?</label>
                <div style={s.toggleRow}>
                  <button type="button" onClick={() => setTemInversores(true)} style={temInversores ? s.toggleOn : s.toggleOff}>Sim</button>
                  <button type="button" onClick={() => setTemInversores(false)} style={!temInversores ? s.toggleOn : s.toggleOff}>Não</button>
                </div>
              </div>
            </>
          )}
        </div>

        <button type="button" onClick={calcular} style={s.calcBtn}>Calcular</button>
        {erro && <div style={s.erro}>{erro}</div>}
      </section>

      {/* RESULTADO */}
      {resultado && (
        <section style={s.card}>
          <h2 style={s.h2}>3. Resultado</h2>

          {resultado.isProjetoPadrao && resultado.trafo ? (
            <>
              <div style={s.badgeKit}>📦 Projeto Padrão — Kit de catálogo</div>
              <div style={s.cardsGrid}>
                <ResCard titulo="Transformador">
                  <strong>{fmt(resultado.trafo.potenciaTrafoKva, 0)} kVA</strong> · {resultado.trafo.tensaoVca} V
                </ResCard>
                <ResCard titulo="Banco total">
                  <strong>{fmt(resultado.trafo.potenciaTotalKvar)} kVAr</strong>
                </ResCard>
                <ResCard titulo="Controlador">{resultado.trafo.controlador}</ResCard>
              </div>

              <div style={s.montagemBox}>
                <h3 style={s.h3}>Componentes de montagem</h3>
                <Linha k="Disjuntor geral" v={resultado.trafo.disjuntorGeral} />
                <Linha k="Caixa de comando" v={resultado.trafo.caixaComando} />
                <Linha k="Trafo de comando" v={resultado.trafo.precisaTrafoComando ? 'Necessário' : 'Não necessário'} />
                <Linha k="Ventilação ativa" v={resultado.trafo.precisaVentilacaoAtiva ? 'Necessária' : 'Não necessária'} />
              </div>
            </>
          ) : resultado.motor ? (
            <>
              <div style={s.badgeCalc}>🧮 Cálculo Teórico — motor industrial</div>
              {resultado.potenciaKwConvertida != null && (
                <span style={s.helper}>Potência ativa considerada: <strong>{fmt(resultado.potenciaKwConvertida)} kW</strong></span>
              )}
              <div style={s.cardsGrid}>
                <ResCard titulo="Qc necessário">
                  <strong>{fmt(resultado.motor.qcKvar)} kVAr</strong><br />
                  <span style={s.helper}>c/ margem: {fmt(resultado.motor.qcComMargemKvar)} kVAr</span>
                </ResCard>
                <ResCard titulo="Banco recomendado">
                  <strong>{resultado.motor.banco.estrategia}</strong><br />
                  <span style={s.helper}>Instalado: {fmt(resultado.motor.banco.totalKvarInstalado)} kVAr</span>
                </ResCard>
                <ResCard titulo="Nível de tensão">
                  {resultado.motor.nivelTensao}<br />
                  <span style={s.helper}>{resultado.motor.tipoLigacaoSugerida}</span>
                </ResCard>
                <ResCard titulo="Norma / classe">
                  {resultado.motor.normaAplicavel ?? '—'}<br />
                  <span style={s.helper}>{resultado.motor.tensaoTrabalhoCapacitor ?? '—'}</span>
                </ResCard>
              </div>

              {resultado.motor.alertaHarmonicos && resultado.motor.recomendacaoHarmonicos && (
                <div style={s.alertaHarm}>⚠️ {resultado.motor.recomendacaoHarmonicos}</div>
              )}

              {resultado.motor.observacoesTecnicas.length > 0 && (
                <div style={s.obsBox}>
                  <h3 style={s.h3}>Observações técnicas</h3>
                  <ul style={s.ul}>
                    {resultado.motor.observacoesTecnicas.map((o, i) => <li key={i}>{o}</li>)}
                  </ul>
                </div>
              )}
            </>
          ) : null}

          {/* TABELA DE ETAPAS — unificada para os dois modos */}
          {linhasEtapas.length > 0 && (
            <div style={s.tabelaBox}>
              <h3 style={s.h3}>Etapas / passos do banco</h3>
              <table style={s.table}>
                <thead>
                  <tr><th style={s.th}>kVAr por etapa</th><th style={s.th}>Quantidade</th><th style={s.th}>Subtotal</th></tr>
                </thead>
                <tbody>
                  {linhasEtapas.map((l, i) => (
                    <tr key={i}>
                      <td style={s.td}>{fmt(l.kvar)}</td>
                      <td style={s.td}>{l.quantidade}</td>
                      <td style={s.td}>{fmt(l.kvar * l.quantidade)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// ── Subcomponentes ────────────────────────────────────────────────────────────
function ModoBtn({ ativo, on, children }: { ativo: boolean; on: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={on} style={ativo ? s.modoOn : s.modoOff}>{children}</button>;
}
function ResCard({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={s.resCard}>
      <span style={s.resCardTit}>{titulo}</span>
      <div style={s.resCardBody}>{children}</div>
    </div>
  );
}
function Linha({ k, v }: { k: string; v: string }) {
  return (
    <div style={s.linha}>
      <span style={s.linhaK}>{k}</span>
      <span style={s.linhaV}>{v}</span>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { maxWidth: 980, margin: '0 auto', padding: 16, display: 'grid', gap: 16, color: '#101828' },
  h1: { fontSize: 22, fontWeight: 800, color: '#1B3A6B', margin: 0 },
  h2: { fontSize: 17, fontWeight: 800, color: '#1B3A6B', margin: 0 },
  h3: { fontSize: 15, fontWeight: 800, color: '#1B3A6B', margin: '0 0 6px' },
  helper: { fontSize: 12, color: '#475467' },
  card: { padding: 16, borderRadius: 12, background: '#FFFFFF', border: '1px solid #D5E8F3', display: 'grid', gap: 12 },
  modoRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  modoOn: { padding: '10px 16px', borderRadius: 10, border: '2px solid #2E86C1', background: '#EEF5FF', color: '#1B3A6B', fontWeight: 700, fontSize: 14, cursor: 'pointer' },
  modoOff: { padding: '10px 16px', borderRadius: 10, border: '1px solid #D5E8F3', background: '#FFFFFF', color: '#475467', fontWeight: 600, fontSize: 14, cursor: 'pointer' },
  infoModo: { fontSize: 13, color: '#475467', background: '#F4F6F9', border: '1px solid #D5E8F3', borderRadius: 8, padding: 10 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 },
  field: { display: 'grid', gap: 6 },
  label: { fontSize: 13, fontWeight: 700, color: '#1B3A6B' },
  input: { borderRadius: 10, border: '1px solid #D5E8F3', padding: '10px 12px', fontSize: 14, boxSizing: 'border-box' },
  toggleRow: { display: 'flex', gap: 8 },
  toggleOn: { padding: '10px 16px', borderRadius: 10, border: '2px solid #2E86C1', background: '#EEF5FF', color: '#1B3A6B', fontWeight: 700, cursor: 'pointer' },
  toggleOff: { padding: '10px 16px', borderRadius: 10, border: '1px solid #D5E8F3', background: '#FFFFFF', color: '#475467', fontWeight: 600, cursor: 'pointer' },
  calcBtn: { padding: '12px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #F39C12 0%, #E67E22 100%)', color: '#FFFFFF', fontWeight: 800, fontSize: 15, cursor: 'pointer', justifySelf: 'start' },
  erro: { padding: 12, borderRadius: 8, background: '#FDEDEC', color: '#C0392B', fontSize: 14, fontWeight: 700 },
  badgeKit: { justifySelf: 'start', padding: '6px 14px', borderRadius: 999, background: '#EEF5FF', color: '#1B3A6B', fontWeight: 800, fontSize: 13, border: '1px solid #2E86C1' },
  badgeCalc: { justifySelf: 'start', padding: '6px 14px', borderRadius: 999, background: '#FFF7ED', color: '#E67E22', fontWeight: 800, fontSize: 13, border: '1px solid #F39C12' },
  cardsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 },
  resCard: { padding: 12, borderRadius: 10, background: '#F4F6F9', border: '1px solid #D5E8F3', display: 'grid', gap: 6 },
  resCardTit: { fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6, color: '#475467' },
  resCardBody: { fontSize: 14, lineHeight: 1.4 },
  montagemBox: { padding: 12, borderRadius: 10, background: '#F4F6F9', border: '1px solid #D5E8F3', display: 'grid', gap: 6 },
  linha: { display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14, borderBottom: '1px solid #EEF3F8', paddingBottom: 4 },
  linhaK: { color: '#475467' },
  linhaV: { fontWeight: 700, color: '#101828' },
  alertaHarm: { fontSize: 13, color: '#B54708', background: '#FFFAEB', border: '1px solid #FEDF89', borderRadius: 8, padding: 10 },
  obsBox: { padding: 12, borderRadius: 10, background: '#F4F6F9', border: '1px solid #D5E8F3' },
  ul: { margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.5 },
  tabelaBox: { display: 'grid', gap: 8 },
  table: { borderCollapse: 'collapse', width: '100%', fontSize: 13 },
  th: { textAlign: 'left', padding: '8px 6px', color: '#1B3A6B', borderBottom: '2px solid #D5E8F3' },
  td: { padding: '6px', borderBottom: '1px solid #EEF3F8', fontVariantNumeric: 'tabular-nums' },
};
