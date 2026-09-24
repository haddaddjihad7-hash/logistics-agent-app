    from backend.prompts import SYSTEM_PROMPT_TEMPLATE
    from backend.agents import run_multi_agent_workflow
except ImportError:
    from episodic_memory import (
        get_episodic_vector_store,
        retrieve_episodic_context,
        format_episodic_grounding_prompt
    )
    from prompts import SYSTEM_PROMPT_TEMPLATE
    from agents import run_multi_agent_workflow