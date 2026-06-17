import React, { useMemo, useState } from 'react';
import { normalizarEntradaManual } from '../normalizador/normalizador';
import { calcularBancoCapacitorIndustrial } from '../calculadora/calculadoraIndustrial';
import ResultadoTecnico from './ResultadoTecnico';
import type { EntradaManual, ResultadoCalculadoraIndustrial } from '../../types/types';

type FormState = Omit<EntradaManual, 'origemDados'>;

const estadoInicial: FormState = {
  potenciaAtivaKw: '',
  fpAtual: '',
  tensaoV: '',
  observacoes: '',
  energiaAtivaKwh: '',
  energiaReativaKvarh: '',
  demandaKw: '',
  demandaMinKw: '',
  demandaMaxKw: '',
  variacaoCargaPct: '',
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

export default function FormularioManual() {
  const [form, setForm] = useState<FormState>(estadoInicial);
  const [resultado, setResultado] = useState<ResultadoCalculadoraIndustrial | null>(null);
  const [erro, setErro] = useState<string>('');
  const [mensagem, setMensagem] = useState<string>('');

  const camposPreenchidos = useMemo(() => {
    return Object.entries(form)
      .filter(([chave, valor]) => chave !== 'observacoes' && String(valor).trim() !== '')
      .map(([chave]) => chave);
  }, [form]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function limparTudo() {
    setForm(estadoInicial);
    setResultado(null);
    setErro('');
    setMensagem('');
  }

  function calcular() {
    try {
      setErro('');
      setMensagem('');
      setResultado(null);

      const dadosNormalizados = normalizarEntradaManual({
        potenciaAtivaKw: form.potenciaAtivaKw,
        fpAtual: form.fpAtual,
        tensaoV: form.tensaoV,
        origemDados: 'manual',
        observacoes: form.observacoes?.trim() || undefined,
        energiaAtivaKwh: form.energiaAtivaKwh,
        energiaReativaKvarh: form.energiaReativaKvarh,
        demandaKw: form.demandaKw,
        demandaMinKw: form.demandaMinKw,
        demandaMaxKw: form.demandaMaxKw,
        variacaoCargaPct: form.variacaoCargaPct,
        fpAlvo: form.fpAlvo,
      });

      const calculo = calcularBancoCapacitorIndustrial(dadosNormalizados, {
        fpAlvo: dadosNormalizados.fpAlvo,
        margemSegurancaPct: 5,
      });

      setResultado(calculo);
      setMensagem('Cálculo realizado com sucesso.');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao processar a entrada manual.';
      setErro(msg);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <p style={styles.kicker}>Entrada manual</p>
          <h2 style={styles.title}>Preenchimento técnico da instalação</h2>
          <p style={styles.subtitle}>
            Informe os dados da planta para calcular o banco de capacitores ideal com o padrão OCENERGIA.
          </p>
        </div>
        <button type="button" onClick={limparTudo} style={styles.buttonGhost}>
          Limpar
        </button>
      </div>

      <div style={styles.grid}>
        <Field label="Potência ativa (kW)" name="potenciaAtivaKw" value={form.potenciaAtivaKw} onChange={handleChange} placeholder="Ex: 120" helper="Potência média ou demanda ativa da instalação" required />
        <Field label="FP atual" name="fpAtual" value={form.fpAtual} onChange={handleChange} placeholder="Ex: 0,72" helper="Valor entre 0 e 1" required />
        <Field label="Tensão (V)" name="tensaoV" value={form.tensaoV} onChange={handleChange} placeholder="Ex: 380" helper="Tensão nominal da instalação" required />
        <Field label="FP alvo" name="fpAlvo" value={form.fpAlvo ?? ''} onChange={handleChange} placeholder="Padrão 0,95" helper="Opcional. Se vazio, usa 0,95" />
        <Field label="Energia ativa (kWh)" name="energiaAtivaKwh" value={form.energiaAtivaKwh ?? ''} onChange={handleChange} placeholder="Opcional" helper="Pode auxiliar na validação" />
        <Field label="Energia reativa (kVArh)" name="energiaReativaKvarh" value={form.energiaReativaKvarh ?? ''} onChange={handleChange} placeholder="Opcional" helper="Útil para estimar o FP" />
        <Field label="Demanda (kW)" name="demandaKw" value={form.demandaKw ?? ''} onChange={handleChange} placeholder="Opcional" helper="Se disponível, melhora a análise" />
        <Field label="Demanda mínima (kW)" name="demandaMinKw" value={form.demandaMinKw ?? ''} onChange={handleChange} placeholder="Opcional" helper="Apoia leitura de variação" />
        <Field label="Demanda máxima (kW)" name="demandaMaxKw" value={form.demandaMaxKw ?? ''} onChange={handleChange} placeholder="Opcional" helper="Apoia leitura de variação" />
        <Field label="Variação de carga (%)" name="variacaoCargaPct" value={form.variacaoCargaPct ?? ''} onChange={handleChange} placeholder="Ex: 18" helper="Ajuda a indicar banco fixo ou automático" />
      </div>

      <div style={styles.section}>
        <label style={styles.label} htmlFor="observacoes">Observações</label>
        <textarea
          id="observacoes"
          name="observacoes"
          value={form.observacoes}
          onChange={handleChange}
          rows={4}
          placeholder="Anotações adicionais sobre a instalação..."
          style={styles.textarea}
        />
      </div>

      <div style={styles.actionsRow}>
        <button type="button" onClick={calcular} style={styles.buttonPrimary}>
          Calcular banco ideal
        </button>
      </div>

      {camposPreenchidos.length > 0 && (
        <div style={styles.infoBox}>
          <strong>Campos preenchidos:</strong> {camposPreenchidos.join(', ')}
        </div>
      )}

      {mensagem && <div style={styles.messageBox}>{mensagem}</div>}
      {erro && <div style={styles.errorBox}>{erro}</div>}
      {resultado && <ResultadoTecnico resultado={resultado} />}
    </div>
  );
}

function Field({
  label, name, value, onChange, placeholder, helper, required = false,
}: {
  label: string;
  name: string;
  value: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  helper?: string;
  required?: boolean;
}) {
  return (
    <div style={styles.field}>
      <label style={styles.label} htmlFor={name}>
        {label} {required ? <span style={styles.required}>*</span> : null}
      </label>
      <input
        id={name}
        type="text"
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={styles.input}
      />
      {helper && <span style={styles.helper}>{helper}</span>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'grid', gap: 16, padding: 20, borderRadius: 16, background: cores.branco, border: `1px solid ${cores.cinzaBorda}`, boxShadow: '0 8px 24px rgba(27,58,107,0.08)' },
  header: { display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' },
  kicker: { margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: 1.2, color: cores.laranja, textTransform: 'uppercase' },
  title: { margin: '4px 0 0', fontSize: 24, fontWeight: 800, color: cores.azulEscuro },
  subtitle: { margin: '8px 0 0', color: cores.cinzaTexto, lineHeight: 1.5, maxWidth: 760 },
  section: { display: 'grid', gap: 8 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 },
  field: { display: 'grid', gap: 6 },
  label: { fontSize: 14, fontWeight: 700, color: cores.azulEscuro },
  required: { color: cores.laranjaEscuro },
  input: { width: '100%', borderRadius: 10, border: `1px solid ${cores.cinzaBorda}`, background: cores.branco, padding: '12px 14px', fontSize: 15, color: '#101828', outline: 'none', boxSizing: 'border-box' },
  textarea: { width: '100%', resize: 'vertical', borderRadius: 10, border: `1px solid ${cores.cinzaBorda}`, background: cores.branco, padding: '12px 14px', fontSize: 15, color: '#101828', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
  helper: { fontSize: 12, color: cores.cinzaTexto, lineHeight: 1.4 },
  actionsRow: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  buttonPrimary: { padding: '12px 18px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${cores.azulEscuro} 0%, ${cores.azulMedio} 100%)`, color: cores.branco, cursor: 'pointer', fontWeight: 800, fontSize: 15, boxShadow: '0 8px 18px rgba(27,58,107,0.18)' },
  buttonGhost: { padding: '12px 18px', borderRadius: 10, border: `1px solid ${cores.laranja}`, background: cores.branco, color: cores.laranjaEscuro, cursor: 'pointer', fontWeight: 800, fontSize: 15 },
  infoBox: { padding: 14, borderRadius: 12, background: '#eef5ff', border: `1px solid ${cores.cinzaBorda}`, color: cores.azulEscuro, fontWeight: 600 },
  messageBox: { padding: 14, borderRadius: 12, background: '#eef5ff', border: `1px solid ${cores.cinzaBorda}`, color: cores.azulEscuro, fontWeight: 600 },
  errorBox: { padding: 14, borderRadius: 12, background: '#fef3f2', border: '1px solid #fecdca', color: '#b42318', fontWeight: 600 },
};