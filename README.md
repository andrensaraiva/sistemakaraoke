# Karaokê da Casa

Sistema web para pedidos de karaokê pelo celular, fila ao vivo, painel do operador e telão com vídeo do YouTube. A mesa é opcional.

## Projeto Firebase ativo

Esta instalação está ligada ao projeto `sistemakaraoke-andre` no plano Spark. O Firestore Standard fica em São Paulo (`southamerica-east1`), com autenticação anônima para clientes e e-mail/senha para operadores.

- Site: https://karaokedacasa.web.app
- Operador: https://karaokedacasa.web.app/operador
- Telão: https://karaokedacasa.web.app/telao

O endereço anterior `https://sistemakaraoke-andre.web.app` continua ativo como site padrão do mesmo projeto Firebase. O alvo `karaoke` em `.firebaserc` publica somente no novo endereço.

Nesta máquina, `.env.local` contém a configuração do aplicativo Web e `.operator-credentials.local` contém o acesso inicial do operador. Esses arquivos são ignorados pelo Git. A primeira noite foi aberta para validar o site. O painel mostra se novos pedidos estão abertos ou fechados.

## Ver a demonstração

Requer Node.js 20.19+ ou 22.12+.

```powershell
npm install
npm run dev
```

Para testar o telão nesta máquina sem usar o Firebase publicado, rode `npm.cmd run dev:demo`. O arquivo `.env.demo` desativa a conexão com o Firebase mesmo quando `.env.local` está configurado. Abra `http://127.0.0.1:5173/operador` e `http://127.0.0.1:5173/telao` em duas abas **do mesmo navegador**; a demonstração compartilha os dados entre abas, mas não entre dispositivos.

No painel, cole um link direto de vídeo do YouTube na primeira pessoa da fila e clique em **Salvar**. Depois clique em **Chamar próximo**, **Confirmar presença** e **Tocar no telão**. Volte à aba do telão para ver o vídeo ao lado da fila. Para simular celular ou tablet no computador, use o modo de dispositivo das ferramentas do navegador na aba do operador.

Em **Operação → Telão**, alterne entre **Vídeo + fila** e **Painel clássico**. A aba do telão muda imediatamente, e a escolha continua nas próximas noites. O modo clássico mostra o cantor e a fila sem incorporar o vídeo; nele, o operador pode abrir o YouTube separadamente. Trocar durante uma música interrompe a reprodução incorporada.

Em uma cópia sem `.env.local`, o projeto abre em **modo demonstração**. Os dados ficam no armazenamento deste navegador e são compartilhados entre abas abertas no mesmo computador. As telas são:

- `/` ou `/mesa/04`: pedido do cliente. A mesa é opcional; o QR de uma mesa já preenche o número.
- `/operador`: aprovação, escolha da versão, fila, chamada e ausências.
- `/operador/relatorios`: histórico das noites, rankings de músicas e artistas, horário com mais pedidos e resumo CSV para divulgação.
- `/telao`: chamada de 10 segundos, vídeo da apresentação e próximos participantes.

Na demonstração há três cantores fictícios para testar a fila. Para apagar a demonstração, limpe os dados deste site no navegador.

Os relatórios de demonstração incluem duas noites fictícias. No Firebase, os dados passam a ser reais e somente operadores autorizados podem ler o histórico. Pedidos encerrados são arquivados antes de uma nova música do mesmo celular substituir o pedido atual, mantendo as contagens corretas.

## Conectar ao Firebase gratuito

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com/) no plano **Spark** e registre um aplicativo Web.
2. Ative **Firestore Database** no modo de produção (edição Standard).
3. A configuração de **E-mail/senha** e **Anônimo** está em `firebase.json`. Publique-a com `npx firebase deploy --only auth --project SEU_PROJECT_ID` ou ative os dois métodos em **Authentication → Sign-in method**.
4. Em **Authentication → Users**, crie o usuário do operador e copie o **UID** dele.
5. No Firestore, crie a coleção `admins` e um documento cujo ID seja esse UID. Adicione o campo `active` com valor booleano `true`. Esse campo permite acesso ao painel; altere para `false` para revogar. Crie administradores apenas pelo console do Firebase.
6. Copie `.env.example` para `.env.local` e preencha `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID` e `VITE_FIREBASE_APP_ID` com os valores do aplicativo Web. Ajuste `VITE_VENUE_NAME` para o nome do bar.
7. Reinicie `npm run dev`. Entre em `/operador` com a conta criada e abra a primeira noite.

Se apenas parte das variáveis estiver preenchida, o site mostra um aviso de configuração. Uma versão publicada sem Firebase também mostra esse aviso, em vez de funcionar com dados isolados em cada celular. O modo demonstração continua disponível durante o desenvolvimento sem configuração.

### Testar sem projeto real

O arquivo `.env.emulator` já contém dados fictícios. Em dois terminais, execute:

```powershell
npx firebase emulators:start --project demo-sistema-karaoke --only auth,firestore
npm run dev:firebase-test
```

O site local usa os emuladores de Authentication e Firestore. Eles não acessam o projeto real. Para um teste automatizado do fluxo completo, execute `npm run test:firebase`; esse comando inicia e encerra os emuladores sozinho.

As regras do Firestore estão em `firestore.rules`: clientes podem criar e consultar o próprio pedido e ler a fila pública. Somente operadores cadastrados em `admins` podem aprovar, chamar, confirmar a presença, registrar falta ou mudar a ordem.

## Publicar

Para atualizar o site `karaokedacasa.web.app` no projeto ativo:

```powershell
npx.cmd firebase deploy --project sistemakaraoke-andre --only hosting:karaoke
```

Para publicar mudanças nas regras ou nos métodos de login, use `npx.cmd firebase deploy --project sistemakaraoke-andre --only auth,firestore:rules`. O deploy do site executa `npm run build:firebase` automaticamente e falha se faltarem variáveis ou se o ID for de demonstração. Confira se `VITE_FIREBASE_PROJECT_ID` em `.env.local` é `sistemakaraoke-andre`. **Imprima os QR codes pelo novo site publicado**, pois QR codes gerados no endereço antigo ou em `localhost` não abrirão o novo endereço nos celulares das mesas.

Nesta máquina, o PowerShell bloqueia `npm.ps1` e `npx.ps1`; use `npm.cmd` e `npx.cmd` no lugar de `npm` e `npx`.

## Uso no bar

- **Uma TV:** mantenha `/telao` aberto no navegador conectado à TV. O operador usa `/operador` no celular ou tablet, salva o link direto da versão escolhida na fila, chama o cantor e pode marcar **Confirmar presença** ao vê-lo chegar. Com a presença confirmada, pode tocar em **Tocar no telão** antes dos 10 segundos terminarem. O vídeo aparece ao lado da fila; ao terminar, o telão mostra uma espera até o operador concluir a música. O convidado não precisa confirmar nada no celular.
- Em **Operação → Telão**, escolha **Painel clássico** para voltar à visualização sem vídeo incorporado. Nesse modo, o link do YouTube é opcional e o operador abre o vídeo separadamente. **Vídeo + fila** exige um link direto de vídeo antes de iniciar.
- O navegador da TV pode bloquear a reprodução automática com som. Nesse caso, toque em **Tocar vídeo** no telão. Alguns vídeos proíbem incorporação; escolha outra versão ou use o link **Abrir no YouTube**. A fila fica ao lado do player porque as [regras do YouTube](https://developers.google.com/youtube/terms/required-minimum-functionality) não permitem cobri-lo.
- **Duas TVs:** mantenha `/telao` em uma TV e o vídeo da música na outra.
- O operador escolhe e toca o vídeo. O sistema não inicia músicas automaticamente.
- O operador pode confirmar a presença e iniciar a música imediatamente. Se ninguém chegar, após os 10 segundos ele pode dar outra chance ou cancelar o pedido. “Dar outra chance” devolve o pedido para depois do próximo cantor, sem limite automático de faltas. Quando todos perderam uma chamada, o operador pode chamá-los novamente para a fila não travar.
- Cada navegador só consegue manter um pedido ativo por noite. Quando a mesa é informada, a aprovação também impede dois pedidos com o mesmo nome e mesa. Sem mesa, o operador confere possíveis duplicatas pelo nome.
- O **QR único** do painel e do telão abre o formulário sem mesa preenchida. Use **Imprimir QR único** para gerar um cartaz. As cartelas por mesa continuam guardadas na seção “QR por mesa (para usar depois)”. Gere os QR pelo site publicado.
- “Encerrar novos pedidos” pede confirmação, bloqueia novos pedidos e preserva a fila atual. É possível reabrir os pedidos; “Começar nova noite” cria uma fila nova.
- Em “Relatórios”, filtre todas as noites, os últimos 30 ou 90 dias ou uma noite específica. O CSV contém números agregados, sem nomes de clientes. Atualize os dados pelo botão quando a noite mudar.

Os avisos no celular aparecem **enquanto a página está aberta**. Notificações quando o navegador está fechado, SMS e WhatsApp não fazem parte desta primeira versão. O telão e a chamada do operador continuam sendo os meios principais de convocação.

## Verificações

```powershell
npm run build
npm run lint
npm test
npm run test:rules
npm run test:mobile
npm run test:firebase
```

`test:rules` e `test:firebase` iniciam emuladores locais e exigem Java 11+; não usam dados do projeto real. `test:mobile` testa as telas de 320, 390, 768 e 1024 px e o fluxo de uso em um navegador Edge instalado no computador. `test:firebase` também usa o Edge, com cliente e operador em sessões independentes.
