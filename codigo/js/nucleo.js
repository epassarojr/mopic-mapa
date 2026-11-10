// Utilitários sem dependência do mapa: log, formatação e rede.

export const log = (msg) => {
  console.log(msg);
  document.getElementById("log").textContent += msg + "\n";
};
// Teste 18 — ?debug=1 mostra o log técnico e expõe os ganchos window.__debug*.
export const MODO_DEBUG = new URLSearchParams(window.location.search).get("debug") === "1";
if (MODO_DEBUG) document.body.classList.add("debug");
// Igual ao @media (max-width: 700px) do CSS.
export const LARGURA_MOBILE = 700;
// fetch() só rejeita em falha de rede; 404/500 precisam de r.ok.
export const buscarJson = (url) => fetch(url).then((r) => {
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
});
export const hexParaRgba = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).concat(255);

export function paraMercator(lng, lat) {
  const R = 20037508.34;
  const x = (lng * R) / 180;
  let y = Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180);
  y = (y * R) / 180;
  return [x, y];
}

// GetFeatureInfo JSON num ponto clicado (janela de 9×9 px em volta do
// clique, pra tolerar polígonos pequenos). Extraído do antigo
// identificarDesmatamento no teste 14, agora reaproveitado pelo PRODES e
// pelas consultas a serviços. Devolve a lista de features (pode ser vazia).
export const TIMEOUT_GETFEATUREINFO_MS = 15000;
// N5 (2ª revisão) — AbortSignal.timeout não existe no Safari < 16.
export function sinalComTimeout(ms) {
  if (AbortSignal.timeout) return AbortSignal.timeout(ms);
  const controle = new AbortController();
  setTimeout(() => controle.abort(), ms);
  return controle.signal;
}

// Escapa texto antes de interpolar no HTML dos popups: atributos dos
// PMTiles e respostas de serviços externos (inclusive páginas de erro)
// não podem virar marcação.
export const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const fmtNum = (v, casas = 1) => (v == null || v === "" || !Number.isFinite(Number(v)) ? "não informada" : Number(v).toLocaleString("pt-BR", { maximumFractionDigits: casas }));
export const fmtData = (v) => (v ? esc(String(v).split("-").reverse().join("/")) : "não informada");
// Campos da TI MOPIC escolhidos pelo projeto em 2026-09-25, todos da FUNAI
// exceto Categoria e População. Área = superficie_perimetro_ha, que vale 0
// nos pontos (TIs em estudo, sem perímetro).
export const fmtHa = (v) => (v == null || v === "" || Number(v) === 0 ? "não informada" : Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 }));
// FUNAI grava listas como "Timbira,Tembé"; espaça as vírgulas.
export const fmtLista = (v) => (v == null || v === "" ? "?" : esc(String(v).replace(/\s*,\s*/g, ", ")));

// Deduplica feições que vêm repetidas (mesma área em tiles vizinhos ou
// polígono + ponto da mesma TI).
export const unicas = (feicoes, chave) => [...new Map(feicoes.map((f) => [chave(f), f])).values()];

export function debounce(fn, ms) {
  let timer = null;
  const chamar = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
  chamar.cancelar = () => clearTimeout(timer);
  return chamar;
}

export const semAcento = (s) => (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
