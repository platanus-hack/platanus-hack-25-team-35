const form = document.getElementById('input-form');
const input = document.getElementById('user-input');
const log = document.getElementById('message-log');

function addMessage(text, isAgent = false) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${isAgent ? 'agent-message' : 'user-message'}`;

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = isAgent ? 'AI' : 'YOU';

    const content = document.createElement('div');
    content.className = 'content';
    content.textContent = text;

    msgDiv.appendChild(avatar);
    msgDiv.appendChild(content);
    log.appendChild(msgDiv);

    // Scroll to bottom
    log.scrollTop = log.scrollHeight;
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = input.value.trim();

    if (!data) return;

    // Add user message
    addMessage(data, false);
    input.value = '';

    // Show loading state (optional, could add a typing indicator)

    try {
        const response = await fetch('/api/input', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ data })
        });

        const result = await response.json();

        if (result.success) {
            addMessage(result.message, true);
        } else {
            addMessage("Error: Agent failed to process data.", true);
        }
    } catch (error) {
        console.error('Error:', error);
        addMessage("Connection Error: Uplink failed.", true);
    }
});
