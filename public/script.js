const socket = io();
let myNick = "";
let activeChat = null;

// Переключение форм
document.getElementById('go-to-reg').onclick = () => { document.getElementById('login-form').style.display = 'none'; document.getElementById('reg-form').style.display = 'flex'; };
document.getElementById('go-to-login').onclick = () => { document.getElementById('reg-form').style.display = 'none'; document.getElementById('login-form').style.display = 'flex'; };

// Авторизация
document.getElementById('btn-do-reg').onclick = () => {
    const nick = document.getElementById('r-nick').value.trim();
    const email = document.getElementById('r-email').value.trim();
    const p1 = document.getElementById('r-pass').value;
    const p2 = document.getElementById('r-pass2').value;
    if(p1 !== p2) return alert("Пароли не совпадают!");
    socket.emit('register', { nick, email, pass: p1 });
};
document.getElementById('btn-do-login').onclick = () => {
    socket.emit('login', { nick: document.getElementById('l-nick').value.trim(), pass: document.getElementById('l-pass').value });
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

// Отправка (Enter + Кнопка)
const send = () => {
    const inp = document.getElementById('msg-input');
    if(inp.value.trim() && activeChat) {
        socket.emit('send_msg', { from: myNick, to: activeChat, text: inp.value });
        inp.value = '';
    }
};
document.getElementById('msg-input').onkeydown = (e) => { if(e.key === 'Enter') send(); };
document.getElementById('send-btn').onclick = send;

// Поиск
document.getElementById('search-btn').onclick = () => {
    const t = document.getElementById('user-search').value.trim();
    if(t) socket.emit('search_user', t);
};
socket.on('user_found', u => openChat(u.username));

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
    const ticks = s === myNick ? `<i class="fa-solid ${isRead ? 'fa-check-double':'fa-check'} status-tick"></i>` : '';
    let media = f ? `<img src="${f}" style="max-width:100%">` : '';
    d.innerHTML = `<div class="bubble">${media}<span>${t||''}</span><div class="msg-meta"><small>${time}</small>${ticks}</div></div>`;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
}

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
