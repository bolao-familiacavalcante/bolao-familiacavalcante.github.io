# Plano de implementação — Bolão "Família Cavalcante"

> Spec-Driven Development · Artefato 3 de 3 (Tarefas)
> Anteriores: [`requirements.md`](./requirements.md) · [`design.md`](./design.md)
> Cada tarefa referencia os requisitos (RFx/RNFx) que satisfaz.

## Fase 0 — Fundação do projeto
- [ ] **T0.1** Inicializar repositório git e estrutura (`index.html`, `src/`, `specs/`). *(RNF1)*
- [ ] **T0.2** Definir stack: Vanilla TS + Vite e adicionar Firebase SDK modular (`firebase/app`, `firebase/database`). *(RNF1, RNF7, RF8)*
- [ ] **T0.3** Configurar deploy no GitHub Pages via GitHub Actions (build → Pages), com `base` correto do Vite. *(RNF1)*
- [ ] **T0.4** Carregar fontes (Bricolage Grotesque, Hanken Grotesk, Spline Sans Mono) com `font-display: swap`. *(design §6.2, RNF7)*
- [ ] **T0.5** Criar projeto Firebase, ativar Realtime Database e publicar as **regras** restritas a `/bolao/<id>`. *(D1, RF8, R3, design §3)*
- [ ] **T0.6** Adicionar `family.png` aos assets e otimizar (tamanho/responsivo). *(RF10, design §6.1)*

## Fase 1 — Domínio e estado
- [ ] **T1.1** Implementar tipos `Bolao/Jogo/Aposta/Placar` e funções puras `premio`, `bateu`, `vencedor`. *(design §2, RF7)*
- [ ] **T1.2** Constante com as fases da campanha do Brasil (grupos×3, 16-avos…final). *(RF9)*
- [ ] **T1.3** `store.js`: assina `onValue` do documento e re-renderiza; expõe ações de escrita granular (`update`). *(design §1, §3)*
- [ ] **T1.4** Camada Firebase: init do app, refs por caminho, helpers de leitura/escrita. *(RF8, D1, design §3)*
- [ ] **T1.5** Bootstrap: se o documento não existir, criar com as fases do Brasil e campo `v`. *(RF8, RF9)*
- [ ] **T1.6** Regras do Realtime Database restritas a `/bolao/<id>` (+ validação de id). *(R3, design §3)*
- [ ] **T1.7** Testes das funções puras (premio/bateu/vencedor) e do bootstrap. *(qualidade)*

## Fase 2 — UI base (quadro de caixinhas)
- [ ] **T2.1** Cabeçalho/capa: foto `family.png`, título, arrecadação total, botão "Copiar link", indicador "● ao vivo". *(RF10, RF8, design §6.1)*
- [ ] **T2.2** Linha do tempo vertical por fase (mobile-first). *(RF1, RNF4)*
- [ ] **T2.3** Caixinha de jogo: Brasil × adversário, placar real, nº de palpites, prêmio, selo de vencedor. *(RF1, RF7)*
- [ ] **T2.4** Ação "novo jogo do Brasil" por fase; estado vazio convidativo. *(RF1, RF2)*

## Fase 3 — Edição do jogo e apostas
- [ ] **T3.1** Painel do jogo: editar adversário (Brasil fixo), mando e valor padrão (com validação). *(RF2)*
- [ ] **T3.2** CRUD de apostas: nome, palpite de placar, valor pago (validações RF3). *(RF3)*
- [ ] **T3.3** Toggle pago/não pago com destaque visual. *(RF4)*
- [ ] **T3.4** Resultado real (opcional) + realce dos palpites que "bateram". *(RF5)*
- [ ] **T3.5** Marcar/trocar/limpar vencedor; prêmio "em aberto" quando não houver. *(RF6)*
- [ ] **T3.6** Cálculo e exibição do prêmio (só pagos) em R$ pt-BR. *(RF7)*

## Fase 4 — Direção visual (skill frontend-design)
- [ ] **T4.0** Capa com `family.png`: cantos de figurinha, borda foil, gradiente azul-noite na base p/ o título. *(design §6.1)*
- [ ] **T4.1** Aplicar tokens de cor/tipografia (design §6.2) via CSS custom properties. *(design §6)*
- [ ] **T4.2** Placar estilo scoreboard (mono) e cartão estilo figurinha (papel). *(design §6.3)*
- [ ] **T4.3** Elemento-assinatura: carimbo foil de "Campeão" ao marcar vencedor. *(design §6.4)*
- [ ] **T4.4** Movimento comedido (snap de fase, assentar do carimbo) + `prefers-reduced-motion`. *(design §6.5, RNF5)*
- [ ] **T4.5** Revisão/autocrítica visual contra os clichês de design-IA (screenshots). *(design §6.6)*

## Fase 5 — Qualidade e acabamento
- [ ] **T5.1** Acessibilidade: foco visível, navegação por teclado, contraste AA. *(RNF5)*
- [ ] **T5.2** Responsividade mobile→desktop; alvos de toque ≥44px. *(RNF4)*
- [ ] **T5.3** Revisão de textos da interface (voz ativa, pt-BR). *(design §6.7, RNF6)*
- [ ] **T5.4** Verificar privacidade: só tráfego para o Firebase; sem analytics/terceiros. *(RNF3)*
- [ ] **T5.4a** App Check (reCAPTCHA v3) no código + registrar no Firebase + **Enforce** no RTDB. *(R3, design §3)*
- [ ] **T5.4b** Restringir a *Browser API key* por domínio (`*.github.io`) no Google Cloud. *(R3)*
- [ ] **T5.5** (Opcional) Service Worker para cache offline do app. *(RNF2)*
- [ ] **T5.6** Teste de ponta a ponta em dois aparelhos: editar num → aparece no outro ao vivo; criar jogo → apostas → pago → resultado → vencedor. *(RF1–RF8)*

## Evoluções (fora do escopo atual)
- Anonymous Auth + regras por `auth != null`, ou PIN simples. *(R3)*
- Backup manual exportando `.json` do documento. *(R4)*
- Pontuação automática opcional (placar exato/acerto de vencedor). *(supera D2)*

## Definição de pronto (DoD)
Uma tarefa está pronta quando: atende ao(s) requisito(s) citado(s); funciona no celular;
respeita acessibilidade e movimento reduzido; e a mudança feita num aparelho aparece em
outro **ao vivo** via Firebase.
