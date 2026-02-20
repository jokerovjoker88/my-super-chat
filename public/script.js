const socket = io();
let me = localStorage.getItem('nick') || prompt("Твой ник:");
if(!me) me = "User" + Math.floor(Math.random()*100);
localStorage.setItem('nick', me);
document.getElementById('me').innerText = me;

let curRoom = null;

// Загрузка комнат
const loadRooms = () => socket.emit('get_my_rooms', me);
loadRooms();

socket.on('rooms_list', rooms => {
    const list = document.getElementById('room-list');
    list.innerHTML = '';
    rooms.forEach(r => {
        const d = document.createElement('div');
        d.className = `room-item ${curRoom === r ? 'active' : ''}`;
        d.innerText = r;
        d.onclick = () => selectRoom(r);
        list.appendChild(d);
    });
});

function createRoomPrompt() {
    const r = prompt("Название чата:");
    if(r) socket.emit('create_room', { room: r, user: me });
}

function addUserPrompt() {
    const u = prompt("Ник того, кого добавить:");
    if(u) socket.emit('add_user_to_room', { room: curRoom, targetUser: u });
}

function selectRoom(r) {
    curRoom = r;
    document.getElementById('cur-room-name').innerText = r;
    document.getElementById('add-user-btn').style.display = 'block';
    document.getElementById('input-zone').style.display = 'flex';
    socket.emit('join_room', { room: r, user: me });
    loadRooms(); // Обновить активный статус в списке
    if(window.innerWidth < 768) toggleMenu();
}

socket.on('history', msgs => {
    const box = document.getElementById('msgs');
    box.innerHTML = '';
    msgs.forEach(addMsg);
});

socket.on('new_msg', m => { if(m.room === curRoom) addMsg(m); });

function addMsg(m) {
    const box = document.getElementById('msgs');
    const d = document.createElement('div');
    d.className = `msg ${m.username === me ? 'mine' : ''}`;
    d.innerHTML = `<small>${m.username}</small><br>${m.content}`;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
}

document.getElementById('s-btn').onclick = () => {
    const i = document.getElementById('m-input');
    if(i.value && curRoom) {
        socket.emit('send_msg', { user: me, text: i.value, room: curRoom });
        i.value = '';
    }
};

socket.on('check_invites', target => { if(target === me) loadRooms(); });

socket.on('room_update', () => loadRooms());

function toggleMenu() { document.getElementById('sidebar').classList.toggle('active'); }
