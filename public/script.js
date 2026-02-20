const socket = io();
let nick = localStorage.getItem('chat_nick') || prompt("Твой ник:");
if (!nick) nick = "User" + Math.random().toString(36).substring(7);
localStorage.setItem('chat_nick', nick);
document.getElementById('my-nick').innerText = nick;

let activeRoom = null;

// Загрузка списка чатов
function loadRooms() {
    socket.emit('get_rooms', nick);
}
loadRooms();

socket.on('list_rooms', rooms => {
    const list = document.getElementById('room-list');
    list.innerHTML = '';
    rooms.forEach(r => {
        const d = document.createElement('div');
        d.className = `room ${activeRoom === r ? 'active' : ''}`;
        d.innerText = r;
        d.onclick = () => selectRoom(r);
        list.appendChild(d);
    });
});

function newChat() {
    const r = prompt("Название чата:");
    if (r) socket.emit('create_room', { room: r, nick: nick });
}

function invite() {
    const friend = prompt("Ник друга:");
    if (friend) socket.emit('add_friend', { room: activeRoom, friend: friend });
}

function selectRoom(r) {
    activeRoom = r;
    document.getElementById('chat-name').innerText = r;
    document.getElementById('add-u').style.display = 'block';
    document.getElementById('controls').style.display = 'flex';
    socket.emit('join_chat', { room: r });
    loadRooms();
    if (window.innerWidth < 768) menu();
}

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
    d.className = `m ${sender === nick ? 'me' : ''}`;
    d.innerHTML = `<small style="display:block;margin-bottom:3px;opacity:0.7">${sender}</small>${txt}`;
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

socket.on('update_ui', loadRooms);
socket.on('refresh_for', target => { if (target === nick) loadRooms(); });

function menu() { document.getElementById('side').classList.toggle('active'); }
