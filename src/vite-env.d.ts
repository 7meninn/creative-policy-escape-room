/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RETRIEVAL_MODE?: "local_mock" | "foundry_iq";
  readonly VITE_RETRIEVAL_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
