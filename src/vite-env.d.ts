/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_SUPABASE_FUNCTION_DELETE_DOCUMENT_CASCADE?: string
  readonly VITE_SUPABASE_FUNCTION_CHAT_SESSION?: string
  readonly VITE_SUPABASE_FUNCTION_MESSAGES_ACTION?: string
  readonly VITE_SUPABASE_FUNCTION_FEEDBACK_ACTION?: string
  readonly VITE_N8N_WEBHOOK_CHAT?: string
  readonly VITE_N8N_WEBHOOK_REBUILD_SEARCH_INDEX?: string
  readonly VITE_N8N_WEBHOOK_REBUILD_PRODUCT_INDEX?: string
  readonly VITE_N8N_WEBHOOK_UPLOAD_DOCUMENTS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

