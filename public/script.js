const socket = io();
let myNick = localStorage.getItem('tg_nick') || prompt("Ваш ник:");
if (!myNick) window.location.reload();
localStorage.setItem('tg_nick', myNick);

document.getElementById('my-name').innerText = myNick;

let activeChat = null;
let typingTimeout;
let replyId = null;
let editId = null;
const sound = document.getElementById('notif-sound');

// Авторизация
socket.emit('auth', myNick);
socket.on('auth_ok', d => { 
    if(d?.avatar) document.getElementById('my-ava').src = d.avatar; 
});

// Поиск пользователей
const search = () => {
    const n = document.getElementById('user-search').value.trim();
    if(n && n !== myNick) socket.emit('search_user', n);
};
document.getElementById('search-btn').onclick = search;
document.getElementById('user-search').onkeypress = (e) => { if(e.key === 'Enter') search(); };

socket.on('user_found', u => openChat(u.username));

// Открытие чата
function openChat(name) {
    activeChat = name;
    document.getElementById('welcome').style.display = 'none';
    document.getElementById('chat-box').style.display = 'flex';
    document.getElementById('target-name').innerText = name;
    cancelReply();
    
    if(window.innerWidth <= 600) {
        document.getElementById('sidebar').style.display = 'none';
    }
    
    socket.emit('load_chat', { me: myNick, him: name });
    socket.emit('get_my_dialogs', myNick);
}

// Статус "Печатает..."
document.getElementById('msg-input').oninput = () => {
    if(activeChat) socket.emit('typing', { to: activeChat, from: myNick });
};

socket.on('user_typing', ({ from }) => {
    if(from === activeChat) {
        const s = document.getElementById('target-status');
        s.innerText = 'печатает...';
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => s.innerText = '', 2000);
    }
});

// Получение нового сообщения
socket.on('new_msg', data => {
    if(data.from === activeChat || data.to === activeChat) {
        render(data.from, data.text, data.file, data.fileName, data.time, data.id, data.is_read, data.replyText);
        // Если сообщение от собеседника - помечаем как прочитанное
        if(data.from !== myNick) {
            socket.emit('load_chat', { me: myNick, him: activeChat });
        }
    } else {
        sound.play().catch(()=>{});
    }
    socket.emit('get_my_dialogs', myNick);
});

// Загрузка истории
socket.on('chat_history', msgs => {
    const b = document.getElementById('messages');
    b.innerHTML = '';
    msgs.forEach(m => render(m.sender, m.content, m.file_data, m.file_name, m.time, m.id, m.is_read, m.reply_text));
    b.scrollTop = b.scrollHeight;
});

// Рендер сообщения
function render(s, t, f, fn, time, id, isRead, replyText) {
    const box = document.getElementById('messages');
    if (!box) return;

    const d = document.createElement('div');
    d.className = `msg-row ${s === myNick ? 'me' : 'them'}`;
    d.id = `msg-${id}`;
    
    d.innerHTML = `
        <div class="bubble" onclick="showMenu(${id}, \`${t || ''}\`, '${s}')">
            ${replyText ? `<div class="reply-q">${replyText}</div>` : ''}
            ${f ? (f.startsWith('data:image') ? `<img src="${f}">` : `<a href="${f}" download="${fn}">📁 ${fn}</a>`) : ''}
            <span class="txt">${t || ''}</span>
            <div class="meta">
                ${time} 
                ${s === myNick ? `<i class="fa-solid fa-check${isRead ? '-double' : ''} tick"></i>` : ''}
            </div>
        </div>`;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
}

// Меню действий
function showMenu(id, txt, s) {
    const act = prompt("1-Ответить, 2-Уда
