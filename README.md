# The Blue Scribes UI

A local Vue 3 control panel for [The Blue Scribes](../the-blue-scribes). It turns
provider profiles, indexing recipes, retrieval targets, search, and MCP setup into
guided workflows while keeping the source of truth in the Scribes core library.

The UI binds only to `127.0.0.1`, checks the request host and origin, and does not
send project files to a browser service. LM Studio remains the only model
provider contacted by the core.

The source is divided by runtime boundary:

```text
client/  Vue application
server/  Local HTTP API
shared/  Contracts used by both runtimes
```

Client styling follows the same ownership boundary:

- component-only rules live in that component's scoped `<style>` block;
- reusable controls, forms, page primitives, definition lists, and code surfaces
  live in `client/shared/styles/`;
- `client/style.css` contains only application-wide foundations and imports the
  shared style modules once.

## Development

The core project must exist beside this repository:

```text
Projects/
├── the-blue-scribes/
└── the-blue-scribes-ui/
```

Install and start both the Vue development server and local API:

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. The API runs at `http://127.0.0.1:43110`.

## Local executable

Build and link the application once:

```bash
npm run build
npm link
```

Then launch it from any directory:

```bash
scribes-ui
```

The command chooses an available loopback port, opens the default browser, and
serves the built Vue application and API from the same process. Stop it with
`Ctrl+C`.

## Checks

```bash
npm run format
npm run format:check
npm run lint
npm run lint:fix
npm run typecheck
npm test
npm run build
```

## Responsibilities

This project owns presentation and local workflow orchestration. It stores
profile-specific file rules and encoding defaults in the user's local config,
then copies them into the core indexing recipe when a project is indexed.
Classification, decoding, cAST chunking, embeddings, reranking, project
indexes, recipes, target management, and retrieval remain in
`the-blue-scribes`.
