# Bolão "Família Cavalcante" ⚽

Site simples para o bolão da Copa 2026 — **só os jogos do Brasil**. Sem login, roda no
navegador, hospedado no GitHub Pages. Todos abrem o **mesmo link** e veem tudo **em tempo
real** (via Firebase).

Cada caixinha é o bolão de um jogo (Brasil × adversário). O fluxo é: você cria o bolão
(adversário, fase e **valor por pessoa**), adiciona as apostas (nome + palpite de placar),
salva, e durante/depois do jogo lança o **resultado real** e aponta o **vencedor**. O
**prêmio = valor por pessoa × nº de apostadores**.

> Spec completa (Spec-Driven Development) em
> [`specs/bolao-familia-cavalcante/`](specs/bolao-familia-cavalcante/).

## Como funciona (do ponto de vista de quem usa)

1. **+ Novo bolão** abre um assistente de **2 passos**:
   - **Passo 1** — dados do jogo: adversário, fase e valor por pessoa.
   - **Passo 2** — apostas: nome do apostador + palpite de placar (Brasil × adversário).
   - Nada é gravado até clicar em **Salvar bolão** — só então ele aparece para todos
     (evita bolões vazios na tela de todo mundo).
2. Cada bolão salvo vira uma **caixinha** na linha do tempo, agrupada por fase, já
   mostrando a lista de palpites.
3. Abrindo a caixinha você **edita ao vivo**: ajusta apostas, marca quem **pagou** (★/✕),
   lança o **resultado real** e marca o **vencedor**. Exclusões pedem **confirmação**.

### Dois modos de persistência

- **Modo ao vivo** (Firebase configurado): todos os aparelhos compartilham o mesmo bolão
  em tempo real.
- **Modo local** (sem Firebase): salva no `localStorage` do próprio navegador — ótimo para
  testar a interface. A capa avisa "● modo local (só neste aparelho)".

## Rodar localmente

Qualquer servidor estático serve (módulos ES não funcionam via `file://`):

```bash
python3 -m http.server 5173
# abra http://localhost:5173
```

## Arquitetura

App **estático, sem build e sem framework** — HTML + um módulo ES + CSS. Pensado para
caber no GitHub Pages e ser fácil de manter.

- **`index.html`** — casca mínima: monta `#app` (conteúdo), `#modal-root` (painel/wizard) e
  `#confirm-root` (diálogo de confirmação), e carrega `app.js` como `<script type="module">`.
- **Renderização a partir do estado.** Há um único `state` (o documento do bolão). Funções
  `render*()` geram HTML por template string e o injetam; não há DOM diferencial nem libs.
- **Camada de persistência plugável.** `criarBackend()` devolve uma interface comum
  (`subscribe`, `update`, `setPath`, `modo`):
  - **Firebase** — SDK 10.x carregado **sob demanda via CDN** (`import()` dinâmico), usando
    o **Realtime Database**. Toda escrita é protegida (`.catch`) e avisa por *toast* em vez
    de falhar em silêncio. Se o CDN/Firebase falhar, cai para o modo local.
  - **Local** — implementa a mesma interface sobre `localStorage` (com escrita por caminho
    e sincronização entre abas via evento `storage`).
- **Eventos por delegação.** Um único `onClick`/`onChange`/`onKeydown` no `document` trata
  tudo via atributos `data-action` / `data-field` / `data-draft`. Acessível: caixinhas
  abrem por teclado (Enter/Espaço) e `Esc` fecha diálogos.
- **Criação por rascunho.** O wizard de novo bolão vive em memória (`rascunho`) e só é
  gravado no banco ao salvar; a edição de um bolão existente grava a cada alteração.
- **Segurança/identidade** ficam isoladas em `firebase-config.js`; as regras do banco em
  `database.rules.json`.

### Modelo de dados

```
bolao/<BOLAO_ID>
├─ nome                         "Família Cavalcante"
└─ jogos/<jogoId>
   ├─ adversario                "Sérvia"
   ├─ fase                      "grupos" | "oitavas" | ... | "final"
   ├─ valorPadrao               valor por pessoa (R$)
   ├─ criadoEm                  timestamp
   ├─ resultadoReal             { casa, fora } | null   (Brasil = casa)
   ├─ vencedorApostaId          id da aposta vencedora | null
   └─ apostas/<apostaId>
      ├─ nome                   "Tio João"
      ├─ palpiteCasa            gols do Brasil
      ├─ palpiteFora            gols do adversário
      ├─ pago                   boolean (controle de cobrança)
      └─ criadoEm               timestamp
```

Brasil é **sempre o mandante** (lado esquerdo do placar). O **prêmio é derivado**
(`valorPadrao × nº de apostas`), não armazenado. O vencedor é **manual** — não há
pontuação automática.

## Passo 1 — Configurar o Firebase (sincronização ao vivo)

1. Acesse <https://console.firebase.google.com> e crie um projeto (plano **gratuito/Spark**).
2. No menu **Build → Realtime Database**, clique em **Criar banco de dados**
   (pode escolher a região mais próxima; comece em "modo bloqueado").
3. Em **Project settings → Seus apps**, registre um **app da Web** e copie o objeto
   `firebaseConfig`.
4. Cole as chaves em [`firebase-config.js`](firebase-config.js) e troque `BOLAO_ID` por um
   id secreto seu (16+ caracteres).
5. Na aba **Regras** do Realtime Database, cole o conteúdo de
   [`database.rules.json`](database.rules.json) e **publique**.

## Segurança (importante)

Como o site é estático e público, **todo o JavaScript é baixado pelo navegador** — então
as chaves do Firebase **e o `BOLAO_ID` ficam visíveis** para quem abrir o site (View
Source / DevTools). Deixar o repositório privado **não** muda isso.

Na prática, o modelo é: **sem login, quem tem o link do site edita.** O "portão" é a
**URL do site** — compartilhe só na família. O `BOLAO_ID` aleatório só evita que alguém
descubra seu banco sem ter o link. Para um bolão de família (nomes, palpites, quem pagou)
isso costuma ser suficiente.

Reforços (já preparados no código):

- **Regras de validação no banco** (`database.rules.json`) — tipam e limitam o tamanho de
  cada campo, evitando payloads abusivos. Já incluso.
- **Firebase App Check** (reCAPTCHA v3) — garante que só o *seu* site escreve no banco.
  Já está no `app.js`; ativa sozinho quando você preencher a `RECAPTCHA_SITE_KEY`.
- **Restringir a API key por domínio** no Google Cloud.
- E sempre: não publicar a URL do site fora da família.

> App Check bloqueia bots/uso fora do site; ele **não** cria login — quem tem o link do
> site continua podendo editar. Não guarde dados sensíveis aqui.

### Ativar o App Check (reCAPTCHA v3)

1. Crie uma chave **reCAPTCHA v3** em <https://www.google.com/recaptcha/admin>
   (tipo *v3*; em domínios adicione `SEU-USUARIO.github.io` e `localhost`).
   Você recebe duas chaves: **site key** (pública) e **secret key**.
2. No Firebase: **Build → App Check → Apps → registrar** o app web com provedor
   **reCAPTCHA v3** e cole lá a **secret key**.
3. Cole a **site key** (pública) em `RECAPTCHA_SITE_KEY` no `firebase-config.js`.
4. Em **App Check → Realtime Database**, clique em **Aplicar** (Enforce).
5. Testar no `localhost`: abra o site, no **console do navegador** vai aparecer um
   *App Check debug token*. Copie-o em **App Check → ⋮ → Gerenciar tokens de debug**.
   (No `github.io` não precisa disso — o reCAPTCHA funciona direto.)

### Restringir a API key por domínio

Google Cloud Console → **APIs e Serviços → Credenciais** → sua *Browser key* →
**Restrições de aplicativo → Sites** → adicione `https://SEU-USUARIO.github.io/*`.

## Passo 2 — Publicar no GitHub Pages

1. Crie um repositório no GitHub e envie estes arquivos.
2. Em **Settings → Pages**, em **Build and deployment**, escolha **Deploy from a branch**,
   branch `main` e pasta `/ (root)`. Salve.
3. Aguarde ~1 min: o site fica em `https://SEU-USUARIO.github.io/SEU-REPO/`.
4. Mande esse link no grupo da família. Pronto. 🎉

## Estrutura

```
index.html            # casca da página (#app, #modal-root, #confirm-root)
app.js                # lógica: estado, backends (Firebase/local), render, ações, wizard
styles.css            # direção visual (capa, figurinhas, placar, carimbo de campeão)
firebase-config.js    # suas chaves do Firebase + BOLAO_ID  ← edite aqui
database.rules.json   # regras para colar no Realtime Database
assets/
└─ family.png         # foto da família (capa do "álbum")
specs/                # Spec-Driven Development: requisitos, design, tarefas
```
