// src/modules/ui/SeletorTarifaAneel.tsx
//
// Bloco reutilizável (usado por FormularioManual e UploadFatura):
//   - Select de UF (dirige o ICMS de fallback do taxes.ts)
//   - Dropdown de distribuidora (carregado do /grafias-aneel.json estático,
//     gerado pelo job semanal do GitHub Actions — sem rota dinâmica ?listar=)
//   - Filtros de subgrupo / modalidade / posto
//   - Busca a tarifa homologada na ANEEL via /api/aneel-tarifas
//   - Aplica o gross-up "por dentro" sequencial do taxes.ts (alíquotas dinâmicas)
//   - Emite um resumo (InfoTarifaria) para o componente pai injetar no lead
//
// HONESTIDADE: o PIS/COFINS EFETIVOS variam mês a mês e devem vir DA FATURA.
// Por isso são campos editáveis; sem eles, o "valor com imposto" não sai correto
// (o líquido da ANEEL continua válido). O ICMS já vem pré-preenchido do fallback
// da UF (apenas MT confirmado contra fatura real), mas é editável.
//
// Sobre a distribuidora: na base da ANEEL a Energisa Mato Grosso é a sigla "EMT".
// O VALOR enviado à busca é a sigla (substring-match no backend); o RÓTULO exibido
// é amigável. Por isso o default é EMT (= Energisa Mato Grosso).

import React, { useEffect, useState } from 'react';
import { buscarTarifasAneel, type TarifaAneel } from '../../lib/buscarTarifaAneel';
import { calcularTarifaPorDentro, icmsFallbackPorUf } from '../../core/regulations/taxes';

export interface InfoTarifaria {
  uf: string;
  agente: string;
  subgrupo: string;
  modalidade: string;
  posto: string;
  icmsPct: number;   // fração efetivamente aplicada (ex.: 0.17)
  pisPct: number;    // fração
  cofinsPct: number; // fração
  vlrTeLiquido: number | null;
  vlrTusdLiquido: number | null;
  tarifaLiquidaTotal: number | null;
  tarifaComImpostoTotal: number | null;
  inicioVigencia: string | null;
  origem: 'ANEEL';
}

const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT',
  'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
];
const SUBGRUPOS = ['A1', 'A2', 'A3', 'A3a', 'A4', 'AS', 'B1', 'B2', 'B3', 'B4'];
const MODALIDADES = ['Verde', 'Azul', 'Convencional', 'Branca'];
const POSTOS = ['', 'Ponta', 'Fora ponta'];

// Default = Energisa Mato Grosso. A grafia real na ANEEL é a SIGLA "EMT".
const AGENTE_PADRAO = 'EMT';

// Rótulos amigáveis para siglas conhecidas (apenas as confirmadas; as demais
// aparecem com a própria sigla — não inventamos nomes).
const ROTULOS_AGENTE: Record<string, string> = {
  EMT: 'Energisa Mato Grosso (EMT)',
};
function rotuloAgente(sigla: string): string {
  return ROTULOS_AGENTE[sigla] ?? sigla;
}

function pctParaFracao(s: string): number {
  if (!s?.trim()) return 0;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n / 100 : 0;
}

export default function SeletorTarifaAneel({
  ufInicial = 'MT',
  onChange,
}: {
  ufInicial?: string;
  onChange?: (info: InfoTarifaria | null) => void;
}) {
  const [uf, setUf] = useState(ufInicial);
  const [agente, setAgente] = useState(AGENTE_PADRAO);
  const [subgrupo, setSubgrupo] = useState('A4');
  const [modalidade, setModalidade] = useState('Verde');
  const [posto, setPosto] = useState('Fora ponta');

  // ICMS pré-preenchido do fallback da UF; PIS/COFINS efetivos vêm da fatura.
  const [icmsPctStr, setIcmsPctStr] = useState(
    String((icmsFallbackPorUf(ufInicial) * 100).toFixed(2)).replace('.', ','),
  );
  const [pisPctStr, setPisPctStr] = useState('');
  const [cofinsPctStr, setCofinsPctStr] = useState('');

  const [selecionada, setSelecionada] = useState<TarifaAneel | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  // Lista de distribuidoras lida do arquivo estático gerado pelo robô semanal.
  // Começa com o default garantido (EMT) para nunca quebrar a pré-seleção.
  const [distribuidoras, setDistribuidoras] = useState<string[]>([AGENTE_PADRAO]);
  const [grafiasNota, setGrafiasNota] = useState('');

  // Carrega /grafias-aneel.json UMA vez ao montar a tela (sem rota ?listar=).
  useEffect(() => {
    let vivo = true;
    fetch('/grafias-aneel.json', { cache: 'no-cache' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j) => {
        if (!vivo) return;
        const lista: string[] = Array.isArray(j?.distribuidoras) ? j.distribuidoras : [];
        // Garante o default EMT mesmo se o arquivo ainda estiver incompleto.
        const merged = Array.from(new Set([AGENTE_PADRAO, ...lista])).sort((a, b) =>
          a.localeCompare(b, 'pt-BR'),
        );
        setDistribuidoras(merged);
      })
      .catch(() => {
        if (!vivo) return;
        setGrafiasNota('Lista de distribuidoras ainda sincronizando — usando o padrão (EMT).');
        setDistribuidoras([AGENTE_PADRAO]);
      });
    return () => {
      vivo = false;
    };
  }, []);

  // Ao trocar a UF, reaplica o ICMS de fallback dela.
  useEffect(() => {
    setIcmsPctStr(String((icmsFallbackPorUf(uf) * 100).toFixed(2)).replace('.', ','));
  }, [uf]);

  async function buscar() {
    setErro('');
    setCarregando(true);
    setSelecionada(null);
    try {
      const res = await buscarTarifasAneel({ agente, subgrupo, modalidade, posto });
      if (res.length === 0) {
        setErro('Nenhuma tarifa encontrada para esta combinação. Confira distribuidora/subgrupo/modalidade/posto.');
      } else {
        setSelecionada(res[0]); // a API já ordena por vigência mais recente
      }
    } catch (e: any) {
      setErro(e?.message ?? 'Falha ao consultar a ANEEL.');
    } finally {
      setCarregando(false);
    }
  }

  // Gross-up reativo + emissão para o pai.
  const icmsFr = pctParaFracao(icmsPctStr);
  const pisFr = pctParaFracao(pisPctStr);
  const cofinsFr = pctParaFracao(cofinsPctStr);

  const vlrTe = selecionada?.vlrTe ?? null;
  const vlrTusd = selecionada?.vlrTusd ?? null;

  let tarifaLiquidaTotal: number | null = null;
  let tarifaComImpostoTotal: number | null = null;
  if (vlrTe != null || vlrTusd != null) {
    tarifaLiquidaTotal = (vlrTe ?? 0) + (vlrTusd ?? 0);
    const out = calcularTarifaPorDentro(
      { vlrTe: vlrTe ?? 0, vlrTusd: vlrTusd ?? 0 },
      { aliquotaIcms: icmsFr, aliquotaPis: pisFr, aliquotaCofins: cofinsFr },
      uf,
    );
    tarifaComImpostoTotal = out.tarifaTotalComImposto;
  }

  useEffect(() => {
    if (!onChange) return;
    if (!selecionada) {
      onChange(null);
      return;
    }
    onChange({
      uf,
      agente,
      subgrupo,
      modalidade,
      posto,
      icmsPct: icmsFr,
      pisPct: pisFr,
      cofinsPct: cofinsFr,
      vlrTeLiquido: vlrTe,
      vlrTusdLiquido: vlrTusd,
      tarifaLiquidaTotal,
      tarifaComImpostoTotal,
      inicioVigencia: selecionada?.inicioVigencia ?? null,
      origem: 'ANEEL',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uf, agente, subgrupo, modalidade, posto, icmsPctStr, pisPctStr, cofinsPctStr, selecionada]);

  return (
    <div style={styles.box}>
      <div>
        <h3 style={styles.title}>Tarifa da distribuidora (ANEEL)</h3>
        <span style={styles.helper}>
          Busca a tarifa homologada vigente na base da ANEEL e aplica os tributos
          "por dentro". Informe o PIS/COFINS efetivos da fatura para o valor com
          imposto sair exato (eles variam mês a mês).
        </span>
      </div>

      <div style={styles.grid}>
        <div style={styles.field}>
          <label style={styles.label}>UF</label>
          <select value={uf} onChange={(e) => setUf(e.target.value)} style={styles.input}>
            {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Distribuidora</label>
          <select value={agente} onChange={(e) => setAgente(e.target.value)} style={styles.input}>
            {distribuidoras.map((a) => (
              <option key={a} value={a}>{rotuloAgente(a)}</option>
            ))}
          </select>
          {grafiasNota && <span style={styles.helper}>{grafiasNota}</span>}
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Subgrupo</label>
          <select value={subgrupo} onChange={(e) => setSubgrupo(e.target.value)} style={styles.input}>
            {SUBGRUPOS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Modalidade</label>
          <select value={modalidade} onChange={(e) => setModalidade(e.target.value)} style={styles.input}>
            {MODALIDADES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Posto</label>
          <select value={posto} onChange={(e) => setPosto(e.target.value)} style={styles.input}>
            {POSTOS.map((p) => <option key={p || 'todos'} value={p}>{p || 'Todos'}</option>)}
          </select>
        </div>
      </div>

      <div style={styles.grid}>
        <div style={styles.field}>
          <label style={styles.label}>ICMS (%)</label>
          <input value={icmsPctStr} onChange={(e) => setIcmsPctStr(e.target.value)} style={styles.inputNum} />
          <span style={styles.helper}>Pré-preenchido pela UF (editável)</span>
        </div>
        <div style={styles.field}>
          <label style={styles.label}>PIS efetivo (%)</label>
          <input value={pisPctStr} onChange={(e) => setPisPctStr(e.target.value)} placeholder="da fatura" style={styles.inputNum} />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>COFINS efetivo (%)</label>
          <input value={cofinsPctStr} onChange={(e) => setCofinsPctStr(e.target.value)} placeholder="da fatura" style={styles.inputNum} />
        </div>
      </div>

      <div>
        <button type="button" onClick={buscar} disabled={carregando} style={styles.buscarBtn}>
          {carregando ? 'Consultando ANEEL...' : 'Buscar tarifa ANEEL'}
        </button>
      </div>

      {erro && <div style={styles.erro}>{erro}</div>}

      {selecionada && (
        <div style={styles.resultado}>
          <div style={styles.resLinha}>
            <span style={styles.resLabel}>
              {selecionada.agente} · {selecionada.subgrupo} · {selecionada.modalidade} · {selecionada.posto}
            </span>
            {selecionada.inicioVigencia && (
              <span style={styles.resVig}>vigência desde {selecionada.inicioVigencia}</span>
            )}
          </div>
          <div style={styles.resGrid}>
            <Metrica titulo="TE líquida" valor={fmt(vlrTe)} />
            <Metrica titulo="TUSD líquida" valor={fmt(vlrTusd)} />
            <Metrica titulo="Total líquido" valor={fmt(tarifaLiquidaTotal)} />
            <Metrica titulo="Total c/ imposto" valor={fmt(tarifaComImpostoTotal)} destaque />
          </div>
          {(!pisPctStr || !cofinsPctStr) && (
            <span style={styles.aviso}>
              Informe PIS e COFINS efetivos da fatura para o "Total c/ imposto" ficar exato.
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function Metrica({ titulo, valor, destaque = false }: { titulo: string; valor: string; destaque?: boolean }) {
  return (
    <div style={{ ...styles.metrica, ...(destaque ? styles.metricaDestaque : {}) }}>
      <span style={styles.metricaLabel}>{titulo}</span>
      <strong style={{ ...styles.metricaValor, fontVariantNumeric: 'tabular-nums' }}>{valor}</strong>
    </div>
  );
}

function fmt(v: number | null): string {
  if (v == null) return '—';
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 5, maximumFractionDigits: 5 })}/kWh`;
}

const styles: Record<string, React.CSSProperties> = {
  box: { padding: 16, borderRadius: 12, background: '#F4F6F9', border: '1px solid #D5E8F3', display: 'grid', gap: 12 },
  title: { margin: 0, fontSize: 16, fontWeight: 800, color: '#1B3A6B' },
  helper: { fontSize: 12, color: '#475467', lineHeight: 1.4 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 },
  field: { display: 'grid', gap: 6 },
  label: { fontSize: 14, fontWeight: 700, color: '#1B3A6B' },
  input: { width: '100%', borderRadius: 10, border: '1px solid #D5E8F3', background: '#FFFFFF', padding: '12px 14px', fontSize: 15, color: '#101828', outline: 'none', boxSizing: 'border-box' },
  inputNum: { width: '100%', borderRadius: 10, border: '1px solid #D5E8F3', background: '#FFFFFF', padding: '12px 14px', fontSize: 15, color: '#101828', outline: 'none', boxSizing: 'border-box', fontVariantNumeric: 'tabular-nums' },
  buscarBtn: { padding: '12px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #1B3A6B 0%, #2E86C1 100%)', color: '#FFFFFF', fontWeight: 800, fontSize: 15, cursor: 'pointer' },
  erro: { padding: 12, borderRadius: 8, background: '#FDEDEC', color: '#C0392B', fontSize: 14, fontWeight: 700 },
  resultado: { padding: 14, borderRadius: 10, background: '#FFFFFF', border: '1px solid #D5E8F3', display: 'grid', gap: 10 },
  resLinha: { display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' },
  resLabel: { fontSize: 13, fontWeight: 800, color: '#1B3A6B' },
  resVig: { fontSize: 12, color: '#475467' },
  resGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 },
  metrica: { padding: 10, borderRadius: 8, background: '#F4F6F9', border: '1px solid #D5E8F3', display: 'grid', gap: 4 },
  metricaDestaque: { background: '#EEF5FF', border: '1px solid #2E86C1' },
  metricaLabel: { fontSize: 11, fontWeight: 800, letterSpacing: 0.8, color: '#475467', textTransform: 'uppercase' },
  metricaValor: { fontSize: 14, fontWeight: 800, color: '#1B3A6B' },
  aviso: { fontSize: 12, color: '#B54708', background: '#FFFAEB', border: '1px solid #FEDF89', borderRadius: 8, padding: '8px 10px' },
};
