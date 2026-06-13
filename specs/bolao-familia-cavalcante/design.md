# Design — Bolão "Família Cavalcante"

> Spec-Driven Development · Artefato 2 de 3 (Design técnico + UX)
> Anterior: [`requirements.md`](./requirements.md) · Próximo: [`tasks.md`](./tasks.md)
> A seção 6 (Direção visual) aplica a skill **frontend-design**.

---

## 1. Arquitetura

Front-end **estático de página única** no GitHub Pages + **Firebase Realtime Database**
(plano free) para persistência e sincronização ao vivo. Sem servidor próprio para manter.

```
┌──────── Navegador (cada pessoa) ────────┐        ┌────────── Firebase ──────────┐
│                                         │        │  Realtime Database (free)     │
│   ui (componentes) ◄──── render ────┐   │        │   /bolao/<idSecreto>          │
│        │ ações                      │   │  onValue (ao vivo)                     │
│        ▼                            │   │ ◄────────────────────────────────────  │
│     store.js ── update(caminho) ────┼───┼──────►  escreve só o que mudou          │
│                                         │        │  Regras restritas ao caminho  │
└─────────────────────────────────────────┘        └───────────────────────────────┘
   App servido pelo GitHub Pages (HTML/CSS/JS)
```

- **Link fixo, documento único.** Um caminho com **ID secreto** (`/bolao/<idSecreto>`)
  guarda o bolão da família. O mesmo link sempre; todos veem e editam ao vivo.
- **Fonte da verdade = o Firebase.** O `store.js` assina `onValue` e re-renderiza a cada
  mudança; as ações chamam `update()` em caminhos específicos (escrita granular).
- **Dependências enxutas.** Apenas `firebase/app` e `firebase/database` (SDK modular v9+,
  tree-shakeable). Stack recomendada: **Vanilla TS + Vite** (bundle pequeno, deploy via
  GitHub Actions). *Decisão de baixo risco; não bloqueia a spec.*
- **Render idempotente:** dado o snapshot do banco, a UI é sempre a mesma.

## 2. Modelo de domínio

```ts
type Fase =
  | "grupos" | "r32" | "oitavas" | "quartas"
  | "semis" | "terceiro" | "final";

interface Bolao {
  v: 1;                  // versão do schema (RF8)
  nome: string;          // "Família Cavalcante"
  jogos: Jogo[];
}

interface Jogo {          // a "caixinha" — sempre um jogo do Brasil
  id: string;
  fase: Fase;
  adversario: string;     // "Argentina" (o Brasil é sempre uma das equipes)
  brasilMandante: boolean;// true = "Brasil × adversário"; false = "adversário × Brasil"
  valorPadrao: number;    // entrada sugerida por pessoa (R$)
  resultadoReal?: Placar; // opcional (RF5)
  vencedorApostaId?: string; // marcado pelo organizador (RF6)
  apostas: Aposta[];
}

interface Aposta {
  id: string;
  nome: string;
  palpite: Placar;        // chute de placar
  valorPago: number;      // quanto a pessoa pôs (R$)
  pago: boolean;          // RF4
}

interface Placar { casa: number; fora: number; }
```

**Regras derivadas**
- `premio(jogo) = Σ aposta.valorPago` para apostas com `pago === true` (RF7).
- `bateu(aposta, jogo)` = `resultadoReal` existe e `aposta.palpite == resultadoReal`
  → usado só para **realce visual** (RF5), nunca para decidir o vencedor.
- `vencedor(jogo)` = aposta com `id === vencedorApostaId` (RF6); pode ser indefinido.

## 3. Persistência e sincronização (Firebase — D1/RF8)

- **Produto:** Firebase **Realtime Database**, plano **Spark (free)**. Escolhido sobre o
  Firestore por ser mais simples e leve para sincronizar um documento pequeno ao vivo.
- **Caminho:** `/bolao/<idSecreto>` — um único documento para o bolão da família. O
  `<idSecreto>` é um id difícil de adivinhar (≥16 chars), embutido no app ou no fragmento
  da URL.
- **Leitura ao vivo:** `onValue(ref(db, 'bolao/ID'), snap => render(snap.val()))`.
- **Escrita granular:** cada ação grava só o que mudou, por exemplo:
  `update(ref(db, 'bolao/ID/jogos/<jid>/apostas/<aid>'), { pago: true })`.
- **Bootstrap:** se o documento não existir, criar com a estrutura da campanha do Brasil
  (RF9) e o campo `v` (versão do schema).
- **Config:** as chaves do Firebase (`apiKey`, `databaseURL`, etc.) ficam no código — são
  **públicas por design**; a proteção real vem das **regras**.
- **Regras do Realtime Database (exemplo):** liberar leitura/escrita apenas no caminho do
  bolão e exigir id longo:

  ```json
  {
    "rules": {
      "bolao": {
        "$id": {
          ".read":  "true",
          ".write": "true",
          ".validate": "$id.length >= 16"
        }
      }
    }
  }
  ```

  Como o JS é público, a `apiKey` e o `BOLAO_ID` ficam **visíveis no bundle** — o ID só
  evita que o caminho seja adivinhado sem o link. Reforço **adotado** (sem backend):
  **Firebase App Check (reCAPTCHA v3)** para garantir que só o próprio site escreve, +
  restrição da API key por domínio. App Check **não é login**: quem tem o link do site
  segue podendo editar (cobre R3). Login real só com autenticação (fora do escopo).
- **App Check no código:** `initializeAppCheck(app, { provider: new ReCaptchaV3Provider(SITE_KEY) })`
  logo após `initializeApp`, condicionado à `RECAPTCHA_SITE_KEY`; em `localhost` usa
  `FIREBASE_APPCHECK_DEBUG_TOKEN`. Enforce é habilitado no console (App Check → RTDB).
- **Botão "Copiar link":** `navigator.clipboard.writeText(location.href)` — só para
  convidar a família; o link é fixo e não muda a cada edição.
- **Offline:** o SDK do Realtime Database mantém cache e reconcilia ao reconectar; edições
  feitas offline sincronizam quando a internet volta (RNF2).

## 4. Escopo: só os jogos do Brasil (RF9)

Apenas a **campanha do Brasil** na Copa 2026 — sem calendário das outras seleções. As fases
possíveis (no máximo ~7 jogos):

| Fase (`fase`) | Rótulo na UI | Observações |
|---------------|--------------|-------------|
| `grupos` | Fase de Grupos | **3 jogos** do Brasil no grupo |
| `r32` | 16-avos de final | só se avançar |
| `oitavas` | Oitavas de final | |
| `quartas` | Quartas de final | |
| `semis` | Semifinal | |
| `terceiro` | Disputa de 3º lugar | caminho alternativo |
| `final` | Final | |

O scaffold de fases vive numa constante no código. O organizador adiciona o jogo do Brasil
conforme o adversário é conhecido (Brasil é sempre uma das equipes; só o **adversário** é
digitado). Não há necessidade de cadastrar todos os jogos de uma vez.

## 5. Componentes de UI

- **Cabeçalho (capa)** — foto da família (`family.png`) como capa do "álbum", título do bolão, total arrecadado, botão "Copiar link" e indicador "● ao vivo".
- **Linha do tempo** — caixinhas dos jogos do Brasil em sequência, agrupadas por fase (vertical, mobile-first).
- **Caixinha (card de jogo)** — confronto, placar real (se houver), nº de palpites, prêmio, selo de vencedor.
- **Painel do jogo** (abre a caixinha) — edição de times/valor, resultado real, lista de apostas, ação "marcar vencedor".
- **Linha de aposta** — nome, palpite (placar), valor, toggle pago, realce "bateu", ação vencedor.
- **Estados vazios** — "Nenhum jogo nesta fase ainda. Adicione o primeiro." (voz ativa, RNF5/escrita).

---

## 6. Direção visual (skill: frontend-design)

> Esta seção é o **plano de design**, não código. Ela existe para evitar um visual
> "template de IA" e ancorar tudo no mundo do assunto: **álbum de figurinhas + boletim de
> jogo de uma Copa, na mesa de uma família brasileira.**

### 6.1 Âncora no assunto

O bolão de Copa, no Brasil, tem dois objetos-totem: a **tabelinha de jogos** (aquela folha
que circula na firma/família) e o **álbum de figurinhas Panini**. A direção nasce daí: cada
caixinha é uma **célula de álbum** — o slot onde a "figurinha" (a aposta da pessoa) é colada;
o placar tem cara de **placar de estádio**; o prêmio é o **troféu/cofre** da mesa.
Público: a família Cavalcante, no celular, durante os jogos. Trabalho da página: *bater o
olho e saber quem apostou o quê, quem pagou e quanto está o prêmio.*

A **foto da família** (`family.png`) é a **capa do álbum**: abre a página como a
figurinha-capa, ancorando o bolão na família real — e a parede verde ao fundo da foto
conversa com o verde-gramado da paleta. Tratamento: cantos arredondados de figurinha, fina
borda foil e um leve gradiente do azul-noite na base para o título assentar por cima.

### 6.2 Sistema de tokens

**Cor — paleta nomeada (não é o default creme+serifa+terracota, nem preto+verde-ácido):**

| Token | Hex | Uso |
|-------|-----|-----|
| `--noite-arquibancada` | `#101A2E` | Fundo principal (azul-noite de jogo à noite) |
| `--gramado` | `#1F8A5B` | Verde-campo — fase ativa, "pago", confirmações |
| `--foil-trofeu` | `#F2C14E` | Dourado de figurinha foil — **vencedor, prêmio, destaques** |
| `--bilhete` | `#E4572E` | Vermelho-bilhete — alertas, "não pago", carimbos |
| `--papel-album` | `#F4EEE0` | Papel da figurinha — superfície das caixinhas |
| `--giz` | `#E8EDF4` | Texto sobre fundo escuro (linha de giz no gramado) |
| `--grafite` | `#1A1A1A` | Texto sobre papel |

O dourado é a **única cor "cara"** e aparece com parcimônia: só prêmio e vencedor. Verde e
vermelho carregam significado (pago/não pago, acerto/erro), não decoração.

**Tipografia — três papéis:**

- **Display:** `Bricolage Grotesque` (700/800) — confrontos, números do placar, valor do
  prêmio. Tem personalidade (não é Inter/Oswald genérico) e segura bem números grandes.
- **Texto/UI:** `Hanken Grotesk` (400/500/600) — labels, nomes, botões. Neutra mas com
  calor, ótima legibilidade no celular.
- **Dados/placar:** `Spline Sans Mono` — placares (`2 × 1`) e valores tabulares, para o ar
  de **scoreboard** e alinhamento de dígitos.

Escala (mobile-first): 13 / 15 / 18 / 24 / 34 / 48. Pesos e tracking deliberados:
display apertado (`-0.02em`), mono levemente espaçado para o placar respirar.

**Layout — conceito:**
Quadro horizontal estilo álbum/Trello. Colunas = fases; dentro, **células de figurinha**.
A coluna da fase em foco recebe a borda de giz; as demais ficam mais quietas.

### 6.3 Wireframes (ASCII)

Capa + linha do tempo (mobile, rolagem vertical; a foto `family.png` é a capa do álbum):

```
┌────────────────────────────────────────────┐
│  BOLÃO  ·  Família Cavalcante      [link⧉]  │
│  Prêmio total em jogo:  R$ 240,00 (foil)    │
├────────────────────────────────────────────┤
│  ◀  FASE DE GRUPOS                         │  ← borda de giz na fase ativa
│  ┌──────────── caixinha ───────────────┐    │
│  │  BRASIL   2 × 1   SÉRVIA             │    │  ← display + mono (placar real)
│  │  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄  │    │
│  │  6 palpites · prêmio R$ 60,00        │    │
│  │  ★ Vencedor: Tio Zé        (foil)    │    │
│  └──────────────────────────────────────┘    │
│  ┌──────────────────────────────────────┐    │
│  │  BRASIL   — × —   a definir           │    │
│  │  + adicionar palpite                  │    │
│  └──────────────────────────────────────┘    │
│  + novo jogo do Brasil                        │
└────────────────────────────────────────────┘
```

Painel do jogo (figurinhas/apostas):

```
┌──────── Brasil 2 × 1 Argentina ─────────┐
│  Resultado real: [2]×[1]   Valor: R$10   │
│  ────────────────────────────────────    │
│   pessoa     palpite   valor   pago  ✓   │
│   Tio Zé      2 × 1     R$10    ●    ★    │ ← "bateu" realça verde; ★ = vencedor (foil)
│   Ana         1 × 1     R$10    ●         │
│   Léo         3 × 2     R$10    ○ (verm.) │ ← não pago, vermelho-bilhete
│  ────────────────────────────────────    │
│   + adicionar aposta                      │
│   Prêmio (só pagos): R$ 20,00             │
└──────────────────────────────────────────┘
```

### 6.4 Elemento-assinatura

**O carimbo de campeão.** Quando o organizador marca o vencedor, a figurinha daquela
pessoa recebe um **carimbo foil de "CAMPEÃO"** (rotação sutil, textura de foil dourado) —
o gesto que todo álbum de Copa tem quando a figurinha "rara" é colada. É o único momento
ostensivo da interface; todo o resto fica disciplinado ao redor dele. Em
`prefers-reduced-motion`, o carimbo aparece sem animação.

### 6.5 Movimento (comedido)

- Troca de coluna de fase: deslize curto com *snap* (serve à navegação, não enfeite).
- Marcar vencedor: o carimbo "assenta" (≤250ms) — momento orquestrado único.
- Toggle pago: micro-transição de cor verde↔vermelho.
- Tudo respeita `prefers-reduced-motion` (RNF5).

### 6.6 Autocrítica (passo de revisão da skill)

- **O que evitei e por quê:** os três clichês de design-IA — (1) creme + serifa de alto
  contraste + terracota, (2) preto + verde-ácido, (3) jornal com fios capilares. Nenhum
  fala "Copa/família/figurinha"; a paleta azul-noite + foil + gramado é escolha do brief,
  não default.
- **Onde gastei a ousadia:** num só lugar — o carimbo de campeão. O resto é quieto.
- **"Tire um acessório" (Chanel):** marcadores numéricos `01/02/03` foram **cortados** —
  a ordem dos jogos não carrega informação que o leitor precise; numerar seria decoração.
- **Piso de qualidade silencioso:** responsivo até o celular, foco de teclado visível,
  contraste AA, movimento reduzido respeitado.

### 6.7 Tom de escrita (voz da interface)

Português-BR, conversa de família, verbo no presente e voz ativa. Botões dizem o que
acontece: **"Copiar link"**, **"Marcar vencedor"**, **"Adicionar aposta"**. Vazios convidam
à ação ("Adicione o primeiro jogo"). Erros explicam e orientam, sem pedir desculpas
("Coloque um nome para a aposta"). Valores sempre em **R$** com formato pt-BR.

---

## 7. Acessibilidade, responsivido e offline

- **Mobile-first**; board com scroll-snap horizontal; alvos de toque ≥ 44px.
- **Teclado:** tab order lógico, foco visível com anel de `--foil-trofeu`.
- **Contraste AA** verificado para giz/papel sobre os fundos.
- **`prefers-reduced-motion`:** desliga deslizes e o assentar do carimbo.
- **Offline:** sem dependência de rede em runtime; opcional Service Worker simples para
  cache do app (evolução).

## 8. Rastreabilidade

Cada componente/decisão atende requisitos de [`requirements.md`](./requirements.md) e é
quebrado em passos em [`tasks.md`](./tasks.md).
