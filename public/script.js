const socket = io();
let myNick = localStorage.getItem('nebula_user');

if (!myNick) {
    myNick = prompt("Ваш уникальный ник:");
    if (!myNick) myNick = 'User' + Math.random().toString(36).substr(2, 5);
    localStorage.setItem('nebula_user', myNick);
}

let activeChatId = null;

// Инициализация
socket.emit('login', myNick);

socket.on('login_success', () => {
    socket.emit('fetch_chats', myNick);
});

// Глобальные действия
const actions = {
    findAndStart: () => {
        const partner = prompt("Введите ник собеседника:");
        if (partner && partner !== myNick) {
            socket.emit('create_chat', { me: myNick, partner: partner.trim() });
        }
    },
    send: () => {
        const input = document.getElementById('m-input');
        if (input.value.trim() && activeChatId) {
            socket.emit('send_message', { 
                chatId: activeChatId, 
                sender: myNick, 
                text: input.value.trim() 
            });
            input.value = '';
        }
    }
};

// События сокетов
socket.on('update_chats', (chats) => {
    const list = document.getElementById('chat-list');
    list.innerHTML = '';
    chats.forEach(chat => {
        const el = document.createElement('div');
        el.className = `chat-item ${activeChatId === chat.chat_id ? 'active' : ''}`;
        el.innerHTML = `<div class="ava">${chat.partner[0].toUpperCase()}</div><span>${chat.partner}</span>`;
        el.onclick = () => selectChat(chat.chat_id, chat.partner);
        list.appendChild(el);
    });
});

function selectChat(id, name) {
    activeChatId = id;
    document.getElementById('chat-target').innerText = name;
    document.getElementById('welcome-screen').style.display = 'none';
    document.getElementById('chat-main').style.display = 'flex';
    socket.emit('open_chat', id);
    // Обновляем визуальное выделение
    socket.emit('fetch_chats', myNick);
}

socket.on('load_history', (msgs) => {
    const box = document.getElementById('msg-flow');
    box.innerHTML = '';
    msgs.forEach(m => renderMessage(m.sender, m.text));
});

socket.on('new_message', (m) => {
    if (m.chatId === activeChatId) {
        renderMessage(m.sender, m.text);
    }
});

socket.on('chat_created', () => {
    socket.emit('fetch_chats', myNick);
});

function renderMessage(sender, text) {
    const box = document.getElementById('msg-flow');
    const d = document.createElement('div');
    d.className = `message ${sender === myNick ? 'me' : 'them'}`;
    d.innerHTML = `<div class="bubble">${text}</div>`;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
}

// Утилиты
document.getElementById('m-input').onkeydown = (e) => { if(e.key === 'Enter') actions.send(); };
