import React, { useMemo, useState } from "react";
import { jsPDF } from "jspdf";          // npm i jspdf  (verifique a API na versão instalada)
import html2canvas from "html2canvas";  // npm i html2canvas

/**
 * GeradorOrcamento.tsx
 * -------------------------------------------------------------------------
 * Módulo genérico de orçamento da plataforma OCENERGIA.
 *
 * AÇÕES:
 *   - Imprimir / Salvar PDF (window.print)
 *   - Baixar PDF (jsPDF + html2canvas -> Blob -> download)
 *   - Enviar PDF (WhatsApp/Compartilhar): no celular usa navigator.share com
 *     o ARQUIVO anexado; no desktop baixa o PDF e abre o WhatsApp Web (texto).
 *   - WhatsApp (texto) e E-mail (texto): atalhos rápidos via wa.me / mailto.
 *
 * DEPENDÊNCIAS (instalar):  npm i jspdf html2canvas
 *   (ambas trazem os próprios tipos; não precisa de @types/*)
 *
 * NOTAS HONESTAS:
 *   - wa.me / mailto carregam SOMENTE TEXTO. O anexo real de PDF só ocorre
 *     via Web Share API (navigator.share com files) em navegadores que a
 *     suportem — na prática, celulares Android/iOS modernos.
 *   - O PDF gerado é RASTERIZADO (imagem do documento). Texto não fica
 *     selecionável. Para PDF vetorial, migrar para @react-pdf/renderer.
 *   - Descrições muito longas geram múltiplas páginas (paginação simples
 *     por recorte de imagem). Layouts muito altos podem ficar apertados.
 *
 * Definição de "margem":
 *   - "markup": PV = Custo * (1 + m)      "venda": PV = Custo / (1 - m)
 *
 * Convenções: estilos inline, paleta fixa, PT-BR. @media print em <style>.
 * -------------------------------------------------------------------------
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
  logoSrc: "/LOGO_OCENERGIA01.png", // em public/ (mesma origem -> html2canvas captura)
};

const COR = {
  primaria: "#1B3A6B",
  azul: "#2E86C1",
  amarelo: "#F39C12",
  laranja: "#E67E22",
  neutroClaro: "#F4F6F9",
  azulClaro: "#D5E8F3",
  cinza: "#475467",
  escuro: "#101828",
  sucesso: "#1E7E47",
  sucessoBg: "#E8F8F0",
  branco: "#FFFFFF",
  borda: "#D5E8F3",
};

type ModoMargem = "markup" | "venda";

const brl = (v: number): string =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number.isFinite(v) ? v : 0
  );

const dataPtBr = (d: Date): string =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(d);

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

// Estilos dinâmicos ficam FORA do objeto `styles` (que é Record<string, CSSProperties>
// e não pode conter funções). Devolvem CSSProperties calculado por estado.
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

  /** Renderiza o #orcamento-doc em um PDF A4 e devolve o Blob. */
  async function gerarPdfBlob(): Promise<Blob> {
    const el = document.getElementById("orcamento-doc");
    if (!el) throw new Error("Documento não encontrado na página.");

    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
    });

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;
    const imgData = canvas.toDataURL("image/png");

    // Paginação simples: desloca a mesma imagem para cima a cada página.
    let heightLeft = imgH;
    let position = 0;
    pdf.addImage(imgData, "PNG", 0, position, imgW, imgH);
    heightLeft -= pageH;
    while (heightLeft > 0) {
      position -= pageH;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgW, imgH);
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

  // === Ações ===
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

  /** Caminho "anexar de verdade": Web Share com arquivo (celular). Senão, baixa + WhatsApp texto. */
  const handleEnviarPdf = async (): Promise<void> => {
    setAviso(null);
    setGerando(true);
    try {
      const blob = await gerarPdfBlob();
      const file = new File([blob], nomeArquivo, { type: "application/pdf" });

      const nav = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean;
      };

      if (nav.canShare && nav.canShare({ files: [file] }) && typeof nav.share === "function") {
        await nav.share({
          files: [file],
          title: `Proposta nº ${numero}`,
          text: montarResumo(),
        });
      } else {
        // Desktop / sem suporte: baixa o PDF e abre o WhatsApp com o texto.
        baixarBlob(blob, nomeArquivo);
        setAviso("Seu dispositivo não anexa arquivo direto. Baixei o PDF — anexe-o na conversa do WhatsApp que vou abrir.");
        abrirWhatsAppTexto();
      }
    } catch (e) {
      // navigator.share lança se o usuário cancelar; tratamos como silencioso nesse caso.
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

  /** Envia o PDF anexado por e-mail via backend /api/enviar-orcamento. Requer deploy (vercel). */
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
    doc: { flex: "2 1 520px", minWidth: 360, background: COR.branco, border: `1px solid ${COR.borda}`, borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px rgba(16,24,40,0.06)" },
    cabecalho: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, padding: 24, background: COR.primaria, color: COR.branco },
    logo: { height: 56, objectFit: "contain", background: "transparent" },
    empresaInfo: { textAlign: "right", fontSize: 11, lineHeight: 1.5 },
    empresaNome: { fontSize: 14, fontWeight: 700, marginBottom: 2 },
    corpo: { padding: 24 },
    tituloDoc: { fontSize: 20, fontWeight: 700, color: COR.primaria, margin: "0 0 4px" },
    metaLinha: { display: "flex", justifyContent: "space-between", fontSize: 12, color: COR.cinza, borderBottom: `1px solid ${COR.borda}`, paddingBottom: 12, marginBottom: 16, flexWrap: "wrap", gap: 8 },
    blocoCliente: { background: COR.neutroClaro, borderRadius: 8, padding: "12px 14px", marginBottom: 16, fontSize: 13 },
    rotulo: { fontSize: 11, color: COR.cinza, textTransform: "uppercase", letterSpacing: 0.5 },
    descricaoBox: { whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.6, color: COR.escuro, marginBottom: 20, minHeight: 40 },
    totalBox: { background: COR.sucessoBg, border: `1px solid ${COR.sucesso}`, borderRadius: 10, padding: 20, textAlign: "right" },
    totalRotulo: { fontSize: 13, color: COR.cinza, marginBottom: 4 },
    totalValor: { fontSize: 24, fontWeight: 800, color: COR.sucesso },
    resumoInterno: { marginTop: 14, padding: "12px 14px", background: "#FFF8E1", border: `1px dashed ${COR.amarelo}`, borderRadius: 8 },
    resumoInternoTitulo: { fontSize: 11, fontWeight: 700, color: "#8A5A00", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4 },
    resumoInternoLinha: { display: "flex", justifyContent: "space-between", fontSize: 13, color: COR.escuro, padding: "3px 0" },
    rodape: { padding: "14px 24px", borderTop: `1px solid ${COR.borda}`, fontSize: 11, color: COR.cinza, textAlign: "center" },
    validade: { color: COR.laranja, fontWeight: 600, fontStyle: "italic" },
    acoes: { flex: "1 1 100%", display: "flex", flexWrap: "wrap", gap: 10 },
    notaAcoes: { flex: "1 1 100%", fontSize: 11, color: COR.cinza, lineHeight: 1.5, marginTop: 4 },
    avisoBox: { flex: "1 1 100%", padding: "10px 12px", background: "#FEF6E7", border: `1px solid ${COR.amarelo}`, borderRadius: 8, color: "#8A5A00", fontSize: 13 },
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

        {/* Resumo financeiro INTERNO — visível só na tela, nunca impresso/no PDF
            (o painel inteiro tem className="no-print"). Não vai para o cliente. */}
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
            <div style={styles.empresaNome}>{EMPRESA.razaoSocial}</div>
            <div>CNPJ: {EMPRESA.cnpj} &nbsp;|&nbsp; IE: {EMPRESA.ie}</div>
            <div>{EMPRESA.telefones.join("  •  ")}</div>
            <div>{EMPRESA.emails.join("  •  ")}</div>
          </div>
        </header>

        <div style={styles.corpo}>
          <h1 style={styles.tituloDoc}>Proposta / Orçamento</h1>
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
            <div style={styles.totalRotulo}>Valor total</div>
            <div style={styles.totalValor}>{brl(preco)}</div>
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
        <button type="button" style={estiloBtn(COR.primaria, gerando)} onClick={handleBaixarPdf} disabled={gerando}>
          {gerando ? "Gerando…" : "Baixar PDF"}
        </button>
        <button type="button" style={estiloBtn(COR.sucesso, gerando)} onClick={handleEnviarPdf} disabled={gerando}>
          {gerando ? "Gerando…" : "Enviar PDF (WhatsApp)"}
        </button>
        <button type="button" style={estiloBtn(COR.laranja, gerando)} onClick={handleEnviarEmailPdf} disabled={gerando}>
          {gerando ? "Gerando…" : "E-mail (PDF)"}
        </button>
        <button type="button" style={estiloBtn(COR.azul)} onClick={handleEmailTexto}>E-mail (texto)</button>
      </div>

      {aviso && <div style={styles.avisoBox} className="no-print">{aviso}</div>}

      <p style={styles.notaAcoes} className="no-print">
        "Enviar PDF (WhatsApp)" anexa o arquivo de verdade no <strong>celular</strong> (menu Compartilhar do sistema).
        No <strong>computador</strong>, o navegador não anexa por link: o PDF é baixado e o WhatsApp abre com o texto para você anexá-lo.
        "E-mail (PDF)" envia o anexo pelo servidor — <strong>só funciona no app publicado</strong> (a função da pasta api/ não roda no <code>vite dev</code> sozinho).
      </p>
    </div>
  );
}
