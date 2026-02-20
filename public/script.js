const socket = io();
let myNick = localStorage.getItem('tg_nick') || prompt("Ваш ник:");
if (myNick) localStorage.setItem('tg_nick', myNick);
document.getElementById('my-name').innerText = myNick;

let activeChat = null;

socket.emit('auth', myNick);
socket.on('auth_ok', () => socket.emit('get_my_dialogs', myNick));

// Поиск
document.getElementById('user-search').onkeypress = (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
        socket.emit('search_user', e.target.value.trim());
        e.target.value = '';
    }
};

socket.on('user_found', (name) => openChat(name));

// Список чатов
socket.on('dialogs_list', list => {
    const box = document.getElementById('dialogs');
    box.innerHTML = '';
    list.forEach(d => {
        const el = document.createElement('div');
        el.className = `dialog-item ${activeChat === d.partner ? 'active' : ''}`;
        el.innerHTML = `<div class="ava">${d.partner[0].toUpperCase()}</div> <span>${d.partner}</span>`;
        el.onclick = () => openChat(d.partner);
        box.appendChild(el);
    });
});

function openChat(name) {
    activeChat = name;
    document.getElementById('welcome').style.display = 'none';
    document.getElementById('chat-box').style.display = 'flex';
    document.getElementById('target-name').innerText = name;
    socket.emit('load_chat', { me: myNick, him: name });
    socket.emit('get_my_dialogs', myNick);
}

// Сообщения
socket.on('chat_history', msgs => {
    const box = document.getElementById('messages');
    box.innerHTML = '';
    msgs.forEach(m => render(m.sender, m.content, m.file_data, m.file_name));
});

socket.on('new_msg', data => {
    if (data.from === activeChat || data.to === activeChat) {
        render(data.from, data.text, data.file, data.fileName);
    }
    socket.emit('get_my_dialogs', myNick);
});

async function send() {
    const inp = document.getElementById('msg-input');
    const fInp = document.getElementById('file-input');
    const text = inp.value.trim();
    let fData = null, fName = null;

    if (fInp.files[0]) {
        fData = await toBase64(fInp.files[0]);
        fName = fInp.files[0].name;
    }

    if ((text || fData) && activeChat) {
        socket.emit('send_msg', { from: myNick, to: activeChat, text, file: fData, fileName: fName });
        inp.value = ''; fInp.value = '';
    }
}

function render(s, t, f, fn) {
    const box = document.getElementById('messages');
    const d = document.createElement('div');
    d.className = `msg-row ${s === myNick ? 'me' : 'them'}`;
    let html = `<div class="bubble">`;
    if (f) {
        if (f.startsWith('data:image')) html += `<img src="${f}" style="width:100%; border-radius:8px;">`;
        else html += `<a href="${f}" download="${fn}" style="color:#5085b1; display:block;">📁 ${fn}</a>`;
    }
    if (t) html += `<span>${t}</span>`;
    html += `</div>`;
    d.innerHTML = html;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
}

const toBase64 = file => new Promise((res, rej) => {
    const r = new FileReader(); r.readAsDataURL(file);
    r.onload = () => res(r.result); r.onerror = e => rej(e);
});

document.getElementById('send-btn').onclick = send;
document.getElementById('msg-input').onkeypress = e => { if(e.key === 'Enter') send(); };
