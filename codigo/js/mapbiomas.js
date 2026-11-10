// Classe do MapBiomas no ponto clicado: lê o pixel do mesmo tile que o mapa está desenhando.
import { PMTiles } from "../vendor/pmtiles.esm.js";
import { CLASSES_MAPBIOMAS, TILES_MAPBIOMAS } from "./config/camadas.js";

const TAMANHO_TILE = 256;
const CIRCUNFERENCIA_M = 40075016.686;
const TOLERANCIA_COR = 12; // a decodificação pode variar um pouco a cor (proteções de privacidade do navegador)
// Com tiles de 256 px, o MapLibre mostra no zoom z do mapa os tiles de z + 1, arredondados.
export const ZOOM_TILE_ACIMA_DO_MAPA = 1;

const CLASSES = CLASSES_MAPBIOMAS.map((c) => ({ ...c, rgb: [1, 3, 5].map((i) => parseInt(c.cor.slice(i, i + 2), 16)) }));
const abertos = new Map();

function abrir(arquivo) {
  if (!abertos.has(arquivo)) abertos.set(arquivo, new PMTiles(`dados/${arquivo}`));
  return abertos.get(arquivo);
}

// RGBA do pixel do tile no ponto; null se o arquivo não tem esse tile.
async function lerPixel(arquivo, z, { lng, lat }) {
  const n = 2 ** z;
  const fx = ((lng + 180) / 360) * n;
  const fy = ((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * n;
  const x = Math.floor(fx);
  const y = Math.floor(fy);
  const tile = await abrir(arquivo).getZxy(z, x, y);
  if (!tile) return null;
  const imagem = await createImageBitmap(new Blob([tile.data], { type: "image/webp" }));
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = TAMANHO_TILE;
  const g = canvas.getContext("2d", { willReadFrequently: true });
  g.drawImage(imagem, 0, 0);
  imagem.close();
  return g.getImageData(Math.floor((fx - x) * TAMANHO_TILE), Math.floor((fy - y) * TAMANHO_TILE), 1, 1).data;
}

function classeDaCor([r, g, b]) {
  const distancia = (c) => Math.max(Math.abs(c.rgb[0] - r), Math.abs(c.rgb[1] - g), Math.abs(c.rgb[2] - b));
  const maisPerto = CLASSES.reduce((a, c) => (distancia(c) < distancia(a) ? c : a));
  return distancia(maisPerto) <= TOLERANCIA_COR ? maisPerto : null;
}

const dentroDe = ([o, s, l, n], { lng, lat }) => lng >= o && lng <= l && lat >= s && lat <= n;

// Detalhe de 30 m quando o mapa o desenha ali; senão, a base de 150 m. null = sem dado no ponto.
export async function classeNoPonto(ano, lngLat, zoomMapa) {
  const zTile = Math.round(zoomMapa + ZOOM_TILE_ACIMA_DO_MAPA);
  const [base, ...detalhe] = TILES_MAPBIOMAS[ano];
  const faixa = detalhe.find((d) => zTile >= d.minzoom && dentroDe(d.limites, lngLat));
  const tentativas = [
    ...(faixa ? [{ arquivo: faixa.arquivo, z: Math.min(zTile, faixa.maxzoom), dados: "30 m", zMax: faixa.maxzoom }] : []),
    { arquivo: base.arquivo, z: Math.min(zTile, base.maxzoom), dados: "150 m", zMax: base.maxzoom },
  ];
  for (const t of tentativas) {
    const pixel = await lerPixel(t.arquivo, t.z, lngLat);
    if (!pixel || pixel[3] === 0) continue;
    const classe = classeDaCor(pixel);
    if (!classe) return null;
    return {
      rotulo: classe.rotulo, cor: classe.cor, dados: t.dados, aproximar: t.z < t.zMax,
      metros: (CIRCUNFERENCIA_M / (TAMANHO_TILE * 2 ** t.z)) * Math.cos((lngLat.lat * Math.PI) / 180),
    };
  }
  return null;
}
