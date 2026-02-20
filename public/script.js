const socket = io();
const vh = () => document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
window.addEventListener('resize', vh); vh();

let myName = localStorage.getItem('chat_name') || prompt("System ID:") || "Node_" + Math.floor(Math.random()*1000);
localStorage.setItem('chat_name', myName);

const messagesDiv = document.getElementById('messages');
const msgInput = document.getElementById('msg-input');

socket.emit('join', { username: myName });

// Виброотклик
const haptic = () => { if(window.navigator.vibrate) window.navigator.vibrate(10); };

function renderMessage(data) {
    const isMine = data.username === myName;
    const wrap = document.createElement('div');
    wrap.className = `message-wrapper ${isMine ? 'my-wrapper' : ''}`;
    wrap.setAttribute('data-id', data.id);

    const content = data.msg_type === 'file' 
        ? `<img src="${data.content}" style="max-width:100%; border-radius:15px; margin-top:5px;">`
        : `<span>${data.content}</span>`;

    wrap.innerHTML = `
        <div class="message ${isMine ? 'my-message' : 'other-message'}">
            <div style="font-size:0.6rem; opacity:0.6; margin-bottom:4px;">${data.username}</div>
            ${content}
            <div style="font-size:0.55rem; text-align:right; margin-top:4px; opacity:0.5;">${data.time || ''}</div>
        </div>
    `;
    
    messagesDiv.appendChild(wrap);
    messagesDiv.scrollTo({ top: messagesDiv.scrollHeight, behavior: 'smooth' });
}

socket.on('load history', h => { messagesDiv.innerHTML = ''; h.forEach(renderMessage); });
socket.on('chat message', data => { renderMessage(data); haptic(); });

document.getElementById('send-btn').onclick = () => {
    if(!msgInput.value.trim()) return;
    socket.emit('chat message', { user: myName, text: msgInput.value });
    msgInput.value = '';
    haptic();
};

function toggleMenu() { document.getElementById('sidebar').classList.toggle('active'); haptic(); }

// Индикатор печати
msgInput.oninput = () => socket.emit('typing', { user: myName });
socket.on('display typing', d => {
    const t = document.getElementById('typing-box');
    t.innerText = d.user + " is calculating...";
    setTimeout(() => t.innerText = '', 3000);
});

// Авто-высота textarea
msgInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});
