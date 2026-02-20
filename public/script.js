const socket = io();

// Авторизация
let myName = localStorage.getItem('chat_name') || prompt("Введите ваш ник:") || "User";
localStorage.setItem('chat_name', myName);

document.getElementById('user-name').innerText = myName;
document.getElementById('user-avatar').innerText = myName[0].toUpperCase();

const messagesDiv = document.getElementById('messages');
const msgInput = document.getElementById('msg-input');

socket.emit('join', { username: myName });

// Функция отрисовки
function renderMessage(data) {
    const isMine = data.username === myName;
    const wrap = document.createElement('div');
    wrap.className = `message-wrapper ${isMine ? 'my-wrapper' : ''}`;
    
    wrap.innerHTML = `
        <div class="message ${isMine ? 'my-message' : ''}">
            <div style="font-size: 0.7rem; opacity: 0.6; margin-bottom: 4px;">${data.username}</div>
            <div>${data.content}</div>
            <div style="font-size: 0.6rem; margin-top: 5px; text-align: right; opacity: 0.5;">${data.time || ''}</div>
        </div>
    `;
    
    messagesDiv.appendChild(wrap);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Слушатели событий
socket.on('load history', h => { messagesDiv.innerHTML = ''; h.forEach(renderMessage); });
socket.on('chat message', renderMessage);

// Отправка
document.getElementById('send-btn').onclick = sendMessage;
msgInput.onkeydown = (e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

function sendMessage() {
    if(!msgInput.value.trim()) return;
    socket.emit('chat message', { user: myName, text: msgInput.value });
    msgInput.value = '';
}

// Мобильное меню
function toggleMenu() {
    document.getElementById('sidebar').classList.toggle('active');
}
