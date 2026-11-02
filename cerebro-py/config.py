import os
from pathlib import Path
from dotenv import load_dotenv

# Search for .env.local in parent directory or current directory
BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent
env_local_path = ROOT_DIR / ".env.local"

if env_local_path.exists():
    load_dotenv(env_local_path)
else:
    load_dotenv()

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "https://ybqzcxabblyzqhezanaf.supabase.co")
SUPABASE_ANON_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_ANON_KEY)

N8N_CEREBRO_URL = os.getenv(
    "N8N_CEREBRO_URL",
    os.getenv("PUBLIC_N8N_CEREBRO_URL", "https://cerebro.agencialquimia.com/webhook/cerebro-nutricionista")
)

PORT = int(os.getenv("CEREBRO_PY_PORT", "8055"))
HOST = os.getenv("CEREBRO_PY_HOST", "127.0.0.1")
