// F3 — modo ?embed=1: link "Abrir mapa completo", que leva a vista atual para fora do iframe.
import { BASEMAPS, CAMADAS_URL, CAMADAS_URL_BIOMAS } from "./config/camadas.js";
import { estado } from "./estado.js";
import { map } from "./mapa.js";
import { visivel } from "./popup.js";
import { desmatamentoAtivo, deterAtivo, focosAnuaisAtivo, focosAtivo, mineracaoAtivo } from "./servicos.js";
import { MODO_EMBED } from "./url.js";

function urlDaVista() {
  const url = new URL(window.location.href);
  url.searchParams.delete("embed");
  // Antes do load as camadas ainda não existem: mantém o link como veio.
  if (!map.getLayer("estados-line")) return url.href;
  const b = map.getBounds();
  const limitar = (v, max) => Math.max(-max, Math.min(max, v)).toFixed(4);
  url.searchParams.set("bbox", [limitar(b.getWest(), 180), limitar(b.getSouth(), 85), limitar(b.getEast(), 180), limitar(b.getNorth(), 85)].join(","));
  const pressoes = { desmatamento: desmatamentoAtivo, deter: deterAtivo, mineracao: mineracaoAtivo, focos48h: focosAtivo, "focos-anuais": focosAnuaisAtivo };
  url.searchParams.set("camadas", [
    ...Object.entries(CAMADAS_URL).filter(([, ids]) => map.getLayer(ids[0]) && visivel(ids[0])).map(([nome]) => nome),
    ...Object.entries(CAMADAS_URL_BIOMAS).filter(([, modo]) => modo === estado.biomasModo).map(([nome]) => nome),
    ...Object.entries(pressoes).filter(([, ativa]) => ativa).map(([nome]) => nome),
  ].join(","));
  if (Object.hasOwn(BASEMAPS, estado.basemapAtual)) url.searchParams.set("base", estado.basemapAtual);
  return url.href;
}

if (MODO_EMBED) {
  const link = document.createElement("a");
  link.id = "abrir-completo";
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = "Abrir mapa completo ↗";
  link.href = urlDaVista();
  // O clique monta a URL antes de o navegador seguir o link.
  link.addEventListener("click", () => (link.href = urlDaVista()));
  document.getElementById("paineis-wrap").append(link);
}
