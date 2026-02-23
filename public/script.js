const socket = io();
let myNick = "";
let activeChat = null;

// Обработка Enter для отправки
document.getElementById('msg-input').onkeypress = (e) => {
    if (e.key === 'Enter') {
        sendMsg();
    }
};

async function sendMsg() {
    const inp = document.getElementById('msg-input');
    const fInp = document.getElementById('file-input');
    if ((inp.value.trim() || fInp.files[0]) && activeChat) {
        let fileData = null;
        if(fInp.files[0]) {
            fileData = await toBase64(fInp.files[0]);
        }
        socket.emit('send_msg', { 
            from: myNick, to: activeChat, 
            text: inp.value, file: fileData, 
            fileName: fInp.files[0]?.name 
        });
        inp.value = '';
        fInp.value = '';
    }
}

document.getElementById('send-btn').onclick = sendMsg;

// Остальная логика (авторизация, поиск, рендер) остается прежней...
// Добавь socket.on('auth_ok', 'auth_error', 'user_found' и т.д. из прошлого кода.
