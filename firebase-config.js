// ───────────────────────────────────────────────────────────────────────────
// Configuração do Firebase
//
// Enquanto as chaves estiverem como "COLE_AQUI", o app roda em MODO LOCAL
// (salva no próprio navegador via localStorage) — útil para testar a interface.
//
// Para ligar a sincronização ao vivo entre todos os celulares da família:
//   1. Crie um projeto em https://console.firebase.google.com
//   2. Ative o "Realtime Database"
//   3. Copie as chaves do app web e cole abaixo
//   4. Publique as regras do arquivo database.rules.json
// Passo a passo completo no README.md.
// ───────────────────────────────────────────────────────────────────────────

export const firebaseConfig = {
  apiKey: "AIzaSyAhQSgzeyHOWelEF0BhUxTd0Ghv7oiSklY",
  authDomain: "bolao-firebase.firebaseapp.com",
  databaseURL: "https://bolao-firebase-default-rtdb.firebaseio.com",
  projectId: "bolao-firebase",
  storageBucket: "bolao-firebase.firebasestorage.app",
  messagingSenderId: "965873880751",
  appId: "1:965873880751:web:76a3560e236586763c4e5a",
};

// ID FIXO do bolão (é o caminho no banco: /bolao/<ID>).
// ATENÇÃO: este arquivo é servido ao navegador, então o ID fica VISÍVEL no código
// publicado (View Source / DevTools). Ou seja, NÃO é um segredo de verdade — deixar o
// repositório privado também não esconde, porque o navegador baixa o JS.
// O que ele faz: evita que alguém ADIVINHE o caminho sem ter o link do seu site.
// O controle de acesso real é: compartilhe a URL do site só na família (sem login, quem
// tem o link edita). Para reforçar de verdade, veja a seção "Segurança" no README.
export const BOLAO_ID = "cavalcante-7ecb1443fa35e032febfcf10";

// App Check (reCAPTCHA v3) — reforço de segurança (recomendado).
// Deixe "COLE_AQUI" para NÃO ativar (o app funciona normal sem isso). Para ligar:
//   1. Crie uma chave reCAPTCHA v3 em https://www.google.com/recaptcha/admin
//      (tipo v3; domínios: SEU-USUARIO.github.io e localhost para testar)
//   2. No Firebase: Build → App Check → registre o app web com provedor reCAPTCHA v3
//      (lá você cola a CHAVE SECRETA do reCAPTCHA)
//   3. Cole AQUI a "site key" (a parte PÚBLICA do reCAPTCHA)
//   4. Em App Check → Realtime Database, clique em "Aplicar" (Enforce)
// Passo a passo no README (seção Segurança).
export const RECAPTCHA_SITE_KEY = "COLE_AQUI";
