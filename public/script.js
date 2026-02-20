const socket = io();
let myName = localStorage.getItem('chat_name') || prompt("Ваш ник:") || "Аноним";
localStorage.setItem('chat_name', myName);

document.getElementById('user-display').innerText = myName;
document.getElementById('user-display-avatar').innerText = myName[0].toUpperCase();

const messagesDiv = document.getElementById('messages');
const msgInput = document.getElementById('msg-input');
const fileInput = document.getElementById('file-input');

socket.emit('join', { username: myName });

function renderMessage(data) {
    const isMine = (data.username || data.user) === myName;
    const wrap = document.createElement('div');
    wrap.className = `message-wrapper ${isMine ? 'my-wrapper' : ''}`;
    wrap.setAttribute('data-id', data.id);

    let content = data.content || data.text;
    if (data.msg_type === 'file' && data.file_type?.startsWith('image')) {
        content = `<img src="${content}" style="max-width:100%; border-radius:10px; margin-top:5px;">`;
    }

    wrap.innerHTML = `
        <div class="message ${isMine ? 'my-message' : 'other-message'}">
            <span style="font-size:0.65rem; opacity:0.8; display:block; margin-bottom:2px;">${data.username}</span>
            ${content}
            <div class="msg-footer">
                <span>${data.time || ''}</span>
                ${isMine ? `<button onclick="deleteMsg(${data.id})" class="delete-btn"><i class="fa-solid fa-trash-can"></i></button>` : ''}
            </div>
        </div>
    `;
    messagesDiv.appendChild(wrap);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function deleteMsg(id) { if(confirm("Удалить?")) socket.emit('delete message', id); }

socket.on('message deleted', id => document.querySelector(`[data-id="${id}"]`)?.remove());
socket.on('load history', h => { messagesDiv.innerHTML = ''; h.forEach(renderMessage); });
socket.on('chat message', renderMessage);

document.getElementById('send-btn').onclick = () => {
    if(!msgInput.value.trim()) return;
    socket.emit('chat message', { user: myName, text: msgInput.value, room: 'general' });
    msgInput.value = '';
};

msgInput.oninput = () => socket.emit('typing', { user: myName });
socket.on('display typing', d => {
    const t = document.getElementById('typing-box');
    t.innerText = `${d.user} печатает...`;
    setTimeout(() => t.innerText = '', 3000);
});

socket.on('update online', users => {
    document.getElementById('users-box').innerHTML = users.map(u => `
        <div class="user-item">
            <div class="mini-avatar" style="width:25px; height:25px; font-size:0.7rem;">${u.name[0]}</div>
            <span style="font-size:0.9rem;">${u.name}</span>
        </div>`).join('');
});

fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        socket.emit('chat message', { user: myName, file: reader.result, fileName: file.name, fileType: file.type });
    };
    reader.readAsDataURL(file);
};
