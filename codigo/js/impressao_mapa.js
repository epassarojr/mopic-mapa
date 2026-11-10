// F7 — o mapa da impressão: um mapa oculto, no tamanho do quadro no papel e em 200 dpi. A tela do usuário não se mexe.
import { BASEMAPS } from "./config/camadas.js";
import { estado } from "./estado.js";
import { map } from "./mapa.js";

const MM_POR_PX = 25.4 / 96;
const CIRCUNFERENCIA_M = 40075016.686;
const DPI = 200;
const DPI_RESERVA = 120; // se o aparelho não der conta de 200 dpi
const ESPERA_MAXIMA_MS = 60000;
const LIMITE_ZOOM = 13;
const PASSOS_GRADE = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20];
const MAX_LINHAS_GRADE = 6;

// O que a pessoa vê: o mapa sem a parte coberta pelos painéis, que mudam de tamanho.
export function limitesDaVista() {
  const canvas = map.getCanvas();
  const painel = document.getElementById("paineis-wrap")?.getBoundingClientRect();
  const celular = painel && painel.width > canvas.clientWidth * 0.8;
  const esquerda = painel && !celular ? Math.min(painel.right, canvas.clientWidth * 0.8) : 0;
  // No celular o painel cobre a tela enquanto o PDF é pedido: vale o mapa inteiro, não a faixa que sobra.
  const topo = 0;
  const cantos = [[esquerda, topo], [canvas.clientWidth, topo], [canvas.clientWidth, canvas.clientHeight], [esquerda, canvas.clientHeight]].map((p) => map.unproject(p));
  const limites = new maplibregl.LngLatBounds(cantos[0], cantos[0]);
  cantos.forEach((c) => limites.extend(c));
  return limites;
}

// Só o que está ligado, para não baixar o resto. Imagem de satélite e pixels do MapBiomas pedem um zoom a mais, porque
// o quadro tem o dobro de pixels por milímetro; WMS pede imagem maior na mesma grade. Mapas com texto desenhado no
// tile (OSM) ficam no zoom normal: um a mais deixaria os rótulos ilegíveis no papel.
export function estiloDeImpressao(estilo = map.getStyle()) {
  const layers = estilo.layers.filter((l) => l.layout?.visibility !== "none");
  const usadas = new Set(layers.map((l) => l.source).filter(Boolean));
  const sources = {};
  Object.entries(estilo.sources).forEach(([id, fonte]) => {
    if (!usadas.has(id)) return;
    const imagem = (id === "basemap" && BASEMAPS[estado.basemapAtual]?.imagem) || id.startsWith("mapbiomas-");
    sources[id] = { ...fonte, ...(imagem ? { tileSize: 128 } : {}) };
    if (fonte.type === "raster" && fonte.tiles?.[0]?.includes("WIDTH=")) sources[id].tiles = fonte.tiles.map((u) => u.replace(/WIDTH=\d+&HEIGHT=\d+/, "WIDTH=512&HEIGHT=512"));
  });
  return { ...estilo, layers, sources };
}

export function passoDaGrade(extensaoGraus) {
  return PASSOS_GRADE.find((p) => extensaoGraus / p <= MAX_LINHAS_GRADE) ?? PASSOS_GRADE.at(-1);
}

export function marcasDaGrade(inicio, fim, passo) {
  const marcas = [];
  for (let i = Math.ceil(inicio / passo); i * passo <= fim; i++) marcas.push(Number((i * passo).toFixed(4)));
  return marcas;
}

export function rotuloGrau(valor, positivo, negativo) {
  const total = Math.round(Math.abs(valor) * 60);
  const minutos = total % 60;
  const hemisferio = valor === 0 ? "" : valor > 0 ? positivo : negativo;
  return `${Math.floor(total / 60)}°${minutos ? `${String(minutos).padStart(2, "0")}'` : ""}${hemisferio}`;
}

export function escalaNumerica(zoom, latitude) {
  const metrosPorPx = (CIRCUNFERENCIA_M * Math.cos((latitude * Math.PI) / 180)) / (512 * 2 ** zoom);
  const denominador = metrosPorPx / (MM_POR_PX / 1000);
  const ordem = 10 ** (Math.floor(Math.log10(denominador)) - 2);
  return { denominador: Math.round(denominador / ordem) * ordem, metrosPorMm: metrosPorPx / MM_POR_PX };
}

// Barra de cerca de alvoMm, com um comprimento redondo
export function barraDeEscala(metrosPorMm, alvoMm = 40) {
  const alvo = alvoMm * metrosPorMm;
  const potencia = 10 ** Math.floor(Math.log10(alvo));
  const razao = alvo / potencia;
  const metros = (razao >= 5 ? 5 : razao >= 2 ? 2 : 1) * potencia;
  return { mm: metros / metrosPorMm, rotulo: metros >= 1000 ? `${(metros / 1000).toLocaleString("pt-BR")} km` : `${metros.toLocaleString("pt-BR")} m` };
}

function esperarOcioso(m) {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(false), ESPERA_MAXIMA_MS);
    m.once("idle", () => { clearTimeout(t); resolve(true); });
  });
}

function capturar(m) {
  return new Promise((resolve) => {
    m.once("render", () => resolve(m.getCanvas().toDataURL("image/jpeg", 0.92)));
    m.triggerRepaint();
  });
}

function medir(m, larguraPx, alturaPx, larguraMm) {
  const b = m.getBounds();
  const passo = passoDaGrade(Math.max(b.getEast() - b.getWest(), b.getNorth() - b.getSouth()));
  return {
    limites: { oeste: b.getWest(), sul: b.getSouth(), leste: b.getEast(), norte: b.getNorth() },
    zoom: m.getZoom(), latitude: m.getCenter().lat, ...escalaNumerica(m.getZoom(), m.getCenter().lat),
    meridianos: marcasDaGrade(b.getWest(), b.getEast(), passo).map((lon) => ({ valor: lon, fracao: m.project([lon, m.getCenter().lat]).x / larguraPx })),
    paralelos: marcasDaGrade(b.getSouth(), b.getNorth(), passo).map((lat) => ({ valor: lat, fracao: m.project([m.getCenter().lng, lat]).y / alturaPx })),
    larguraMm,
  };
}

async function renderizar(limites, larguraMm, alturaMm, dpi, folgaPx) {
  const larguraPx = Math.round(larguraMm / MM_POR_PX);
  const alturaPx = Math.round(alturaMm / MM_POR_PX);
  const caixa = document.createElement("div");
  caixa.style.cssText = `position:fixed;left:-20000px;top:0;width:${larguraPx}px;height:${alturaPx}px`;
  document.body.append(caixa);
  let m;
  // "idle" dispara mesmo com tile em erro: sem contar aqui, o PDF sairia sem aviso
  const fontesComFalha = new Set();
  try {
    m = new maplibregl.Map({
      container: caixa, style: estiloDeImpressao(), bounds: limites, fitBoundsOptions: { padding: folgaPx, maxZoom: LIMITE_ZOOM },
      pixelRatio: dpi / 96, preserveDrawingBuffer: true, interactive: false, attributionControl: false, fadeDuration: 0, trackResize: false, maxPitch: 0,
    });
    m.on("error", (e) => { if (e.sourceId) fontesComFalha.add(e.sourceId); });
    // Ícones vêm de map.addImage e não vão no estilo
    m.on("styleimagemissing", (e) => {
      const icone = map.getImage(e.id);
      if (icone && !m.hasImage(e.id)) m.addImage(e.id, icone.data, { pixelRatio: icone.pixelRatio, sdf: icone.sdf });
    });
    const completo = await esperarOcioso(m);
    return { imagem: await capturar(m), completo, fontesComFalha, dpi, ...medir(m, larguraPx, alturaPx, larguraMm) };
  } finally {
    m?.remove();
    caixa.remove();
  }
}

// `folgaPx`: respiro ao enquadrar TIs; a vista atual não precisa, porque já é o que a pessoa escolheu ver.
export async function renderizarQuadro(limites, larguraMm, alturaMm, folgaPx = 0) {
  try {
    return await renderizar(limites, larguraMm, alturaMm, DPI, folgaPx);
  } catch {
    return renderizar(limites, larguraMm, alturaMm, DPI_RESERVA, folgaPx);
  }
}
