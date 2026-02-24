const socket = io();
let me = "", target = "";

function doLogin() {
    const nick = document.getElementById('l-nick').value;
    const pass = document.getElementById('l-pass').value;
    if(nick && pass) socket.emit('login', { nick, pass });
}

socket.on('auth_ok', d => {
    me = d.nick;
    document.getElementById('auth-screen').style.opacity = '0';
    setTimeout(() => {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('main-app').style.display = 'flex';
    }, 300);
});

function search() {
    const val = document.getElementById('u-search').value.trim();
    if(val) {
        target = val;
        document.getElementById('no-chat').style.display = 'none';
        document.getElementById('chat-win').style.display = 'flex';
        document.getElementById('chat-with').innerText = target;
        socket.emit('load_chat', { me, him: target });
    }
}

function send() {
    const input = document.getElementById('m-input');
    const content = input.value.trim();
    if(content && target) {
        socket.emit('send_msg', { from: me, to: target, content });
        input.value = '';
        input.focus();
    }
}

socket.on('new_msg', d => {
    if(d.from === target || d.to === target) renderMsg(d);
});

socket.on('chat_history', h => {
    const box = document.getElementById('messages');
    box.innerHTML = '';
    h.forEach(renderMsg);
});

function renderMsg(m) {
    const box = document.getElementById('messages');
    const div = document.createElement('div');
    const isMe = (m.from === me);
    div.className = `msg-bubble ${isMe ? 'me' : 'them'}`;
    div.innerHTML = `${m.content}<small>${m.time || ''}</small>`;
    box.appendChild(div);
    box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
}
