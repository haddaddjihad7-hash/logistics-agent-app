# Revert Project to Pre-LangGraph State

You have requested to revert the project back to its original state before we added LangGraph, the multi-agent systems, and the custom command center UI. 

> [!CAUTION]
> This is a **destructive action**. All of the AI capabilities, multi-agent logic, safety guardrails, and custom UI components will be permanently deleted.

## Open Questions
- Do you want to keep any of the dependencies we installed (like `recharts`, `leaflet`, `langchain`, `google-genai`), or should I completely uninstall them as well?

## Proposed Changes

### Frontend Component
We will use Git to completely reset the Next.js application back to the original Next.js starter template.
#### [MODIFY] [globals.css](file:///c:/Users/hadda/Downloads/NextSkill/frontend/src/app/globals.css) (Revert to default)
#### [MODIFY] [layout.tsx](file:///c:/Users/hadda/Downloads/NextSkill/frontend/src/app/layout.tsx) (Revert to default)
#### [MODIFY] [page.tsx](file:///c:/Users/hadda/Downloads/NextSkill/frontend/src/app/page.tsx) (Revert to default)
#### [DELETE] [CostChart.tsx](file:///c:/Users/hadda/Downloads/NextSkill/frontend/src/components/CostChart.tsx)
#### [DELETE] [ImpactMap.tsx](file:///c:/Users/hadda/Downloads/NextSkill/frontend/src/components/ImpactMap.tsx)
#### [DELETE] [ImpactMapInner.tsx](file:///c:/Users/hadda/Downloads/NextSkill/frontend/src/components/ImpactMapInner.tsx)

### Backend Component
Since the backend folder doesn't have Git history, I will manually delete the multi-agent files and reset the FastAPI server to a basic empty state.
#### [DELETE] [agents.py](file:///c:/Users/hadda/Downloads/NextSkill/backend/agents.py)
#### [DELETE] [episodic_memory.py](file:///c:/Users/hadda/Downloads/NextSkill/backend/episodic_memory.py)
#### [DELETE] [prompts.py](file:///c:/Users/hadda/Downloads/NextSkill/backend/prompts.py)
#### [DELETE] [ingest_kaggle.py](file:///c:/Users/hadda/Downloads/NextSkill/backend/ingest_kaggle.py)
#### [MODIFY] [main.py](file:///c:/Users/hadda/Downloads/NextSkill/backend/main.py) (Reset to minimal FastAPI boilerplate)

## Verification Plan
1. I will start the frontend and backend servers.
2. I will verify that both load as empty/default starter applications without any errors.