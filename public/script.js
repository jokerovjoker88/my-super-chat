const socket = io();
let myName = localStorage.getItem('chat_name') || prompt("Ваш ник:") || "Аноним";
localStorage.setItem('chat_name', myName);

let currentRoom = 'general';
const messagesDiv = document.getElementById('messages');
const msgInput = document.getElementById('msg-input');
const fileInput = document.getElementById('file-input');
const recordBtn = document.getElementById('record-btn');

let mediaRecorder;
let audioChunks = [];

// --- ОТПРАВКА ФАЙЛОВ ---
fileInput.onchange = (e) => {
    const file = e.target.files[0];
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

// --- ГОЛОСОВЫЕ СООБЩЕНИЯ ---
recordBtn.onclick = async () => {
    if (!mediaRecorder || mediaRecorder.state === "inactive") {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.onload = () => {
                socket.emit('chat message', { user: myName, audio: reader.result, room: currentRoom });
            };
            reader.readAsDataURL(audioBlob);
            recordBtn.classList.remove('recording');
        };
        
        mediaRecorder.start();
        recordBtn.classList.add('recording');
    } else {
        mediaRecorder.stop();
    }
};

// --- ОТОБРАЖЕНИЕ СООБЩЕНИЙ ---
socket.on('chat message', (data) => {
    if (data.room !== currentRoom) return;
    const isMine = data.user === myName;
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${isMine ? 'my-wrapper' : ''}`;
    
    let content = `<div>${data.text || ''}</div>`;
    
    // Если это картинка
    if (data.file && data.fileType.startsWith('image')) {
        content = `<img src="${data.file}" class="attachment-img">`;
    } 
    // Если это файл
    else if (data.file) {
        content = `<a href="${data.file}" download="${data.fileName}" class="attachment-file">📁 ${data.fileName}</a>`;
    }
    // Если это голосовое
    else if (data.audio) {
        content = `<audio src="${data.audio}" controls style="max-width: 200px; height: 35px;"></audio>`;
    }

    wrapper.innerHTML = `
        <div class="avatar" style="background: #5865f2">${data.user[0]}</div>
        <div class="message ${isMine ? 'my-message' : 'other-message'}">
            <span class="msg-user">${data.user}</span>
            ${content}
        </div>
    `;
    messagesDiv.appendChild(wrapper);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
});

// Остальные функции (join, typing, update online) оставь как в прошлой версии
