import React, { useEffect, useRef, useState } from "react";
import { FaPlus, FaArrowUp } from "react-icons/fa";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./Body.css";

const GEMINI_API_KEY = "AIzaSyAVdn4cMVUEK8WaSYBzSa8CZexOjCtY10A";

async function getGeminiResponse(userMessage) {
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
  try {
    const { data } = await axios.post(
      url,
      { contents: [{ parts: [{ text: userMessage }] }] },
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
  // Load sessions from localStorage
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

  // active session id
  const [activeId, setActiveId] = useState(() => {
    return (
      localStorage.getItem("activeChatId") ||
      Object.keys(JSON.parse(localStorage.getItem("chatSessions") || "{}"))[0]
    );
  });

  // UI state
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const endRef = useRef(null);

  // persist sessions + activeId
  useEffect(() => {
    try {
      localStorage.setItem("chatSessions", JSON.stringify(sessions));
      if (activeId) localStorage.setItem("activeChatId", activeId);
    } catch (e) {
      console.warn("Failed saving sessions", e);
    }
  }, [sessions, activeId]);

  // auto-scroll to bottom
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeId, sessions]);

  // helper
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

    const botReply = await getGeminiResponse(trimmed);

    setSessions((prev) => ({
      ...prev,
      [activeId]: {
        ...prev[activeId],
        messages: [...updatedMessages, { role: "bot", text: botReply }],
      },
    }));
    setSending(false);
  };

  // Render
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

      {/* Main content */}
      <main className="main">
        <div className="messages">
          {activeMessages.map((m, i) => (
            <div
              key={i}
              className={`msg ${m.role === "user" ? "user" : "bot"}`}
            >
              <div className="bubble">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {String(m.text || "")}
                </ReactMarkdown>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

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
          <button className="plus-btn" type="button" title="Add">
            <FaPlus />
          </button>
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
