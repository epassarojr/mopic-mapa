// F7 — a página do mapa em PDF (decisão 8.1, só PDF): mapa em toda a altura e coluna à direita com título, legenda
// com a fonte de cada camada, localização e rodapé. A tabela das TIs selecionadas fica nas páginas seguintes.
import { BASEMAPS, CATALOGO, COR_IR_PARA, COR_RECORTE, DOMINIOS_MOPIC, FUNAI, PONTOS_MOPIC, temaDaCamada } from "./config/camadas.js";
import { TIPOS_RECORTE, calcularBounds, fmtHaConsulta, municipiosDasTIs, recorteAtual, situacaoNoRecorte, tisSelecionadas } from "./consultas.js";
import { estado } from "./estado.js";
import { barraDeEscala, limitesDaVista, renderizarQuadro, rotuloGrau } from "./impressao_mapa.js";
import { map } from "./mapa.js";
import { buscarJson, log } from "./nucleo.js";
import { desmatamentoAnoAte, desmatamentoAnoDe, desmatamentoAtivo, deterAtivo, deterSituacao, focosAnuaisAte, focosAnuaisAtivo, focosAnuaisDe, focosAtivo, focosSituacao, focosSoReferencia, mineracaoAtivo } from "./servicos.js";

export const TITULO_PADRAO = "Mapa Interativo Territorial — MOPIC";
const tituloDaImpressao = () => estado.tituloImpressao.trim() || TITULO_PADRAO;
const enderecoDoMapa = () => window.location.origin + window.location.pathname;

const PAGINA = { largura: 297, altura: 210 };
const MARGEM = 8;
const QUADRO = { x: MARGEM, y: MARGEM, largura: 216, altura: 194 };
const COLUNA = { x: 227, largura: 62 };
const LOCALIZACAO = { altura: 34, legenda: 3.5 };
const RODAPE_ALTURA = 13;
const TAMANHOS_LEGENDA = [8, 7.5, 7, 6.5];
const COLUNAS_CONTINUACAO = 4;
const FOLGA_ENQUADRAR_TIS_PX = 24;
const LIMIAR_AVISO_MUITAS_TIS = 25;
const COR = {
  texto: [76, 32, 32], textoSuave: [91, 76, 61], textoFraco: [118, 103, 87], accent: [52, 107, 31], accentForte: [41, 77, 24],
  fundoTabela: [250, 246, 238], borda: [205, 187, 160], grade: [70, 60, 50],
};
const NOME_MAPA_BASE = { osm: "OpenStreetMap", esri: "Esri World Imagery", sentinel: "Sentinel-2 cloudless 2025 (EOX)", bdgex: "BDGEx CTM Multiescalas" };

// ---------------------------------------------------------------
// Legenda: o que está ligado, por tema, com a fonte de cada camada.
// ---------------------------------------------------------------
// Retrato do mapa no clique: o PDF leva alguns segundos, e mexer na tela nesse meio-tempo não pode separar legenda e mapa.
function tirarRetrato() {
  const camadas = map.getStyle().layers.filter((l) => l.layout?.visibility !== "none");
  return {
    camadas: new Map(camadas.map((l) => [l.id, { min: l.minzoom ?? 0, max: l.maxzoom ?? Infinity, fonte: l.source }])),
    estado: { ...estado, fasesAnmAtivas: new Set(estado.fasesAnmAtivas) },
    zoomTela: map.getZoom(), mineracaoAtivo, desmatamentoAtivo, desmatamentoAnoDe, desmatamentoAnoAte, deterAtivo, deterSituacao,
    focosAtivo, focosSituacao, focosSoReferencia, focosAnuaisAtivo, focosAnuaisDe, focosAnuaisAte,
    tis: tisSelecionadas(), recorte: recorteAtual, rotuloRecorte: rotuloRecorte(), irPara: estado.irPara, base: estado.basemapAtual, titulo: tituloDaImpressao(),
  };
}

// Municípios têm uma camada para cada faixa de zoom: basta uma aparecer.
const CAMADA_ALTERNATIVA = { "municipios-line": "municipios-generalizado-line" };

// `zoom` é o do mapa impresso, não o da tela: camada que não se desenha nesse zoom não entra na legenda.
function contextoLegenda(r, zoom) {
  const desenhada = (id) => { const c = r.camadas.get(id); return Boolean(c) && zoom >= c.min && zoom < c.max; };
  return { ...r, zoom, visivel: (id) => desenhada(id) || desenhada(CAMADA_ALTERNATIVA[id]) };
}

const NOME_FONTE_E_VERSAO = (c) => `${c.fonte}, ${c.versao}`;
const itensDaEntrada = (c, ctx) => (c.itens ? c.itens(ctx) : ctx.visivel(c.camada) ? [{ label: c.rotulo, swatch: c.swatch }] : []);

function rotuloRecorte() {
  if (!recorteAtual) return "";
  const uf = recorteAtual.ref_uf && recorteAtual.tipo !== "uf" ? ` (${recorteAtual.ref_uf})` : "";
  return `Recorte: ${TIPOS_RECORTE[recorteAtual.tipo].rotulo} — ${recorteAtual.ref_nome}${uf}`;
}

const atribuicaoDaBase = (base) => { const b = BASEMAPS[base]; return b.atribuicaoImpressa ?? b.attribution.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&"); };
const contorno = (cor) => ({ tipo: "fill", cor: "#FFFFFF", borda: cor });

// Temas na ordem do painel; cada um com entradas { itens, fonte, nomeFonte }.
export function montarLegenda(r = tirarRetrato(), zoom = r.zoomTela) {
  const ctx = contextoLegenda(r, zoom);
  const temas = new Map([["Mapa base", [{ itens: [{ label: NOME_MAPA_BASE[r.base] ?? r.base, swatch: null }], fonte: atribuicaoDaBase(r.base) }]]]);
  const noTema = (tema, itens, fonte, nomeFonte) => {
    if (!temas.has(tema)) temas.set(tema, []);
    const entradas = temas.get(tema);
    // Camadas seguidas da mesma fonte citam a fonte uma vez só
    if (fonte && entradas.at(-1)?.fonte === fonte) entradas.at(-1).itens.push(...itens);
    else entradas.push({ itens, fonte, nomeFonte });
  };
  [...CATALOGO].sort((a, b) => temaDaCamada(a.camada).ordem - temaDaCamada(b.camada).ordem).forEach((c) => {
    const itens = itensDaEntrada(c, ctx);
    if (itens.length) noTema(temaDaCamada(c.camada).nome, itens, NOME_FONTE_E_VERSAO(c), c.fonte);
  });
  const funai = { fonte: NOME_FONTE_E_VERSAO(FUNAI), nomeFonte: FUNAI.fonte };
  if (r.tis.length) noTema("Consulta", [{ label: "Terras Indígenas selecionadas", swatch: contorno("#CC0E09") }], funai.fonte, funai.nomeFonte);
  if (ctx.visivel("ti-link-line") || ctx.visivel("ti-link-ponto")) noTema("Consulta", [{ label: "Terra Indígena indicada no link", swatch: contorno("#CC0E09") }], funai.fonte, funai.nomeFonte);
  if (r.recorte) noTema("Consulta", [{ label: r.rotuloRecorte, swatch: contorno(COR_RECORTE) }]);
  if (r.irPara) noTema("Consulta", [{ label: `Local indicado: ${r.irPara}`, swatch: contorno(COR_IR_PARA) }]);
  return [...temas].map(([nome, entradas]) => ({ nome, entradas }));
}

// Ligadas, mas sem desenho no zoom do mapa impresso
function camadasForaDaEscala(r, zoom) {
  const semZoom = contextoLegenda({ ...r, camadas: new Map([...r.camadas].map(([id, c]) => [id, { ...c, min: 0, max: Infinity }])) }, 99);
  const ctx = contextoLegenda(r, zoom);
  return CATALOGO.filter((c) => itensDaEntrada(c, semZoom).length && !itensDaEntrada(c, ctx).length).map((c) => rotuloSemFonte(c.rotulo, c.fonte));
}

function nomesDasFontes(ids, r) {
  const nomes = [...ids].map((id) => {
    if (id === "basemap") return NOME_MAPA_BASE[r.base] ?? "mapa base";
    if (id.startsWith("mapbiomas-")) return "MapBiomas";
    const camada = CATALOGO.find((c) => r.camadas.get(c.camada)?.fonte === id);
    return camada ? rotuloSemFonte(camada.rotulo, camada.fonte) : id;
  });
  return [...new Set(nomes)];
}

export const legendaPlana = () => montarLegenda().flatMap((t) => t.entradas.flatMap((e) => e.itens.map((i) => i.label)));
export const fontesDaLegenda = () => montarLegenda().flatMap((t) => t.entradas.map((e) => e.fonte).filter(Boolean));

// "Rios (IBGE, BC250)" vira "Rios": a fonte já vem logo abaixo. Parêntese que não é a fonte, como (101) ou (estimativa), fica.
export function rotuloSemFonte(rotulo, nomeFonte) {
  return rotulo.replace(/\s*\(([^)]+)\)/g, (tudo, dentro) => (nomeFonte?.includes(dentro.split(/[ ,/]/)[0]) ? "" : tudo));
}

// Noto Sans embutida, para as letras de línguas indígenas (ỹ, ũ, g̃) saírem certas: a fonte padrão do PDF não as tem.
// São recortes com os alfabetos latinos, cerca de 78 KB cada, e o PDF leva só as letras usadas. Sem os arquivos, o PDF
// ainda sai em Helvetica, e a letra de fora perde o diacrítico (ỹ vira y).
const FONTE_EMBUTIDA = "NotoSans";
const ARQUIVOS_FONTE = { normal: "fontes/NotoSans-Regular-mapa.ttf", bold: "fontes/NotoSans-Bold-mapa.ttf" };
const fonte = { nome: "helvetica" };
let fontesEmBase64 = null;

function paraBase64(bytes) {
  let binario = "";
  const bloco = 0x8000;
  for (let i = 0; i < bytes.length; i += bloco) binario += String.fromCharCode(...bytes.subarray(i, i + bloco));
  return btoa(binario);
}

async function carregarFontes() {
  fontesEmBase64 ??= await Promise.all(Object.entries(ARQUIVOS_FONTE).map(async ([estilo, url]) => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${url}: ${r.status}`);
    return { estilo, nomeArquivo: url.split("/").pop(), base64: paraBase64(new Uint8Array(await r.arrayBuffer())) };
  }));
  return fontesEmBase64;
}

async function prepararFontes(doc) {
  try {
    (await carregarFontes()).forEach(({ estilo, nomeArquivo, base64 }) => {
      doc.addFileToVFS(nomeArquivo, base64);
      doc.addFont(nomeArquivo, FONTE_EMBUTIDA, estilo);
    });
    fonte.nome = FONTE_EMBUTIDA;
  } catch (err) {
    fontesEmBase64 = null;
    fonte.nome = "helvetica";
    log("Fonte do PDF indisponível, usando a padrão: " + err.message);
  }
}

const FORA_DO_WINANSI = /[^\x20-\x7E\xA0-\xFF€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/gu;
const textoParaPdf = (texto) => {
  const t = String(texto).normalize("NFC");
  if (fonte.nome === FONTE_EMBUTIDA) return t;
  return t.replace(FORA_DO_WINANSI, (c) => {
    const base = c.normalize("NFD")[0];
    return base !== c && !base.match(FORA_DO_WINANSI) ? base : "?";
  });
};

// Mede a legenda num tamanho de letra: cada linha já com a quebra e a altura em milímetros.
function linhasDaLegenda(doc, temas, tamanho) {
  const entrelinha = (t) => t * 0.42;
  const quebrar = (texto, t, largura, negrito) => {
    doc.setFont(fonte.nome, negrito ? "bold" : "normal");
    doc.setFontSize(t);
    return doc.splitTextToSize(textoParaPdf(texto), largura);
  };
  const recuo = 5.5;
  const linhas = [];
  temas.forEach((tema, i) => {
    const texto = quebrar(tema.nome.toUpperCase(), tamanho - 0.5, COLUNA.largura, true);
    linhas.push({ tipo: "tema", texto, tamanho: tamanho - 0.5, altura: texto.length * entrelinha(tamanho - 0.5) + (i ? 1.6 : 0) + 0.6, antes: i ? 1.6 : 0 });
    tema.entradas.forEach((e) => {
      e.itens.forEach((item) => {
        const rotulo = rotuloSemFonte(item.label, e.nomeFonte);
        const q = quebrar(rotulo, tamanho, COLUNA.largura - recuo, false);
        linhas.push({ tipo: "item", texto: q, tamanho, swatch: item.swatch, altura: q.length * entrelinha(tamanho) + 0.5, antes: 0 });
      });
      if (e.fonte) {
        const q = quebrar(e.fonte, tamanho - 1.3, COLUNA.largura - recuo, false);
        linhas.push({ tipo: "fonte", texto: q, tamanho: tamanho - 1.3, altura: q.length * entrelinha(tamanho - 1.3) + 0.9, antes: 0 });
      }
    });
  });
  return linhas;
}

function desenharSwatch(doc, swatch, x, y) {
  doc.setLineWidth(0.2);
  doc.setFillColor(swatch.cor);
  doc.setDrawColor(swatch.borda ?? swatch.cor);
  if (swatch.tipo === "ponto") doc.circle(x + 1.8, y + 1.2, 1.1, "FD");
  else if (swatch.tipo === "losango") doc.lines([[1.5, 1.5], [-1.5, 1.5], [-1.5, -1.5]], x + 1.8, y - 0.3, [1, 1], "FD", true);
  else doc.rect(x, y, 3.8, 2.5, "FD");
}

function desenharLinhaLegenda(doc, linha, x, y) {
  const topo = y + linha.antes;
  const base = topo + linha.tamanho * 0.32;
  doc.setFontSize(linha.tamanho);
  if (linha.tipo === "tema") {
    doc.setFont(fonte.nome, "bold");
    doc.setTextColor(...COR.accentForte);
    doc.text(linha.texto, x, base);
  } else if (linha.tipo === "item") {
    doc.setFont(fonte.nome, "normal");
    if (linha.swatch) desenharSwatch(doc, linha.swatch, x, topo - 0.1);
    doc.setTextColor(...COR.texto);
    doc.text(linha.texto, x + 5.5, base);
  } else {
    doc.setFont(fonte.nome, "normal");
    doc.setTextColor(...COR.textoFraco);
    doc.text(linha.texto, x + 5.5, base);
  }
  return y + linha.altura;
}

// Onde pode quebrar: a fonte fica com a camada; título de tema ou de grupo, com o que vem depois.
function ajustarQuebra(linhas, i) {
  let q = i;
  while (q > 0 && (linhas[q]?.tipo === "fonte" || linhas[q - 1].tipo === "tema" || (linhas[q - 1].tipo === "item" && !linhas[q - 1].swatch))) q -= 1;
  return q;
}

// Primeira página na coluna; o que não couber, em colunas na página de continuação. Devolve quantas ficaram para depois.
function desenharLegenda(doc, temas, yInicio, yFim) {
  const disponivel = yFim - yInicio;
  let tamanho = TAMANHOS_LEGENDA[0];
  let linhas = linhasDaLegenda(doc, temas, tamanho);
  const total = (l) => l.reduce((s, x) => s + x.altura, 0);
  for (const t of TAMANHOS_LEGENDA) {
    tamanho = t;
    linhas = linhasDaLegenda(doc, temas, t);
    if (total(linhas) <= disponivel) break;
  }
  const cabe = total(linhas) <= disponivel;
  const reservaAviso = cabe ? 0 : 4;
  let medida = yInicio;
  let corte = 0;
  while (corte < linhas.length && medida + linhas[corte].altura <= yFim - reservaAviso) medida += linhas[corte++].altura;
  if (corte < linhas.length) corte = ajustarQuebra(linhas, corte);
  let y = yInicio;
  linhas.slice(0, corte).forEach((linha) => { y = desenharLinhaLegenda(doc, linha, COLUNA.x, y); });
  const resto = linhas.slice(corte);
  if (resto.length) {
    doc.setFont(fonte.nome, "bold");
    doc.setFontSize(7);
    doc.setTextColor(...COR.accentForte);
    doc.text("Legenda continua na página 2.", COLUNA.x, yFim - 0.8);
  }
  return { resto, tamanho };
}

function desenharContinuacaoLegenda(doc, resto) {
  doc.addPage();
  doc.setFont(fonte.nome, "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COR.accent);
  doc.text("Legenda (continuação)", MARGEM, MARGEM + 4);
  const larguraColuna = (PAGINA.largura - MARGEM * 2) / COLUNAS_CONTINUACAO;
  const topo = MARGEM + 9;
  const fim = PAGINA.altura - 12;
  let coluna = 0;
  let inicio = 0;
  while (inicio < resto.length) {
    let medida = topo;
    let corte = inicio;
    while (corte < resto.length && medida + resto[corte].altura <= fim) medida += resto[corte++].altura;
    if (corte < resto.length) corte = Math.max(ajustarQuebra(resto, corte), inicio + 1);
    let y = topo;
    resto.slice(inicio, corte).forEach((linha) => { y = desenharLinhaLegenda(doc, linha, MARGEM + coluna * larguraColuna, y); });
    inicio = corte;
    coluna += 1;
    if (coluna === COLUNAS_CONTINUACAO && inicio < resto.length) { doc.addPage(); coluna = 0; }
  }
}

// ---------------------------------------------------------------
// Elementos do mapa
// ---------------------------------------------------------------
const opacidade = (doc, valor) => doc.setGState(new doc.GState({ opacity: valor }));

function desenharGrade(doc, q) {
  const { x, y, largura, altura } = QUADRO;
  doc.setDrawColor(...COR.grade);
  doc.setLineWidth(0.12);
  opacidade(doc, 0.45);
  const verticais = q.meridianos.filter((m) => m.fracao > 0 && m.fracao < 1).map((m) => ({ ...m, pos: x + m.fracao * largura }));
  const horizontais = q.paralelos.filter((p) => p.fracao > 0 && p.fracao < 1).map((p) => ({ ...p, pos: y + p.fracao * altura }));
  verticais.forEach((m) => doc.line(m.pos, y, m.pos, y + altura));
  horizontais.forEach((p) => doc.line(x, p.pos, x + largura, p.pos));
  opacidade(doc, 1);
  doc.setFont(fonte.nome, "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...COR.texto);
  const etiqueta = (texto, cx, cy, vertical) => {
    const larguraTexto = doc.getTextWidth(texto);
    doc.setFillColor(255, 255, 255);
    opacidade(doc, 0.82);
    if (vertical) doc.rect(cx - 1.3, cy - larguraTexto - 0.5, 2.4, larguraTexto + 1, "F");
    else doc.rect(cx - larguraTexto / 2 - 0.5, cy - 1.3, larguraTexto + 1, 2.4, "F");
    opacidade(doc, 1);
    if (vertical) doc.text(texto, cx + 0.8, cy, { angle: 90 });
    else doc.text(texto, cx, cy + 0.8, { align: "center" });
  };
  verticais.forEach((m) => etiqueta(rotuloGrau(m.valor, "L", "O"), m.pos, y + 1.7, false));
  horizontais.forEach((p) => etiqueta(rotuloGrau(p.valor, "N", "S"), x + 1.7, p.pos + doc.getTextWidth(rotuloGrau(p.valor, "N", "S")) / 2, true));
}

// Rosa dos ventos de 8 pontas. O mapa impresso tem sempre o norte para cima.
function desenharRosa(doc, cx, cy) {
  const raio = 8.2;
  doc.setFillColor(255, 255, 255);
  opacidade(doc, 0.82);
  doc.circle(cx, cy, raio + 3.4, "F");
  opacidade(doc, 1);
  doc.setDrawColor(...COR.texto);
  doc.setLineWidth(0.15);
  const ponta = (angulo, comprimento, base) => {
    const a = (angulo * Math.PI) / 180;
    const tx = cx + Math.sin(a) * comprimento;
    const ty = cy - Math.cos(a) * comprimento;
    const lx = cx + Math.cos(a) * base;
    const ly = cy + Math.sin(a) * base;
    const rx = cx - Math.cos(a) * base;
    const ry = cy - Math.sin(a) * base;
    doc.setFillColor(...COR.texto);
    doc.triangle(cx, cy, tx, ty, rx, ry, "FD");
    doc.setFillColor(255, 255, 255);
    doc.triangle(cx, cy, tx, ty, lx, ly, "FD");
  };
  [45, 135, 225, 315].forEach((a) => ponta(a, raio * 0.62, 1.1));
  [0, 90, 180, 270].forEach((a) => ponta(a, raio, 1.5));
  doc.setFont(fonte.nome, "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...COR.texto);
  doc.text("N", cx, cy - raio - 0.6, { align: "center" });
  doc.text("S", cx, cy + raio + 2.6, { align: "center" });
  doc.text("L", cx + raio + 1.8, cy + 0.9, { align: "center" });
  doc.text("O", cx - raio - 1.8, cy + 0.9, { align: "center" });
}

function desenharEscala(doc, q) {
  const barra = barraDeEscala(q.metrosPorMm);
  const segmentos = 4;
  const largura = Math.max(barra.mm + 16, 64);
  const altura = 13;
  const x = QUADRO.x + 3;
  const y = QUADRO.y + QUADRO.altura - altura - 3;
  doc.setFillColor(255, 255, 255);
  opacidade(doc, 0.88);
  doc.rect(x, y, largura, altura, "F");
  opacidade(doc, 1);
  doc.setFont(fonte.nome, "bold");
  doc.setFontSize(8);
  doc.setTextColor(...COR.texto);
  doc.text(`1:${q.denominador.toLocaleString("pt-BR")}`, x + 2, y + 3.6);
  const yBarra = y + 5;
  const passo = barra.mm / segmentos;
  doc.setDrawColor(...COR.texto);
  doc.setLineWidth(0.2);
  for (let i = 0; i < segmentos; i++) {
    if (i % 2 === 0) doc.setFillColor(...COR.texto); else doc.setFillColor(255, 255, 255);
    doc.rect(x + 2 + i * passo, yBarra, passo, 1.8, "FD");
  }
  doc.setFont(fonte.nome, "normal");
  doc.setFontSize(6.5);
  doc.text(barra.rotulo, x + 2 + barra.mm + 1.2, yBarra + 1.6);
  doc.setFontSize(5.5);
  doc.setTextColor(...COR.textoSuave);
  doc.text("Escala na latitude central, com o PDF em tamanho real (100%).", x + 2, y + altura - 2.2);
}

// ---------------------------------------------------------------
// Coluna: logo, título, localização e rodapé
// ---------------------------------------------------------------
// O PNG tem margens transparentes: sem elas, o logo cresce e ocupa a mesma altura de antes na coluna.
const RECORTE_LOGO = { x: 138, y: 378, largura: 4088, altura: 1274 };
const LARGURA_LOGO_PX = 1000;
const LARGURA_LOGO_MM = 44.5;
let logoPdf = null;
async function carregarLogo() {
  if (logoPdf) return logoPdf;
  const img = new Image();
  img.src = "mopic_logo.png";
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = LARGURA_LOGO_PX;
  canvas.height = Math.round((LARGURA_LOGO_PX * RECORTE_LOGO.altura) / RECORTE_LOGO.largura);
  canvas.getContext("2d").drawImage(img, RECORTE_LOGO.x, RECORTE_LOGO.y, RECORTE_LOGO.largura, RECORTE_LOGO.altura, 0, 0, canvas.width, canvas.height);
  logoPdf = { dataUrl: canvas.toDataURL("image/png"), proporcao: canvas.height / canvas.width };
  return logoPdf;
}

const mercatorY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * (180 / Math.PI);

function desenharLocalizacao(doc, contornos, q, y) {
  const LIMITES = { oeste: -74.2, leste: -34.5, sul: mercatorY(-33.9), norte: mercatorY(5.4) };
  const escala = Math.min(COLUNA.largura / (LIMITES.leste - LIMITES.oeste), LOCALIZACAO.altura / (LIMITES.norte - LIMITES.sul));
  const x0 = COLUNA.x + (COLUNA.largura - (LIMITES.leste - LIMITES.oeste) * escala) / 2;
  const px = (lon) => x0 + (lon - LIMITES.oeste) * escala;
  const py = (lat) => y + (LIMITES.norte - mercatorY(lat)) * escala;
  const anel = (pontos, estilo) => {
    const p = pontos.map(([lon, lat]) => [px(lon), py(lat)]);
    doc.lines(p.slice(1).map((v, i) => [v[0] - p[i][0], v[1] - p[i][1]]), p[0][0], p[0][1], [1, 1], estilo, true);
  };
  doc.setLineWidth(0.1);
  doc.setFillColor(238, 232, 220);
  doc.setDrawColor(150, 135, 115);
  contornos.estados.forEach((a) => anel(a, "FD"));
  doc.setFillColor(200, 214, 150);
  contornos.cerrado.forEach((a) => anel(a, "F"));
  doc.setDrawColor(190, 178, 158);
  contornos.estados.forEach((a) => anel(a, "S"));
  doc.setLineWidth(0.25);
  doc.setDrawColor(...COR.textoSuave);
  contornos.brasil.forEach((a) => anel(a, "S"));
  // Área impressa, nunca menor que um retângulo visível
  const r = { x1: px(q.limites.oeste), x2: px(q.limites.leste), y1: py(q.limites.norte), y2: py(q.limites.sul) };
  const lado = 2;
  const largura = Math.max(r.x2 - r.x1, lado);
  const altura = Math.max(r.y2 - r.y1, lado);
  const x = Math.max((r.x1 + r.x2) / 2 - largura / 2, COLUNA.x);
  const yr = Math.max((r.y1 + r.y2) / 2 - altura / 2, y);
  doc.setLineWidth(0.45);
  doc.setDrawColor(204, 14, 9);
  doc.rect(x, yr, Math.min(largura, COLUNA.x + COLUNA.largura - x), Math.min(altura, y + LOCALIZACAO.altura - yr), "S");
  doc.setFont(fonte.nome, "normal");
  doc.setFontSize(6);
  doc.setTextColor(...COR.textoFraco);
  doc.text("Localização: área impressa em vermelho; Cerrado em verde.", COLUNA.x, y + LOCALIZACAO.altura + 2.6);
}

function desenharRodape(doc, geradoEm) {
  const y = PAGINA.altura - MARGEM - RODAPE_ALTURA + 3;
  doc.setDrawColor(...COR.borda);
  doc.setLineWidth(0.2);
  doc.line(COLUNA.x, y - 2.6, COLUNA.x + COLUNA.largura, y - 2.6);
  doc.setFont(fonte.nome, "normal");
  doc.setFontSize(6.3);
  doc.setTextColor(...COR.textoFraco);
  doc.text(doc.splitTextToSize(`Gerado em ${geradoEm} · ${enderecoDoMapa()}`, COLUNA.largura), COLUNA.x, y);
}

// ---------------------------------------------------------------
// Páginas seguintes: tabela das TIs selecionadas
// ---------------------------------------------------------------
const ROTULO_CATEGORIA = Object.fromEntries([...DOMINIOS_MOPIC, ...PONTOS_MOPIC].map((c) => [c.categoria, c.rotulo]));

function valoresDaTabela(r, categorias, municipios) {
  const categoria = ROTULO_CATEGORIA[categorias?.[r.props.mopic_id]?.categoria] ?? "—";
  const v = [r.props.terrai_nome, categoria, r.props.etnia_nome ?? "—", r.props.uf_sigla, municipios.get(r.props.mopic_id)?.join(", ") || "—", r.props.fase_ti ?? "—", fmtHaConsulta(r.props.area_ha)];
  if (recorteAtual) v.push(situacaoNoRecorte(r) || "—");
  return v;
}

function desenharCabecalhoTabela(doc, colunas, y) {
  const largura = colunas.reduce((s, c) => s + c.largura, 0);
  doc.setFillColor(...COR.fundoTabela);
  doc.rect(MARGEM, y - 5, largura, 7, "F");
  doc.setFont(fonte.nome, "bold");
  doc.setFontSize(8);
  doc.setTextColor(...COR.accentForte);
  let x = MARGEM;
  colunas.forEach((c) => { doc.text(c.titulo, x + 1.5, y - 0.5); x += c.largura; });
  doc.setDrawColor(...COR.borda);
  doc.line(MARGEM, y + 2, MARGEM + largura, y + 2);
  doc.setFont(fonte.nome, "normal");
  return y + 6;
}

function desenharTabela(doc, selecionados, categorias, municipios) {
  doc.addPage();
  let y = MARGEM + 4;
  doc.setFont(fonte.nome, "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COR.accent);
  doc.text(`Terras Indígenas selecionadas (${selecionados.length})`, MARGEM, y);
  y += 5;
  if (recorteAtual) {
    doc.setFont(fonte.nome, "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...COR.texto);
    doc.text(textoParaPdf(rotuloRecorte()), MARGEM, y);
    y += 5;
  }
  doc.setFont(fonte.nome, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...COR.textoFraco);
  doc.text(textoParaPdf(`Fontes: ${FUNAI.fonte}, ${FUNAI.versao}; municípios por cruzamento com a malha do IBGE, 2025.`), MARGEM, y);
  y += 2;
  const colunas = recorteAtual
    ? [["TERRA INDÍGENA", 50], ["CATEGORIA", 34], ["ETNIA", 36], ["UF", 11], ["MUNICÍPIOS", 50], ["FASE", 32], ["ÁREA (HA)", 24], ["NO RECORTE", 44]]
    : [["TERRA INDÍGENA", 58], ["CATEGORIA", 38], ["ETNIA", 46], ["UF", 12], ["MUNICÍPIOS", 62], ["FASE", 38], ["ÁREA (HA)", 27]];
  const colunasTabela = colunas.map(([titulo, largura]) => ({ titulo, largura }));
  const limite = PAGINA.altura - 12;
  y = desenharCabecalhoTabela(doc, colunasTabela, y + 5);
  doc.setFontSize(8);
  selecionados.forEach((r) => {
    // A linha cresce com o texto: cortar célula apagava a segunda fase ("Regularizada; Declarada") e parte das etnias.
    const celulas = valoresDaTabela(r, categorias, municipios).map((valor, i) => doc.splitTextToSize(textoParaPdf(valor), colunasTabela[i].largura - 3));
    const altura = Math.max(6, Math.max(...celulas.map((c) => c.length)) * 3.3 + 2.7);
    if (y + altura > limite) {
      doc.addPage();
      y = desenharCabecalhoTabela(doc, colunasTabela, MARGEM + 7);
      doc.setFontSize(8);
    }
    doc.setTextColor(...COR.texto);
    let x = MARGEM;
    celulas.forEach((linhas, i) => { doc.text(linhas, x + 1.5, y); x += colunasTabela[i].largura; });
    y += altura;
  });
}

// ---------------------------------------------------------------
// A página
// ---------------------------------------------------------------
export const extensaoEfetiva = () => (estado.extensaoImpressao === "tis" && tisSelecionadas().length ? "tis" : "atual");

async function gerarDocumento() {
  const r = tirarRetrato();
  const selecionados = r.tis;
  const noTis = extensaoEfetiva() === "tis";
  const limites = noTis ? calcularBounds(selecionados.map((r) => r.geometry)) : limitesDaVista();
  const q = await renderizarQuadro(limites, QUADRO.largura, QUADRO.altura, noTis ? FOLGA_ENQUADRAR_TIS_PX : 0);

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  await prepararFontes(doc);
  const geradoEm = new Date().toLocaleString("pt-BR");

  doc.addImage(q.imagem, "JPEG", QUADRO.x, QUADRO.y, QUADRO.largura, QUADRO.altura);
  desenharGrade(doc, q);
  doc.setDrawColor(...COR.texto);
  doc.setLineWidth(0.3);
  doc.rect(QUADRO.x, QUADRO.y, QUADRO.largura, QUADRO.altura, "S");
  desenharRosa(doc, QUADRO.x + QUADRO.largura - 15, QUADRO.y + 15);
  desenharEscala(doc, q);

  // Sem o logo o PDF ainda sai: a falta dele não pode impedir a pessoa de levar o mapa.
  const logo = await carregarLogo().catch((err) => { log("Logo indisponível no PDF: " + err.message); return null; });
  let y = MARGEM;
  if (logo) {
    doc.addImage(logo.dataUrl, "PNG", COLUNA.x + (COLUNA.largura - LARGURA_LOGO_MM) / 2, y, LARGURA_LOGO_MM, LARGURA_LOGO_MM * logo.proporcao);
    y += LARGURA_LOGO_MM * logo.proporcao + 2.5;
  }
  doc.setFont(fonte.nome, "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(...COR.accent);
  const titulo = doc.splitTextToSize(textoParaPdf(r.titulo), COLUNA.largura);
  doc.text(titulo, COLUNA.x, y + 3.2);
  y += titulo.length * 4.9 + 2.2;
  doc.setDrawColor(...COR.borda);
  doc.setLineWidth(0.2);
  doc.line(COLUNA.x, y, COLUNA.x + COLUNA.largura, y);
  y += 2;

  // O que o leitor precisa saber antes de concluir que algo não existe na área
  const semResposta = nomesDasFontes(q.fontesComFalha, r);
  const foraDaEscala = camadasForaDaEscala(r, q.zoom);
  const avisos = [
    ...(semResposta.length ? [`Sem resposta do serviço: ${semResposta.join(", ")}. O mapa pode estar incompleto.`] : []),
    ...(!q.completo && !semResposta.length ? ["Algum serviço não respondeu a tempo. O mapa pode estar incompleto."] : []),
    ...(foraDaEscala.length ? [`Ligadas, mas sem desenho nesta escala: ${foraDaEscala.join(", ")}.`] : []),
  ];
  if (avisos.length) {
    doc.setFont(fonte.nome, "bold");
    doc.setFontSize(7);
    doc.setTextColor(177, 18, 18);
    avisos.forEach((aviso) => {
      const linhas = doc.splitTextToSize(textoParaPdf(aviso), COLUNA.largura);
      doc.text(linhas, COLUNA.x, y + 2.4);
      y += linhas.length * 3 + 0.8;
    });
    y += 1;
  }

  const contornos = await buscarJson("dados/localizacao_brasil.json").catch((err) => { log("Mapa de localização indisponível: " + err.message); return null; });
  const yRodape = PAGINA.altura - MARGEM - RODAPE_ALTURA;
  const alturaLocal = contornos ? LOCALIZACAO.altura + LOCALIZACAO.legenda + 1.5 : 0;
  const yFimLegenda = yRodape - alturaLocal;
  const { resto } = desenharLegenda(doc, montarLegenda(r, q.zoom), y, yFimLegenda);
  if (contornos) desenharLocalizacao(doc, contornos, q, yFimLegenda + 1.5);
  desenharRodape(doc, geradoEm);

  if (resto.length) desenharContinuacaoLegenda(doc, resto);
  if (selecionados.length) {
    // Faltando um dado de apoio, a tabela sai com "—" naquela coluna, sem impedir o PDF.
    const categorias = await buscarJson("dados/tis_mopic_indice.json").catch((err) => { log("Categorias indisponíveis no PDF: " + err.message); return null; });
    const municipios = await municipiosDasTIs(selecionados.map((r) => r.props.mopic_id)).catch((err) => { log("Municípios indisponíveis no PDF: " + err.message); return new Map(); });
    desenharTabela(doc, selecionados, categorias, municipios);
  }

  const total = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= total; pagina++) {
    doc.setPage(pagina);
    doc.setFont(fonte.nome, "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...COR.textoFraco);
    if (pagina > 1) doc.text(`${geradoEm} · ${enderecoDoMapa()}`, MARGEM, PAGINA.altura - 5);
    doc.text(`Página ${pagina} de ${total}`, PAGINA.largura - MARGEM, PAGINA.altura - 5, { align: "right" });
  }
  return { doc, q, avisos, muitas: selecionados.length > LIMIAR_AVISO_MUITAS_TIS ? selecionados.length : 0 };
}

const situacao = ({ avisos, muitas }, feito) => [feito, muitas ? `Com ${muitas} TIs, a tabela ocupa várias páginas.` : "", ...avisos].filter(Boolean).join(" ");

export async function baixarPDF() {
  const r = await gerarDocumento();
  r.doc.save(`mapa-mopic-${Date.now()}.pdf`);
  return situacao(r, "PDF baixado.");
}

// Abre a janela já no clique: depois da espera, o navegador a bloquearia.
export async function imprimir() {
  const janela = window.open("", "_blank");
  janela?.document.write("<title>Mapa MOPIC</title><p style='font:16px sans-serif'>Gerando o PDF…</p>");
  try {
    const r = await gerarDocumento();
    if (!janela) {
      r.doc.save(`mapa-mopic-${Date.now()}.pdf`);
      return situacao(r, "O navegador bloqueou a nova aba: o PDF foi baixado.");
    }
    janela.location.href = URL.createObjectURL(r.doc.output("blob"));
    return situacao(r, "PDF aberto em nova aba. Para imprimir, use o tamanho real (100%).");
  } catch (err) {
    janela?.close();
    throw err;
  }
}
