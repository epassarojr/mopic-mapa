// Decisão 7.3 — interpretar o que se digita no "Ir para". Sem mapa nem tela, para poder testar direto.
import { semAcento } from "./nucleo.js";

const LIMITE_BRASIL = { lat: [-34.5, 6], lon: [-75, -28] };
const dentro = (v, [a, b]) => v >= a && v <= b;
export const noBrasil = (lat, lon) => dentro(lat, LIMITE_BRASIL.lat) && dentro(lon, LIMITE_BRASIL.lon);

const numero = (t) => Number(t.replace(",", "."));
const NUM = String.raw`\d+(?:[.,]\d+)?`;

function grausDecimais(partes) {
  if (!partes.length || partes.length > 3) return null;
  const [g, m = 0, s = 0] = partes.map(numero);
  return m < 60 && s < 60 ? g + m / 60 + s / 3600 : null;
}

function validar(lat, lon) {
  return lat != null && lon != null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null;
}

// 15°47'30"S 47°52'10"O · 15 47 S 47 52 W · S 15.79 O 47.88 · 15,79 S, 47,88 W
function comHemisferio(t) {
  const sufixo = /[NSLOEW]\s*$/.test(t);
  const padrao = sufixo ? /([^NSLOEW]+)([NSLOEW])/g : /([NSLOEW])([^NSLOEW]+)/g;
  const achados = [...t.matchAll(padrao)].map((m) => (sufixo ? { texto: m[1], letra: m[2] } : { texto: m[2], letra: m[1] }));
  if (achados.length !== 2) return null;
  let lat = null;
  let lon = null;
  for (const { texto, letra } of achados) {
    const v = grausDecimais(texto.match(new RegExp(NUM, "g")) ?? []);
    if (v == null) return null;
    if ("NS".includes(letra)) lat = letra === "S" ? -v : v;
    else lon = "OW".includes(letra) ? -v : v;
  }
  return validar(lat, lon);
}

// -15°47'30" -47°52'10"
function grausComSinal(t) {
  const padrao = new RegExp(String.raw`([-+]?)\s*(${NUM})\s*[°º]\s*(?:(${NUM})\s*['′’]\s*)?(?:(${NUM})\s*["″”]?)?`, "g");
  const achados = [...t.matchAll(padrao)];
  if (achados.length !== 2) return null;
  const [a, b] = achados.map((m) => {
    const v = grausDecimais([m[2], m[3], m[4]].filter(Boolean));
    return v == null ? null : m[1] === "-" ? -v : v;
  });
  return a == null || b == null ? null : ordenar(a, b);
}

// Latitude primeiro. Longitude primeiro só quando a ordem pedida cairia fora do Brasil e a inversa, dentro.
function ordenar(a, b) {
  return !noBrasil(a, b) && noBrasil(b, a) ? validar(b, a) : validar(a, b);
}

// -15.79, -47.88 · -15,79 -47,88 · -15,79; -47,88
function decimais(t) {
  const virgulas = t.includes(".") ? null : t.match(/[-+]?\d+,\d+/g);
  const soDuas = virgulas?.length === 2 && !/\d/.test(t.replace(/[-+]?\d+,\d+/g, ""));
  const achados = soDuas ? virgulas.map(numero) : t.match(/[-+]?\d+(?:\.\d+)?/g)?.map(Number);
  return achados?.length === 2 ? ordenar(achados[0], achados[1]) : null;
}

export function interpretarCoordenada(texto) {
  const t = String(texto ?? "").toUpperCase().replace(/[−–—]/g, "-").replace(/\b(LATITUDE|LONGITUDE|LAT|LONG|LON)\b[:=]?/g, " ").trim();
  if (!/\d/.test(t) || !/^[\d\s.,;:/°º'′’"″”+\-NSLOEW]+$/.test(t)) return null;
  if (/[NSLOEW]/.test(t)) return comHemisferio(t);
  return /[°º]/.test(t) ? grausComSinal(t) : decimais(t);
}

// Graus decimais com 5 casas: cerca de 1 m, mais do que o clique ou a digitação garantem.
export const textoCoordenada = ({ lat, lon }) => `${lat.toFixed(5)}, ${lon.toFixed(5)}`;

export const normalizar = (t) => semAcento(String(t ?? "")).replace(/[^a-z0-9]+/g, " ").trim();

// Lista: [código, nome, UF, oeste, sul, leste, norte]. "palmas to" filtra pela UF; quem começa com o termo vem antes.
export function buscarMunicipios(lista, termo, limite = 8) {
  let t = normalizar(termo);
  if (t.length < 2) return [];
  const uf = t.match(/^(.+) ([a-z]{2})$/);
  const comUf = uf ? lista.filter((m) => m[2].toLowerCase() === uf[2] && normalizar(m[1]).includes(uf[1])) : [];
  let candidatos = lista;
  if (comUf.length) { candidatos = comUf; t = uf[1]; }
  const achados = candidatos.map((m) => ({ m, nome: normalizar(m[1]) })).filter((x) => x.nome.includes(t));
  const peso = (x) => (x.nome === t ? 0 : x.nome.startsWith(t) ? 1 : 2);
  return achados.sort((a, b) => peso(a) - peso(b) || a.nome.length - b.nome.length || a.nome.localeCompare(b.nome))
    .slice(0, limite).map(({ m }) => ({ cd: m[0], nome: m[1], uf: m[2], limites: [[m[3], m[4]], [m[5], m[6]]] }));
}
