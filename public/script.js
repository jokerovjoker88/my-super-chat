const socket = io();
let myNick = localStorage.getItem('tg_nick') || prompt("Ник:");
localStorage.setItem('tg_nick', myNick);
document.getElementById('my-name').innerText = myNick;

let activeChat = null;
let typingTimeout;

socket.emit('auth', myNick);
socket.on('auth_ok', () => socket.emit('get_my_dialogs', myNick));

// Поиск
document.getElementById('user-search').onkeypress = (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
        socket.emit('search_user', e.target.value.trim());
        e.target.value = '';
    }
};

socket.on('user_found', name => openChat(name));

// Обновление списка чатов
socket.on('dialogs_list', list => {
    const box = document.getElementById('dialogs');
    box.innerHTML = '';
    list.forEach(d => {
        const el = document.createElement('div');
        el.className = `dialog-item ${activeChat === d.partner ? 'active' : ''}`;
        el.innerHTML = `<div class="ava">${d.partner[0].toUpperCase()}</div> 
                        <div class="d-info"><b>${d.partner}</b><div id="status-${d.partner}" class="typing-status"></div></div>`;
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

// Печатает...
document.getElementById('msg-input').oninput = () => {
    if(activeChat) socket.emit('typing', { from: myNick, to: activeChat });
};

socket.on('is_typing', data => {
    const status = document.getElementById(`status-${data.from}`);
    if(status) {
        status.innerText = "печатает...";
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => { status.innerText = ""; }, 2000);
    }
});

// История и сообщения
socket.on('chat_history', msgs => {
    const box = document.getElementById('messages');
    box.innerHTML = '';
    msgs.forEach(m => render(m.sender, m.content, m.file_data, m.file_name, m.time));
    box.scrollTop = box.scrollHeight;
});

socket.on('new_msg', data => {
    if (data.from === activeChat || data.to === activeChat) {
        render(data.from, data.text, data.file, data.fileName, data.time);
    }
    socket.emit('get_my_dialogs', myNick);
});

socket.on('refresh_dialogs', () => socket.emit('get_my_dialogs', myNick));

async function send() {
    const inp = document.getElementById('msg-input');
    const fInp = document.getElementById('file-input');
    if ((inp.value.trim() || fInp.files[0]) && activeChat) {
        let fData = fInp.files[0] ? await toBase64(fInp.files[0]) : null;
        socket.emit('send_msg', { from: myNick, to: activeChat, text: inp.value, file: fData, fileName: fInp.files[0]?.name });
        inp.value = ''; fInp.value = '';
    }
}

function render(s, t, f, fn, time) {
    const box = document.getElementById('messages');
    const d = document.createElement('div');
    d.className = `msg-row ${s === myNick ? 'me' : 'them'}`;
    let html = `<div class="bubble">`;
    if (f) {
        if (f.startsWith('data:image')) html += `<img src="${f}" style="width:100%; border-radius:8px;">`;
        else html += `<a href="${f}" download="${fn}" class="file">📁 ${fn}</a>`;
    }
    html += `<span>${t}</span><small class="time">${time}</small></div>`;
    d.innerHTML = html;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
}

const toBase64 = f => new Promise((res) => {
    const r = new FileReader(); r.readAsDataURL(f); r.onload = () => res(r.result);
});

document.getElementById('send-btn').onclick = send;
document.getElementById('msg-input').onkeypress = e => { if(e.key === 'Enter') send(); };
