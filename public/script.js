const socket = io();

let myName = localStorage.getItem('chat_name') || prompt("Ваш ник:") || "Аноним";
localStorage.setItem('chat_name', myName);
document.getElementById('user-display').innerText = "Вы: " + myName;

socket.emit('join', { username: myName });

const messagesDiv = document.getElementById('messages');
const msgInput = document.getElementById('msg-input');
const typingStatus = document.getElementById('typing-status');
const msgSound = document.getElementById('msg-sound');

let isFocused = true;
let unread = 0;
let typingTimer;

window.onfocus = () => { isFocused = true; unread = 0; document.title = "Messenger Pro"; };
window.onblur = () => isFocused = false;

function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return `hsl(${Math.abs(hash) % 360}, 60%, 50%)`;
}

// Индикатор печати
msgInput.addEventListener('input', () => {
    socket.emit('typing', { user: myName });
});

socket.on('user typing', (data) => {
    typingStatus.innerText = `${data.user} печатает...`;
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => { typingStatus.innerText = ''; }, 2000);
});

function addMessage(data) {
    const isMine = data.user === myName;
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${isMine ? 'my-wrapper' : ''}`;

    wrapper.innerHTML = `
        <div class="avatar" style="background: ${stringToColor(data.user)}">${data.user[0].toUpperCase()}</div>
        <div class="message ${isMine ? 'my-message' : 'other-message'}">
            <span class="msg-user">${data.user} <span class="time">${data.time || ''}</span></span>
            <div>${data.text}</div>
        </div>
    `;

    messagesDiv.appendChild(wrapper);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    if (!isMine) {
        // Звук (сработает если браузер разрешил)
        msgSound.play().catch(() => {});
        if (!isFocused) {
            unread++;
            document.title = `(${unread}) Новое сообщение!`;
        }
    }
}

function send() {
    if (msgInput.value.trim()) {
        socket.emit('chat message', { user: myName, text: msgInput.value });
        msgInput.value = "";
        typingStatus.innerText = ''; // Убираем статус у себя
    }
}

document.getElementById('send-btn').onclick = send;
msgInput.onkeypress = (e) => { if(e.key === 'Enter') send(); };

socket.on('chat message', addMessage);
socket.on('load history', (h) => { messagesDiv.innerHTML = ''; h.forEach(addMessage); });
socket.on('update online', (users) => {
    document.getElementById('users-box').innerHTML = users.map(u => 
        `<div style="display:flex; align-items:center; margin-bottom:10px; font-size:13px;">
            <div style="width:8px; height:8px; background:#23a55a; border-radius:50%; margin-right:10px;"></div>
            ${u.name}
        </div>`).join('');
});
