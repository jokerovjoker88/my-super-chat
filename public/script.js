const socket = io();
let myNick = localStorage.getItem('nebula_nick') || prompt("Введите ваш Ник:");
if(!myNick) myNick = 'User_' + Math.floor(Math.random()*999);
localStorage.setItem('nebula_nick', myNick);
document.getElementById('my-id').innerText = myNick;

let activeRoom = null;

// Инициализация
const refreshRooms = () => socket.emit('fetch_rooms', myNick);
refreshRooms();

// Поиск / Создание
function joinPrompt() {
    const name = prompt("Название чата:");
    if(name) socket.emit('access_room', { room: name.trim(), nick: myNick });
}

// Приглашение
function inviteFriend() {
    const friend = prompt("Ник пользователя для добавления:");
    if(friend) socket.emit('invite_friend', { room: activeRoom, friend: friend.trim() });
}

// Вход в чат
function selectChat(name) {
    activeRoom = name;
    document.getElementById('current-title').innerText = name;
    document.getElementById('invite-icon').style.display = 'block';
    document.getElementById('footer').style.display = 'flex';
    socket.emit('join_session', { room: name });
    refreshRooms();
    if(window.innerWidth < 768) toggleMenu();
}

// Рендер сообщений
socket.on('chat_history', msgs => {
    const flow = document.getElementById('chat-flow');
    flow.innerHTML = '';
    msgs.forEach(m => render(m.sender, m.txt));
});

socket.on('broadcast_msg', m => {
    if(m.room === activeRoom) render(m.nick, m.txt);
});

function render(s, t) {
    const flow = document.getElementById('chat-flow');
    const d = document.createElement('div');
    const isMe = s === myNick;
    d.className = `msg-wrap ${isMe ? 'me' : ''}`;
    d.innerHTML = `<div class="msg"><b>${s}</b><p>${t}</p></div>`;
    flow.appendChild(d);
    flow.scrollTop = flow.scrollHeight;
}

// Отправка
function send() {
    const inp = document.getElementById('msg-input');
    if(inp.value.trim() && activeRoom) {
        socket.emit('push_msg', { nick: myNick, txt: inp.value, room: activeRoom });
        inp.value = '';
    }
}

// Служебные события
socket.on('rooms_update', rooms => {
    const list = document.getElementById('room-list');
    list.innerHTML = '';
    rooms.forEach(r => {
        const btn = document.createElement('div');
        btn.className = `room-btn ${activeRoom === r ? 'active' : ''}`;
        btn.innerHTML = `<i class="fa-solid fa-hashtag"></i> ${r}`;
        btn.onclick = () => selectChat(r);
        list.appendChild(btn);
    });
});

socket.on('access_granted', room => selectChat(room));
socket.on('notify_invite', target => { if(target === myNick) refreshRooms(); });

function toggleMenu() { document.getElementById('sidebar').classList.toggle('active'); }
