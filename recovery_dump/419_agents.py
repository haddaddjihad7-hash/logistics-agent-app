DEFAULT_MODELS = ["gemini-3.1-flash-lite", "gemini-3.5-flash-lite", "gemini-flash-latest", "gemini-3.6-flash"]
custom_model = os.environ.get("GEMINI_MODEL")
if custom_model:
    CANDIDATE_MODELS = [custom_model] + [m for m in DEFAULT_MODELS if m != custom_model]
else:
    CANDIDATE_MODELS = DEFAULT_MODELS