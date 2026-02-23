const socket = io();
let myNick = "";

// Авторизация
const loginBtn = document.getElementById('login-btn');
loginBtn.onclick = () => {
    const nick = document.getElementById('login-nick').value.trim();
    const pass = document.getElementById('login-pass').value.trim();
    if(nick && pass) {
        socket.emit('auth', { nick, pass });
    }
};

socket.on('auth_ok', data => {
    myNick = data.nick;
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'flex';
    document.getElementById('my-name').innerText = myNick;
    if(data.avatar) document.getElementById('my-ava').src = data.avatar;
    socket.emit('get_my_dialogs', myNick);
});

socket.on('auth_error', msg => {
    document.getElementById('auth-msg').innerText = msg;
});

// ГOЛОСОВЫЕ
let mediaRecorder;
let audioChunks = [];
const voiceBtn = document.getElementById('voice-btn');

voiceBtn.onclick = async () => {
    if (!mediaRecorder || mediaRecorder.state === "inactive") {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = () => {
                    socket.emit('send_msg', { from: myNick, to: activeChat, text: '', file: reader.result, fileName: 'voice.webm' });
                };
            };
            mediaRecorder.start();
            voiceBtn.classList.add('recording');
        } catch(e) { alert("Микрофон недоступен"); }
    } else {
        mediaRecorder.stop();
        voiceBtn.classList.remove('recording');
    }
};

// ... (остальной код поиска, диалогов и рендера из прошлых версий остается таким же)
// ВАЖНО: В функции render добавь условие для audio, как в прошлом моем сообщении.

let activeChat = null;
let typingTimer;

function openChat(name) {
    activeChat = name;
    document.getElementById('welcome').style.display = 'none';
    document.getElementById('chat-box').style.display = 'flex';
    document.getElementById('target-name').innerText = name;
    socket.emit('load_chat', { me: myNick, him: name });
}

function render(s, t, f, fn, time, id, isRead) {
    const box = document.getElementById('messages');
    const d = document.createElement('div');
    d.className = `msg-row ${s === myNick ? 'me' : 'them'}`;
    const tickClass = isRead ? 'fa-check-double' : 'fa-check';
    const ticks = s === myNick ? `<i class="fa-solid ${tickClass} status-tick"></i>` : '';

    let media = '';
    if(f) {
        if(f.includes('data:audio') || fn?.endsWith('.webm')) media = `<audio src="${f}" controls></audio>`;
        else if(f.includes('data:image')) media = `<img src="${f}">`;
        else media = `<a href="${f}" download="${fn}">📁 ${fn}</a>`;
    }

    d.innerHTML = `<div class="bubble">${media}<span>${t||''}</span><div class="msg-meta"><small>${time}</small>${ticks}</div></div>`;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
}

// Поиск и диалоги
document.getElementById('search-btn').onclick = () => {
    const n = document.getElementById('user-search').value;
    socket.emit('search_user', n);
};
socket.on('user_found', u => openChat(u.username));
socket.on('new_msg', d => {
    if(d.from === activeChat || d.to === activeChat) render(d.from, d.text, d.file, d.fileName, d.time, d.id, d.is_read);
    socket.emit('get_my_dialogs', myNick);
});
socket.on('chat_history', ms => {
    const b = document.getElementById('messages'); b.innerHTML = '';
    ms.forEach(m => render(m.sender, m.content, m.file_data, m.file_name, m.time, m.is_read));
});
socket.on('dialogs_list', l => {
    const b = document.getElementById('dialogs'); b.innerHTML = '';
    l.forEach(d => {
        const el = document.createElement('div'); el.className = 'dialog-item';
        el.innerHTML = `<b>${d.partner}</b>`; el.onclick = () => openChat(d.partner);
        b.appendChild(el);
    });
});
