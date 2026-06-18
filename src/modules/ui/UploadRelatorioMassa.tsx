import React, { useMemo, useState } from 'react';
import { extrairDadosRelatorioMassaDoTexto } from '../parsers/parserRelatorioMassa';
import { completarDadosParciais } from '../normalizador/normalizadorParcial';
import { calcularBancoCapacitorIndustrial } from '../calculadora/calculadoraIndustrial';
import ResultadoTecnico from './ResultadoTecnico';
import CadastroLead from './CadastroLead'; // Formulário comercial de leads unificado
import type {
  ResultadoCalculadoraIndustrial,
  ResultadoExtracaoParcial,
} from '../../types/types';

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

export default function UploadRelatorioMassa() {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [texto, setTexto] = useState<string>('');
  const [extraido, setExtraido] = useState<ResultadoExtracaoParcial | null>(null);
  const [complemento, setComplemento] = useState<FormComplemento>(complementoInicial);
  const [resultado, setResultado] = useState<ResultadoCalculadoraIndustrial | null>(null);
  const [mensagem, setMensagem] = useState<string>('');
  const [erro, setErro] = useState<string>('');

  const registrosOrdenados = useMemo(() => {
    const parcial = extraido?.dadosParciais as any;
    if (!parcial?.registros?.length) return [];
    return [...parcial.registros].sort(
      (a: any, b: any) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.camposFaltantes.length - b.camposFaltantes.length;
      },
    );
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
    if (
      nome.endsWith('.txt') ||
      nome.endsWith('.csv') ||
      file.type === 'text/plain'
    ) {
      file
        .text()
        .then((content) => {
          setTexto(content);
          interpretarTexto(content);
        })
        .catch(() => setErro('Não foi possível ler o arquivo.'));
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
      if (!texto.trim())
        throw new Error('Cole o texto do relatório antes de interpretar.');
      interpretarTexto(texto);
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : 'Erro ao interpretar o relatório.';
      setErro(msg);
    }
  }

  function calcularResultado() {
    try {
      setErro('');
      setResultado(null);
      if (!extraido)
        throw new Error('Faça a interpretação do relatório antes de calcular.');

      const base =
        (melhorRegistro?.dadosParciais as ResultadoExtracaoParcial['dadosParciais']) ??
        extraido.dadosParciais;

      const dados = completarDadosParciais(
        { ...extraido, dadosParciais: base },
        {
          potenciaAtivaKw: complemento.potenciaAtivaKw
            ? Number(complemento.potenciaAtivaKw)
            : undefined,
          fpAtual: complemento.fpAtual ? Number(complemento.fpAtual) : undefined,
          tensaoV: complemento.tensaoV ? Number(complemento.tensaoV) : undefined,
          demandaKw: complemento.demandaKw
            ? Number(complemento.demandaKw)
            : undefined,
          variacaoCargaPct: complemento.variacaoCargaPct
            ? Number(complemento.variacaoCargaPct)
            : undefined,
          energiaAtivaKwh: complemento.energiaAtivaKwh
            ? Number(complemento.energiaAtivaKwh)
            : undefined,
          energiaReativaKvarh: complemento.energiaReativaKvarh
            ? Number(complemento.energiaReativaKvarh)
            : undefined,
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
            Envie ou cole um TXT/CSV com múltiplas linhas para identificar o
            melhor registro e calcular.
          </p>
        </div>
        <button type="button" onClick={limparTudo} style={styles.buttonGhost}>
          Limpar
        </button>
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>1. Enviar arquivo</h3>
        <input type="file" accept=".txt,.csv" onChange={handleFileChange} />
        <p style={styles.helpText}>
          O parser identifica vários registros e seleciona o melhor para o cálculo.
        </p>
        {arquivo && (
          <p style={styles.infoText}>Arquivo selecionado: {arquivo.name}</p>
        )}
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>2. Texto bruto do relatório</h3>
        <textarea
          rows={10}
          value={texto}
          onChange={handleTextoChange}
          placeholder="Cole aqui o conteúdo do relatório de massa..."
          style={styles.textarea}
        />
        <div style={styles.actionsRow}>
          <button
            type="button"
            onClick={processarTexto}
            style={styles.buttonSecondary}
          >
            Interpretar relatório
          </button>
        </div>
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>
          3. Complementação manual do melhor registro
        </h3>
        <div style={styles.grid}>
          <Field
            label="Potência ativa (kW)"
            name="potenciaAtivaKw"
            value={complemento.potenciaAtivaKw}