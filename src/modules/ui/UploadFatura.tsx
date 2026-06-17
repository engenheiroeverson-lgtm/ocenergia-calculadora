import React, { useMemo, useState } from 'react';
import { extrairDadosFaturaDoTexto } from '../parsers/parserFatura';
import { completarDadosParciais } from '../normalizador/normalizadorParcial';
import { calcularBancoCapacitorIndustrial } from '../calculadora/calculadoraIndustrial';
import ResultadoTecnico from './ResultadoTecnico';
import type { ResultadoCalculadoraIndustrial, ResultadoExtracaoParcial } from '../../types/types';

type FormComplemento = {
  potenciaAtivaKw: string;
  fpAtual: string;
  tensaoV: string;
  demandaKw: string;
  variacaoCargaPct: string;
  energiaAtivaKwh: string;
  energiaReativaKvarh: string;
};

const complementoInicial: FormComplemento = {
  potenciaAtivaKw: '',
  fpAtual: '',
  tensaoV: '',
  demandaKw: '',
  variacaoCargaPct: '',
  energiaAtivaKwh: '',
  energiaReativaKvarh: '',
};

export default function UploadFatura() {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [texto, setTexto] = useState<string>('');
  const [extraido, setExtraido] = useState<ResultadoExtracaoParcial | null>(null);
  const [complemento, setComplemento] = useState<FormComplemento>(complementoInicial);
  const [resultado, setResultado] = useState<ResultadoCalculadoraIndustrial | null>(null);
  const [mensagem, setMensagem] = useState<string>('');
  const [erro, setErro] = useState<string>('');

  const camposFaltantes = useMemo(() => extraido?.camposFaltantes ?? [], [extraido]);

  function limparTudo() {
    setArquivo(null);
    setTexto('');
    setExtraido(null);
    setComplemento(complementoInicial);
    setResultado(null);
    setMensagem('');
    setErro('');
  }

  function processarTextoFatura(content: string) {
    const parsed = extrairDadosFaturaDoTexto(content);
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
        processarTextoFatura(content);
      }).catch(() => setErro('Não foi possível ler o arquivo.'));
      return;
    }
    if (nome.endsWith('.pdf')) {
      setMensagem('Arquivo PDF selecionado. Nesta versão, use a extração de texto do PDF antes de interpretar.');
      return;
    }
    setMensagem('Formato aceito no MVP: TXT, CSV e texto bruto.');
  }

  function handleComplementoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setComplemento((prev) => ({ ...prev, [name]: value }));
  }

  function handleTextoChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setTexto(e.target.value);
  }

  function interpretarTexto() {
    try {
      setErro('');
      setResultado(null);
      if (!texto.trim()) throw new Error('Cole o texto da fatura antes de interpretar.');
      processarTextoFatura(texto);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao interpretar a fatura.';
      setErro(msg);
    }
  }

  function calcularResultado() {
    try {
      setErro('');
      setResultado(null);
      if (!extraido) throw new Error('Faça a interpretação da fatura antes de calcular.');

      const dados = completarDadosParciais(extraido, {
        potenciaAtivaKw: complemento.potenciaAtivaKw ? Number(complemento.potenciaAtivaKw) : undefined,
        fpAtual: complemento.fpAtual ? Number(complemento.fpAtual) : undefined,
        tensaoV: complemento.tensaoV ? Number(complemento.tensaoV) : undefined,
        demandaKw: complemento.demandaKw ? Number(complemento.demandaKw) : undefined,
        variacaoCargaPct: complemento.variacaoCargaPct ? Number(complemento.variacaoCargaPct) : undefined,
        energiaAtivaKwh: complemento.energiaAtivaKwh ? Number(complemento.energiaAtivaKwh) : undefined,
        energiaReativaKvarh: complemento.energiaReativaKvarh ? Number(complemento.energiaReativaKvarh) : undefined,
      });

      const calculo = calcularBancoCapacitorIndustrial(dados, {
        fpAlvo: 0.95,
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
          <p style={styles.kicker}>Fatura de energia</p>
          <h2 style={styles.title}>Leitura técnica da conta</h2>
          <p style={styles.subtitle}>
            Cole o texto da fatura ou envie um arquivo TXT/CSV para extrair os dados e calcular o banco ideal.
          </p>
        </div>
        <button type="button" onClick={limparTudo} style={styles.buttonGhost}>Limpar</button>
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>1. Enviar arquivo</h3>
        <input type="file" accept=".txt,.csv,.pdf" onChange={handleFileChange} />
        <p style={styles.helpText}>TXT e CSV funcionam direto. PDF pode ser incluído na próxima etapa.</p>
        {arquivo && <p style={styles.infoText}>Arquivo selecionado: {arquivo.name}</p>}
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>2. Texto bruto da fatura</h3>
        <textarea rows={10} value={texto} onChange={handleTextoChange} placeholder="Cole aqui o texto da fatura..." style={styles.textarea} />
        <div style={styles.actionsRow}>
          <button type="button" onClick={interpretarTexto} style={styles.buttonSecondary}>Interpretar fatura</button>
        </div>
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>3. Complementação manual</h3>
        <div style={styles.grid}>
          <Field label="Potência ativa (kW)" name="potenciaAtivaKw" value={complemento.potenciaAtivaKw} onChange={handleComplementoChange} placeholder="Ex: 120" helper="Potência média ou demanda ativa" />
          <Field label="FP atual" name="fpAtual" value={complemento.fpAtual} onChange={handleComplementoChange} placeholder="Ex: 0,72" helper="Valor entre 0 e 1" />
          <Field label="Tensão (V)" name="tensaoV" value={complemento.tensaoV} onChange={handleComplementoChange} placeholder="Ex: 380" helper="Tensão nominal da instalação" />
          <Field label="Demanda (kW)" name="demandaKw" value={complemento.demandaKw} onChange={handleComplementoChange} placeholder="Opcional" helper="Ajuda na análise da carga" />
          <Field label="Variação de carga (%)" name="variacaoCargaPct" value={complemento.variacaoCargaPct} onChange={handleComplementoChange} placeholder="Ex: 18" helper="Orienta banco fixo ou automático" />
          <Field label="Energia ativa (kWh)" name="energiaAtivaKwh" value={complemento.energiaAtivaKwh} onChange={handleComplementoChange} placeholder="Opcional" helper="Pode ajudar a validar a leitura" />
          <Field label="Energia reativa (kVArh)" name="energiaReativaKvarh" value={complemento.energiaReativaKvarh} onChange={handleComplementoChange} placeholder="Opcional" helper="Útil para derivar o FP" />
        </div>
        <div style={styles.actionsRow}>
          <button type="button" onClick={calcularResultado} style={styles.buttonPrimary}>Calcular banco ideal</button>
        </div>
        {camposFaltantes.length > 0 && (
          <div style={styles.warningBox}>
            <strong>Campos faltantes na extração:</strong> {camposFaltantes.join(', ')}
          </div>
        )}
      </div>

      {mensagem && <div style={styles.messageBox}>{mensagem}</div>}
      {erro && <div style={styles.errorBox}>{erro}</div>}

      {extraido && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Resumo da extração</h3>
          <div style={styles.previewGrid}>
            <Preview label="Status" value={extraido.status} />
            <Preview label="Origem" value={extraido.origemDados} />
            <Preview label="Campos faltantes" value={extraido.camposFaltantes.length ? extraido.camposFaltantes.join(', ') : 'Nenhum'} />
          </div>
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
  warningBox: { padding: 14, borderRadius: 12, background: '#fffaeb', border: '1px solid #fedf89', color: '#b54708', fontWeight: 600 },
  messageBox: { padding: 14, borderRadius: 12, background: '#eef5ff', border: '1px solid #D5E8F3', color: '#1B3A6B', fontWeight: 600 },
  errorBox: { padding: 14, borderRadius: 12, background: '#fef3f2', border: '1px solid #fecdca', color: '#b42318', fontWeight: 600 },
  previewGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 },
  previewCard: { padding: 14, borderRadius: 12, background: '#FFFFFF', border: '1px solid #D5E8F3', display: 'grid', gap: 6 },
  previewLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4, color: '#475467', fontWeight: 700 },
  previewValue: { fontSize: 15, color: '#101828', wordBreak: 'break-word' },
};