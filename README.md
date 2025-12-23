<div align="center">

# MegaRAG

<img src="https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js" alt="Next.js" />
<img src="https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript" />
<img src="https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?style=for-the-badge&logo=supabase" alt="Supabase" />
<img src="https://img.shields.io/badge/Gemini-2.0_Flash-4285F4?style=for-the-badge&logo=google" alt="Gemini" />

### Chat With Your Files Using AI

Upload any document, video, or image. Ask questions. Get answers with sources.

</div>

---

## Table of Contents

1. [Understanding RAG: What Is This?](#-understanding-rag-what-is-this)
2. [The Technology: How Does It Work?](#-the-technology-how-does-it-work)
3. [Prerequisites: What You Need Before Starting](#-prerequisites-what-you-need-before-starting)
4. [Step-by-Step Setup Guide](#-step-by-step-setup-guide)
5. [Using the Application](#-using-the-application)
6. [Understanding the Code](#-understanding-the-code)
7. [Troubleshooting Guide](#-troubleshooting-guide)
8. [Deploying to Production](#-deploying-to-production)
9. [Additional Resources](#-additional-resources)

---

# 🤔 Understanding RAG: What Is This?

## The Problem We're Solving

Let's say you work at a company with thousands of documents: contracts, meeting notes, reports, training videos, and more. One day, someone asks you:

> "What did we agree to in the Smith contract regarding delivery timelines?"

**Without a RAG system**, you would need to:
1. Remember which folder the Smith contract is in
2. Open the document
3. Manually search through pages to find the delivery section
4. Read and understand what you find
5. Formulate an answer

This might take 5-30 minutes. What if you get 50 questions like this per day?

**With a RAG system like MegaRAG**, you:
1. Type your question
2. Get an answer in seconds, with the exact source highlighted

## What Does "RAG" Stand For?

**R**etrieval-**A**ugmented **G**eneration

Let's break that down:

- **Retrieval**: Finding relevant information from your documents
- **Augmented**: The AI's knowledge is "augmented" (enhanced) with your specific documents
- **Generation**: The AI generates a natural language answer

## How RAG Works: A Simple Analogy

Think of RAG like a very smart librarian:

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                     │
│   TRADITIONAL AI (like ChatGPT alone)                                               │
│   ═══════════════════════════════════                                               │
│                                                                                     │
│   You: "What's in the Smith contract?"                                              │
│   AI: "I don't have access to your documents. I can only use my general knowledge." │
│                                                                                     │
│   The AI is smart, but it hasn't read YOUR documents.                               │
│                                                                                     │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│   RAG SYSTEM (AI + Your Documents)                                                  │
│   ════════════════════════════════                                                  │
│                                                                                     │
│   You: "What's in the Smith contract?"                                              │
│                                                                                     │
│   RAG Step 1 (Retrieval):                                                           │
│   "Let me search your documents for anything about 'Smith contract'..."             │
│   → Found: Section 4.2 of smith_contract.pdf mentions delivery timelines            │
│                                                                                     │
│   RAG Step 2 (Augmented Generation):                                                │
│   "Based on Section 4.2 of your Smith contract, the delivery timeline is..."        │
│                                                                                     │
│   Now the AI can answer questions about YOUR specific documents!                    │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

## The RAG Pipeline: Step by Step

Here's exactly what happens when you use MegaRAG:

### Phase 1: Uploading and Processing Documents

```
Step 1: UPLOAD
══════════════
You drag a PDF into the app.

    📄 quarterly_report.pdf
         │
         ▼
    ┌─────────────────┐
    │  MegaRAG        │
    │  receives file  │
    └─────────────────┘


Step 2: STORE THE FILE
══════════════════════
The original file is saved to Supabase Storage (like Google Drive, but for our app).

    📄 quarterly_report.pdf
         │
         ▼
    ┌──────────────────────────────┐
    │  Supabase Storage            │
    │  ══════════════════          │
    │                              │
    │  📁 documents/               │
    │     └── quarterly_report.pdf │
    │                              │
    │  (File is saved safely)      │
    └──────────────────────────────┘


Step 3: EXTRACT CONTENT
═══════════════════════
The AI reads the file and extracts all the content.

    For a PDF, this means:
    • All text from every page
    • Tables converted to structured text
    • Descriptions of images and charts

    📄 quarterly_report.pdf
         │
         ▼
    ┌────────────────────────────────┐
    │  Google Gemini AI              │
    │  ═══════════════════           │
    │                                │
    │  "I see this PDF has 15 pages. │
    │   Page 1 is the title page...  │
    │   Page 4 has a revenue table..." │
    │                                │
    │  OUTPUT: All text extracted    │
    └────────────────────────────────┘


Step 4: CHUNK THE CONTENT
═════════════════════════
The extracted text is split into smaller pieces called "chunks."

    Why chunks?
    • AI models have limits on how much text they can process at once
    • Smaller pieces are easier to search through
    • We only retrieve the RELEVANT chunks, not the whole document

    Full Document Text (10,000 words)
         │
         ▼
    ┌──────────────────────────────────────────────┐
    │  Chunking Process                            │
    │  ════════════════                            │
    │                                              │
    │  Split into ~800-word pieces with overlap    │
    │                                              │
    │  Chunk 1: "Q3 2024 Report. Executive         │
    │            Summary: Revenue grew by 15%..."  │
    │                                              │
    │  Chunk 2: "...continued from previous.       │
    │            The North American market..."     │
    │                                              │
    │  Chunk 3: "...expenses decreased due to      │
    │            operational efficiencies..."      │
    │                                              │
    │  (12 chunks total)                           │
    └──────────────────────────────────────────────┘


Step 5: CREATE EMBEDDINGS (The Magic)
═════════════════════════════════════
Each chunk is converted into numbers that represent its meaning.

    What are embeddings?

    Computers don't understand meaning. To a computer, "dog" and "canine"
    are completely different strings of characters, even though they mean
    the same thing.

    EMBEDDINGS convert text into numbers that capture meaning:

    ┌────────────────────────────────────────────────────────────────────┐
    │                                                                    │
    │  "I love dogs"       → [0.21, 0.85, 0.12, 0.53, 0.77, ...]        │
    │                          (768 numbers)                            │
    │                                                                    │
    │  "I adore puppies"   → [0.22, 0.84, 0.11, 0.55, 0.76, ...]        │
    │                          (768 numbers - VERY SIMILAR!)            │
    │                                                                    │
    │  "I hate vegetables" → [0.89, 0.12, 0.76, 0.23, 0.11, ...]        │
    │                          (768 numbers - VERY DIFFERENT!)          │
    │                                                                    │
    └────────────────────────────────────────────────────────────────────┘

    Notice how "dogs" and "puppies" have similar numbers? That's because
    they have similar meanings! This is how the AI "understands" text.

    Why 768 numbers?
    That's the size Google's embedding model uses. More numbers = more
    nuanced understanding of meaning. Think of it like coordinates in a
    768-dimensional space where similar meanings are close together.


Step 6: STORE EVERYTHING
════════════════════════
The chunks and their embeddings are saved to the database.

    ┌──────────────────────────────────────────────────────────────────┐
    │  Supabase Database (PostgreSQL + pgvector)                       │
    │  ══════════════════════════════════════════                      │
    │                                                                  │
    │  documents table:                                                │
    │  ┌─────┬─────────────────────┬────────┬───────────┐              │
    │  │ id  │ file_name           │ status │ chunks    │              │
    │  ├─────┼─────────────────────┼────────┼───────────┤              │
    │  │ abc │ quarterly_report.pdf│ ready  │ 12        │              │
    │  └─────┴─────────────────────┴────────┴───────────┘              │
    │                                                                  │
    │  chunks table:                                                   │
    │  ┌─────┬─────────────────────┬───────────────────────────┐       │
    │  │ id  │ content             │ content_vector            │       │
    │  ├─────┼─────────────────────┼───────────────────────────┤       │
    │  │ 001 │ "Q3 2024 Report..." │ [0.21, 0.85, 0.12, ...]   │       │
    │  │ 002 │ "North American..." │ [0.33, 0.67, 0.45, ...]   │       │
    │  │ ... │ ...                 │ ...                       │       │
    │  └─────┴─────────────────────┴───────────────────────────┘       │
    │                                                                  │
    └──────────────────────────────────────────────────────────────────┘
```

### Phase 2: Asking Questions (Query)

```
Step 7: ASK A QUESTION
══════════════════════
You type: "What was the Q3 revenue?"

    ┌─────────────────────────┐
    │                         │
    │  Your Question          │
    │  ══════════════         │
    │                         │
    │  "What was the          │
    │   Q3 revenue?"          │
    │                         │
    └───────────┬─────────────┘
                │
                ▼

Step 8: CONVERT QUESTION TO EMBEDDING
═════════════════════════════════════
Your question is converted to the same 768-number format.

    "What was the Q3 revenue?"
              │
              ▼
    ┌────────────────────────────────────────┐
    │  Google Gemini Embedding Model         │
    │  ═════════════════════════════         │
    │                                        │
    │  Input: "What was the Q3 revenue?"     │
    │  Output: [0.19, 0.82, 0.15, 0.51, ...] │
    │          (768 numbers)                 │
    │                                        │
    └────────────────────────────────────────┘


Step 9: SEARCH FOR SIMILAR CHUNKS (Vector Search)
═════════════════════════════════════════════════
We compare your question's embedding to all stored chunk embeddings.

    ┌────────────────────────────────────────────────────────────────────┐
    │  Vector Similarity Search                                          │
    │  ═════════════════════════                                         │
    │                                                                    │
    │  Your question:  [0.19, 0.82, 0.15, 0.51, ...]                     │
    │                                                                    │
    │  Compare to each chunk:                                            │
    │                                                                    │
    │  Chunk 001: [0.21, 0.85, 0.12, 0.53, ...]                          │
    │             Similarity: 94% ✅ HIGH MATCH!                         │
    │             Content: "Q3 2024 revenue was $50 million..."          │
    │                                                                    │
    │  Chunk 002: [0.33, 0.67, 0.45, 0.89, ...]                          │
    │             Similarity: 67%                                        │
    │             Content: "The marketing department..."                 │
    │                                                                    │
    │  Chunk 003: [0.88, 0.12, 0.95, 0.11, ...]                          │
    │             Similarity: 23%                                        │
    │             Content: "Office furniture was replaced..."            │
    │                                                                    │
    │  Result: Return top 5 most similar chunks                          │
    │                                                                    │
    └────────────────────────────────────────────────────────────────────┘


Step 10: GENERATE ANSWER
════════════════════════
The AI reads the relevant chunks and writes an answer.

    ┌────────────────────────────────────────────────────────────────────┐
    │  Google Gemini AI                                                  │
    │  ═══════════════                                                   │
    │                                                                    │
    │  PROMPT SENT TO AI:                                                │
    │  ══════════════════                                                │
    │                                                                    │
    │  "You are a helpful assistant. Answer the user's question          │
    │   based ONLY on the following sources. Cite your sources.          │
    │                                                                    │
    │   SOURCE 1: Q3 2024 revenue was $50 million, representing          │
    │   a 15% increase from Q2...                                        │
    │                                                                    │
    │   SOURCE 2: The revenue breakdown shows North America              │
    │   contributed $30 million...                                       │
    │                                                                    │
    │   QUESTION: What was the Q3 revenue?"                              │
    │                                                                    │
    │  AI RESPONSE:                                                      │
    │  ═════════════                                                     │
    │                                                                    │
    │  "Based on the Q3 2024 Report, the revenue was $50 million,        │
    │   which was a 15% increase from Q2 [Source 1]. North America       │
    │   was the largest contributor at $30 million [Source 2]."          │
    │                                                                    │
    └────────────────────────────────────────────────────────────────────┘


Step 11: DISPLAY ANSWER WITH SOURCES
════════════════════════════════════
You see the answer with clickable source references.

    ┌────────────────────────────────────────────────────────────────────┐
    │  Chat Interface                                                    │
    │  ═══════════════                                                   │
    │                                                                    │
    │  You: What was the Q3 revenue?                                     │
    │                                                                    │
    │  Assistant: Based on the Q3 2024 Report, the revenue was           │
    │  $50 million, which was a 15% increase from Q2 [Source 1].         │
    │  North America was the largest contributor at $30 million          │
    │  [Source 2].                                                       │
    │                                                                    │
    │  Sources:                                                          │
    │  ┌────────────────────────────────────────────────────────────┐    │
    │  │ [1] quarterly_report.pdf (94% match)                       │    │
    │  │     "Q3 2024 revenue was $50 million, representing..."     │    │
    │  ├────────────────────────────────────────────────────────────┤    │
    │  │ [2] quarterly_report.pdf (89% match)                       │    │
    │  │     "The revenue breakdown shows North America..."         │    │
    │  └────────────────────────────────────────────────────────────┘    │
    │                                                                    │
    └────────────────────────────────────────────────────────────────────┘
```

## What Makes MegaRAG Special?

Most RAG systems only work with text documents. MegaRAG works with **everything**:

| File Type | What MegaRAG Does | How It Works |
|-----------|-------------------|--------------|
| **PDF** | Extracts text, tables, images | Gemini File API reads every page natively |
| **Word (.docx)** | Extracts all text and formatting | Gemini File API processes document directly |
| **PowerPoint (.pptx)** | Extracts slide content | Gemini File API processes presentation directly |
| **Excel (.xlsx)** | Extracts cell data | Gemini File API processes spreadsheet directly |
| **Images** | Describes what's in the image | Gemini Vision analyzes the image: "A bar chart showing sales by region..." |
| **Videos** | Analyzes video content over time | Gemini File API: "At 0:30, the speaker discusses..." |
| **Audio** | Transcribes speech to text | Gemini File API transcribes audio to searchable text |
| **Text files** | Reads directly | Direct text chunking |

> **Note:** All document processing happens via Google's Gemini API - no external services needed!

---

# 🔧 The Technology: How Does It Work?

## The Technology Stack

Here's every piece of technology in MegaRAG and why we use it:

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                     │
│                              YOUR WEB BROWSER                                       │
│                              ════════════════                                       │
│                                                                                     │
│   What: Chrome, Firefox, Safari, or Edge                                            │
│   Why: You interact with MegaRAG through a web app                                  │
│                                                                                     │
│   You see:                                                                          │
│   • Document upload page                                                            │
│   • Chat interface                                                                  │
│   • Search results                                                                  │
│                                                                                     │
└────────────────────────────────────────────┬────────────────────────────────────────┘
                                             │
                                             │ HTTP requests (like loading a webpage)
                                             │
                                             ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                     │
│                              NEXT.JS APPLICATION                                    │
│                              ════════════════════                                   │
│                                                                                     │
│   What: A React framework that handles both frontend and backend                    │
│   Why: One codebase for everything, great developer experience                      │
│                                                                                     │
│   ┌─────────────────────────────────┐    ┌─────────────────────────────────┐        │
│   │       FRONTEND (React)          │    │       BACKEND (API Routes)      │        │
│   │       ═════════════════         │    │       ═══════════════════       │        │
│   │                                 │    │                                 │        │
│   │  • src/app/page.tsx            │    │  • src/app/api/upload/          │        │
│   │    (Landing page)               │    │    (Handles file uploads)       │        │
│   │                                 │    │                                 │        │
│   │  • src/app/dashboard/          │    │  • src/app/api/query/           │        │
│   │    (Main application)           │    │    (Handles questions)          │        │
│   │                                 │    │                                 │        │
│   │  • src/components/             │    │  • src/app/api/documents/       │        │
│   │    (Reusable UI pieces)         │    │    (List, delete documents)     │        │
│   │                                 │    │                                 │        │
│   │  Written in: TypeScript        │    │  Written in: TypeScript         │        │
│   │  Styling: Tailwind CSS          │    │  Runs on: Node.js server        │        │
│   └─────────────────────────────────┘    └─────────────────────────────────┘        │
│                                                                                     │
└────────────┬────────────────────────────────────────────────────────┬───────────────┘
             │                                                        │
             │ Database queries                                       │ AI API calls
             │ File storage                                           │
             ▼                                                        ▼
┌─────────────────────────────────────────┐    ┌─────────────────────────────────────────┐
│                                         │    │                                         │
│            SUPABASE                     │    │            GOOGLE GEMINI                │
│            ════════                     │    │            ═════════════                │
│                                         │    │                                         │
│   What: A "Backend as a Service"        │    │   What: Google's AI model               │
│   Why: We don't have to manage servers  │    │   Why: Best balance of quality/price    │
│                                         │    │                                         │
│   Provides:                             │    │   Provides:                             │
│   ┌───────────────────────────────┐     │    │   ┌───────────────────────────────┐     │
│   │   PostgreSQL Database         │     │    │   │   Text Understanding          │     │
│   │   ═══════════════════         │     │    │   │   ════════════════════         │     │
│   │                               │     │    │   │                               │     │
│   │   Stores all our data:        │     │    │   │   • Read and understand PDFs  │     │
│   │   • Document metadata         │     │    │   │   • Describe images           │     │
│   │   • Text chunks               │     │    │   │   • Analyze video content     │     │
│   │   • Embeddings (vectors)      │     │    │   │   • Transcribe audio          │     │
│   │   • Entities & relations      │     │    │   │   • Generate answers          │     │
│   │   • Chat history              │     │    │   │                               │     │
│   │                               │     │    │   ├───────────────────────────────┤     │
│   │   With pgvector extension:    │     │    │   │   Embedding Generation        │     │
│   │   • Store 768-dim vectors     │     │    │   │   ════════════════════         │     │
│   │   • Fast similarity search    │     │    │   │                               │     │
│   │                               │     │    │   │   • Convert text to numbers   │     │
│   ├───────────────────────────────┤     │    │   │   • 768-dimensional vectors   │     │
│   │   File Storage                │     │    │   │   • Semantic understanding    │     │
│   │   ═══════════                 │     │    │   │                               │     │
│   │                               │     │    │   ├───────────────────────────────┤     │
│   │   Stores original files:      │     │    │   │   File API                    │     │
│   │   • PDFs                      │     │    │   │   ════════                     │     │
│   │   • Videos                    │     │    │   │                               │     │
│   │   • Images                    │     │    │   │   • Upload large files        │     │
│   │   • Audio                     │     │    │   │   • Process videos (up to 1GB)│     │
│   │                               │     │    │   │   • Process audio             │     │
│   └───────────────────────────────┘     │    │   └───────────────────────────────┘     │
│                                         │    │                                         │
│   Free tier: 500MB database, 1GB storage│    │   Free tier: 15 req/min, 1M tokens/day  │
│                                         │    │                                         │
└─────────────────────────────────────────┘    └─────────────────────────────────────────┘
```

## Understanding Key Concepts

### What is pgvector?

PostgreSQL (the database) is great at storing and searching normal data. But it doesn't natively support searching by **similarity**.

For example, a normal database search:
```sql
-- Find exact match: only returns "Smith Contract"
SELECT * FROM documents WHERE name = 'Smith Contract';
```

But with embeddings, we need **similarity search**:
```sql
-- Find documents SIMILAR to "Smith agreement"
-- Should return: "Smith Contract", "J. Smith Deal", "Contract with Smith Inc."
SELECT * FROM documents
ORDER BY embedding <=> query_embedding  -- Find most similar
LIMIT 5;
```

**pgvector** is an extension that adds this capability:

- `VECTOR(768)` data type: Store 768-dimensional vectors
- `<=>` operator: Calculate cosine distance between vectors
- `HNSW` index: Make similarity search fast (without it, we'd compare against every single row)

### What is HNSW?

HNSW stands for "Hierarchical Navigable Small World."

Without getting too technical, it's a way to organize vectors so we can find similar ones quickly:

```
Without HNSW (slow):
════════════════════
Question embedding: [0.1, 0.2, 0.3, ...]

Compare to chunk 1... 45% similar
Compare to chunk 2... 23% similar
Compare to chunk 3... 87% similar  ← Found a good one!
Compare to chunk 4... 12% similar
Compare to chunk 5... 67% similar
... compare to ALL 10,000 chunks (slow!)


With HNSW (fast):
═════════════════
Question embedding: [0.1, 0.2, 0.3, ...]

Start at a random point, hop to closer neighbors:
Chunk 500 (45%) → Chunk 234 (67%) → Chunk 891 (89%) → Found!

Only compared ~50 chunks instead of 10,000 (fast!)
```

### Understanding Cosine Similarity

When we compare two embeddings, we use "cosine similarity":

```
Vector A: [0.5, 0.5]    (pointing northeast)
Vector B: [0.6, 0.7]    (also pointing northeast-ish)
Vector C: [-0.5, 0.5]   (pointing northwest)

Cosine similarity measures the ANGLE between vectors:

A and B: Small angle = HIGH similarity (0.98)
A and C: Large angle = LOW similarity (0.0)

         B
        /
       /
      / small angle
     /
    A────────────
                  \
                   \ large angle
                    \
                     C

This works regardless of the "length" of the vectors,
which makes it perfect for comparing text embeddings.
```

---

# 📋 Prerequisites: What You Need Before Starting

Before you can run MegaRAG, you need to set up a few things. This section walks you through each one.

## Required Software

### 1. Node.js (JavaScript Runtime)

**What is Node.js?**
Node.js lets your computer run JavaScript outside of a web browser. Since MegaRAG is built with JavaScript/TypeScript, you need Node.js to run it.

**How to install Node.js:**

<details>
<summary><strong>Option A: Download from Website (Easiest)</strong></summary>

1. Go to [nodejs.org](https://nodejs.org/)
2. You'll see two download buttons:
   - **LTS (Long Term Support)** - Choose this one!
   - Current - Has newer features but less stable
3. Click the LTS button to download
4. Run the installer:
   - **Windows**: Double-click the `.msi` file, click Next through the wizard
   - **Mac**: Double-click the `.pkg` file, follow the prompts
5. Restart your terminal/command prompt

</details>

<details>
<summary><strong>Option B: Using nvm (Recommended for developers)</strong></summary>

nvm (Node Version Manager) lets you easily switch between Node.js versions.

**Mac/Linux:**
```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Restart terminal, then install Node.js
nvm install 18
nvm use 18
```

**Windows:**
Download and install [nvm-windows](https://github.com/coreybutler/nvm-windows/releases)

</details>

**Verify Node.js is installed:**

Open Terminal (Mac) or Command Prompt (Windows) and run:

```bash
node --version
```

**What you should see:**
```
v18.17.0
```
(or any version 18.x or higher)

**If you see an error:**
- "node is not recognized" - Node.js isn't installed or not in your PATH
- Try restarting your terminal
- If using Windows, make sure to restart Command Prompt after installation

---

### 2. Git (Version Control)

**What is Git?**
Git is a tool that lets you download code from GitHub and track changes to your own code.

**How to install Git:**

<details>
<summary><strong>Windows</strong></summary>

1. Go to [git-scm.com/download/windows](https://git-scm.com/download/windows)
2. The download should start automatically
3. Run the installer with default settings (just keep clicking Next)

</details>

<details>
<summary><strong>Mac</strong></summary>

Git comes pre-installed on most Macs. If not:

```bash
# Using Homebrew (if you have it)
brew install git

# Or it will prompt you to install Xcode Command Line Tools
git --version
```

</details>

<details>
<summary><strong>Linux</strong></summary>

```bash
# Ubuntu/Debian
sudo apt-get install git

# Fedora
sudo dnf install git
```

</details>

**Verify Git is installed:**

```bash
git --version
```

**What you should see:**
```
git version 2.39.0
```
(or any version 2.x)

---

## Required Accounts

### 3. Supabase Account (Free)

**What is Supabase?**
Supabase is a "Backend as a Service" that provides:
- A PostgreSQL database (where we store all our data)
- File storage (where we store uploaded documents)
- Automatic API generation
- pgvector extension (for semantic search)

**Why Supabase?**
- Free tier is very generous (500MB database, 1GB file storage)
- Managed service (you don't have to set up servers)
- Has pgvector pre-installed
- Easy to use dashboard

**How to create a Supabase account:**

1. Go to [supabase.com](https://supabase.com/)
2. Click **"Start your project"** (top right)
3. Click **"Sign up with GitHub"** (easiest) or use email
4. If using GitHub:
   - Click "Authorize Supabase"
   - You may need to verify your email
5. You'll land on the Supabase Dashboard
6. **Don't create a project yet** - we'll do that in the setup steps

**What you should see:**
The Supabase Dashboard with a "New project" button.

---

### 4. Google AI API Key (Free)

**What is the Google AI API?**
It's how we access Google's Gemini AI models programmatically. Gemini is the AI that:
- Reads and understands your documents
- Creates embeddings (the 768-number vectors)
- Generates answers to your questions

**Why Gemini?**
- Excellent quality for the price
- Can handle images, video, and audio
- Generous free tier (15 requests/minute, 1 million tokens/day)
- Easy to set up

**How to get a Google AI API key:**

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Sign in with your Google account (Gmail)
3. You might see a welcome screen - click through it
4. Click **"Create API key"**
5. Click **"Create API key in new project"** (or select an existing project)
6. **Copy the API key immediately!**
   - It starts with `AIza`
   - It's about 40 characters long
   - Example: `AIzaSyC1234567890abcdefghijklmnopqrstuvwx`
7. **Save this key somewhere safe** (Notes app, password manager, etc.)
   - You won't be able to see it again in Google's dashboard
   - If you lose it, you'll need to create a new one

**What you should see:**
A page showing your API key with a "Copy" button.

**Important notes:**
- This key is **secret** - don't share it publicly or commit it to GitHub
- The free tier has limits, but they're generous for personal use
- If you hit rate limits, wait a minute and try again

---

## Summary Checklist

Before proceeding, make sure you have:

- [ ] **Node.js** installed (run `node --version` to verify)
- [ ] **Git** installed (run `git --version` to verify)
- [ ] **Supabase account** created (you should see the dashboard)
- [ ] **Google AI API key** copied and saved somewhere safe

---

# 🚀 Step-by-Step Setup Guide

Now let's set everything up. Follow these steps in order.

## Step 1: Download the Code

### Step 1.1: Open Your Terminal

**What is a terminal?**
A terminal (also called command line or command prompt) is a text-based interface to your computer. Instead of clicking buttons, you type commands.

**How to open the terminal:**

- **Mac**: Press `Cmd + Space`, type "Terminal", press Enter
- **Windows**: Press `Win + R`, type "cmd", press Enter (or search for "Command Prompt" or "PowerShell")
- **Linux**: Press `Ctrl + Alt + T`

You should see a window with a blinking cursor, something like:

```
your-username@your-computer ~ %
```

### Step 1.2: Navigate to Where You Want the Project

When you download code, it goes into your current folder. Let's put it somewhere sensible.

**Option A: Use your home directory (simplest)**
```bash
# Go to your home directory
cd ~
```

**Option B: Use a specific folder**
```bash
# Example: Put it in a "Projects" folder
cd ~/Projects

# If the Projects folder doesn't exist, create it first:
mkdir -p ~/Projects
cd ~/Projects
```

**How to verify where you are:**
```bash
pwd
```

This prints your current directory. You should see something like:
- Mac: `/Users/yourname` or `/Users/yourname/Projects`
- Windows: `C:\Users\yourname` or `C:\Users\yourname\Projects`

### Step 1.3: Clone the Repository

"Cloning" means downloading a copy of the code from GitHub.

```bash
git clone https://github.com/promptadvisers/megarag.git
```

**What you should see:**
```
Cloning into 'megarag'...
remote: Enumerating objects: 150, done.
remote: Counting objects: 100% (150/150), done.
remote: Compressing objects: 100% (100/100), done.
remote: Total 150 (delta 45), reused 140 (delta 35)
Receiving objects: 100% (150/150), 250.00 KiB | 2.50 MiB/s, done.
Resolving deltas: 100% (45/45), done.
```

**If you see an error:**
- `git: command not found` - Git isn't installed. Go back to Prerequisites.
- `Repository not found` - Check the URL for typos
- `Permission denied` - You might need to authenticate with GitHub

### Step 1.4: Navigate into the Project

```bash
cd megarag
```

Now you're inside the project folder. Verify:

```bash
pwd
```

Should show: `/Users/yourname/megarag` or similar

### Step 1.5: Install Dependencies

JavaScript projects use "packages" (pre-written code libraries) for common tasks. The `package.json` file lists all the packages MegaRAG needs. The `npm install` command downloads them all.

```bash
npm install
```

**What you should see:**
```
npm warn deprecated some-package@1.0.0: ...
(Some warnings are normal, don't worry about them)

added 285 packages, and audited 286 packages in 15s

72 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
```

**If you see errors:**
- `npm: command not found` - Node.js isn't installed properly
- `EACCES: permission denied` - On Mac/Linux, try: `sudo npm install`
- Network errors - Check your internet connection

**What just happened?**
- npm read `package.json` to see what packages we need
- It downloaded ~285 packages into a folder called `node_modules`
- This folder is large (~200MB) but you never need to look inside it

### Step 1.6: Verify the Project Structure

Let's make sure everything downloaded correctly:

```bash
ls -la
```

**What you should see:**
```
drwxr-xr-x   node_modules/
drwxr-xr-x   public/
drwxr-xr-x   src/
-rw-r--r--   .env.example
-rw-r--r--   .gitignore
-rw-r--r--   next.config.mjs
-rw-r--r--   package.json
-rw-r--r--   package-lock.json
-rw-r--r--   README.md
-rw-r--r--   tsconfig.json
...
```

If you don't see `node_modules`, run `npm install` again.

---

## Step 2: Create Your Supabase Project

### Step 2.1: Go to Supabase Dashboard

1. Open your browser
2. Go to [supabase.com](https://supabase.com/)
3. Click **"Dashboard"** (top right) or sign in

### Step 2.2: Create a New Project

1. Click the big **"New project"** button
2. Fill in the form:
   - **Organization**: Select your personal organization (or create one)
   - **Name**: `megarag` (or any name you like)
   - **Database Password**: Click "Generate a password"
   - **IMPORTANT**: Copy this password and save it somewhere! You won't see it again.
   - **Region**: Choose the closest to you
     - If you're in the US: `us-east-1` or `us-west-1`
     - If you're in Europe: `eu-west-1` or `eu-central-1`
   - **Pricing Plan**: Free tier is fine
3. Click **"Create new project"**
4. **Wait 2-3 minutes** while Supabase sets up your database

**What you should see:**
A progress screen saying "Setting up project..." followed by the Project Dashboard.

### Step 2.3: Get Your Supabase Credentials

Once your project is ready:

1. Click the **Settings** icon (gear ⚙️) in the left sidebar
2. Click **API** under "Project Settings"
3. You'll see a page with your credentials

**Find and copy these three values:**

| Field | Where to find it | What it looks like |
|-------|------------------|-------------------|
| **Project URL** | Under "Project URL" | `https://abcd1234.supabase.co` |
| **anon public** | Under "Project API keys" | `eyJhbGciOiJIUzI1...` (shorter JWT) |
| **service_role** | Under "Project API keys" (click "Reveal") | `eyJhbGciOiJIUzI1...` (longer JWT) |

**IMPORTANT:**
- Keep the **service_role** key SECRET. It has full database access.
- The **anon** key is safe to use in browser code (it has limited permissions)

**Write these down or paste them in a notes app. You'll need them soon.**

---

## Step 3: Set Up the Database

Now we need to create the tables and functions that MegaRAG uses.

### Step 3.1: Open the SQL Editor

1. In Supabase Dashboard, click **SQL Editor** in the left sidebar
2. You'll see a blank query window
3. This is where we'll run SQL commands

### Step 3.2: Run Each SQL Command

**How to run SQL in Supabase:**
1. Copy the SQL code from below
2. Paste it into the SQL Editor
3. Click the green **"Run"** button (or press Cmd/Ctrl + Enter)
4. Check for success message at the bottom
5. Repeat for the next SQL block

**Run these SQL commands in order:**

---

#### SQL Command 1: Enable pgvector Extension

```sql
-- ═══════════════════════════════════════════════════════════════════════════════
-- Enable pgvector extension
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- What this does:
-- pgvector is a PostgreSQL extension that lets us store and search embeddings
-- (those 768-number arrays that represent meaning). Without this extension,
-- PostgreSQL wouldn't understand what to do with vector data.
--
-- What happens:
-- After this runs, PostgreSQL gains new capabilities:
-- • VECTOR(768) data type - can store arrays of 768 floating-point numbers
-- • <=> operator - can calculate distance between two vectors
-- • HNSW index type - can create fast similarity search indexes

CREATE EXTENSION IF NOT EXISTS vector;
```

**What you should see:**
```
Success. No rows returned
```

---

#### SQL Command 2: Create Documents Table

```sql
-- ═══════════════════════════════════════════════════════════════════════════════
-- Create the documents table
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- What this does:
-- This table stores metadata about each file you upload. Think of it as the
-- "card catalog" that tracks what files exist and their processing status.
--
-- What each column means:
-- • id: A unique identifier for each document (we generate this)
-- • file_name: The original filename like "quarterly_report.pdf"
-- • file_type: The extension like "pdf", "mp4", "png"
-- • file_size: How big the file is in bytes
-- • file_path: Where the file is stored in Supabase Storage
-- • status: Where we are in processing: pending → processing → processed → (or failed)
-- • chunks_count: How many text chunks were created from this document
-- • error_message: If processing failed, what went wrong
-- • metadata: A flexible JSON field for extra data
-- • created_at/updated_at: When the record was created/modified

CREATE TABLE IF NOT EXISTS documents (
    id VARCHAR(255) PRIMARY KEY,
    workspace VARCHAR(255) DEFAULT 'default',
    file_name VARCHAR(1024) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size BIGINT,
    file_path TEXT,
    status VARCHAR(64) DEFAULT 'pending',
    chunks_count INTEGER DEFAULT 0,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes make queries faster by pre-organizing the data
-- Think of them like the index at the back of a book
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_file_type ON documents(file_type);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);
```

**What you should see:**
```
Success. No rows returned
```

---

#### SQL Command 3: Create Chunks Table

```sql
-- ═══════════════════════════════════════════════════════════════════════════════
-- Create the chunks table
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- What this does:
-- This is the MOST IMPORTANT table. It stores the actual content from your
-- documents, broken into searchable pieces, along with their embeddings.
--
-- Why "chunks"?
-- Documents can be very long (100+ pages). We can't search the whole thing
-- at once. Instead, we break it into smaller pieces (~800 words each) and
-- search those. When you ask a question, we find the most relevant chunks,
-- not entire documents.
--
-- What each column means:
-- • id: Unique identifier for this chunk
-- • document_id: Which document this chunk came from (links to documents table)
-- • chunk_order_index: The order of this chunk (1st, 2nd, 3rd piece of the doc)
-- • content: The actual text content of this chunk
-- • content_vector: The embedding - 768 numbers representing the meaning
-- • tokens: How many tokens (roughly words) are in this chunk
-- • chunk_type: What kind of content: text, image, table, video_segment, audio
-- • page_idx: Which page this came from (for PDFs)
-- • timestamp_start/end: Time range (for video/audio)
--
-- The REFERENCES clause creates a "foreign key":
-- • It means document_id MUST exist in the documents table
-- • ON DELETE CASCADE means: if we delete a document, delete its chunks too

CREATE TABLE IF NOT EXISTS chunks (
    id VARCHAR(255) PRIMARY KEY,
    workspace VARCHAR(255) DEFAULT 'default',
    document_id VARCHAR(255) REFERENCES documents(id) ON DELETE CASCADE,
    chunk_order_index INTEGER,
    content TEXT NOT NULL,
    content_vector VECTOR(768),
    tokens INTEGER,
    chunk_type VARCHAR(50) DEFAULT 'text',
    page_idx INTEGER,
    timestamp_start FLOAT,
    timestamp_end FLOAT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for quickly finding all chunks belonging to a document
CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_type ON chunks(chunk_type);

-- HNSW index for fast vector similarity search
-- This is the magic that makes semantic search fast
-- Without it, we'd have to compare every single chunk (slow!)
-- With it, we can find similar chunks in milliseconds
--
-- Parameters:
-- • vector_cosine_ops: Use cosine similarity (measures angle between vectors)
-- • m = 16: Number of connections per node (higher = more accurate, more memory)
-- • ef_construction = 64: Build quality (higher = better index, slower build)
CREATE INDEX IF NOT EXISTS idx_chunks_vector ON chunks
USING hnsw (content_vector vector_cosine_ops) WITH (m = 16, ef_construction = 64);
```

**What you should see:**
```
Success. No rows returned
```

---

#### SQL Command 4: Create Entities Table

```sql
-- ═══════════════════════════════════════════════════════════════════════════════
-- Create the entities table
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- What this does:
-- This table stores "entities" extracted from your documents. Entities are
-- notable things like people, companies, places, concepts, etc.
--
-- Why entities?
-- Entities enable more intelligent searching. Instead of just finding text
-- that matches your query, we can understand WHAT you're asking about.
--
-- Example:
-- Document mentions "Tim Cook" multiple times across different chunks.
-- We create ONE entity for "Tim Cook" with type "PERSON" and a description
-- like "CEO of Apple Inc., mentioned in context of product announcements."
--
-- What each column means:
-- • id: Unique identifier
-- • entity_name: The name like "Tim Cook" or "Apple Inc."
-- • entity_type: Category: PERSON, ORGANIZATION, LOCATION, EVENT, CONCEPT, etc.
-- • description: Context about this entity from the documents
-- • content_vector: Embedding of the description (for semantic search)
-- • source_chunk_ids: Which chunks mention this entity (JSON array)

CREATE TABLE IF NOT EXISTS entities (
    id VARCHAR(255) PRIMARY KEY,
    workspace VARCHAR(255) DEFAULT 'default',
    entity_name VARCHAR(512) NOT NULL,
    entity_type VARCHAR(128),
    description TEXT,
    content_vector VECTOR(768),
    source_chunk_ids JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(entity_name);
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_entities_vector ON entities
USING hnsw (content_vector vector_cosine_ops) WITH (m = 16, ef_construction = 64);
```

**What you should see:**
```
Success. No rows returned
```

---

#### SQL Command 5: Create Relations Table

```sql
-- ═══════════════════════════════════════════════════════════════════════════════
-- Create the relations table
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- What this does:
-- This table stores RELATIONSHIPS between entities. This is what makes
-- MegaRAG a "knowledge graph" system.
--
-- Example relationships:
-- • "Tim Cook" --[CEO_OF]--> "Apple Inc."
-- • "iPhone 15" --[MANUFACTURED_BY]--> "Apple Inc."
-- • "WWDC 2024" --[HOSTED_BY]--> "Apple Inc."
--
-- Why relationships?
-- They enable complex queries that follow connections:
-- Q: "Who leads companies that make smartphones?"
-- → Find "smartphone" entities
-- → Find relationships where smartphones are targets
-- → Find source entities with "CEO" or "leads" relationships
-- → Return those people
--
-- What each column means:
-- • source_entity_id: The entity where the relationship starts ("Tim Cook")
-- • target_entity_id: The entity where the relationship points ("Apple Inc.")
-- • relation_type: The type of relationship ("CEO_OF")
-- • description: More context about this relationship
-- • content_vector: Embedding for semantic search on relationships

CREATE TABLE IF NOT EXISTS relations (
    id VARCHAR(255) PRIMARY KEY,
    workspace VARCHAR(255) DEFAULT 'default',
    source_entity_id VARCHAR(512),
    target_entity_id VARCHAR(512),
    relation_type VARCHAR(256),
    description TEXT,
    content_vector VECTOR(768),
    source_chunk_ids JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_relations_source ON relations(source_entity_id);
CREATE INDEX IF NOT EXISTS idx_relations_target ON relations(target_entity_id);
CREATE INDEX IF NOT EXISTS idx_relations_type ON relations(relation_type);
CREATE INDEX IF NOT EXISTS idx_relations_vector ON relations
USING hnsw (content_vector vector_cosine_ops) WITH (m = 16, ef_construction = 64);
```

**What you should see:**
```
Success. No rows returned
```

---

#### SQL Command 6: Create Chat Tables

```sql
-- ═══════════════════════════════════════════════════════════════════════════════
-- Create chat session and message tables
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- What this does:
-- These tables store your conversation history so you can have multi-turn
-- chats and come back to previous conversations.
--
-- chat_sessions: One row per conversation thread
-- chat_messages: One row per message (both user questions and AI responses)

CREATE TABLE IF NOT EXISTS chat_sessions (
    id VARCHAR(255) PRIMARY KEY,
    workspace VARCHAR(255) DEFAULT 'default',
    title VARCHAR(512) DEFAULT 'New Chat',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id VARCHAR(255) PRIMARY KEY,
    session_id VARCHAR(255) REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,  -- 'user' or 'assistant'
    content TEXT NOT NULL,
    sources JSONB DEFAULT '[]'::jsonb,  -- Source references for AI responses
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated ON chat_sessions(updated_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
```

**What you should see:**
```
Success. No rows returned
```

---

#### SQL Command 7: Create LLM Cache Table

```sql
-- ═══════════════════════════════════════════════════════════════════════════════
-- Create LLM cache table
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- What this does:
-- Caches AI responses to avoid calling the API repeatedly for the same question.
-- If you ask "What was Q3 revenue?" twice, we return the cached answer instantly
-- instead of paying for another API call.
--
-- Cache entries expire after 24 hours by default (configurable).

CREATE TABLE IF NOT EXISTS llm_cache (
    id VARCHAR(255) PRIMARY KEY,
    prompt_hash VARCHAR(64) NOT NULL,  -- Hash of the full prompt
    response TEXT NOT NULL,            -- The cached AI response
    model VARCHAR(128),                -- Which model generated this
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_llm_cache_hash ON llm_cache(prompt_hash);
CREATE INDEX IF NOT EXISTS idx_llm_cache_expires ON llm_cache(expires_at);
```

**What you should see:**
```
Success. No rows returned
```

---

#### SQL Command 8: Create Search Functions

```sql
-- ═══════════════════════════════════════════════════════════════════════════════
-- Create search functions
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- What these do:
-- These are reusable functions that perform similarity search. Instead of
-- writing complex SQL queries in our code, we call these functions.
--
-- How they work:
-- 1. Take a query_embedding (your question converted to 768 numbers)
-- 2. Find rows where the embedding is similar (above match_threshold)
-- 3. Return the most similar ones (up to match_count)
--
-- The <=> operator calculates cosine distance:
-- • 0 = identical vectors
-- • 2 = opposite vectors
-- We convert to similarity by doing: 1 - distance
-- So similarity of 0.9 means 90% similar

-- Search chunks by semantic similarity
CREATE OR REPLACE FUNCTION search_chunks(
    query_embedding VECTOR(768),
    match_threshold FLOAT DEFAULT 0.3,
    match_count INT DEFAULT 10
) RETURNS TABLE (
    id VARCHAR,
    document_id VARCHAR,
    content TEXT,
    chunk_type VARCHAR,
    similarity FLOAT
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.document_id,
        c.content,
        c.chunk_type,
        (1 - (c.content_vector <=> query_embedding))::FLOAT AS similarity
    FROM chunks c
    WHERE c.content_vector IS NOT NULL
      AND 1 - (c.content_vector <=> query_embedding) > match_threshold
    ORDER BY c.content_vector <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Search entities by semantic similarity
CREATE OR REPLACE FUNCTION search_entities(
    query_embedding VECTOR(768),
    match_threshold FLOAT DEFAULT 0.3,
    match_count INT DEFAULT 20
) RETURNS TABLE (
    id VARCHAR,
    entity_name VARCHAR,
    entity_type VARCHAR,
    description TEXT,
    similarity FLOAT
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id,
        e.entity_name,
        e.entity_type,
        e.description,
        (1 - (e.content_vector <=> query_embedding))::FLOAT AS similarity
    FROM entities e
    WHERE e.content_vector IS NOT NULL
      AND 1 - (e.content_vector <=> query_embedding) > match_threshold
    ORDER BY e.content_vector <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Search relations by semantic similarity
CREATE OR REPLACE FUNCTION search_relations(
    query_embedding VECTOR(768),
    match_threshold FLOAT DEFAULT 0.3,
    match_count INT DEFAULT 20
) RETURNS TABLE (
    id VARCHAR,
    source_entity_id VARCHAR,
    target_entity_id VARCHAR,
    relation_type VARCHAR,
    description TEXT,
    similarity FLOAT
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id,
        r.source_entity_id,
        r.target_entity_id,
        r.relation_type,
        r.description,
        (1 - (r.content_vector <=> query_embedding))::FLOAT AS similarity
    FROM relations r
    WHERE r.content_vector IS NOT NULL
      AND 1 - (r.content_vector <=> query_embedding) > match_threshold
    ORDER BY r.content_vector <=> query_embedding
    LIMIT match_count;
END;
$$;
```

**What you should see:**
```
Success. No rows returned
```

---

### Step 3.3: Verify Tables Were Created

Let's make sure everything worked. Run this SQL:

```sql
-- List all tables we just created
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

**What you should see:**
```
table_name
-----------
chat_messages
chat_sessions
chunks
documents
entities
llm_cache
relations
```

If any are missing, go back and run that SQL command again.

---

### Step 3.4: Create the Storage Bucket

The database stores text and metadata. But the actual files (PDFs, videos, etc.) need to go somewhere else. Supabase Storage is that place.

1. In Supabase Dashboard, click **Storage** in the left sidebar
2. Click the **"New bucket"** button
3. Fill in the form:
   - **Name**: `documents` (exactly this, lowercase)
   - **Public bucket**: Toggle **OFF** (we want it private)
   - **Allowed MIME types**: Leave empty (allow all types)
   - **File size limit**: `104857600` (this is 100MB in bytes)
4. Click **"Create bucket"**

**What you should see:**
A new bucket called "documents" in your storage list.

---

## Step 4: Configure Environment Variables

Now we need to tell MegaRAG how to connect to Supabase and Gemini.

### Step 4.1: Create the Environment File

Go back to your terminal (make sure you're in the megarag folder):

```bash
# Create .env.local by copying the example
cp .env.example .env.local
```

**What this does:**
Creates a new file called `.env.local` that's a copy of `.env.example`. The `.local` part tells Git to ignore this file (so you don't accidentally commit your secrets).

### Step 4.2: Edit the Environment File

Open `.env.local` in a text editor:

**Using VS Code (recommended):**
```bash
code .env.local
```

**Using nano (terminal editor):**
```bash
nano .env.local
```

**On Windows, you can:**
```bash
notepad .env.local
```

### Step 4.3: Fill in Your Values

Replace the placeholder values with your actual credentials:

```env
# ═══════════════════════════════════════════════════════════════════════════════
# SUPABASE CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════
#
# Get these from: Supabase Dashboard → Settings → API
#
# Your project URL looks like: https://abcdefghijkl.supabase.co
# The "abcdefghijkl" part is your unique project ID
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co

# The "anon" key is safe to expose in browser code
# It has limited permissions based on Row Level Security rules
# Find it under "Project API keys" → "anon public"
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# The "service role" key is SECRET - never expose it publicly!
# It bypasses all security rules - only use it on the server
# Find it under "Project API keys" → "service_role" (click "Reveal")
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# ═══════════════════════════════════════════════════════════════════════════════
# GOOGLE AI CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════
#
# Get this from: aistudio.google.com/apikey
# It starts with "AIza" and is about 40 characters long
GOOGLE_AI_API_KEY=AIzaSyYourApiKeyHere
```

### Step 4.4: Verify Your Environment File

Let's make sure the values are set. Run:

```bash
# This should print your Supabase URL (not a placeholder)
grep "NEXT_PUBLIC_SUPABASE_URL" .env.local
```

**What you should see:**
```
NEXT_PUBLIC_SUPABASE_URL=https://abcd1234.supabase.co
```
(With your actual project ID, not "abcd1234")

**Common mistakes:**
- Don't include quotes around the values
- Don't add spaces around the `=` sign
- Make sure there are no trailing spaces
- The URL should start with `https://`

---

## Step 5: Start the Application

### Step 5.1: Run the Development Server

```bash
npm run dev
```

**What you should see:**
```
   ▲ Next.js 14.2.x
   - Local:        http://localhost:3000
   - Environments: .env.local

 ✓ Starting...
 ✓ Ready in 2.3s
```

**If you see errors:**
- `Port 3000 is in use`: Another app is using port 3000. Either close it or run MegaRAG on a different port: `npm run dev -- -p 3001`
- `Missing environment variables`: Check your `.env.local` file
- `Module not found`: Run `npm install` again

### Step 5.2: Open the Application

1. Open your web browser (Chrome, Firefox, Safari, Edge)
2. Go to: **http://localhost:3000**

**What you should see:**
The MegaRAG landing page with a "Get Started" button.

3. Click **"Get Started"** or go to **http://localhost:3000/dashboard**

**What you should see:**
The Dashboard with:
- An upload area on the right
- An empty document list on the left
- A "Chat" link in the sidebar

### Step 5.3: Verify Everything Works

Let's test the full flow:

1. **Upload a test file:**
   - Download any simple PDF or create a text file
   - Drag and drop it onto the upload area
   - You should see it appear in the document list with "Processing" status

2. **Wait for processing:**
   - The status should change to "Ready" (✓) after 10-60 seconds
   - If it says "Failed", check the Supabase logs for errors

3. **Test the chat:**
   - Click **"Chat"** in the sidebar
   - Type a question about your document
   - You should get an answer with source citations

**Congratulations! MegaRAG is now running!** 🎉

---

# 📱 Using the Application

## The Dashboard (`/dashboard`)

This is your home base for managing documents.

### Uploading Files

**Method 1: Drag and Drop**
1. Find a file on your computer
2. Drag it onto the upload area
3. Release to upload

**Method 2: Click to Browse**
1. Click the upload area
2. Select a file from the dialog
3. Click "Open" to upload

**Method 3: Bulk Upload**
1. Select multiple files (Ctrl/Cmd + click)
2. Drag them all at once
3. They'll be processed in parallel

### Understanding Document Status

| Status | Icon | Meaning |
|--------|------|---------|
| **Pending** | ⏳ | File uploaded, waiting to be processed |
| **Processing** | 🔄 | AI is reading and chunking the document |
| **Ready** | ✓ | Document is processed and searchable |
| **Failed** | ⚠️ | Something went wrong (hover for details) |

### Managing Documents

**Delete a document:**
- Hover over a document
- Click the trash icon (🗑️)
- You have 5 seconds to click "Undo"

**Filter by status:**
- Use the dropdown to show only Ready, Processing, or Failed documents

**Search by name:**
- Press `Cmd/Ctrl + K` or click the search bar
- Type to filter documents by name

---

## The Chat Interface (`/dashboard/chat`)

This is where you ask questions about your documents.

### Basic Usage

1. Type your question in the input box
2. Press Enter or click Send
3. Wait for the AI to respond
4. Sources will appear below the answer

### Query Modes

Click the mode selector to choose how MegaRAG searches:

| Mode | What It Does | Best For |
|------|--------------|----------|
| **Mix** (default) | Uses all search methods | General questions |
| **Naive** | Only searches text chunks | Simple keyword questions |
| **Local** | Searches entities first | "Who is X?" "What is Y?" |
| **Global** | Follows relationships | "How does X relate to Y?" |
| **Hybrid** | Combines Local + Global | Complex questions |

### Chat Sessions

**Start a new chat:**
- Click "New Chat" in the sidebar

**Rename a chat:**
- Hover over a chat in the sidebar
- Click the pencil icon (✏️)
- Type a new name
- Press Enter

**Delete a chat:**
- Hover over a chat
- Click the trash icon (🗑️)

**Switch between chats:**
- Click any chat in the sidebar
- Your conversation history is preserved

---

## The Data Explorer (`/dashboard/explorer`)

This shows you what MegaRAG "knows" from your documents.

### Tabs

**Chunks:**
- Shows all text pieces from your documents
- Click to expand and see the full content
- Shows which document each chunk came from

**Entities:**
- Shows all extracted entities (people, companies, etc.)
- Shows the type and description
- Shows which documents mention this entity

**Relations:**
- Shows relationships between entities
- Format: Source → [Relation Type] → Target
- Example: "Tim Cook" → [CEO_OF] → "Apple Inc."

---

# 🔍 Understanding the Code

## Project Structure

Here's what each folder and file does:

```
megarag/
│
├── src/                              # All source code
│   │
│   ├── app/                          # Next.js App Router (pages and API)
│   │   │
│   │   ├── page.tsx                  # Landing page (http://localhost:3000/)
│   │   │                             # What users see first
│   │   │
│   │   ├── layout.tsx                # Root layout (wraps all pages)
│   │   │                             # Sets up fonts, theme provider, etc.
│   │   │
│   │   ├── dashboard/                # Dashboard pages
│   │   │   ├── page.tsx              # Main dashboard (/dashboard)
│   │   │   ├── chat/
│   │   │   │   └── page.tsx          # Chat interface (/dashboard/chat)
│   │   │   └── explorer/
│   │   │       └── page.tsx          # Data explorer (/dashboard/explorer)
│   │   │
│   │   └── api/                      # Backend API routes
│   │       │
│   │       ├── upload/
│   │       │   └── route.ts          # POST /api/upload
│   │       │                         # Handles file uploads
│   │       │                         # Saves file, triggers processing
│   │       │
│   │       ├── documents/
│   │       │   └── route.ts          # GET, DELETE /api/documents
│   │       │                         # List documents, delete document
│   │       │
│   │       ├── query/
│   │       │   └── route.ts          # POST /api/query
│   │       │                         # The main RAG endpoint
│   │       │                         # Takes a question, returns answer
│   │       │
│   │       └── chat/                 # Chat session management
│   │           ├── route.ts          # GET, POST /api/chat
│   │           │                     # List sessions, create session
│   │           └── [id]/
│   │               └── route.ts      # GET, DELETE, PATCH /api/chat/[id]
│   │                                 # Get messages, delete session, rename
│   │
│   ├── components/                   # React components
│   │   │
│   │   ├── DocumentUploader.tsx      # File upload with drag-drop
│   │   │                             # Handles file selection
│   │   │                             # Shows upload progress
│   │   │
│   │   ├── DocumentList.tsx          # Document list with filters
│   │   │                             # Shows all uploaded documents
│   │   │                             # Delete, filter, search
│   │   │
│   │   ├── ChatInterface.tsx         # Main chat component
│   │   │                             # Message input, mode selection
│   │   │                             # Displays conversation
│   │   │
│   │   ├── ChatMessage.tsx           # Single message display
│   │   │                             # User or assistant message
│   │   │                             # Source citations
│   │   │
│   │   ├── ChatHistory.tsx           # Chat session sidebar
│   │   │                             # List of past conversations
│   │   │                             # Rename, delete sessions
│   │   │
│   │   ├── ThemeToggle.tsx           # Dark/light mode switch
│   │   ├── ThemeProvider.tsx         # Theme context provider
│   │   └── ui/                       # shadcn/ui components
│   │       └── ...                   # Buttons, inputs, dialogs, etc.
│   │
│   ├── lib/                          # Core logic and utilities
│   │   │
│   │   ├── supabase/
│   │   │   ├── client.ts             # Browser-side Supabase client
│   │   │   │                         # Uses anon key
│   │   │   │                         # For client components
│   │   │   │
│   │   │   └── server.ts             # Server-side Supabase client
│   │   │                             # Uses service role key
│   │   │                             # For API routes and server components
│   │   │
│   │   ├── gemini/
│   │   │   ├── client.ts             # Gemini AI client setup
│   │   │   │                         # Configures the API connection
│   │   │   │
│   │   │   └── embeddings.ts         # Embedding generation
│   │   │                             # Converts text to 768-dim vectors
│   │   │
│   │   ├── processing/               # File processors
│   │   │   │
│   │   │   ├── router.ts             # Routes files to the right processor
│   │   │   │                         # .pdf → documentProcessor
│   │   │   │                         # .jpg → imageProcessor
│   │   │   │                         # .mp4 → videoProcessor
│   │   │   │
│   │   │   ├── text-processor.ts     # Handles .txt, .md files
│   │   │   │                         # Chunks text, generates embeddings
│   │   │   │
│   │   │   ├── document-processor.ts # Handles .pdf, .docx, .pptx, .xlsx
│   │   │   │                         # Uses Gemini to read documents
│   │   │   │
│   │   │   ├── image-processor.ts    # Handles .jpg, .png, .gif, etc.
│   │   │   │                         # Uses Gemini Vision to describe
│   │   │   │
│   │   │   ├── video-processor.ts    # Handles .mp4, .webm, .mov
│   │   │   │                         # Uses Gemini File API to analyze
│   │   │   │
│   │   │   ├── audio-processor.ts    # Handles .mp3, .wav, .m4a
│   │   │   │                         # Uses Gemini to transcribe
│   │   │   │
│   │   │   └── entity-extractor.ts   # Extracts entities and relations
│   │   │                             # Runs after text is chunked
│   │   │
│   │   └── rag/                      # RAG system
│   │       │
│   │       ├── retriever.ts          # Retrieval logic
│   │       │                         # Implements all query modes
│   │       │                         # Vector search, entity search
│   │       │
│   │       └── response-generator.ts # Answer generation
│   │                                 # Builds prompts with context
│   │                                 # Calls Gemini for answers
│   │
│   └── types/                        # TypeScript type definitions
│       └── index.ts                  # All shared types
│                                     # Document, Chunk, Entity, etc.
│
├── public/                           # Static files (images, icons)
│
├── .env.example                      # Template for environment variables
├── .env.local                        # Your actual config (not in git!)
├── package.json                      # Dependencies and scripts
├── tsconfig.json                     # TypeScript configuration
├── tailwind.config.ts                # Tailwind CSS configuration
└── next.config.mjs                   # Next.js configuration
```

## The Upload Flow in Detail

When you upload a file, here's exactly what happens in the code:

```
1. User drops file on DocumentUploader.tsx
   │
   │  The component creates a FormData object:
   │  const formData = new FormData();
   │  formData.append('file', file);
   │
   └─▶ POST request to /api/upload

2. /api/upload/route.ts receives the request
   │
   │  // Extract the file from the request
   │  const formData = await request.formData();
   │  const file = formData.get('file');
   │
   │  // Generate unique ID
   │  const documentId = `doc_${Date.now()}_${randomId()}`;
   │
   │  // Upload file to Supabase Storage
   │  await supabase.storage
   │    .from('documents')
   │    .upload(filePath, fileBuffer);
   │
   │  // Create document record with status 'pending'
   │  await supabase.from('documents').insert({
   │    id: documentId,
   │    file_name: file.name,
   │    file_type: extension,
   │    status: 'pending'
   │  });
   │
   │  // Trigger processing (don't wait for it)
   │  processDocument(documentId).catch(console.error);
   │
   └─▶ Returns { success: true, documentId }

3. router.ts determines which processor to use
   │
   │  // Get file extension
   │  const ext = getExtension(fileName);
   │
   │  // Route to appropriate processor
   │  switch (ext) {
   │    case 'txt':
   │    case 'md':
   │      return textProcessor(documentId);
   │
   │    case 'pdf':
   │    case 'docx':
   │      return documentProcessor(documentId);
   │
   │    case 'jpg':
   │    case 'png':
   │      return imageProcessor(documentId);
   │
   │    case 'mp4':
   │    case 'mov':
   │      return videoProcessor(documentId);
   │
   │    case 'mp3':
   │    case 'wav':
   │      return audioProcessor(documentId);
   │  }
   │
   └─▶ Calls the appropriate processor

4. Processor extracts content
   │
   │  // Example: document-processor.ts for PDF
   │
   │  // Download file from Supabase Storage
   │  const { data } = await supabase.storage
   │    .from('documents')
   │    .download(filePath);
   │
   │  // Upload to Gemini File API
   │  const uploadedFile = await gemini.uploadFile(data);
   │
   │  // Ask Gemini to read and extract content
   │  const result = await gemini.generateContent([
   │    {
   │      fileData: {
   │        mimeType: 'application/pdf',
   │        fileUri: uploadedFile.uri
   │      }
   │    },
   │    {
   │      text: 'Extract all text content from this PDF...'
   │    }
   │  ]);
   │
   │  // Parse the extracted text
   │  const extractedText = result.response.text();
   │
   └─▶ Returns extracted text

5. Text is chunked
   │
   │  // Split into ~800 word chunks with 100 word overlap
   │  const chunks = chunkText(extractedText, {
   │    maxTokens: 800,
   │    overlap: 100
   │  });
   │
   │  // Result: Array of text pieces
   │  // ['First 800 words...', 'Next 800 words...', ...]
   │
   └─▶ Array of chunks

6. Embeddings are generated
   │
   │  // For each chunk, create embedding
   │  for (const chunk of chunks) {
   │    const embedding = await generateEmbedding(chunk.content);
   │    // embedding is an array of 768 numbers
   │    chunk.embedding = embedding;
   │  }
   │
   └─▶ Chunks with embeddings

7. Entities are extracted
   │
   │  // Ask Gemini to identify entities and relationships
   │  const entityResult = await gemini.generateContent(`
   │    Analyze this text and extract:
   │    - ENTITIES: People, organizations, locations, etc.
   │    - RELATIONS: How entities relate to each other
   │
   │    Text: ${allChunksText}
   │
   │    Return as JSON...
   │  `);
   │
   │  // Parse the JSON response
   │  const { entities, relations } = JSON.parse(entityResult);
   │
   │  // Generate embeddings for entities and relations
   │  for (const entity of entities) {
   │    entity.embedding = await generateEmbedding(entity.description);
   │  }
   │
   └─▶ Entities and relations with embeddings

8. Everything is saved to database
   │
   │  // Save chunks
   │  await supabase.from('chunks').insert(
   │    chunks.map(c => ({
   │      id: c.id,
   │      document_id: documentId,
   │      content: c.content,
   │      content_vector: c.embedding,
   │      chunk_order_index: c.index
   │    }))
   │  );
   │
   │  // Save entities
   │  await supabase.from('entities').insert(entities);
   │
   │  // Save relations
   │  await supabase.from('relations').insert(relations);
   │
   │  // Update document status
   │  await supabase.from('documents').update({
   │    status: 'processed',
   │    chunks_count: chunks.length
   │  }).eq('id', documentId);
   │
   └─▶ Done! Document is ready to query
```

## The Query Flow in Detail

When you ask a question, here's what happens:

```
1. User types question in ChatInterface.tsx
   │
   │  const [query, setQuery] = useState('');
   │  const [mode, setMode] = useState('mix');
   │
   │  // On submit:
   │  const response = await fetch('/api/query', {
   │    method: 'POST',
   │    body: JSON.stringify({ query, mode })
   │  });
   │
   └─▶ POST request to /api/query

2. /api/query/route.ts handles the request
   │
   │  // Extract query and mode
   │  const { query, mode } = await request.json();
   │
   │  // Generate embedding for the question
   │  const queryEmbedding = await generateEmbedding(query);
   │  // queryEmbedding = [0.1, 0.2, 0.3, ... 768 numbers]
   │
   └─▶ Calls retriever based on mode

3. retriever.ts searches for relevant content
   │
   │  // Different modes search differently:
   │
   │  if (mode === 'naive') {
   │    // Just search chunks directly
   │    chunks = await searchChunks(queryEmbedding);
   │  }
   │
   │  else if (mode === 'local') {
   │    // 1. Find relevant entities
   │    entities = await searchEntities(queryEmbedding);
   │    // 2. Get chunks that mention those entities
   │    chunks = await getChunksForEntities(entities);
   │  }
   │
   │  else if (mode === 'global') {
   │    // 1. Find relevant relationships
   │    relations = await searchRelations(queryEmbedding);
   │    // 2. Get entities from those relationships
   │    entities = await getEntitiesFromRelations(relations);
   │    // 3. Get chunks
   │    chunks = await getChunksForEntities(entities);
   │  }
   │
   │  else if (mode === 'hybrid' || mode === 'mix') {
   │    // Combine all approaches
   │    directChunks = await searchChunks(queryEmbedding);
   │    entityChunks = await localSearch(queryEmbedding);
   │    relationChunks = await globalSearch(queryEmbedding);
   │
   │    // Merge and deduplicate
   │    chunks = mergeAndRank([directChunks, entityChunks, relationChunks]);
   │  }
   │
   └─▶ Returns relevant chunks, entities, relations

4. The database does similarity search
   │
   │  // When we call searchChunks, the database runs:
   │  SELECT id, content, document_id,
   │         1 - (content_vector <=> $queryEmbedding) as similarity
   │  FROM chunks
   │  WHERE 1 - (content_vector <=> $queryEmbedding) > 0.3
   │  ORDER BY content_vector <=> $queryEmbedding
   │  LIMIT 10;
   │
   │  // The <=> operator calculates cosine distance
   │  // Thanks to the HNSW index, this is very fast
   │
   └─▶ Returns top 10 most similar chunks

5. response-generator.ts creates the prompt
   │
   │  // Build context from retrieved chunks
   │  let context = '';
   │  for (let i = 0; i < chunks.length; i++) {
   │    context += `SOURCE ${i + 1}:\n`;
   │    context += `Document: ${chunks[i].document_name}\n`;
   │    context += `Content: ${chunks[i].content}\n\n`;
   │  }
   │
   │  // Create prompt for Gemini
   │  const prompt = `
   │    You are a helpful assistant. Answer the user's question based
   │    ONLY on the following sources. If the answer isn't in the sources,
   │    say so. Always cite your sources as [Source 1], [Source 2], etc.
   │
   │    SOURCES:
   │    ${context}
   │
   │    QUESTION: ${query}
   │
   │    ANSWER:
   │  `;
   │
   └─▶ Sends prompt to Gemini

6. Gemini generates the answer
   │
   │  // Call Gemini API
   │  const result = await gemini.generateContent(prompt);
   │
   │  // Extract the text response
   │  const answer = result.response.text();
   │  // answer = "Based on Source 1, the Q3 revenue was $50M..."
   │
   └─▶ Returns generated text

7. Response is sent back to browser
   │
   │  return Response.json({
   │    response: answer,
   │    sources: chunks.map(c => ({
   │      id: c.id,
   │      content: c.content,
   │      document_name: c.document_name,
   │      similarity: c.similarity
   │    })),
   │    entities: foundEntities
   │  });
   │
   └─▶ ChatInterface displays the answer with sources
```

---

# 🚨 Troubleshooting Guide

## Common Issues and Solutions

### "Cannot find module" errors when running `npm run dev`

**What this means:**
Some packages didn't install correctly.

**Solution:**
```bash
# Delete node_modules and reinstall
rm -rf node_modules
rm package-lock.json
npm install
```

---

### "Invalid API key" errors from Gemini

**What this means:**
Your Google AI API key is wrong, expired, or not set.

**Solution:**
1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Check if your key is still valid (not deleted)
3. If needed, create a new key
4. Update `GOOGLE_AI_API_KEY` in `.env.local`
5. **Restart the dev server**: Stop it with `Ctrl+C`, then run `npm run dev` again

---

### "relation 'documents' does not exist" or "table does not exist"

**What this means:**
The database tables weren't created.

**Solution:**
1. Go to Supabase SQL Editor
2. Run all the SQL commands from Step 3 again
3. Make sure each one shows "Success"

---

### Files stuck on "Processing" forever

**What this means:**
Processing started but didn't complete. Could be:
- API key issues
- File too large
- Processing crashed

**Solution:**
1. Check the browser console (F12 → Console) for errors
2. Check Supabase logs (Dashboard → Logs)
3. Verify your `.env.local` has correct values
4. For large files (videos), make sure they're under 1GB
5. Try deleting the document and re-uploading

---

### "CORS" errors in browser console

**What this means:**
Cross-Origin Resource Sharing error. The browser is blocking requests.

**Solution:**
1. Make sure `NEXT_PUBLIC_SUPABASE_URL` exactly matches your project URL
2. Include `https://` at the beginning
3. Don't include a trailing slash

---

### Searches return no results

**What this means:**
Either:
- No documents are processed
- Embeddings weren't generated
- The query doesn't match any content

**Solution:**
1. In Supabase, go to Table Editor → chunks
2. Check if there are rows with non-null `content_vector`
3. If vectors are null, re-process the documents
4. Make sure your `GOOGLE_AI_API_KEY` is valid

---

### "429 Too Many Requests" from Gemini

**What this means:**
You've hit the rate limit (15 requests/minute on free tier).

**Solution:**
- Wait 1 minute and try again
- Process fewer documents at once
- Upgrade to a paid tier if you need more capacity

---

### Dark mode not working

**What this means:**
The theme isn't being applied correctly.

**Solution:**
1. Clear your browser cache
2. Check that `ThemeProvider` wraps your app in `layout.tsx`
3. Try clicking the theme toggle multiple times

---

## Getting Help

If none of these solutions work:

1. **Check the console for errors:**
   - Browser: Press F12, click "Console"
   - Server: Look at the terminal where `npm run dev` is running

2. **Check Supabase logs:**
   - Dashboard → Logs → Postgres Logs

3. **Open an issue on GitHub:**
   - Go to [github.com/promptadvisers/megarag/issues](https://github.com/promptadvisers/megarag/issues)
   - Include: error message, steps to reproduce, your environment

---

# 🚀 Deploying to Production

## Option 1: Vercel (Recommended)

Vercel is the company that makes Next.js, so deployment is seamless.

### Step-by-Step:

1. **Push your code to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/your-repo.git
   git push -u origin main
   ```

2. **Sign up for Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "Sign Up" → "Continue with GitHub"

3. **Import your project**
   - Click "New Project"
   - Select your repository
   - Click "Import"

4. **Configure environment variables**
   - Click "Environment Variables"
   - Add each variable from your `.env.local`:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `GOOGLE_AI_API_KEY`

5. **Deploy**
   - Click "Deploy"
   - Wait 1-2 minutes
   - You'll get a URL like `https://your-project.vercel.app`

### One-Click Deploy

Or use this button:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/promptadvisers/megarag)

---

## Option 2: Other Platforms

MegaRAG works on any platform that supports Node.js:

### Railway
1. Go to [railway.app](https://railway.app)
2. "New Project" → "Deploy from GitHub"
3. Add environment variables
4. Deploy

### Render
1. Go to [render.com](https://render.com)
2. "New" → "Web Service"
3. Connect GitHub repo
4. Add environment variables
5. Deploy

### Self-hosted
```bash
# Build for production
npm run build

# Start production server
npm start

# Runs on port 3000 by default
# Use a reverse proxy (nginx) for HTTPS
```

---

## Production Checklist

Before going live:

- [ ] All environment variables set in production
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is kept secret (not in logs)
- [ ] Database backup configured (Supabase does this automatically)
- [ ] Domain configured with HTTPS
- [ ] Tested with real documents

---

# 📚 Additional Resources

## Related Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture with diagrams
- **[CONVERSATION_LOG.md](CONVERSATION_LOG.md)** - How this project was built

## External Resources

### RAG Concepts
- [What is RAG?](https://www.pinecone.io/learn/retrieval-augmented-generation/) - Pinecone's excellent explanation
- [Embeddings Explained](https://www.youtube.com/watch?v=5MaWmXwxFNQ) - Visual YouTube explanation

### Technologies Used
- [Next.js Documentation](https://nextjs.org/docs) - The React framework
- [Supabase Documentation](https://supabase.com/docs) - Database and storage
- [pgvector Guide](https://github.com/pgvector/pgvector) - Vector search extension
- [Google AI Documentation](https://ai.google.dev/docs) - Gemini AI models

### TypeScript & React
- [TypeScript Handbook](https://www.typescriptlang.org/docs/) - Learn TypeScript
- [React Documentation](https://react.dev) - Learn React

---

## Contributing

Found a bug? Want to add a feature?

1. Fork the repository
2. Create a branch: `git checkout -b my-feature`
3. Make your changes
4. Test locally
5. Submit a Pull Request

---

## License

MIT License - Use this code however you want!

---

<div align="center">

**Need Help?** Open an issue on [GitHub](https://github.com/promptadvisers/megarag/issues)

Made with ❤️ by [Prompt Advisers](https://github.com/promptadvisers)

</div>
