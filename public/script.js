const socket = io();
let myNick = "";
let activeChat = null;
let typingTimer;

// Переключение форм авторизации
document.getElementById('go-to-reg').onclick = () => {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('reg-form').style.display = 'flex';
};
document.getElementById('go-to-login').onclick = () => {
    document.getElementById('reg-form').style.display = 'none';
    document.getElementById('login-form').style.display = 'flex';
};

// Регистрация
document.getElementById('btn-do-reg').onclick = () => {
    const nick = document.getElementById('r-nick').value.trim();
    const email = document.getElementById('r-email').value.trim();
    const p1 = document.getElementById('r-pass').value;
    const p2 = document.getElementById('r-pass2').value;
    const msg = document.getElementById('r-msg');

    if(!nick || !email || !p1) return msg.innerText = "Заполните все поля";
    if(p1 !== p2) return msg.innerText = "Пароли не совпадают";
    
    socket.emit('register', { nick, email, pass: p1 });
};

// Вход
document.getElementById('btn-do-login').onclick = () => {
    const nick = document.getElementById('l-nick').value.trim();
    const pass = document.getElementById('l-pass').value;
    socket.emit('login', { nick, pass });
};

socket.on('auth_error', m => { alert(m); });
socket.on('auth_success', m => { alert(m); document.getElementById('go-to-login').click(); });

socket.on('auth_ok', data => {
    myNick = data.nick;
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'flex';
    document.getElementById('my-name').innerText = myNick;
    if(data.avatar) document.getElementById('my-ava').src = data.avatar;
    socket.emit('get_my_dialogs', myNick);
});

// ГОЛОСОВЫЕ СООБЩЕНИЯ
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
            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = () => {
                    socket.emit('send_msg', { from: myNick, to: activeChat, text: '', file: reader.result, fileName: 'voice.webm' });
                };
            };
            mediaRecorder.start();
            voiceBtn.classList.add('recording');
        } catch(e) { alert("Нет доступа к микрофону"); }
    } else {
        mediaRecorder.stop();
        voiceBtn.classList.remove('recording');
    }
};

// ЧАТ И СООБЩЕНИЯ
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

    let mediaHTML = '';
    if(f) {
        if(f.includes('data:audio')) mediaHTML = `<audio src="${f}" controls></audio>`;
        else if(f.includes('data:image')) mediaHTML = `<img src="${f}">`;
        else mediaHTML = `<a href="${f}" download="${fn}">📁 ${fn}</a>`;
    }

    d.innerHTML = `<div class="bubble">${mediaHTML}<span>${t||''}</span><div class="msg-meta"><small>${time}</small>${ticks}</div></div>`;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
}

document.getElementById('send-btn').onclick = async () => {
    const inp = document.getElementById('msg-input');
    if(inp.value.trim() && activeChat) {
        socket.emit('send_msg', { from: myNick, to: activeChat, text: inp.value });
        inp.value = '';
    }
};

document.getElementById('search-btn').onclick = () => {
    const nick = document.getElementById('user-search').value;
    socket.emit('search_user', nick);
};

socket.on('user_found', u => openChat(u.username));
socket.on('new_msg', d => {
    if(d.from === activeChat || d.to === activeChat) render(d.from, d.text, d.file, d.fileName, d.time, d.id, d.is_read);
    socket.emit('get_my_dialogs', myNick);
});
socket.on('chat_history', ms => {
    const b = document.getElementById('messages'); b.innerHTML = '';
    ms.forEach(m => render(m.sender, m.content, m.file_data, m.file_name, m.time, m.id, m.is_read));
});
socket.on('dialogs_list', l => {
    const b = document.getElementById('dialogs'); b.innerHTML = '';
    l.forEach(d => {
        const el = document.createElement('div'); el.className = 'dialog-item';
        el.innerHTML = `<b>${d.partner}</b> ${d.unread > 0 ? `<span class="badge">${d.unread}</span>` : ''}`;
        el.onclick = () => openChat(d.partner);
        b.appendChild(el);
    });
});
