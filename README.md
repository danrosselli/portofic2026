# Arqueologia no Brasil — Porto FIC 2026

Site educativo do trabalho escolar **“Arqueologia no Brasil”**, desenvolvido pelo
**Colégio Porto Alvorada** para a **Porto FIC 2026** (Jaú — SP). Gerado com
[Eleventy](https://www.11ty.dev/), executado com **Bun** e publicado
automaticamente via **GitHub Actions** no **GitHub Pages**.

O site transforma o trabalho acadêmico (PDF com 19 páginas) em uma experiência
de **museu arqueológico digital**: herói editorial, linha do tempo interativa,
esquema das rotas de povoamento, corte transversal de sambaqui, galeria de arte
rupestre, escavação por camadas, comparadores LiDAR e escaneamento 3D, mapa
interativo do Brasil e seção de preservação.

## Desenvolvimento

```bash
bun install          # instala as dependências
bun run start        # servidor local com hot reload (http://localhost:8080)
bun run build        # gera o site estático em _site/
```

## Estrutura

```
src/
├── _data/            # dados globais (site.json, project.json)
├── _includes/        # layout.njk, mapas e ícones SVG
│   ├── icons/        # ícones dos vestígios e das camadas de escavação
│   ├── sections/     # uma parcial por seção (hero, historia, sambaquis, …)
│   └── map-states.njk# divisas estaduais do Brasil (SVG gerado)
├── css/              # sistema de design (style.css)
├── img/              # fotos de acervo aberto e ilustrações SVG
├── js/               # interações (main.js)
└── index.njk         # shell que monta as seções via include
eleventy.config.js    # Eleventy + pathPrefix /portofic2026/
```

O PDF original é copiado para o build e fica disponível para download no rodapé.

## Deploy

A cada push na branch `main`, o workflow [`deploy.yml`](.github/workflows/deploy.yml)
executa o build e publica o site no GitHub Pages automaticamente
(base: `/portofic2026/`).

## Conteúdo

Todo o conteúdo acadêmico (nomes, datas, sítios, legislação e referências) é
preservado conforme o documento original do trabalho. As fotografias da galeria
de arte rupestre vêm do acervo aberto do Wikimedia Commons (licenças CC BY-SA),
armazenadas localmente no repositório com os créditos indicados em cada legenda;
as demais composições visuais (herói, mapas, cortes e vinhetas) são ilustrações
SVG criadas para o site e identificadas como tais.
