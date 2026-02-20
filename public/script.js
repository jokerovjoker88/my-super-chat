const socket = io();
let myNick = localStorage.getItem('tg_nick') || prompt("Ваш ник:");
if (myNick) localStorage.setItem('tg_nick', myNick);
document.getElementById('my-name').innerText = myNick;

let activeChat = null;

socket.emit('auth', myNick);
socket.on('auth_ok', () => socket.emit('get_my_dialogs', myNick));

// Поиск (исправлено для телефонов)
function doSearch() {
    const inp = document.getElementById('user-search');
    const val = inp.value.trim();
    if (val && val !== myNick) {
        socket.emit('search_user', val);
        inp.value = '';
        inp.blur();
    }
}
document.getElementById('search-btn').onclick = doSearch;
document.getElementById('user-search').onkeypress = (e) => { if(e.key === 'Enter') doSearch(); };

socket.on('user_found', name => openChat(name));

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
    
    // Для мобильных: скрываем сайдбар при открытии чата
    if (window.innerWidth <= 600) {
        document.getElementById('sidebar').classList.add('hidden');
    }

    socket.emit('load_chat', { me: myNick, him: name });
    socket.emit('get_my_dialogs', myNick);
}

// Кнопка назад (для мобильных)
document.getElementById('back-btn').onclick = () => {
    document.getElementById('sidebar').classList.remove('hidden');
    document.getElementById('chat-box').style.display = 'none';
    document.getElementById('welcome').style.display = 'flex';
};

// Сообщения
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
    d.innerHTML = `<div class="bubble">
        ${f ? (f.startsWith('data:image') ? `<img src="${f}" style="width:100%;border-radius:8px;">` : `<a href="${f}" download="${fn}">📁 ${fn}</a>`) : ''}
        <span>${t || ''}</span><small style="display:block;font-size:0.7rem;opacity:0.6;text-align:right;">${time || ''}</small>
    </div>`;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
}

const toBase64 = f => new Promise(res => {
    const r = new FileReader(); r.readAsDataURL(f); r.onload = () => res(r.result);
});

document.getElementById('send-btn').onclick = send;
document.getElementById('msg-input').onkeypress = e => { if(e.key === 'Enter') send(); };
