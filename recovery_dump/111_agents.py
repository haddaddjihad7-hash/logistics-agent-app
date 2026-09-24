# Model configuration - prioritizing Gemini 3.6 / 3.1 Flash
DEFAULT_MODELS = ["gemini-3.6-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"]
custom_model = os.environ.get("GEMINI_MODEL")
if custom_model:
    CANDIDATE_MODELS = [custom_model] + [m for m in DEFAULT_MODELS if m != custom_model]
else:
    CANDIDATE_MODELS = DEFAULT_MODELS

def get_gemini_client() -> Optional[genai.Client]:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        logger.warning("GEMINI_API_KEY not configured. Falling back to deterministic agent reasoning.")
        return None
    try:
        return genai.Client(api_key=api_key)
    except Exception as e:
        logger.warning(f"Could not initialize Gemini Client: {e}")
        return None

def query_gemini_thought(agent_role: str, prompt_context: str, fallback_thought: str) -> str:
    """Invokes Gemini 3.6 / 3.1 Flash for autonomous reasoning with deterministic fallback."""
    client = get_gemini_client()
    if not client:
        return fallback_thought
    
    prompt = (
        f"You are the {agent_role} in an autonomous industrial & logistics multi-agent command center.\n"
        f"Technical Context: {prompt_context}\n"
        "Generate a concise 1-2 sentence technical thought explaining your reasoning, "
        "guardrail adherence, or planned operational action. No conversational filler or preamble."
    )
    for model_name in CANDIDATE_MODELS:
        try:
            resp = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.2,
                    max_output_tokens=120
                )
            )
            if resp and resp.text:
                cleaned = resp.text.strip().replace("\n", " ")
                if len(cleaned) > 10:
                    return cleaned
        except Exception as e:
            logger.debug(f"Gemini generation fallback for {agent_role} on {model_name}: {e}")
            continue
    return fallback_thought