const socket = io();
let myNick = localStorage.getItem('tg_nick');

if (!myNick) {
    myNick = prompt("Введите ваш ник (латиницей):");
    if (myNick) localStorage.setItem('tg_nick', myNick);
    else window.location.reload();
}

document.getElementById('my-name').innerText = myNick;
let activeChat = null;
const sound = document.getElementById('notif-sound');

socket.emit('auth', myNick);

socket.on('auth_ok', d => {
    if(d && d.avatar) document.getElementById('my-ava').src = d.avatar;
    socket.emit('get_my_dialogs', myNick);
});

// Аватарка
document.getElementById('ava-input').onchange = async e => {
    if(!e.target.files[0]) return;
    const base64 = await toBase64(e.target.files[0]);
    socket.emit('update_avatar', base64);
    document.getElementById('my-ava').src = base64;
};

// Список чатов
socket.on('dialogs_list', list => {
    const box = document.getElementById('dialogs');
    box.innerHTML = '';
    list.forEach(d => {
        const el = document.createElement('div');
        el.className = `dialog-item ${activeChat === d.partner ? 'active' : ''}`;
        const ava = d.avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
        el.innerHTML = `
            <div class="ava-wrap ${d.is_online ? 'on' : ''}"><img src="${ava}"></div>
            <div class="d-info">
                <b>${d.partner}</b>
                ${d.unread > 0 ? `<span class="badge">${d.unread}</span>` : ''}
            </div>`;
        el.onclick = () => {
            activeChat = d.partner;
            document.getElementById('welcome').style.display = 'none';
            document.getElementById('chat-box').style.display = 'flex';
            document.getElementById('target-name').innerText = d.partner;
            if(window.innerWidth <= 600) document.getElementById('sidebar').style.display = 'none';
            socket.emit('load_chat', { me: myNick, him: d.partner });
            socket.emit('get_my_dialogs', myNick);
        };
        box.appendChild(el);
    });
});

socket.on('new_msg', data => {
    if (data.from === activeChat || data.to === activeChat) {
        render(data.from, data.text, data.file, data.fileName, data.time);
    } else if (data.from !== myNick) {
        if(sound) sound.play().catch(()=>{});
    }
    socket.emit('get_my_dialogs', myNick);
});

socket.on('chat_history', msgs => {
    const box = document.getElementById('messages');
    box.innerHTML = '';
    msgs.forEach(m => render(m.sender, m.content, m.file_data, m.file_name, m.time));
    box.scrollTop = box.scrollHeight;
});

socket.on('refresh_chats', () => socket.emit('get_my_dialogs', myNick));
socket.on('status_update', () => socket.emit('get_my_dialogs', myNick));

async function send() {
    const inp = document.getElementById('msg-input');
    const fInp = document.getElementById('file-input');
    if ((inp.value.trim() || fInp.files[0]) && activeChat) {
        let f = fInp.files[0] ? await toBase64(fInp.files[0]) : null;
        socket.emit('send_msg', { from: myNick, to: activeChat, text: inp.value, file: f, fileName: fInp.files[0]?.name });
        inp.value = ''; fInp.value = '';
    }
}

function render(s, t, f, fn, time) {
    const box = document.getElementById('messages');
    const d = document.createElement('div');
    d.className = `msg-row ${s === myNick ? 'me' : 'them'}`;
    d.innerHTML = `<div class="bubble">
        ${f ? (f.startsWith('data:image') ? `<img src="${f}" style="max-width:100%;border-radius:8px;">` : `<a href="${f}" download="${fn}">📁 ${fn}</a>`) : ''}
        <span>${t || ''}</span><small style="display:block;font-size:0.6rem;opacity:0.5;text-align:right;">${time || ''}</small>
    </div>`;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
}

const toBase64 = f => new Promise(res => {
    const r = new FileReader(); r.readAsDataURL(f); r.onload = () => res(r.result);
});

document.getElementById('send-btn').onclick = send;
document.getElementById('msg-input').onkeypress = e => { if(e.key==='Enter') send(); };
document.getElementById('back-btn').onclick = () => {
    document.getElementById('sidebar').style.display = 'flex';
    document.getElementById('chat-box').style.display = 'none';
    activeChat = null;
};
