const socket = io();
let myNick = localStorage.getItem('tg_nick') || prompt("Ваш ник:");
localStorage.setItem('tg_nick', myNick);
document.getElementById('my-name').innerText = myNick;

let activeChat = null;
let typingTimeout;
const sound = document.getElementById('notif-sound');

socket.emit('auth', myNick);
socket.on('auth_ok', d => { if(d?.avatar) document.getElementById('my-ava').src = d.avatar; });

// Поиск
const search = () => {
    const n = document.getElementById('user-search').value.trim();
    if(n && n !== myNick) socket.emit('search_user', n);
};
document.getElementById('search-btn').onclick = search;
socket.on('user_found', u => openChat(u.username));

function openChat(name) {
    activeChat = name;
    document.getElementById('welcome').style.display = 'none';
    document.getElementById('chat-box').style.display = 'flex';
    document.getElementById('target-name').innerText = name;
    if(window.innerWidth <= 600) document.getElementById('sidebar').style.display = 'none';
    socket.emit('load_chat', { me: myNick, him: name });
}

// Печатает...
document.getElementById('msg-input').oninput = () => {
    socket.emit('typing', { to: activeChat, from: myNick });
};
socket.on('user_typing', ({ from }) => {
    if(from === activeChat) {
        const s = document.getElementById('target-status');
        s.innerText = 'печатает...';
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => s.innerText = '', 2000);
    }
});

socket.on('new_msg', data => {
    if(data.from === activeChat || data.to === activeChat) render(data.sender || data.from, data.text, data.file, data.fileName, data.time, data.id);
    else if(data.from !== myNick) sound.play().catch(()=>{});
    socket.emit('get_my_dialogs', myNick);
});

socket.on('chat_history', msgs => {
    const b = document.getElementById('messages'); b.innerHTML = '';
    msgs.forEach(m => render(m.sender, m.content, m.file_data, m.file_name, m.time, m.id));
    b.scrollTop = b.scrollHeight;
});

async function send() {
    const i = document.getElementById('msg-input'), fI = document.getElementById('file-input');
    if((i.value.trim() || fI.files[0]) && activeChat) {
        let f = fI.files[0] ? await toBase64(fI.files[0]) : null;
        socket.emit('send_msg', { from: myNick, to: activeChat, text: i.value, file: f, fileName: fI.files[0]?.name });
        i.value = ''; fI.value = '';
    }
}

function render(s, t, f, fn, time, id) {
    const box = document.getElementById('messages');
    const d = document.createElement('div');
    d.className = `msg-row ${s === myNick ? 'me' : 'them'}`;
    d.id = `msg-${id}`;
    d.innerHTML = `<div class="bubble" onclick="${s === myNick ? `confirmDelete(${id})` : ''}">
        ${f ? (f.startsWith('data:image') ? `<img src="${f}">` : `<a href="${f}" download="${fn}">📁 ${fn}</a>`) : ''}
        <span>${t || ''}</span><small>${time}</small>
    </div>`;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
}

function confirmDelete(id) {
    if(confirm("Удалить это сообщение?")) socket.emit('delete_msg', { id, from: myNick, to: activeChat });
}
socket.on('msg_deleted', ({ id }) => document.getElementById(`msg-${id}`)?.remove());

const toBase64 = f => new Promise(res => {
    const r = new FileReader(); r.readAsDataURL(f); r.onload = () => res(r.result);
});

document.getElementById('send-btn').onclick = send;
document.getElementById('back-btn').onclick = () => {
    document.getElementById('sidebar').style.display = 'flex';
    document.getElementById('chat-box').style.display = 'none';
};
socket.on('dialogs_list', list => {
    const b = document.getElementById('dialogs'); b.innerHTML = '';
    list.forEach(d => {
        const el = document.createElement('div');
        el.className = `dialog-item ${activeChat === d.partner ? 'active' : ''}`;
        el.innerHTML = `<div class="ava-wrap ${d.is_online?'on':''}"><img src="${d.avatar||'https://cdn-icons-png.flaticon.com/512/149/149071.png'}"></div>
            <div class="d-info"><b>${d.partner}</b>${d.unread > 0 ? `<span class="badge">${d.unread}</span>` : ''}</div>`;
        el.onclick = () => openChat(d.partner);
        b.appendChild(el);
    });
});
socket.on('status_update', () => socket.emit('get_my_dialogs', myNick));
