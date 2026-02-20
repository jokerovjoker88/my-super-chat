const socket = io();
let myName = localStorage.getItem('chat_name') || prompt("Ваш ник:") || "Нейрон";
localStorage.setItem('chat_name', myName);

document.getElementById('user-display').innerText = myName; // Просто имя
document.getElementById('user-display-avatar').innerText = myName[0].toUpperCase();

const messagesDiv = document.getElementById('messages');
const msgInput = document.getElementById('msg-input');
const fileInput = document.getElementById('file-input');
const sendBtn = document.getElementById('send-btn');
const recordBtn = document.getElementById('record-btn');

socket.emit('join', { username: myName });

// Функция генерации цвета для аватарки
function getAvatarColor(s) {
    let hash = 0; for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
    return `hsl(${Math.abs(hash % 360)}, 70%, 50%)`;
}

// Универсальная функция отрисовки сообщения
function renderMessage(data) {
    const user = data.username || data.user;
    const content = data.content || data.text;
    const type = data.msg_type || 'text'; // По умолчанию текст
    const isMine = user === myName;

    const wrap = document.createElement('div');
    wrap.className = `message-wrapper ${isMine ? 'my-wrapper' : ''}`;

    let avatar = `<div class="avatar-message" style="background:${getAvatarColor(user)}">${user[0].toUpperCase()}</div>`;
    if (isMine) avatar = ''; // Убираем аватарку для своих сообщений

    let htmlContent = '';
    if (type === 'file' && (data.file_type || data.fileType)?.startsWith('image')) {
        htmlContent = `<img src="${content}" class="attachment-img" loading="lazy">`;
    } else if (type === 'file') {
        htmlContent = `<a href="${content}" download="${data.file_name || 'файл'}" class="attachment-link"><i class="fa-solid fa-download"></i> ${data.file_name || 'Файл'}</a>`;
    } else if (type === 'audio') {
        htmlContent = `<audio src="${content}" controls class="audio-player"></audio>`;
    } else {
        htmlContent = `<div>${content}</div>`;
    }

    wrap.innerHTML = `
        ${avatar}
        <div class="message ${isMine ? 'my-message' : 'other-message'}">
            <span class="msg-user">${user}</span>
            ${htmlContent}
        </div>
    `;
    messagesDiv.appendChild(wrap);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Загрузка истории
socket.on('load history', (history) => {
    messagesDiv.innerHTML = '';
    if (history) history.forEach(renderMessage);
});

// Получение нового сообщения
socket.on('chat message', renderMessage);

// Отправка текстового сообщения
sendBtn.onclick = () => {
    const text = msgInput.value.trim();
    if (text) {
        socket.emit('chat message', {
            user: myName,
            text: text,
            room: 'general'
        });
        msgInput.value = '';
    }
};
msgInput.onkeypress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { // Shift+Enter для новой строки
        e.preventDefault();
        sendBtn.click();
    }
};

// Автоматическая подстройка высоты textarea
msgInput.addEventListener('input', () => {
    msgInput.style.height = 'auto';
    msgInput.style.height = msgInput.scrollHeight + 'px';
});

// Отправка файла
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
            room: 'general'
        });
    };
    reader.readAsDataURL(file);
};

// Обновление списка онлайн-пользователей
socket.on('update online', (users) => {
    const usersBox = document.getElementById('users-box');
    usersBox.innerHTML = '';
    users.forEach(u => {
        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        userItem.innerHTML = `<div class="user-item-avatar" style="background:${getAvatarColor(u.name)}">${u.name[0].toUpperCase()}</div>
                              <span class="user-item-name">${u.name}</span>
                              <span class="user-item-status">online</span>`;
        usersBox.appendChild(userItem);
    });
});

// Кнопка "назад" (пока только для видимости, функционал приватов не подключен)
document.getElementById('back-btn').onclick = () => {
    // Здесь будет функционал возврата в общий чат
    alert('Пока нет приватов, но скоро будут!');
};
