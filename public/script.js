const socket = io();
let myName = localStorage.getItem('chat_name') || prompt("Ваш ник:") || "Аноним";
localStorage.setItem('chat_name', myName);
document.getElementById('user-display').innerText = "Вы: " + myName;

let currentRoom = 'general';
const messagesDiv = document.getElementById('messages');
const msgInput = document.getElementById('msg-input');
const chatTitle = document.getElementById('chat-title');
const backBtn = document.getElementById('back-btn');

socket.emit('join', { username: myName });

// Функция для смены комнаты
function joinPrivateChat(targetUser) {
    if (targetUser === myName) return;
    
    // Создаем уникальное имя комнаты (сортируем имена, чтобы у обоих была одна комната)
    currentRoom = [myName, targetUser].sort().join('_');
    chatTitle.innerText = `Приват с ${targetUser}`;
    backBtn.style.display = 'block';
    messagesDiv.innerHTML = ''; // Чистим экран для привата
    socket.emit('join room', currentRoom);
}

backBtn.onclick = () => {
    currentRoom = 'general';
    chatTitle.innerText = 'Общий чат';
    backBtn.style.display = 'none';
    messagesDiv.innerHTML = '';
    socket.emit('join room', 'general');
};

function send() {
    if (msgInput.value.trim()) {
        socket.emit('chat message', { user: myName, text: msgInput.value, room: currentRoom });
        msgInput.value = "";
    }
}

msgInput.addEventListener('input', () => socket.emit('typing', { user: myName, room: currentRoom }));

socket.on('chat message', (data) => {
    if (data.room !== currentRoom) return; // Не показываем сообщения из других комнат
    const isMine = data.user === myName;
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${isMine ? 'my-wrapper' : ''}`;
    wrapper.innerHTML = `
        <div class="avatar" style="background: gray">${data.user[0].toUpperCase()}</div>
        <div class="message ${isMine ? 'my-message' : 'other-message'}">
            <span class="msg-user">${data.user} <span class="time">${data.time}</span></span>
            <div>${data.text}</div>
        </div>
    `;
    messagesDiv.appendChild(wrapper);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    if(!isMine) document.getElementById('msg-sound').play().catch(()=>{});
});

socket.on('update online', (users) => {
    document.getElementById('users-box').innerHTML = users.map(u => 
        `<div class="user-item" onclick="joinPrivateChat('${u.name}')">
            <span class="status-dot"></span> ${u.name} ${u.name === myName ? '(Вы)' : ''}
        </div>`).join('');
});

document.getElementById('send-btn').onclick = send;
msgInput.onkeypress = (e) => { if(e.key === 'Enter') send(); };
