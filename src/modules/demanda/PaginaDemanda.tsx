// src/modules/demanda/PaginaDemanda.tsx
// MÓDULO II — Gestão de Demanda (Grupo A) + BESS WEG. Vite/React 19, estilos inline.
// Nível 3 de navegação: sub-abas "Análise Detalhada (12 meses)" vs "Simulador Expresso (1 fatura)".
// A análise detalhada usa o motorDemanda (12 meses); o expresso usa o SimuladorRapidoBess (1 fatura).

import React, { useEffect, useMemo, useState } from 'react';
import {
  simularModuloII,
  type MesDemanda,
  type Modalidade,
  type Tarifas,
  type ResultadoModuloII,
} from '../../utils/motorDemanda';
import { buscarTarifasAneel } from '../../lib/buscarTarifaAneel';
import { enviarLead, type ResumoBessLead } from '../../lib/enviarLead';
import SimuladorRapidoBess from './SimuladorRapidoBess';

const MOCK_MESES: MesDemanda[] = [
  { referencia: '01/2025', consumoPontaKwh: 8200, consumoForaPontaKwh: 58000, demandaMedidaPontaKw: 158, demandaMedidaForaPontaKw: 212, demandaContratadaPontaKw: 160, demandaContratadaForaPontaKw: 200 },
  { referencia: '02/2025', consumoPontaKwh: 7600, consumoForaPontaKwh: 54000, demandaMedidaPontaKw: 150, demandaMedidaForaPontaKw: 205, demandaContratadaPontaKw: 160, demandaContratadaForaPontaKw: 200 },
  { referencia: '03/2025', consumoPontaKwh: 8800, consumoForaPontaKwh: 60000, demandaMedidaPontaKw: 165, demandaMedidaForaPontaKw: 228, demandaContratadaPontaKw: 160, demandaContratadaForaPontaKw: 200 },
  { referencia: '04/2025', consumoPontaKwh: 8100, consumoForaPontaKwh: 57000, demandaMedidaPontaKw: 159, demandaMedidaForaPontaKw: 215, demandaContratadaPontaKw: 160, demandaContratadaForaPontaKw: 200 },
  { referencia: '05/2025', consumoPontaKwh: 7400, consumoForaPontaKwh: 52000, demandaMedidaPontaKw: 148, demandaMedidaForaPontaKw: 203, demandaContratadaPontaKw: 160, demandaContratadaForaPontaKw: 200 },
  { referencia: '06/2025', consumoPontaKwh: 8000, consumoForaPontaKwh: 56000, demandaMedidaPontaKw: 156, demandaMedidaForaPontaKw: 209, demandaContratadaPontaKw: 160, demandaContratadaForaPontaKw: 200 },
  { referencia: '07/2025', consumoPontaKwh: 9100, consumoForaPontaKwh: 62000, demandaMedidaPontaKw: 171, demandaMedidaForaPontaKw: 241, demandaContratadaPontaKw: 160, demandaContratadaForaPontaKw: 200 },
  { referencia: '08/2025', consumoPontaKwh: 8600, consumoForaPontaKwh: 59000, demandaMedidaPontaKw: 163, demandaMedidaForaPontaKw: 224, demandaContratadaPontaKw: 160, demandaContratadaForaPontaKw: 200 },
  { referencia: '09/2025', consumoPontaKwh: 7900, consumoForaPontaKwh: 55000, demandaMedidaPontaKw: 154, demandaMedidaForaPontaKw: 207, demandaContratadaPontaKw: 160, demandaContratadaForaPontaKw: 200 },
  { referencia: '10/2025', consumoPontaKwh: 8300, consumoForaPontaKwh: 58500, demandaMedidaPontaKw: 160, demandaMedidaForaPontaKw: 218, demandaContratadaPontaKw: 160, demandaContratadaForaPontaKw: 200 },
  { referencia: '11/2025', consumoPontaKwh: 7700, consumoForaPontaKwh: 53000, demandaMedidaPontaKw: 151, demandaMedidaForaPontaKw: 204, demandaContratadaPontaKw: 160, demandaContratadaForaPontaKw: 200 },
  { referencia: '12/2025', consumoPontaKwh: 8500, consumoForaPontaKwh: 60500, demandaMedidaPontaKw: 168, demandaMedidaForaPontaKw: 232, demandaContratadaPontaKw: 160, demandaContratadaForaPontaKw: 200 },
];

const TARIFAS_MOCK: Tarifas = {
  tusdDemandaPonta: 38, tusdDemandaForaPonta: 18,
  tePonta: 0.45, tusdEnergiaPonta: 0.28, teForaPonta: 0.28, tusdEnergiaForaPonta: 0.17,
};

const norm = (v: unknown) =>
  String(v ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function montarTarifas(rows: any[], modalidade: Modalidade): Tarifas {
  const eFora = (r: any) => norm(r.posto).includes('fora');
  const ePonta = (r: any) => norm(r.posto).includes('ponta') && !eFora(r);
  const energiaFora = rows.find((r) => r.unidade === 'R$/kWh' && eFora(r));
  const energiaPonta = rows.find((r) => r.unidade === 'R$/kWh' && ePonta(r));
  let tusdDemandaPonta = 0;
  let tusdDemandaForaPonta = 0;
  if (modalidade === 'Azul') {
    tusdDemandaPonta = rows.find((r) => r.unidade === 'kW' && ePonta(r))?.vlrTusd ?? 0;
    tusdDemandaForaPonta = rows.find((r) => r.unidade === 'kW' && eFora(r))?.vlrTusd ?? 0;
  } else {
    tusdDemandaForaPonta = rows.find((r) => r.unidade === 'kW')?.vlrTusd ?? 0;
  }
  return {
    tusdDemandaPonta, tusdDemandaForaPonta,
    tePonta: energiaPonta?.vlrTe ?? 0,
    tusdEnergiaPonta: energiaPonta?.vlrTusd ?? 0,
    teForaPonta: energiaFora?.vlrTe ?? 0,
    tusdEnergiaForaPonta: energiaFora?.vlrTusd ?? 0,
  };
}

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

type SubAba = 'detalhada' | 'expresso';

export default function PaginaDemanda() {
  const [subAba, setSubAba] = useState<SubAba>('detalhada');

  const [modalidade, setModalidade] = useState<Modalidade>('Verde');
  const [cargaCritica, setCargaCritica] = useState(false);
  const [meses, setMeses] = useState<MesDemanda[]>(MOCK_MESES);
  const [tarifas, setTarifas] = useState<Tarifas>(TARIFAS_MOCK);
  const [capexStr, setCapexStr] = useState('');

  const [agente, setAgente] = useState('EMT');
  const [subgrupo, setSubgrupo] = useState('A4');
  const [distribuidoras, setDistribuidoras] = useState<string[]>(['EMT']);
  const [buscandoTarifas, setBuscandoTarifas] = useState(false);
  const [notaTarifas, setNotaTarifas] = useState('');

  // Preenchimento em lote (Entrada Única) — strings vazias = não sobrescreve.
  const [loteConsPonta, setLoteConsPonta] = useState('');
  const [loteConsForaPonta, setLoteConsForaPonta] = useState('');
  const [loteDemMedida, setLoteDemMedida] = useState('');
  const [loteDemContratada, setLoteDemContratada] = useState('');

  // Feedback de importação de fatura (parser real ainda não plugado).
  const [nomeArquivoImportado, setNomeArquivoImportado] = useState<string | null>(null);

  const [lead, setLead] = useState({ nome: '', empresa: '', email: '', whatsapp: '', cidade: '' });
  const [envio, setEnvio] = useState<'idle' | 'enviando' | 'ok' | 'erro'>('idle');
  const [envioMsg, setEnvioMsg] = useState('');

  useEffect(() => {
    let vivo = true;
    fetch('/grafias-aneel.json', { cache: 'no-cache' })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((j) => {
        if (!vivo) return;
        const lista: string[] = Array.isArray(j?.distribuidoras) ? j.distribuidoras : [];
        setDistribuidoras(Array.from(new Set(['EMT', ...lista])).sort((a, b) => a.localeCompare(b, 'pt-BR')));
      })
      .catch(() => { if (vivo) setDistribuidoras(['EMT']); });
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    let vivo = true;
    setBuscandoTarifas(true);
    setNotaTarifas('');
    buscarTarifasAneel({ agente, subgrupo, modalidade })
      .then((rows: any[]) => {
        if (!vivo) return;
        if (!rows || rows.length === 0) {
          setNotaTarifas('Não encontrei tarifas para este contexto — ajuste manualmente abaixo.');
          return;
        }
        setTarifas(montarTarifas(rows, modalidade));
        setNotaTarifas('Tarifas preenchidas da ANEEL (valores líquidos, sem tributos — ajuste se necessário).');
      })
      .catch(() => { if (vivo) setNotaTarifas('Falha ao consultar a ANEEL — usando valores manuais.'); })
      .finally(() => { if (vivo) setBuscandoTarifas(false); });
    return () => { vivo = false; };
  }, [agente, subgrupo, modalidade]);

  function editarMes(i: number, campo: keyof MesDemanda, valor: string) {
    setMeses((prev) => prev.map((m, idx) =>
      idx === i ? { ...m, [campo]: campo === 'referencia' ? valor : Number(valor) || 0 } : m));
  }
  function editarTarifa(campo: keyof Tarifas, valor: string) {
    setTarifas((prev) => ({ ...prev, [campo]: Number(valor.replace(',', '.')) || 0 }));
  }

  function replicarNosMeses() {
    const num = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')) || 0);
    const cp = num(loteConsPonta);
    const cfp = num(loteConsForaPonta);
    const dm = num(loteDemMedida);
    const dc = num(loteDemContratada);
    const azulLocal = modalidade === 'Azul';

    setMeses((prev) => prev.map((m) => ({
      ...m,
      consumoPontaKwh: cp ?? m.consumoPontaKwh,
      consumoForaPontaKwh: cfp ?? m.consumoForaPontaKwh,
      demandaMedidaForaPontaKw: dm ?? m.demandaMedidaForaPontaKw,
      demandaContratadaForaPontaKw: dc ?? m.demandaContratadaForaPontaKw,
      demandaMedidaPontaKw: azulLocal ? (dm ?? m.demandaMedidaPontaKw) : m.demandaMedidaPontaKw,
      demandaContratadaPontaKw: azulLocal ? (dc ?? m.demandaContratadaPontaKw) : m.demandaContratadaPontaKw,
    })));
  }

  function handleImportarFatura(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setNomeArquivoImportado(arquivo.name);
    e.target.value = '';
  }
 function limparImportacao() {
    setNomeArquivoImportado(null);
  }

  // Item 4 — abre o diálogo de impressão do navegador (permite "Salvar em PDF").
  function handleImprimir() {
    window.print();
  }

  const resultado: ResultadoModuloII = useMemo(() => {
    const capex = capexStr.trim() ? Number(capexStr.replace(/\./g, '').replace(',', '.')) : undefined;
    return simularModuloII({ modalidade, cargaCritica, meses, tarifas, capexBessReais: capex });
  }, [modalidade, cargaCritica, meses, tarifas, capexStr]);

  function montarResumoBess(): ResumoBessLead {
    const f = resultado.financeiro;
    return {
      modalidade,
      cargaCritica,
      potenciaKw: resultado.dimensionamento.potenciaKw,
      energiaKwh: resultado.dimensionamento.energiaKwh,
      topologia: resultado.topologia.tipo,
      hardware: resultado.hardware.descricao,
      demandaContratadaOtimaKw: resultado.demandaContratadaOtimaForaPonta,
      mesesUltrapassagem: resultado.mesesComUltrapassagem.length,
      faturaAtualAnual: f.faturaAtualAnual,
      faturaOtimizadaAnual: f.faturaOtimizadaAnual,
      economiaAnual: f.economiaAnual,
      reducaoPercentual: f.reducaoPercentual,
      paybackAnos: f.paybackAnos,
    };
  }

  async function handleEnviarLead() {
    if (!lead.nome.trim() || !lead.email.trim() || !lead.whatsapp.trim()) {
      setEnvio('erro');
      setEnvioMsg('Preencha ao menos nome, e-mail e WhatsApp.');
      return;
    }
    setEnvio('enviando');
    setEnvioMsg('');
    const resp = await enviarLead(
      null,
      { nome: lead.nome, empresa: lead.empresa, email: lead.email, whatsapp: lead.whatsapp, cidade: lead.cidade, estado: 'MT' },
      { uf: 'MT', bess: montarResumoBess() },
    );
    if (resp.ok) {
      setEnvio('ok');
      setEnvioMsg('Proposta enviada ao time comercial! Em breve entraremos em contato.');
    } else {
      setEnvio('erro');
      setEnvioMsg(resp.error ?? 'Falha ao enviar. Tente novamente.');
    }
  }

  const azul = modalidade === 'Azul';

  return (
    <div style={s.page}>
      <h1 style={s.h1}>Módulo II — Gestão de Demanda + BESS (Grupo A)</h1>

      {/* SUB-ABAS (Nível 3) */}
      <div style={s.subAbas}>
        <button
          type="button"
          onClick={() => setSubAba('detalhada')}
          style={{ ...s.subAba, ...(subAba === 'detalhada' ? s.subAbaAtiva : {}) }}
        >
          Análise Detalhada (12 meses)
        </button>
        <button
          type="button"
          onClick={() => setSubAba('expresso')}
          style={{ ...s.subAba, ...(subAba === 'expresso' ? s.subAbaAtiva : {}) }}
        >
          Simulador Expresso (1 fatura)
        </button>
      </div>

      {subAba === 'expresso' ? (
        <SimuladorRapidoBess />
      ) : (
        <>
          {/* BLOCO 1 — Enquadramento */}
          <section style={s.card}>
            <h2 style={s.h2}>1. Enquadramento</h2>
            <div style={s.row}>
              <div style={s.field}>
                <label style={s.label}>Modalidade tarifária</label>
                <select value={modalidade} onChange={(e) => setModalidade(e.target.value as Modalidade)} style={s.input}>
                  <option value="Verde">Verde (demanda única)</option>
                  <option value="Azul">Azul (ponta + fora-ponta)</option>
                </select>
              </div>
            </div>
            <div style={s.field}>
              <label style={s.label}>A empresa possui processos contínuos que não podem parar por nem 1 segundo?</label>
              <div style={s.toggleRow}>
                <button type="button" onClick={() => setCargaCritica(true)} style={cargaCritica ? s.toggleOn : s.toggleOff}>Sim — carga crítica</button>
                <button type="button" onClick={() => setCargaCritica(false)} style={!cargaCritica ? s.toggleOn : s.toggleOff}>Não — foco em economia</button>
              </div>
            </div>
          </section>

          {/* BLOCO 2 — Histórico 12 meses */}
          <section style={s.card}>
            <div style={s.cardHead}>
              <h2 style={s.h2}>2. Histórico de 12 meses</h2>
              <div style={s.importWrap}>
                <label style={s.uploadBtn}>
                  Importar fatura (PDF)
                  <input type="file" accept="application/pdf,image/*" style={{ display: 'none' }} onChange={handleImportarFatura} />
                </label>
                {nomeArquivoImportado && (
                  <span style={s.badgeOk}>
                    ?? Arquivo recebido: {nomeArquivoImportado} — leitura automática em breve
                    <button type="button" onClick={limparImportacao} style={s.limparBtn}>Limpar</button>
                  </span>
                )}
              </div>
            </div>

            {/* Barra de preenchimento rápido / entrada única */}
            <div style={s.loteBox}>
              <span style={s.loteTitulo}>? Preenchimento Rápido / Entrada Única</span>
              <span style={s.helper}>Preencha só o que quiser replicar; campos em branco mantêm o valor de cada mês.</span>
              <div style={s.loteGrid}>
                <div style={s.field}>
                  <label style={s.labelSm}>Consumo Ponta (igual)</label>
                  <input type="number" value={loteConsPonta} onChange={(e) => setLoteConsPonta(e.target.value)} placeholder="kWh" style={s.input} />
                </div>
                <div style={s.field}>
                  <label style={s.labelSm}>Consumo Fora-P. (igual)</label>
                  <input type="number" value={loteConsForaPonta} onChange={(e) => setLoteConsForaPonta(e.target.value)} placeholder="kWh" style={s.input} />
                </div>
                <div style={s.field}>
                  <label style={s.labelSm}>Demanda Medida (igual)</label>
                  <input type="number" value={loteDemMedida} onChange={(e) => setLoteDemMedida(e.target.value)} placeholder="kW" style={s.input} />
                </div>
                <div style={s.field}>
                  <label style={s.labelSm}>Demanda Contratada (igual)</label>
                  <input type="number" value={loteDemContratada} onChange={(e) => setLoteDemContratada(e.target.value)} placeholder="kW" style={s.input} />
                </div>
                <button type="button" onClick={replicarNosMeses} style={s.replicarBtn}>? Replicar nos 12 Meses</button>
              </div>
            </div>

            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Mês</th>
                    <th style={s.th}>Cons. Ponta (kWh)</th>
                    <th style={s.th}>Cons. Fora-P. (kWh)</th>
                    {azul && <th style={s.th}>Dem. Med. Ponta</th>}
                    {azul && <th style={s.th}>Dem. Contr. Ponta</th>}
                    <th style={s.th}>Dem. Med. {azul ? 'Fora-P.' : 'Única'}</th>
                    <th style={s.th}>Dem. Contr. {azul ? 'Fora-P.' : 'Única'}</th>
                  </tr>
                </thead>
                <tbody>
                  {meses.map((m, i) => (
                    <tr key={m.referencia}>
                      <td style={s.td}><input value={m.referencia} onChange={(e) => editarMes(i, 'referencia', e.target.value)} style={s.cellTxt} /></td>
                      <td style={s.td}><input type="number" value={m.consumoPontaKwh} onChange={(e) => editarMes(i, 'consumoPontaKwh', e.target.value)} style={s.cell} /></td>
                      <td style={s.td}><input type="number" value={m.consumoForaPontaKwh} onChange={(e) => editarMes(i, 'consumoForaPontaKwh', e.target.value)} style={s.cell} /></td>
                      {azul && <td style={s.td}><input type="number" value={m.demandaMedidaPontaKw} onChange={(e) => editarMes(i, 'demandaMedidaPontaKw', e.target.value)} style={s.cell} /></td>}
                      {azul && <td style={s.td}><input type="number" value={m.demandaContratadaPontaKw} onChange={(e) => editarMes(i, 'demandaContratadaPontaKw', e.target.value)} style={s.cell} /></td>}
                      <td style={s.td}><input type="number" value={m.demandaMedidaForaPontaKw} onChange={(e) => editarMes(i, 'demandaMedidaForaPontaKw', e.target.value)} style={s.cell} /></td>
                      <td style={s.td}><input type="number" value={m.demandaContratadaForaPontaKw} onChange={(e) => editarMes(i, 'demandaContratadaForaPontaKw', e.target.value)} style={s.cell} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* BLOCO 3 — Tarifas */}
          <section style={s.card}>
            <h2 style={s.h2}>3. Tarifas (MT) — ANEEL automático</h2>
            <div style={s.row}>
              <div style={s.field}>
                <label style={s.label}>Distribuidora</label>
                <select value={agente} onChange={(e) => setAgente(e.target.value)} style={s.input}>
                  {distribuidoras.map((a) => <option key={a} value={a}>{a === 'EMT' ? 'Energisa Mato Grosso (EMT)' : a}</option>)}
                </select>
              </div>
              <div style={s.field}>
                <label style={s.label}>Subgrupo</label>
                <select value={subgrupo} onChange={(e) => setSubgrupo(e.target.value)} style={s.input}>
                  {['A1', 'A2', 'A3', 'A3a', 'A4', 'AS'].map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </div>
            </div>
            {notaTarifas && <span style={s.helper}>{buscandoTarifas ? 'Consultando ANEEL…' : notaTarifas}</span>}
            <div style={s.row}>
              <TarifaInput label="TE Ponta (R$/kWh)" v={tarifas.tePonta} on={(x) => editarTarifa('tePonta', x)} />
              <TarifaInput label="TUSD Energia Ponta" v={tarifas.tusdEnergiaPonta} on={(x) => editarTarifa('tusdEnergiaPonta', x)} />
              <TarifaInput label="TE Fora-Ponta (R$/kWh)" v={tarifas.teForaPonta} on={(x) => editarTarifa('teForaPonta', x)} />
              <TarifaInput label="TUSD Energia Fora-P." v={tarifas.tusdEnergiaForaPonta} on={(x) => editarTarifa('tusdEnergiaForaPonta', x)} />
              {azul && <TarifaInput label="TUSD Demanda Ponta (R$/kW)" v={tarifas.tusdDemandaPonta} on={(x) => editarTarifa('tusdDemandaPonta', x)} />}
              <TarifaInput label={`TUSD Demanda ${azul ? 'Fora-P.' : 'Única'} (R$/kW)`} v={tarifas.tusdDemandaForaPonta} on={(x) => editarTarifa('tusdDemandaForaPonta', x)} />
            </div>
          </section>

          {/* BLOCO 4 — Resultados */}
          <section style={s.card}>
            <h2 style={s.h2}>4. Resultado da simulação</h2>
            <div style={s.cardsGrid}>
              <ResCard titulo="Diagnóstico de ultrapassagem" destaque={resultado.ultrapassagemDetectada}>
                {resultado.ultrapassagemDetectada
                  ? <>Ultrapassagem em <strong>{resultado.mesesComUltrapassagem.length}</strong> meses: {resultado.mesesComUltrapassagem.join(', ')}.</>
                  : <>Nenhuma ultrapassagem detectada.</>}
              </ResCard>
              <ResCard titulo="Dimensionamento do BESS">
                Potência: <strong>{resultado.dimensionamento.potenciaKw} kW</strong><br />
                Energia: <strong>{resultado.dimensionamento.energiaKwh} kWh</strong><br />
                <span style={s.helper}>Demanda contratada ótima: {resultado.demandaContratadaOtimaForaPonta} kW</span>
              </ResCard>
              <ResCard titulo="Topologia recomendada (WEG)">
                <strong>{resultado.topologia.tipo}</strong><br />
                {resultado.topologia.conexao} · {resultado.topologia.tempoAtuacao}<br />
                <span style={s.helper}>{resultado.topologia.enfase}</span>
              </ResCard>
              <ResCard titulo="Hardware WEG sugerido">{resultado.hardware.descricao}</ResCard>
            </div>

            <div style={s.cardsGrid}>
              <Metrica titulo="Fatura atual (ano)" valor={fmtBRL(resultado.financeiro.faturaAtualAnual)} />
              <Metrica titulo="Fatura otimizada (ano)" valor={fmtBRL(resultado.financeiro.faturaOtimizadaAnual)} />
              <Metrica titulo="Economia anual" valor={fmtBRL(resultado.financeiro.economiaAnual)} destaque />
              <Metrica titulo="Redução" valor={`${resultado.financeiro.reducaoPercentual.toFixed(1)}%`} destaque />
            </div>

            <div style={s.row}>
              <div style={s.field}>
                <label style={s.label}>CAPEX do BESS (R$) — para o payback</label>
                <input value={capexStr} onChange={(e) => setCapexStr(e.target.value)} placeholder="ex.: 1.200.000" style={s.input} />
              </div>
              <div style={s.field}>
                <label style={s.label}>Payback estimado</label>
                <div style={s.paybackBox}>
                  {resultado.financeiro.paybackAnos != null
                    ? <strong>{resultado.financeiro.paybackAnos.toFixed(1)} anos</strong>
                    : <span style={s.helper}>Informe o CAPEX</span>}
                </div>
              </div>
            </div>

            <GraficoFluxoCaixa dados={resultado.financeiro.fluxoCaixa10Anos} />

            <div style={s.ganchos}>
              <h3 style={s.h3}>Argumentos comerciais</h3>
              <ul style={s.ul}>
                <li><strong>C&I:</strong> arbitragem de ponta, peak shaving e correção de fator de potência sem gerador a diesel.</li>
                <li><strong>Agronegócio:</strong> sistemas outdoor para pivôs de irrigação remotos e substituição de geradores a diesel.</li>
              </ul>
            </div>
          </section>

          {/* BLOCO 5 — Funil de leads */}
          <section style={s.card}>
            <h2 style={s.h2}>5. Receber proposta detalhada</h2>
            <span style={s.helper}>O relatório (modelo WEG, topologia, economia e payback) é enviado ao time comercial com seus dados.</span>
            <div style={s.row}>
              <Campo label="Nome*" v={lead.nome} on={(x) => setLead({ ...lead, nome: x })} />
              <Campo label="Empresa" v={lead.empresa} on={(x) => setLead({ ...lead, empresa: x })} />
              <Campo label="E-mail*" v={lead.email} on={(x) => setLead({ ...lead, email: x })} />
              <Campo label="WhatsApp*" v={lead.whatsapp} on={(x) => setLead({ ...lead, whatsapp: x })} />
              <Campo label="Cidade" v={lead.cidade} on={(x) => setLead({ ...lead, cidade: x })} />
            </div>
            <button type="button" onClick={handleEnviarLead} disabled={envio === 'enviando'} style={s.leadBtn}>
              {envio === 'enviando' ? 'Enviando…' : 'Quero uma proposta detalhada'}
            </button>
            {envio === 'ok' && <div style={s.statusOk}>{envioMsg}</div>}
            {envio === 'erro' && <div style={s.statusErro}>{envioMsg}</div>}
          </section>

          {resultado.avisos.length > 0 && (
            <div style={s.avisos}>{resultado.avisos.map((a, i) => <div key={i}>?? {a}</div>)}</div>
          )}
        </>
      )}
    </div>
  );
}

function TarifaInput({ label, v, on }: { label: string; v: number; on: (x: string) => void }) {
  return (
    <div style={s.field}>
      <label style={s.label}>{label}</label>
      <input value={String(v)} onChange={(e) => on(e.target.value)} style={s.inputNum} />
    </div>
  );
}
function Campo({ label, v, on }: { label: string; v: string; on: (x: string) => void }) {
  return (
    <div style={s.field}>
      <label style={s.label}>{label}</label>
      <input value={v} onChange={(e) => on(e.target.value)} style={s.input} />
    </div>
  );
}
function ResCard({ titulo, children, destaque = false }: { titulo: string; children: React.ReactNode; destaque?: boolean }) {
  return (
    <div style={{ ...s.resCard, ...(destaque ? s.resCardAlerta : {}) }}>
      <span style={s.resCardTit}>{titulo}</span>
      <div style={s.resCardBody}>{children}</div>
    </div>
  );
}
function Metrica({ titulo, valor, destaque = false }: { titulo: string; valor: string; destaque?: boolean }) {
  return (
    <div style={{ ...s.metrica, ...(destaque ? s.metricaDestaque : {}) }}>
      <span style={s.metricaLabel}>{titulo}</span>
      <strong style={s.metricaValor}>{valor}</strong>
    </div>
  );
}
function GraficoFluxoCaixa({ dados }: { dados: { ano: number; fluxoAcumulado: number }[] }) {
  const W = 720, H = 220, pad = 40;
  const vals = dados.map((d) => d.fluxoAcumulado);
  const min = Math.min(0, ...vals), max = Math.max(0, ...vals);
  const x = (i: number) => pad + (i * (W - 2 * pad)) / (dados.length - 1);
  const y = (v: number) => H - pad - ((v - min) / (max - min || 1)) * (H - 2 * pad);
  const linha = dados.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(d.fluxoAcumulado)}`).join(' ');
  const yZero = y(0);
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={W} height={H} style={{ maxWidth: '100%' }}>
        <line x1={pad} y1={yZero} x2={W - pad} y2={yZero} stroke="#B0BEC5" strokeDasharray="4 4" />
        <path d={linha} fill="none" stroke="#2E86C1" strokeWidth={3} />
        {dados.map((d, i) => (
          <g key={d.ano}>
            <circle cx={x(i)} cy={y(d.fluxoAcumulado)} r={3} fill={d.fluxoAcumulado >= 0 ? '#27AE60' : '#E67E22'} />
            <text x={x(i)} y={H - pad + 16} fontSize={10} textAnchor="middle" fill="#475467">{d.ano}</text>
          </g>
        ))}
        <text x={pad} y={pad - 12} fontSize={12} fill="#1B3A6B" fontWeight={700}>Fluxo de caixa acumulado (10 anos)</text>
      </svg>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { maxWidth: 980, margin: '0 auto', padding: 16, display: 'grid', gap: 16, color: '#101828' },
  h1: { fontSize: 22, fontWeight: 800, color: '#1B3A6B', margin: 0 },
  h2: { fontSize: 17, fontWeight: 800, color: '#1B3A6B', margin: 0 },
  h3: { fontSize: 15, fontWeight: 800, color: '#1B3A6B', margin: '0 0 6px' },
  subAbas: { display: 'flex', gap: 8, flexWrap: 'wrap', borderBottom: '2px solid #D5E8F3', paddingBottom: 4 },
  subAba: { padding: '10px 18px', borderRadius: '10px 10px 0 0', border: '1px solid #D5E8F3', borderBottom: 'none', background: '#F4F6F9', color: '#475467', cursor: 'pointer', fontWeight: 700, fontSize: 14 },
  subAbaAtiva: { background: 'linear-gradient(135deg, #1B3A6B 0%, #2E86C1 100%)', color: '#FFFFFF', border: '1px solid transparent' },
  card: { padding: 16, borderRadius: 12, background: '#FFFFFF', border: '1px solid #D5E8F3', display: 'grid', gap: 12 },
  cardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  importWrap: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  row: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 },
  field: { display: 'grid', gap: 6 },
  label: { fontSize: 13, fontWeight: 700, color: '#1B3A6B' },
  labelSm: { fontSize: 12, fontWeight: 700, color: '#1B3A6B' },
  input: { borderRadius: 10, border: '1px solid #D5E8F3', padding: '10px 12px', fontSize: 14, boxSizing: 'border-box' },
  inputNum: { borderRadius: 10, border: '1px solid #D5E8F3', padding: '10px 12px', fontSize: 14, boxSizing: 'border-box', fontVariantNumeric: 'tabular-nums' },
  helper: { fontSize: 12, color: '#475467' },
  toggleRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  toggleOn: { padding: '10px 16px', borderRadius: 10, border: '2px solid #2E86C1', background: '#EEF5FF', color: '#1B3A6B', fontWeight: 700, cursor: 'pointer' },
  toggleOff: { padding: '10px 16px', borderRadius: 10, border: '1px solid #D5E8F3', background: '#FFFFFF', color: '#475467', fontWeight: 600, cursor: 'pointer' },
  uploadBtn: { padding: '8px 14px', borderRadius: 10, border: '1px solid #2E86C1', color: '#2E86C1', fontWeight: 700, fontSize: 13, cursor: 'pointer' },
  badgeOk: { display: 'inline-flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 999, background: '#E8F8F0', color: '#1E7E47', fontWeight: 700, fontSize: 12 },
  limparBtn: { border: 'none', background: 'transparent', color: '#1E7E47', textDecoration: 'underline', cursor: 'pointer', fontWeight: 700, fontSize: 12, padding: 0 },
  loteBox: { display: 'grid', gap: 8, padding: 12, borderRadius: 10, background: '#FFF7ED', border: '1px solid #F39C12' },
  loteTitulo: { fontSize: 14, fontWeight: 800, color: '#E67E22' },
  loteGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, alignItems: 'end' },
  replicarBtn: { padding: '10px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #F39C12 0%, #E67E22 100%)', color: '#FFFFFF', fontWeight: 800, fontSize: 14, cursor: 'pointer', height: 'fit-content' },
  tableWrap: { overflowX: 'auto' },
  table: { borderCollapse: 'collapse', width: '100%', fontSize: 12 },
  th: { textAlign: 'left', padding: '8px 6px', color: '#1B3A6B', borderBottom: '2px solid #D5E8F3', whiteSpace: 'nowrap' },
  td: { padding: '4px 6px', borderBottom: '1px solid #EEF3F8' },
  cell: { width: 90, borderRadius: 6, border: '1px solid #D5E8F3', padding: '6px 8px', fontSize: 12, fontVariantNumeric: 'tabular-nums' },
  cellTxt: { width: 70, borderRadius: 6, border: '1px solid #D5E8F3', padding: '6px 8px', fontSize: 12 },
  cardsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 },
  resCard: { padding: 12, borderRadius: 10, background: '#F4F6F9', border: '1px solid #D5E8F3', display: 'grid', gap: 6 },
  resCardAlerta: { background: '#FFF7ED', border: '1px solid #E67E22' },
  resCardTit: { fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6, color: '#475467' },
  resCardBody: { fontSize: 14, lineHeight: 1.4 },
  metrica: { padding: 12, borderRadius: 10, background: '#F4F6F9', border: '1px solid #D5E8F3', display: 'grid', gap: 4 },
  metricaDestaque: { background: '#EEF5FF', border: '1px solid #2E86C1' },
  metricaLabel: { fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6, color: '#475467' },
  metricaValor: { fontSize: 18, fontWeight: 800, color: '#1B3A6B', fontVariantNumeric: 'tabular-nums' },
  paybackBox: { borderRadius: 10, border: '1px solid #D5E8F3', padding: '10px 12px', fontSize: 16, color: '#1B3A6B' },
  ganchos: { padding: 12, borderRadius: 10, background: '#F4F6F9', border: '1px solid #D5E8F3' },
  ul: { margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.5 },
  leadBtn: { padding: '12px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #F39C12 0%, #E67E22 100%)', color: '#FFFFFF', fontWeight: 800, fontSize: 15, cursor: 'pointer' },
  statusOk: { padding: 12, borderRadius: 8, background: '#E8F8F0', color: '#1E7E47', fontSize: 14, fontWeight: 700 },
  statusErro: { padding: 12, borderRadius: 8, background: '#FDEDEC', color: '#C0392B', fontSize: 14, fontWeight: 700 },
  avisos: { display: 'grid', gap: 4, fontSize: 12, color: '#B54708', background: '#FFFAEB', border: '1px solid #FEDF89', borderRadius: 8, padding: 10 },
};
