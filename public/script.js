const socket = io();
let me = "", target = "";

function auth(type) {
    const nick = document.getElementById('nick').value.trim();
    const pass = document.getElementById('pass').value.trim();
    if(nick && pass) socket.emit(type, { nick, pass });
    else alert("Please fill all fields");
}

socket.on('reg_success', () => alert("Account created! Now you can Login."));
socket.on('error_msg', m => alert(m));

socket.on('auth_ok', d => {
    me = d.nick;
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'flex';
});

function search() {
    const val = document.getElementById('u-search').value.trim();
    if(val) {
        target = val;
        document.getElementById('welcome').style.display = 'none';
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
    const box = document.getElementById('messages');
    box.innerHTML = '';
    h.forEach(renderMsg);
});

function renderMsg(m) {
    const box = document.getElementById('messages');
    const div = document.createElement('div');
    const isMe = (m.from === me || m.sender === me);
    div.className = `msg ${isMe ? 'me' : 'them'}`;
    div.innerHTML = `${m.content} <span class="time">${m.time || ''}</span>`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}
