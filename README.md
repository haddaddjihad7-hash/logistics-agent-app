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
