const socket = io();
let myNick = localStorage.getItem('nick') || prompt("Твой ник:");
if(!myNick) myNick = 'User' + Math.floor(Math.random()*100);
localStorage.setItem('nick', myNick);

let activeChat = null;

const app = {
    init: () => {
        socket.emit('auth', myNick);
        socket.on('auth_ok', () => socket.emit('get_my_chats', myNick));
    },
    findUser: () => {
        const p = document.getElementById('find-user').value.trim();
        if(p && p !== myNick) {
            socket.emit('start_chat', { me: myNick, partner: p });
            document.getElementById('find-user').value = '';
        }
    },
    send: () => {
        const inp = document.getElementById('m-input');
        if(inp.value.trim() && activeChat) {
            socket.emit('msg', { chatId: activeChat, sender: myNick, text: inp.value });
            inp.value = '';
        }
    }
};

socket.on('chats_list', list => {
    const box = document.getElementById('chat-list');
    box.innerHTML = '';
    list.forEach(c => {
        const d = document.createElement('div');
        d.className = 'chat-item';
        d.innerHTML = `<div class="avatar">${c.partner[0].toUpperCase()}</div> <b>${c.partner}</b>`;
        d.onclick = () => {
            activeChat = c.chat_id;
            document.getElementById('chat-header').innerText = c.partner;
            document.getElementById('input-zone').style.display = 'flex';
            socket.emit('join_chat', c.chat_id);
        };
        box.appendChild(d);
    });
});

socket.on('chat_ready', id => {
    socket.emit('get_my_chats', myNick);
});

socket.on('history', msgs => {
    const box = document.getElementById('messages');
    box.innerHTML = '';
    msgs.forEach(m => render(m.sender, m.text));
});

socket.on('new_msg', m => {
    if(m.chatId === activeChat) render(m.sender, m.text);
    else socket.emit('get_my_chats', myNick); // Обновить список, чтобы поднять чат
});

function render(s, t) {
    const box = document.getElementById('messages');
    const d = document.createElement('div');
    d.className = `msg ${s === myNick ? 'me' : ''}`;
    d.innerHTML = `<p>${t}</p>`;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
}

app.init();
