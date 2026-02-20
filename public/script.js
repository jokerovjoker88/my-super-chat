const socket = io();
let myNick = localStorage.getItem('tg_nick') || prompt("Ваш ник:");
if (myNick) localStorage.setItem('tg_nick', myNick);
else window.location.reload();

document.getElementById('my-name').innerText = myNick;
let activeChat = null;
const sound = document.getElementById('notif-sound');

socket.emit('auth', myNick);
socket.on('auth_ok', d => { if(d?.avatar) document.getElementById('my-ava').src = d.avatar; });

const search = () => {
    const nick = document.getElementById('user-search').value.trim();
    if(nick && nick !== myNick) socket.emit('search_user', nick);
};
document.getElementById('search-btn').onclick = search;
socket.on('user_found', user => openChat(user.username));

function openChat(name) {
    activeChat = name;
    document.getElementById('welcome').style.display = 'none';
    document.getElementById('chat-box').style.display = 'flex';
    document.getElementById('target-name').innerText = name;
    if(window.innerWidth <= 600) document.getElementById('sidebar').style.display = 'none';
    socket.emit('load_chat', { me: myNick, him: name });
}

socket.on('new_msg', data => {
    if(data.from === activeChat || data.to === activeChat) {
        render(data.from, data.text, data.file, data.fileName, data.time, data.id, data.is_read);
        if(data.from !== myNick && activeChat === data.from) {
            socket.emit('load_chat', { me: myNick, him: activeChat });
        }
    } else if(data.from !== myNick) {
        sound.play().catch(()=>{});
    }
    socket.emit('get_my_dialogs', myNick);
});

socket.on('chat_history', msgs => {
    const box = document.getElementById('messages');
    box.innerHTML = '';
    msgs.forEach(m => render(m.sender, m.content, m.file_data, m.file_name, m.time, m.id, m.is_read));
    box.scrollTop = box.scrollHeight;
});

socket.on('messages_read_by_partner', ({ partner }) => {
    if (activeChat === partner) {
        const ticks = document.querySelectorAll('.me .status-tick');
        ticks.forEach(t => {
            t.classList.remove('fa-check');
            t.classList.add('fa-check-double');
        });
    }
});

async function send() {
    const inp = document.getElementById('msg-input');
    const fInp = document.getElementById('file-input');
    if((inp.value.trim() || fInp.files[0]) && activeChat) {
        let f = fInp.files[0] ? await toBase64(fInp.files[0]) : null;
        socket.emit('send_msg', { from: myNick, to: activeChat, text: inp.value, file: f, fileName: fInp.files[0]?.name });
        inp.value = ''; fInp.value = '';
    }
}

function render(s, t, f, fn, time, id, isRead) {
    const box = document.getElementById('messages');
    const d = document.createElement('div');
    d.className = `msg-row ${s === myNick ? 'me' : 'them'}`;
    
    const tickClass = isRead ? 'fa-check-double' : 'fa-check';
    const ticks = s === myNick ? `<i class="fa-solid ${tickClass} status-tick"></i>` : '';

    d.innerHTML = `<div class="bubble">
        ${f ? (f.startsWith('data:image') ? `<img src="${f}" style="max-width:100%">` : `<a href="${f}" download="${fn}">📁 ${fn}</a>`) : ''}
        <span>${t || ''}</span>
        <div class="msg-meta">
            <small>${time || ''}</small>
            ${ticks}
        </div>
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
};

socket.on('dialogs_list', list => {
    const box = document.getElementById('dialogs');
    box.innerHTML = '';
    list.forEach(d => {
        const el = document.createElement('div');
        el.className = `dialog-item ${activeChat === d.partner ? 'active' : ''}`;
        el.innerHTML = `
            <div class="ava-wrap ${d.is_online?'on':''}"><img src="${d.avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}"></div>
            <div class="d-info"><b>${d.partner}</b>${d.unread > 0 ? `<span class="badge">${d.unread}</span>` : ''}</div>`;
        el.onclick = () => openChat(d.partner);
        box.appendChild(el);
    });
});

socket.on('status_update', () => socket.emit('get_my_dialogs', myNick));
