# Direct Promocoes Design System

## Direcao

O sistema deve parecer uma central operacional contemporanea: rapido de ler,
compacto, confiavel e colorido apenas onde a cor comunica estado ou acao.
Marketing, ilustracoes decorativas e superficies excessivamente arredondadas
nao fazem parte desta linguagem.

## Temas

### Light

- Fundo: cinza frio muito claro.
- Superficies: branco opaco, borda cinza e sombra curta.
- Texto: quase preto; textos secundarios em cinza medio.
- Navegacao: branca, com item ativo azul e indicador lateral.

### Dark

- Fundo: preto verdadeiro com variacoes neutras de grafite.
- Superficies: grafite, sem roxo ou azul-marinho dominante.
- Texto: branco suave; textos secundarios em cinza claro.
- Cor aparece em estados, icones, indicadores e acoes.

## Cores funcionais

- Azul: acao principal, foco e selecao.
- Ciano: informacao, sincronizacao e cobertura.
- Verde: presente, confirmado, pago e lucro.
- Ambar: aguardando, alerta e adiantamento.
- Vermelho: falta, perda, exclusao e erro.
- Rosa: destaque financeiro secundario quando necessario.

## Tipografia

- Familia: Manrope, com fallback para fontes do sistema.
- Peso 700: titulos de pagina e valores principais.
- Peso 600: rotulos, botoes e titulos de painel.
- Peso 400/500: conteudo e texto auxiliar.
- Monospace somente para codigos, CPF, IDs e horarios quando necessario.
- Espacamento entre letras sempre neutro.

## Superficies

- Cards: raio maximo de 8 px, borda de 1 px e sombra curta.
- Paineis: sem card dentro de card quando a hierarquia puder ser resolvida por
  divisores, bandas ou grids.
- KPIs: mesma altura, valor dominante, rotulo curto e acento de cor lateral.
- Popups: cabecalho fixo, conteudo rolavel e rodape de acoes previsivel.

## Controles

- Botoes primarios usam azul solido; sucesso, alerta e perigo usam suas cores.
- Botoes de icone mantem area minima de 40 x 40 px e tooltip no desktop.
- Campos tem 42 px de altura, fundo opaco e foco claramente visivel.
- Filtros usam controles compactos e podem empilhar no celular.
- Abas usam barra discreta e indicador ativo, sem capsulas grandes.

## Responsividade

- Desktop: sidebar fixa de 68 px e area de trabalho fluida.
- Tablet: grids reduzem colunas sem diminuir tipografia por viewport.
- Mobile: header fixo, navegacao inferior, acoes principais em largura total e
  cards em uma ou duas colunas conforme a densidade.
- Nenhuma tela pode produzir scroll horizontal em 430 x 932 px.

## Acessibilidade

- Contraste AA como minimo para textos e controles.
- Foco visivel em teclado.
- Estados nao dependem apenas de cor; usam icone e texto.
- Respeitar `prefers-reduced-motion`.
- Alvos de toque com pelo menos 40 px.
