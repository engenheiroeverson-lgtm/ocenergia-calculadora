import React, { useMemo, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { lerOrcamentoFornecedor } from "./lerOrcamentoFornecedor";

/**
 * GeradorOrcamento.tsx — layout com a identidade visual OCENERGIA (azul + âmbar).
 * Funções preservadas: importar PDF do fornecedor, PDF (JPEG, leve), WhatsApp,
 * e-mail (texto e PDF anexo), resumo interno.
 *
 * LOGO — escolha a variante numa linha só (coloque o PNG em public/):
 *   "/LOGO_OCENERGIA01.png"          -> completo (sol + OCENERGIA + SOLAR)  [já em public]
 *   "/LOGO_OCENERGIA_SOL.PNG"        -> só o símbolo do sol (recomendado p/ cabeçalho)
 *   "/LOGO_OCENERGIA_SEM_SOLAR.PNG"  -> símbolo + OCENERGIA
 *   "/LOGO_SO_OCENERGIA.PNG"         -> só a palavra OCENERGIA
 */

const EMPRESA = {
  razaoSocial: "OC MATERIAIS ELETRICOS IMPORTACAO E EXPORTACAO LTDA",
  nomeFantasia: "OCENERGIA — Materiais Elétricos & Solar",
  cnpj: "42.319.765/0001-39",
  ie: "13.907.506-2",
  telefones: ["(65) 99618-0250", "(65) 99646-6231"],
  emails: ["loja@ocenergiasolar.com.br", "financeiro@ocenergiasolar.com.br"],
  endereco: "Av. Marechal Rondon, 998 - Centro, Barra do Bugres - MT, 78390-000",
  validadeDias: 15,
  logoSrc: "/LOGO_OCENERGIA_SOL.PNG", // <- símbolo do sol. Troque pela variante desejada (ver topo)
};

const COR = {
  primaria: "#1B3A6B",
  azul: "#2E86C1",
  azulClaroTxt: "#B3D4F5",
  amarelo: "#F39C12",
  laranja: "#E67E22",
  ambarTxt: "#854F0B",
  neutroClaro: "#F4F6F9",
  azulClaro: "#D5E8F3",
  cinza: "#475467",
  cinzaClaro: "#7A8699",
  escuro: "#101828",
  sucesso: "#1E7E47",
  branco: "#FFFFFF",
  borda: "#D5E8F3",
};

type ModoMargem = "markup" | "venda";

interface LinhaImport {
  descricao: string;
  valorTexto: string;
}

const brl = (v: number): string =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number.isFinite(v) ? v : 0
  );

const dataPtBr = (d: Date): string =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(d);

const parseValor = (s: string): number =>
  parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;

interface ResultadoCalculo {
  preco: number;
  lucro: number;
  erro: string | null;
}

function calcularPreco(custo: number, margemPct: number, modo: ModoMargem): ResultadoCalculo {
  const c = Number.isFinite(custo) ? custo : 0;
  const m = (Number.isFinite(margemPct) ? margemPct : 0) / 100;
  if (modo === "markup") {
    const preco = c * (1 + m);
    return { preco, lucro: preco - c, erro: null };
  }
  if (m >= 1) {
    return { preco: 0, lucro: 0, erro: "A margem sobre a venda precisa ser menor que 100%." };
  }
  const preco = c / (1 - m);
  return { preco, lucro: preco - c, erro: null };
}

function sanitizarTelefone(tel: string): string {
  const d = tel.replace(/\D/g, "");
  if (!d) return "";
  if ((d.length === 10 || d.length === 11) && !d.startsWith("55")) return "55" + d;
  return d;
}

const estiloToggle = (ativo: boolean): React.CSSProperties => ({
  flex: 1,
  padding: "8px 10px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  borderRadius: 8,
  border: `1px solid ${ativo ? COR.primaria : COR.borda}`,
  background: ativo ? COR.primaria : COR.branco,
  color: ativo ? COR.branco : COR.cinza,
});

const estiloBtn = (bg: string, off?: boolean): React.CSSProperties => ({
  flex: "1 1 180px",
  padding: "12px 16px",
  fontSize: 14,
  fontWeight: 700,
  color: COR.branco,
  background: bg,
  border: "none",
  borderRadius: 8,
  cursor: off ? "not-allowed" : "pointer",
  opacity: off ? 0.6 : 1,
});

export default function GeradorOrcamento(): React.ReactElement {
  const hoje = useMemo(() => new Date(), []);
  const validade = useMemo(() => {
    const d = new Date(hoje);
    d.setDate(d.getDate() + EMPRESA.validadeDias);
    return d;
  }, [hoje]);

  const [numero, setNumero] = useState<string>(
    `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}${String(
      hoje.getDate()
    ).padStart(2, "0")}-001`
  );
  const [cliente, setCliente] = useState<string>("");
  const [documentoCliente, setDocumentoCliente] = useState<string>("");
  const [telefoneCliente, setTelefoneCliente] = useState<string>("");
  const [emailCliente, setEmailCliente] = useState<string>("");
  const [descricao, setDescricao] = useState<string>("");
  const [custo, setCusto] = useState<string>("");
  const [margem, setMargem] = useState<string>("30");
  const [modo, setModo] = useState<ModoMargem>("markup");

  const [gerando, setGerando] = useState<boolean>(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const inputPdfRef = useRef<HTMLInputElement>(null);
  const [importando, setImportando] = useState<boolean>(false);
  const [itensImportados, setItensImportados] = useState<LinhaImport[]>([]);
  const [textoBrutoImport, setTextoBrutoImport] = useState<string>("");
  const [mostrarTextoBruto, setMostrarTextoBruto] = useState<boolean>(false);
  const [avisoImport, setAvisoImport] = useState<string | null>(null);

  const custoNum = parseFloat(custo.replace(",", ".")) || 0;
  const margemNum = parseFloat(margem.replace(",", ".")) || 0;

  const { preco, lucro, erro } = useMemo(
    () => calcularPreco(custoNum, margemNum, modo),
    [custoNum, margemNum, modo]
  );

  const formulaTexto =
    modo === "markup"
      ? `Preço = Custo × (1 + ${margemNum}%) = ${brl(custoNum)} × ${(1 + margemNum / 100).toFixed(4)}`
      : `Preço = Custo ÷ (1 − ${margemNum}%) = ${brl(custoNum)} ÷ ${(1 - margemNum / 100).toFixed(4)}`;

  const nomeArquivo = `Orcamento-${(numero || "sem-numero").replace(/[^\w-]/g, "_")}.pdf`;

  const totalImportado = itensImportados.reduce((s, it) => s + parseValor(it.valorTexto), 0);

  const montarResumo = (): string =>
    [
      `*${EMPRESA.nomeFantasia}*`,
      `Proposta nº ${numero || "—"} — ${dataPtBr(hoje)}`,
      `Cliente: ${cliente || "—"}`,
      "",
      descricao.trim() || "(sem descrição)",
      "",
      `*VALOR TOTAL: ${brl(preco)}*`,
      `Validade: ${EMPRESA.validadeDias} dias (até ${dataPtBr(validade)}).`,
      "",
      EMPRESA.telefones.join(" / "),
      EMPRESA.emails[0],
    ].join("\n");

  async function gerarPdfBlob(): Promise<Blob> {
    const el = document.getElementById("orcamento-doc");
    if (!el) throw new Error("Documento não encontrado na página.");

    const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;
    const imgData = canvas.toDataURL("image/jpeg", 0.85); // JPEG: leve, evita HTTP 413

    let heightLeft = imgH;
    let position = 0;
    pdf.addImage(imgData, "JPEG", 0, position, imgW, imgH);
    heightLeft -= pageH;
    while (heightLeft > 0) {
      position -= pageH;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, position, imgW, imgH);
      heightLeft -= pageH;
    }
    return pdf.output("blob");
  }

  function baixarBlob(blob: Blob, nome: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function blobParaBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const res = typeof r.result === "string" ? r.result : "";
        resolve(res.includes(",") ? res.slice(res.indexOf(",") + 1) : res);
      };
      r.onerror = () => reject(new Error("Falha ao ler o PDF."));
      r.readAsDataURL(blob);
    });
  }

  // === Importação do PDF do fornecedor ===
  const handleArquivoPdf = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvisoImport(null);
    setImportando(true);
    setItensImportados([]);
    setTextoBrutoImport("");
    try {
      const r = await lerOrcamentoFornecedor(file);
      setItensImportados(
        r.itens.map((it) => ({ descricao: it.descricao, valorTexto: it.valor.toFixed(2).replace(".", ",") }))
      );
      setTextoBrutoImport(r.textoBruto);
      setAvisoImport(r.aviso);
    } catch (err) {
      setAvisoImport("Não foi possível ler o PDF. Verifique se é um PDF com texto (não escaneado).");
      console.error("[orcamento] erro ao ler PDF do fornecedor:", err);
    } finally {
      setImportando(false);
      if (inputPdfRef.current) inputPdfRef.current.value = "";
    }
  };

  const atualizarItemImportado = (i: number, campo: "descricao" | "valorTexto", valor: string): void => {
    setItensImportados((prev) => prev.map((item, idx) => (idx === i ? { ...item, [campo]: valor } : item)));
  };

  const removerItemImportado = (i: number): void => {
    setItensImportados((prev) => prev.filter((_, idx) => idx !== i));
  };

  const aplicarItensImportados = (): void => {
    if (itensImportados.length === 0) return;
    const linhas = itensImportados.map((it) => it.descricao.trim()).filter(Boolean).join("\n");
    setDescricao((prev) => (prev.trim() ? prev + "\n" + linhas : linhas));
    setCusto(totalImportado.toFixed(2));
    setAvisoImport(`Aplicado: ${itensImportados.length} item(ns). Custo preenchido com ${brl(totalImportado)}.`);
  };

  const limparImport = (): void => {
    setItensImportados([]);
    setTextoBrutoImport("");
    setAvisoImport(null);
  };

  // === Ações de saída ===
  const handleImprimir = (): void => window.print();

  const handleBaixarPdf = async (): Promise<void> => {
    setAviso(null);
    setGerando(true);
    try {
      const blob = await gerarPdfBlob();
      baixarBlob(blob, nomeArquivo);
    } catch (e) {
      setAviso("Não foi possível gerar o PDF. Verifique se o logo está em public/ e tente novamente.");
      console.error("[orcamento] erro ao gerar PDF:", e);
    } finally {
      setGerando(false);
    }
  };

  const abrirWhatsAppTexto = (): void => {
    const texto = encodeURIComponent(montarResumo());
    const num = sanitizarTelefone(telefoneCliente);
    const url = num ? `https://wa.me/${num}?text=${texto}` : `https://wa.me/?text=${texto}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleEnviarPdf = async (): Promise<void> => {
    setAviso(null);
    setGerando(true);
    try {
      const blob = await gerarPdfBlob();
      const file = new File([blob], nomeArquivo, { type: "application/pdf" });
      const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
      if (nav.canShare && nav.canShare({ files: [file] }) && typeof nav.share === "function") {
        await nav.share({ files: [file], title: `Proposta nº ${numero}`, text: montarResumo() });
      } else {
        baixarBlob(blob, nomeArquivo);
        setAviso("Seu dispositivo não anexa arquivo direto. Baixei o PDF — anexe-o na conversa do WhatsApp que vou abrir.");
        abrirWhatsAppTexto();
      }
    } catch (e) {
      const erroNome = (e as { name?: string } | undefined)?.name;
      if (erroNome !== "AbortError") {
        setAviso("Não foi possível compartilhar o PDF. Tente 'Baixar PDF' e anexar manualmente.");
        console.error("[orcamento] erro ao compartilhar PDF:", e);
      }
    } finally {
      setGerando(false);
    }
  };

  const handleEmailTexto = (): void => {
    const assunto = encodeURIComponent(`Proposta nº ${numero} — ${EMPRESA.nomeFantasia}`);
    const corpo = encodeURIComponent(montarResumo());
    const to = encodeURIComponent(emailCliente.trim());
    window.location.href = `mailto:${to}?subject=${assunto}&body=${corpo}`;
  };

  const handleEnviarEmailPdf = async (): Promise<void> => {
    setAviso(null);
    if (!emailCliente.trim()) {
      setAviso("Informe o e-mail do cliente para enviar o PDF.");
      return;
    }
    setGerando(true);
    try {
      const blob = await gerarPdfBlob();
      const pdfBase64 = await blobParaBase64(blob);
      const resp = await fetch("/api/enviar-orcamento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          para: emailCliente.trim(),
          pdfBase64,
          assunto: `Proposta nº ${numero} — ${EMPRESA.nomeFantasia}`,
          corpo: montarResumo(),
          nomeArquivo,
        }),
      });
      const data: { ok?: boolean; error?: string } | null = await resp.json().catch(() => null);
      if (resp.ok && data?.ok) {
        setAviso(`PDF enviado por e-mail para ${emailCliente.trim()}.`);
      } else if (resp.status === 413) {
        setAviso("O PDF ficou grande demais para o envio. Reduza a descrição ou o número de páginas.");
      } else {
        setAviso(`Não foi possível enviar: ${data?.error ?? `HTTP ${resp.status}`}.`);
      }
    } catch (e) {
      setAviso("Falha ao enviar o e-mail. Verifique a conexão (o envio só funciona no app publicado).");
      console.error("[orcamento] erro envio e-mail PDF:", e);
    } finally {
      setGerando(false);
    }
  };

  const styles: Record<string, React.CSSProperties> = {
    container: { display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start", fontFamily: "'Segoe UI', system-ui, Arial, sans-serif", color: COR.escuro, padding: 16, background: COR.neutroClaro },
    painel: { flex: "1 1 360px", minWidth: 320, background: COR.branco, border: `1px solid ${COR.borda}`, borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(16,24,40,0.06)" },
    tituloPainel: { margin: "0 0 16px", fontSize: 18, fontWeight: 700, color: COR.primaria },
    grupo: { marginBottom: 14 },
    label: { display: "block", fontSize: 13, fontWeight: 600, color: COR.cinza, marginBottom: 6 },
    input: { width: "100%", boxSizing: "border-box", padding: "10px 12px", fontSize: 14, border: `1px solid ${COR.borda}`, borderRadius: 8, outline: "none", color: COR.escuro, background: COR.branco },
    textarea: { width: "100%", boxSizing: "border-box", padding: "10px 12px", fontSize: 14, minHeight: 120, resize: "vertical", border: `1px solid ${COR.borda}`, borderRadius: 8, outline: "none", color: COR.escuro, fontFamily: "inherit" },
    linha2: { display: "flex", gap: 12, flexWrap: "wrap" },
    col: { flex: "1 1 140px" },
    toggle: { display: "flex", gap: 8, marginTop: 4 },
    ajuda: { fontSize: 11, color: COR.cinza, marginTop: 6, lineHeight: 1.4 },
    formula: { fontSize: 11, color: COR.azul, marginTop: 8, fontFamily: "monospace", wordBreak: "break-all" },
    erro: { marginTop: 10, padding: "8px 10px", background: "#FDECEA", border: "1px solid #F5C6CB", borderRadius: 8, color: "#922B21", fontSize: 13 },

    // Importação fornecedor (estilo tabela limpa)
    importBox: { marginBottom: 14, padding: 16, border: `1px solid ${COR.borda}`, borderRadius: 12, background: COR.branco },
    importHead: { display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 13, fontWeight: 700, color: COR.primaria },
    dropZone: { border: `1.5px dashed ${COR.amarelo}`, background: "#FFF8EC", borderRadius: 10, padding: 18, textAlign: "center", cursor: "pointer" },
    dropTitulo: { fontSize: 13, color: COR.ambarTxt, fontWeight: 700, marginTop: 4 },
    dropSub: { fontSize: 11, color: "#9A8252" },
    tabela: { border: `0.5px solid ${COR.borda}`, borderRadius: 10, overflow: "hidden", marginTop: 12 },
    tabelaHead: { display: "flex", background: COR.primaria, color: COR.branco, fontSize: 11, fontWeight: 600, padding: "8px 12px" },
    linhaItem: { display: "flex", alignItems: "center", borderTop: `0.5px solid ${COR.borda}` },
    inputDesc: { flex: "1 1 auto", minWidth: 0, border: "none", background: "transparent", fontSize: 12, color: COR.escuro, padding: "9px 12px", outline: "none" },
    inputValor: { width: 92, border: "none", background: "transparent", fontSize: 12, color: COR.escuro, textAlign: "right", fontFamily: "monospace", outline: "none", padding: "9px 8px" },
    btnRemover: { width: 30, flex: "0 0 auto", border: "none", background: "transparent", color: "#C0392B", cursor: "pointer", fontSize: 15, fontWeight: 700 },
    importFooter: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, gap: 10, flexWrap: "wrap" },
    badgeCusto: { background: "#FAEEDA", color: COR.ambarTxt, fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 8 },
    btnAplicar: { background: COR.azul, color: COR.branco, border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
    linkBtn: { background: "none", border: "none", color: COR.azul, cursor: "pointer", fontSize: 12, textDecoration: "underline", padding: 0 },
    avisoImportBox: { marginTop: 10, fontSize: 12, color: COR.ambarTxt, background: "#FEF6E7", border: `1px solid ${COR.amarelo}`, borderRadius: 6, padding: "6px 8px" },
    textoBrutoBox: { marginTop: 8, maxHeight: 160, overflow: "auto", fontSize: 11, fontFamily: "monospace", whiteSpace: "pre-wrap", background: COR.neutroClaro, border: `1px solid ${COR.borda}`, borderRadius: 6, padding: 8, color: COR.cinza },

    // Documento (identidade OCENERGIA)
    doc: { flex: "2 1 520px", minWidth: 360, background: COR.branco, border: `1px solid ${COR.borda}`, borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px rgba(16,24,40,0.06)" },
    cabecalho: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, padding: "20px 22px", background: COR.branco },
    logo: { height: 64, width: "auto", objectFit: "contain" },
    empresaInfo: { textAlign: "right", fontSize: 11, lineHeight: 1.55, color: COR.cinza },
    empresaNome: { fontSize: 15, fontWeight: 700, color: COR.primaria, letterSpacing: 0.3 },
    razaoPeq: { fontSize: 10, color: COR.cinzaClaro, marginBottom: 3 },
    barraMarca: { display: "flex", height: 4 },
    corpo: { padding: 22 },
    tituloDoc: { display: "inline-block", fontSize: 20, fontWeight: 700, color: COR.primaria, borderBottom: `3px solid ${COR.amarelo}`, paddingBottom: 2 },
    metaLinha: { display: "flex", justifyContent: "space-between", fontSize: 12, color: COR.cinza, borderBottom: `0.5px solid ${COR.borda}`, padding: "12px 0", margin: "12px 0 16px", flexWrap: "wrap", gap: 8 },
    blocoCliente: { background: COR.neutroClaro, borderLeft: `3px solid ${COR.azul}`, borderRadius: "0 8px 8px 0", padding: "12px 14px", marginBottom: 16, fontSize: 13 },
    rotulo: { fontSize: 10, color: COR.cinzaClaro, textTransform: "uppercase", letterSpacing: 0.6 },
    descricaoBox: { whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.6, color: COR.escuro, marginBottom: 20, minHeight: 40 },
    totalBox: { background: COR.primaria, borderLeft: `4px solid ${COR.amarelo}`, borderRadius: "0 10px 10px 0", padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" },
    totalRotulo: { fontSize: 13, color: COR.azulClaroTxt },
    totalValor: { fontSize: 26, fontWeight: 800, color: COR.branco },
    rodape: { padding: "14px 22px", borderTop: `0.5px solid ${COR.borda}`, background: "#F9FBFD", fontSize: 11, color: COR.cinza, textAlign: "center" },
    validade: { color: COR.ambarTxt, fontWeight: 600, fontStyle: "italic", marginTop: 2 },

    resumoInterno: { marginTop: 14, padding: "12px 14px", background: "#FFF8E1", border: `1px dashed ${COR.amarelo}`, borderRadius: 8 },
    resumoInternoTitulo: { fontSize: 11, fontWeight: 700, color: COR.ambarTxt, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4 },
    resumoInternoLinha: { display: "flex", justifyContent: "space-between", fontSize: 13, color: COR.escuro, padding: "3px 0" },

    acoes: { flex: "1 1 100%", display: "flex", flexWrap: "wrap", gap: 10 },
    notaAcoes: { flex: "1 1 100%", fontSize: 11, color: COR.cinza, lineHeight: 1.5, marginTop: 4 },
    avisoBox: { flex: "1 1 100%", padding: "10px 12px", background: "#FEF6E7", border: `1px solid ${COR.amarelo}`, borderRadius: 8, color: COR.ambarTxt, fontSize: 13 },
  };

  return (
    <div style={styles.container}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #orcamento-doc, #orcamento-doc * { visibility: visible; }
          #orcamento-doc { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none; border: none; border-radius: 0; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* ENTRADA */}
      <section style={styles.painel} className="no-print">
        <h2 style={styles.tituloPainel}>Dados do orçamento</h2>

        <div style={styles.grupo}>
          <label style={styles.label}>Número do orçamento</label>
          <input style={styles.input} value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Ex.: 2025-001" />
        </div>

        <div style={styles.grupo}>
          <label style={styles.label}>Cliente</label>
          <input style={styles.input} value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nome do cliente" />
        </div>

        <div style={styles.linha2}>
          <div style={styles.col}>
            <label style={styles.label}>CPF / CNPJ (opcional)</label>
            <input style={styles.input} value={documentoCliente} onChange={(e) => setDocumentoCliente(e.target.value)} placeholder="000.000.000-00" />
          </div>
          <div style={styles.col}>
            <label style={styles.label}>WhatsApp do cliente</label>
            <input style={styles.input} inputMode="tel" value={telefoneCliente} onChange={(e) => setTelefoneCliente(e.target.value)} placeholder="(65) 99999-9999" />
          </div>
        </div>

        <div style={styles.grupo}>
          <label style={styles.label}>E-mail do cliente</label>
          <input style={styles.input} inputMode="email" value={emailCliente} onChange={(e) => setEmailCliente(e.target.value)} placeholder="cliente@exemplo.com" />
        </div>

        {/* IMPORTAR PDF DO FORNECEDOR */}
        <div style={styles.importBox}>
          <div style={styles.importHead}>
            <span style={{ fontSize: 16 }}>⤓</span> Importar PDF do fornecedor
          </div>
          <input ref={inputPdfRef} type="file" accept="application/pdf" style={{ display: "none" }} onChange={handleArquivoPdf} />
          <div
            style={{ ...styles.dropZone, opacity: importando ? 0.6 : 1, pointerEvents: importando ? "none" : "auto" }}
            onClick={() => inputPdfRef.current?.click()}
          >
            <div style={{ fontSize: 24, color: COR.laranja }}>⬆</div>
            <div style={styles.dropTitulo}>{importando ? "Lendo PDF…" : "Selecionar PDF do fornecedor"}</div>
            <div style={styles.dropSub}>clique para escolher o arquivo</div>
          </div>

          {avisoImport && <div style={styles.avisoImportBox}>{avisoImport}</div>}

          {itensImportados.length > 0 && (
            <>
              <div style={styles.tabela}>
                <div style={styles.tabelaHead}>
                  <span style={{ flex: 1 }}>Descrição</span>
                  <span style={{ width: 92, textAlign: "right" }}>Valor</span>
                  <span style={{ width: 30 }} />
                </div>
                {itensImportados.map((it, i) => (
                  <div key={i} style={{ ...styles.linhaItem, background: i % 2 ? "#F7FAFD" : COR.branco }}>
                    <input style={styles.inputDesc} value={it.descricao} onChange={(e) => atualizarItemImportado(i, "descricao", e.target.value)} placeholder="Descrição" />
                    <input style={styles.inputValor} value={it.valorTexto} onChange={(e) => atualizarItemImportado(i, "valorTexto", e.target.value)} placeholder="0,00" inputMode="decimal" />
                    <button type="button" style={styles.btnRemover} onClick={() => removerItemImportado(i)} title="Remover">×</button>
                  </div>
                ))}
              </div>

              <div style={styles.importFooter}>
                <span style={styles.badgeCusto}>Custo total: {brl(totalImportado)}</span>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button type="button" style={styles.linkBtn} onClick={limparImport}>Limpar</button>
                  <button type="button" style={styles.btnAplicar} onClick={aplicarItensImportados}>Aplicar no orçamento</button>
                </div>
              </div>
            </>
          )}

          {textoBrutoImport && (
            <div>
              <button type="button" style={{ ...styles.linkBtn, marginTop: 10 }} onClick={() => setMostrarTextoBruto((v) => !v)}>
                {mostrarTextoBruto ? "Ocultar texto lido" : "Ver texto lido (conferência)"}
              </button>
              {mostrarTextoBruto && <div style={styles.textoBrutoBox}>{textoBrutoImport}</div>}
            </div>
          )}

          <p style={{ ...styles.ajuda, marginTop: 8 }}>
            Os valores lidos viram o <strong>custo</strong> (a margem é aplicada por cima) e não aparecem
            para o cliente. Confira cada linha antes de aplicar.
          </p>
        </div>

        <div style={styles.grupo}>
          <label style={styles.label}>Descrição / itens (cole aqui)</label>
          <textarea style={styles.textarea} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder={"Cole aqui a descrição do serviço/material.\nCada linha aparece no orçamento."} />
        </div>

        <div style={styles.linha2}>
          <div style={styles.col}>
            <label style={styles.label}>Custo (R$)</label>
            <input style={styles.input} inputMode="decimal" value={custo} onChange={(e) => setCusto(e.target.value)} placeholder="0,00" />
          </div>
          <div style={styles.col}>
            <label style={styles.label}>Margem (%)</label>
            <input style={styles.input} inputMode="decimal" value={margem} onChange={(e) => setMargem(e.target.value)} placeholder="30" />
          </div>
        </div>

        <div style={styles.grupo}>
          <label style={styles.label}>Como a margem é aplicada?</label>
          <div style={styles.toggle}>
            <button type="button" style={estiloToggle(modo === "markup")} onClick={() => setModo("markup")}>Markup sobre o custo</button>
            <button type="button" style={estiloToggle(modo === "venda")} onClick={() => setModo("venda")}>Margem sobre a venda</button>
          </div>
          <p style={styles.ajuda}>
            <strong>Markup:</strong> ganho em cima do custo (PV = Custo × (1 + m)).{" "}
            <strong>Margem sobre a venda:</strong> o lucro é fração do preço final (PV = Custo ÷ (1 − m)).
          </p>
          {custoNum > 0 && !erro && <p style={styles.formula}>{formulaTexto}</p>}
        </div>

        {erro && <div style={styles.erro}>{erro}</div>}

        {custoNum > 0 && !erro && (
          <div style={styles.resumoInterno}>
            <div style={styles.resumoInternoTitulo}>Resumo interno (não aparece no orçamento do cliente)</div>
            <div style={styles.resumoInternoLinha}><span>Preço de venda</span><strong>{brl(preco)}</strong></div>
            <div style={styles.resumoInternoLinha}><span>Custo</span><span>{brl(custoNum)}</span></div>
            <div style={styles.resumoInternoLinha}><span>Lucro</span><span style={{ color: COR.sucesso, fontWeight: 700 }}>{brl(lucro)}</span></div>
            <div style={styles.resumoInternoLinha}><span>Margem</span><span>{margemNum}% ({modo === "markup" ? "markup" : "sobre venda"})</span></div>
          </div>
        )}
      </section>

      {/* DOCUMENTO */}
      <section style={styles.doc} id="orcamento-doc">
        <header style={styles.cabecalho}>
          <img src={EMPRESA.logoSrc} alt={EMPRESA.nomeFantasia} style={styles.logo} />
          <div style={styles.empresaInfo}>
            <div style={styles.empresaNome}>OCENERGIA <span style={{ color: COR.azul }}>— Materiais Elétricos &amp; Solar</span></div>
            <div style={styles.razaoPeq}>{EMPRESA.razaoSocial}</div>
            <div>CNPJ: {EMPRESA.cnpj} &nbsp;|&nbsp; IE: {EMPRESA.ie}</div>
            <div>{EMPRESA.telefones.join("  •  ")}</div>
            <div>{EMPRESA.emails.join("  •  ")}</div>
          </div>
        </header>
        <div style={styles.barraMarca}>
          <div style={{ flex: 2, background: COR.primaria }} />
          <div style={{ flex: 1, background: COR.azul }} />
          <div style={{ flex: 1, background: COR.amarelo }} />
        </div>

        <div style={styles.corpo}>
          <div style={styles.tituloDoc}>Proposta / Orçamento</div>
          <div style={styles.metaLinha}>
            <span>Nº {numero || "—"}</span>
            <span>Data: {dataPtBr(hoje)}</span>
          </div>

          <div style={styles.blocoCliente}>
            <div style={styles.rotulo}>Cliente</div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{cliente || "—"}</div>
            {documentoCliente && <div>{documentoCliente}</div>}
            {telefoneCliente && <div>{telefoneCliente}</div>}
            {emailCliente && <div>{emailCliente}</div>}
          </div>

          <div style={styles.rotulo}>Descrição</div>
          <div style={styles.descricaoBox}>{descricao || "Cole a descrição no painel ao lado."}</div>

          <div style={styles.totalBox}>
            <span style={styles.totalRotulo}>Valor total</span>
            <span style={styles.totalValor}>{brl(preco)}</span>
          </div>
        </div>

        <footer style={styles.rodape}>
          <div>{EMPRESA.endereco}</div>
          <div style={styles.validade}>Esta proposta é válida por {EMPRESA.validadeDias} dias (até {dataPtBr(validade)}).</div>
        </footer>
      </section>

      {/* AÇÕES */}
      <div style={styles.acoes} className="no-print">
        <button type="button" style={estiloBtn(COR.amarelo)} onClick={handleImprimir}>Imprimir</button>
        <button type="button" style={estiloBtn(COR.primaria, gerando)} onClick={handleBaixarPdf} disabled={gerando}>{gerando ? "Gerando…" : "Baixar PDF"}</button>
        <button type="button" style={estiloBtn(COR.sucesso, gerando)} onClick={handleEnviarPdf} disabled={gerando}>{gerando ? "Gerando…" : "Enviar PDF (WhatsApp)"}</button>
        <button type="button" style={estiloBtn(COR.laranja, gerando)} onClick={handleEnviarEmailPdf} disabled={gerando}>{gerando ? "Gerando…" : "E-mail (PDF)"}</button>
        <button type="button" style={estiloBtn(COR.azul)} onClick={handleEmailTexto}>E-mail (texto)</button>
      </div>

      {aviso && <div style={styles.avisoBox} className="no-print">{aviso}</div>}

      <p style={styles.notaAcoes} className="no-print">
        "Enviar PDF (WhatsApp)" anexa o arquivo no <strong>celular</strong> (menu Compartilhar). No <strong>computador</strong>, o PDF é baixado e o WhatsApp abre com o texto para anexar.
        "E-mail (PDF)" envia pelo servidor — <strong>só funciona no app publicado</strong>.
      </p>
    </div>
  );
}
