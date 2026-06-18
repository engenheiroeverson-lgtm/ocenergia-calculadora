import React, { useMemo, useState } from 'react';
import { normalizarEntradaManual } from '../normalizador/normalizador';
import { calcularBancoCapacitorIndustrial } from '../calculadora/calculadoraIndustrial';
import ResultadoTecnico from './ResultadoTecnico';
import type { EntradaManual, ResultadoCalculadoraIndustrial } from '../../types/types';

type FormState = Omit<EntradaManual, 'origemDados'>;

const estadoInicial: FormState = {
  potenciaAtivaKw: '',
  fpAtual: '0,80',
  tensaoV: '380',
  fpAlvo: '0,92',
  energiaAtivaKwh: '',
  energiaReativaKvarh: '',
  demandaKw: '',
  demandaMinKw: '',
  demandaMaxKw: '',
  variacaoCargaPct: '',
  observacoes: '',
  energiaAtivaPontaKwh: '',
  energiaAtivaForaPontaKwh: '',
  energiaReativaPontaKvarh: '',
  energiaReativaForaPontaKvarh: '',
  demandaPontaKw: '',
  demandaForaPontaKw: '',
};

const TENSOES_BT = ['127', '220', '380', '440'];
const TENSOES_MT = ['2300', '6900', '11000', '13200', '13800', '22000', '23000', '34500'];
const TENSOES_AT = ['69000', '138000', '230000'];
const TENSOES_RAPIDAS = ['220', '380', '440', '13800'];

export default function FormularioManual() {
  const [form, setForm] = useState<FormState>(estadoInicial);
  const [resultado, setResultado] = useState<ResultadoCalculadoraIndustrial | null>(null);
  const [erro, setErro] = useState<string>('');
  const [mensagem, setMensagem] = useState<string>('');

  const camposPreenchidos = useMemo(() => {
    return Object.entries(form)
      .filter(([chave, valor]) =>
        chave !== 'observacoes' && String(valor ?? '').trim() !== '',
      )
      .map(([chave]) => chave);
  }, [form]);

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) {
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

      const formComDefaults: FormState = {
        ...form,
        fpAtual: form.fpAtual?.trim() || '0,80',
        fpAlvo: form.fpAlvo?.trim() || '0,92',
        tensaoV: form.tensaoV?.trim() || '380',
      };

      const dadosNormalizados = normalizarEntradaManual({
        potenciaAtivaKw: formComDefaults.potenciaAtivaKw,
        fpAtual: formComDefaults.fpAtual,
        tensaoV: formComDefaults.tensaoV,
        origemDados: 'manual',
        observacoes: formComDefaults.observacoes?.trim() || undefined,
        energiaAtivaKwh: formComDefaults.energiaAtivaKwh,
        energiaReativaKvarh: formComDefaults.energiaReativaKvarh,
        demandaKw: formComDefaults.demandaKw,
        demandaMinKw: formComDefaults.demandaMinKw,
        demandaMaxKw: formComDefaults.demandaMaxKw,
        variacaoCargaPct: formComDefaults.variacaoCargaPct,
        fpAlvo: formComDefaults.fpAlvo,
      });

      const calculo = calcularBancoCapacitorIndustrial(dadosNormalizados, {
        fpAlvo: dadosNormalizados.fpAlvo,
        margemSegurancaPct: 5,
      });

      setResultado(calculo);
      setMensagem('Cálculo realizado com sucesso.');
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : 'Erro ao processar a entrada manual.';
      setErro(msg);
    }
  }

  return (
    <div style={styles.container}>
      {/* Cabeçalho */}
      <div style={styles.header}>
        <div>
          <p style={styles.kicker}>Entrada manual</p>
          <h2 style={styles.title}>Preenchimento técnico da instalação</h2>
          <p style={styles.subtitle}>
            Informe os dados da instalação. Campos com padrão já estão
            preenchidos — ajuste se souber o valor real.
          </p>
        </div>
        <button type="button" onClick={limparTudo} style={styles.buttonGhost}>
          Limpar
        </button>
      </div>

      {/* Aviso de defaults */}
      <div style={styles.defaultsBox}>
        <strong>Valores pré-programados aplicados quando não informado:</strong>
        <ul style={styles.defaultsList}>
          <li>FP atual = <strong>0,80</strong> (padrão conservador)</li>
          <li>FP alvo = <strong>0,92</strong> (limite mínimo ANEEL)</li>
          <li>Tensão = <strong>380 V</strong> (mais comum no mercado)</li>
        </ul>
      </div>

      {/* Dados principais */}
      <div style={styles.sectionBox}>
        <h3 style={styles.sectionTitle}>Dados principais</h3>
        <div style={styles.grid}>
          <Field
            label="Potência ativa (kW)"
            name="potenciaAtivaKw"
            value={form.potenciaAtivaKw}
            onChange={handleChange}
            placeholder="Ex: 100"
            helper="Potência média ou demanda ativa da instalação"
            required
          />

          <Field
            label="FP atual"
            name="fpAtual"
            value={form.fpAtual ?? ''}
            onChange={handleChange}
            placeholder="Padrão: 0,80"
            helper="Se vazio, usa 0,80 como padrão conservador"
          />

          {/* Tensão com botões rápidos */}
          <div style={styles.field}>
            <label style={styles.label}>
              Tensão (V) <span style={styles.required}>*</span>
            </label>
            <select
              name="tensaoV"
              value={form.tensaoV}
              onChange={handleChange}
              style={styles.input}
            >
              <option value="">Selecione a tensão</option>
              <optgroup label="Baixa Tensão (BT)">
                {TENSOES_BT.map((t) => (
                  <option key={t} value={t}>{t} V</option>
                ))}
              </optgroup>
              <optgroup label="Média Tensão (MT)">
                {TENSOES_MT.map((t) => (
                  <option key={t} value={t}>
                    {Number(t) >= 1000
                      ? `${(Number(t) / 1000).toFixed(1).replace('.0', '')} kV`
                      : `${t} V`}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Alta Tensão (AT)">
                {TENSOES_AT.map((t) => (
                  <option key={t} value={t}>
                    {(Number(t) / 1000).toFixed(0)} kV
                  </option>
                ))}
              </optgroup>
            </select>

            {/* Botões rápidos */}
            <div style={styles.quickTensoes}>
              {TENSOES_RAPIDAS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({ ...prev, tensaoV: t }))
                  }
                  style={{
                    ...styles.quickButton,
                    background:
                      form.tensaoV === t ? '#1B3A6B' : '#F4F6F9',
                    color: form.tensaoV === t ? '#FFFFFF' : '#1B3A6B',
                  }}
                >
                  {Number(t) >= 1000
                    ? `${Number(t) / 1000} kV`
                    : `${t} V`}
                </button>
              ))}
            </div>
            <span style={styles.helper}>
              Tensões mais usadas no mercado: 220 V, 380 V e 440 V (BT) /
              13,8 kV (MT)
            </span>
          </div>

          <Field
            label="FP alvo"
            name="fpAlvo"
            value={form.fpAlvo ?? ''}
            onChange={handleChange}
            placeholder="Padrão: 0,92"
            helper="Se vazio, usa 0,92 (limite mínimo ANEEL)"
          />
        </div>
      </div>

      {/* Dados da fatura */}
      <div style={styles.sectionBox}>
        <h3 style={styles.sectionTitle}>
          Dados da fatura (opcional — melhora o resultado)
        </h3>
        <div style={styles.grid}>
          <Field
            label="Energia ativa total (kWh)"
            name="energiaAtivaKwh"
            value={form.energiaAtivaKwh ?? ''}
            onChange={handleChange}
            placeholder="Ex: 17452"
            helper="Total do mês (ponta + fora ponta)"
          />
          <Field
            label="Energia reativa excedente (kVArh)"
            name="energiaReativaKvarh"
            value={form.energiaReativaKvarh ?? ''}
            onChange={handleChange}
            placeholder="Ex: 1225"
            helper="Total do mês (ponta + fora ponta)"
          />
          <Field
            label="Energia ativa — Ponta (kWh)"
            name="energiaAtivaPontaKwh"
            value={form.energiaAtivaPontaKwh ?? ''}
            onChange={handleChange}
            placeholder="Ex: 3169"
            helper="Consumo no horário de ponta"
          />
          <Field
            label="Energia ativa — Fora Ponta (kWh)"
            name="energiaAtivaForaPontaKwh"
            value={form.energiaAtivaForaPontaKwh ?? ''}
            onChange={handleChange}
            placeholder="Ex: 14283"
            helper="Consumo fora do horário de ponta"
          />
          <Field
            label="Reativa excedente — Ponta (kVArh)"
            name="energiaReativaPontaKvarh"
            value={form.energiaReativaPontaKvarh ?? ''}
            onChange={handleChange}
            placeholder="Ex: 64,21"
            helper="Da fatura, linha reativa ponta"
          />
          <Field
            label="Reativa excedente — Fora Ponta (kVArh)"
            name="energiaReativaForaPontaKvarh"
            value={form.energiaReativaForaPontaKvarh ?? ''}
            onChange={handleChange}
            placeholder="Ex: 1160,63"
            helper="Da fatura, linha reativa fora ponta"
          />
        </div>
      </div>

      {/* Dados de demanda */}
      <div style={styles.sectionBox}>
        <h3 style={styles.sectionTitle}>Dados de demanda (opcional)</h3>
        <div style={styles.grid}>
          <Field
            label="Demanda total (kW)"
            name="demandaKw"
            value={form.demandaKw ?? ''}
            onChange={handleChange}
            placeholder="Ex: 100"
            helper="Se disponível, melhora a análise"
          />
          <Field
            label="Demanda — Ponta (kW)"
            name="demandaPontaKw"
            value={form.demandaPontaKw ?? ''}
            onChange={handleChange}
            placeholder="Ex: 8"
            helper="Demanda medida no horário de ponta"
          />
          <Field
            label="Demanda — Fora Ponta (kW)"
            name="demandaForaPontaKw"
            value={form.demandaForaPontaKw ?? ''}
            onChange={handleChange}
            placeholder="Ex: 100"
            helper="Demanda medida fora de ponta"
          />
          <Field
            label="Demanda mínima (kW)"
            name="demandaMinKw"
            value={form.demandaMinKw ?? ''}
            onChange={handleChange}
            placeholder="Opcional"
            helper="Apoia análise de variação de carga"
          />
          <Field
            label="Demanda máxima (kW)"
            name="demandaMaxKw"
            value={form.demandaMaxKw ?? ''}
            onChange={handleChange}
            placeholder="Opcional"
            helper="Apoia análise de variação de carga"
          />
          <Field
            label="Variação de carga (%)"
            name="variacaoCargaPct"
            value={form.variacaoCargaPct ?? ''}
            onChange={handleChange}
            placeholder="Ex: 18"
            helper="Indica banco fixo ou automático"
          />
        </div>
      </div>

      {/* Observações */}
      <div style={styles.sectionBox}>
        <label style={styles.label} htmlFor="observacoes">
          Observações
        </label>
        <textarea
          id="observacoes"
          name="observacoes"
          value={form.observacoes}
          onChange={handleChange}
          rows={3}
          placeholder="Anotações adicionais sobre a instalação..."
          style={styles.textarea}
        />
      </div>

      {/* Ação */}
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
  label,
  name,
  value,
  onChange,
  placeholder,
  helper,
  required = false,
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
        {label}{' '}
        {required && <span style={styles.required}>*</span>}
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
  container: {
    display: 'grid',
    gap: 16,
    padding: 20,
    borderRadius: 16,
    background: '#FFFFFF',
    border: '1px solid #D5E8F3',
    boxShadow: '0 8px 24px rgba(27,58,107,0.08)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  kicker: {
    margin: 0,
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 1.2,
    color: '#F39C12',
    textTransform: 'uppercase',
  },
  title: {
    margin: '4px 0 0',
    fontSize: 24,
    fontWeight: 800,
    color: '#1B3A6B',
  },
  subtitle: {
    margin: '8px 0 0',
    color: '#475467',
    lineHeight: 1.5,
    maxWidth: 760,
  },
  defaultsBox: {
    padding: 14,
    borderRadius: 12,
    background: '#FFFAEB',
    border: '1px solid #FEDF89',
    color: '#B54708',
    fontSize: 14,
    lineHeight: 1.6,
  },
  defaultsList: {
    margin: '8px 0 0',
    paddingLeft: 18,
    display: 'grid',
    gap: 4,
  },
  sectionBox: {
    padding: 16,
    borderRadius: 12,
    background: '#F4F6F9',
    border: '1px solid #D5E8F3',
    display: 'grid',
    gap: 12,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 800,
    color: '#1B3A6B',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 14,
  },
  field: { display: 'grid', gap: 6 },
  label: { fontSize: 14, fontWeight: 700, color: '#1B3A6B' },
  required: { color: '#E67E22' },
  input: {
    width: '100%',
    borderRadius: 10,
    border: '1px solid #D5E8F3',
    background: '#FFFFFF',
    padding: '12px 14px',
    fontSize: 15,
    color: '#101828',
    outline: 'none',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    resize: 'vertical',
    borderRadius: 10,
    border: '1px solid #D5E8F3',
    background: '#FFFFFF',
    padding: '12px 14px',
    fontSize: 15,
    color: '#101828',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  helper: { fontSize: 12, color: '#475467', lineHeight: 1.4 },
  quickTensoes: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 6,
  },
  quickButton: {
    padding: '6px 14px',
    borderRadius: 8,
    border: '1px solid #D5E8F3',
    fontWeight: 800,
    cursor: 'pointer',
    fontSize: 13,
    transition: 'all 0.15s',
  },
  actionsRow: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  buttonPrimary: {
    padding: '14px 24px',
    borderRadius: 10,
    border: 'none',
    background: 'linear-gradient(135deg, #1B3A6B 0%, #2E86C1 100%)',
    color: '#FFFFFF',
    cursor: 'pointer',
    fontWeight: 800,
    fontSize: 16,
    boxShadow: '0 8px 18px rgba(27,58,107,0.18)',
  },
  buttonGhost: {
    padding: '12px 18px',
    borderRadius: 10,
    border: '1px solid #F39C12',
    background: '#FFFFFF',
    color: '#E67E22',
    cursor: 'pointer',
    fontWeight: 800,
    fontSize: 15,
  },
  infoBox: {
    padding: 14,
    borderRadius: 12,
    background: '#eef5ff',
    border: '1px solid #D5E8F3',
    color: '#1B3A6B',
    fontWeight: 600,
    fontSize: 13,
  },
  messageBox: {
    padding: 14,
    borderRadius: 12,
    background: '#ECFDF3',
    border: '1px solid #A6F4C5',
    color: '#027A48',
    fontWeight: 600,
  },
  errorBox: {
    padding: 14,
    borderRadius: 12,
    background: '#fef3f2',
    border: '1px solid #fecdca',
    color: '#b42318',
    fontWeight: 600,
  },
};