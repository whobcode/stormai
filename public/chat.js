/**
 * LLM Chat App Frontend (Pro Upgrade)
 *
 * Features:
 * - Avatars
 * - Timestamps
 * - Persistent history
 * - Markdown/code rendering
 * - Sound on new message
 * - Export chat (txt/md)
 * - Slash commands (/clear, /export)
 * - Streaming response effect
 * - Theme toggle (dark/light)
 * - Animated typing
 * - Quick replies
 */

// ========== DOM elements ==========
const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");

// Theme toggle button (add to HTML if you want)
let themeBtn = document.getElementById("theme-toggle");
if (!themeBtn) {
  themeBtn = document.createElement("button");
  themeBtn.id = "theme-toggle";
  themeBtn.textContent = "Toggle Theme";
  themeBtn.style = "position:fixed;top:12px;right:12px;z-index:10;";
  document.body.appendChild(themeBtn);
}

// ========== Assets ==========
const AVATAR_USER = "https://avatars.githubusercontent.com/u/583231?v=4"; // change to your own
const AVATAR_AI = "https://upload.wikimedia.org/wikipedia/commons/6/6f/Robot_icon.svg"; // or local asset
const SOUND_URL = "https://cdn.pixabay.com/audio/2022/07/26/audio_124bfa3c5d.mp3"; // simple pop

// ========== State ==========
let chatHistory = [];
let isProcessing = false;

// Try to load persistent chat
if (localStorage.getItem("chatHistory")) {
  chatHistory = JSON.parse(localStorage.getItem("chatHistory"));
  chatHistory.forEach(m => renderMessage(m.role, m.content, m.timestamp));
} else {
  // Default welcome message
  chatHistory = [
    {
      role: "assistant",
      content:
        "Hello! I'm an LLM chat app powered by Cloudflare Workers AI. How can I help you today?",
      timestamp: Date.now()
    },
  ];
  renderMessage("assistant", chatHistory[0].content, chatHistory[0].timestamp);
}

// ========== Event listeners ==========
userInput.addEventListener("input", function () {
  this.style.height = "auto";
  this.style.height = this.scrollHeight + "px";
});

userInput.addEventListener("keydown", function (e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
sendButton.addEventListener("click", sendMessage);
themeBtn.addEventListener("click", toggleTheme);

// ========== Theme Toggle ==========
function toggleTheme() {
  document.body.classList.toggle("light-theme");
  localStorage.setItem("theme", document.body.classList.contains("light-theme") ? "light" : "dark");
}
if(localStorage.getItem("theme") === "light") document.body.classList.add("light-theme");

// ========== Main send message ==========
async function sendMessage() {
  const message = userInput.value.trim();
  if (message === "" || isProcessing) return;
  // Handle slash commands
  if (message.startsWith("/")) {
    handleSlashCommand(message);
    userInput.value = "";
    return;
  }
  // Add to UI/state
  addMessageToChat("user", message);
  // Clear input
  userInput.value = "";
  userInput.style.height = "auto";
  isProcessing = true;
  userInput.disabled = true;
  sendButton.disabled = true;
  typingIndicator.classList.add("visible");
  chatHistory.push({ role: "user", content: message, timestamp: Date.now() });
  saveHistory();
  try {
    // Create streaming response element
    const assistantMessageEl = renderMessage("assistant", "", Date.now());
    // Scroll
    scrollChatToBottom();
    // Send request
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: chatHistory.map(({role,content})=>({role,content})) }),
    });
    if (!response.ok) throw new Error("Failed to get response");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let responseText = "";
    // Streaming (per character)
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");
      for (const line of lines) {
        try {
          const jsonData = JSON.parse(line);
          if (jsonData.response) {
            await streamToMessage(assistantMessageEl, jsonData.response);
            responseText += jsonData.response;
            scrollChatToBottom();
          }
        } catch {}
      }
    }
    chatHistory.push({ role: "assistant", content: responseText, timestamp: Date.now() });
    saveHistory();
    playSound();
    renderQuickReplies(responseText);
  } catch (error) {
    console.error("Error:", error);
    addMessageToChat("assistant", "Sorry, there was an error processing your request.");
  } finally {
    typingIndicator.classList.remove("visible");
    isProcessing = false;
    userInput.disabled = false;
    sendButton.disabled = false;
    userInput.focus();
  }
}

function addMessageToChat(role, content) {
  const timestamp = Date.now();
  chatHistory.push({ role, content, timestamp });
  renderMessage(role, content, timestamp);
  saveHistory();
  scrollChatToBottom();
}

// ========== Render message ==========
function renderMessage(role, content, timestamp) {
  // Avatars
  const avatar = role === "user" ? AVATAR_USER : AVATAR_AI;
  // Markdown
  const html = renderMarkdown(content);
  // Timestamp
  const time = timestamp ? formatTime(timestamp) : "";
  // Build element
  const msgDiv = document.createElement("div");
  msgDiv.className = `message ${role}-message`;
  msgDiv.innerHTML = `
    <img class="avatar" src="${avatar}" alt="${role}" />
    <div class="bubble">
      <div class="content">${html}</div>
      <div class="timestamp">${time}</div>
    </div>
  `;
  chatMessages.appendChild(msgDiv);
  scrollChatToBottom();
  return msgDiv.querySelector(".content"); // for streaming effect
}

// ========== Streaming per char ==========
async function streamToMessage(el, text) {
  for (let i = 0; i < text.length; ++i) {
    el.innerHTML += text[i];
    await new Promise(res => setTimeout(res, 5));
  }
}

// ========== Markdown rendering ==========
function renderMarkdown(md) {
  // Lightweight Markdown (bold, italic, code, link, code block)
  let html = md
    .replace(/\`([^\\\`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\*([^*]+)\*/g, '<i>$1</i>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
  // Code blocks
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  return html;
}

// ========== Save/load history ==========
function saveHistory() {
  localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
}

// ========== Scroll ==========
function scrollChatToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ========== Time formatting ==========
function formatTime(ts) {
  const date = new Date(ts);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ========== Sound notification ==========
let audio = null;
function playSound() {
  if (!audio) audio = new Audio(SOUND_URL);
  audio.currentTime = 0;
  audio.play();
}

// ========== Export chat ==========
function exportChat(format = "txt") {
  let out = "";
  if (format === "md") {
    chatHistory.forEach(m => {
      out += `**${m.role}**: ${m.content}\n\n`;
    });
  } else {
    chatHistory.forEach(m => {
      out += `[${formatTime(m.timestamp)}] ${m.role}: ${m.content}\n`;
    });
  }
  const blob = new Blob([out], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `chat.${format}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ========== Slash commands ==========
function handleSlashCommand(cmd) {
  if (cmd.startsWith("/clear")) {
    chatHistory = [];
    chatMessages.innerHTML = "";
    saveHistory();
    renderMessage("assistant", "Chat cleared. How can I help?", Date.now());
  } else if (cmd.startsWith("/export")) {
    if (cmd.endsWith("md")) exportChat("md");
    else exportChat("txt");
  } else if (cmd.startsWith("/help")) {
    renderMessage("assistant", "Commands: /clear, /export, /export md, /help", Date.now());
  } else {
    renderMessage("assistant", "Unknown command.", Date.now());
  }
}

// ========== Quick replies ==========
function renderQuickReplies(aiText) {
  // Simple demo: show suggestions after AI replies
  const lastUser = chatHistory.slice().reverse().find(m => m.role === "user");
  if (!lastUser) return;
  const sampleReplies = [
    "Can you elaborate?",
    "Show me an example.",
    "Summarize that.",
    "/help"
  ];
  // Remove any old quick reply bar
  let oldBar = document.getElementById("quick-replies");
  if (oldBar) oldBar.remove();
  const bar = document.createElement("div");
  bar.id = "quick-replies";
  bar.style = "display:flex;gap:8px;margin:12px 0 8px 54px";
  sampleReplies.forEach(txt => {
    const btn = document.createElement("button");
    btn.textContent = txt;
    btn.style = "background:var(--primary-color);color:white;border:none;border-radius:4px;padding:4px 12px;cursor:pointer;font-size:0.92em;";
    btn.onclick = () => {
      userInput.value = txt;
      userInput.focus();
    };
    bar.appendChild(btn);
  });
  chatMessages.appendChild(bar);
  scrollChatToBottom();
}

