const socket = io();

let myName = localStorage.getItem('chat_name') || prompt("Ваш ник:") || "User";
localStorage.setItem('chat_name', myName);
let currentRoom = 'general';

document.getElementById('user-name').innerText = myName;
document.getElementById('user-avatar').innerText = myName[0].toUpperCase();

const messagesDiv = document.getElementById('messages');
const msgInput = document.getElementById('msg-input');

// Вход в комнату при загрузке
joinRoom(currentRoom);

function joinRoom(roomName) {
    currentRoom = roomName;
    messagesDiv.innerHTML = '<div class="loading">Загрузка истории...</div>';
    
    // Меняем заголовок
    document.getElementById('current-room-title').innerText = 
        roomName === 'general' ? 'Общий чат' : 
        roomName === 'gaming' ? 'Игры' : 'Работа';

    // Уведомляем сервер
    socket.emit('join room', { username: myName, room: roomName });

    // Обновляем активный класс в меню
    document.querySelectorAll('.room-item').forEach(el => {
        el.classList.remove('active');
        if(el.innerText.toLowerCase().includes(roomName) || (roomName === 'general' && el.innerText.includes('Общий'))) {
            el.classList.add('active');
        }
    });
}

function switchRoom(room) {
    if(room === currentRoom) return;
    joinRoom(room);
    if(window.innerWidth <= 900) toggleMenu(); // Закрываем меню на мобилке после выбора
}

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

socket.on('load history', h => {
    messagesDiv.innerHTML = '';
    h.forEach(renderMessage);
});

socket.on('chat message', renderMessage);

function sendMessage() {
    if(!msgInput.value.trim()) return;
    socket.emit('chat message', { user: myName, text: msgInput.value, room: currentRoom });
    msgInput.value = '';
}

document.getElementById('send-btn').onclick = sendMessage;
msgInput.onkeydown = (e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

function toggleMenu() { document.getElementById('sidebar').classList.toggle('active'); }
