// Вот здесь io() будет работать, потому что индексный файл подключит библиотеку
const socket = io();

let myName = localStorage.getItem('chat_name') || prompt("Твой ник:") || "Аноним";
localStorage.setItem('chat_name', myName);

// Входим
socket.emit('join', { username: myName });

const msgInput = document.getElementById('msg-input');
const sendBtn = document.getElementById('send-btn');
const messagesDiv = document.getElementById('messages');
const usersBox = document.getElementById('users-box');

function send() {
    if (msgInput.value.trim()) {
        socket.emit('chat message', { user: myName, text: msgInput.value });
        msgInput.value = "";
    }
}

sendBtn.onclick = send;
msgInput.onkeypress = (e) => { if(e.key === 'Enter') send(); };

socket.on('chat message', (data) => {
    addMessage(data);
});

socket.on('load history', (history) => {
    messagesDiv.innerHTML = '';
    history.forEach(addMessage);
});

socket.on('update online', (users) => {
    usersBox.innerHTML = users.map(u => `<div>● ${u.name}</div>`).join('');
});

function addMessage(data) {
    const div = document.createElement('div');
    const isMine = data.user === myName;
    div.className = `message ${isMine ? 'my-message' : 'other-message'}`;
    div.innerHTML = `<span class="msg-user">${data.user}</span><div>${data.text}</div>`;
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}