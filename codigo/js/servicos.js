// Camadas de pressão (PRODES, DETER, ANM, focos) e consultas por ponto a serviços.
import { ANO_MAX_PRODES, ANO_PADRAO_PRODES, ARQUIVOS_PRODES, COR_DETER, COR_FOCOS, FOCOS_ANUAIS, DOMINIOS_MOPIC_DE_BAIXO_PRA_CIMA, FASES_ANM, MINZOOM_ANM, PERIODOS_PRODES, RENDERER_ANM, REST_ANM, SATELITE_REFERENCIA, URL_DETER, URL_FOCOS_DIARIOS, ZOOMS_FOCOS_ANUAIS, ZOOMS_PRODES } from "./config/camadas.js";
import { estado } from "./estado.js";
import { map, reiniciarFonte } from "./mapa.js";
import { TIMEOUT_GETFEATUREINFO_MS, log, paraMercator, sinalComTimeout, unicas } from "./nucleo.js";

export let desmatamentoAtivo = false;
export let desmatamentoAnoDe = ANO_PADRAO_PRODES;
export let desmatamentoAnoAte = ANO_MAX_PRODES;

// Até o teste 8, esta variável guardava a última TI clicada no mapa e
// alimentava a impressão. A partir do teste 9 a impressão passou a
// usar os resultados marcados na busca (ver resultadosBusca mais
// abaixo) — removida daqui; o clique no mapa continua só abrindo o
// popup informativo.

// Teste 18 — camadas raster de pressões entram logo abaixo das TIs (a
// primeira que existir, de baixo para cima), para o contorno das TIs, os
// limites e o resultado da busca continuarem visíveis. Antes entravam no
// topo de tudo.
const camadaAcimaDasPressoes = () =>
  ["tis-fill", ...DOMINIOS_MOPIC_DE_BAIXO_PRA_CIMA.map((d) => `tis-mopic-${d.id}-fill`), "subbacias-fill"].find((id) => map.getLayer(id));

// N4 — ligadas antes do load, entram sobre o mapa base e ficariam sob as camadas criadas depois.
export function reposicionarPressoes() {
  const antes = camadaAcimaDasPressoes();
  ["mineracao-anm", ...idsDesmatamento()].forEach((id) => {
    if (map.getLayer(id)) map.moveLayer(id, antes);
  });
  posicionarAcimaDasTIs();
}

// A URL direta dos tiles, com os zooms da config, não lê o cabeçalho de cada arquivo.
export const fonteProdes = (arquivo) => ({ type: "vector", tiles: [`pmtiles://dados/${arquivo}/{z}/{x}/{y}`], ...ZOOMS_PRODES, attribution: "INPE, PRODES Cerrado" });
export const idsDesmatamento = () => (map.getStyle()?.layers ?? []).map((l) => l.id).filter((id) => id.startsWith("desmatamento-"));

export function aplicarCamadaDesmatamento(anoDe, anoAte) {
  desmatamentoAtivo = true;
  desmatamentoAnoDe = anoDe;
  desmatamentoAnoAte = anoAte;
  removerFontesDesmatamento();
  const filtro = ["all", [">=", ["get", "ano"], anoDe], ["<=", ["get", "ano"], anoAte]];
  const cor = ["match", ["get", "ano"], ...PERIODOS_PRODES.flatMap((p) => [p.ano, p.cor]), "#C9502F"];
  // Só os arquivos do intervalo pedido: os outros não custam nada
  ARQUIVOS_PRODES.forEach((a, i) => {
    if (a.ate < anoDe || a.de > anoAte) return;
    const id = `desmatamento-${i}`;
    reiniciarFonte(id);
    map.addSource(id, fonteProdes(a.arquivo));
    map.addLayer({ id, type: "fill", source: id, "source-layer": "prodes", filter: filtro, paint: { "fill-color": cor, "fill-opacity": 0.85 } }, camadaAcimaDasPressoes());
  });
  posicionarAcimaDasTIs();
  log(`Desmatamento PRODES Cerrado: ${anoDe}–${anoAte}`);
}

function removerFontesDesmatamento() {
  idsDesmatamento().forEach((id) => {
    map.removeLayer(id);
    map.removeSource(id);
  });
}

// "Voltar ao inicial": anos e opções como o mapa abriu, com as camadas desligadas ou não.
export const parametrosDasPressoes = () => ({ desmatamentoAnoDe, desmatamentoAnoAte, focosAnuaisDe, focosAnuaisAte, focosSoReferencia, fasesAnm: new Set(estado.fasesAnmAtivas) });
export function restaurarParametrosDasPressoes(p) {
  ({ desmatamentoAnoDe, desmatamentoAnoAte, focosAnuaisDe, focosAnuaisAte, focosSoReferencia } = p);
  estado.fasesAnmAtivas = new Set(p.fasesAnm);
}

export function removerCamadaDesmatamento() {
  desmatamentoAtivo = false;
  removerFontesDesmatamento();
}

export let mineracaoAtivo = false;
// Famílias expandidas no painel; todas começam recolhidas.
export const familiasAnmAbertas = new Set();

// Filtro SQL das fases marcadas (null = todas, sem filtro). Os valores
// vêm de FASES_ANM, não do usuário; mesmo assim o apóstrofo é dobrado.
function montarFiltroFasesAnm() {
  if (estado.fasesAnmAtivas.size === FASES_ANM.length) return null;
  return `FASE IN (${[...estado.fasesAnmAtivas].map((v) => `'${v.replace(/'/g, "''")}'`).join(",")})`;
}

function montarUrlMineracao() {
  const filtro = montarFiltroFasesAnm();
  const camada = { id: 0, source: { type: "mapLayer", mapLayerId: 0 }, drawingInfo: { renderer: RENDERER_ANM } };
  if (filtro) camada.definitionExpression = filtro;
  return `${REST_ANM}/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256` +
    `&format=png32&transparent=true&f=image&dynamicLayers=${encodeURIComponent(JSON.stringify([camada]))}`;
}

export function aplicarCamadaMineracao() {
  mineracaoAtivo = true;
  if (map.getLayer("mineracao-anm")) map.removeLayer("mineracao-anm");
  if (map.getSource("mineracao-anm")) map.removeSource("mineracao-anm");
  // Nenhuma fase marcada: camada "ligada", mas nada a desenhar.
  if (!estado.fasesAnmAtivas.size) { log("Processos minerários ANM: nenhuma fase marcada"); return; }
  reiniciarFonte("mineracao-anm");
  map.addSource("mineracao-anm", { type: "raster", tiles: [montarUrlMineracao()], tileSize: 256, attribution: "ANM — SIGMINE" });
  const antes = camadaAcimaDasPressoes();
  map.addLayer({ id: "mineracao-anm", type: "raster", source: "mineracao-anm", minzoom: MINZOOM_ANM, paint: { "raster-opacity": 0.7 } }, antes);
  posicionarAcimaDasTIs();
  log(`Processos minerários ANM: ${estado.fasesAnmAtivas.size}/${FASES_ANM.length} fases (${montarFiltroFasesAnm() || "sem filtro"})`);
}

export function removerCamadaMineracao() {
  mineracaoAtivo = false;
  if (map.getLayer("mineracao-anm")) map.removeLayer("mineracao-anm");
  if (map.getSource("mineracao-anm")) map.removeSource("mineracao-anm");
}

// Processos da ANM sob o clique (REST query, envelope de 9×9 px como no
// GetFeatureInfo). Devolve [{ properties }].
export async function consultarAnmNoPonto(e) {
  const buf = 4;
  const a = map.unproject([e.point.x - buf, e.point.y - buf]);
  const b = map.unproject([e.point.x + buf, e.point.y + buf]);
  const params = new URLSearchParams({
    geometry: [a.lng, b.lat, b.lng, a.lat].join(","), geometryType: "esriGeometryEnvelope", inSR: "4326",
    spatialRel: "esriSpatialRelIntersects", where: montarFiltroFasesAnm() || "1=1",
    outFields: "PROCESSO,FASE,SUBS,USO,AREA_HA,UF,ULT_EVENTO", returnGeometry: "false", f: "json",
  });
  const json = await consultarServico(`${REST_ANM}/0/query?${params}`);
  if (json.error) throw new Error(json.error.message || "erro do serviço");
  return unicas((json.features || []).map((f) => ({ properties: f.attributes })), (f) => f.properties.PROCESSO);
}

// Teste 18 (M3) — sem timeout, um serviço que não responde deixava o popup em "Consultando…" para
// sempre. N6 — o timeout cobre também a leitura do corpo, e o usuário nunca vê o corpo de um erro.
async function consultarServico(url) {
  try {
    const resp = await fetch(url, { signal: sinalComTimeout(TIMEOUT_GETFEATUREINFO_MS) });
    const texto = await resp.text();
    if (!resp.ok) {
      log(`HTTP ${resp.status} em ${url}: ${texto.slice(0, 200)}`);
      throw new Error(`serviço indisponível (HTTP ${resp.status})`);
    }
    try {
      return JSON.parse(texto);
    } catch {
      log(`Resposta inválida de ${url}: ${texto.slice(0, 200)}`);
      throw new Error("o serviço devolveu uma resposta inválida");
    }
  } catch (err) {
    // TimeoutError (AbortSignal.timeout) ou AbortError (fallback com AbortController).
    if (err?.name === "TimeoutError" || err?.name === "AbortError") throw new Error(`o serviço não respondeu em ${TIMEOUT_GETFEATUREINFO_MS / 1000} s`);
    throw err;
  }
}


// Decisão 5.4 — focos de calor das últimas 48 h. Baixa os CSVs só ao ligar, e uma resposta atrasada de
// quem já desligou não reacende a camada.
// O painel pode ter aberto depois do pedido, como num link com a camada ligada: a situação vai direto para ele.
function mostrarSituacao(id, texto) {
  const el = document.getElementById(id);
  if (el) el.textContent = texto;
  return texto;
}

const HORAS_FOCOS = 48;
const TIMEOUT_FOCOS_MS = 30000;
const DIAS_FOCOS = 3; // 48 h tocam até três datas
export let focosAtivo = false;
// "carregando", "ok" ou "falha": a legenda do PDF não pode sugerir ausência de fogo sem ter os dados.
export let focosSituacao = "carregando";
export let focosSoReferencia = false;
export let focosResumo = "";
let focosDados = [];
let focosPedido = 0;

function urlsFocos(agora) {
  return Array.from({ length: DIAS_FOCOS }, (_, i) => {
    const d = new Date(agora - i * 86400000).toISOString().slice(0, 10).replaceAll("-", "");
    return `${URL_FOCOS_DIARIOS}${d}.csv`;
  });
}

// CSV simples do INPE, sem aspas nos campos usados.
export function lerCsvFocos(texto, limiteMs) {
  const linhas = texto.split(/\r?\n/);
  const nomes = linhas[0].split(",");
  const coluna = Object.fromEntries(nomes.map((n, i) => [n.trim(), i]));
  // Página de manutenção ou formato novo responde 200: sem estas colunas, não é um arquivo de focos
  if (!["data_hora_gmt", "lat", "lon"].every((c) => c in coluna)) throw new Error("formato do arquivo de focos não reconhecido");
  const focos = [];
  for (let i = 1; i < linhas.length; i++) {
    if (!linhas[i]) continue;
    const c = linhas[i].split(",");
    const quando = Date.parse(`${c[coluna.data_hora_gmt]?.replace(" ", "T")}Z`);
    const lat = Number(c[coluna.lat]);
    const lon = Number(c[coluna.lon]);
    if (!(quando >= limiteMs) || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    focos.push({ type: "Feature", geometry: { type: "Point", coordinates: [lon, lat] }, properties: {
      quando: c[coluna.data_hora_gmt], satelite: c[coluna.satelite], municipio: c[coluna.municipio], estado: c[coluna.estado], bioma: c[coluna.bioma],
    } });
  }
  return focos;
}

// Pedido do projeto: o preenchimento das TIs não esconde as pressões. Contornos e pontos das TIs e o
// contorno do bioma ficam por cima, para dar para ver onde cada área termina.
function posicionarAcimaDasTIs() {
  if (!map.getLayer("subbacias-fill")) return;
  const ids = map.getStyle().layers.map((l) => l.id);
  const prodesFixo = ids.filter((id) => id.startsWith("prodes-"));
  const periodos = ids.filter((id) => id.startsWith("desmatamento-"));
  const servicos = ["mineracao-anm"].filter((id) => map.getLayer(id));
  const deter = ["deter-fill", "deter-line"].filter((id) => map.getLayer(id));
  const focosAnuais = ids.filter((id) => id.startsWith("focos-ano-"));
  const limites = ids.filter((id) => /^tis-.*(-line|-ponto)$/.test(id) || id === "biomas-line");
  const energia = ids.filter((id) => /^(lt-|se-|usinas-|rod-|fer-|anp-gasodutos|anp-pocos)(?!.*-rotulo$)/.test(id));
  const mineracao = ids.filter((id) => /^(min-|anp-blocos|anp-campos)/.test(id));
  [...prodesFixo, ...mineracao, ...servicos, ...periodos, ...deter, ...limites, ...focosAnuais, ...energia].forEach((id) => map.moveLayer(id, "subbacias-fill"));
  posicionarFocos();
}

function posicionarFocos() {
  if (map.getLayer("focos-48h") && map.getLayer("subbacias-fill")) map.moveLayer("focos-48h", "subbacias-fill");
}

function desenharFocos() {
  const lista = focosSoReferencia ? focosDados.filter((f) => f.properties.satelite === SATELITE_REFERENCIA) : focosDados;
  const dados = { type: "FeatureCollection", features: lista };
  if (map.getSource("focos-48h")) map.getSource("focos-48h").setData(dados);
  else {
    map.addSource("focos-48h", { type: "geojson", data: dados, attribution: "INPE, Programa Queimadas" });
    // Acima das TIs: um foco dentro de uma TI não pode ficar encoberto
    map.addLayer({ id: "focos-48h", type: "circle", source: "focos-48h",
      paint: { "circle-color": COR_FOCOS.cor, "circle-stroke-color": COR_FOCOS.borda, "circle-stroke-width": 0.5, "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 1.6, 8, 3, 12, 5] } });
    posicionarFocos();
  }
  return lista.length;
}

// Devolve o texto de situação para o painel.
export async function aplicarCamadaFocos() {
  focosAtivo = true;
  focosSituacao = "carregando";
  const pedido = ++focosPedido;
  focosResumo = "Consultando o INPE…";
  const agora = Date.now();
  const limite = agora - HORAS_FOCOS * 3600000;
  const respostas = await Promise.allSettled(urlsFocos(agora).map(async (url) => {
    const r = await fetch(url, { signal: sinalComTimeout(TIMEOUT_FOCOS_MS) });
    // O arquivo do dia pode ainda não existir: isso não é falha do serviço
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.text();
  }));
  if (pedido !== focosPedido || !focosAtivo) return focosResumo;
  const lidos = respostas.map((r) => {
    if (r.status === "rejected") return { erro: r.reason };
    if (r.value === null) return { ausente: true };
    try {
      return { focos: lerCsvFocos(r.value, limite) };
    } catch (erro) {
      return { erro };
    }
  });
  const validos = lidos.filter((l) => l.focos);
  const falhas = lidos.filter((l) => l.erro);
  // Um 404 é o arquivo do dia ainda por sair; nenhum arquivo legível é o serviço fora, não "0 focos"
  if (!validos.length) {
    log(`Focos 48 h indisponíveis: ${falhas[0]?.erro?.message || "nenhum arquivo encontrado"}`);
    focosSituacao = "falha";
    focosDados = [];
    focosResumo = "Serviço do INPE indisponível no momento. Desligue e ligue de novo para tentar outra vez.";
    if (map.getSource("focos-48h")) desenharFocos();
    return mostrarSituacao("focos-48h-status", focosResumo);
  }
  focosDados = validos.flatMap((l) => l.focos);
  focosSituacao = "ok";
  return atualizarFocos(falhas.length);
}

function atualizarFocos(falhas = 0) {
  const n = desenharFocos();
  const hora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  focosResumo = `${n.toLocaleString("pt-BR")} focos nas últimas ${HORAS_FOCOS} h, consulta às ${hora}.` + (falhas ? " Parte dos arquivos do INPE não respondeu: a contagem pode estar incompleta." : "");
  return mostrarSituacao("focos-48h-status", focosResumo);
}

export function filtrarFocosReferencia(so) {
  focosSoReferencia = so;
  return focosAtivo && map.getSource("focos-48h") ? atualizarFocos() : focosResumo;
}

export function removerCamadaFocos() {
  focosAtivo = false;
  focosSituacao = "carregando";
  focosPedido++;
  focosDados = [];
  focosResumo = "";
  if (map.getLayer("focos-48h")) map.removeLayer("focos-48h");
  if (map.getSource("focos-48h")) map.removeSource("focos-48h");
}

// DETER: alertas do período que o PRODES ainda não cobre, baixados ao ligar. As camadas entram vazias e recebem
// os dados quando chegam: a ordem no mapa não depende do serviço responder.
const TIMEOUT_DETER_MS = 60000;
const VAZIO = { type: "FeatureCollection", features: [] };
export let deterAtivo = false;
export let deterResumo = "";
// Ver focosSituacao.
export let deterSituacao = "carregando";
let deterPedido = 0;

export async function aplicarCamadaDeter() {
  deterAtivo = true;
  deterSituacao = "carregando";
  const pedido = ++deterPedido;
  deterResumo = "Consultando o INPE…";
  if (!map.getSource("deter")) {
    map.addSource("deter", { type: "geojson", data: VAZIO, attribution: "INPE, DETER Cerrado" });
    map.addLayer({ id: "deter-fill", type: "fill", source: "deter", paint: { "fill-color": COR_DETER.cor, "fill-opacity": 0.6 } });
    map.addLayer({ id: "deter-line", type: "line", source: "deter", paint: { "line-color": COR_DETER.borda, "line-width": 0.8 } });
    posicionarAcimaDasTIs();
  }
  try {
    const r = await fetch(URL_DETER, { signal: sinalComTimeout(TIMEOUT_DETER_MS) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const dados = await r.json();
    if (pedido !== deterPedido || !deterAtivo) return deterResumo;
    map.getSource("deter").setData(dados);
    deterSituacao = "ok";
    const datas = dados.features.map((f) => f.properties.view_date).filter(Boolean).sort();
    const ha = dados.features.reduce((s, f) => s + (f.properties.areatotalkm ?? 0), 0) * 100;
    deterResumo = dados.features.length
      ? `${dados.features.length.toLocaleString("pt-BR")} alertas, ${Math.round(ha).toLocaleString("pt-BR")} ha, até ${datas.at(-1).split("-").reverse().join("/")}.`
      : "Nenhum alerta no período.";
  } catch (err) {
    if (pedido !== deterPedido || !deterAtivo) return deterResumo;
    log(`DETER indisponível: ${err?.message || err}`);
    deterSituacao = "falha";
    deterResumo = "Serviço do INPE indisponível no momento. Desligue e ligue de novo para tentar outra vez.";
  }
  return mostrarSituacao("deter-status", deterResumo);
}

export function removerCamadaDeter() {
  deterAtivo = false;
  deterSituacao = "carregando";
  deterPedido++;
  deterResumo = "";
  ["deter-line", "deter-fill"].forEach((id) => { if (map.getLayer(id)) map.removeLayer(id); });
  if (map.getSource("deter")) map.removeSource("deter");
}

// Focos por ano: só os arquivos do intervalo pedido. Abre no último ano.
export let focosAnuaisAtivo = false;
export let focosAnuaisDe = FOCOS_ANUAIS.at(-1).ano;
export let focosAnuaisAte = FOCOS_ANUAIS.at(-1).ano;
export const idsFocosAnuais = () => (map.getStyle()?.layers ?? []).map((l) => l.id).filter((id) => id.startsWith("focos-ano-"));

function removerFontesFocosAnuais() {
  idsFocosAnuais().forEach((id) => {
    map.removeLayer(id);
    map.removeSource(id);
  });
}

export function aplicarCamadaFocosAnuais(de, ate) {
  focosAnuaisAtivo = true;
  focosAnuaisDe = de;
  focosAnuaisAte = ate;
  removerFontesFocosAnuais();
  FOCOS_ANUAIS.filter((f) => f.ano >= de && f.ano <= ate).forEach((f) => {
    const id = `focos-ano-${f.ano}`;
    map.addSource(id, { type: "vector", tiles: [`pmtiles://dados/${f.arquivo}/{z}/{x}/{y}`], ...ZOOMS_FOCOS_ANUAIS, attribution: "INPE, Programa Queimadas" });
    map.addLayer({ id, type: "circle", source: id, "source-layer": "focos",
      paint: { "circle-color": f.cor, "circle-opacity": 0.8, "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 0.9, 8, 2.2, 12, 4.5] } });
  });
  posicionarAcimaDasTIs();
}

export function removerCamadaFocosAnuais() {
  focosAnuaisAtivo = false;
  removerFontesFocosAnuais();
}
