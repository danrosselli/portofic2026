# Port Fic 2026 — Feira de Ciências

Site da **Port Fic 2026**, gerado com [Eleventy](https://www.11ty.dev/) e publicado automaticamente via **GitHub Actions** no **GitHub Pages**.

## Desenvolvimento

```bash
bun install          # instala as dependências
bun run start        # servidor local com hot reload (http://localhost:8080)
bun run build        # gera o site estático em _site/
```

## Estrutura

```
src/
├── _data/        # dados globais (site.json)
├── _includes/    # layouts (layout.njk)
├── css/          # folhas de estilo
└── index.njk     # página inicial
eleventy.config.js
```

## Deploy

A cada push na branch `main`, o workflow [`deploy.yml`](.github/workflows/deploy.yml) executa o build e publica o site no GitHub Pages automaticamente.
