import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent
env_local_path = ROOT_DIR / ".env.local"

if env_local_path.exists():
    load_dotenv(env_local_path)
else:
    load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv(
    "NEXT_PUBLIC_SUPABASE_URL", "https://ybqzcxabblyzqhezanaf.supabase.co"
)
SUPABASE_ANON_KEY = (
    os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    or os.getenv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
    or ""
)
SUPABASE_SERVICE_ROLE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_SECRET_KEY")
    or SUPABASE_ANON_KEY
)

# Qdrant Vector DB (Fase 2)
QDRANT_URL = os.getenv("QDRANT_URL", "http://127.0.0.1:6333")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY", "")
QDRANT_COLLECTION = os.getenv("QDRANT_COLLECTION", "alquimia_ciencia")

# LLM Router (Fase 2 + Modalidad Dev GPU Local)
LLM_MODE = os.getenv("LLM_MODE", "prod_api")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_FALLBACK_MODEL = os.getenv("OPENAI_FALLBACK_MODEL", "gpt-4o-mini")
LOCAL_LLM_URL = os.getenv("LOCAL_LLM_URL", "http://127.0.0.1:11434/v1")
LOCAL_LLM_MODEL = os.getenv("LOCAL_LLM_MODEL", "hermes3:8b")
LOCAL_LLM_API_KEY = os.getenv("LOCAL_LLM_API_KEY", "ollama")
LOCAL_LLM_TIMEOUT_S = float(os.getenv("LOCAL_LLM_TIMEOUT_S", "45.0"))
LOCAL_LLM_NUM_CTX = int(os.getenv("LOCAL_LLM_NUM_CTX", "4096"))

# Langfuse Observability (Fase 2)
LANGFUSE_PUBLIC_KEY = os.getenv("LANGFUSE_PUBLIC_KEY", "")
LANGFUSE_SECRET_KEY = os.getenv("LANGFUSE_SECRET_KEY", "")
LANGFUSE_HOST = os.getenv("LANGFUSE_HOST", "https://cloud.langfuse.com")

PORT = int(os.getenv("CEREBRO_PY_PORT", "8155"))
HOST = os.getenv("CEREBRO_PY_HOST", "127.0.0.1")
