# Task List

- `[/]` Revert the frontend Next.js application using Git.
  - `[ ]` Run `git clean -fd` to remove new components and untracked files.
  - `[ ]` Run `git checkout .` to restore `page.tsx`, `layout.tsx`, and `globals.css` to their original states.
- `[ ]` Clean up the backend FastAPI application.
  - `[ ]` Delete `agents.py`, `episodic_memory.py`, `prompts.py`, and `ingest_kaggle.py`.
  - `[ ]` Rewrite `main.py` to a minimal FastAPI template.
- `[ ]` Restart and verify servers.
  - `[ ]` Kill existing daemon tasks for Next.js and FastAPI.
  - `[ ]` Restart and confirm they load as basic starter applications.