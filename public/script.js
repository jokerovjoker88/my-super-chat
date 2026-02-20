const socket = io();

// Получаем или создаем ник
let myNick = localStorage.getItem('chat_nick');
if (!myNick) {
    myNick = prompt("Введите ваш ник:");
    if (!myNick) myNick = 'User' + Math.floor(Math.random() * 1000);
    localStorage.setItem('chat_nick', myNick);
}
document.getElementById('my-nick').innerText = myNick;

let currentRoom = null;

// Статус базы данных
socket.on('server_status', st => { document.getElementById('db-status').innerText = st; });

// Грузим чаты при старте
socket.emit('load_rooms', myNick);

// Действие 1: Нажатие на "Создать/Найти"
function createOrJoin() {
    const r = prompt("Название чата (любое слово):");
    if (r && r.trim()) {
        socket.emit('join_room', { room: r.trim(), nick: myNick });
    }
}

// Действие 2: Пригласить
function inviteFriend() {
    const f = prompt("Кого добавить? Введите ник:");
    if (f && currentRoom) {
        socket.emit('invite', { room: currentRoom, target: f.trim() });
        alert("Запрос отправлен пользователю " + f);
    }
}

// Действие 3: Отправка сообщения
function sendMessage() {
    const inp = document.getElementById('msg-input');
    if (inp.value.trim() && currentRoom) {
        socket.emit('send_msg', { room: currentRoom, sender: myNick, text: inp.value.trim() });
        inp.value = '';
    }
}

// Рендер списка чатов
socket.on('rooms_list', list => {
    const box = document.getElementById('room-list');
    box.innerHTML = '';
    list.forEach(room => {
        const d = document.createElement('div');
        d.className = `room-item ${currentRoom === room ? 'active' : ''}`;
        d.innerHTML = `<i class="fa-solid fa-hashtag"></i> ${room}`;
        d.onclick = () => socket.emit('join_room', { room: room, nick: myNick });
        box.appendChild(d);
    });
});

// Когда сервер подтвердил вход в чат
socket.on('room_joined', data => {
    currentRoom = data.room;
    document.getElementById('chat-title').innerText = currentRoom;
    document.getElementById('chat-controls').style.display = 'flex';
    document.getElementById('add-btn').style.display = 'block';
    
    const box = document.getElementById('chat-box');
    box.innerHTML = '';
    data.history.forEach(m => renderMsg(m.sender, m.msg_text));
    
    if (window.innerWidth < 768) toggleMenu();
});

// Получение нового сообщения
socket.on('new_msg', data => {
    if (data.room === currentRoom) renderMsg(data.sender, data.text);
});

// Если нас кто-то добавил
socket.on('invited', target => {
    if (target === myNick) socket.emit('load_rooms', myNick);
});

// Отрисовка сообщения на экране
function renderMsg(sender, text) {
    const box = document.getElementById('chat-box');
    const d = document.createElement('div');
    d.className = `msg ${sender === myNick ? 'me' : ''}`;
    d.innerHTML = `<b>${sender}</b><p>${text}</p>`;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
}

// Энтер для отправки
document.getElementById('msg-input').onkeydown = e => { if (e.key === 'Enter') sendMessage(); };
function toggleMenu() { document.getElementById('sidebar').classList.toggle('active'); }
