// Bolão "Família Cavalcante" — app sem build, Firebase via CDN (ou modo local).
// Ver specs/bolao-familia-cavalcante/ para requisitos e design.

import { firebaseConfig, BOLAO_ID, RECAPTCHA_SITE_KEY } from "./firebase-config.js";

// ── Constantes de domínio ────────────────────────────────────────────────────
const FASES = [
  { id: "grupos",   rotulo: "Fase de Grupos" },
  { id: "r32",      rotulo: "16-avos de final" },
  { id: "oitavas",  rotulo: "Oitavas de final" },
  { id: "quartas",  rotulo: "Quartas de final" },
  { id: "semis",    rotulo: "Semifinal" },
  { id: "terceiro", rotulo: "Disputa de 3º lugar" },
  { id: "final",    rotulo: "Final" },
];
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)).slice(0, 8);
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]),
  );

function novoDoc() {
  return { v: 1, nome: 'Família Cavalcante', jogos: {} };
}

// ── Backends de persistência ─────────────────────────────────────────────────
const ROOT = `bolao/${BOLAO_ID}`;
const configurado = firebaseConfig.apiKey && firebaseConfig.apiKey !== "COLE_AQUI";

const appCheckAtivo = RECAPTCHA_SITE_KEY && RECAPTCHA_SITE_KEY !== "COLE_AQUI";

async function criarBackend() {
  if (!configurado) return backendLocal();
  try {
    const { initializeApp } = await import(
      "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"
    );
    const app = initializeApp(firebaseConfig);

    // App Check (reCAPTCHA v3) — só ativa se houver site key; garante que só o seu site escreve
    if (appCheckAtivo) {
      const local = location.hostname === "localhost" || location.hostname === "127.0.0.1";
      if (local) self.FIREBASE_APPCHECK_DEBUG_TOKEN = true; // imprime token de debug no console p/ testar local
      const { initializeAppCheck, ReCaptchaV3Provider } = await import(
        "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-check.js"
      );
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(RECAPTCHA_SITE_KEY),
        isTokenAutoRefreshEnabled: true,
      });
    }

    const { getDatabase, ref, onValue, update, set } = await import(
      "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js"
    );
    const db = getDatabase(app);
    // toda escrita pode falhar (offline, regras, App Check) → avisa em vez de sumir em silêncio
    const guardar = (p) =>
      p && typeof p.catch === "function"
        ? p.catch((e) => aviso(`Não consegui salvar: ${e?.code || e?.message || e}`))
        : p;
    return {
      modo: "firebase",
      subscribe: (cb) =>
        onValue(ref(db, ROOT), (snap) => cb(snap.val()), (e) =>
          aviso(`Sem conexão com o bolão: ${e?.code || e?.message || e}`),
        ),
      update: (path, obj) => guardar(update(ref(db, path ? `${ROOT}/${path}` : ROOT), obj)),
      setPath: (path, val) => guardar(set(ref(db, path ? `${ROOT}/${path}` : ROOT), val)),
    };
  } catch (e) {
    // CDN fora do ar / módulo não carregou: cai para o modo local em vez de quebrar a página
    console.error("Firebase indisponível, usando modo local:", e);
    aviso("Não consegui conectar ao servidor — usando modo local neste aparelho.");
    return backendLocal();
  }
}

// aviso transitório (toast) — usado para erros de salvamento/conexão
let avisoTimer;
function aviso(msg) {
  let el = document.getElementById("aviso");
  if (!el) {
    el = document.createElement("div");
    el.id = "aviso";
    el.className = "aviso";
    el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("aviso--on");
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => el.classList.remove("aviso--on"), 5000);
}

function backendLocal() {
  const KEY = `bolao:${BOLAO_ID}`;
  const subs = [];
  const ler = () => {
    try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
  };
  const emitir = (root) => subs.forEach((cb) => cb(root));
  const gravar = (root) => { localStorage.setItem(KEY, JSON.stringify(root)); emitir(root); };
  const porCaminho = (root, path, value) => {
    root = root ? structuredClone(root) : {};
    const parts = path.split("/");
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const k = parts[i];
      if (node[k] == null || typeof node[k] !== "object") node[k] = {};
      node = node[k];
    }
    const last = parts[parts.length - 1];
    if (value === null) delete node[last]; else node[last] = value;
    return root;
  };
  window.addEventListener("storage", (e) => { if (e.key === KEY) emitir(ler()); });
  return {
    modo: "local",
    subscribe: (cb) => { subs.push(cb); cb(ler()); },
    update: (path, obj) => {
      let root = ler() || {};
      for (const k in obj) root = porCaminho(root, path ? `${path}/${k}` : k, obj[k]);
      gravar(root);
    },
    setPath: (path, val) => gravar(path ? porCaminho(ler(), path, val) : val),
  };
}

// ── Estado e ciclo de render ─────────────────────────────────────────────────
let backend;
let state = novoDoc();
let modalJogoId = null;
let rascunho = null;       // bolão em criação (só vai pro banco ao "Salvar")
let etapaRascunho = 1;     // 1 = dados do jogo · 2 = apostas
const appEl = document.getElementById("app");
const modalEl = document.getElementById("modal-root");
const confirmEl = document.getElementById("confirm-root");

(async function init() {
  backend = await criarBackend();
  backend.subscribe((root) => {
    if (root == null) { backend.setPath("", novoDoc()); return; } // bootstrap (RF8/RF9)
    state = root;
    if (!state.jogos) state.jogos = {};
    render();
  });
  document.addEventListener("click", onClick);
  document.addEventListener("change", onChange);
  document.addEventListener("keydown", onKeydown);
})();

// ── Helpers de domínio ───────────────────────────────────────────────────────
const jogosLista = () =>
  Object.entries(state.jogos || {}).map(([id, j]) => ({ id, ...j }));
const apostasLista = (j) =>
  Object.entries(j.apostas || {}).map(([id, a]) => ({ id, ...a }));
// prêmio = valor único por pessoa × quantidade de apostadores
const premio = (j) => (Number(j.valorPadrao) || 0) * apostasLista(j).length;
const pagos = (j) => apostasLista(j).filter((a) => a.pago).length;
const timeCasa = () => "Brasil";
const timeFora = (j) => j.adversario || "a definir";
// só conta como resultado quando os DOIS lados estão preenchidos
const resultadoCompleto = (j) =>
  j.resultadoReal && j.resultadoReal.casa != null && j.resultadoReal.fora != null;
const bateu = (j, a) =>
  resultadoCompleto(j) &&
  Number(a.palpiteCasa) === Number(j.resultadoReal.casa) &&
  Number(a.palpiteFora) === Number(j.resultadoReal.fora);

const campoEditavelFocado = () => {
  const ae = document.activeElement;
  return modalEl.contains(ae) && ["INPUT", "SELECT", "TEXTAREA"].includes(ae?.tagName);
};
const opcoesFase = (sel) =>
  FASES.map(
    (f) => `<option value="${f.id}" ${f.id === sel ? "selected" : ""}>${esc(f.rotulo)}</option>`,
  ).join("");

// ── Render: capa + linha do tempo ────────────────────────────────────────────
function render() {
  appEl.innerHTML = renderCapa() + renderTimeline();
  if (rascunho) {
    if (!campoEditavelFocado()) renderWizard();
    return;
  }
  if (modalJogoId) {
    if (!state.jogos[modalJogoId]) { modalJogoId = null; modalEl.innerHTML = ""; }
    // só evita re-render quando há um CAMPO editável focado (não atrapalha quem digita);
    // botões focados (pago, estrela, +aposta) precisam refletir a mudança na hora.
    else if (!campoEditavelFocado()) renderModal();
  }
}

function renderCapa() {
  // sem selo "ao vivo"; só avisa quando está em modo local (dados não compartilhados)
  const barra =
    backend.modo === "firebase"
      ? ""
      : `<div class="capa__barra"><span class="live live--local">● modo local (só neste aparelho)</span></div>`;
  return `
  <header class="capa">
    <div class="capa__topo">
      <div class="capa__foto">
        <img src="./assets/family.png" alt="Família Cavalcante" />
      </div>
      <div class="capa__cabecalho">
        <span class="capa__sobre">Bolão da Copa 2026</span>
        <h1>Família Cavalcante</h1>
      </div>
    </div>
    ${barra}
  </header>`;
}

function renderTimeline() {
  const todos = jogosLista();
  if (todos.length === 0) {
    return `
    <section class="timeline">
      <div class="vazio">
        <p>Nenhum bolão por aqui ainda.</p>
        <button class="btn btn--foil" data-action="novo-bolao">Criar o primeiro bolão</button>
      </div>
    </section>`;
  }
  const secoes = FASES.map((f) => {
    const lista = todos
      .filter((j) => j.fase === f.id)
      .sort((a, b) => (a.criadoEm || 0) - (b.criadoEm || 0));
    if (lista.length === 0) return "";
    return `
      <section class="fase">
        <h2 class="fase__rotulo">${esc(f.rotulo)}</h2>
        <div class="caixinhas">${lista.map(renderCaixinha).join("")}</div>
      </section>`;
  }).join("");
  return `
  <section class="timeline">
    <div class="timeline__topo">
      <button class="btn btn--foil" data-action="novo-bolao">+ Novo bolão (jogo do Brasil)</button>
    </div>
    ${secoes}
  </section>`;
}

function renderCaixinha(j) {
  const placar = resultadoCompleto(j)
    ? `${j.resultadoReal.casa} <span>×</span> ${j.resultadoReal.fora}`
    : `— <span>×</span> —`;
  const venc = j.vencedorApostaId && j.apostas && j.apostas[j.vencedorApostaId];
  const apostas = apostasLista(j).sort((a, b) => (a.criadoEm || 0) - (b.criadoEm || 0));
  const n = apostas.length;
  const palpites = n
    ? `<ul class="palpites">${apostas
        .map((a) => {
          const venceu = j.vencedorApostaId === a.id;
          const acertou = bateu(j, a);
          const marca = venceu ? "🏆 " : acertou ? "✅ " : "";
          return `<li class="palpite ${venceu ? "palpite--venc" : ""} ${acertou ? "palpite--bateu" : ""}">
            <span class="palpite__nome">${marca}${esc(a.nome || "—")}</span>
            <span class="palpite__leader"></span>
            <span class="palpite__placar">${Number(a.palpiteCasa) || 0} × ${Number(a.palpiteFora) || 0}</span>
          </li>`;
        })
        .join("")}</ul>`
    : "";

  // Ganhador explícito: prioriza o vencedor marcado (★); senão, quem cravou o placar real.
  let ganhador = "";
  if (venc) {
    ganhador = `<div class="ganhador">🏆 Ganhador: <strong>${esc(venc.nome || "—")}</strong></div>`;
  } else if (resultadoCompleto(j)) {
    const cravaram = apostas.filter((a) => bateu(j, a));
    ganhador = cravaram.length
      ? `<div class="ganhador">🏆 ${cravaram.length === 1 ? "Cravou o placar" : "Cravaram o placar"}: <strong>${cravaram.map((a) => esc(a.nome || "—")).join(", ")}</strong></div>`
      : `<div class="ganhador ganhador--ninguem">Ninguém cravou o placar exato</div>`;
  }

  return `
  <article class="caixinha" data-action="open-jogo" data-jid="${j.id}" tabindex="0" role="button">
    <div class="caixinha__confronto">
      <span class="time time--br">${esc(timeCasa(j))}</span>
      <span class="placar">${placar}</span>
      <span class="time">${esc(timeFora(j))}</span>
    </div>
    ${palpites}
    <div class="caixinha__rodape">
      <span>${n} ${n === 1 ? "palpite" : "palpites"}</span>
      <span class="caixinha__premio">prêmio ${brl.format(premio(j))}</span>
    </div>
    ${ganhador}
  </article>`;
}

// ── Render: painel (modal) do jogo ───────────────────────────────────────────
function renderModal() {
  const base = state.jogos[modalJogoId];
  if (!base) return;
  const j = { id: modalJogoId, ...base }; // o id é a chave do mapa; injeta como campo p/ os data-jid
  const apostas = apostasLista(j).sort((a, b) => (a.criadoEm || 0) - (b.criadoEm || 0));
  const linhas = apostas.length
    ? apostas.map((a) => renderLinhaAposta(j, a)).join("")
    : `<p class="vazio vazio--mini">Nenhuma aposta. Adicione a primeira.</p>`;

  modalEl.innerHTML = `
  <div class="overlay" data-action="close-modal">
    <div class="painel painel--larga" role="dialog" aria-modal="true" aria-label="Bolão: Brasil contra ${esc(j.adversario || "adversário")}" data-stop>
      <div class="painel__topo">
        <h2 class="painel__titulo">Brasil <span>×</span> ${esc(j.adversario || "adversário")}</h2>
        <button class="icone" data-action="close-modal" aria-label="Fechar">✕</button>
      </div>

      <div class="painel__cfg">
        <label class="campo campo--grow">
          <span>Adversário</span>
          <input type="text" value="${esc(j.adversario)}" placeholder="ex.: Sérvia"
                 data-field="adversario" data-jid="${j.id}" />
        </label>
        <label class="campo">
          <span>Fase</span>
          <select data-field="fase" data-jid="${j.id}">${opcoesFase(j.fase)}</select>
        </label>
        <label class="campo">
          <span>Valor por pessoa (R$)</span>
          <input type="number" min="0" step="1" value="${Number(j.valorPadrao) || 0}"
                 data-field="valorPadrao" data-jid="${j.id}" inputmode="numeric" />
        </label>
      </div>

      <div class="painel__resultado">
        <span>Resultado real</span>
        <div class="placar-edit">
          <span class="placar-edit__time">${esc(timeCasa(j))}</span>
          <input type="number" min="0" max="30" value="${j.resultadoReal?.casa ?? ""}"
                 placeholder="–" data-field="res-casa" data-jid="${j.id}" inputmode="numeric" />
          <span>×</span>
          <input type="number" min="0" max="30" value="${j.resultadoReal?.fora ?? ""}"
                 placeholder="–" data-field="res-fora" data-jid="${j.id}" inputmode="numeric" />
          <span class="placar-edit__time">${esc(timeFora(j))}</span>
        </div>
      </div>

      <h3 class="painel__secao">Apostas</h3>
      <div class="apostas">
        ${linhas}
      </div>

      <div class="painel__acoes">
        <button class="btn btn--foil" data-action="add-aposta" data-jid="${j.id}">+ Adicionar aposta</button>
        <div class="painel__premio">
          Prêmio: <strong>${brl.format(premio(j))}</strong>
          <small>${apostasLista(j).length} × ${brl.format(Number(j.valorPadrao) || 0)} · ${pagos(j)} pago(s)</small>
        </div>
      </div>

      <button class="btn btn--perigo" data-action="del-jogo" data-jid="${j.id}">Excluir este jogo</button>
    </div>
  </div>`;
}

// ── Render: wizard de criação (2 passos, salva só no fim) ────────────────────
function renderWizard() {
  if (!rascunho) return;
  const adv = rascunho.adversario?.trim() || "adversário";
  const corpo = etapaRascunho === 1 ? wizardPasso1() : wizardPasso2(adv);
  modalEl.innerHTML = `
  <div class="overlay" data-action="rascunho-cancelar">
    <div class="painel ${etapaRascunho === 2 ? "painel--larga" : ""}" role="dialog" aria-modal="true" aria-label="Novo bolão" data-stop>
      <div class="painel__topo">
        <h2 class="painel__titulo">${etapaRascunho === 1 ? "Novo bolão" : `Brasil <span>×</span> ${esc(adv)}`}</h2>
        <button class="icone" data-action="rascunho-cancelar" aria-label="Fechar">✕</button>
      </div>
      ${corpo}
    </div>
  </div>`;
}

function wizardPasso1() {
  return `
    <p class="painel__passo">Passo 1 de 2 · Dados do jogo do Brasil</p>
    <div class="painel__cfg">
      <label class="campo campo--grow">
        <span>Adversário</span>
        <input type="text" value="${esc(rascunho.adversario)}" placeholder="ex.: Sérvia" data-draft="adversario" />
      </label>
      <label class="campo">
        <span>Fase</span>
        <select data-draft="fase">${opcoesFase(rascunho.fase)}</select>
      </label>
      <label class="campo">
        <span>Valor por pessoa (R$)</span>
        <input type="number" min="0" step="1" value="${Number(rascunho.valorPadrao) || 0}"
               data-draft="valorPadrao" inputmode="numeric" />
      </label>
    </div>
    <button class="btn btn--foil btn--bloco" data-action="rascunho-continuar">Continuar → apostas</button>`;
}

function wizardPasso2(adv) {
  const apostas = Object.entries(rascunho.apostas).sort((a, b) => (a[1].criadoEm || 0) - (b[1].criadoEm || 0));
  const linhas = apostas.length
    ? apostas.map(([aid, a]) => renderLinhaRascunho(aid, a)).join("")
    : `<p class="vazio vazio--mini">Nenhuma aposta ainda. Clique em “+ Adicionar aposta”.</p>`;
  return `
    <p class="painel__passo">Passo 2 de 2 · Apostas</p>
    <p class="painel__dica">Palpite de placar: <strong>Brasil</strong> × <strong>${esc(adv)}</strong> · cada aposta vale <strong>${brl.format(Number(rascunho.valorPadrao) || 0)}</strong></p>
    <div class="apostas">${linhas}</div>
    <div class="painel__acoes">
      <button class="btn btn--ghost" data-action="rascunho-voltar">← Voltar</button>
      <button class="btn btn--foil" data-action="rascunho-add-aposta">+ Adicionar aposta</button>
    </div>
    <button class="btn btn--salvar btn--bloco" data-action="rascunho-salvar">Salvar bolão</button>`;
}

function renderLinhaRascunho(aid, a) {
  return `
  <div class="aposta aposta--rascunho">
    <input class="aposta__nome" type="text" value="${esc(a.nome)}" placeholder="Nome do apostador"
           data-draft="nome" data-aid="${aid}" />
    <div class="aposta__linha2">
      <span class="aposta__palpite">
        <input type="number" min="0" max="30" value="${Number(a.palpiteCasa) || 0}"
               data-draft="palpiteCasa" data-aid="${aid}" inputmode="numeric" aria-label="Gols do Brasil" />
        <span>×</span>
        <input type="number" min="0" max="30" value="${Number(a.palpiteFora) || 0}"
               data-draft="palpiteFora" data-aid="${aid}" inputmode="numeric" aria-label="Gols do adversário" />
      </span>
      <button class="icone icone--sm" data-action="rascunho-del-aposta" data-aid="${aid}" aria-label="Remover aposta">✕</button>
    </div>
  </div>`;
}

// ── Diálogo de confirmação (substitui o confirm() nativo) ────────────────────
let confirmCb = null;
function abrirConfirm({ titulo, mensagem, ok = "Excluir", cb }) {
  confirmCb = cb;
  confirmEl.innerHTML = `
  <div class="overlay overlay--confirm" data-action="confirm-cancel">
    <div class="painel painel--confirm" role="alertdialog" aria-modal="true"
         aria-label="${esc(titulo)}" data-stop-confirm>
      <h2>${esc(titulo)}</h2>
      <p class="confirm__msg">${esc(mensagem)}</p>
      <div class="confirm__acoes">
        <button class="btn btn--ghost" data-action="confirm-cancel">Cancelar</button>
        <button class="btn btn--perigo-solido" data-action="confirm-ok">${esc(ok)}</button>
      </div>
    </div>
  </div>`;
  confirmEl.querySelector('[data-action="confirm-ok"]')?.focus();
}
function fecharConfirm() { confirmCb = null; confirmEl.innerHTML = ""; }

function renderLinhaAposta(j, a) {
  const venceu = j.vencedorApostaId === a.id;
  const acertou = bateu(j, a);
  return `
  <div class="aposta aposta--edit ${venceu ? "aposta--venc" : ""} ${acertou ? "aposta--bateu" : ""}">
    <input class="aposta__nome" type="text" value="${esc(a.nome)}" placeholder="Nome"
           data-field="nome" data-jid="${j.id}" data-aid="${a.id}" />
    <div class="aposta__linha2">
      <span class="aposta__palpite">
        <input type="number" min="0" max="30" value="${Number(a.palpiteCasa) || 0}"
               data-field="palpiteCasa" data-jid="${j.id}" data-aid="${a.id}" inputmode="numeric" aria-label="Gols do Brasil" />
        <span>×</span>
        <input type="number" min="0" max="30" value="${Number(a.palpiteFora) || 0}"
               data-field="palpiteFora" data-jid="${j.id}" data-aid="${a.id}" inputmode="numeric" aria-label="Gols do adversário" />
      </span>
      <button class="pago ${a.pago ? "pago--sim" : "pago--nao"}"
              data-action="toggle-pago" data-jid="${j.id}" data-aid="${a.id}"
              aria-pressed="${a.pago ? "true" : "false"}"
              title="${a.pago ? "Pago — clique para marcar como não pago" : "Não pago — clique para marcar como pago"}">${a.pago ? "✓ Pago" : "✗ A pagar"}</button>
      <span class="aposta__fim">
        <button class="estrela ${venceu ? "estrela--on" : ""}" data-action="win"
                data-jid="${j.id}" data-aid="${a.id}" title="Marcar vencedor" aria-label="Marcar vencedor">★</button>
        <button class="icone icone--sm" data-action="del-aposta"
                data-jid="${j.id}" data-aid="${a.id}" aria-label="Remover aposta">✕</button>
      </span>
    </div>
    ${venceu ? `<span class="carimbo">Campeão</span>` : ""}
  </div>`;
}

// ── Ações (delegação de eventos) ─────────────────────────────────────────────
function onClick(e) {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const { action, jid, aid } = el.dataset;

  // não fechar o modal ao clicar dentro dele
  if (action === "close-modal" && e.target.closest("[data-stop]") && !e.target.closest(".icone")) return;
  // clicar no corpo do diálogo de confirmação (fora dos botões) não cancela
  if (action === "confirm-cancel" && e.target.closest("[data-stop-confirm]") && !e.target.closest("button")) return;
  // clicar no corpo do wizard (fora do ✕) não fecha
  if (action === "rascunho-cancelar" && e.target.closest("[data-stop]") && !e.target.closest(".icone")) return;

  switch (action) {
    case "novo-bolao": return novoBolao();
    case "open-jogo": modalJogoId = jid; return renderModal();
    case "close-modal": modalJogoId = null; modalEl.innerHTML = ""; return;
    case "add-aposta": return addAposta(jid);
    case "del-aposta": return pedirExcluirAposta(jid, aid);
    case "del-jogo": return delJogo(jid);
    case "confirm-cancel": return fecharConfirm();
    case "confirm-ok": { const cb = confirmCb; fecharConfirm(); return cb?.(); }
    case "rascunho-cancelar": rascunho = null; etapaRascunho = 1; modalEl.innerHTML = ""; return;
    case "rascunho-continuar": {
      if (!rascunho.adversario.trim()) return aviso("Digite o adversário do Brasil para continuar.");
      etapaRascunho = 2; return renderWizard();
    }
    case "rascunho-voltar": etapaRascunho = 1; return renderWizard();
    case "rascunho-add-aposta": {
      const id = uid();
      rascunho.apostas[id] = {
        criadoEm: Date.now(), nome: "", palpiteCasa: 0, palpiteFora: 0, pago: false,
      };
      renderWizard();
      modalEl.querySelector(`[data-aid="${id}"][data-draft="nome"]`)?.focus();
      return;
    }
    case "rascunho-del-aposta": delete rascunho.apostas[aid]; return renderWizard();
    case "rascunho-salvar": return salvarBolao();
    case "toggle-pago": {
      const a = state.jogos[jid]?.apostas?.[aid];
      if (!a) return;
      return backend.update(`jogos/${jid}/apostas/${aid}`, { pago: !a.pago });
    }
    case "win": {
      const j = state.jogos[jid];
      if (!j) return;
      return backend.update(`jogos/${jid}`, { vencedorApostaId: j.vencedorApostaId === aid ? null : aid });
    }
  }
}

function onKeydown(e) {
  // Esc fecha primeiro o diálogo de confirmação; depois o painel
  if (e.key === "Escape") {
    if (confirmEl.innerHTML) { fecharConfirm(); return; }
    if (rascunho) { rascunho = null; etapaRascunho = 1; modalEl.innerHTML = ""; return; }
    if (modalJogoId) { modalJogoId = null; modalEl.innerHTML = ""; return; }
  }
  // Enter/Espaço abrem a caixinha focada (ela é role="button")
  if (e.key === "Enter" || e.key === " ") {
    const abrir = e.target.closest?.('[data-action="open-jogo"]');
    if (abrir) {
      e.preventDefault();
      modalJogoId = abrir.dataset.jid;
      renderModal();
    }
  }
}

function onChange(e) {
  const el = e.target;
  const num = (v) => Math.max(0, Math.floor(Number(v) || 0));

  // campos do rascunho (bolão em criação) — só na memória, sem tocar no banco
  const d = el.dataset.draft;
  if (d && rascunho) {
    const aid = el.dataset.aid;
    if (aid) {
      const a = rascunho.apostas[aid];
      if (a) a[d] = d === "nome" ? el.value.trim() : num(el.value);
    } else if (d === "fase") {
      rascunho.fase = el.value;
    } else if (d === "adversario") {
      rascunho.adversario = el.value.trim();
    } else if (d === "valorPadrao") {
      rascunho.valorPadrao = num(el.value);
    }
    return;
  }

  const f = el.dataset.field;
  if (!f) return;
  const { jid, aid } = el.dataset;

  // campos do jogo
  if (f === "adversario") return backend.update(`jogos/${jid}`, { adversario: el.value.trim() });
  if (f === "fase") return backend.update(`jogos/${jid}`, { fase: el.value });
  if (f === "valorPadrao") return backend.update(`jogos/${jid}`, { valorPadrao: num(el.value) });
  if (f === "res-casa" || f === "res-fora") return setResultado(jid, f, el.value);

  // campos da aposta
  if (f === "nome") return backend.update(`jogos/${jid}/apostas/${aid}`, { nome: el.value.trim() });
  if (f === "palpiteCasa") return backend.update(`jogos/${jid}/apostas/${aid}`, { palpiteCasa: num(el.value) });
  if (f === "palpiteFora") return backend.update(`jogos/${jid}/apostas/${aid}`, { palpiteFora: num(el.value) });
}

function novoBolao() {
  rascunho = { fase: "grupos", adversario: "", valorPadrao: 10, apostas: {} };
  etapaRascunho = 1;
  renderWizard();
  modalEl.querySelector('[data-draft="adversario"]')?.focus();
}

function salvarBolao() {
  if (!rascunho) return;
  if (!rascunho.adversario.trim()) {
    etapaRascunho = 1; renderWizard();
    return aviso("Digite o adversário do Brasil antes de salvar.");
  }
  const id = uid();
  const jogo = {
    fase: rascunho.fase,
    criadoEm: Date.now(),
    adversario: rascunho.adversario.trim(),
    valorPadrao: Number(rascunho.valorPadrao) || 0,
    resultadoReal: null,
    vencedorApostaId: null,
    apostas: rascunho.apostas,
  };
  rascunho = null;
  etapaRascunho = 1;
  modalEl.innerHTML = "";
  backend.update("jogos", { [id]: jogo }); // só agora aparece para todos
}

function addAposta(jid) {
  const id = uid();
  backend.update(`jogos/${jid}/apostas`, {
    [id]: { criadoEm: Date.now(), nome: "", palpiteCasa: 0, palpiteFora: 0, pago: false },
  });
}

function pedirExcluirAposta(jid, aid) {
  const a = state.jogos[jid]?.apostas?.[aid];
  const quem = a?.nome?.trim();
  abrirConfirm({
    titulo: "Excluir aposta",
    mensagem: quem
      ? `Remover a aposta de "${quem}"? Essa ação não pode ser desfeita.`
      : "Remover esta aposta? Essa ação não pode ser desfeita.",
    ok: "Excluir aposta",
    cb: () => backend.setPath(`jogos/${jid}/apostas/${aid}`, null),
  });
}

function delJogo(jid) {
  const adv = state.jogos[jid]?.adversario?.trim() || "adversário";
  abrirConfirm({
    titulo: "Excluir jogo",
    mensagem: `Excluir o jogo Brasil × ${adv} e todas as apostas dele? Essa ação não pode ser desfeita.`,
    ok: "Excluir jogo",
    cb: () => {
      modalJogoId = null;
      modalEl.innerHTML = "";
      backend.setPath(`jogos/${jid}`, null);
    },
  });
}

function setResultado(jid, campo, valor) {
  const j = state.jogos[jid];
  const atual = j.resultadoReal || { casa: null, fora: null };
  const v = valor === "" ? null : Math.max(0, Math.floor(Number(valor) || 0));
  const novo = campo === "res-casa" ? { ...atual, casa: v } : { ...atual, fora: v };
  if (novo.casa == null && novo.fora == null) return backend.update(`jogos/${jid}`, { resultadoReal: null });
  // preserva null no lado ainda não preenchido (não força 0); só vira placar quando os dois existem
  backend.update(`jogos/${jid}`, { resultadoReal: { casa: novo.casa, fora: novo.fora } });
}

