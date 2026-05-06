/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_YT_API_KEY: string;
  readonly VITE_YT_OAUTH_CLIENT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
