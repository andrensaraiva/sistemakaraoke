# Karaokê da Casa

Sistema web para pedidos de karaokê pelo celular, fila ao vivo, painel do operador e telão. A reprodução das músicas fica com o operador. A mesa é opcional.

## Ver a demonstração

Requer Node.js 20.19+ ou 22.12+.

```powershell
npm install
npm run dev
```

Sem configuração do Firebase, o projeto abre em **modo demonstração**. Os dados ficam no armazenamento deste navegador e são compartilhados entre abas abertas no mesmo computador. As três telas são:

- `/` ou `/mesa/04`: pedido do cliente. A mesa é opcional; o QR de uma mesa já preenche o número.
- `/operador`: aprovação, escolha da versão, fila, chamada e ausências.
- `/telao`: fila pública e chamada de 10 segundos.

Na demonstração há três cantores fictícios para testar a fila. Para apagar a demonstração, limpe os dados deste site no navegador.

## Conectar ao Firebase gratuito

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com/) no plano **Spark** e registre um aplicativo Web.
2. Ative **Firestore Database** no modo de produção (edição Standard).
3. Em **Authentication → Sign-in method**, ative **E-mail/senha** e **Anônimo**.
4. Em **Authentication → Users**, crie o usuário do operador e copie o **UID** dele.
5. No Firestore, crie a coleção `admins` e um documento cujo ID seja esse UID. Adicione o campo `active` com valor booleano `true`. Esse campo permite acesso ao painel; altere para `false` para revogar. Crie administradores apenas pelo console do Firebase.
6. Copie `.env.example` para `.env.local` e preencha `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID` e `VITE_FIREBASE_APP_ID` com os valores do aplicativo Web. Ajuste `VITE_VENUE_NAME` para o nome do bar.
7. Reinicie `npm run dev`. Entre em `/operador` com a conta criada e abra a primeira noite.

As regras do Firestore estão em `firestore.rules`: clientes podem criar e consultar o próprio pedido, confirmar “Estou indo” e ler a fila pública. Somente operadores cadastrados em `admins` podem aprovar, chamar, registrar falta ou mudar a ordem.

## Publicar

Depois de conectar o projeto Firebase:

```powershell
npx firebase login
npm run build
npx firebase deploy --project SEU_PROJECT_ID --only firestore:rules,hosting
```

O Firebase fornece um endereço `*.web.app` com HTTPS. **Imprima os QR codes pelo site publicado**, pois QR codes gerados no endereço `localhost` não funcionarão nos celulares das mesas.

## Uso no bar

- **Uma TV:** mostre `/telao` entre as músicas e durante a chamada. Troque para o vídeo do YouTube quando o cantor estiver pronto.
- **Duas TVs:** mantenha `/telao` em uma TV e o vídeo da música na outra.
- O operador escolhe e toca o vídeo. O sistema não inicia músicas automaticamente.
- Após os 10 segundos de chamada, o operador pode iniciar a música, dar outra chance ou cancelar o pedido. “Dar outra chance” devolve o pedido para depois do próximo cantor, sem limite automático de faltas. Quando todos perderam uma chamada, o operador pode chamá-los novamente para a fila não travar.
- Cada navegador só consegue manter um pedido ativo por noite. Quando a mesa é informada, a aprovação também impede dois pedidos com o mesmo nome e mesa. Sem mesa, o operador confere possíveis duplicatas pelo nome.
- “Encerrar novos pedidos” preserva a fila atual. “Começar nova noite” cria uma fila nova.

Os avisos no celular aparecem **enquanto a página está aberta**. Notificações quando o navegador está fechado, SMS e WhatsApp não fazem parte desta primeira versão. O telão e a chamada do operador continuam sendo os meios principais de convocação.

## Verificações

```powershell
npm run build
npm run lint
npm test
npm run test:rules
```

`test:rules` inicia o emulador local do Firestore e exige Java 11+; não usa dados do projeto real.
