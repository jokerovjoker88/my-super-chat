const socket = io();
let myNick = "";
let activeChat = null;

// Переключение форм
document.getElementById('go-to-reg').onclick = () => {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('reg-form').style.display = 'flex';
};
document.getElementById('go-to-login').onclick = () => {
    document.getElementById('reg-form').style.display = 'none';
    document.getElementById('login-form').style.display = 'flex';
};

// Регистрация и Вход
document.getElementById('btn-do-reg').onclick = () => {
    const nick = document.getElementById('r-nick').value.trim();
    const email = document.getElementById('r-email').value.trim();
    const p1 = document.getElementById('r-pass').value;
    const p2 = document.getElementById('r-pass2').value;
    if(p1 !== p2) return alert("Пароли не совпадают");
    socket.emit('register', { nick, email, pass: p1 });
};

document.getElementById('btn-do-login').onclick = () => {
    const nick = document.getElementById('l-nick').value.trim();
    const pass = document.getElementById('l-pass').value;
    socket.emit('login', { nick, pass });
};

socket.on('auth_error', m => alert(m));
socket.on('auth_success', m => { alert(m); document.getElementById('go-to-login').click(); });
socket.on('auth_ok', d => {
    myNick = d.nick;
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'flex';
    document.getElementById('my-name').innerText = myNick;
    socket.emit('get_my_dialogs', myNick);
});

// ПОИСК И ДОБАВЛЕНИЕ ПО НИКУ
document.getElementById('search-btn').onclick = () => {
    const target = document.getElementById('user-search').value.trim();
    if(target) socket.emit('search_user', target);
};

socket.on('user_found', user => {
    // Если пользователь найден, открываем с ним чат
    openChat(user.username);
    document.getElementById('user-search').value = '';
    // И сразу обновляем список слева (хотя бы временно)
    renderDialogInList(user);
});

function openChat(name) {
    activeChat = name;
    document.getElementById('welcome').style.display = 'none';
    document.getElementById('chat-box').style.display = 'flex';
    document.getElementById('target-name').innerText = name;
    socket.emit('load_chat', { me: myNick, him: name });
}

function renderDialogInList(d) {
    const box = document.getElementById('dialogs');
    // Проверка, чтобы не дублировать в списке
    if ([...box.querySelectorAll('b')].some(b => b.innerText === d.username || b.innerText === d.partner)) return;

    const el = document.createElement('div');
    el.className = 'dialog-item';
    const name = d.username || d.partner;
    el.innerHTML = `<b>${name}</b> ${d.unread > 0 ? `<span class="badge">${d.unread}</span>` : ''}`;
    el.onclick = () => openChat(name);
    box.prepend(el);
}

// Рендер сообщений
function render(s, t, f, fn, time, id, isRead) {
    const box = document.getElementById('messages');
    const d = document.createElement('div');
    d.className = `msg-row ${s === myNick ? 'me' : 'them'}`;
    const ticks = s === myNick ? `<i class="fa-solid ${isRead ? 'fa-check-double':'fa-check'} status-tick"></i>` : '';
    let media = '';
    if(f) {
        if(f.includes('data:audio')) media = `<audio src="${f}" controls></audio>`;
        else if(f.includes('data:image')) media = `<img src="${f}">`;
        else media = `<a href="${f}" download="${fn}">📁 ${fn}</a>`;
    }
    d.innerHTML = `<div class="bubble">${media}<span>${t||''}</span><div class="msg-meta"><small>${time}</small>${ticks}</div></div>`;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
}

// События
document.getElementById('send-btn').onclick = () => {
    const inp = document.getElementById('msg-input');
    if(inp.value.trim() && activeChat) {
        socket.emit('send_msg', { from: myNick, to: activeChat, text: inp.value });
        inp.value = '';
    }
};

socket.on('new_msg', d => {
    if(d.from === activeChat || d.to === activeChat) render(d.from, d.text, d.file, d.fileName, d.time, d.id, d.is_read);
    socket.emit('get_my_dialogs', myNick);
});

socket.on('chat_history', ms => {
    const b = document.getElementById('messages'); b.innerHTML = '';
    ms.forEach(m => render(m.sender, m.content, m.file_data, m.file_name, m.time, m.id, m.is_read));
});

socket.on('dialogs_list', l => {
    document.getElementById('dialogs').innerHTML = '';
    l.forEach(d => renderDialogInList(d));
});

// ГOЛОСОВЫЕ (Коротко)
let mediaRecorder; let chunks = [];
document.getElementById('voice-btn').onclick = async () => {
    if (!mediaRecorder || mediaRecorder.state === "inactive") {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(s);
        chunks = [];
        mediaRecorder.ondataavailable = e => chunks.push(e.data);
        mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'audio/webm' });
            const r = new FileReader(); r.readAsDataURL(blob);
            r.onloadend = () => socket.emit('send_msg', { from: myNick, to: activeChat, text: '', file: r.result, fileName: 'v.webm' });
        };
        mediaRecorder.start(); document.getElementById('voice-btn').classList.add('recording');
    } else { mediaRecorder.stop(); document.getElementById('voice-btn').classList.remove('recording'); }
};
