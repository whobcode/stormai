const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const avatarInput = document.getElementById("avatar-upload");
const chatContainer = document.getElementById("chat-container");
const signupModal = document.getElementById("signup-modal");
const loginModal = document.getElementById("login-modal");
const AVATAR_AI = "images/rick_head.jpg";

// Hamburger/menu logic
const menuToggle = document.getElementById("menu-toggle");
const menuOptions = document.getElementById("menu-options");
let anonRequestCount = 0;
const authenticated = document.cookie.includes("CF_Authorization");

// Hamburger open/close robustly toggles hidden/show
menuToggle.addEventListener("click", () => {
  if (menuOptions.classList.contains("show")) {
    menuOptions.classList.remove("show");
    menuOptions.classList.add("hidden");
  } else {
    menuOptions.classList.add("show");
    menuOptions.classList.remove("hidden");
  }
});
document.body.addEventListener("click", (e) => {
  if (!menuToggle.contains(e.target) && !menuOptions.contains(e.target)) {
    menuOptions.classList.remove("show");
    menuOptions.classList.add("hidden");
  }
}, true);


// Other menu actions
document.getElementById("export-chat").onclick = () => exportChat("txt");
document.getElementById("info-btn").onclick = function() {
  document.getElementById("info-modal").classList.remove("hidden");
};
function closeInfo(){ 
  document.getElementById("info-modal").classList.add("hidden"); 
};
document.getElementById("settings-btn").onclick = function() {
  document.getElementById("settings-modal").classList.add("show");
};
function closeSettings() { 
  document.getElementById("settings-modal").classList.remove("show"); 
};

// Export/import/clear data logic
document.getElementById('export-settings-btn').onclick = function() {
  const data = {
    chatHistory: JSON.parse(localStorage.getItem('chatHistory') || '[]'),
    userAvatar: localStorage.getItem('userAvatar') || null,
    selectedModel: localStorage.getItem('selectedModel') || null
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'hwmnbai-data.json';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),2000);
};
const importFile = document.getElementById('import-settings-file');
document.getElementById('import-settings-btn').onclick = ()=>importFile.click();
importFile.onchange = function(e){
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(evt){
    try {
      const data = JSON.parse(evt.target.result);
      if(data.chatHistory) localStorage.setItem('chatHistory', JSON.stringify(data.chatHistory));
      alert("Imported! Reloading…");
      window.location.reload();
    } catch(e){ alert("Import failed!"); }
  };
  reader.readAsText(file);
};
document.getElementById('clear-settings-btn').onclick = function(){
  if(confirm("Are you sure? This deletes ALL chat, settings, and avatar.")){
    localStorage.clear();
    window.location.reload();
  }
};

// Use a persistent avatar, fallback to GitHub octocat
const AVATAR_USER = localStorage.getItem("userAvatar") || "https://avatars.githubusercontent.com/u/583231?v=4";
let chatHistory = [];
let isProcessing = false;
// Persistent chat
if (localStorage.getItem("chatHistory")) {
  chatHistory = JSON.parse(localStorage.getItem("chatHistory"));
  chatHistory.forEach(m => renderMessage(m.role, m.content, m.timestamp));
} else {
  chatHistory = [
    {
      role: "assistant",
      content: "Hello! I'm an LLM chat app powered by theWannaBeeesz. How can I help you today?",
      timestamp: Date.now()
    }
  ];
  renderMessage("assistant", chatHistory[0].content, chatHistory[0].timestamp);
}

// Input/Container glow + SVG color shift
let typingTimeout;
userInput.addEventListener("focus", function () {
  // Always black text when engaged/focused (any theme)
  this.style.color = "#151411";
});
userInput.addEventListener("blur", function () {
  this.classList.remove("typing-glow");
  chatContainer.classList.remove("typing");
  this.style.color = "#fafcff";
});
userInput.addEventListener("input", function () {
  this.style.height = "auto";
  this.style.height = this.scrollHeight + "px";
  this.classList.add("typing-glow");
  chatContainer.classList.add("typing");
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    this.classList.remove("typing-glow");
    chatContainer.classList.remove("typing");
  }, 1400);
});

// Handle form submit and send button click
document.getElementById("input-form").addEventListener("submit", e => {
  e.preventDefault(); // prevent page reload
  sendMessage();
});


// Avatar upload logic
if (avatarInput) {
  avatarInput.addEventListener("change", function(e) {
    const file = e.target.files[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = function(evt) {
        localStorage.setItem("userAvatar", evt.target.result);
        window.location.reload();
      };
      reader.readAsDataURL(file);
    }
  });
}

function setTypingIndicator(visible) {
  const indicator = document.getElementById("typing-indicator");
  const text = document.getElementById("typing-text");
  if (visible) {
    indicator.classList.add("visible");
    text.innerHTML = isVerbose
      ? " The AI is analyzing your question, researching the answer, and will respond shortly."
      : "";
  } else {
    indicator.classList.remove("visible");
  }
}

async function sendMessage() {
  const message = userInput.value.trim();
  if (message === "" || isProcessing) return;
  if (!authenticated) {
    anonRequestCount++;
    if (anonRequestCount >= 5) {
      signupModal.classList.remove("hidden");
      return;
    }
  }
  if (message.startsWith("/")) {
    handleSlashCommand(message);
    userInput.value = "";
    return;
  }
  addMessageToChat("user", message);
  userInput.value = "";
  userInput.style.height = "auto";
  isProcessing = true;
  userInput.disabled = true;
  sendButton.disabled = true;
  setTypingIndicator(true);
  chatHistory.push({ role: "user", content: message, timestamp: Date.now() });
  saveHistory();
  try {
    const assistantMessageEl = renderMessage("assistant", "", Date.now());
    scrollChatToBottom();
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: chatHistory.map(({role,content})=>({role,content})) }),
    });
    if (!response.ok) throw new Error("Failed to get response");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let responseText = "";
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
    setTypingIndicator(false);
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

function renderMessage(role, content, timestamp) {
  const avatar = role === "user" ? AVATAR_USER : null;
  const html = renderMarkdown(content);
  const time = timestamp ? formatTime(timestamp) : "";
  const msgDiv = document.createElement("div");
  msgDiv.className = `message ${role}-message`;
  msgDiv.innerHTML = `
    ${
      role === "assistant"
        ? `<img class="avatar" src="${AVATAR_AI}" alt="AI Avatar" />`
        : `<img class="avatar" src="${avatar}" alt="User Avatar" />`
    }
    <div class="bubble">
      <div class="content">${html}</div>
      <div class="timestamp">${time}</div>
    </div>
  `;
  chatMessages.appendChild(msgDiv);
  scrollChatToBottom();
  return msgDiv.querySelector(".content");
}

async function streamToMessage(el, text) {
  for (let i = 0; i < text.length; ++i) {
    el.innerHTML += text[i];
    await new Promise(res => setTimeout(res, 5));
  }
}
function renderMarkdown(md) {
  let html = md
    .replace(/\`([^\`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\*([^*]+)\*/g, '<i>$1</i>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  return html;
}
function saveHistory() {
  localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
}
function scrollChatToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
function formatTime(ts) {
  const date = new Date(ts);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
let audio = null;
function playSound() {
  if (!audio) audio = new Audio(SOUND_URL);
  audio.currentTime = 0;
  audio.play();
}
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
function renderQuickReplies(aiText) {
  const lastUser = chatHistory.slice().reverse().find(m => m.role === "user");
  if (!lastUser) return;
  const sampleReplies = [
    "Can you elaborate?",
    "Show me an example.",
    "Summarize that.",
    "/help"
  ];
  let oldBar = document.getElementById("quick-replies");
  if (oldBar) oldBar.remove();
  const bar = document.createElement("div");
  bar.id = "quick-replies";
  bar.style = "display:flex;gap:8px;margin:12px 0 8px 38px";
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

// Chat History Modal: Indexed, Searchable, Interactive
document.getElementById("history-btn").onclick = function() {
  showHistory();
};
function closeHistory() {
  document.getElementById("history-modal").classList.remove("show");
}
function showHistory() {
  const modal = document.getElementById("history-modal");
  const list = document.getElementById("history-list");
  const searchInput = document.getElementById("history-search");
  list.innerHTML = "";
  const history = JSON.parse(localStorage.getItem("chatHistory") || "[]");
  // Simple session splits: messages between '/clear'
  let sessions = [];
  let curr = [];
  history.forEach(msg => {
    if (msg.content === "Chat cleared. How can I help?") {
      if (curr.length) sessions.push(curr);
      curr = [];
    } else {
      curr.push(msg);
    }
  });
  if (curr.length) sessions.push(curr);

  // Flatten and show by most recent, filter by search if any
  function renderFilteredHistory() {
    list.innerHTML = "";
    let filter = searchInput.value.trim().toLowerCase();
    let filtered = sessions
      .flat()
      .filter(m => !filter || m.content.toLowerCase().includes(filter));
    if (!filtered.length) {
      list.innerHTML = '<li style="color:#c00;">No matches.</li>';
      return;
    }
    filtered.forEach((m, i) => {
      let li = document.createElement("li");
      li.innerHTML = `<b>${m.role}:</b> ${m.content}<br>
        <span style="font-size:0.75em; color:var(--text-light);">${formatTime(m.timestamp)}</span>`;
      li.style.cursor = "pointer";
      li.onclick = () => {
        userInput.value = m.content;
        userInput.focus();
        closeHistory();
      };
      list.appendChild(li);
    });
  }
  searchInput.oninput = renderFilteredHistory;
  renderFilteredHistory();
  modal.classList.add("show");
}

