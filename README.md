# NextSkill • Logistics Intelligence AI

A real-time logistics disruption extraction and supply chain intelligence application powered by **FastAPI**, **Google Gemini AI**, and **Next.js**.

---

## 🚀 Getting Started

### 1. Backend Setup (FastAPI & Gemini)

1. Activate your Python virtual environment:
   ```bash
   .\.venv\Scripts\activate
   ```
2. Ensure dependencies are installed:
   ```bash
   pip install -r backend/requirements.txt
   ```
3. Verify your API key is in [`backend/.env`](backend/.env):
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
4. Start the FastAPI backend server:
   ```bash
   python backend/main.py
   ```
   Or from the `backend` directory:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   The backend will be live at: **[http://localhost:8000](http://localhost:8000)** (Interactive Docs: **[http://localhost:8000/docs](http://localhost:8000/docs)**).

---

### 2. Frontend Setup (Next.js)

1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install Node dependencies (if not already installed):
   ```bash
   npm install
   ```
3. Start the Next.js development server:
   ```bash
   npm run dev
   ```
4. Open your browser at: **[http://localhost:3000](http://localhost:3000)**.

---

## 📐 Operational Baseline and Documentation

- Architecture diagram: [architecture.md](architecture.md)
- API reference: [docs/API_REFERENCE.md](docs/API_REFERENCE.md)
- Local env template: [backend/.env.example](backend/.env.example)
- Container deployment baseline: [docker-compose.yml](docker-compose.yml)

### Docker quick start

```bash
docker compose up --build
```

This starts Nginx ingress, the FastAPI backend, Next.js frontend, PostgreSQL, Redis, Prometheus, and Grafana. Open `http://localhost` for the operator console and `http://localhost:3001` for Grafana. Copy the root [.env.example](.env.example) to `.env` and replace production secrets before deployment. The backend `.env.example` remains available for direct local execution.

### Production HTTPS

Place `fullchain.pem` and `privkey.pem` in a certificate directory, then run:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

Set `TLS_CERT_DIR` when the certificates are stored outside `./certs`. The production overlay redirects HTTP to HTTPS and removes direct public access to the application services.
