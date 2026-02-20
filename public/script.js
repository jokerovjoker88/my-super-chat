const socket = io();
let myNick = localStorage.getItem('chat_nick');

if (!myNick || myNick === 'null') {
    myNick = prompt("Введите ваш Ник для чата:");
    if (!myNick) myNick = 'User' + Math.floor(Math.random() * 1000);
    localStorage.setItem('chat_nick', myNick);
}
document.getElementById('display-nick').innerText = myNick;

let currentRoom = null;

// Функции управления
const actions = {
    join: () => {
        const name = prompt("Название чата (существующий или новый):");
        if (name) socket.emit('join_room', { room: name.trim(), nick: myNick });
    },
    invite: () => {
        const target = prompt("Кому дать доступ? Введите ник:");
        if (target && currentRoom) socket.emit('add_user', { room: currentRoom, targetNick: target.trim() });
    },
    send: () => {
        const input = document.getElementById('msg-input');
        if (input.value.trim() && currentRoom) {
            socket.emit('send_msg', { room: currentRoom, sender: myNick, text: input.value });
            input.value = '';
        }
    }
};

// Сокет-события
socket.emit('get_my_rooms', myNick);

socket.on('rooms_list', list => {
    const container = document.getElementById('room-list');
    container.innerHTML = '';
    list.forEach(name => {
        const div = document.createElement('div');
        div.className = `room-link ${currentRoom === name ? 'active' : ''}`;
        div.innerHTML = `<i class="fa-solid fa-hashtag"></i> ${name}`;
        div.onclick = () => {
            currentRoom = name;
            document.getElementById('chat-title').innerText = name;
            document.getElementById('add-btn').style.display = 'block';
            document.getElementById('input-pane').style.display = 'flex';
            socket.emit('join_room', { room: name, nick: myNick });
        };
        container.appendChild(div);
    });
});

socket.on('history', data => {
    const box = document.getElementById('chat-box');
    box.innerHTML = '';
    data.forEach(m => renderMessage(m.sender, m.text));
});

socket.on('new_msg', m => {
    if (m.room === currentRoom) renderMessage(m.sender, m.text);
});

socket.on('ping_update', target => {
    if (target === myNick) socket.emit('get_my_rooms', myNick);
});

function renderMessage(s, t) {
    const box = document.getElementById('chat-box');
    const d = document.createElement('div');
    d.className = `msg-row ${s === myNick ? 'me' : ''}`;
    d.innerHTML = `<div class="msg-bubble"><b>${s}</b><p>${t}</p></div>`;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
}

document.getElementById('msg-input').onkeydown = (e) => { if(e.key === 'Enter') actions.send(); };
