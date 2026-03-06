from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from langchain_groq import ChatGroq
from langchain_chroma import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser
from dotenv import load_dotenv
import tempfile
import os

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)

vectordb = Chroma(
    persist_directory="./chroma_db",
    embedding_function=embeddings
)

llm = ChatGroq(
    model="llama-3.1-8b-instant",
    temperature=0,
    api_key=os.getenv("GROQ_API_KEY")
)

# Современный способ через LCEL (LangChain Expression Language)
prompt = ChatPromptTemplate.from_template("""
Ты — ассистент по внутренней документации компании.
Отвечай ТОЛЬКО на основе предоставленного контекста.
Если ответа нет в контексте — скажи: "В документах нет информации по этому вопросу."
Отвечай на том же языке, на котором задан вопрос.

Контекст:
{context}

Вопрос: {question}
""")

class QuestionRequest(BaseModel):
    question: str

@app.post("/ask")
async def ask(request: QuestionRequest):
    if vectordb._collection.count() == 0:
        raise HTTPException(
            status_code=400,
            detail="База пустая. Сначала загрузите документы."
        )

    retriever = vectordb.as_retriever(search_kwargs={"k": 5})

    # LCEL pipeline — как Promise chain в JS
    chain = (
        {"context": retriever, "question": RunnablePassthrough()}
        | prompt
        | llm
        | StrOutputParser()
    )

    answer = chain.invoke(request.question)
    return {"answer": answer}

@app.post("/upload")
async def upload(file: UploadFile):
    allowed = [".pdf", ".txt", ".docx", ".csv"]
    ext = os.path.splitext(file.filename)[1].lower()

    if ext not in allowed:
        raise HTTPException(status_code=400, detail=f"Поддерживаются: {', '.join(allowed)}")

    existing = vectordb.get(where={"source": file.filename})
    if existing["ids"]:
        raise HTTPException(status_code=400, detail="Файл уже загружен")

    content = await file.read()

    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    # Выбираем загрузчик в зависимости от формата
    if ext == ".pdf":
        from langchain_community.document_loaders import PyPDFLoader
        loader = PyPDFLoader(tmp_path)
        pages = loader.load()

    elif ext == ".txt" or ext == ".md":
        from langchain_community.document_loaders import TextLoader
        loader = TextLoader(tmp_path, encoding="utf-8")
        pages = loader.load()

    elif ext == ".docx":
        from langchain_community.document_loaders import Docx2txtLoader
        loader = Docx2txtLoader(tmp_path)
        pages = loader.load()

    elif ext == ".csv":
        from langchain_community.document_loaders import CSVLoader
        loader = CSVLoader(tmp_path, encoding="utf-8")
        pages = loader.load()

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50
    )
    chunks = splitter.split_documents(pages)

    for chunk in chunks:
        chunk.metadata["source"] = file.filename

    vectordb.add_documents(chunks)
    os.unlink(tmp_path)

    return {
        "message": f"Загружено страниц: {len(pages)}, чанков: {len(chunks)}"
    }

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "documents_indexed": vectordb._collection.count()
    }