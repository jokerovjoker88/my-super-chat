const socket = io();
let me = "", target = "";

function doLogin() {
    socket.emit('login', { nick: document.getElementById('l-nick').value, pass: document.getElementById('l-pass').value });
}

socket.on('auth_ok', d => {
    me = d.nick;
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'flex';
    document.getElementById('my-name').innerText = me;
});

function search() {
    const val = document.getElementById('u-search').value;
    if(val) {
        target = val;
        document.getElementById('chat-win').style.display = 'flex';
        document.getElementById('chat-with').innerText = target;
        socket.emit('load_chat', { me, him: target });
    }
}

function send() {
    const input = document.getElementById('m-input');
    if(input.value.trim() && target) {
        socket.emit('send_msg', { from: me, to: target, content: input.value });
        input.value = '';
    }
}

socket.on('new_msg', d => {
    if(d.from === target || d.to === target) renderMsg(d);
});

socket.on('chat_history', h => {
    document.getElementById('messages').innerHTML = '';
    h.forEach(renderMsg);
});

function renderMsg(m) {
    const box = document.getElementById('messages');
    const div = document.createElement('div');
    div.className = `msg-bubble ${(m.from === me) ? 'me' : 'them'}`;
    div.innerHTML = `<span>${m.content}</span><small>${m.time || ''}</small>`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}
