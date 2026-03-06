import { useState } from "react"
import axios from "axios"

const API_URL = "http://localhost:8000"

export default function App() {
  const [question, setQuestion] = useState("")
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  const handleAsk = async () => {
    if (!question.trim() || loading) return

    const userMessage = { role: "user", text: question }
    setMessages(prev => [...prev, userMessage])
    setQuestion("")
    setLoading(true)

    try {
      const { data } = await axios.post(`${API_URL}/ask`, { question })
      setMessages(prev => [...prev, { role: "assistant", text: data.answer }])
    } catch (err) {
      const detail = err.response?.data?.detail || "Ошибка сервера"
      setMessages(prev => [...prev, { role: "error", text: detail }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.ctrlKey) {
      e.preventDefault()
      handleAsk()
    }
  }

  const handleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    const formData = new FormData()
    formData.append("file", file)
    setUploading(true)

    try {
      const { data } = await axios.post(`${API_URL}/upload`, formData)
      setMessages(prev => [...prev, { role: "system", text: `✅ ${data.message}` }])
    } catch (err) {
      const detail = err.response?.data?.detail || "Ошибка загрузки"
      setMessages(prev => [...prev, { role: "error", text: `❌ ${detail}` }])
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>📄 RAG Ассистент</h1>
        <label style={styles.uploadBtn}>
          {uploading ? "Загружаю..." : "📎 Загрузить документ"}
          <input
            type="file"
            accept=".pdf,.txt,.docx,.csv"
            onChange={handleUpload}
            style={{ display: "none" }}
            disabled={uploading}
          />
        </label>
      </div>

      <div style={styles.messages}>
        {messages.length === 0 && (
          <div style={styles.empty}>
            Загрузите PDF и задайте вопрос по его содержимому
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{
            ...styles.message,
            ...(msg.role === "user" ? styles.userMsg : {}),
            ...(msg.role === "assistant" ? styles.assistantMsg : {}),
            ...(msg.role === "error" ? styles.errorMsg : {}),
            ...(msg.role === "system" ? styles.systemMsg : {}),
          }}>
            {msg.role === "user" && <span style={styles.label}>Вы</span>}
            {msg.role === "assistant" && <span style={styles.label}>Ассистент</span>}
            <p style={styles.msgText}>{msg.text}</p>
          </div>
        ))}
        {loading && (
          <div style={{ ...styles.message, ...styles.assistantMsg }}>
            <span style={styles.label}>Ассистент</span>
            <p style={styles.msgText}>Думаю...</p>
          </div>
        )}
      </div>

      <div style={styles.inputArea}>
        <textarea
          style={styles.textarea}
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Задайте вопрос по документу... (Enter — отправить, Ctrl+Enter — новая строка)"
          rows={3}
          disabled={loading}
        />
        <button
          style={{ ...styles.sendBtn, opacity: loading ? 0.6 : 1 }}
          onClick={handleAsk}
          disabled={loading}
        >
          {loading ? "..." : "Отправить"}
        </button>
      </div>
    </div>
  )
}

const styles = {
  container: {
    maxWidth: "800px",
    margin: "0 auto",
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    fontFamily: "sans-serif",
    padding: "16px",
    boxSizing: "border-box",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },
  title: { margin: 0, fontSize: "20px" },
  uploadBtn: {
    background: "#4f46e5",
    color: "white",
    padding: "8px 16px",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    marginBottom: "16px",
  },
  empty: {
    textAlign: "center",
    color: "#9ca3af",
    marginTop: "40px",
  },
  message: {
    padding: "12px 16px",
    borderRadius: "12px",
    maxWidth: "80%",
  },
  userMsg: {
    background: "#4f46e5",
    color: "white",
    alignSelf: "flex-end",
  },
  assistantMsg: {
    background: "#f3f4f6",
    color: "#111",
    alignSelf: "flex-start",
  },
  errorMsg: {
    background: "#fee2e2",
    color: "#991b1b",
    alignSelf: "flex-start",
  },
  systemMsg: {
    background: "#d1fae5",
    color: "#065f46",
    alignSelf: "center",
    fontSize: "13px",
  },
  label: {
    fontSize: "11px",
    fontWeight: "bold",
    opacity: 0.6,
    display: "block",
    marginBottom: "4px",
  },
  msgText: { margin: 0, lineHeight: 1.5 },
  inputArea: {
    display: "flex",
    gap: "8px",
    alignItems: "flex-end",
  },
  textarea: {
    flex: 1,
    padding: "10px",
    borderRadius: "8px",
    border: "1px solid #d1d5db",
    fontSize: "14px",
    resize: "none",
    outline: "none",
  },
  sendBtn: {
    background: "#4f46e5",
    color: "white",
    border: "none",
    padding: "10px 20px",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
    height: "42px",
  },
}