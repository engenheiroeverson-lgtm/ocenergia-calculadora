import React, { useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { extrairDadosFaturaDoTexto } from '../parsers/parserFatura';
import { completarDadosParciais } from '../normalizador/normalizadorParcial';
import { calcularBancoCapacitorIndustrial } from '../calculadora/calculadoraIndustrial';
import ResultadoTecnico from './ResultadoTecnico';
import CadastroLead from './CadastroLead';
import type { DadosLead } from './CadastroLead';
import type { ResultadoCalculadoraIndustrial } from '../../types/types';

GlobalWorkerOptions.workerSrc = pdfWorker;

const TENSOES_BT = ['127', '220', '380', '440'];
const TENSOES_MT = ['2300', '6900', '11000', '13200', '13800', '22000', '23000', '34500'];
const TENSOES_AT = ['69000', '138000', '230000'];

async function extrairTextoPDF(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data: bytes }).promise;
  let texto = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    texto +=
      content.items
        .map((item: any) => (typeof item.str === 'string' ? item.str : ''))
        .join(' ') + '\n';
  }
  return texto;
}

type CamposComplemento = {
  potenciaAtivaKw: string;
  tensaoV: string;
  fpAtual: string;
  fpAlvo: string;
  energiaAtivaKwh: string;
  energiaReativaKvarh: string;
  demandaKw: string;
  energiaAtivaPontaKwh: string;
  energiaAtivaForaPontaKwh: string;
  energiaReativaPontaKvarh: string;
  energiaReativaForaPontaKvarh: string;
  demandaPontaKw: string;
  demandaForaPontaKw: string;
};

const complementoVazio: CamposComplemento = {
  potenciaAtivaKw: '',
  tensaoV: '',
  fpAtual: '',
  fpAlvo: '',
  energiaAtivaKwh: '',
  energiaReativaKvarh: '',
  demandaKw: '',
  energiaAtivaPontaKwh: '',
  energiaAtivaForaPontaKwh: '',
  energiaReativaPontaKvarh: '',
  energiaReativaForaPontaKvarh: '',
  demandaPontaKw: '',
  demandaForaPontaKw: '',
};

export default function UploadFatura() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [lendo, setLendo] = useState(false);
  const [dadosExtraidos, setDadosExtraidos] = useState<Record<string, string>>({});
  const [complemento, setComplemento] = useState<CamposComplemento>(complementoVazio);
  const [resultado, setResultado] = useState<ResultadoCalculadoraIndustrial | null>(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [camposFaltantes, setCamposFaltantes] = useState<string[]>([]);
  const [dadosLead, setDadosLead] = useState<DadosLead | null>(null);

  function limpar() {
    setNomeArquivo('');
    setLendo(false);
    setDadosExtraidos({});
    setComplemento(complementoVazio);
    setResultado(null);
    setErro('');
    setAviso('');
    setCamposFaltantes([]);
    setDadosLead(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  async function processarArquivo(file: File) {
    setErro('');
    setAviso('');
    setResultado(null);
    setDadosExtraidos({});
    setCamposFaltantes([]);
    setLendo(true);
    setNomeArquivo(file.name);
    try {
      let texto = '';
      const nome = file.name.toLowerCase();
      const ehPdf = file.type === 'application/pdf' || nome.endsWith('.pdf');
      if (ehPdf) {
        texto = await extrairTextoPDF(file);
      } else {
        texto = await file.text();
      }
      if (!texto.trim()) {
        setErro('Não foi possível ler o arquivo. Verifique se o PDF contém texto pesquisável.');
        setLendo(false);
        return;
      }
      const extracao = extrairDadosFaturaDoTexto(texto);
      setCamposFaltantes(extracao.camposFaltantes);

      const parcial = extracao.dadosParciais;
      const extraidos: Record<string, string> = {};
      if (parcial.tensaoV) extraidos.tensaoV = String(parcial.tensaoV);
      if (parcial.potenciaAtivaKw)
        extraidos.potenciaAtivaKw = String(parcial.potenciaAtivaKw.toFixed(2));
      if (parcial.energiaAtivaKwh)
        extraidos.energiaAtivaKwh = String(parcial.energiaAtivaKwh.toFixed(2));
      if (parcial.energiaReativaKvarh)
        extraidos.energiaReativaKvarh = String(parcial.energiaReativaKvarh.toFixed(2));
      if (parcial.energiaAtivaPontaKwh)
        extraidos.energiaAtivaPontaKwh = String(parcial.energiaAtivaPontaKwh.toFixed(2));
      if (parcial.energiaAtivaForaPontaKwh)
        extraidos.energiaAtivaForaPontaKwh = String(parcial.energiaAtivaForaPontaKwh.toFixed(2));
      if (parcial.energiaReativaPontaKvarh)
        extraidos.energiaReativaPontaKvarh = String(parcial.energiaReativaPontaKvarh.toFixed(2));
      if (parcial.energiaReativaForaPontaKvarh)
        extraidos.energiaReativaForaPontaKvarh = String(parcial.energiaReativaForaPontaKvarh.toFixed(2));
      if (parcial.demandaKw)
        extraidos.demandaKw = String(parcial.demandaKw.toFixed(2));
      if (parcial.demandaPontaKw)
        extraidos.demandaPontaKw = String(parcial.demandaPontaKw.toFixed(2));
      if (parcial.demandaForaPontaKw)
        extraidos.demandaForaPontaKw = String(parcial.demandaForaPontaKw.toFixed(2));
      setDadosExtraidos(extraidos);

      setComplemento({
        potenciaAtivaKw: extraidos.potenciaAtivaKw ?? '',
        tensaoV: extraidos.tensaoV ?? '',
        fpAtual: '',
        fpAlvo: '',
        energiaAtivaKwh: extraidos.energiaAtivaKwh ?? '',
        energiaReativaKvarh: extraidos.energiaReativaKvarh ?? '',
        demandaKw: extraidos.demandaKw ?? '',
        energiaAtivaPontaKwh: extraidos.energiaAtivaPontaKwh ?? '',
        energiaAtivaForaPontaKwh: extraidos.energiaAtivaForaPontaKwh ?? '',
        energiaReativaPontaKvarh: extraidos.energiaReativaPontaKvarh ?? '',
        energiaReativaForaPontaKvarh: extraidos.energiaReativaForaPontaKvarh ?? '',
        demandaPontaKw: extraidos.demandaPontaKw ?? '',
        demandaForaPontaKw: extraidos.demandaForaPontaKw ?? '',
      });

      if (extracao.camposFaltantes.length > 0) {
        setAviso('Fatura lida. Complete os campos faltantes abaixo para calcular.');
      } else {
        setAviso('Fatura lida com sucesso. Confira os dados e calcule.');
      }
    } catch {
      setErro('Erro ao processar o arquivo. Tente novamente ou preencha manualmente.');
    } finally {
      setLendo(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setComplemento((prev) => ({ ...prev, [name]: value }));
  }

  function calcular() {
    setErro('');
    setResultado(null);
    try {
      const comp = {
        potenciaAtivaKw: complemento.potenciaAtivaKw
          ? Number(complemento.potenciaAtivaKw.replace(',', '.'))
          : undefined,
        tensaoV: complemento.tensaoV ? Number(complemento.tensaoV) : undefined,
        fpAtual: complemento.fpAtual
          ? Number(complemento.fpAtual.replace(',', '.'))
          : undefined,
        fpAlvo: complemento.fpAlvo
          ? Number(complemento.fpAlvo.replace(',', '.'))
          : undefined,
        energiaAtivaKwh: complemento.energiaAtivaKwh
          ? Number(complemento.energiaAtivaKwh.replace(',', '.'))
          : undefined,
        energiaReativaKvarh: complemento.energiaReativaKvarh
          ? Number(complemento.energiaReativaKvarh.replace(',', '.'))
          : undefined,
        demandaKw: complemento.demandaKw
          ? Number(complemento.demandaKw.replace(',', '.'))
          : undefined,
        energiaAtivaPontaKwh: complemento.energiaAtivaPontaKwh
          ? Number(complemento.energiaAtivaPontaKwh.replace(',', '.'))
          : undefined,
        energiaAtivaForaPontaKwh: complemento.energiaAtivaForaPontaKwh
          ? Number(complemento.energiaAtivaForaPontaKwh.replace(',', '.'))
          : undefined,
        energiaReativaPontaKvarh: complemento.energiaReativaPontaKvarh
          ? Number(complemento.energiaReativaPontaKvarh.replace(',', '.'))
          : undefined,
        energiaReativaForaPontaKvarh: complemento.energiaReativaForaPontaKvarh
          ? Number(complemento.energiaReativaForaPontaKvarh.replace(',', '.'))
          : undefined,
        demandaPontaKw: complemento.demandaPontaKw
          ? Number(complemento.demandaPontaKw.replace(',', '.'))
          : undefined,
        demandaForaPontaKw: complemento.demandaForaPontaKw
          ? Number(complemento.demandaForaPontaKw.replace(',', '.'))
          : undefined,
      };

      const dadosNorm = completarDadosParciais(
        {
          status: 'parcial',
          origemDados: 'fatura',
          mensagem: '',
          camposFaltantes: [],
          dadosParciais: {
            tensaoV: comp.tensaoV,
            potenciaAtivaKw: comp.potenciaAtivaKw,
            energiaAtivaKwh: comp.energiaAtivaKwh,
            energiaReativaKvarh: comp.energiaReativaKvarh,
            energiaAtivaPontaKwh: comp.energiaAtivaPontaKwh,
            energiaAtivaForaPontaKwh: comp.energiaAtivaForaPontaKwh,
            energiaReativaPontaKvarh: comp.energiaReativaPontaKvarh,
            energiaReativaForaPontaKvarh: comp.energiaReativaForaPontaKvarh,
            demandaKw: comp.demandaKw,
            demandaPontaKw: comp.demandaPontaKw,
            demandaForaPontaKw: comp.demandaForaPontaKw,
            origemDados: 'fatura',
          },
        },
        {
          fpAtual: comp.fpAtual,
          fpAlvo: comp.fpAlvo,
        },
      );

      const calc = calcularBancoCapacitorIndustrial(dadosNorm);
      setResultado(calc);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao calcular.';
      setErro(msg);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <p style={styles.kicker}>Fatura de energia</p>
          <h2 style={styles.title}>Leitura técnica da conta</h2>
          <p style={styles.subtitle}>
            Envie o PDF da conta de energia. O sistema extrai os dados
            automaticamente e calcula o banco ideal.
          </p>
        </div>
        <button type="button" onClick={limpar} style={styles.buttonGhost}>
          Limpar
        </button>
      </div>

      <div style={styles.sectionBox}>
        <h3 style={styles.sectionTitle}>Enviar arquivo</h3>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt,.csv,application/pdf,text/plain,text/csv"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) processarArquivo(file);
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          style={styles.buttonUpload}
          disabled={lendo}
        >
          {lendo ? 'Lendo arquivo...' : 'Escolher arquivo (PDF, TXT, CSV)'}
        </button>
        {nomeArquivo && (
          <p style={styles.nomeArquivo}>
            Arquivo: <strong>{nomeArquivo}</strong>
          </p>
        )}
        {aviso && <div style={styles.avisoBox}>{aviso}</div>}
        {erro && <div style={styles.errorBox}>{erro}</div>}
        {camposFaltantes.length > 0 && (
          <div style={styles.faltantesBox}>
            <strong>Campos não encontrados na fatura:</strong>{' '}
            {camposFaltantes.join(', ')}. Complete abaixo.
          </div>
        )}
      </div>

      {Object.keys(dadosExtraidos).length > 0 && (
        <div style={styles.sectionBox}>
          <h3 style={styles.sectionTitle}>Dados extraídos da fatura</h3>
          <div style={styles.extraidosGrid}>
            {Object.entries(dadosExtraidos).map(([chave, valor]) => (
              <div key={chave} style={styles.extraidoItem}>
                <span style={styles.extraidoLabel}>{chave}</span>
                <strong style={styles.extraidoValor}>{valor}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={styles.sectionBox}>
        <h3 style={styles.sectionTitle}>Complementação manual</h3>
        <p style={styles.sectionDesc}>
          Confira os dados extraídos e ajuste se necessário. FP atual padrão:{' '}
          <strong>0,80</strong> — FP alvo padrão: <strong>0,92</strong>
        </p>
        <div style={styles.grid}>
          <Field
            label="Potência ativa (kW)"
            name="potenciaAtivaKw"
            value={complemento.potenciaAtivaKw}
            onChange={handleChange}
            placeholder="Ex: 100"
            helper="Demanda ou potência ativa da instalação"
          />
          <Field
            label="FP atual"
            name="fpAtual"
            value={complemento.fpAtual}
            onChange={handleChange}
            placeholder="Padrão: 0,80"
            helper="Se vazio, usa 0,80"
          />
          <div style={styles.field}>
            <label style={styles.label}>Tensão (V)</label>
            <select
              name="tensaoV"
              value={complemento.tensaoV}
              onChange={handleChange}
              style={styles.input}
            >
              <option value="">Selecione ou deixe o extraído</option>
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
            <div style={styles.quickTensoes}>
              {['220', '380', '440', '13800'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setComplemento((prev) => ({ ...prev, tensaoV: t }))}
                  style={styles.quickButton}
                >
                  {Number(t) >= 1000 ? `${Number(t) / 1000} kV` : `${t} V`}
                </button>
              ))}
            </div>
          </div>
          <Field
            label="FP alvo"
            name="fpAlvo"
            value={complemento.fpAlvo}
            onChange={handleChange}
            placeholder="Padrão: 0,92"
            helper="Se vazio, usa 0,92"
          />
          <Field
            label="Energia ativa total (kWh)"
            name="energiaAtivaKwh"
            value={complemento.energiaAtivaKwh}
            onChange={handleChange}
            placeholder="Ex: 17452"
            helper="Total do mês"
          />
          <Field
            label="Energia reativa excedente (kVArh)"
            name="energiaReativaKvarh"
            value={complemento.energiaReativaKvarh}
            onChange={handleChange}
            placeholder="Ex: 1225"
            helper="Total do mês"
          />
          <Field
            label="Energia ativa ponta (kWh)"
            name="energiaAtivaPontaKwh"
            value={complemento.energiaAtivaPontaKwh}
            onChange={handleChange}
            placeholder="Ex: 3169"
            helper="Horário de ponta"
          />
          <Field
            label="Energia ativa fora ponta (kWh)"
            name="energiaAtivaForaPontaKwh"
            value={complemento.energiaAtivaForaPontaKwh}
            onChange={handleChange}
            placeholder="Ex: 14283"
            helper="Fora de ponta"
          />
          <Field
            label="Reativa excedente ponta (kVArh)"
            name="energiaReativaPontaKvarh"
            value={complemento.energiaReativaPontaKvarh}
            onChange={handleChange}
            placeholder="Ex: 64,21"
            helper="Da fatura"
          />
          <Field
            label="Reativa excedente fora ponta (kVArh)"
            name="energiaReativaForaPontaKvarh"
            value={complemento.energiaReativaForaPontaKvarh}
            onChange={handleChange}
            placeholder="Ex: 1160,63"
            helper="Da fatura"
          />
          <Field
            label="Demanda (kW)"
            name="demandaKw"
            value={complemento.demandaKw}
            onChange={handleChange}
            placeholder="Ex: 100"
            helper="Demanda total"
          />
          <Field
            label="Demanda ponta (kW)"
            name="demandaPontaKw"
            value={complemento.demandaPontaKw}
            onChange={handleChange}
            placeholder="Ex: 8"
            helper="Horário de ponta"
          />
          <Field
            label="Demanda fora ponta (kW)"
            name="demandaForaPontaKw"
            value={complemento.demandaForaPontaKw}
            onChange={handleChange}
            placeholder="Ex: 100"
            helper="Fora de ponta"
          />
        </div>
      </div>

      <div style={styles.actionsRow}>
        <button type="button" onClick={calcular} style={styles.buttonPrimary}>
          Calcular banco ideal
        </button>
      </div>

      {/* RENDERIZAÇÃO CONJUNTA COM CADASTRO DE LEAD COMPATÍVEL COM PROPS */}
      {resultado && (
        <>
          <CadastroLead onSalvar={setDadosLead} dadosSalvos={dadosLead} />
          <ResultadoTecnico resultado={resultado} />
        </>
      )}
    </div>
  );
}

function Field({
  label, name, value, onChange, placeholder, helper,
}: {
  label: string;
  name: string;
  value: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  helper?: string;
}) {
  return (
    <div style={styles.field}>
      <label style={styles.label}>{label}</label>
      <input
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
  container: { display: 'grid', gap: 16, padding: 20, borderRadius: 16, background: '#FFFFFF', border: '1px solid #D5E8F3', boxShadow: '0 8px 24px rgba(27,58,107,0.08)' },
  header: { display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' },
  kicker: { margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: 1.2, color: '#F39C12', textTransform: 'uppercase' },
  title: { margin: '4px 0 0', fontSize: 24, fontWeight: 800, color: '#1B3A6B' },
  subtitle: { margin: '8px 0 0', color: '#475467', lineHeight: 1.5 },
  sectionBox: { padding: 16, borderRadius: 12, background: '#F4F6F9', border: '1px solid #D5E8F3', display: 'grid', gap: 12 },
  sectionTitle: { margin: 0, fontSize: 16, fontWeight: 800, color: '#1B3A6B' },
  sectionDesc: { margin: 0, fontSize: 13, color: '#475467', lineHeight: 1.5 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 },
  field: { display: 'grid', gap: 6 },
  label: { fontSize: 14, fontWeight: 700, color: '#1B3A6B' },
  input: { width: '100%', borderRadius: 10, border: '1px solid #D5E8F3', background: '#FFFFFF', padding: '12px 14px', fontSize: 15, color: '#101828', outline: 'none', boxSizing: 'border-box' },
  helper: { fontSize: 12, color: '#475467' },
  quickTensoes: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 },
  quickButton: { padding: '6px 12px', borderRadius: 8, border: '1px solid #D5E8F3', background: '#FFFFFF', color: '#1B3A6B', fontWeight: 800, cursor: 'pointer', fontSize: 13 },
  buttonUpload: { padding: '14px 20px', borderRadius: 10, border: '2px dashed #2E86C1', background: '#F4F6F9', color: '#1B3A6B', cursor: 'pointer', fontWeight: 800, fontSize: 15, textAlign: 'center', width: '100%' },
  buttonPrimary: { padding: '14px 24px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #1B3A6B 0%, #2E86C1 100%)', color: '#FFFFFF', cursor: 'pointer', fontWeight: 800, fontSize: 16 },
  buttonGhost: { padding: '12px 18px', borderRadius: 10, border: '1px solid #F39C12', background: '#FFFFFF', color: '#F39C12', fontWeight: 800, cursor: 'pointer', fontSize: 14 },
  nomeArquivo: { margin: 0, fontSize: 14, color: '#1B3A6B' },
  avisoBox: { padding: 12, borderRadius: 8, background: '#E8F8F5', color: '#117A65', fontSize: 14, fontWeight: 700 },
  errorBox: { padding: 12, borderRadius: 8, background: '#FDEDEC', color: '#C0392B', fontSize: 14, fontWeight: 700 },
  faltantesBox: { padding: 12, borderRadius: 8, background: '#FEF9E7', color: '#B7950B', fontSize: 14 },
  extraidosGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 },
  extraidoItem: { padding: 10, borderRadius: 8, background: '#FFFFFF', border: '1px solid #D5E8F3', display: 'grid', gap: 4 },
  extraidoLabel: { fontSize: 11, color: '#475467', textTransform: 'uppercase', fontWeight: 700 },
  extraidoValor: { fontSize: 14, color: '#1B3A6B' },
  actionsRow: { display: 'flex', justifyContent: 'flex-end', marginTop: 10 },
};