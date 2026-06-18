import React, { useState } from 'react';

export type DadosLead = {
  nome: string;
  email: string;
  whatsapp: string;
  cidade: string;
  estado: string;
  empresa: string;
  lgpd: boolean;
};

type Props = {
  onSalvar: (dados: DadosLead) => void;
  dadosSalvos: DadosLead | null;
};

const estadoInicial: DadosLead = {
  nome: '',
  email: '',
  whatsapp: '',
  cidade: '',
  estado: '',
  empresa: '',
  lgpd: false,
};

const ESTADOS_BR = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

export default function CadastroLead({ onSalvar, dadosSalvos }: Props) {
  const [form, setForm] = useState<DadosLead>(dadosSalvos ?? estadoInicial);
  const [salvo, setSalvo] = useState<boolean>(!!dadosSalvos);
  const [erro, setErro] = useState<string>('');

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    const target = e.target;

    if (target instanceof HTMLInputElement && target.type === 'checkbox') {
      setForm((prev) => ({
        ...prev,
        [target.name]: target.checked,
      }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      [target.name]: target.value,
    }));
  }

  function formatarWhatsApp(valor: string): string {
    const numeros = valor.replace(/\D/g, '');

    if (numeros.length <= 2) return numeros;
    if (numeros.length <= 6) {
      return `(${numeros.slice(0, 2)}) ${numeros.slice(2)}`;
    }
    if (numeros.length <= 10) {
      return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 6)}-${numeros.slice(6)}`;
    }
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7, 11)}`;
  }

  function handleWhatsApp(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({
      ...prev,
      whatsapp: formatarWhatsApp(e.target.value),
    }));
  }

  function validar(): boolean {
    if (!form.nome.trim()) {
      setErro('Informe seu nome para continuar.');
      return false;
    }

    const email = form.email.trim();
    const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (!email || !emailValido) {
      setErro('Informe um e-mail válido.');
      return false;
    }

    const whatsappNumeros = form.whatsapp.replace(/\D/g, '');
    if (whatsappNumeros.length < 10) {
      setErro('Informe um WhatsApp válido com DDD.');
      return false;
    }

    if (!form.lgpd) {
      setErro('É necessário autorizar o uso dos dados para continuar.');
      return false;
    }

    return true;
  }

  function salvar() {
    setErro('');

    if (!validar()) return;

    try {
      localStorage.setItem('ocenergia_lead', JSON.stringify(form));
    } catch {
      // ignora erro de storage
    }

    setSalvo(true);
    onSalvar(form);
  }

  function editar() {
    setSalvo(false);
  }

  if (salvo && dadosSalvos) {
    return (
      <div style={styles.container}>
        <div style={styles.salvoBox}>
          <div style={styles.salvoIcone}>✓</div>
          <div style={styles.salvoTexto}>
            <strong style={styles.salvoNome}>Olá, {dadosSalvos.nome}!</strong>
            <span style={styles.salvoEmail}>{dadosSalvos.email}</span>
            {dadosSalvos.whatsapp && (
              <span style={styles.salvoEmail}>{dadosSalvos.whatsapp}</span>
            )}
          </div>
          <button type="button" onClick={editar} style={styles.buttonEditar}>
            Editar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.kicker}>Seus dados</span>
        <h3 style={styles.title}>
          Receba o orçamento e suporte técnico personalizado
        </h3>
        <p style={styles.subtitle}>
          Preencha abaixo para que nossa equipe possa entrar em contato com você
          sobre este cálculo. Cidade e estado são opcionais.
        </p>
      </div>

      <div style={styles.grid}>
        <Field
          label="Nome completo"
          name="nome"
          value={form.nome}
          onChange={handleChange}
          placeholder="Seu nome"
          required
        />

        <Field
          label="E-mail"
          name="email"
          value={form.email}
          onChange={handleChange}
          placeholder="seu@email.com.br"
          type="email"
          required
        />

        <div style={styles.field}>
          <label style={styles.label}>
            WhatsApp <span style={styles.required}>*</span>
          </label>
          <input
            type="tel"
            name="whatsapp"
            value={form.whatsapp}
            onChange={handleWhatsApp}
            placeholder="(65) 99999-9999"
            style={styles.input}
            maxLength={15}
          />
          <span style={styles.helper}>Com DDD</span>
        </div>

        <Field
          label="Empresa"
          name="empresa"
          value={form.empresa}
          onChange={handleChange}
          placeholder="Nome da empresa (opcional)"
        />

        <Field
          label="Cidade"
          name="cidade"
          value={form.cidade}
          onChange={handleChange}
          placeholder="Opcional"
        />

        <div style={styles.field}>
          <label style={styles.label}>Estado</label>
          <select
            name="estado"
            value={form.estado}
            onChange={handleChange}
            style={styles.input}
          >
            <option value="">Selecione (opcional)</option>
            {ESTADOS_BR.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label style={styles.lgpdLabel}>
        <input
          type="checkbox"
          name="lgpd"
          checked={form.lgpd}
          onChange={handleChange}
          style={styles.checkbox}
        />
        <span style={styles.lgpdTexto}>
          Autorizo o uso dos meus dados para contato comercial e envio de
          orçamento pela equipe OCENERGIA SOLAR, conforme a LGPD (Lei
          13.709/2018).
        </span>
      </label>

      {erro && <div style={styles.errorBox}>{erro}</div>}

      <button type="button" onClick={salvar} style={styles.buttonPrimary}>
        Salvar e receber orçamento
      </button>
    </div>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = 'text',
  required = false,
}: {
  label: string;
  name: string;
  value: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div style={styles.field}>
      <label style={styles.label}>
        {label} {required && <span style={styles.required}>*</span>}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={styles.input}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: 16,
    borderRadius: 12,
    background: '#FFFFFF',
    border: '1px solid #D5E8F3',
    display: 'grid',
    gap: 14,
  },
  header: { display: 'grid', gap: 6 },
  kicker: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 1.4,
    color: '#F39C12',
    textTransform: 'uppercase',
  },
  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 800,
    color: '#1B3A6B',
  },
  subtitle: {
    margin: 0,
    fontSize: 13,
    color: '#475467',
    lineHeight: 1.5,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 12,
  },
  field: { display: 'grid', gap: 6 },
  label: { fontSize: 14, fontWeight: 700, color: '#1B3A6B' },
  required: { color: '#E67E22' },
  input: {
    width: '100%',
    borderRadius: 10,
    border: '1px solid #D5E8F3',
    background: '#F4F6F9',
    padding: '12px 14px',
    fontSize: 15,
    color: '#101828',
    outline: 'none',
    boxSizing: 'border-box',
  },
  helper: { fontSize: 12, color: '#475467' },
  lgpdLabel: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    cursor: 'pointer',
  },
  checkbox: {
    marginTop: 2,
    width: 18,
    height: 18,
    cursor: 'pointer',
    flexShrink: 0,
  },
  lgpdTexto: {
    fontSize: 13,
    color: '#475467',
    lineHeight: 1.5,
  },
  buttonPrimary: {
    padding: '14px 24px',
    borderRadius: 10,
    border: 'none',
    background: 'linear-gradient(135deg, #F39C12 0%, #E67E22 100%)',
    color: '#FFFFFF',
    cursor: 'pointer',
    fontWeight: 800,
    fontSize: 16,
    boxShadow: '0 8px 18px rgba(243,156,18,0.25)',
  },
  buttonEditar: {
    padding: '8px 16px',
    borderRadius: 8,
    border: '1px solid #D5E8F3',
    background: '#F4F6F9',
    color: '#1B3A6B',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 13,
    whiteSpace: 'nowrap',
  },
  salvoBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 10,
    background: '#ECFDF3',
    border: '1px solid #A6F4C5',
    flexWrap: 'wrap',
  },
  salvoIcone: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: '#027A48',
    color: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: 18,
    flexShrink: 0,
  },
  salvoTexto: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    flex: 1,
  },
  salvoNome: {
    fontSize: 15,
    fontWeight: 800,
    color: '#027A48',
  },
  salvoEmail: {
    fontSize: 13,
    color: '#475467',
  },
  errorBox: {
    padding: 12,
    borderRadius: 10,
    background: '#FEF3F2',
    border: '1px solid #FECDCA',
    color: '#B42318',
    fontWeight: 600,
    fontSize: 14,
  },
};