// Collaborative AI Features Module
class CollaborationModule {
    constructor() {
        this.sessions = {}; // In-memory, for demo; use database in production
        this.currentSession = null;
    }

    createSession(sessionId) {
        this.sessions[sessionId] = {
            id: sessionId,
            messages: [],
            participants: []
        };
        this.currentSession = sessionId;
        return this.sessions[sessionId];
    }

    joinSession(sessionId) {
        if (!this.sessions[sessionId]) {
            this.createSession(sessionId);
        }
        this.currentSession = sessionId;
        return this.sessions[sessionId];
    }

    addMessage(sessionId, user, message) {
        if (this.sessions[sessionId]) {
            this.sessions[sessionId].messages.push({ user, message, timestamp: new Date() });
        }
    }

    getMessages(sessionId) {
        return this.sessions[sessionId]?.messages || [];
    }
}

// Export for use
const collaboration = new CollaborationModule();

// UI Integration
document.addEventListener('DOMContentLoaded', () => {
    // Add collaborative section to HTML dynamically or assume it's added
    const collabSection = document.createElement('section');
    collabSection.id = 'collaboration';
    collabSection.innerHTML = `
        <h2>Collaborative AI Sessions</h2>
        <input type="text" id="sessionId" placeholder="Enter session ID">
        <button id="joinSession">Join/Create Session</button>
        <div id="collabChat"></div>
        <form id="collabForm">
            <textarea id="collabInput" placeholder="Share your AI prompt or idea..."></textarea>
            <button type="submit">Share</button>
        </form>
    `;
    document.querySelector('main').appendChild(collabSection);

    // Event listeners
    document.getElementById('joinSession').addEventListener('click', () => {
        const sessionId = document.getElementById('sessionId').value.trim();
        if (sessionId) {
            collaboration.joinSession(sessionId);
            updateChat();
        }
    });

    document.getElementById('collabForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('collabInput').value.trim();
        if (input && collaboration.currentSession) {
            collaboration.addMessage(collaboration.currentSession, 'User', input);
            updateChat();
            document.getElementById('collabInput').value = '';
        }
    });

    function updateChat() {
        const chatDiv = document.getElementById('collabChat');
        const messages = collaboration.getMessages(collaboration.currentSession);
        chatDiv.innerHTML = messages.map(msg => `<p><strong>${msg.user}:</strong> ${msg.message}</p>`).join('');
    }
});
