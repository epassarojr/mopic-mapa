// F3 — deep-link e embed: lê a querystring uma vez, antes de o mapa existir.
// ?ti=12,45 · ?bbox=oeste,sul,leste,norte · ?camadas=ucs,estados · ?base=osm · ?embed=1
// Módulo folha (sem depender do mapa) para os bounds irem já no construtor, sem "pulo" visual.
import { BASEMAPS, CAMADAS_URL, CAMADAS_URL_ANTIGAS, CAMADAS_URL_BIOMAS, CAMADAS_URL_PRESSOES } from "./config/camadas.js";
import { estado } from "./estado.js";
import { log, sinalComTimeout } from "./nucleo.js";

const params = new URLSearchParams(window.location.search);
const lista = (nome) => params.get(nome).split(",").map((s) => s.trim()).filter(Boolean);
const TIMEOUT_INDICE_MS = 5000;
// Uma TI pequena ou um ponto "em estudo" não pode abrir colado no chão.
const MAXZOOM_TI = 11;
const MAXZOOM_BBOX = 22;

export const MODO_EMBED = params.get("embed") === "1";
if (MODO_EMBED) document.body.classList.add("embed");

// Link quebrado não deixa a página em branco: abre a vista padrão e diz o que foi ignorado.
const problemas = [];

function lerBbox() {
  const partes = lista("bbox");
  const [o, s, l, n] = partes.map(Number);
  const valido = partes.length === 4 && partes.every((v) => Number.isFinite(Number(v))) &&
    o >= -180 && l <= 180 && s >= -85 && n <= 85 && o < l && s < n;
  if (!valido) { problemas.push(`bbox=${params.get("bbox")}`); return null; }
  return { bounds: [[o, s], [l, n]], maxZoom: MAXZOOM_BBOX };
}

async function buscarIndice() {
  const r = await fetch("dados/tis_mopic_indice.json", { signal: sinalComTimeout(TIMEOUT_INDICE_MS) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// Índice de TIs do pipeline, em vez do DuckDB: abrir o mapa numa TI não custa os ~13 MB do WASM.
async function lerTis() {
  const pedidas = lista("ti");
  let indice;
  try {
    indice = await buscarIndice();
  } catch (err) {
    log("Índice de TIs indisponível: " + err.message);
    problemas.push(`ti=${params.get("ti")}`);
    return { ids: [], vista: null };
  }
  const achadas = pedidas.filter((id) => Object.hasOwn(indice, id));
  const desconhecidas = pedidas.filter((id) => !Object.hasOwn(indice, id));
  if (desconhecidas.length || !pedidas.length) problemas.push(`ti=${desconhecidas.join(",")}`);
  if (!achadas.length) return { ids: [], vista: null };
  const caixas = achadas.map((id) => indice[id].bbox);
  return {
    ids: achadas.map(Number),
    vista: {
      bounds: [[Math.min(...caixas.map((b) => b[0])), Math.min(...caixas.map((b) => b[1]))],
               [Math.max(...caixas.map((b) => b[2])), Math.max(...caixas.map((b) => b[3]))]],
      maxZoom: MAXZOOM_TI,
    },
  };
}

const tis = params.has("ti") ? await lerTis() : { ids: [], vista: null };
export const tisDoLink = tis.ids;
// Com ?ti= e ?bbox= juntos, o bbox enquadra e a TI só fica destacada.
export const vistaDoLink = (params.has("bbox") ? lerBbox() : null) ?? tis.vista;

export const pressoesDoLink = new Set();

// ?camadas= é a lista exata do que abre ligado (o resto desliga), e não um acréscimo ao padrão.
// O desejo fica em visibilidadeDesejada: o painel já parte dele e o load do mapa o aplica.
if (params.has("camadas")) {
  const pedidas = new Set(lista("camadas").flatMap((nome) => CAMADAS_URL_ANTIGAS[nome] ?? [nome]));
  Object.entries(CAMADAS_URL).forEach(([nome, ids]) => {
    ids.forEach((id) => estado.visibilidadeDesejada.set(id, pedidas.has(nome)));
  });
  estado.biomasModo = Object.entries(CAMADAS_URL_BIOMAS).reduce((modo, [nome, valor]) => (pedidas.has(nome) ? valor : modo), null);
  CAMADAS_URL_PRESSOES.filter((nome) => pedidas.has(nome)).forEach((nome) => pressoesDoLink.add(nome));
  const conhecidas = new Set([...Object.keys(CAMADAS_URL), ...Object.keys(CAMADAS_URL_BIOMAS), ...CAMADAS_URL_PRESSOES]);
  const desconhecidas = [...pedidas].filter((nome) => !conhecidas.has(nome));
  if (desconhecidas.length) problemas.push(`camadas=${desconhecidas.join(",")}`);
}

if (params.has("base")) {
  if (Object.hasOwn(BASEMAPS, params.get("base"))) estado.basemapAtual = params.get("base");
  else problemas.push(`base=${params.get("base")}`);
}

if (problemas.length) {
  log(`Parâmetros do link ignorados: ${problemas.join(" · ")}`);
  const aviso = document.createElement("div");
  aviso.id = "aviso-link";
  aviso.setAttribute("role", "status");
  aviso.textContent = `Parte do link não foi reconhecida e foi ignorada: ${problemas.join(" · ")}`;
  aviso.addEventListener("click", () => aviso.remove());
  document.body.append(aviso);
  setTimeout(() => aviso.remove(), 10000);
}
