import type { RdxHomepageProps } from '@lexibase/rdx'

import { HomeLayout, type HomeText } from '../../components/home'

// The pt-BR homepage, at /pt-br (RDX finds locale/<folder>/home.tsx). Same
// layout as the English one (components/home.tsx); only the text changes.
// The code examples and the extension's messages stay in English: that is what
// the extension shows.

const PT_BR: HomeText = {
  tagline:
    'Uma experiência de desenvolvimento moderna para mods da SCS Software.',
  subtitle:
    'Uma extensão gratuita do VS Code para mods de American Truck Simulator e Euro Truck Simulator 2.',
  install: 'Instalar no VS Code',
  readDocs: 'Ler a documentação',
  playVideo: 'Assistir ao vídeo',
  featuresTitle: 'Feito para mods da SCS.',
  highlighting: {
    title: 'Realce semântico',
    text: 'Classes, chaves, valores e caminhos, cada um com a sua cor.',
  },
  diagnostics: {
    title: 'Diagnósticos',
    text: 'Os erros aparecem enquanto você digita, antes que o jogo os encontre.',
  },
  hover: {
    title: 'Informações no hover',
    text: 'O tipo de um atributo e o que ele faz, sem sair do editor.',
  },
  experimental: 'Experimental',
  icons: {
    title: 'Ícones de arquivo',
    text: 'Modelos, materiais, texturas e bancos de som: reconhecidos num relance.',
    treeLabel: 'Os arquivos de um mod com os seus ícones',
  },
  paths: {
    title: 'Caminhos que seguem os seus arquivos',
    text: 'Renomeie ou mova um arquivo no VS Code, e todo caminho que aponta para ele é atualizado.',
  },
  more: {
    title: 'E mais',
    text: 'Tudo o que um modder procura, numa extensão só.',
    items: [
      'Autocompletar para classes, atributos, valores e caminhos (experimental)',
      'Go to Definition, Find References e Rename',
      'Correções rápidas para erros comuns',
      'Um formatador que nunca muda o seu conteúdo (experimental)',
      'Outline e breadcrumbs para cada unit',
    ],
    link: 'Ver todos os recursos →',
  },
  screenshotsTitle: 'Arquivos da SCS, com um pouco mais de inteligência.',
  screenshotsLabel: 'Capturas de tela',
  shots: {
    hover: {
      label: 'Hover',
      caption:
        'Aponte para uma classe para ver a classe que ela estende, ou para um atributo para ver o seu tipo.',
    },
    quickFix: {
      label: 'Correção rápida',
      caption:
        'Um atributo escrito errado é marcado enquanto você digita, e a correção está a um clique.',
    },
    completion: {
      label: 'Autocompletar',
      caption: 'Sugestões dos atributos da própria unit, com os seus tipos.',
    },
    ctrlClick: {
      label: 'Ctrl+clique',
      caption:
        'Ctrl+clique num caminho para abrir o arquivo, ou num nome de unit para ir até onde ela é definida.',
    },
    include: {
      label: '@include',
      caption:
        'O autocompletar lista as pastas e os arquivos .sui que você pode incluir.',
    },
    moving: {
      label: 'Mover arquivos',
      caption:
        'Renomeie ou mova um arquivo, e todo caminho que aponta para ele é atualizado e marcado para revisão.',
    },
  },
  ctaTitle: 'Pronto para fazer mais nos seus mods?',
  ctaText: 'Instale o SCS IntelliSense no VS Code.',
  ctaButton: 'Instalar a extensão',
  footerText: 'Ferramentas modernas para mods da SCS Software.',
  footerLabel: 'Rodapé',
  footerDocs: 'Documentação',
}

export default function PortugueseHome({ docsHref }: RdxHomepageProps) {
  return <HomeLayout text={PT_BR} docsHref={docsHref} />
}
