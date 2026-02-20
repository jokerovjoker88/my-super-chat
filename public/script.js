const socket = io();
let myName = localStorage.getItem('chat_name') || prompt("Ваш ник:") || "Аноним";
localStorage.setItem('chat_name', myName);

document.getElementById('user-display').innerText = "Вы: " + myName;

const messagesDiv = document.getElementById('messages');
const msgInput = document.getElementById('msg-input');
const fileInput = document.getElementById('file-input');

socket.emit('join', { username: myName });

function renderMessage(data) {
    const user = data.username || data.user;
    const content = data.content || data.text;
    const type = data.msg_type || (data.file ? 'file' : data.audio ? 'audio' : 'text');
    const isMine = user === myName;

    const wrap = document.createElement('div');
    wrap.className = `message-wrapper ${isMine ? 'my-wrapper' : ''}`;

    let html = '';
    if (type === 'file' && (data.file_type || data.fileType)?.startsWith('image')) {
        html = `<img src="${content}" class="attachment-img">`;
    } else if (type === 'file') {
        html = `<a href="${content}" download="${data.file_name || 'file'}" class="attachment-file">📁 ${data.file_name || 'Файл'}</a>`;
    } else if (type === 'audio') {
        html = `<audio src="${content}" controls></audio>`;
    } else {
        html = `<div>${content}</div>`;
    }

    wrap.innerHTML = `
        <div class="message ${isMine ? 'my-message' : 'other-message'}">
            <span class="msg-user">${user}</span>
            ${html}
        </div>
    `;
    messagesDiv.appendChild(wrap);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

socket.on('load history', (history) => {
    messagesDiv.innerHTML = '';
    history.forEach(renderMessage);
});

socket.on('chat message', renderMessage);

function sendMessage() {
    if (msgInput.value.trim()) {
        socket.emit('chat message', {
            user: myName,
            text: msgInput.value,
            room: 'general'
        });
        msgInput.value = '';
    }
}

document.getElementById('send-btn').onclick = sendMessage;
msgInput.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };

fileInput.onchange = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = () => {
        socket.emit('chat message', {
            user: myName,
            file: reader.result,
            fileName: file.name,
            fileType: file.type,
            room: 'general'
        });
    };
    reader.readAsDataURL(file);
};
