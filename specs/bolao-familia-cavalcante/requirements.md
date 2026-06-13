# Requisitos — Bolão "Família Cavalcante"

> Spec-Driven Development · Artefato 1 de 3 (Requisitos)
> Fonte original do brief: [`../../spec`](../../spec)
> Próximos artefatos: [`design.md`](./design.md) · [`tasks.md`](./tasks.md)

## 1. Visão

Um site **simples, familiar e privado** para gerenciar o bolão da Copa do Mundo 2026
da Família Cavalcante. Sem servidor e sem login: tudo roda no navegador e é hospedado
no **GitHub Pages**. A organização lembra um quadro estilo Trello — **"caixinhas"**, onde
cada caixinha é o bolão de **um jogo**. O organizador cadastra os palpites de placar de
cada pessoa, controla quem pagou, registra o resultado real, marca o vencedor e o site
mostra o **prêmio** (soma do que foi pago) que o ganhador leva.

## 2. Decisões de produto (definidas com o cliente)

| # | Tema | Decisão |
|---|------|---------|
| D1 | **Persistência** | **Firebase Realtime Database (plano free/Spark)**. Documento único para o bolão da família; **link fixo**; todos veem e editam **ao vivo**. App segue hospedado no GitHub Pages (sem servidor próprio). |
| D2 | **Como o vencedor é definido** | O **organizador marca o vencedor manualmente**. O site apoia mostrando palpites × resultado real, mas não pontua automaticamente. |
| D3 | **O que é a aposta** | **Placar de cada jogo do Brasil** (ex.: Brasil 2 × 1 adversário). Cada pessoa chuta um placar; o resultado real é registrado para conferência. |
| D4 | **Escopo dos jogos** | **Apenas os jogos do Brasil** na Copa 2026 — sem calendário das outras seleções. Fases possíveis da campanha do Brasil: 3 jogos de grupo, 16-avos, oitavas, quartas, semifinal, 3º lugar e final. O organizador adiciona o jogo e o adversário conforme o Brasil avança. |

## 3. Personas

- **Organizador** (ex.: o tio que toca o bolão) — fonte única da verdade. Cria/edita
  jogos, cadastra apostas, marca pagamento, lança o resultado real, marca o vencedor e
  compartilha o link atualizado.
- **Participante** — recebe o link, abre no celular e confere seu palpite, se está pago,
  o tamanho do prêmio e quem ganhou. Não precisa instalar nem logar.

> Como não há servidor, **não há papéis com permissão real**: qualquer pessoa com o link
> consegue editar a própria cópia. O organizador é, por convenção, quem mantém e
> redistribui a versão oficial. Ver restrição R3.

## 4. Histórias de usuário e critérios de aceite

Critérios em notação **EARS** (Easy Approach to Requirements Syntax):
`QUANDO <gatilho> O SISTEMA DEVE <resposta>` / `ENQUANTO <estado>` / `SE <condição> ENTÃO`.

### RF1 — Linha do tempo de caixinhas (campanha do Brasil)
*Como família, quero ver os jogos do Brasil em sequência, como caixinhas estilo Trello.*
- O SISTEMA DEVE exibir os jogos do Brasil como **caixinhas em uma linha do tempo** agrupada por fase: Fase de Grupos (3 jogos), 16-avos, Oitavas, Quartas, Semifinal, Disputa de 3º, Final.
- Cada **caixinha** DEVE representar **um jogo do Brasil** e mostrar: confronto (Brasil × adversário), nº de palpites, valor do prêmio acumulado e selo de vencedor (se houver).
- QUANDO o organizador adiciona um jogo O SISTEMA DEVE criar uma nova caixinha na fase correspondente.
- ENQUANTO uma caixinha não tiver o adversário definido O SISTEMA DEVE exibi-la como "Brasil × a definir".

### RF2 — Definir adversário e valor de um jogo
*Como organizador, quero definir o adversário do Brasil e quanto cada um paga, para configurar o bolão do jogo.*
- QUANDO o organizador abre uma caixinha O SISTEMA DEVE assumir o **Brasil** como uma das equipes e permitir informar o **adversário** (e, se quiser, quem joga como mandante).
- O SISTEMA DEVE permitir definir um **valor padrão de entrada** para o jogo (ex.: R$ 10), reutilizado como sugestão por participante.
- SE um valor for inválido (negativo ou não numérico) ENTÃO O SISTEMA DEVE rejeitar a entrada e manter o último valor válido.

### RF3 — Cadastrar apostas (palpites de placar)
*Como organizador, quero registrar o nome da pessoa e o placar que ela apostou.*
- QUANDO o organizador adiciona uma aposta O SISTEMA DEVE registrar **nome**, **palpite de placar** (gols mandante × gols visitante) e **valor pago**.
- O SISTEMA DEVE permitir editar e remover uma aposta.
- SE o nome estiver vazio ENTÃO O SISTEMA DEVE impedir o cadastro e sinalizar o campo.
- O SISTEMA DEVE aceitar placares de 0 a um teto razoável (ex.: 0–20) por lado.

### RF4 — Controlar pagamento
*Como organizador, quero marcar quem já pagou, para saber quanto entrou no prêmio.*
- O SISTEMA DEVE permitir alternar o estado **pago / não pago** de cada aposta.
- O SISTEMA DEVE destacar visualmente apostas não pagas.
- O prêmio (RF7) DEVE considerar **apenas apostas pagas**.

### RF5 — Registrar resultado real
*Como organizador, quero lançar o placar real do jogo, para conferir contra os palpites.*
- QUANDO o organizador informa o **resultado real** O SISTEMA DEVE exibi-lo no topo da caixinha.
- O SISTEMA DEVE realçar, na lista, os palpites que **bateram** com o resultado real (apoio visual para a decisão do organizador).
- O resultado real é **opcional** e pode ser editado a qualquer momento.

### RF6 — Marcar o vencedor (decisão do organizador)
*Como organizador, quero apontar quem ganhou aquele bolão, para liberar o prêmio.*
- QUANDO o organizador marca uma aposta como **vencedora** O SISTEMA DEVE registrar o vencedor daquele jogo e exibir um selo de destaque.
- O SISTEMA DEVE permitir **trocar** ou **limpar** o vencedor.
- SE não houver vencedor marcado ENTÃO O SISTEMA DEVE manter o prêmio como "em aberto".

### RF7 — Calcular o prêmio
*Como participante, quero ver o valor que o ganhador leva.*
- O SISTEMA DEVE calcular o **prêmio do jogo** como a **soma dos valores pagos** das apostas com estado "pago".
- O SISTEMA DEVE exibir o prêmio em **Reais (R$)**, formato pt-BR.
- QUANDO houver vencedor O SISTEMA DEVE exibir "**\<Nome\> leva R$ \<valor\>**".

### RF8 — Sincronização ao vivo (link fixo)
*Como família, queremos abrir sempre o mesmo link e ver o bolão atualizado, sem copiar e colar nada.*
- O SISTEMA DEVE guardar o bolão num documento único no **Firebase Realtime Database** (plano free).
- QUANDO qualquer pessoa edita O SISTEMA DEVE refletir a mudança **em tempo real** para todos com o link aberto.
- O SISTEMA DEVE usar um **link fixo** (o mesmo sempre); não há recompartilhamento a cada edição.
- O SISTEMA DEVE oferecer um botão **"Copiar link"** apenas para convidar a família (o link não muda).
- SE o documento ainda não existir ENTÃO O SISTEMA DEVE criá-lo com a estrutura da Copa 2026.
- O SISTEMA DEVE funcionar **sem login** e versionar o formato dos dados (campo `v`).

### RF9 — Apenas os jogos do Brasil (Copa 2026)
*Como família, queremos acompanhar só o Brasil, sem o calendário das outras seleções.*
- O SISTEMA DEVE focar exclusivamente nos **jogos do Brasil**; não há calendário das demais seleções.
- O SISTEMA DEVE oferecer as fases possíveis da campanha do Brasil: 3 jogos da fase de grupos, 16-avos, oitavas, quartas, semifinal, disputa de 3º lugar e final.
- O SISTEMA DEVE permitir adicionar os jogos conforme o Brasil avança (sem precisar de todos de uma vez).

### RF10 — Identidade do projeto
- O SISTEMA DEVE exibir o título **Bolão "Família Cavalcante"**.
- O SISTEMA DEVE usar a foto da família (`family.png`) como capa/identidade, conforme [`design.md`](./design.md) §6.
- O SISTEMA DEVE seguir a direção visual definida em [`design.md`](./design.md).

## 5. Requisitos não-funcionais

- **RNF1 — Front estático + BaaS:** app estático no GitHub Pages; persistência via Firebase (backend gerenciado, sem servidor próprio para manter).
- **RNF2 — Offline tolerante:** o SDK do Realtime Database mantém cache; edições offline sincronizam quando a internet volta.
- **RNF3 — Privacidade:** os dados do bolão (nomes, palpites, quem pagou) ficam num banco do **Firebase (Google)**, não em servidor próprio. Sem analytics próprios e sem outros terceiros. Trade-off aceito em troca do link fixo + sincronização ao vivo.
- **RNF4 — Mobile-first:** uso principal no celular; layout responsivo.
- **RNF5 — Acessibilidade:** foco visível, navegação por teclado, contraste AA, `prefers-reduced-motion` respeitado.
- **RNF6 — Localização:** interface em português-BR; valores em R$.
- **RNF7 — Leveza:** bundle enxuto, carregamento rápido em rede móvel.

## 6. Restrições e fora de escopo

- **R1 — Dependência do Firebase:** os dados ficam num projeto Firebase (Google), plano free. Requer criar o projeto e configurar as chaves públicas do app. Se o Firebase ficar indisponível, o bolão não carrega.
- **R2 — Pontuação automática fora de escopo:** por decisão (D2), o vencedor é manual; o site só apoia a conferência.
- **R3 — Sem login; o "portão" é a URL do site:** qualquer pessoa com o link **edita ao vivo** (não há papéis). Como o JS é servido ao navegador, as chaves do Firebase e o `BOLAO_ID` são **públicos** (visíveis no código publicado) — repositório privado não esconde isso. O `BOLAO_ID` aleatório só evita que o caminho do banco seja adivinhado sem ter o link. Proteção base = regras do Realtime Database travadas no caminho. Reforço opcional sem backend: **Firebase App Check** (garante que só o seu site escreve), restrição da API key por domínio. Adequado a dados não sensíveis de um bolão de família.
- **R4 — Cotas do plano free (Spark):** há limites de conexões simultâneas e tráfego, folgados muito acima do que um bolão de família consome.

## 7. Rastreabilidade

Cada requisito acima é endereçado por tarefas em [`tasks.md`](./tasks.md) e por decisões de
arquitetura/UX em [`design.md`](./design.md).
