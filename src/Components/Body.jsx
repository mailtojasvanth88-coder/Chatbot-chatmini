import React, { useEffect, useRef, useState } from "react";
import { FaPlus, FaArrowUp } from "react-icons/fa";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./Body.css";

const GEMINI_API_KEY = "AIzaSyAVdn4cMVUEK8WaSYBzSa8CZexOjCtY10A";

//Gemini API call
async function getGeminiResponse(userMessage, memory) {
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

  //  the uploaded doc
  let finalMessage = userMessage;
  if (
    memory.lastDocument &&
    /document|file|upload|summarize/i.test(userMessage)
  ) {
    finalMessage += `\n\n(Here is the uploaded document content: ${memory.lastDocument.content})`;
  }

  try {
    const { data } = await axios.post(
      url,
      { contents: [{ parts: [{ text: finalMessage }] }] },
      {
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": GEMINI_API_KEY,
        },
      }
    );
    return (
      data?.candidates?.[0]?.content?.parts?.[0]?.text ??
      "Sorry, I couldn't get a response from Gemini."
    );
  } catch (e) {
    console.error("Gemini error:", e?.response?.data || e.message);
    return "Sorry, I couldn't get a response from Gemini.";
  }
}

export default function Body() {
  
  const [sessions, setSessions] = useState(() => {
    try {
      const saved = localStorage.getItem("chatSessions");
      if (saved) return JSON.parse(saved);
      const id = Date.now().toString();
      return {
        [id]: { title: "New Chat", messages: [{ role: "bot", text: "hi" }] },
      };
    } catch {
      const id = Date.now().toString();
      return {
        [id]: { title: "New Chat", messages: [{ role: "bot", text: "hi" }] },
      };
    }
  });


  const [activeId, setActiveId] = useState(() => {
    return (
      localStorage.getItem("activeChatId") ||
      Object.keys(JSON.parse(localStorage.getItem("chatSessions") || "{}"))[0]
    );
  });

 
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [memory, setMemory] = useState({ lastDocument: null });

  const endRef = useRef(null);
  const fileInputRef = useRef(null);

  
  useEffect(() => {
    try {
      localStorage.setItem("chatSessions", JSON.stringify(sessions));
      if (activeId) localStorage.setItem("activeChatId", activeId);
    } catch (e) {
      console.warn("Failed saving sessions", e);
    }
  }, [sessions, activeId]);

  
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeId, sessions]);

  const activeMessages = sessions?.[activeId]?.messages || [];

  const onNewChat = () => {
    const newId = Date.now().toString();
    setSessions((prev) => ({
      ...prev,
      [newId]: { title: "New Chat", messages: [{ role: "bot", text: "hi" }] },
    }));
    setActiveId(newId);
    setSidebarOpen(false);
    setText("");
  };

  
  const onDeleteChat = (id) => {
    if (!confirm("Delete this chat?")) return;
    setSessions((prev) => {
      const copy = { ...prev };
      delete copy[id];
      const remainingIds = Object.keys(copy);
      if (remainingIds.length === 0) {
        const freshId = Date.now().toString();
        copy[freshId] = {
          title: "New Chat",
          messages: [{ role: "bot", text: "hi" }],
        };
        setActiveId(freshId);
      } else if (id === activeId) {
        setActiveId(remainingIds[0]);
      }
      return copy;
    });
  };

  // send message
  const onSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const userMsg = { role: "user", text: trimmed };
    const updatedMessages = [...activeMessages, userMsg];

    setSessions((prev) => {
      const newSessions = { ...prev };
      newSessions[activeId] = {
        ...newSessions[activeId],
        messages: updatedMessages,
      };
      const userCount = updatedMessages.filter((m) => m.role === "user").length;
      if (userCount === 1) {
        const title =
          trimmed.length > 26 ? trimmed.slice(0, 26) + "…" : trimmed;
        newSessions[activeId].title = title;
      }
      return newSessions;
    });

    setText("");
    setSending(true);

    const botReply = await getGeminiResponse(trimmed, memory);

    setSessions((prev) => ({
      ...prev,
      [activeId]: {
        ...prev[activeId],
        messages: [...updatedMessages, { role: "bot", text: botReply }],
      },
    }));
    setSending(false);
  };

  // 🔹 File upload click
  const onFileUploadClick = () => {
    fileInputRef.current?.click();
  };

  // 🔹 File selected
  const onFileSelected = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // show in chat
    const userMsg = { role: "user", text: `📄 Document uploaded: ${file.name}` };
    const updatedMessages = [...activeMessages, userMsg];
    setSessions((prev) => ({
      ...prev,
      [activeId]: { ...prev[activeId], messages: updatedMessages },
    }));

    // extract content
    let textContent = "";
    if (file.type === "text/plain") {
      textContent = await file.text();
    } else if (file.type === "application/pdf") {
      const pdfjsLib = await import("pdfjs-dist");
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const txt = await page.getTextContent();
        textContent += txt.items.map((s) => s.str).join(" ") + "\n";
      }
    } else if (
      file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const mammoth = await import("mammoth");
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      textContent = result.value;
    } else {
      alert("Unsupported file type. Please upload TXT, PDF, or DOCX.");
      return;
    }

    // store in memory
    setMemory((prev) => ({
      ...prev,
      lastDocument: { name: file.name, content: textContent },
    }));

    e.target.value = "";
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="topbar">
        <button
          className="hamburger"
          aria-label="Toggle menu"
          onClick={() => setSidebarOpen((s) => !s)}
        >
          ☰
        </button>
        <h1 className="brand">ChatMini</h1>
        <div />
      </header>

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="side-inner">
          <ul className="side-links">
            <li>
              <button onClick={onNewChat}>+ New Chat</button>
            </li>
          </ul>

          <div className="history">
            <ol>
              {Object.entries(sessions).map(([id, session]) => (
                <li key={id}>
                  <div
                    className={`history-row ${
                      id === activeId ? "active" : ""
                    }`}
                  >
                    <button
                      className="history-btn"
                      onClick={() => {
                        setActiveId(id);
                        setSidebarOpen(false);
                      }}
                      title={session.title}
                    >
                      {session.title}
                    </button>
                    <button
                      className="del-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteChat(id);
                      }}
                      aria-label="Delete chat"
                      title="Delete"
                    >
                      X
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div
          className="backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      </aside>

      {/* Main */}
      <main className="main">
        <div className="messages">
          {activeMessages.map((m, i) => (
            <div key={i} className={`msg ${m.role === "user" ? "user" : "bot"}`}>
              <div className="bubble">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {String(m.text || "")}
                </ReactMarkdown>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {/* Input bar */}
        <div className="input-bar">
          <input
            type="text"
            placeholder="Type a message…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSend();
            }}
          />
          <button
            className="plus-btn"
            type="button"
            title="Upload Document"
            onClick={onFileUploadClick}
          >
            <FaPlus />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            accept=".txt,.pdf,.docx"
            onChange={onFileSelected}
          />
          <button
            className="send-btn"
            type="button"
            onClick={onSend}
            disabled={sending}
            title="Send"
          >
            <FaArrowUp />
          </button>
        </div>
      </main>
    </div>
  );
}
