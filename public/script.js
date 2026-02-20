const socket = io();
let nick = localStorage.getItem('chat_nick') || prompt("Твой ник:");
if (!nick) nick = "User" + Math.floor(Math.random() * 1000);
localStorage.setItem('chat_nick', nick);
document.getElementById('my-nick').innerText = nick;

let activeRoom = null;

// Загрузка списка чатов пользователя
function loadRooms() {
    socket.emit('get_rooms', nick);
}
loadRooms();

// Получение списка и отрисовка
socket.on('list_rooms', rooms => {
    const list = document.getElementById('room-list');
    list.innerHTML = '';
    rooms.forEach(r => {
        const d = document.createElement('div');
        d.className = `room ${activeRoom === r ? 'active' : ''}`;
        d.innerHTML = `<i class="fa-solid fa-hashtag"></i> ${r}`;
        d.onclick = () => selectRoom(r);
        list.appendChild(d);
    });
});

// Функция: Вступить или Создать чат
function joinChatPrompt() {
    const r = prompt("Введите название чата (если чата нет, он будет создан):");
    if (r && r.trim().length > 0) {
        socket.emit('join_new_room', { room: r.trim(), nick: nick });
    }
}

// Пригласить друга
function invite() {
    const friend = prompt("Ник пользователя, которого хотите добавить в этот чат:");
    if (friend) socket.emit('add_friend', { room: activeRoom, friend: friend });
}

function selectRoom(r) {
    activeRoom = r;
    document.getElementById('chat-name').innerText = r;
    document.getElementById('add-u').style.display = 'block';
    document.getElementById('controls').style.display = 'flex';
    socket.emit('join_chat', { room: r });
    loadRooms(); // Обновляем выделение в списке
    if (window.innerWidth < 768) menu();
}

// Сообщения
socket.on('history', msgs => {
    const box = document.getElementById('chat-box');
    box.innerHTML = '';
    msgs.forEach(m => addMessage(m.sender, m.txt));
});

socket.on('new_msg', data => {
    if (data.room === activeRoom) addMessage(data.nick, data.txt);
});

function addMessage(sender, txt) {
    const box = document.getElementById('chat-box');
    const d = document.createElement('div');
    const isMe = sender === nick;
    d.className = `m ${isMe ? 'me' : ''}`;
    d.innerHTML = `<small>${sender}</small><span>${txt}</span>`;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
}

function send() {
    const i = document.getElementById('m-text');
    if (i.value.trim() && activeRoom) {
        socket.emit('msg', { nick, txt: i.value, room: activeRoom });
        i.value = '';
    }
}

function enter(e) { if (e.key === 'Enter') send(); }

socket.on('update_ui', (targetRoom) => {
    loadRooms();
    if(targetRoom) selectRoom(targetRoom);
});

socket.on('refresh_for', target => { if (target === nick) loadRooms(); });

function menu() { document.getElementById('side').classList.toggle('active'); }
