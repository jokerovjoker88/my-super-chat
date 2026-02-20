const socket = io();

let myName = localStorage.getItem('chat_name') || prompt("Введите ваш ник:") || "Аноним";
localStorage.setItem('chat_name', myName);
document.getElementById('user-display').innerText = "Вы: " + myName;

socket.emit('join', { username: myName });

const messagesDiv = document.getElementById('messages');
let isFocused = true;
let unread = 0;

window.onfocus = () => { isFocused = true; unread = 0; document.title = "Messenger Pro"; };
window.onblur = () => isFocused = false;

function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return `hsl(${Math.abs(hash) % 360}, 65%, 55%)`;
}

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

    if (!isFocused && !isMine) {
        unread++;
        document.title = `(${unread}) Новое сообщение!`;
    }
}

function send() {
    const input = document.getElementById('msg-input');
    if (input.value.trim()) {
        socket.emit('chat message', { user: myName, text: input.value });
        input.value = "";
    }
}

document.getElementById('send-btn').onclick = send;
document.getElementById('msg-input').onkeypress = (e) => { if(e.key === 'Enter') send(); };

socket.on('chat message', addMessage);
socket.on('load history', (h) => { messagesDiv.innerHTML = ''; h.forEach(addMessage); });
socket.on('update online', (users) => {
    document.getElementById('users-box').innerHTML = users.map(u => 
        `<div style="display:flex; align-items:center; margin-bottom:10px; font-size:14px;">
            <div style="width:10px; height:10px; background:#23a55a; border-radius:50%; margin-right:10px;"></div>
            ${u.name}
        </div>`).join('');
});
