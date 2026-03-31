// ==========================================
// 🌐 MGA GLOBAL VARIABLES
// ==========================================
let utangDatabase = []; 
let taskDatabase = [];
let habitDatabase = [];
let foodDatabase = [];
let myWallets = [];

let runningTotalUtang = 0;
let runningTotalBayad = 0;
let monthlyTarget = 0;
let monthlySpent = 0;

let dueCounter = 1; 
let currentDateView = new Date(); 
let transactionDatabase = [];

// 1. Pampa-switch ng screens
function switchScreen(screenId) {
    let screens = document.querySelectorAll('.screen');
    screens.forEach(screen => screen.classList.remove('active-screen'));
    document.getElementById(screenId).classList.add('active-screen');
    
    if (screenId === 'utangScreen') renderUtangList();
    if (screenId === 'taskScreen') { renderTasks(); renderKanban(); }
    if (screenId === 'foodScreen') renderFoodList();
    if (screenId === 'budgetScreen') updateBudgetDashboard();
    if (screenId === 'kanbanScreen') renderKanban();
}

// ==========================================
// 💸 MODULE 1: UTANG TRACKER (FIREBASE)
// ==========================================

function showAddForm() {
    let form = document.getElementById('addUtangForm');
    form.style.display = (form.style.display === 'none' || form.style.display === '') ? 'block' : 'none';
}

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
            <button type="button" onclick="this.closest('.due-row').remove()" style="background: rgba(244, 63, 94, 0.1); color: var(--danger); border: 1px solid rgba(244, 63, 94, 0.2); padding: 0 10px; border-radius: 5px; cursor: pointer; font-size: 16px;"><i class="ph-bold ph-trash"></i></button>
        </div>
    `;
    container.appendChild(newRow);
}

async function saveUtang() {
    let category = document.getElementById('utangCategory').value;
    let appName = document.getElementById('appName').value;
    let utangId = document.getElementById('utangId').value;

    if (!utangId) { alert("Engineer, pakilagay yung 6-digit Utang ID!"); return; }
    if (!appName) appName = "N/A";

    let amounts = document.querySelectorAll('.dynamic-amt');
    let dates = document.querySelectorAll('.dynamic-date');

    try {
        for (let i = 0; i < amounts.length; i++) {
            let amt = parseFloat(amounts[i].value);
            let dateVal = dates[i].value;

            if (!isNaN(amt) && dateVal) {
                await window.dbMethods.addDoc(window.dbMethods.collection(window.db, "utang"), {
                    utangId: utangId + ` (Due ${i + 1})`,
                    amount: amt,
                    dueDate: dateVal, // Save as string YYYY-MM-DD
                    isPaid: false,
                    category: category,
                    appName: appName,
                    createdAt: Date.now()
                });
            }
        }

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
    } catch (e) { console.error(e); alert("May error sa pag-save ng utang!"); }
}

// BAGO: Buksan ang modal para pumili ng pambayad
function openPayUtangModal(id, amount, utangIdLabel) {
    if (myWallets.length === 0) return alert("Gumawa ka muna ng wallet sa Budget tab!");
    
    document.getElementById('payUtangId').value = id;
    document.getElementById('payUtangAmount').value = amount;
    document.getElementById('payUtangDetails').innerText = `Babayaran: ID ${utangIdLabel} (₱${amount.toLocaleString()})`;

    let select = document.getElementById('payUtangWallet');
    select.innerHTML = '<option value="">Saan kukunin ang pera?</option>';
    myWallets.forEach(w => { 
        select.innerHTML += `<option value="${w.id}">${w.name} (Bal: ₱${parseFloat(w.balance).toLocaleString()})</option>`; 
    });

    document.getElementById('payUtangModal').style.display = 'flex';
}

// BAGO: I-confirm ang bayad at ikaltas sa wallet

async function confirmPayUtang() {
    let utangId = document.getElementById('payUtangId').value;
    let amount = parseFloat(document.getElementById('payUtangAmount').value);
    let walletId = document.getElementById('payUtangWallet').value;

    if (!walletId) return alert("Pumili ng wallet na pagkukunan!");

    let walletObj = myWallets.find(w => w.id === walletId);
    if (!walletObj || parseFloat(walletObj.balance) < amount) {
        return alert("Oops! Kulang ang pondo mo sa wallet na ito para pambayad.");
    }

    try {
        // 1. Ikaltas sa Wallet (Tinanggal na ang monthlySpent para di magalaw ang Budget target)
        let newBal = parseFloat(walletObj.balance) - amount;
        await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "wallets", walletId), { balance: newBal });

        // 2. I-update ang Utang as Paid
        await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "utang", utangId), { isPaid: true });

        closeBudgetModals();
    } catch (e) { 
        console.error(e); 
        alert("May error sa pagproseso ng bayad."); 
    }
}

function changeMonth(offset) {
    currentDateView.setMonth(currentDateView.getMonth() + offset);
    renderUtangList();
}

function initRealtimeUtang() {
    const q = window.dbMethods.query(window.dbMethods.collection(window.db, "utang"));
    window.dbMethods.onSnapshot(q, (snapshot) => {
        utangDatabase = [];
        runningTotalUtang = 0;
        runningTotalBayad = 0;
        
        snapshot.forEach(doc => {
            let data = doc.data();
            utangDatabase.push({ id: doc.id, ...data, dueDate: new Date(data.dueDate) });
            if (data.isPaid) runningTotalBayad += data.amount;
            else runningTotalUtang += data.amount;
        });
        
        document.getElementById('displayTotalUtang').innerText = runningTotalUtang.toFixed(2);
        document.getElementById('displayTotalBayad').innerText = runningTotalBayad.toFixed(2);
        renderUtangList();
    });
}

function renderUtangList() {
    let container = document.getElementById('utangListContainer');
    container.innerHTML = ''; 
    let viewMonthName = currentDateView.toLocaleString('default', { month: 'long', year: 'numeric' });
    document.getElementById('currentMonthLabel').innerText = viewMonthName;

    let filteredUtang = utangDatabase.filter(utang => 
        utang.dueDate.getMonth() === currentDateView.getMonth() && utang.dueDate.getFullYear() === currentDateView.getFullYear()
    );
    filteredUtang.sort((a, b) => a.isPaid - b.isPaid || a.dueDate - b.dueDate);

    // BAGO: Compute Monthly Totals based sa kung anong buwan ang naka-view
    let monthUtang = 0;
    let monthBayad = 0;
    filteredUtang.forEach(u => {
        if (u.isPaid) monthBayad += u.amount;
        else monthUtang += u.amount;
    });
    
    // Update HTML for Monthly
    document.getElementById('displayMonthUtang').innerText = monthUtang.toFixed(2);
    document.getElementById('displayMonthBayad').innerText = monthBayad.toFixed(2);

    if (filteredUtang.length === 0) {
        container.innerHTML = `<p style="text-align: center; color: var(--text-muted); font-style: italic; margin-top: 30px;">Walang due para sa buwang ito.</p>`;
        return;
    }

    let hasRenderedPaidHeader = false;
    filteredUtang.forEach(utang => {
        let day = utang.dueDate.getDate();
        let shortMonth = utang.dueDate.toLocaleString('default', { month: 'short' });
        
        if (utang.isPaid && !hasRenderedPaidHeader) {
            container.innerHTML += `<div class="date-section"><h3 style="color: var(--success); border-bottom: 2px solid rgba(16, 185, 129, 0.2); padding-bottom: 5px; font-size: 14px; margin-top: 25px;"><i class="ph-bold ph-check-circle"></i> Paid This Month</h3></div>`;
            hasRenderedPaidHeader = true;
        } 

        let cardStyle = utang.isPaid ? 'opacity: 0.5; background-color: rgba(255,255,255,0.02);' : 'background: rgba(255,255,255,0.02);';
        let badgeHTML = utang.category === 'My App' 
            ? `<span class="badge badge-primary"><i class="ph-bold ph-device-mobile"></i> My App: ${utang.appName}</span>`
            : `<span class="badge badge-secondary"><i class="ph-bold ph-user"></i> Under their: ${utang.appName}</span>`;

        // BAGO: Dinagdag yung Delete Button (X) sa upper right ng card
        container.innerHTML += `
            <div class="utang-card" style="${cardStyle}">
                <button onclick="deleteUtang('${utang.id}')" style="position: absolute; top: 12px; right: 12px; background: none; border: none; color: var(--danger); cursor: pointer; font-size: 16px; padding: 0;"><i class="ph-bold ph-x"></i></button>
                <div style="margin-bottom: 10px; padding-right: 20px;">${badgeHTML}</div>
                <h4><span style="font-family: monospace; letter-spacing: 1px; color: var(--primary);">ID: ${utang.utangId}</span> <span>₱${utang.amount.toFixed(2)}</span></h4>
                <p style="color: var(--danger); font-weight: bold;"><i class="ph-bold ph-calendar-x"></i> Due On: ${shortMonth} ${day}</p>
                <button class="paid-btn" onclick="openPayUtangModal('${utang.id}', ${utang.amount}, '${utang.utangId}')" ${utang.isPaid ? 'disabled' : ''}>${utang.isPaid ? '<i class="ph-bold ph-check"></i> Paid' : 'Pay via Wallet'}</button>
            </div>
        `;
    });
}

// BAGO: Delete Utang Record
async function deleteUtang(id) {
    if (confirm("Sigurado ka bang gusto mong burahin ang utang na ito? Hindi na ito maibabalik.")) {
        try {
            await window.dbMethods.deleteDoc(window.dbMethods.doc(window.db, "utang", id));
        } catch (e) { 
            console.error(e); 
            alert("May error sa pagbura ng utang."); 
        }
    }
}

// ==========================================
// 🚀 MODULE 2: TASKS, DEADLINES & HABITS (FIREBASE)
// ==========================================

async function estimateAITask() {
    let title = document.getElementById('aiTaskTitle').value;
    let category = document.getElementById('aiTaskCategory').value;
    let dateVal = document.getElementById('aiTaskDate').value;
    if (!title || !dateVal) { alert("Engineer, pakilagay ang Task Title at Date!"); return; }

    let estMins = Math.floor(Math.random() * 90) + 30; 
    alert(`FLUX AI says: Naisip ko na! Yung "${title}" aabutin yan ng mga ${estMins} minutes.`);

    await window.dbMethods.addDoc(window.dbMethods.collection(window.db, "tasks"), {
        title: title, category: category, dueDate: dateVal, estMins: estMins, status: 'todo', createdAt: Date.now()
    });

    document.getElementById('aiTaskTitle').value = '';
    document.getElementById('aiTaskDetails').value = '';
    document.getElementById('aiTaskDate').value = '';
}

async function saveManualTask() {
    let title = document.getElementById('manualTaskTitle').value;
    let category = document.getElementById('manualTaskCategory').value;
    let dateVal = document.getElementById('manualTaskDate').value;
    let mins = document.getElementById('manualTaskMins').value;
    if (!title || !dateVal) { alert("Pakikumpleto ang Manual Task details!"); return; }

    await window.dbMethods.addDoc(window.dbMethods.collection(window.db, "tasks"), {
        title: title, category: category, dueDate: dateVal, estMins: parseInt(mins) || 0, status: 'todo', createdAt: Date.now()
    });

    document.getElementById('manualTaskTitle').value = '';
    document.getElementById('manualTaskDate').value = '';
    document.getElementById('manualTaskMins').value = '';
}

async function saveHabit() {
    let name = document.getElementById('habitName').value;
    let timeVal = document.getElementById('habitTime').value;
    if (!name || !timeVal) { alert("Pakilagay yung Habit at Oras!"); return; }

    await window.dbMethods.addDoc(window.dbMethods.collection(window.db, "habits"), {
        name: name, time: timeVal, isDone: false, createdAt: Date.now()
    });

    document.getElementById('habitName').value = '';
    document.getElementById('habitTime').value = '';
}

async function moveTaskStatus(id, newStatus) {
    await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "tasks", id), { status: newStatus });
}

async function markHabitDone(id) {
    await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "habits", id), { isDone: true });
}

function initRealtimeTasks() {
    window.dbMethods.onSnapshot(window.dbMethods.collection(window.db, "tasks"), (snapshot) => {
        taskDatabase = [];
        snapshot.forEach(doc => taskDatabase.push({ id: doc.id, ...doc.data(), dueDate: new Date(doc.data().dueDate) }));
        renderTasks(); renderKanban();
    });
    
    window.dbMethods.onSnapshot(window.dbMethods.collection(window.db, "habits"), (snapshot) => {
        habitDatabase = [];
        snapshot.forEach(doc => habitDatabase.push({ id: doc.id, ...doc.data() }));
        renderTasks();
    });
}

function renderTasks() {
    let taskContainer = document.getElementById('taskListContainer');
    let habitContainer = document.getElementById('habitListContainer');
    taskContainer.innerHTML = `<h3 style="color: var(--text-main); margin-top: 30px; font-size: 14px; border-bottom: 1px solid var(--glass-border); padding-bottom: 10px;"><i class="ph-duotone ph-list-checks"></i> PENDING TASKS</h3>`;
    habitContainer.innerHTML = `<h3 style="color: var(--success); margin-top: 30px; font-size: 14px; border-bottom: 1px solid var(--glass-border); padding-bottom: 10px;"><i class="ph-duotone ph-arrows-clockwise"></i> DAILY HABITS</h3>`;

    let sortedTasks = taskDatabase.sort((a, b) => (a.status === 'done') - (b.status === 'done') || a.dueDate - b.dueDate);
    if (sortedTasks.length === 0) taskContainer.innerHTML += '<p style="color: var(--text-muted); font-size: 12px; font-style: italic;">No tasks yet.</p>';
    
    sortedTasks.forEach(task => {
        let isDone = task.status === 'done';
        let badgeColor = task.category === 'Work' ? '#38bdf8' : task.category === 'School' ? '#c084fc' : '#10b981';
        let btnText = isDone ? '<i class="ph-bold ph-check"></i> Done' : (task.status === 'doing' ? '<i class="ph-bold ph-hourglass"></i> Doing' : 'Mark Done');
        
        taskContainer.innerHTML += `
            <div class="utang-card" style="${isDone ? 'opacity: 0.5; background: rgba(255,255,255,0.02);' : 'background: rgba(192, 132, 252, 0.05); border-left: 4px solid var(--secondary);'} margin-bottom: 10px; padding: 15px;">
                <span style="font-size: 10px; font-weight: 700; background: rgba(255,255,255,0.05); color: ${badgeColor}; padding: 3px 8px; border-radius: 5px; text-transform: uppercase;">${task.category}</span>
                <h4 style="margin: 8px 0; font-size: 15px; color: var(--text-main);">${task.title}</h4>
                <button class="paid-btn" style="border-color: var(--secondary); color: var(--secondary); margin-top: 10px; padding: 6px;" onclick="moveTaskStatus('${task.id}', 'done')" ${isDone ? 'disabled' : ''}>${btnText}</button>
            </div>
        `;
    });

    if (habitDatabase.length === 0) habitContainer.innerHTML += '<p style="color: var(--text-muted); font-size: 12px; font-style: italic;">No habits yet.</p>';
    habitDatabase.forEach(habit => {
        let timeParts = habit.time.split(':');
        let hour = parseInt(timeParts[0]);
        let formattedTime = (hour % 12 || 12) + ':' + timeParts[1] + (hour >= 12 ? ' PM' : ' AM');
        
        habitContainer.innerHTML += `
            <div class="utang-card" style="${habit.isDone ? 'opacity: 0.5;' : 'background: rgba(16, 185, 129, 0.05); border-left: 4px solid var(--success);'} margin-bottom: 10px; padding: 15px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h4 style="margin: 0 0 5px 0; font-size: 15px; color: var(--success);">${habit.name}</h4>
                    <span style="font-size: 12px; color: var(--text-muted);"><i class="ph-bold ph-clock"></i> ${formattedTime}</span>
                </div>
                <button class="paid-btn" style="width: auto; margin-top: 0; padding: 6px 12px; border-color: var(--success); color: var(--success);" onclick="markHabitDone('${habit.id}')" ${habit.isDone ? 'disabled' : ''}>${habit.isDone ? '<i class="ph-bold ph-check"></i> Done' : 'Mark Done'}</button>
            </div>
        `;
    });
}

function renderKanban() {
    let colTodo = document.getElementById('kb-todo'); let colDoing = document.getElementById('kb-doing'); let colDone = document.getElementById('kb-done');
    if(!colTodo) return;
    colTodo.innerHTML = ''; colDoing.innerHTML = ''; colDone.innerHTML = '';

    taskDatabase.forEach(task => {
        let actionButtons = '';
        if (task.status === 'todo') actionButtons = `<button class="kb-btn" style="width: 100%; color: var(--primary);" onclick="moveTaskStatus('${task.id}', 'doing')">Move to DOING <i class="ph-bold ph-arrow-right"></i></button>`;
        else if (task.status === 'doing') actionButtons = `<button class="kb-btn" style="color: var(--danger);" onclick="moveTaskStatus('${task.id}', 'todo')"><i class="ph-bold ph-arrow-left"></i> To Do</button><button class="kb-btn" style="color: var(--success);" onclick="moveTaskStatus('${task.id}', 'done')"><i class="ph-bold ph-check"></i> Done</button>`;
        else if (task.status === 'done') actionButtons = `<button class="kb-btn" style="width: 100%; color: var(--text-muted);" onclick="moveTaskStatus('${task.id}', 'doing')"><i class="ph-bold ph-arrow-left"></i> Back to Doing</button>`;

        let cardHTML = `
            <div class="kanban-card">
                <h4 style="margin: 8px 0; font-size: 14px; color: var(--text-main);">${task.title}</h4>
                <div class="kanban-actions">${actionButtons}</div>
            </div>
        `;
        if (task.status === 'todo') colTodo.innerHTML += cardHTML;
        else if (task.status === 'doing') colDoing.innerHTML += cardHTML;
        else if (task.status === 'done') colDone.innerHTML += cardHTML;
    });
}

// ==========================================
// 🍔 MODULE 3: FOOD LOG & MULTIMODAL AI (FIREBASE)
// ==========================================

let currentBase64 = null;
let currentMimeType = null;

document.getElementById('foodImage').addEventListener('change', function(e) {
    let file = e.target.files[0];
    if (!file) return;
    let display = document.getElementById('fileNameDisplay');
    display.innerText = "Compressing..."; display.style.display = "block";

    let reader = new FileReader();
    reader.onload = function(event) {
        let img = new Image();
        img.onload = function() {
            let canvas = document.createElement('canvas'); let ctx = canvas.getContext('2d');
            let w = img.width, h = img.height;
            if (w > h) { if (w > 800) { h *= 800 / w; w = 800; } } else { if (h > 800) { w *= 800 / h; h = 800; } }
            canvas.width = w; canvas.height = h; ctx.drawImage(img, 0, 0, w, h);
            
            let split = canvas.toDataURL('image/jpeg', 0.7).split(',');
            currentMimeType = split[0].match(/:(.*?);/)[1]; currentBase64 = split[1];
            display.innerText = "Ready: " + file.name; display.style.color = "var(--success)";
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

async function saveFood() {
    let mealType = document.getElementById('mealType').value;
    let foodSource = document.getElementById('foodSource').value;
    let foodItem = document.getElementById('foodItem').value;
    let priceInput = document.getElementById('foodPrice');
    let walletInput = document.getElementById('foodWallet');
    let price = priceInput ? parseFloat(priceInput.value || 0) : 0;
    let walletId = walletInput ? walletInput.value : null;

    if (!foodItem && !currentBase64) { alert("Piktyuran mo o i-type mo yung kinain mo!"); return; }

    try {
        // I-kaltas agad sa Firebase Wallet kung may presyo
        if (price > 0 && walletId) {
            let walletObj = myWallets.find(w => w.id === walletId);
            if (!walletObj || walletObj.balance < price) { alert("Oops! Kulang ang pondo mo."); return; }
            await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "wallets", walletId), { balance: walletObj.balance - price });
            // Ang monthlySpent is local pa rin
            monthlySpent += price; 
        }

        // I-save ang pagkain sa Firebase
        await window.dbMethods.addDoc(window.dbMethods.collection(window.db, "foodLogs"), {
            meal: mealType, source: foodSource, item: foodItem || "*(May Picture)*", cost: price,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            image64: currentBase64, mimeType: currentMimeType, createdAt: Date.now()
        });

        document.getElementById('foodItem').value = ''; if (priceInput) priceInput.value = '';
        document.getElementById('foodImage').value = ''; document.getElementById('fileNameDisplay').style.display = 'none';
        currentBase64 = null; currentMimeType = null; document.getElementById('aiFoodResult').style.display = 'none';
    } catch (e) { console.error(e); alert("May error sa pag-save!"); }
}

async function deleteFood(id) {
    await window.dbMethods.deleteDoc(window.dbMethods.doc(window.db, "foodLogs", id));
}

function initRealtimeFood() {
    const q = window.dbMethods.query(window.dbMethods.collection(window.db, "foodLogs"));
    window.dbMethods.onSnapshot(q, (snapshot) => {
        foodDatabase = [];
        snapshot.forEach(doc => foodDatabase.push({ id: doc.id, ...doc.data() }));
        foodDatabase.sort((a, b) => b.createdAt - a.createdAt); // Latest sa taas
        renderFoodList();
    });
}

function renderFoodList() {
    let container = document.getElementById('foodListContainer');
    container.innerHTML = `<h3 style="color: var(--text-main); margin-top: 10px; font-size: 14px; border-bottom: 1px solid var(--glass-border); padding-bottom: 10px;"><i class="ph-duotone ph-fork-knife"></i> FOOD LOG TODAY</h3>`;

    if (foodDatabase.length === 0) { container.innerHTML += '<p style="color: var(--text-muted); font-size: 12px; font-style: italic;">Wala ka pang kinakain today.</p>'; return; }

    foodDatabase.forEach(food => {
        let badgeColor = food.meal === 'Breakfast' ? '#fbbf24' : food.meal === 'Lunch' ? '#38bdf8' : food.meal === 'Dinner' ? '#c084fc' : '#f43f5e';
        let picIcon = food.image64 ? ' <i class="ph-bold ph-image"></i>' : '';
        let priceTag = food.cost > 0 ? ` - ₱${food.cost}` : '';

        container.innerHTML += `
            <div class="utang-card" style="background: rgba(255,255,255,0.02); margin-bottom: 10px; padding: 15px;">
                <span style="font-size: 9px; font-weight: 700; background: rgba(255,255,255,0.05); color: ${badgeColor}; padding: 3px 8px; border-radius: 5px; text-transform: uppercase;">${food.meal} • ${food.source}</span>
                <span style="float: right; font-size: 11px; color: var(--text-muted);">${food.time}</span>
                <h4 style="margin: 10px 0 0 0; font-size: 14px; color: var(--text-main); font-weight: 500;">${food.item}${picIcon}${priceTag}</h4>
                <button onclick="deleteFood('${food.id}')" style="background: none; border: none; color: var(--danger); font-size: 12px; margin-top: 8px; cursor: pointer; padding: 0;"><i class="ph-bold ph-trash"></i> Remove</button>
            </div>
        `;
    });
}

async function analyzeFoodAI() {
    if (foodDatabase.length === 0) { alert("Kumain ka muna!"); return; }
    let aiBtn = document.querySelector('button[onclick="analyzeFoodAI()"]');
    let originalText = aiBtn.innerHTML; aiBtn.innerHTML = '<i class="ph-bold ph-hourglass"></i> Scanning...'; aiBtn.disabled = true;

    try {
        let allFoodText = foodDatabase.map(f => `${f.meal}: ${f.item}`).join(" | ");
        const response = await fetch('/api/analyze', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ foodLog: allFoodText, images: foodDatabase.filter(f => f.image64).map(f => ({ mimeType: f.mimeType, data: f.image64 })) })
        });
        const data = await response.json();
        document.getElementById('aiFoodResult').style.display = 'block';
        document.getElementById('aiVerdictText').innerHTML = data.verdict || data.error;
    } catch (e) { alert("API Error."); } finally { aiBtn.innerHTML = originalText; aiBtn.disabled = false; }
}

// ==========================================
// 💰 MODULE 4: MULTI-WALLET & BUDGET SYSTEM (FIREBASE)
// ==========================================

function updateBudgetDashboard() {
    let totalPera = myWallets.reduce((sum, wallet) => sum + parseFloat(wallet.balance), 0);
    document.getElementById('totalNetWorth').innerText = `₱${totalPera.toLocaleString('en-US', {minimumFractionDigits: 2})}`;

    let container = document.getElementById('walletsContainer'); container.innerHTML = '';
    if (myWallets.length === 0) container.innerHTML = `<p style="color: var(--text-muted); font-size: 12px; font-style: italic;">Wala pang wallet.</p>`;
    else {
        myWallets.forEach(wallet => {
            // BAGO: May delete (X) button na ang bawat wallet
            container.innerHTML += `
                <div style="position: relative; min-width: 120px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 15px; border-radius: 12px; flex-shrink: 0;">
                    <button onclick="deleteWallet('${wallet.id}')" style="position: absolute; top: 8px; right: 8px; background: none; border: none; color: var(--danger); cursor: pointer; padding: 0;"><i class="ph-bold ph-x"></i></button>
                    <p style="margin: 0; font-size: 11px; color: var(--text-muted); text-transform: uppercase; padding-right: 15px;">${wallet.name}</p>
                    <h4 style="margin: 5px 0 0 0; color: var(--text-main); font-size: 16px;">₱${parseFloat(wallet.balance).toLocaleString()}</h4>
                </div>
            `;
        });
    }

    document.getElementById('monthlyTarget').innerText = `₱${parseFloat(monthlyTarget).toLocaleString()}`;
    document.getElementById('monthlySpent').innerText = `₱${parseFloat(monthlySpent).toLocaleString()}`;
    
    let bar = document.getElementById('budgetProgressBar');
    let progress = monthlyTarget > 0 ? Math.min((monthlySpent / monthlyTarget) * 100, 100) : 0;
    bar.style.width = `${progress}%`; bar.style.background = progress >= 90 ? 'var(--danger)' : 'var(--success)';

    let foodWalletSelect = document.getElementById('foodWallet');
    if (foodWalletSelect) {
        foodWalletSelect.innerHTML = '<option value="">Saan ibabawas?</option>';
        myWallets.forEach(wallet => { foodWalletSelect.innerHTML += `<option value="${wallet.id}">${wallet.name} (Bal: ₱${parseFloat(wallet.balance).toLocaleString()})</option>`; });
    }
}

function showAddWalletModal() { document.getElementById('walletModal').style.display = 'flex'; }

function initRealtimeBudget() {
    window.dbMethods.onSnapshot(window.dbMethods.collection(window.db, "wallets"), (snapshot) => {
        myWallets = [];
        snapshot.forEach(doc => myWallets.push({ id: doc.id, ...doc.data() }));
        updateBudgetDashboard(); 
    });
}

async function saveWallet() {
    let name = document.getElementById('walletName').value; let bal = document.getElementById('walletBalance').value;
    if (!name || !bal) return alert("Kulang details!");
    try {
        await window.dbMethods.addDoc(window.dbMethods.collection(window.db, "wallets"), { name: name, balance: parseFloat(bal), createdAt: Date.now() });
        document.getElementById('walletName').value = ''; document.getElementById('walletBalance').value = ''; closeBudgetModals();
    } catch (e) { console.error(e); alert("May error sa pag-save!"); }
}

// BAGO: Delete Wallet Logic
async function deleteWallet(id) {
    if (confirm("Sigurado ka bang gusto mong burahin ang wallet na ito? Hindi na ito maibabalik.")) {
        try {
            await window.dbMethods.deleteDoc(window.dbMethods.doc(window.db, "wallets", id));
        } catch (e) { console.error(e); alert("May error sa pagbura ng wallet."); }
    }
}

// BAGO: I-fetch at i-render ang Transaction History
function initRealtimeTransactions() {
    const q = window.dbMethods.query(window.dbMethods.collection(window.db, "transactions"));
    window.dbMethods.onSnapshot(q, (snapshot) => {
        transactionDatabase = [];
        snapshot.forEach(doc => transactionDatabase.push({ id: doc.id, ...doc.data() }));
        // I-sort from latest to oldest
        transactionDatabase.sort((a, b) => b.createdAt - a.createdAt); 
        renderTransactions();
    });
}

function renderTransactions() {
    let container = document.getElementById('transactionListContainer');
    if (!container) return;
    container.innerHTML = '';

    if (transactionDatabase.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-muted); font-size: 12px; font-style: italic;">Walang recent transactions.</p>';
        return;
    }

    // Ipapakita lang natin yung pinaka-latest na 10 transactions para hindi masyadong mahaba
    let recentTx = transactionDatabase.slice(0, 10);

    recentTx.forEach(t => {
        let isIncome = t.type === 'income';
        let isTransfer = t.type === 'transfer';
        
        let icon = isIncome ? 'ph-trend-up' : (isTransfer ? 'ph-arrows-left-right' : 'ph-trend-down');
        let color = isIncome ? 'var(--success)' : (isTransfer ? 'var(--secondary)' : 'var(--danger)');
        let sign = isIncome ? '+' : (isTransfer ? '' : '-');
        
        // Hanapin yung pangalan ng wallet
        let walletObj = myWallets.find(w => w.id === t.walletId);
        let walletName = walletObj ? walletObj.name : 'Deleted Wallet';
        let dateStr = new Date(t.createdAt).toLocaleDateString('default', { month: 'short', day: 'numeric' });

        let displayNote = t.note && t.note !== "N/A" ? t.note : t.category;

        container.innerHTML += `
            <div class="utang-card" style="padding: 12px 15px; margin-bottom: 10px; background: rgba(255,255,255,0.02); display: flex; justify-content: space-between; align-items: center; border-left-color: ${color};">
                <div style="display: flex; gap: 12px; align-items: center; overflow: hidden;">
                    <div style="background: rgba(255,255,255,0.05); padding: 8px; border-radius: 8px; color: ${color};">
                        <i class="ph-bold ${icon}" style="font-size: 16px;"></i>
                    </div>
                    <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        <p style="margin: 0; font-size: 13px; font-weight: 600; color: var(--text-main);">${displayNote}</p>
                        <p style="margin: 2px 0 0 0; font-size: 11px; color: var(--text-muted);">${walletName} • ${dateStr}</p>
                    </div>
                </div>
                <div style="text-align: right; flex-shrink: 0; margin-left: 10px;">
                    <h4 style="margin: 0; font-size: 14px; color: ${color};">${sign}₱${parseFloat(t.amount).toLocaleString()}</h4>
                </div>
            </div>
        `;
    });
}

// BAGO: Na-update ang Save Transaction para i-log LAHAT sa history
async function saveTransaction() {
    let type = document.getElementById('transactionType').value;
    let walletId = document.getElementById('transactionWallet').value; 
    let amount = parseFloat(document.getElementById('transactionAmount').value);
    let note = document.getElementById('transactionNote').value;
    let category = document.getElementById('transactionCategory').value;

    if (!amount || isNaN(amount) || amount <= 0) return alert("Maglagay ng tamang halaga!");
    let walletObj = myWallets.find(w => w.id === walletId);
    if (!walletObj) return alert("Pumili ng wallet!");

    if (type === 'expense' && !category) return alert("Pumili ng category para sa expense!"); 

    let newBal = parseFloat(walletObj.balance);

    if (type === 'income') {
        newBal += amount;
        await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "wallets", walletId), { balance: newBal });
        // I-save sa History
        await window.dbMethods.addDoc(window.dbMethods.collection(window.db, "transactions"), {
            type: 'income', walletId: walletId, amount: amount, note: note || "N/A", category: "Income", createdAt: Date.now()
        });
    } 
    else if (type === 'expense') { 
        if (newBal < amount) return alert("Kulang pondo sa wallet na ito!"); 
        newBal -= amount; 
        monthlySpent += amount; 
        await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "wallets", walletId), { balance: newBal });
        // I-save sa History
        await window.dbMethods.addDoc(window.dbMethods.collection(window.db, "transactions"), {
            type: 'expense', walletId: walletId, amount: amount, note: note || "N/A", category: category, createdAt: Date.now()
        });
    } 
    else if (type === 'transfer') {
        let walletToId = document.getElementById('transactionWalletTo').value;
        if (!walletToId || walletId === walletToId) return alert("Pumili ng tamang wallet na paglilipatan!");
        
        let walletToObj = myWallets.find(w => w.id === walletToId);
        if (newBal < amount) return alert("Kulang ang pondo pampa-transfer!");

        let newTargetBal = parseFloat(walletToObj.balance) + amount;
        newBal -= amount;

        await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "wallets", walletId), { balance: newBal });
        await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "wallets", walletToId), { balance: newTargetBal });
        // I-save sa History
        await window.dbMethods.addDoc(window.dbMethods.collection(window.db, "transactions"), {
            type: 'transfer', walletId: walletId, walletToId: walletToId, amount: amount, note: note || "Wallet Transfer", category: "Transfer", createdAt: Date.now()
        });
    }

    try {
        document.getElementById('transactionAmount').value = ''; 
        document.getElementById('transactionNote').value = ''; 
        document.getElementById('transactionCategory').value = ''; 
        closeBudgetModals();
        updateBudgetDashboard();
    } catch (e) { console.error(e); }
}

function setMonthlyBudget() {
    let target = prompt("Magkano ang limit ng budget mo for this month?");
    if (target && !isNaN(target)) { monthlyTarget = parseFloat(target); updateBudgetDashboard(); }
}

// BAGO: Na-update para i-handle ang UI ng "Transfer"
// BAGO: Na-update para i-handle ang UI ng "Category"
function openTransactionModal(type) {
    if (myWallets.length === 0) return alert("Gumawa ka muna ng wallet!");
    if (type === 'transfer' && myWallets.length < 2) return alert("Kailangan mo ng at least 2 wallets para makapag-transfer!");

    document.getElementById('transactionModal').style.display = 'flex'; 
    document.getElementById('transactionType').value = type;
    
    let title = document.getElementById('transactionTitle'); 
    let btn = document.getElementById('saveTransactionBtn');
    let selectTo = document.getElementById('transactionWalletTo');
    let selectCat = document.getElementById('transactionCategory'); // Idinagdag ang Category dropdown
    
    if (type === 'income') { 
        title.innerHTML = '<i class="ph-bold ph-trend-up"></i> Add Income'; title.style.color = 'var(--success)'; btn.style.background = 'var(--success)'; 
        selectTo.style.display = 'none'; selectCat.style.display = 'none';
    } 
    else if (type === 'expense') { 
        title.innerHTML = '<i class="ph-bold ph-trend-down"></i> Add Expense'; title.style.color = 'var(--danger)'; btn.style.background = 'var(--danger)'; 
        selectTo.style.display = 'none'; selectCat.style.display = 'block'; // Papalabasin lang pag Expense
    }
    else if (type === 'transfer') {
        title.innerHTML = '<i class="ph-bold ph-arrows-left-right"></i> Transfer Funds'; title.style.color = 'var(--secondary)'; btn.style.background = 'var(--secondary)'; 
        selectTo.style.display = 'block'; selectCat.style.display = 'none';
    }

    let select = document.getElementById('transactionWallet'); select.innerHTML = type === 'transfer' ? '<option value="">Transfer From...</option>' : '';
    selectTo.innerHTML = '<option value="">Transfer To...</option>';

    myWallets.forEach(w => { 
        select.innerHTML += `<option value="${w.id}">${w.name} (Bal: ₱${parseFloat(w.balance).toLocaleString()})</option>`; 
        selectTo.innerHTML += `<option value="${w.id}">${w.name}</option>`; 
    });
}
function addIncome() { openTransactionModal('income'); }
function addExpense() { openTransactionModal('expense'); }
function addTransfer() { openTransactionModal('transfer'); } // BAGO
function closeBudgetModals() { 
    document.getElementById('walletModal').style.display = 'none'; 
    document.getElementById('transactionModal').style.display = 'none'; 
    let payUtangModal = document.getElementById('payUtangModal');
    if (payUtangModal) payUtangModal.style.display = 'none';
}

// ==========================================
// 🔐 AUTHENTICATION & INITIALIZE SYSTEM
// ==========================================
let isAppInitialized = false;

function handleLogin() {
    window.authMethods.signInWithPopup(window.auth, window.provider)
        .then((result) => {
            console.log("Welcome back, Engineer:", result.user.displayName);
        }).catch((error) => {
            console.error("Login failed:", error);
            alert("May error sa pag-login. Try again.");
        });
}

function handleLogout() {
    window.authMethods.signOut(window.auth).then(() => {
        console.log("System offline.");
    });
}

function startApp() {
    if (window.auth && window.authMethods && window.db) {
        
        // Listener: Binabantayan kung may nag-login o nag-logout
        window.authMethods.onAuthStateChanged(window.auth, (user) => {
            if (user) {
                // KUNG NAKA-LOGIN:
                document.getElementById('logoutBtn').style.display = 'block';
                switchScreen('dashboardScreen');
                
                // Initialize database listeners once lang para iwas lag
                if (!isAppInitialized) {
                    initRealtimeUtang();
                    initRealtimeTasks();
                    initRealtimeFood();
                    initRealtimeBudget();
                    initRealtimeTransactions();
                    isAppInitialized = true;
                }
            } else {
                // KUNG WALANG NAKA-LOGIN (o nag-logout):
                document.getElementById('logoutBtn').style.display = 'none';
                switchScreen('loginScreen');
            }
        });

        // Attach buttons sa functions
        document.getElementById('googleLoginBtn').addEventListener('click', handleLogin);
        document.getElementById('logoutBtn').addEventListener('click', handleLogout);

    } else {
        setTimeout(startApp, 500); 
    }
}
startApp();

// ==========================================
// 🌍 GLOBAL EXPORTS 
// ==========================================
window.switchScreen = switchScreen;
window.showAddForm = showAddForm;
window.addDueRow = addDueRow;
window.saveUtang = saveUtang;
window.changeMonth = changeMonth;
window.openPayUtangModal = openPayUtangModal; // BAGO
window.confirmPayUtang = confirmPayUtang; // BAGO
window.estimateAITask = estimateAITask;
window.saveManualTask = saveManualTask;
window.saveHabit = saveHabit;
window.moveTaskStatus = moveTaskStatus;
window.markHabitDone = markHabitDone;
window.saveFood = saveFood;
window.deleteFood = deleteFood;
window.analyzeFoodAI = analyzeFoodAI;
window.showAddWalletModal = showAddWalletModal;
window.saveWallet = saveWallet;
window.deleteWallet = deleteWallet;
window.setMonthlyBudget = setMonthlyBudget;
window.addIncome = addIncome;
window.addExpense = addExpense;
window.addTransfer = addTransfer;
window.saveTransaction = saveTransaction;
window.closeBudgetModals = closeBudgetModals;
window.deleteUtang = deleteUtang;
