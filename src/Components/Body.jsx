import React, { useEffect, useRef, useState } from "react";
import { FaPlus, FaArrowUp, FaTrash, FaPen } from "react-icons/fa"; // use react-icons
import axios from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./Body.css";

const GEMINI_API_KEY = "AIzaSyBYnexKUS7ZAmEN7zqDP93GcIoBrpREcR8";

// Gemini API call
async function getGeminiResponse(userMessage, memory, conversation) {
  const conversationText = conversation
    .map((m) => `${m.role.toUpperCase()}: ${m.text}`)
    .join("\n");

  const finalMessage = `
User's name: ${memory.username}.
Known facts: ${memory.facts.join(", ") || "none"}.
${memory.lastDocument ? `Last document: ${memory.lastDocument.name}` : ""}

Conversation so far:
${conversationText}

Now continue the conversation. User says: ${userMessage}
`;

  try {
    const { data } = await axios.post(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
      { contents: [{ parts: [{ text: finalMessage }] }] },
      { headers: { "Content-Type": "application/json", "X-goog-api-key": GEMINI_API_KEY } }
    );

    let reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't get a response.";
    return reply.replace(/^BOT:\s*/i, "");
  } catch (e) {
    console.error("Gemini error:", e?.response?.data || e.message);
    return "Sorry, I couldn't get a response.";
  }
}

export default function Body() {
  const [sessions, setSessions] = useState(() => {
    const saved = localStorage.getItem("chatSessions");
    if (saved) return JSON.parse(saved);
    const id = Date.now().toString();
    return { [id]: { title: "New Chat", messages: [{ role: "bot", text: "Hi 👋" }] } };
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

  const [memory, setMemory] = useState(() => {
    const saved = localStorage.getItem("chatMemory");
    return saved ? JSON.parse(saved) : { username: "User", facts: [], lastDocument: null };
  });

  const endRef = useRef(null);
  const fileInputRef = useRef(null);

  const activeMessages = sessions?.[activeId]?.messages || [];

  // Save sessions & memory
  useEffect(() => {
    localStorage.setItem("chatSessions", JSON.stringify(sessions));
    if (activeId) localStorage.setItem("activeChatId", activeId);
  }, [sessions, activeId]);

  useEffect(() => {
    localStorage.setItem("chatMemory", JSON.stringify(memory));
  }, [memory]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeId, sessions]);

  // New Chat
  const onNewChat = () => {
    const newId = Date.now().toString();
    setSessions((prev) => ({
      ...prev,
      [newId]: { title: "New Chat", messages: [{ role: "bot", text: "How can I help you today?" }] },
    }));
    setActiveId(newId);
    setSidebarOpen(false);
    setText("");
  };

  // Delete Chat
  const onDeleteChat = (id) => {
    if (!window.confirm("Delete this chat?")) return;
    setSessions((prev) => {
      const copy = { ...prev };
      delete copy[id];
      const remainingIds = Object.keys(copy);
      if (remainingIds.length === 0) {
        const freshId = Date.now().toString();
        copy[freshId] = { title: "New Chat", messages: [{ role: "bot", text: `Hi ${memory.username} 👋` }] };
        setActiveId(freshId);
      } else if (id === activeId) {
        setActiveId(remainingIds[0]);
      }
      return copy;
    });
  };

  // Send Message
  const onSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const userMsg = { role: "user", text: trimmed };
    const updatedMessages = [...activeMessages, userMsg];

    // Memory updates
    if (/my name is (.+)/i.test(trimmed)) {
      const newName = trimmed.match(/my name is (.+)/i)[1];
      setMemory((prev) => ({ ...prev, username: newName }));
    }
    if (/i like (.+)/i.test(trimmed)) {
      const fact = "Likes " + trimmed.match(/i like (.+)/i)[1];
      setMemory((prev) => ({ ...prev, facts: [...prev.facts, fact] }));
    }

    // Update session
    setSessions((prev) => {
      const newSessions = { ...prev };
      newSessions[activeId] = { ...newSessions[activeId], messages: updatedMessages };
      const userCount = updatedMessages.filter((m) => m.role === "user").length;
      if (userCount === 1) {
        newSessions[activeId].title = trimmed.length > 26 ? trimmed.slice(0, 26) + "…" : trimmed;
      }
      return newSessions;
    });

    setText("");
    setSending(true);

    const botReply = await getGeminiResponse(trimmed, memory, updatedMessages);

    setSessions((prev) => ({
      ...prev,
      [activeId]: { ...prev[activeId], messages: [...updatedMessages, { role: "bot", text: botReply }] },
    }));

    setSending(false);
  };

  // File Upload
  const onFileUploadClick = () => fileInputRef.current?.click();

  const onFileSelected = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const userMsg = { role: "user", text: `📄 Uploaded: ${file.name}` };
    const updatedMessages = [...activeMessages, userMsg];
    setSessions((prev) => ({ ...prev, [activeId]: { ...prev[activeId], messages: updatedMessages } }));

    // (File parsing logic same as before...)
    e.target.value = "";
  };

  // Edit/Delete user messages
  const editUserMessage = async (i) => {
    const newText = prompt("Edit your message:", activeMessages[i].text);
    if (!newText || newText.trim() === "") return;

    const updatedMessages = [...activeMessages];
    updatedMessages[i].text = newText;

    const filteredMessages = updatedMessages.filter((msg, index) => index <= i || msg.role === "user");

    setSessions((prev) => ({ ...prev, [activeId]: { ...prev[activeId], messages: filteredMessages } }));

    const botReply = await getGeminiResponse(newText, memory, filteredMessages);

    setSessions((prev) => ({
      ...prev,
      [activeId]: { ...prev[activeId], messages: [...filteredMessages, { role: "bot", text: botReply }] },
    }));
  };

  const deleteUserMessage = (i) => {
    if (!window.confirm("Delete this message?")) return;

    const updatedMessages = [...activeMessages];
    updatedMessages.splice(i, 1);

    const filteredMessages = [];
    for (let j = 0; j < updatedMessages.length; j++) {
      if (updatedMessages[j].role === "bot" && j > i - 1) continue;
      filteredMessages.push(updatedMessages[j]);
    }

    setSessions((prev) => ({ ...prev, [activeId]: { ...prev[activeId], messages: filteredMessages } }));
  };

  return (
    <div className="app">
      <header className="topbar">
        <button className="hamburger" onClick={() => setSidebarOpen((s) => !s)}>☰</button>
        <h1 className="brand">ChatMini</h1>
      </header>

      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="side-inner">
          <ul className="side-links">
            <li><button onClick={onNewChat}>+ New Chat</button></li>
          </ul>
          <div className="history">
            <ol>
              {Object.entries(sessions).map(([id, session]) => (
                <li key={id}>
                  <div className={`history-row ${id === activeId ? "active" : ""}`}>
                    <button
                      className="history-btn"
                      onClick={() => { setActiveId(id); setSidebarOpen(false); }}
                      title={session.title}
                    >
                      {session.title}
                    </button>
                    <button
                      className="del-btn"
                      onClick={(e) => { e.stopPropagation(); onDeleteChat(id); }}
                      title="Delete"
                    >
                      <FaTrash />
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <div className="backdrop" onClick={() => setSidebarOpen(false)} />
      </aside>

      <main className="main">
        <div className="messages">
          {activeMessages.map((m, i) => (
            <div key={i} className={`msg ${m.role === "user" ? "user" : "bot"}`}>
              <div className="bubble">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
                {m.role === "user" && (
                  <div className="msg-actions">
                    <button className="edit-btn" onClick={() => editUserMessage(i)}><FaPen /></button>
                    <button className="del-btn" onClick={() => deleteUserMessage(i)}><FaTrash /></button>
                  </div>
                )}
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
            onKeyDown={(e) => { if (e.key === "Enter") onSend(); }}
          />
          <button className="plus-btn" onClick={onFileUploadClick}><FaPlus /></button>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            accept=".txt,.pdf,.docx"
            onChange={onFileSelected}
          />
          <button className="send-btn" onClick={onSend} disabled={sending}><FaArrowUp /></button>
        </div>
      </main>
    </div>
  );
}
