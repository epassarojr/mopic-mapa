// Ponto de entrada: carrega os módulos na ordem e expõe os ganchos de depuração.
import "./nucleo.js";
import "./mapa.js";
import "./consultas.js";
import "./impressao.js";
import "./config/camadas.js";
import "./estado.js";
import "./servicos.js";
import "./popup.js";
import "./painel.js";
import "./embed.js";
import "./comandos.js";
import { resultadosBusca } from "./consultas.js";
import { fontesDaLegenda, legendaPlana, montarLegenda } from "./impressao.js";
import { adicionarCamadaExterna, map } from "./mapa.js";
import { MODO_DEBUG } from "./nucleo.js";

// Ganchos de depuração/teste automatizado (Playwright) — não usados
// pela UI real. Teste 18 — só existem com ?debug=1.
if (MODO_DEBUG) {
  window.__debugResultadosBusca = () => resultadosBusca;
  window.__debugAdicionarCamada = adicionarCamadaExterna;
  window.__debugMapa = () => map; // teste 16 — conferir camadas de resultado/recorte no Playwright
  window.__debugLegendaImpressao = legendaPlana;
  window.__debugFontesImpressao = fontesDaLegenda;
  window.__debugLegendaItens = () => montarLegenda().flatMap((t) => t.entradas.flatMap((e) => e.itens));
}
