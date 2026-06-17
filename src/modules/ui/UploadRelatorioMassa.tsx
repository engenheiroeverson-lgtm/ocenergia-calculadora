import React, { useMemo, useState } from 'react';
import { extrairDadosRelatorioMassaDoTexto } from '../parsers/parserRelatorioMassa';
import { completarDadosParciais } from '../normalizador/normalizadorParcial';
import { calcularBancoCapacitorIndustrial } from '../calculadora/calculadoraIndustrial';
import ResultadoTecnico from './ResultadoTecnico';
import type { ResultadoCalculadoraIndustrial, ResultadoExtracaoRelatorioMassa } from '../../types/types';

type FormComplemento = {
  potenciaAtivaKw: string;
  fpAtual: string;
  tensaoV: string;
  demandaKw: string;
  variacaoCargaPct: string;
  energiaAtivaKwh: string;
  energiaReativaKvarh: string;
  fpAlvo: string;
};

const complementoInicial: FormComplemento = {
  potenciaAtivaKw: '',
  fpAtual: '',
  tensaoV: '',
  demandaKw: '',
  variacaoCargaPct: '',
  energiaAtivaKwh: '',
  energiaReativaKvarh: '',
  fpAlvo: '',
};

const cores = {
  azulEscuro: '#1B3A6B',
  azulMedio: '#2E86C1',
  laranja: '#F39C12',
  laranjaEscuro: '#E67E22',
  branco: '#FFFFFF',
  cinzaFundo: '#F4F6F9',
  cinzaBorda: '#D5E8F3',
  cinzaTexto: '#475467',
};

export default function UploadRelatorioMassa() {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [texto, setTexto] = useState<string>('');
  const [extraido, setExtraido] = useState<ResultadoExtracaoRelatorioMassa | null>(null);
  const [complemento, setComplemento] = useState<FormComplemento>(complementoInicial);
  const [resultado, setResultado] = useState<ResultadoCalculadoraIndustrial | null>(null);
  const [mensagem, setMensagem] = useState<string>('');
  const [erro, setErro] = useState<string>('');

  const registrosOrdenados = useMemo(() => {
    if (!extraido?.registros?.length) return [];
    return [...extraido.registros].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.camposFaltantes.length - b.camposFaltantes.length;
    });
  }, [extraido]);

  const melhorRegistro = registrosOrdenados[0] ?? null;

  function limparTudo() {
    setArquivo(null);
    setTexto('');
    setExtraido(null);
    setComplemento(complementoInicial);
    setResultado(null);
    setMensagem('');
    setErro('');
  }

  function interpretarTexto(content: string) {
    const parsed = extrairDadosRelatorioMassaDoTexto(content);
    setExtraido(parsed);
    setMensagem(parsed.mensagem);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setArquivo(file);
    setErro('');
    setResultado(null);
    setExtraido(null);
    setMensagem('');
    if (!file) return;
    const nome = file.name.toLowerCase();
    if (nome.endsWith('.txt') || nome.endsWith('.csv') || file.type === 'text/plain') {
      file.text().then((content) => {
        setTexto(content);
        interpretarTexto(content);
      }).catch(() => setErro('Não foi possível ler o arquivo.'));
      return;
    }
    setMensagem('Formato aceito no MVP: TXT e CSV.');
  }

  function handleTextoChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setTexto(e.target.value);
  }

  function handleComplementoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setComplemento((prev) => ({ ...prev, [name]: value }));
  }

  function processarTexto() {
    try {
      setErro('');
      setResultado(null);
      if (!texto.trim()) throw new Error('Cole o texto do relatório antes de interpretar.');
      interpretarTexto(texto);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao interpretar o relatório.';
      setErro(msg);
    }
  }

  function calcularResultado() {
    try {
      setErro('');
      setResultado(null);
      if (!extraido) throw new Error('Faça a interpretação do relatório antes de calcular.');

      const base = melhorRegistro?.dadosParciais ?? extraido.dadosParciais;

      const dados = completarDadosParciais(
        { ...extraido, dadosParciais: base },
        {
          potenciaAtivaKw: complemento.potenciaAtivaKw ? Number(complemento.potenciaAtivaKw) : undefined,
          fpAtual: complemento.fpAtual ? Number(complemento.fpAtual) : undefined,
          tensaoV: complemento.tensaoV ? Number(complemento.tensaoV) : undefined,
          demandaKw: complemento.demandaKw ? Number(complemento.demandaKw) : undefined,
          variacaoCargaPct: complemento.variacaoCargaPct ? Number(complemento.variacaoCargaPct) : undefined,
          energiaAtivaKwh: complemento.energiaAtivaKwh ? Number(complemento.energiaAtivaKwh) : undefined,
          energiaReativaKvarh: complemento.energiaReativaKvarh ? Number(complemento.energiaReativaKvarh) : undefined,
          fpAlvo: complemento.fpAlvo ? Number(complemento.fpAlvo) : undefined,
        },
      );

      const calculo = calcularBancoCapacitorIndustrial(dados, {
        fpAlvo: dados.fpAlvo ?? 0.95,
        margemSegurancaPct: 5,
      });

      setResultado(calculo);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao calcular.';
      setErro(msg);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <p style={styles.kicker}>Relatório de massa</p>
          <h2 style={styles.title}>Leitura em lote da base técnica</h2>
          <p style={styles.subtitle}>
            Envie ou cole um TXT/CSV com múltiplas linhas para identificar o melhor registro e calcular.
          </p>
        </div>
        <button type="button" onClick={limparTudo} style={styles.buttonGhost}>Limpar</button>
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>1. Enviar arquivo</h3>
        <input type="file" accept=".txt,.csv" onChange={handleFileChange} />
        <p style={styles.helpText}>O parser identifica vários registros e seleciona o melhor para o cálculo.</p>
        {arquivo && <p style={styles.infoText}>Arquivo selecionado: {arquivo.name}</p>}
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>2. Texto bruto do relatório</h3>
        <textarea rows={10} value={texto} onChange={handleTextoChange} placeholder="Cole aqui o conteúdo do relatório de massa..." style={styles.textarea} />
        <div style={styles.actionsRow}>
          <button type="button" onClick={processarTexto} style={styles.buttonSecondary}>Interpretar relatório</button>
        </div>
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>3. Complementação manual do melhor registro</h3>
        <div style={styles.grid}>
          <Field label="Potência ativa (kW)" name="potenciaAtivaKw" value={complemento.potenciaAtivaKw} onChange={handleComplementoChange} placeholder="Ex: 120" helper="Potência média ou demanda ativa" />
          <Field label="FP atual" name="fpAtual" value={complemento.fpAtual} onChange={handleComplementoChange} placeholder="Ex: 0,72" helper="Valor entre 0 e 1" />
          <Field label="Tensão (V)" name="tensaoV" value={complemento.tensaoV} onChange={handleComplementoChange} placeholder="Ex: 380" helper="Tensão nominal da instalação" />
          <Field label="FP alvo" name="fpAlvo" value={complemento.fpAlvo} onChange={handleComplementoChange} placeholder="Padrão 0,95" helper="Opcional. Se vazio, usa 0,95" />
          <Field label="Demanda (kW)" name="demandaKw" value={complemento.demandaKw} onChange={handleComplementoChange} placeholder="Opcional" helper="Ajuda na análise" />
          <Field label="Variação de carga (%)" name="variacaoCargaPct" value={complemento.variacaoCargaPct} onChange={handleComplementoChange} placeholder="Ex: 18" helper="Orienta banco fixo ou automático" />
          <Field label="Energia ativa (kWh)" name="energiaAtivaKwh" value={complemento.energiaAtivaKwh} onChange={handleComplementoChange} placeholder="Opcional" helper="Pode ajudar na validação" />
          <Field label="Energia reativa (kVArh)" name="energiaReativaKvarh" value={complemento.energiaReativaKvarh} onChange={handleComplementoChange} placeholder="Opcional" helper="Útil para derivar o FP" />
        </div>
        <div style={styles.actionsRow}>
          <button type="button" onClick={calcularResultado} style={styles.buttonPrimary}>Calcular banco ideal</button>
        </div>
      </div>

      {mensagem && <div style={styles.messageBox}>{mensagem}</div>}
      {erro && <div style={styles.errorBox}>{erro}</div>}

      {extraido && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Resumo da extração</h3>
          <div style={styles.previewGrid}>
            <Preview label="Status" value={extraido.status} />
            <Preview label="Origem" value={extraido.origemDados} />
            <Preview label="Total de registros" value={String(extraido.totalRegistros)} />
            <Preview label="Campos faltantes" value={extraido.camposFaltantes.length ? extraido.camposFaltantes.join(', ') : 'Nenhum'} />
          </div>

          {melhorRegistro && (
            <div style={styles.bestBox}>
              <strong style={{ color: cores.azulEscuro }}>Melhor registro identificado</strong>
              <p style={styles.bestLine}><strong>Score:</strong> {melhorRegistro.score}</p>
              <p style={styles.bestLine}><strong>Status:</strong> {melhorRegistro.status}</p>
              <p style={styles.bestLine}><strong>Campos faltantes:</strong> {melhorRegistro.camposFaltantes.length ? melhorRegistro.camposFaltantes.join(', ') : 'Nenhum'}</p>
            </div>
          )}

          {registrosOrdenados.length > 1 && (
            <div style={styles.tabelaWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>#</th>
                    <th style={styles.th}>Score</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Campos faltantes</th>
                  </tr>
                </thead>
                <tbody>
                  {registrosOrdenados.map((registro) => (
                    <tr key={registro.indice}>
                      <td style={styles.td}>{registro.indice}</td>
                      <td style={styles.td}>{registro.score}</td>
                      <td style={styles.td}>{registro.status}</td>
                      <td style={styles.td}>{registro.camposFaltantes.length ? registro.camposFaltantes.join(', ') : 'Nenhum'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {resultado && <ResultadoTecnico resultado={resultado} />}
    </div>
  );
}

function Field({ label, name, value, onChange, placeholder, helper }: {
  label: string; name: string; value: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  placeholder?: string; helper?: string;
}) {
  return (
    <div style={styles.field}>
      <label style={styles.label}>{label}</label>
      <input type="text" name={name} value={value} onChange={onChange} placeholder={placeholder} style={styles.input} />
      {helper && <span style={styles.helper}>{helper}</span>}
    </div>
  );
}

function Preview({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.previewCard}>
      <span style={styles.previewLabel}>{label}</span>
      <strong style={styles.previewValue}>{value}</strong>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'grid', gap: 16, padding: 20, borderRadius: 16, background: '#FFFFFF', border: '1px solid #D5E8F3', boxShadow: '0 8px 24px rgba(27,58,107,0.08)' },
  header: { display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' },
  headerLeft: { display: 'grid', gap: 8, flex: 1 },
  kicker: { margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: 1.2, color: '#F39C12', textTransform: 'uppercase' },
  title: { margin: '4px 0 0', fontSize: 24, fontWeight: 800, color: '#1B3A6B' },
  subtitle: { margin: 0, color: '#475467', lineHeight: 1.5, maxWidth: 760 },
  section: { padding: 16, borderRadius: 14, background: '#F4F6F9', border: '1px solid #D5E8F3', display: 'grid', gap: 12 },
  sectionTitle: { margin: 0, fontSize: 18, fontWeight: 800, color: '#1B3A6B' },
  helpText: { margin: 0, color: '#475467', fontSize: 14 },
  infoText: { margin: 0, color: '#2E86C1', fontWeight: 700 },
  textarea: { width: '100%', minHeight: 180, resize: 'vertical', borderRadius: 10, border: '1px solid #D5E8F3', padding: 12, fontFamily: 'inherit', fontSize: 14, background: '#FFFFFF', boxSizing: 'border-box' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 },
  field: { display: 'grid', gap: 6 },
  label: { fontSize: 14, fontWeight: 700, color: '#1B3A6B' },
  input: { width: '100%', borderRadius: 10, border: '1px solid #D5E8F3', background: '#FFFFFF', padding: '12px 14px', fontSize: 15, color: '#101828', outline: 'none', boxSizing: 'border-box' },
  helper: { fontSize: 12, color: '#475467', lineHeight: 1.4 },
  actionsRow: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  buttonPrimary: { padding: '12px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #1B3A6B 0%, #2E86C1 100%)', color: '#FFFFFF', cursor: 'pointer', fontWeight: 800, fontSize: 15, boxShadow: '0 8px 18px rgba(27,58,107,0.18)' },
  buttonSecondary: { padding: '12px 18px', borderRadius: 10, border: '1px solid #F39C12', background: '#FFFFFF', color: '#E67E22', cursor: 'pointer', fontWeight: 800, fontSize: 15 },
  buttonGhost: { padding: '12px 18px', borderRadius: 10, border: '1px solid #F39C12', background: '#FFFFFF', color: '#E67E22', cursor: 'pointer', fontWeight: 800, fontSize: 15 },
  messageBox: { padding: 14, borderRadius: 12, background: '#eef5ff', border: '1px solid #D5E8F3', color: '#1B3A6B', fontWeight: 600 },
  errorBox: { padding: 14, borderRadius: 12, background: '#fef3f2', border: '1px solid #fecdca', color: '#b42318', fontWeight: 600 },
  previewGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 },
  previewCard: { padding: 14, borderRadius: 12, background: '#FFFFFF', border: '1px solid #D5E8F3', display: 'grid', gap: 6 },
  previewLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4, color: '#475467', fontWeight: 700 },
  previewValue: { fontSize: 15, color: '#101828', wordBreak: 'break-word' },
  bestBox: { padding: 14, borderRadius: 12, background: '#eef5ff', border: '1px solid #D5E8F3', display: 'grid', gap: 6 },
  bestLine: { margin: 0, color: '#101828', lineHeight: 1.5 },
  tabelaWrapper: { overflowX: 'auto', borderRadius: 12, border: '1px solid #D5E8F3' },
  table: { width: '100%', borderCollapse: 'collapse', background: '#FFFFFF' },
  th: { textAlign: 'left', padding: '12px 14px', fontSize: 13, fontWeight: 800, color: '#1B3A6B', background: '#F4F6F9', borderBottom: '1px solid #D5E8F3', whiteSpace: 'nowrap' },
  td: { padding: '12px 14px', fontSize: 14, color: '#101828', borderBottom: '1px solid #EEF2F6', whiteSpace: 'nowrap' },
};