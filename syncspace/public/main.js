"use strict";

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initNavigation();
    initKanbanBoard();
    initRoster();
    initAI();
});

/* --- Security: XSS Sanitization --- */
function sanitizeHTML(str) {
    if (!str) return '';
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
}

/* --- Global State --- */
const dmUsers = ['Rahul Sharma', 'Priya Patel', 'Vikram Singh', 'Ananya Desai'];

/* --- Theme Logic --- */
function initTheme() {
    const themeBtn = document.getElementById('theme-btn');
    const savedTheme = localStorage.getItem('syncspace_theme');
    if (savedTheme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        themeBtn.innerText = '☼';
    }
    themeBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        if (currentTheme === 'light') {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('syncspace_theme', 'dark');
            themeBtn.innerText = '☾';
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('syncspace_theme', 'light');
            themeBtn.innerText = '☼';
        }
    });
}

/* --- Navigation --- */
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const targetId = item.getAttribute('data-target');
            if(!targetId) return;
            
            e.preventDefault();
            navItems.forEach(nav => nav.classList.remove('active'));
            views.forEach(view => view.classList.remove('active'));

            item.classList.add('active');
            const targetView = document.getElementById(targetId);
            if (targetView) targetView.classList.add('active');
        });
    });
}

/* --- Kanban & Handover Logic --- */
let tasks = [];

const columns = [
    { id: 'upcoming', title: 'Upcoming' },
    { id: 'active', title: 'Active Cases' },
    { id: 'shift-notes', title: 'Shift Change Notes' },
    { id: 'completed', title: 'Completed' }
];

let draggedTask = null;

async function initKanbanBoard() {
    const board = document.getElementById('kanban-board');
    if (!board) return;
    board.innerHTML = '';

    // Fetch tasks from API
    try {
        const response = await fetch('/api/tasks');
        if (response.ok) {
            const data = await response.json();
            tasks = data.tasks;
        }
    } catch (error) {
        console.error("Failed to load tasks", error);
    }

    columns.forEach(col => {
        const colEl = document.createElement('div');
        colEl.className = 'column';
        colEl.innerHTML = `
            <div class="column-header"><span>${col.title}</span></div>
            <div class="task-list" id="list-${col.id}"></div>
        `;
        
        const taskList = colEl.querySelector('.task-list');
        taskList.addEventListener('dragover', e => e.preventDefault());
        taskList.addEventListener('drop', e => {
            e.preventDefault();
            if (draggedTask) {
                taskList.appendChild(draggedTask);
                const taskId = draggedTask.id;
                const taskObj = tasks.find(t => t.id === taskId);
                if (taskObj) taskObj.status = col.id;
                
                draggedTask.className = col.id === 'shift-notes' ? 'task-card shift-note' : 'task-card';
                renderHandoverDashboard();
            }
        });

        board.appendChild(colEl);
    });

    tasks.forEach(task => createTaskElement(task));
    renderHandoverDashboard();
}

function createTaskElement(task) {
    const taskEl = document.createElement('div');
    taskEl.className = task.status === 'shift-notes' ? 'task-card shift-note' : 'task-card';
    taskEl.draggable = true;
    taskEl.id = task.id;
    
    // Sanitize task title before rendering
    const safeTitle = sanitizeHTML(task.title);
    
    taskEl.innerHTML = `
        <div class="font-bold-13">${safeTitle}</div>
        <div class="assignee-badge">Assigned to: <span id="badge-${task.id}">${task.assignee}</span></div>
    `;

    taskEl.addEventListener('dragstart', () => { draggedTask = taskEl; });
    taskEl.addEventListener('dragend', () => { draggedTask = null; });

    const list = document.getElementById(`list-${task.status}`);
    if (list) list.appendChild(taskEl);
}

function renderHandoverDashboard() {
    const listEl = document.getElementById('handover-list');
    if(!listEl) return;
    listEl.innerHTML = '';

    const shiftNotes = tasks.filter(t => t.status === 'shift-notes');
    if (shiftNotes.length === 0) {
        listEl.innerHTML = '<p class="font-sub-13">No tasks currently in handover.</p>';
        return;
    }

    shiftNotes.forEach(task => {
        let optionsHtml = dmUsers.map(name => `<option value="${name}" ${name === task.assignee ? 'selected' : ''}>${name}</option>`).join('');
        
        const safeTitle = sanitizeHTML(task.title);
        const card = document.createElement('div');
        card.className = 'handover-task';
        card.innerHTML = `
            <div class="font-bold-13">${safeTitle}</div>
            <div class="handover-reassign">
                <label for="reassign-${task.id}">Reassign to:</label>
                <select id="reassign-${task.id}">
                    <option value="Jane Doe" ${'Jane Doe' === task.assignee ? 'selected' : ''}>Jane Doe (Me)</option>
                    ${optionsHtml}
                </select>
            </div>
        `;
        listEl.appendChild(card);

        document.getElementById(`reassign-${task.id}`).addEventListener('change', (e) => {
            const newAssignee = e.target.value;
            task.assignee = newAssignee;
            const badge = document.getElementById(`badge-${task.id}`);
            if (badge) badge.innerText = newAssignee;
            showToast(`Task reassigned to ${newAssignee}`);
        });
    });
}

/* --- Toast Notifications --- */
function showToast(message) {
    const safeMessage = sanitizeHTML(message);
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
        <span class="font-title-16">✓</span>
        <div class="font-bold-13">${safeMessage}</div>
    `;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

/* --- AI Assistant (with Generic SOC Auto-Replies) --- */
const socReplies = [
    'System: Input logged and analyzing...',
    'System: Acknowledged, updating thread.',
    'System: Cross-referencing threat database...',
    'System: Command received. Initiating scan protocols.',
    'System: Forwarding data to incident response team.'
];

function initAI() {
    const fab = document.getElementById('ai-fab');
    const win = document.getElementById('ai-window');
    const sendBtn = document.getElementById('ai-send');
    const input = document.getElementById('ai-input');
    const typingInd = document.getElementById('ai-typing');
    const msgs = document.getElementById('ai-messages');

    if (!fab || !win) return;

    fab.addEventListener('click', () => {
        win.classList.toggle('open');
        if (win.classList.contains('open')) input.focus();
    });

    const sendAIMessage = () => {
        const text = input.value.trim();
        if (!text) return;

        // Sanitize chat input
        const safeText = sanitizeHTML(text);

        // Render User msg
        const userMsg = document.createElement('div');
        userMsg.className = 'message mine';
        userMsg.innerHTML = `<div class="message-bubble">${safeText}</div>`;
        msgs.insertBefore(userMsg, typingInd);
        input.value = '';
        msgs.scrollTop = msgs.scrollHeight;

        // Simulate processing (SOC style)
        typingInd.style.display = 'block';
        msgs.scrollTop = msgs.scrollHeight;

        setTimeout(async () => {
            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: safeText })
                });
                
                let replyText = "System: Cross-referencing threat database...";
                if (response.ok) {
                    const data = await response.json();
                    replyText = data.reply;
                }

                typingInd.style.display = 'none';
                const aiMsg = document.createElement('div');
                aiMsg.className = 'message';
                aiMsg.innerHTML = `<div class="message-bubble">${sanitizeHTML(replyText)}</div>`;
                msgs.insertBefore(aiMsg, typingInd);
                msgs.scrollTop = msgs.scrollHeight;
            } catch (error) {
                typingInd.style.display = 'none';
                console.error("API Error", error);
            }
        }, 500);
    };

    sendBtn.addEventListener('click', sendAIMessage);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendAIMessage();
    });
}

/* --- Team Roster & Leave --- */
const teamMembers = ['Jane Doe', 'Rahul Sharma', 'Priya Patel', 'Vikram Singh', 'Ananya Desai'];
let approvedLeaves = [];
let pendingRequests = [];

function initRoster() {
    renderCalendar();
    
    const submitBtn = document.getElementById('submit-leave-btn');
    if(!submitBtn) return;

    submitBtn.addEventListener('click', () => {
        const type = document.getElementById('leave-type').value;
        const dateInput = document.getElementById('leave-date').value;
        
        if (!dateInput) {
            alert("Please select a date.");
            return;
        }

        const dateObj = new Date(dateInput);
        let dayOfWeek = dateObj.getDay(); 
        
        if (dayOfWeek === 0 || dayOfWeek === 6) dayOfWeek = 5;

        // Sanitize type just in case, though it's from a select
        const safeType = sanitizeHTML(type);
        const safeDate = sanitizeHTML(dateInput);

        pendingRequests.push({ 
            id: Date.now(), 
            name: 'Jane Doe', 
            type: safeType, 
            day: dayOfWeek,
            dateString: safeDate
        });
        
        showToast('Request submitted successfully.');
        if (isTLView) renderTLDashboard();
    });

    const toggleTLBtn = document.getElementById('toggle-tl-btn');
    toggleTLBtn.addEventListener('click', () => {
        isTLView = !isTLView;
        const container = document.getElementById('tl-requests-container');
        const empty = document.getElementById('tl-empty-state');
        
        if (isTLView) {
            container.style.display = 'block';
            empty.style.display = 'none';
            toggleTLBtn.innerText = 'Hide Pending';
            renderTLDashboard();
        } else {
            container.style.display = 'none';
            empty.style.display = 'block';
            toggleTLBtn.innerText = 'View Pending';
        }
    });
}

let isTLView = false;
function renderCalendar() {
    const calRows = document.getElementById('calendar-rows');
    if(!calRows) return;
    calRows.innerHTML = '';
    teamMembers.forEach(member => {
        let html = `<div class="cal-row-label">${member}</div>`;
        for(let d = 1; d <= 5; d++) {
            const leave = approvedLeaves.find(l => l.name === member && l.day === d);
            if (leave) {
                html += `<div class="cal-cell"><div class="leave-block">${leave.type === 'Sick Leave' ? 'Sick' : 'PTO'}</div></div>`;
            } else {
                html += `<div class="cal-cell"></div>`;
            }
        }
        calRows.innerHTML += html;
    });
}

function renderTLDashboard() {
    const container = document.getElementById('tl-requests-container');
    container.innerHTML = '';
    if (pendingRequests.length === 0) {
        container.innerHTML = '<p class="font-sub-13">No pending requests.</p>';
        return;
    }
    
    pendingRequests.forEach(req => {
        const el = document.createElement('div');
        el.className = 'tl-request-item';
        el.innerHTML = `
            <div><strong>${req.name}</strong> requested ${req.type} for <strong>${req.dateString}</strong></div>
            <div class="flex-row-gap">
                <button class="btn btn-primary font-sub-12" onclick="approveLeave(${req.id})">Approve</button>
            </div>
        `;
        container.appendChild(el);
    });
}

// Ensure function is exposed globally for onclick handlers in HTML
window.approveLeave = function(id) {
    const index = pendingRequests.findIndex(r => r.id === id);
    if (index > -1) {
        approvedLeaves.push(pendingRequests[index]);
        pendingRequests.splice(index, 1);
        renderTLDashboard();
        renderCalendar();
        showToast('Request Approved');
    }
}
