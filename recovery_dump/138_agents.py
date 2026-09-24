from google import genai
from google.genai import types
from dotenv import load_dotenv

# Load environment variables from backend/.env or root
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)
load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)