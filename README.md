# Karaokê da Casa

Sistema web para pedidos de karaokê pelo celular, fila ao vivo, painel do operador e telão com vídeo do YouTube. A mesa é opcional.

## Projeto Firebase ativo

Esta instalação está ligada ao projeto `sistemakaraoke-andre` no plano Spark. O Firestore Standard fica em São Paulo (`southamerica-east1`), com autenticação anônima para clientes e e-mail/senha para operadores.

- Site: https://karaokedacasa.web.app
- Operador: https://operadorkdc.web.app
- Telão: https://telaokdc.web.app

A página dos convidados não mostra links para o operador ou para o telão. Salve os endereços da equipe como favoritos ou adicione-os à tela inicial do celular ou tablet. O painel exige login mesmo que alguém conheça o endereço.

O endereço anterior `https://sistemakaraoke-andre.web.app` continua ativo como site padrão do mesmo projeto Firebase. Os três endereços acima são sites Hosting separados, com os alvos `karaoke`, `operador` e `telao` em `.firebaserc`. Os caminhos antigos `/operador` e `/telao` no site dos convidados redirecionam para os endereços da equipe.

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

O operador pode escolher **YouTube**, **YouTube Music** ou **Spotify** em **Operação → Buscar karaokê em**. Essa escolha fica salva no navegador do operador e muda os links de busca dos pedidos. Links diretos `music.youtube.com/watch?v=...` podem ser escolhidos para o telão; o player usa o vídeo correspondente do YouTube. Spotify é apenas uma fonte de busca e pode ser usado com o painel clássico, pois o telão não reproduz faixas do Spotify.

### Busca integrada e playlist da noite

A seção **Buscar e montar playlist** oferece duas formas de trabalho. **Abrir YouTube Music** mostra a página original em outra janela; no computador, ela pode ficar ao lado do operador. A busca integrada permite pesquisar vídeos dentro do painel, escolher uma versão para a fila do sistema e, com um clique separado, adicioná-la à playlist criada na conta do YouTube Music. A página completa do YouTube Music não pode ser embutida no painel. A conexão com Google só é solicitada ao operador e o token de acesso fica apenas na memória desta aba; é preciso reconectar quando expirar ou recarregar a página.

Para habilitar essa seção, no projeto Google Cloud usado para a integração:

1. Ative a [YouTube Data API v3](https://console.cloud.google.com/apis/library/youtube.googleapis.com) no projeto escolhido.
2. Configure a [tela de consentimento OAuth](https://console.cloud.google.com/auth/branding). Em teste, adicione a conta Google que possui a playlist como usuário de teste. A conta do operador do Firebase continua separada.
3. Crie um [cliente OAuth Web](https://console.cloud.google.com/auth/clients), com `https://operadorkdc.web.app` em **Origens JavaScript autorizadas**. Para teste local, adicione `http://localhost:5173` e `http://127.0.0.1:5173` se for usar ambos os endereços.
4. Coloque o **ID do cliente** (não o segredo) em `VITE_GOOGLE_OAUTH_CLIENT_ID` no `.env.local`, reinicie o servidor local ou publique novamente os sites. No painel, clique em **Conectar conta Google**, cole o link da playlist criada no YouTube Music e clique em **Selecionar playlist**.

A busca integrada usa a cota da YouTube Data API. Mesmo no modo demonstração, clicar em **Adicionar à playlist** altera a playlist real da conta Google conectada; use uma playlist de teste. Apenas vídeos que o YouTube Music classifica como música aparecem na biblioteca do YouTube Music, mesmo que estejam numa playlist visível no YouTube. [Documentação das playlists do YouTube Music](https://support.google.com/youtubemusic/answer/7205933?co=GENIE.Platform%3DDesktop&hl=pt-BR).

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

Para atualizar os três sites no projeto ativo:

```powershell
npx.cmd firebase deploy --project sistemakaraoke-andre --only hosting
```

Para publicar mudanças nas regras ou nos métodos de login, use `npx.cmd firebase deploy --project sistemakaraoke-andre --only auth,firestore:rules`. O deploy dos sites executa `npm run build:firebase` automaticamente e falha se faltarem variáveis ou se o ID for de demonstração. Confira se `VITE_FIREBASE_PROJECT_ID` em `.env.local` é `sistemakaraoke-andre`. Os QR codes gerados no painel e no telão apontam sempre para `karaokedacasa.web.app`; os endereços estão em `.env.production`.

Nesta máquina, o PowerShell bloqueia `npm.ps1` e `npx.ps1`; use `npm.cmd` e `npx.cmd` no lugar de `npm` e `npx`.

## Uso no bar

- **Uma TV:** mantenha `https://telaokdc.web.app` aberto no navegador conectado à TV. O operador usa `https://operadorkdc.web.app` no celular ou tablet, salva o link direto da versão escolhida na fila, chama o cantor e pode marcar **Confirmar presença** ao vê-lo chegar. Com a presença confirmada, pode tocar em **Tocar no telão** antes dos 10 segundos terminarem. O vídeo aparece ao lado da fila; ao terminar, o telão mostra uma espera até o operador concluir a música. O convidado não precisa confirmar nada no celular.
- Em **Operação → Telão**, escolha **Painel clássico** para voltar à visualização sem vídeo incorporado. Nesse modo, o link do YouTube é opcional e o operador abre o vídeo separadamente. **Vídeo + fila** exige um link direto de vídeo antes de iniciar.
- No computador da TV, clique em **Preparar telão** uma vez após abrir a página. Isso autoriza o Chrome ou Edge a tentar reproduzir os vídeos seguintes com som quando o operador clicar em **Tocar no telão**. O navegador ainda pode bloquear a reprodução; nesse caso, toque em **Tocar vídeo** no telão. Alguns vídeos proíbem incorporação; escolha outra versão ou use o link **Abrir no YouTube**. A fila fica ao lado do player porque as [regras do YouTube](https://developers.google.com/youtube/terms/required-minimum-functionality) não permitem cobri-lo.
- **Duas TVs:** mantenha `https://telaokdc.web.app` em uma TV e o vídeo da música na outra.
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
