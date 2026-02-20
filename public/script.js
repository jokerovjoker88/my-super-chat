const socket = io();
let myName = localStorage.getItem('chat_name') || prompt("Ваш ник:") || "Аноним";
localStorage.setItem('chat_name', myName);
document.getElementById('user-display').innerText = "Вы: " + myName;

let currentRoom = 'general';
const messagesDiv = document.getElementById('messages');
const msgInput = document.getElementById('msg-input');
const fileInput = document.getElementById('file-input');
const recordBtn = document.getElementById('record-btn');
const chatTitle = document.getElementById('chat-title');
const backBtn = document.getElementById('back-btn');

let mediaRecorder;
let audioChunks = [];

// При входе уведомляем сервер
socket.emit('join', { username: myName });

// Функция генерации цвета для аватарки
function getCol(s) {
    let h = 0; for(let i=0; i<s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
    return `hsl(${Math.abs(h)%360}, 60%, 50%)`;
}

// Универсальная функция отрисовки сообщения (и из базы, и живых)
function renderMessage(data) {
    // В базе колонки называются username и content, а в живом объекте могут быть user и text
    const user = data.username || data.user || 'Аноним';
    const content = data.content || data.text || '';
    const type = data.msg_type || (data.file ? 'file' : data.audio ? 'audio' : 'text');
    const isMine = user === myName;

    const wrap = document.createElement('div');
    wrap.className = `message-wrapper ${isMine ? 'my-wrapper' : ''}`;

    let html = '';
    if (type === 'file' && (data.file_type?.startsWith('image') || data.fileType?.startsWith('image'))) {
        html = `<img src="${content}" class="attachment-img">`;
    } else if (type === 'file') {
        html = `<a href="${content}" download="${data.file_name || 'file'}" class="attachment-file">📁 ${data.file_name || 'Файл'}</a>`;
    } else if (type === 'audio') {
        html = `<audio src="${content}" controls style="height:35px; width:200px;"></audio>`;
    } else {
        html = `<div>${content}</div>`;
    }

    wrap.innerHTML = `
        <div class="avatar" style="background:${getCol(user)}">${user[0]}</div>
        <div class="message ${isMine ? 'my-message' : 'other-message'}">
            <span class="msg-user">${user}</span>
            ${html}
        </div>
    `;
    messagesDiv.appendChild(wrap);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Загрузка истории из базы
socket.on('load history', (history) => {
    messagesDiv.innerHTML = ''; // Чистим чат перед загрузкой
    if (history && history.length > 0) {
        history.forEach(renderMessage);
    }
});

// Получение нового сообщения
socket.on('chat message', (data) => {
    renderMessage(data);
});

// Отправка текста
function send() {
    const text = msgInput.value.trim();
    if (text) {
        socket.emit('chat message', { 
            user: myName, 
            text: text, 
            room: currentRoom 
        });
        msgInput.value = "";
    }
}

document.getElementById('send-btn').onclick = send;
msgInput.onkeypress = (e) => { if(e.key === 'Enter') send(); };

// Отправка файлов
fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        socket.emit('chat message', {
            user: myName, 
            file: reader.result, 
            fileName: file.name, 
            fileType: file.type, 
            room: currentRoom
        });
    };
    reader.readAsDataURL(file);
};

// Запись голоса
recordBtn.onclick = async () => {
    if (!mediaRecorder || mediaRecorder.state === "inactive") {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = () => {
                const blob = new Blob(audioChunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.onload = () => {
                    socket.emit('chat message', { 
                        user: myName, 
                        audio: reader.result, 
                        room: currentRoom 
                    });
                };
                reader.readAsDataURL(blob);
                recordBtn.classList.remove('recording');
            };
            mediaRecorder.start();
            recordBtn.classList.add('recording');
        } catch (err) { alert("Микрофон недоступен"); }
    } else {
        mediaRecorder.stop();
    }
};

// Онлайн пользователи и комнаты
socket.on('update online', (users) => {
    document.getElementById('users-box').innerHTML = users.map(u => 
        `<div class="user-item" onclick="joinPrivateChat('${u.name}')">
            <span class="status-dot"></span>${u.name}
        </div>`).join('');
});

function joinPrivateChat(target) {
    if (target === myName) return;
    currentRoom = [myName, target].sort().join('_');
    chatTitle.innerText = `Чат с: ${target}`;
    backBtn.style.display = 'block';
    socket.emit('join room', currentRoom);
}

backBtn.onclick = () => {
    currentRoom = 'general';
    chatTitle.innerText = 'Общий чат';
    backBtn.style.display = 'none';
    socket.emit('join room', 'general');
};
