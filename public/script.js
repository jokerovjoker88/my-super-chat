const socket = io();
let myNick = localStorage.getItem('tg_nick') || prompt("Твой ник:");
localStorage.setItem('tg_nick', myNick);
document.getElementById('my-name').innerText = myNick;

let activeChat = null;
const sound = document.getElementById('notif-sound');

// Авторизация
socket.emit('auth', myNick);
socket.on('auth_ok', d => { 
    if(d && d.avatar) document.getElementById('my-ava').src = d.avatar; 
    socket.emit('get_my_dialogs', myNick);
});

// Смена аватарки
document.getElementById('ava-input').onchange = async e => {
    if(!e.target.files[0]) return;
    const base64 = await toBase64(e.target.files[0]);
    socket.emit('update_avatar', base64);
    document.getElementById('my-ava').src = base64;
};

// Поиск пользователя
const doSearch = () => {
    const val = document.getElementById('user-search').value.trim();
    if(val && val !== myNick) {
        socket.emit('search_user', val);
        document.getElementById('user-search').value = '';
        document.getElementById('user-search').blur();
    }
};
document.getElementById('search-btn').onclick = doSearch;
document.getElementById('user-search').onkeypress = e => { if(e.key==='Enter') doSearch(); };

socket.on('user_found', n => openChat(n));

// Открытие чата
function openChat(name) {
    activeChat = name;
    document.getElementById('welcome').style.display = 'none';
    document.getElementById('chat-box').style.display = 'flex';
    document.getElementById('target-name').innerText = name;
    
    if(window.innerWidth <= 600) {
        document.getElementById('sidebar').classList.add('hidden');
    }

    socket.emit('load_chat', { me: myNick, him: name });
    socket.emit('get_my_dialogs', myNick);
}

// Список диалогов (Online статус + Счётчик)
socket.on('dialogs_list', list => {
    const box = document.getElementById('dialogs');
    box.innerHTML = '';
    list.forEach(d => {
        const el = document.createElement('div');
        el.className = `dialog-item ${activeChat === d.partner ? 'active' : ''}`;
        const ava = d.avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
        
        el.innerHTML = `
            <div class="ava-wrap ${d.is_online ? 'on' : ''}">
                <img src="${ava}">
            </div>
            <div class="d-info">
                <b>${d.partner}</b>
                ${d.unread > 0 ? `<span class="badge">${d.unread}</span>` : ''}
            </div>`;
        el.onclick = () => openChat(d.partner);
        box.appendChild(el);
    });
});

// Получение нового сообщения
socket.on('new_msg', data => {
    if(data.from === activeChat || data.to === activeChat) {
        render(data.from, data.text, data.file, data.fileName, data.time);
        // Если сообщение входящее и мы в этом чате - помечаем как прочитанное
        if(data.from !== myNick) {
            socket.emit('load_chat', { me: myNick, him: activeChat });
        }
    } else if(data.from !== myNick) {
        if(sound) sound.play().catch(()=>{});
    }
    socket.emit('get_my_dialogs', myNick);
});

// Служебные обновления
socket.on('refresh_chats', () => socket.emit('get_my_dialogs', myNick));
socket.on('status_update', () => socket.emit('get_my_dialogs', myNick));

socket.on('chat_history', msgs => {
    const box = document.getElementById('messages');
    box.innerHTML = '';
    msgs.forEach(m => render(m.sender, m.content, m.file_data, m.file_name, m.time));
    box.scrollTop = box.scrollHeight;
});

// Отправка сообщения
async function send() {
    const inp = document.getElementById('msg-input');
    const fInp = document.getElementById('file-input');
    const text = inp.value.trim();
    
    if((text || fInp.files[0]) && activeChat) {
        let f = fInp.files[0] ? await toBase64(fInp.files[0]) : null;
        socket.emit('send_msg', { 
            from: myNick, 
            to: activeChat, 
            text: text, 
            file: f, 
            fileName: fInp.files[0]?.name 
        });
        inp.value = ''; 
        fInp.value = '';
    }
}

function render(s, t, f, fn, time) {
    const box = document.getElementById('messages');
    const d = document.createElement('div');
    d.className = `msg-row ${s === myNick ? 'me' : 'them'}`;
    d.innerHTML = `<div class="bubble">
        ${f ? (f.startsWith('data:image') ? `<img src="${f}" style="max-width:100%;border-radius:8px;">` : `<a href="${f}" download="${fn}">📁 ${fn}</a>`) : ''}
        <span>${t || ''}</span>
        <small style="display:block;font-size:0.6rem;opacity:0.5;text-align:right;margin-top:4px;">${time || ''}</small>
    </div>`;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
}

const toBase64 = f => new Promise(res => {
    const r = new FileReader(); 
    r.readAsDataURL(f); 
    r.onload = () =>
