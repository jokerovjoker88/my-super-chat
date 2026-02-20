const socket = io();
let myNick = localStorage.getItem('nebula_nick');

if (!myNick) {
    myNick = prompt("Придумайте ваш ник:");
    if (!myNick) myNick = "User" + Math.floor(Math.random() * 100);
    localStorage.setItem('nebula_nick', myNick);
}

let activeContact = null;

// При запуске
socket.emit('auth', myNick);
socket.emit('get_contacts', myNick);

function startChat() {
    const p = prompt("Ник собеседника:");
    if (p && p !== myNick) {
        openChat(p.trim());
    }
}

function openChat(nick) {
    activeContact = nick;
    document.getElementById('chat-name').innerText = nick;
    document.getElementById('welcome').style.display = 'none';
    document.getElementById('chat-ui').style.display = 'flex';
    socket.emit('get_history', { me: myNick, him: nick });
    socket.emit('get_contacts', myNick);
}

function sendMsg() {
    const input = document.getElementById('inp');
    if (input.value.trim() && activeContact) {
        socket.emit('send', { from: myNick, to: activeContact, msg: input.value });
        input.value = '';
    }
}

socket.on('contacts_list', list => {
    const box = document.getElementById('list');
    box.innerHTML = '';
    list.forEach(nick => {
        const d = document.createElement('div');
        d.className = `item ${activeContact === nick ? 'active' : ''}`;
        d.innerText = nick;
        d.onclick = () => openChat(nick);
        box.appendChild(d);
    });
});

socket.on('history', msgs => {
    const box = document.getElementById('msgs');
    box.innerHTML = '';
    msgs.forEach(m => render(m.sender, m.txt));
});

socket.on('new_msg', data => {
    if (data.from === activeContact || data.to === activeContact) {
        render(data.from, data.msg);
    }
    socket.emit('get_contacts', myNick);
});

function render(s, t) {
    const box = document.getElementById('msgs');
    const d = document.createElement('div');
    d.className = `m ${s === myNick ? 'me' : 'he'}`;
    d.innerHTML = `<span>${t}</span>`;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
}

document.getElementById('inp').onkeydown = (e) => { if(e.key === 'Enter') sendMsg(); };
