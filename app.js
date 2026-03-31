// --- MGA GLOBAL VARIABLES ---
let utangDatabase = []; 
let runningTotalUtang = 0;
let runningTotalBayad = 0;
let dueCounter = 1; 
let currentDateView = new Date(); 

// 1. Pampa-switch ng screens
function switchScreen(screenId) {
    let screens = document.querySelectorAll('.screen');
    screens.forEach(screen => screen.classList.remove('active-screen'));
    document.getElementById(screenId).classList.add('active-screen');
    
    if (screenId === 'utangScreen') renderUtangList();
}

// 2. Ipakita o itago yung Add Form
function showAddForm() {
    let form = document.getElementById('addUtangForm');
    form.style.display = (form.style.display === 'none' || form.style.display === '') ? 'block' : 'none';
}

// 3. Mag-add ng bagong row na may DELETE Button
function addDueRow() {
    dueCounter++;
    let container = document.getElementById('duesContainer');
    
    let newRow = document.createElement('div');
    newRow.className = 'due-row';
    newRow.innerHTML = `
        <label style="font-size: 11px; color: var(--primary); font-weight: 700; display: block; margin-bottom: 8px; text-transform: uppercase;">Due ${dueCounter}:</label>
        <div style="display: flex; gap: 5px; margin-bottom: 10px;">
            <input type="number" class="dynamic-amt" placeholder="Amount" style="flex: 1;">
            <input type="date" class="dynamic-date" style="flex: 1;">
            <button type="button" onclick="this.closest('.due-row').remove()" style="background: rgba(244, 63, 94, 0.1); color: var(--danger); border: 1px solid rgba(244, 63, 94, 0.2); padding: 0 10px; border-radius: 5px; cursor: pointer; font-size: 16px;">🗑️</button>
        </div>
    `;
    container.appendChild(newRow);
}

// 4. I-save lahat ng rows at i-reset ang form
function saveUtang() {
    let category = document.getElementById('utangCategory').value;
    let appName = document.getElementById('appName').value;
    let utangId = document.getElementById('utangId').value;

    if (!utangId) { alert("Engineer, pakilagay yung 6-digit Utang ID!"); return; }
    if (!appName) appName = "N/A"; // Default kung naiwang blangko

    let amounts = document.querySelectorAll('.dynamic-amt');
    let dates = document.querySelectorAll('.dynamic-date');

    for (let i = 0; i < amounts.length; i++) {
        let amt = parseFloat(amounts[i].value);
        let dateVal = dates[i].value;

        if (!isNaN(amt) && dateVal) {
            utangDatabase.push({
                id: Date.now() + Math.random(), 
                utangId: utangId + ` (Due ${i + 1})`,
                amount: amt,
                dueDate: new Date(dateVal),
                isPaid: false,
                category: category,
                appName: appName
            });
            runningTotalUtang += amt;
        }
    }

    // Update Header
    document.getElementById('displayTotalUtang').innerText = runningTotalUtang.toFixed(2);

    // Reset buong Form
    document.getElementById('utangId').value = '';
    document.getElementById('utangCategory').value = 'My App';
    document.getElementById('appName').value = '';
    
    document.getElementById('duesContainer').innerHTML = `
        <div class="due-row">
            <label style="font-size: 11px; color: var(--primary); font-weight: 700; display: block; margin-bottom: 8px; text-transform: uppercase;">Due 1:</label>
            <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                <input type="number" class="dynamic-amt" placeholder="Amount" style="flex: 1;">
                <input type="date" class="dynamic-date" style="flex: 1;">
            </div>
        </div>
    `;
    dueCounter = 1;
    document.getElementById('addUtangForm').style.display = 'none';

    renderUtangList();
}

// 5. Pang-lipat ng Buwan
function changeMonth(offset) {
    currentDateView.setMonth(currentDateView.getMonth() + offset);
    renderUtangList();
}

// 6. THE RENDER ENGINE (May Kasamang Badges at ID display)
function renderUtangList() {
    let container = document.getElementById('utangListContainer');
    container.innerHTML = ''; 

    // Update Month Label
    let viewMonthName = currentDateView.toLocaleString('default', { month: 'long', year: 'numeric' });
    document.getElementById('currentMonthLabel').innerText = viewMonthName;

    // Filter by Month & Year
    let filteredUtang = utangDatabase.filter(utang => {
        return utang.dueDate.getMonth() === currentDateView.getMonth() &&
               utang.dueDate.getFullYear() === currentDateView.getFullYear();
    });

    // Sort by Unpaid first, then by Date
    filteredUtang.sort((a, b) => a.isPaid - b.isPaid || a.dueDate - b.dueDate);

    // Kung walang laman
    if (filteredUtang.length === 0) {
        container.innerHTML = `<p style="text-align: center; color: var(--text-muted); font-style: italic; margin-top: 30px;">Walang due para sa buwang ito. 🎉</p>`;
        return;
    }

    let hasRenderedPaidHeader = false;

    // I-display ang listahan
    filteredUtang.forEach(utang => {
        let day = utang.dueDate.getDate();
        let shortMonth = utang.dueDate.toLocaleString('default', { month: 'short' });
        let formattedDate = `${shortMonth} ${day}`;

        // Paid Header
        if (utang.isPaid && !hasRenderedPaidHeader) {
            container.innerHTML += `<div class="date-section"><h3 style="color: var(--success); border-bottom: 2px solid rgba(16, 185, 129, 0.2); padding-bottom: 5px; font-size: 14px; margin-top: 25px;">✅ Paid This Month</h3></div>`;
            hasRenderedPaidHeader = true;
        } 

        // Card Styling
        let cardStyle = utang.isPaid ? 'opacity: 0.5; background-color: rgba(255,255,255,0.02); border-color: rgba(255,255,255,0.05);' : 'background: rgba(255,255,255,0.02);';
        let btnText = utang.isPaid ? 'Paid na! ✅' : 'Mark as Full Paid';
        let btnDisabled = utang.isPaid ? 'disabled' : '';

        // Badge Generation
        let badgeHTML = '';
        if (utang.category === 'My App') {
            badgeHTML = `<span class="badge badge-primary">📱 My App: ${utang.appName}</span>`;
        } else {
            badgeHTML = `<span class="badge badge-secondary">🧑 Under their: ${utang.appName}</span>`;
        }

        // Final Card HTML (Gumamit tayo ng monospace font para sa ID para mukhang system code)
        let cardHTML = `
            <div class="utang-card" style="${cardStyle}">
                <div style="margin-bottom: 10px;">${badgeHTML}</div>
                <h4><span style="font-family: monospace; letter-spacing: 1px; color: var(--primary);">ID: ${utang.utangId}</span> <span>₱${utang.amount.toFixed(2)}</span></h4>
                <p style="color: var(--danger); font-weight: bold;">Due On: ${formattedDate}</p>
                <button class="paid-btn" onclick="markPaid(${utang.id})" ${btnDisabled}>${btnText}</button>
            </div>
        `;

        container.innerHTML += cardHTML;
    });
}

// 7. I-update ang bayad
function markPaid(id) {
    let utang = utangDatabase.find(u => u.id === id);
    
    if (utang && !utang.isPaid) {
        utang.isPaid = true; 
        
        runningTotalUtang -= utang.amount;
        runningTotalBayad += utang.amount;
        
        document.getElementById('displayTotalUtang').innerText = runningTotalUtang.toFixed(2);
        document.getElementById('displayTotalBayad').innerText = runningTotalBayad.toFixed(2);

        renderUtangList();
    }
}

// ==========================================
// 🚀 MODULE 2: TASKS, DEADLINES & HABITS 🚀
// ==========================================

let taskDatabase = [];
let habitDatabase = [];

// (Panatilihin ang existing switchScreen, addDueRow, saveUtang, etc. sa itaas)

// --- 1. MOCK AI ESTIMATOR ---
function estimateAITask() {
    let title = document.getElementById('aiTaskTitle').value;
    let category = document.getElementById('aiTaskCategory').value;
    let dateVal = document.getElementById('aiTaskDate').value;

    if (!title || !dateVal) { alert("Engineer, pakilagay ang Task Title at Date!"); return; }

    let estMins = Math.floor(Math.random() * 90) + 30; 
    alert(`🤖 FLUX AI says: Naisip ko na! Yung "${title}" aabutin yan ng mga ${estMins} minutes.`);

    taskDatabase.push({
        id: Date.now(),
        title: title + ' ✨', 
        category: category,
        dueDate: new Date(dateVal),
        estMins: estMins,
        status: 'todo' // <--- BAGONG DAGDAG (todo, doing, done)
    });

    document.getElementById('aiTaskTitle').value = '';
    document.getElementById('aiTaskDetails').value = '';
    document.getElementById('aiTaskDate').value = '';

    renderTasks();
    renderKanban(); // I-update din ang Kanban sa likod
}

// --- 2. MANUAL TASK SAVE ---
function saveManualTask() {
    let title = document.getElementById('manualTaskTitle').value;
    let category = document.getElementById('manualTaskCategory').value;
    let dateVal = document.getElementById('manualTaskDate').value;
    let mins = document.getElementById('manualTaskMins').value;

    if (!title || !dateVal) { alert("Pakikumpleto ang Manual Task details!"); return; }

    taskDatabase.push({
        id: Date.now() + 1,
        title: title,
        category: category,
        dueDate: new Date(dateVal),
        estMins: mins ? parseInt(mins) : 0, 
        status: 'todo' // <--- BAGONG DAGDAG
    });

    document.getElementById('manualTaskTitle').value = '';
    document.getElementById('manualTaskDate').value = '';
    document.getElementById('manualTaskMins').value = '';

    renderTasks();
    renderKanban(); 
}

// --- 3. DAILY HABIT SAVE --- (Hayaan mo lang itong existing code mo)
function saveHabit() {
    let name = document.getElementById('habitName').value;
    let timeVal = document.getElementById('habitTime').value;
    if (!name || !timeVal) { alert("Pakilagay yung Habit at Oras!"); return; }
    habitDatabase.push({ id: Date.now() + 2, name: name, time: timeVal, isDone: false });
    document.getElementById('habitName').value = ''; document.getElementById('habitTime').value = '';
    renderTasks();
}

// --- 4. RENDER ENGINE PARA SA TASKS LIST ---
function renderTasks() {
    let taskContainer = document.getElementById('taskListContainer');
    let habitContainer = document.getElementById('habitListContainer');
    
    taskContainer.innerHTML = '<h3 style="color: var(--text-main); margin-top: 30px; font-size: 14px; border-bottom: 1px solid var(--glass-border); padding-bottom: 10px;">📋 PENDING TASKS</h3>';
    habitContainer.innerHTML = '<h3 style="color: var(--success); margin-top: 30px; font-size: 14px; border-bottom: 1px solid var(--glass-border); padding-bottom: 10px;">🔄 DAILY HABITS</h3>';

    // Sort by status ('done' goes down)
    let sortedTasks = taskDatabase.sort((a, b) => (a.status === 'done') - (b.status === 'done') || a.dueDate - b.dueDate);
    
    if (sortedTasks.length === 0) taskContainer.innerHTML += '<p style="color: var(--text-muted); font-size: 12px; font-style: italic;">No tasks yet.</p>';
    
    sortedTasks.forEach(task => {
        let shortMonth = task.dueDate.toLocaleString('default', { month: 'short' });
        let day = task.dueDate.getDate();
        
        let isDone = task.status === 'done';
        let cardStyle = isDone ? 'opacity: 0.5; background: rgba(255,255,255,0.02);' : 'background: rgba(192, 132, 252, 0.05); border-left: 4px solid var(--secondary);';
        let btnText = isDone ? 'Done ✅' : (task.status === 'doing' ? 'Doing ⏳' : 'Mark Done');
        let badgeColor = task.category === 'Work' ? '#38bdf8' : task.category === 'School' ? '#c084fc' : '#10b981';

        taskContainer.innerHTML += `
            <div class="utang-card" style="${cardStyle} margin-bottom: 10px; padding: 15px;">
                <span style="font-size: 10px; font-weight: 700; background: rgba(255,255,255,0.05); color: ${badgeColor}; padding: 3px 8px; border-radius: 5px; text-transform: uppercase;">${task.category}</span>
                <h4 style="margin: 8px 0; font-size: 15px; color: var(--text-main);">${task.title}</h4>
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--text-muted);">
                    <span>📅 ${shortMonth} ${day}</span>
                    <span>⏱️ ${task.estMins} mins</span>
                </div>
                <button class="paid-btn" style="border-color: var(--secondary); color: var(--secondary); margin-top: 10px; padding: 6px;" onclick="moveTaskStatus(${task.id}, 'done')" ${isDone ? 'disabled' : ''}>${btnText}</button>
            </div>
        `;
    });

    // Habits Rendering (Hayaan lang yung existing code mo dito)
    if (habitDatabase.length === 0) habitContainer.innerHTML += '<p style="color: var(--text-muted); font-size: 12px; font-style: italic;">No habits yet.</p>';
    habitDatabase.forEach(habit => {
        let timeParts = habit.time.split(':');
        let hour = parseInt(timeParts[0]);
        let ampm = hour >= 12 ? 'PM' : 'AM';
        hour = hour % 12; hour = hour ? hour : 12; 
        let formattedTime = hour + ':' + timeParts[1] + ' ' + ampm;
        let cardStyle = habit.isDone ? 'opacity: 0.5; background: rgba(255,255,255,0.02);' : 'background: rgba(16, 185, 129, 0.05); border-left: 4px solid var(--success);';
        let btnText = habit.isDone ? 'Done ✅' : 'Mark Done';

        habitContainer.innerHTML += `
            <div class="utang-card" style="${cardStyle} margin-bottom: 10px; padding: 15px; display: flex; justify-content: space-between; align-items: center;">
                <div><h4 style="margin: 0 0 5px 0; font-size: 15px; color: var(--success);">${habit.name}</h4><span style="font-size: 12px; color: var(--text-muted);">⏰ ${formattedTime}</span></div>
                <button class="paid-btn" style="width: auto; margin-top: 0; padding: 6px 12px; border-color: var(--success); color: var(--success);" onclick="markHabitDone(${habit.id})" ${habit.isDone ? 'disabled' : ''}>${btnText}</button>
            </div>
        `;
    });
}

// --- 5. THE KANBAN RENDER ENGINE (BAGONG DAGDAG!) ---
function renderKanban() {
    let colTodo = document.getElementById('kb-todo');
    let colDoing = document.getElementById('kb-doing');
    let colDone = document.getElementById('kb-done');

    // Linisin muna lahat ng columns
    colTodo.innerHTML = ''; colDoing.innerHTML = ''; colDone.innerHTML = '';

    taskDatabase.forEach(task => {
        let shortMonth = task.dueDate.toLocaleString('default', { month: 'short' });
        let day = task.dueDate.getDate();
        let badgeColor = task.category === 'Work' ? '#38bdf8' : task.category === 'School' ? '#c084fc' : '#10b981';

        // Gawa ng buttons base sa current status
        let actionButtons = '';
        if (task.status === 'todo') {
            actionButtons = `<button class="kb-btn" style="width: 100%; color: var(--primary);" onclick="moveTaskStatus(${task.id}, 'doing')">Move to DOING ➔</button>`;
        } else if (task.status === 'doing') {
            actionButtons = `
                <button class="kb-btn" style="color: var(--danger);" onclick="moveTaskStatus(${task.id}, 'todo')">⬅ To Do</button>
                <button class="kb-btn" style="color: var(--success);" onclick="moveTaskStatus(${task.id}, 'done')">Done ✅</button>
            `;
        } else if (task.status === 'done') {
            actionButtons = `<button class="kb-btn" style="width: 100%; color: var(--text-muted);" onclick="moveTaskStatus(${task.id}, 'doing')">⬅ Back to Doing</button>`;
        }

        let cardHTML = `
            <div class="kanban-card">
                <span style="font-size: 9px; font-weight: 700; background: rgba(255,255,255,0.05); color: ${badgeColor}; padding: 3px 6px; border-radius: 4px; text-transform: uppercase;">${task.category}</span>
                <h4 style="margin: 8px 0; font-size: 14px; color: var(--text-main);">${task.title}</h4>
                <p style="margin: 0; font-size: 11px; color: var(--text-muted);">📅 Due: ${shortMonth} ${day}</p>
                <div class="kanban-actions">${actionButtons}</div>
            </div>
        `;

        if (task.status === 'todo') colTodo.innerHTML += cardHTML;
        else if (task.status === 'doing') colDoing.innerHTML += cardHTML;
        else if (task.status === 'done') colDone.innerHTML += cardHTML;
    });
}

// --- 6. LOGIC PARA MAG-LIPAT NG TASK ---
function moveTaskStatus(id, newStatus) {
    let task = taskDatabase.find(t => t.id === id);
    if (task) { 
        task.status = newStatus; 
        renderTasks();  // I-update ang normal view
        renderKanban(); // I-update ang Kanban view
    }
}

function markHabitDone(id) {
    let habit = habitDatabase.find(h => h.id === id);
    if (habit) { habit.isDone = true; renderTasks(); }
}

// ==========================================
// 🍔 MODULE 3: FOOD LOG & MULTIMODAL AI 🍔
// ==========================================

let foodDatabase = [];
let currentBase64 = null;
let currentMimeType = null;

// --- 1. IMAGE UPLOAD HANDLER ---
document.getElementById('foodImage').addEventListener('change', function(e) {
    let file = e.target.files[0];
    if (!file) return;
    
    document.getElementById('fileNameDisplay').innerText = "📸 Attached: " + file.name;
    document.getElementById('fileNameDisplay').style.display = "block";

    let reader = new FileReader();
    reader.onload = function(event) {
        let dataUrl = event.target.result;
        let split = dataUrl.split(',');
        currentMimeType = split[0].match(/:(.*?);/)[1];
        currentBase64 = split[1]; // Ito yung raw text ng image mo
    };
    reader.readAsDataURL(file);
});

// --- 2. I-SAVE ANG FOOD LOG ---
function saveFood() {
    let mealType = document.getElementById('mealType').value;
    let foodItem = document.getElementById('foodItem').value;

    if (!foodItem && !currentBase64) { 
        alert("Engineer, piktyuran mo o i-type mo yung kinain mo!"); 
        return; 
    }

    foodDatabase.push({
        id: Date.now(),
        meal: mealType,
        item: foodItem || "*(May Picture)*",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        image64: currentBase64,
        mimeType: currentMimeType
    });

    // I-reset ang form
    document.getElementById('foodItem').value = '';
    document.getElementById('foodImage').value = '';
    document.getElementById('fileNameDisplay').style.display = 'none';
    currentBase64 = null;
    currentMimeType = null;
    document.getElementById('aiFoodResult').style.display = 'none'; 
    
    renderFoodList();
}

// --- 3. I-RENDER ANG FOOD LIST ---
function renderFoodList() {
    let container = document.getElementById('foodListContainer');
    container.innerHTML = '<h3 style="color: var(--text-main); margin-top: 10px; font-size: 14px; border-bottom: 1px solid var(--glass-border); padding-bottom: 10px;">🍽️ FOOD LOG TODAY</h3>';

    if (foodDatabase.length === 0) {
        container.innerHTML += '<p style="color: var(--text-muted); font-size: 12px; font-style: italic;">Wala ka pang kinakain today. Tubig tubig din!</p>';
        return;
    }

    foodDatabase.forEach(food => {
        let badgeColor = food.meal === 'Breakfast' ? '#fbbf24' : food.meal === 'Lunch' ? '#38bdf8' : food.meal === 'Dinner' ? '#c084fc' : '#f43f5e';
        let picIcon = food.image64 ? ' 📷' : '';

        container.innerHTML += `
            <div class="utang-card" style="background: rgba(255,255,255,0.02); margin-bottom: 10px; padding: 15px;">
                <span style="font-size: 9px; font-weight: 700; background: rgba(255,255,255,0.05); color: ${badgeColor}; padding: 3px 8px; border-radius: 5px; text-transform: uppercase;">${food.meal}</span>
                <span style="float: right; font-size: 11px; color: var(--text-muted);">${food.time}</span>
                <h4 style="margin: 10px 0 0 0; font-size: 14px; color: var(--text-main); font-weight: 500;">${food.item}${picIcon}</h4>
                <button onclick="deleteFood(${food.id})" style="background: none; border: none; color: var(--danger); font-size: 12px; margin-top: 8px; cursor: pointer; padding: 0;">🗑️ Remove</button>
            </div>
        `;
    });
}

function deleteFood(id) { foodDatabase = foodDatabase.filter(f => f.id !== id); renderFoodList(); }

// --- 4. TOTOONG GEMINI VISION AI CALL ---
async function analyzeFoodAI() {
    if (foodDatabase.length === 0) { alert("Kumain ka muna!"); return; }

    let aiBtn = document.querySelector('button[onclick="analyzeFoodAI()"]');
    let originalText = aiBtn.innerHTML;
    aiBtn.innerHTML = "⏳ Scanning food with AI...";
    aiBtn.disabled = true;

    // Kunin lahat ng text
    let allFoodText = foodDatabase.map(f => `${f.meal}: ${f.item}`).join(" | ");
    
    // Kunin lahat ng images
    let payloadImages = foodDatabase.filter(f => f.image64).map(f => ({
        mimeType: f.mimeType,
        data: f.image64
    }));
    
    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ foodLog: allFoodText, images: payloadImages })
        });

        const data = await response.json();
        if(data.error) throw new Error(data.error);

        let resultBox = document.getElementById('aiFoodResult');
        resultBox.style.display = 'block';
        document.getElementById('aiVerdictText').innerHTML = data.verdict;

    } catch (error) {
        console.error(error);
        alert("Oops! May error sa Vercel API connection natin.");
    } finally {
        aiBtn.innerHTML = originalText;
        aiBtn.disabled = false;
    }
}
