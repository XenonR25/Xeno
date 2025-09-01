# Xeno – AI-Powered Study Platform

![Xeno Banner](https://image.pngaaa.com/998/2745998-middle.png) <!-- Optional: Replace with your actual banner/image URL -->

**Xeno** is an interactive, AI-powered web application designed to revolutionize your study experience. Upload any study document or PDF, and Xeno will automatically generate insightful quizzes and multiple-choice questions to test your understanding on the spot!  

Xeno is fully responsive and dynamic, offering engaging animations and a seamless user experience. The system leverages OpenAI's API to analyze documents and produce questions and answers tailored to your material. Results are provided at the end of each quiz, helping you track learning progress in real-time.

---

## ✨ Features

- **Upload Study Materials**: Supports PDF/document uploads for smart quiz generation.
- **AI-Generated Quizzes**: Uses OpenAI's API to create high-quality questions & answers based on your material.
- **Multiple-Choice Questions**: Engaging, interactive MCQs with instant feedback and scoring.
- **Real-Time Results**: Get detailed feedback and results after completing each quiz.
- **Responsive Design**: Smooth experience on desktop, tablet, and mobile.
- **Dynamic Animations**: Cool, modern UI animations for enhanced interactivity.
- **Secure & Scalable Backend**: Built with FastAPI and PostgreSQL for fast and robust performance.

---

## 🛠️ Tech Stack

- **Frontend**: [Next.js](https://nextjs.org/), [Tailwind CSS](https://tailwindcss.com/)
- **Backend**: [FastAPI](https://fastapi.tiangolo.com/)
- **Database**: [PostgreSQL](https://www.postgresql.org/)
- **AI/ML Integration**: [OpenAI API](https://platform.openai.com/docs/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/) (or similar)
- **Other**: RESTful API, JWT Authentication (planned), Cloud Storage (planned)

---

## 🚀 Getting Started

### Prerequisites

- Node.js ≥ 18.x, npm/yarn
- Python ≥ 3.9, pip
- PostgreSQL instance
- OpenAI API key

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/xeno.git
cd xeno
```
### 2. Setup the backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate (Windows)
pip install -r requirements.txt


# Set your environment variables (OpenAI key, DB config)
cp .env.example .env
# Edit .env with your details

# Run FastAPI server
uvicorn main:app --reload
```
### 3. Setup the frontend

```bash
cd ../frontend
npm install

# Set your environment variables
cp .env.local.example .env.local
# Edit .env.local with your API base URL etc.

npm run dev  # or yarn dev
```
### 4. Visit http://localhost:3000 in your browser!

### 📚 Example Usage
- Upload your PDF/documents.
- AI processes the material and generates multiple-choice quizzes.
- Take the quiz: Answer MCQs, view cool animations and progress bars.
- Submit: Instantly see your score and correct answers.

### 🧠 AI/ML Details
- **Document Parsing**: Files are parsed and summarized using OpenAI's GPT model.
- **Quiz Generation**: The AI creates contextually relevant questions & answers based on the uploaded content.
- **Answer Checking**: User answers are compared against the AI's answers for result generation.
  All processing is secure and user documents are not used for training.
### 📩 Connect & Contributions
Found a bug or want to suggest a feature? Pull requests and issues are welcome!
Please open an issue or a discussion.
