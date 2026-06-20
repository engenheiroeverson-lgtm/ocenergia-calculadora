import React, { useMemo, useState } from 'react';
import { normalizarEntradaManual } from '../normalizador/normalizador';
import { calcularBancoCapacitorIndustrial } from '../calculadora/calculadoraIndustrial';
import ResultadoTecnico from './ResultadoTecnico';
import type { ResultadoCalculadoraIndustrial } from '../../types/types';

// O cadastro de lead agora vive APENAS dentro do ResultadoTecnico (ponto único de
// captura, compartilhado por todas as abas). Por isso este formulário não renderiza
// mais o CadastroLead nem dispara enviarLead — evita lead duplicado.

type FormState = {
  potenciaAtivaKw: string;
  fpAtual: string;
  tensaoV: string;
  fpAlvo: string;
  energiaAtivaKwh: string;
  energiaReativaKvarh: string;
  demandaKw: string;
  demandaMinKw: string;
  demandaMaxKw: string;
  variacaoCargaPct: string;
  observacoes: string;
  energiaAtivaPontaKwh: string;
  energiaAtivaForaPontaKwh: string;
  energiaReativaPontaKvarh: string;
  energiaReativaForaPontaKvarh: string;
  demandaPontaKw: string;
  demandaForaPontaKw: string;
  temInversores: boolean; // cargas não-lineares (diagnóstico de harmônicos)
};

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
  temInversores: false,
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
        chave !== 'observacoes' &&
        chave !== 'temInversores' &&
        String(valor ?? '').trim() !== '',
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

      // Injeta o flag de cargas não-lineares para o diagnóstico de harmônicos.
      const dadosComHarmonicos = {
        ...dadosNormalizados,
        temInversores: form.temInversores,
      };

      const calculo = calcularBancoCapacitorIndustrial(dadosComHarmonicos, {
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

      {/* Cargas não-lineares (diagnóstico de harmônicos) */}
      <div style={styles.sectionBox}>
        <div style={styles.toggleRow}>
          <div style={{ maxWidth: 720 }}>
            <h3 style={styles.sectionTitle}>Inversores de frequência na planta?</h3>
            <span style={styles.helper}>
              Cargas não-lineares (ex.: linha WEG CFW) exigem reatores de
              dessintonia para proteger os capacitores contra ressonância
              harmônica. Marque "Sim" para receber o alerta técnico no resultado.
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={form.temInversores}
            onClick={() =>
              setForm((prev) => ({ ...prev, temInversores: !prev.temInversores }))
            }
            style={{
              ...styles.toggleSwitch,
              background: form.temInversores ? '#F39C12' : '#D5E8F3',
            }}
          >
            <span
              style={{
                ...styles.toggleKnob,
                transform: form.temInversores
                  ? 'translateX(24px)'
                  : 'translateX(2px)',
              }}
            />
          </button>
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

      {/* Resultado (o CadastroLead está DENTRO do ResultadoTecnico) */}
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
  toggleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
  },
  toggleSwitch: {
    position: 'relative',
    width: 50,
    height: 28,
    borderRadius: 999,
    border: 'none',
    cursor: 'pointer',
    transition: 'background 0.15s',
    flexShrink: 0,
  },
  toggleKnob: {
    position: 'absolute',
    top: 2,
    left: 0,
    width: 24,
    height: 24,
    borderRadius: '50%',
    background: '#FFFFFF',
    transition: 'transform 0.15s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
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
