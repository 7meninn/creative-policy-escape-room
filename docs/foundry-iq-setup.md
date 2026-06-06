# Foundry IQ Setup

Phase 4 adds an optional live `foundry_iq` retrieval path. The default app still
runs with `local_mock` and no credentials.

## What Stays Synthetic

Use only the files under
`data/synthetic-policy-packs/synthetic-cybersecurity-onboarding/foundry-import/`.
They contain section markers such as `SYN-POL-005#1.1` so the app can map
Foundry IQ references back to local citation metadata.

Do not upload real company policies, customer data, tenant content, employee
data, PII, credentials, or confidential information.

## Azure Setup

1. Sign in to [Microsoft Foundry](https://ai.azure.com/) and create or reuse a
   project.
2. Create or reuse an Azure AI Search service that supports agentic retrieval.
3. Create a knowledge source from the synthetic Markdown files.
4. Create a Foundry IQ knowledge base over that knowledge source.
5. Enable reference source data for the knowledge source when available, so
   retrieval responses include the section markers.
6. Assign your local identity the Search Index Data Reader role on the search
   service. If the knowledge base uses an LLM for query planning or answer
   synthesis, ensure the search service identity can access that model.

Foundry IQ is backed by Azure AI Search knowledge bases. The local proxy calls
the Search knowledge base retrieve endpoint from the server side using
`DefaultAzureCredential`; the browser never receives Azure tokens.

## Local Configuration

Copy the public-safe template:

```bash
cp .env.example .env.local
```

Set these values in `.env.local`:

```bash
VITE_RETRIEVAL_MODE=foundry_iq
VITE_RETRIEVAL_API_URL=http://localhost:8787/api/retrieve-policy-evidence

FOUNDRY_IQ_SEARCH_ENDPOINT=https://<your-search-service>.search.windows.net
FOUNDRY_IQ_KNOWLEDGE_BASE=<your-knowledge-base-name>
FOUNDRY_IQ_KNOWLEDGE_SOURCE_NAME=<optional-search-index-knowledge-source-name>
FOUNDRY_IQ_API_VERSION=2026-05-01-preview
```

Authenticate locally with one of the `DefaultAzureCredential` methods:

```bash
az login
az account set --subscription <subscription-id>
```

Or set the optional `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, and
`AZURE_CLIENT_SECRET` variables for a service principal in `.env.local`.

## Run

Credential-free mode:

```bash
npm run dev
```

Foundry IQ mode:

```bash
npm run dev:foundry
```

Open the Vite URL. The header and trace panel should show `foundry_iq` after a
successful retrieval. If configuration, auth, network access, citation mapping,
or the knowledge base fails, the app records `foundry_iq fallback` and continues
with deterministic local mock evidence.

## Verification

1. Enter Room 1 and open **Trace**.
2. Confirm retrieval status becomes `foundry_iq` or `foundry_iq fallback`.
3. Open **Sources** in each static room and confirm citations show synthetic
   policy IDs and section IDs.
4. Disable the proxy or remove Foundry env vars and confirm the game remains
   playable with local mock fallback.

References:

- [Foundry IQ overview](https://learn.microsoft.com/en-us/azure/foundry/agents/concepts/what-is-foundry-iq)
- [Connect Foundry IQ knowledge bases](https://learn.microsoft.com/en-us/azure/foundry/agents/how-to/foundry-iq-connect)
- [Query a knowledge base using retrieve](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-retrieve)
