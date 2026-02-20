const socket = io();
let myNick = localStorage.getItem('nebula_nick');

if (!myNick) {
    myNick = prompt("Ваш Ник:");
    if (!myNick) myNick = "Guest" + Math.floor(Math.random() * 100);
    localStorage.setItem('nebula_nick', myNick);
}
document.getElementById('display-nick').innerText = myNick;

let currentRoom = null;

// Функции
const actions = {
    join: () => {
        const name = prompt("Название чата (любое слово):");
        if (name && name.trim()) {
            console.log("Creating/Joining room:", name);
            socket.emit('enter_room', { room: name.trim(), nick: myNick });
        }
    },
    invite: () => {
        const target = prompt("Ник пользователя, которому дать доступ:");
        if (target && currentRoom) {
            socket.emit('invite_user', { room: currentRoom, target: target.trim() });
            alert("Пользователь " + target + " добавлен!");
        }
    },
    send: () => {
        const input = document.getElementById('msg-input');
        if (input.value.trim() && currentRoom) {
            socket.emit('send_msg', { room: currentRoom, sender: myNick, text: input.value });
            input.value = '';
        }
    }
};

// Сокеты
socket.emit('req_rooms', myNick);

socket.on('res_rooms', list => {
    const box = document.getElementById('room-list');
    box.innerHTML = '';
    list.forEach(r => {
        const div = document.createElement('div');
        div.className = `room-link ${currentRoom === r ? 'active' : ''}`;
        div.innerHTML = `<i class="fa-solid fa-hashtag"></i> ${r}`;
        div.onclick = () => {
            currentRoom = r;
            document.getElementById('chat-title').innerText = r;
            document.getElementById('add-btn').style.display = 'block';
            document.getElementById('input-pane').style.display = 'flex';
            socket.emit('enter_room', { room: r, nick: myNick });
        };
        box.appendChild(div);
    });
});

socket.on('res_history', data => {
    const box = document.getElementById('chat-box');
    box.innerHTML = '';
    data.forEach(m => render(m.sender, m.content));
});

socket.on('new_msg', m => {
    if (m.room === currentRoom) render(m.sender, m.text);
});

socket.on('trigger_refresh', target => {
    if (target === myNick) socket.emit('req_rooms', myNick);
});

function render(s, t) {
    const box = document.getElementById('chat-box');
    const d = document.createElement('div');
    d.className = `msg-row ${s === myNick ? 'me' : ''}`;
    d.innerHTML = `<div class="msg-bubble"><b>${s}</b><p>${t}</p></div>`;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
}

document.getElementById('msg-input').onkeydown = (e) => { if(e.key === 'Enter') actions.send(); };
