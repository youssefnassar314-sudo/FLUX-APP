// ==========================================
// 🌐 MGA GLOBAL VARIABLES
// ==========================================
let utangDatabase = []; 
let taskDatabase = [];
let habitDatabase = [];
let foodDatabase = [];
let myWallets = [];
let aiAnalyses = [];

let runningTotalUtang = 0;
let runningTotalBayad = 0;
// BAGO: Ibabalik natin sa 0 dahil sa Firebase na kukunin, at may budgetDocId na para sa database
let monthlyTarget = 0;
let monthlySpent = 0;
let budgetDocId = null;

let dueCounter = 1; 
let currentDateView = new Date(); 
let transactionDatabase = [];

let currentUtangView = 'date'; // Default view natin



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

function setUtangView(mode) {
    currentUtangView = mode;
    
    // Update Button Styles para alam kung ano ang active
    let btnDate = document.getElementById('btnViewDate');
    let btnApp = document.getElementById('btnViewApp');
    
    if(btnDate && btnApp) {
        btnDate.style.opacity = mode === 'date' ? '1' : '0.5';
        btnDate.style.borderColor = mode === 'date' ? 'var(--primary)' : 'var(--glass-border)';
        btnDate.style.color = mode === 'date' ? 'var(--primary)' : 'var(--text-main)';

        btnApp.style.opacity = mode === 'app' ? '1' : '0.5';
        btnApp.style.borderColor = mode === 'app' ? 'var(--secondary)' : 'var(--glass-border)';
        btnApp.style.color = mode === 'app' ? 'var(--secondary)' : 'var(--text-main)';
    }

    renderUtangList(); // I-refresh ang listahan
}

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
    let utangLabel = document.getElementById('payUtangDetails').innerText;

    if (!walletId) return alert("Pumili ng wallet!");

    let walletObj = myWallets.find(w => w.id === walletId);
    if (!walletObj || parseFloat(walletObj.balance) < amount) return alert("Kulang ang pondo!");

    try {
        // 1. Kaltas sa Wallet
        await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "wallets", walletId), { 
            balance: parseFloat(walletObj.balance) - amount 
        });

        // 2. Mark as Paid sa Utang Collection
        await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "utang", utangId), { isPaid: true });

        // 3. BAGO: I-log as Transaction para lumabas sa Resibo!
        await window.dbMethods.addDoc(window.dbMethods.collection(window.db, "transactions"), {
            type: 'expense',
            walletId: walletId,
            amount: amount,
            note: `Bayad Utang: ${utangLabel.split('(')[0]}`,
            category: "Debt Payment", 
            createdAt: Date.now()
        });

        closeBudgetModals();
    } catch (e) { console.error(e); }
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

    // Compute Monthly Totals (Top Summary keeps showing current month stats)
    let monthUtang = 0;
    let monthBayad = 0;
    filteredUtang.forEach(u => {
        if (u.isPaid) monthBayad += u.amount;
        else monthUtang += u.amount;
    });
    
    document.getElementById('displayMonthUtang').innerText = monthUtang.toFixed(2);
    document.getElementById('displayMonthBayad').innerText = monthBayad.toFixed(2);

    // ==========================================
    // VIEW 1: BY DUE DATE (Current Month Only)
    // ==========================================
    if (currentUtangView === 'date') {
        // Ililipat natin yung empty check dito sa loob ng Date View
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
    // ==========================================
    // VIEW 2: BY APP & ID (OVERALL - Lahat ng Buwan)
    // ==========================================
    else {
        if (utangDatabase.length === 0) {
            container.innerHTML = `<p style="text-align: center; color: var(--text-muted); font-style: italic; margin-top: 30px;">Wala kang na-log na utang.</p>`;
            return;
        }

        let apps = {};

        // BAGO: Gamitin ang utangDatabase (LAHAT), hindi ang filteredUtang (Per Month lang)
        // BAGO: I-sort din natin by Due Date para sunod-sunod ang Due 1, 2, 3 sa listahan
        let allUtangSorted = [...utangDatabase].sort((a, b) => a.dueDate - b.dueDate);

        // 1. Group the data
        allUtangSorted.forEach(u => {
            let appName = u.appName && u.appName !== "N/A" ? u.appName : "Other Utang";
            let baseId = u.utangId.split(' (Due')[0]; 

            if(!apps[appName]) apps[appName] = {};
            if(!apps[appName][baseId]) apps[appName][baseId] = { totalAmount: 0, totalPaid: 0, items: [] };

            apps[appName][baseId].items.push(u);
            apps[appName][baseId].totalAmount += u.amount;
            if(u.isPaid) apps[appName][baseId].totalPaid += u.amount;
        });

        // 2. Render HTML per App -> per ID
        for (let app in apps) {
            container.innerHTML += `<div class="date-section"><h3 style="color: var(--secondary); border-bottom: 2px solid rgba(192, 132, 252, 0.2); padding-bottom: 5px; font-size: 14px; margin-top: 25px; text-transform: uppercase; letter-spacing: 1px;"><i class="ph-bold ph-device-mobile"></i> ${app}</h3></div>`;

            for (let id in apps[app]) {
                let group = apps[app][id];
                let allPaid = group.items.every(u => u.isPaid);
                
                let cardStyle = allPaid ? 'opacity: 0.5; background-color: rgba(255,255,255,0.02); border-left: 4px solid var(--success);' : 'background: rgba(192, 132, 252, 0.05); border-left: 4px solid var(--secondary);';

                // Buuin ang mga maliliit na row para sa kada due
                let duesHTML = group.items.map(u => {
                    let shortMonth = u.dueDate.toLocaleString('default', { month: 'short' });
                    let day = u.dueDate.getDate();
                    
                    // BAGO: Kapag iba na yung year, ipapakita nya yung year (e.g., Jan 15 '27)
                    let currentYear = new Date().getFullYear();
                    let dueYear = u.dueDate.getFullYear() !== currentYear ? ` '${u.dueDate.getFullYear().toString().slice(-2)}` : '';
                    
                    let dueLabel = u.utangId.includes('(Due') ? u.utangId.split('(')[1].replace(')', '') : 'Full';
                    
                    let controls = u.isPaid 
                        ? `<span style="color: var(--success); font-size: 11px; font-weight: bold;"><i class="ph-bold ph-check"></i> Paid</span>` 
                        : `<button onclick="openPayUtangModal('${u.id}', ${u.amount}, '${u.utangId}')" style="background:none; border:1px solid var(--primary); color:var(--primary); padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: bold; cursor: pointer;">Pay</button>`;
                    
                    return `
                    <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed var(--glass-border); padding-top: 10px; margin-top: 10px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <button onclick="deleteUtang('${u.id}')" style="background:none; border:none; color:var(--danger); font-size:14px; cursor:pointer; padding:0;"><i class="ph-bold ph-x"></i></button>
                            <span style="font-size: 11px; color: var(--text-muted);"><strong style="color:var(--text-main);">${dueLabel}</strong> • ${shortMonth} ${day}${dueYear}</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 13px; color: var(--text-main);">₱${u.amount.toFixed(2)}</span>
                            ${controls}
                        </div>
                    </div>`;
                }).join('');

                container.innerHTML += `
                    <div class="utang-card" style="${cardStyle} margin-bottom: 12px; padding: 15px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                            <span style="font-size: 10px; font-weight: 700; background: rgba(255,255,255,0.05); padding: 3px 8px; border-radius: 5px; text-transform: uppercase;">ID: ${id}</span>
                            <span style="font-size: 11px; color: ${allPaid ? 'var(--success)' : 'var(--danger)'};">Balance: ₱${(group.totalAmount - group.totalPaid).toFixed(2)}</span>
                        </div>
                        <h4 style="margin: 5px 0 0 0; font-size: 16px; color: var(--text-main);">Total: ₱${group.totalAmount.toFixed(2)}</h4>
                        ${duesHTML}
                    </div>
                `;
            }
        }
    }
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
    let details = document.getElementById('aiTaskDetails').value; // Kinuha natin ang details para sa AI context
    let category = document.getElementById('aiTaskCategory').value;
    let dateVal = document.getElementById('aiTaskDate').value;
    
    if (!title || !dateVal) { alert("Engineer, pakilagay ang Task Title at Date!"); return; }

    // UX: I-disable muna ang button habang nag-iisip ang AI
    let aiBtn = document.querySelector('button[onclick="estimateAITask()"]');
    let originalText = aiBtn.innerHTML; 
    aiBtn.innerHTML = '<i class="ph-bold ph-hourglass"></i> FLUX AI is thinking...'; 
    aiBtn.disabled = true;

    try {
        // TATAWAGIN ANG IISANG API MO SA VERCEL
        const response = await fetch('/api/analyze', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                action: 'estimateTask', // <-- BAGO: Eto yung tag para malaman ng Vercel na Task ito!
                title: title, 
                details: details, 
                category: category 
            })
        });

        const data = await response.json();
        
        // Expected natin na magbabalik ang backend mo ng JSON na may { estMins: <number> }
        let estMins = data.estMins || 30; // 30 is fallback kung sakaling pumalya
        
        alert(`FLUX AI says: Naisip ko na! Yung "${title}" aabutin yan ng mga ${estMins} minutes.`);

        // I-save sa Firebase
        await window.dbMethods.addDoc(window.dbMethods.collection(window.db, "tasks"), {
            title: title, 
            category: category, 
            dueDate: dateVal, 
            estMins: estMins, 
            status: 'todo', 
            createdAt: Date.now()
        });

        // I-clear ang form
        document.getElementById('aiTaskTitle').value = '';
        document.getElementById('aiTaskDetails').value = '';
        document.getElementById('aiTaskDate').value = '';

    } catch (e) {
        console.error(e); 
        alert("API Error. Hindi maka-connect sa FLUX AI.");
    } finally {
        // Ibalik sa dati yung button after mag-save o mag-error
        aiBtn.innerHTML = originalText; 
        aiBtn.disabled = false;
    }
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

// 1. BAGO: Delete Task ('X' button)
async function deleteTask(id) {
    if (confirm("Sigurado ka bang gusto mong burahin ang task na ito?")) {
        try {
            await window.dbMethods.deleteDoc(window.dbMethods.doc(window.db, "tasks", id));
        } catch(e) { console.error(e); }
    }
}

// BAGO: Delete Habit ('X' button)
async function deleteHabit(id) {
    if (confirm("Sigurado ka bang gusto mong burahin ang habit na ito?")) {
        try {
            await window.dbMethods.deleteDoc(window.dbMethods.doc(window.db, "habits", id));
        } catch(e) { console.error(e); }
    }
}

// 2. IN-UPDATE: Play / Pause / Done Logic na may Timer computation
async function moveTaskStatus(id, newState) {
    let task = taskDatabase.find(t => t.id === id);
    if(!task) return;
    
    let now = Date.now();
    let updates = { status: newState };
    
    // Compute time spent kapag pinause o tinapos
    let elapsedMins = 0;
    if (task.lastStarted && (newState === 'paused' || newState === 'done' || newState === 'todo')) {
        elapsedMins = Math.floor((now - task.lastStarted) / 60000); // ms to minutes
    }

    if (newState === 'doing') {
        updates.lastStarted = now; // Start timer
    } else if (newState === 'paused' || newState === 'done' || newState === 'todo') {
        updates.timeSpent = (task.timeSpent || 0) + Math.max(0, elapsedMins);
        updates.lastStarted = null; // Stop timer
    }

    await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "tasks", id), updates);
}

// 3. IN-UPDATE: Magse-save na ng petsa para alam kung kailan huling ginawa
async function saveHabit() {
    let name = document.getElementById('habitName').value;
    let timeVal = document.getElementById('habitTime').value;
    if (!name || !timeVal) { alert("Pakilagay yung Habit at Oras!"); return; }

    await window.dbMethods.addDoc(window.dbMethods.collection(window.db, "habits"), {
        name: name, time: timeVal, lastDoneDate: "", createdAt: Date.now()
    });

    document.getElementById('habitName').value = '';
    document.getElementById('habitTime').value = '';
}

// 4. IN-UPDATE: I-save ang "Petsa Ngayon" kapag pinindot ang 'Done'
async function markHabitDone(id) {
    let todayStr = new Date().toLocaleDateString('en-CA'); // Ex: 2026-04-01
    await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "habits", id), { lastDoneDate: todayStr });
}

// ==========================================
// 🎨 RENDER TASKS, HABITS, & SCHED
// ==========================================
// ==========================================
// 🎨 RENDER TASKS, HABITS, & SCHED
// ==========================================
function renderTasks() {
    let taskContainer = document.getElementById('taskListContainer');
    let habitContainer = document.getElementById('habitListContainer');
    let schedContainer = document.getElementById('schedListContainer');

    if(!taskContainer || !habitContainer) return; 

    taskContainer.innerHTML = `<h3 style="color: var(--text-main); margin-top: 30px; font-size: 14px; border-bottom: 1px solid var(--glass-border); padding-bottom: 10px;"><i class="ph-duotone ph-list-checks"></i> PENDING TASKS</h3>`;
    habitContainer.innerHTML = `<h3 style="color: var(--success); margin-top: 30px; font-size: 14px; border-bottom: 1px solid var(--glass-border); padding-bottom: 10px;"><i class="ph-duotone ph-arrows-clockwise"></i> DAILY HABITS</h3>`;

    if (schedContainer) {
        schedContainer.innerHTML = `<h3 style="color: #fbbf24; margin-top: 30px; font-size: 14px; border-bottom: 1px solid var(--glass-border); padding-bottom: 10px;"><i class="ph-duotone ph-calendar-blank"></i> UPCOMING SCHED</h3>`;
    }

    let todayDateStr = new Date().toLocaleDateString('en-CA');

    // Hatiin ang tasks
    let normalTasks = taskDatabase.filter(t => t.category !== 'Sched');
    let schedTasks = taskDatabase.filter(t => t.category === 'Sched');

    // ===========================
    // 1. RENDER NORMAL TASKS
    // ===========================
    if (normalTasks.length === 0) {
        taskContainer.innerHTML += '<p style="color: var(--text-muted); font-size: 12px; font-style: italic;">No pending tasks.</p>';
    } else {
        normalTasks.forEach(task => {
            let isDone = task.status === 'done';
            let isDoing = task.status === 'doing';
            let badgeColor = task.category === 'Work' ? '#38bdf8' : task.category === 'School' ? '#c084fc' : '#10b981';
            
            let totalSpent = task.timeSpent || 0;
            let est = task.estMins || 0;
            let runningText = isDoing ? `<span style="color: var(--primary); animation: pulse 1.5s infinite;"> • ⏱️ Running...</span>` : '';
            let timeText = `<span style="font-size: 11px; color: var(--text-muted);"><i class="ph-bold ph-clock"></i> Spent: ${totalSpent}m / Est: ${est}m ${runningText}</span>`;

            let controlsHTML = '';
            if (isDone) {
                controlsHTML = `<span style="color: var(--success); font-weight: bold; font-size: 12px;"><i class="ph-bold ph-check-circle"></i> Completed (${totalSpent}m spent)</span>`;
            } else {
                let playPauseBtn = isDoing 
                    ? `<button style="background: rgba(244, 63, 94, 0.1); color: var(--danger); border: 1px solid var(--danger); padding: 6px 12px; border-radius: 8px; cursor: pointer;" onclick="moveTaskStatus('${task.id}', 'paused')"><i class="ph-bold ph-pause"></i> Pause</button>`
                    : `<button style="background: rgba(56, 189, 248, 0.1); color: var(--primary); border: 1px solid var(--primary); padding: 6px 12px; border-radius: 8px; cursor: pointer;" onclick="moveTaskStatus('${task.id}', 'doing')"><i class="ph-bold ph-play"></i> Play</button>`;
                    
                controlsHTML = `
                    <div style="display: flex; gap: 8px; margin-top: 10px;">
                        ${playPauseBtn}
                        <button style="background: rgba(16, 185, 129, 0.1); color: var(--success); border: 1px solid var(--success); padding: 6px 12px; border-radius: 8px; cursor: pointer; flex: 1;" onclick="moveTaskStatus('${task.id}', 'done')"><i class="ph-bold ph-check"></i> Finish Task</button>
                    </div>
                `;
            }
            
            taskContainer.innerHTML += `
                <div class="utang-card" style="position: relative; ${isDone ? 'opacity: 0.5; background: rgba(255,255,255,0.02);' : 'background: rgba(192, 132, 252, 0.05); border-left: 4px solid var(--secondary);'} margin-bottom: 10px; padding: 15px;">
                    <button onclick="deleteTask('${task.id}')" style="position: absolute; top: 12px; right: 12px; background: none; border: none; color: var(--danger); cursor: pointer; font-size: 16px; padding: 0;"><i class="ph-bold ph-x"></i></button>
                    <span style="font-size: 10px; font-weight: 700; background: rgba(255,255,255,0.05); color: ${badgeColor}; padding: 3px 8px; border-radius: 5px; text-transform: uppercase;">${task.category}</span>
                    <h4 style="margin: 8px 0 2px 0; font-size: 15px; color: var(--text-main); padding-right: 25px;">${task.title}</h4>
                    ${timeText}
                    ${controlsHTML}
                </div>
            `;
        });
    }

    // ===========================
    // 2. RENDER HABITS
    // ===========================
    if (habitDatabase.length === 0) {
        habitContainer.innerHTML += '<p style="color: var(--text-muted); font-size: 12px; font-style: italic;">No habits yet.</p>';
    } else {
        habitDatabase.forEach(habit => {
            let timeParts = (habit.time || "12:00").split(':');
            let hour = parseInt(timeParts[0]);
            let formattedTime = (hour % 12 || 12) + ':' + (timeParts[1] || "00") + (hour >= 12 ? ' PM' : ' AM');
            
            let isDoneToday = habit.lastDoneDate === todayDateStr; 
            
            habitContainer.innerHTML += `
                <div class="utang-card" style="position: relative; ${isDoneToday ? 'opacity: 0.5;' : 'background: rgba(16, 185, 129, 0.05); border-left: 4px solid var(--success);'} margin-bottom: 10px; padding: 15px;">
                    <button onclick="deleteHabit('${habit.id}')" style="position: absolute; top: 12px; right: 12px; background: none; border: none; color: var(--danger); cursor: pointer; font-size: 16px; padding: 0;"><i class="ph-bold ph-x"></i></button>
                    
                    <h4 style="margin: 0 0 5px 0; font-size: 15px; color: var(--success); padding-right: 25px;">${habit.name}</h4>
                    <span style="font-size: 12px; color: var(--text-muted);"><i class="ph-bold ph-clock"></i> ${formattedTime}</span>
                    
                    <button class="paid-btn" style="border-color: var(--success); color: var(--success); margin-top: 10px; padding: 6px;" onclick="markHabitDone('${habit.id}')" ${isDoneToday ? 'disabled' : ''}>${isDoneToday ? '<i class="ph-bold ph-check"></i> Done Today' : 'Mark Done'}</button>
                </div>
            `;
        });
    }

    // ===========================
    // 3. RENDER UPCOMING SCHED
    // ===========================
    if (schedContainer) {
        if (schedTasks.length === 0) {
            schedContainer.innerHTML += '<p style="color: var(--text-muted); font-size: 12px; font-style: italic;">No upcoming schedules.</p>';
        } else {
            schedTasks.forEach(task => {
                let isDone = task.status === 'done';
                let dateObj = new Date(task.dueDate);
                let dateFormatted = isNaN(dateObj) ? "Date not set" : dateObj.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' });

                let controlsHTML = isDone
                    ? `<span style="color: var(--success); font-weight: bold; font-size: 12px;"><i class="ph-bold ph-check-circle"></i> Event Completed</span>`
                    : `<button class="paid-btn" style="border-color: #fbbf24; color: #fbbf24; padding: 6px; margin-top: 10px;" onclick="moveTaskStatus('${task.id}', 'done')"><i class="ph-bold ph-check"></i> Mark Done</button>`;

                schedContainer.innerHTML += `
                    <div class="utang-card" style="position: relative; ${isDone ? 'opacity: 0.5; background: rgba(255,255,255,0.02);' : 'background: rgba(251, 191, 36, 0.05); border-left: 4px solid #fbbf24;'} margin-bottom: 10px; padding: 15px;">
                        <button onclick="deleteTask('${task.id}')" style="position: absolute; top: 12px; right: 12px; background: none; border: none; color: var(--danger); cursor: pointer; font-size: 16px; padding: 0;"><i class="ph-bold ph-x"></i></button>

                        <span style="font-size: 10px; font-weight: 700; background: rgba(255,255,255,0.05); color: #fbbf24; padding: 3px 8px; border-radius: 5px; text-transform: uppercase;">WHOLE DAY</span>
                        <h4 style="margin: 8px 0 2px 0; font-size: 15px; color: var(--text-main); padding-right: 25px;">${task.title}</h4>
                        <span style="font-size: 11px; color: var(--text-muted);"><i class="ph-bold ph-calendar"></i> ${dateFormatted}</span>

                        <div style="margin-top: 10px;">${controlsHTML}</div>
                    </div>
                `;
            });
        }
    }
}

function renderKanban() {
    let colTodo = document.getElementById('kb-todo'); 
    let colDoing = document.getElementById('kb-doing'); 
    let colDone = document.getElementById('kb-done');
    
    // Safety check
    if(!colTodo || !colDoing || !colDone) return;
    
    colTodo.innerHTML = ''; colDoing.innerHTML = ''; colDone.innerHTML = '';

    // BAGO: I-filter out ang "Sched" kasi whole day events 'yon, di bagay sa Kanban
    let kanbanTasks = taskDatabase.filter(t => t.category !== 'Sched');

    kanbanTasks.forEach(task => {
        let actionButtons = '';
        let cardHTML = '';

        // 1. TO DO COLUMN
        if (task.status === 'todo') {
            actionButtons = `<button class="kb-btn" style="width: 100%; color: var(--primary);" onclick="moveTaskStatus('${task.id}', 'doing')">Start Task <i class="ph-bold ph-play"></i></button>`;
            cardHTML = `
                <div class="kanban-card">
                    <h4 style="margin: 8px 0; font-size: 14px; color: var(--text-main);">${task.title}</h4>
                    <div class="kanban-actions">${actionButtons}</div>
                </div>
            `;
            colTodo.innerHTML += cardHTML;
        } 
        
        // 2. DOING COLUMN (Kasama na rito yung mga naka-PAUSE)
        else if (task.status === 'doing' || task.status === 'paused') {
            let isPaused = task.status === 'paused';
            
            // Kung naka-pause, Resume button ang lalabas. Kung tumatakbo, Pause button.
            let playPauseBtn = isPaused 
                ? `<button class="kb-btn" style="color: var(--primary);" onclick="moveTaskStatus('${task.id}', 'doing')"><i class="ph-bold ph-play"></i> Resume</button>`
                : `<button class="kb-btn" style="color: var(--danger);" onclick="moveTaskStatus('${task.id}', 'paused')"><i class="ph-bold ph-pause"></i> Pause</button>`;
            
            actionButtons = `
                ${playPauseBtn}
                <button class="kb-btn" style="color: var(--success);" onclick="moveTaskStatus('${task.id}', 'done')"><i class="ph-bold ph-check"></i> Done</button>
            `;
            
            let statusLabel = isPaused ? `<span style="font-size: 10px; font-weight: bold; color: var(--danger);">PAUSED</span>` : `<span style="font-size: 10px; font-weight: bold; color: var(--primary);">RUNNING...</span>`;
            
            cardHTML = `
                <div class="kanban-card" style="${isPaused ? 'opacity: 0.6;' : 'border-left: 3px solid var(--primary);'}">
                    ${statusLabel}
                    <h4 style="margin: 4px 0 8px 0; font-size: 14px; color: var(--text-main);">${task.title}</h4>
                    <div class="kanban-actions">${actionButtons}</div>
                </div>
            `;
            colDoing.innerHTML += cardHTML;
        } 
        
        // 3. DONE COLUMN
        else if (task.status === 'done') {
            actionButtons = `<button class="kb-btn" style="width: 100%; color: var(--text-muted);" onclick="moveTaskStatus('${task.id}', 'doing')"><i class="ph-bold ph-arrow-left"></i> Re-open</button>`;
            cardHTML = `
                <div class="kanban-card" style="opacity: 0.5; background: rgba(255,255,255,0.02);">
                    <h4 style="margin: 8px 0; font-size: 14px; color: var(--text-muted); text-decoration: line-through;">${task.title}</h4>
                    <div class="kanban-actions">${actionButtons}</div>
                </div>
            `;
            colDone.innerHTML += cardHTML;
        }
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
        // I-kaltas agad sa Firebase Wallet kung may presyo at may napiling wallet
        if (price > 0 && walletId) {
            let walletObj = myWallets.find(w => w.id === walletId);
            if (!walletObj || parseFloat(walletObj.balance) < price) { 
                alert("Oops! Kulang ang pondo mo sa wallet na ito."); 
                return; 
            }
            
            // 1. I-update ang balance ng wallet
            await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "wallets", walletId), { 
                balance: parseFloat(walletObj.balance) - price 
            });
            
            monthlySpent += price; 

            // 2. BAGO: I-save rin agad sa Transaction History!
            let transactionNote = foodItem ? `Food: ${foodItem}` : `Food: ${mealType} (${foodSource})`;
            await window.dbMethods.addDoc(window.dbMethods.collection(window.db, "transactions"), {
                type: 'expense',
                walletId: walletId,
                amount: price,
                note: transactionNote,
                category: "Food & Drinks", // Naka-tag agad sa Food category
                createdAt: Date.now()
            });
        }

        // 3. I-save ang pagkain sa Food Logs collection
        await window.dbMethods.addDoc(window.dbMethods.collection(window.db, "foodLogs"), {
            meal: mealType, 
            source: foodSource, 
            item: foodItem || "*(May Picture)*", 
            cost: price,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            image64: currentBase64, 
            mimeType: currentMimeType, 
            createdAt: Date.now()
        });

        // I-clear ang form pagkatapos
        document.getElementById('foodItem').value = ''; 
        if (priceInput) priceInput.value = '';
        document.getElementById('foodImage').value = ''; 
        document.getElementById('fileNameDisplay').style.display = 'none';
        currentBase64 = null; 
        currentMimeType = null; 
        document.getElementById('aiFoodResult').style.display = 'none';
        
    } catch (e) { 
        console.error(e); 
        alert("May error sa pag-save!"); 
    }
}
async function deleteFood(id) {
    await window.dbMethods.deleteDoc(window.dbMethods.doc(window.db, "foodLogs", id));
}

function initRealtimeFood() {
    const q = window.dbMethods.query(window.dbMethods.collection(window.db, "foodLogs"));
    window.dbMethods.onSnapshot(q, (snapshot) => {
        foodDatabase = [];
        snapshot.forEach(doc => foodDatabase.push({ id: doc.id, ...doc.data() }));
        foodDatabase.sort((a, b) => b.createdAt - a.createdAt);
        renderFoodList();
        updateBudgetDashboard(); // BAGO
    });
}

function renderFoodList() {
    let container = document.getElementById('foodListContainer');
    container.innerHTML = `<h3 style="color: var(--text-main); margin-top: 10px; font-size: 14px; border-bottom: 1px solid var(--glass-border); padding-bottom: 10px;"><i class="ph-duotone ph-fork-knife"></i> FOOD LOG TODAY</h3>`;

    // 1. BAGO: Kunin ang petsa ngayon (YYYY-MM-DD)
    let today = new Date().toLocaleDateString('en-CA');

    // 2. BAGO: I-filter ang database para yung 'createdAt' ay kapareho ng petsa ngayon
    let todayFood = foodDatabase.filter(food => {
        let foodDate = new Date(food.createdAt).toLocaleDateString('en-CA');
        return foodDate === today;
    });

    // 3. I-update ang logic: gamitin ang 'todayFood' imbes na 'foodDatabase'
    if (todayFood.length === 0) { 
        container.innerHTML += '<p style="color: var(--text-muted); font-size: 12px; font-style: italic;">Wala ka pang kinakain today.</p>'; 
        return; 
    }

    todayFood.forEach(food => {
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
    let originalText = aiBtn.innerHTML; aiBtn.innerHTML = '<i class="ph-bold ph-hourglass"></i> Thinking...'; aiBtn.disabled = true;

    // Analyze TODAY's food only - para per-day ang AI sa receipt
    let todayKey = new Date().toLocaleDateString('en-CA');
    let todayFood = foodDatabase.filter(f => new Date(f.createdAt).toLocaleDateString('en-CA') === todayKey);
    if (todayFood.length === 0) { alert("Wala kang kinain today!"); aiBtn.innerHTML = originalText; aiBtn.disabled = false; return; }

    try {
        let allFoodText = todayFood.map(f => `${f.meal}: ${f.item}`).join(" | ");
        const response = await fetch('/api/analyze', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ foodLog: allFoodText, images: todayFood.filter(f => f.image64).map(f => ({ mimeType: f.mimeType, data: f.image64 })) })
        });
        const data = await response.json();
        const verdict = data.verdict || "Error analyzing.";

        // I-SAVE SA FIREBASE - kasama na ang dateKey para ma-match per day sa receipt
        await window.dbMethods.addDoc(window.dbMethods.collection(window.db, "aiAnalyses"), {
            verdict: verdict,
            type: 'food',
            dateKey: todayKey,
            createdAt: Date.now()
        });

        document.getElementById('aiFoodResult').style.display = 'block';
        document.getElementById('aiVerdictText').innerHTML = verdict;
    } catch (e) { alert("API Error."); } finally { aiBtn.innerHTML = originalText; aiBtn.disabled = false; }
}

function initRealtimeAiAnalyses() {
    const q = window.dbMethods.query(window.dbMethods.collection(window.db, "aiAnalyses"));
    window.dbMethods.onSnapshot(q, (snapshot) => {
        aiAnalyses = [];
        snapshot.forEach(doc => aiAnalyses.push({ id: doc.id, ...doc.data() }));
        aiAnalyses.sort((a, b) => a.createdAt - b.createdAt); // Oldest to newest so last index = latest
    });
}

// ==========================================
// 💰 MODULE 4: MULTI-WALLET & BUDGET SYSTEM (FIREBASE)
// ==========================================

// BAGO: Auto-compute ng mga nagastos mo (Food + Expenses) para kahit mag-refresh, hindi zero!
function updateBudgetDashboard() {
    let totalPera = myWallets.reduce((sum, wallet) => sum + parseFloat(wallet.balance), 0);
    document.getElementById('totalNetWorth').innerText = `₱${totalPera.toLocaleString('en-US', {minimumFractionDigits: 2})}`;

    let container = document.getElementById('walletsContainer'); container.innerHTML = '';
    if (myWallets.length === 0) container.innerHTML = `<p style="color: var(--text-muted); font-size: 12px; font-style: italic;">Wala pang wallet.</p>`;
    else {
        myWallets.forEach(wallet => {
            container.innerHTML += `
                <div style="position: relative; min-width: 120px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 15px; border-radius: 12px; flex-shrink: 0;">
                    <button onclick="deleteWallet('${wallet.id}')" style="position: absolute; top: 8px; right: 8px; background: none; border: none; color: var(--danger); cursor: pointer; padding: 0;"><i class="ph-bold ph-x"></i></button>
                    <p style="margin: 0; font-size: 11px; color: var(--text-muted); text-transform: uppercase; padding-right: 15px;">${wallet.name}</p>
                    <h4 style="margin: 5px 0 0 0; color: var(--text-main); font-size: 16px;">₱${parseFloat(wallet.balance).toLocaleString()}</h4>
                </div>
            `;
        });
    }

    // --- AUTO-COMPUTE SPENT (Ngayong Buwan) ---
    let now = new Date();
    let computedSpent = 0;
    
    // 1. Idagdag ang lahat ng nasa Transaction History na "expense"
    if (typeof transactionDatabase !== 'undefined') {
        transactionDatabase.forEach(tx => {
            if (tx.type === 'expense') {
                let d = new Date(tx.createdAt);
                if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
                    computedSpent += parseFloat(tx.amount);
                }
            }
        });
    }

    // 2. Idagdag ang mga biniling Food na may nilagay kang presyo
    if (typeof foodDatabase !== 'undefined') {
        foodDatabase.forEach(food => {
            if (food.cost > 0) {
                let d = new Date(food.createdAt);
                if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
                    computedSpent += parseFloat(food.cost);
                }
            }
        });
    }
    
    monthlySpent = computedSpent; // Finalize spent value

    // --- UPDATE UI UI ---
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
        transactionDatabase.sort((a, b) => b.createdAt - a.createdAt); 
        renderTransactions();
        updateBudgetDashboard(); // BAGO
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

    let recentTx = transactionDatabase.slice(0, 10);

    recentTx.forEach(t => {
        let isIncome = t.type === 'income';
        let isTransfer = t.type === 'transfer';
        
        let icon = isIncome ? 'ph-trend-up' : (isTransfer ? 'ph-arrows-left-right' : 'ph-trend-down');
        let color = isIncome ? 'var(--success)' : (isTransfer ? 'var(--secondary)' : 'var(--danger)');
        let sign = isIncome ? '+' : (isTransfer ? '' : '-');
        
        let walletObj = myWallets.find(w => w.id === t.walletId);
        let walletName = walletObj ? walletObj.name : 'Deleted Wallet';
        let dateStr = new Date(t.createdAt).toLocaleDateString('default', { month: 'short', day: 'numeric' });

        let displayNote = t.note && t.note !== "N/A" ? t.note : t.category;
        
        // Pass empty string kung walang walletToId para hindi mag-error
        let targetWalletId = t.walletToId || '';

        container.innerHTML += `
            <div class="utang-card" style="padding: 12px 15px; margin-bottom: 10px; background: rgba(255,255,255,0.02); display: flex; justify-content: space-between; align-items: center; border-left-color: ${color}; position: relative;">
                <div style="display: flex; gap: 12px; align-items: center; overflow: hidden;">
                    <div style="background: rgba(255,255,255,0.05); padding: 8px; border-radius: 8px; color: ${color};">
                        <i class="ph-bold ${icon}" style="font-size: 16px;"></i>
                    </div>
                    <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        <p style="margin: 0; font-size: 13px; font-weight: 600; color: var(--text-main);">${displayNote}</p>
                        <p style="margin: 2px 0 0 0; font-size: 11px; color: var(--text-muted);">${walletName} • ${dateStr}</p>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0; margin-left: 10px;">
                    <h4 style="margin: 0; font-size: 14px; color: ${color};">${sign}₱${parseFloat(t.amount).toLocaleString()}</h4>
                    <button onclick="deleteTransaction('${t.id}', '${t.type}', ${t.amount}, '${t.walletId}', '${targetWalletId}')" style="background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 5px; transition: 0.2s;" onmouseover="this.style.color='var(--danger)'" onmouseout="this.style.color='var(--text-muted)'">
                        <i class="ph-bold ph-x"></i>
                    </button>
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

// BAGO: Smart Delete Transaction (Nagre-replenish ng wallet)
async function deleteTransaction(id, type, amount, walletId, walletToId) {
    if (confirm("Burahin itong transaction? (Ire-reverse ang epekto nito sa wallet mo)")) {
        try {
            let walletObj = myWallets.find(w => w.id === walletId);
            
            if (walletObj) {
                let currentBal = parseFloat(walletObj.balance);
                
                // REVERSE THE MATH
                if (type === 'income') {
                    // Kung income, ibabawas ulit natin
                    await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "wallets", walletId), { balance: currentBal - amount });
                } 
                else if (type === 'expense') {
                    // Kung expense, ibabalik natin yung pera
                    await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "wallets", walletId), { balance: currentBal + amount });
                } 
                else if (type === 'transfer' && walletToId) {
                    // Kung transfer, ibabalik sa pinanggalingan at ibabawas sa pinaglipatan
                    let targetWallet = myWallets.find(w => w.id === walletToId);
                    if (targetWallet) {
                        await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "wallets", walletId), { balance: currentBal + amount });
                        await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "wallets", walletToId), { balance: parseFloat(targetWallet.balance) - amount });
                    }
                }
            }

            // Pagkatapos ibalik ang pera, burahin na ang record sa history
            await window.dbMethods.deleteDoc(window.dbMethods.doc(window.db, "transactions", id));

        } catch (e) { 
            console.error(e); 
            alert("May error sa pagbura ng transaction."); 
        }
    }
}

// BAGO: Nagsi-save na directly sa Firebase Collection na "budgetConfig"
async function setMonthlyBudget() {
    let target = prompt("Magkano ang limit ng budget mo for this month?");
    if (target && !isNaN(target)) { 
        let parsedTarget = parseFloat(target); 
        
        try {
            if (budgetDocId) {
                // Kung may na-set na dati, i-update lang sa database
                await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "budgetConfig", budgetDocId), { target: parsedTarget });
            } else {
                // Kung first time mag-set, gagawa ng bagong record sa database
                let docRef = await window.dbMethods.addDoc(window.dbMethods.collection(window.db, "budgetConfig"), { target: parsedTarget });
                budgetDocId = docRef.id;
            }
        } catch (e) {
            console.error("Error saving budget:", e);
            alert("May error sa pag-save ng budget sa database.");
        }
    }
}

// BAGO: Realtime listener para sa Target Budget
function initRealtimeBudgetConfig() {
    const q = window.dbMethods.query(window.dbMethods.collection(window.db, "budgetConfig"));
    window.dbMethods.onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            let doc = snapshot.docs[0]; // Kunin yung nagi-isang record ng budget
            budgetDocId = doc.id;
            monthlyTarget = doc.data().target || 0;
        } else {
            monthlyTarget = 0;
        }
        updateBudgetDashboard(); // I-refresh ang UI UI pag nakuha na ang data
    });
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

let activeReceiptFilter = 'all';

function openDailySummary() {
    activeReceiptFilter = 'all';
    switchScreen('summaryScreen');
    renderFullReceipt();
}

function setReceiptFilter(filter) {
    activeReceiptFilter = filter;
    // Update active tab styles
    document.querySelectorAll('.rcpt-tab').forEach(btn => {
        let isActive = btn.dataset.filter === filter;
        btn.style.background    = isActive ? '#1a1a1a' : 'transparent';
        btn.style.color         = isActive ? '#f5f0e8' : '#888';
        btn.style.borderColor   = isActive ? '#1a1a1a' : '#ccc';
    });
    renderReceiptBody();
}

function groupByDay(items, getTimestamp) {
    let days = {};
    items.forEach(item => {
        let d = new Date(getTimestamp(item));
        let key = d.toLocaleDateString('en-CA');
        let label = d.toLocaleDateString('default', { month: 'short', day: 'numeric', weekday: 'short' }).toUpperCase();
        if (!days[key]) days[key] = { label, items: [] };
        days[key].items.push(item);
    });
    return Object.keys(days).sort().map(k => days[k]);
}

function buildReceiptSections() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysLeft = daysInMonth - now.getDate() + 1;

    // ── DEBT ──
    let paidUtang = utangDatabase.filter(u => {
        if (!u.isPaid) return false;
        let d = u.dueDate instanceof Date ? u.dueDate : new Date(u.dueDate);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).sort((a, b) => {
        let da = a.dueDate instanceof Date ? a.dueDate : new Date(a.dueDate);
        let db = b.dueDate instanceof Date ? b.dueDate : new Date(b.dueDate);
        return da - db;
    });
    let utangByDay = groupByDay(paidUtang, u => (u.dueDate instanceof Date ? u.dueDate : new Date(u.dueDate)).getTime());
    let totalUtangPaid = paidUtang.reduce((s, u) => s + u.amount, 0);
    let utangRows = utangByDay.map(day => `
        <div class="receipt-day-header">${day.label}</div>
        ${day.items.map(u => `
            <div class="receipt-row">
                <span class="r-label">ID: ${u.utangId}<span class="receipt-paid-tag">PAID</span></span>
                <span class="r-val">₱${u.amount.toFixed(2)}</span>
            </div>`).join('')}
    `).join('') || '<p style="text-align:center;font-size:10px;color:#888;letter-spacing:1px;margin:12px 0;">NO DEBTS PAID THIS MONTH</p>';

    let debtSection = `
        <div class="receipt-section-title">DEBT REPAYMENT</div>
        ${utangRows}
        <div class="receipt-divider-solid"></div>
        <div class="receipt-row r-total">
            <span class="r-label">TOTAL REPAID</span>
            <span class="r-val">₱${totalUtangPaid.toFixed(2)}</span>
        </div>`;

    // ── FOOD ──
    let foodThisMonth = foodDatabase.filter(f => f.createdAt >= startOfMonth);
    let foodByDay = groupByDay(foodThisMonth, f => f.createdAt);
    let totalFood = foodThisMonth.reduce((s, f) => s + (f.cost || 0), 0);
    // Build a map of dateKey -> latest AI verdict for that day
    let aiByDay = {};
    aiAnalyses.forEach(a => {
        let key = a.dateKey || new Date(a.createdAt).toLocaleDateString('en-CA');
        // Keep latest per day (aiAnalyses is sorted oldest->newest)
        aiByDay[key] = a.verdict;
    });

    let foodRows = foodByDay.map(day => {
        let dayKey = Object.keys(aiByDay).length > 0
            ? (() => { // figure out the YYYY-MM-DD key from the day label's data
                // re-derive key from first item's createdAt
                return new Date(day.items[0].createdAt).toLocaleDateString('en-CA');
            })()
            : null;
        let dayVerdict = dayKey && aiByDay[dayKey] ? aiByDay[dayKey] : null;
        return `
        <div class="receipt-day-header">${day.label}</div>
        ${day.items.map(f => `
            <div class="receipt-row">
                <span class="r-label">• ${f.item}</span>
                <span class="r-val">${f.cost > 0 ? '₱' + f.cost.toFixed(2) : '—'}</span>
            </div>`).join('')}
        ${dayVerdict ? `<div class="receipt-ai-box">AI: ${dayVerdict}</div>` : ''}
    `;
    }).join('') || '<p style="text-align:center;font-size:10px;color:#888;letter-spacing:1px;margin:12px 0;">NO FOOD LOGGED</p>';

    let foodSection = `
        <div class="receipt-section-title">FOOD CONSUMPTION</div>
        ${foodRows}
        <div class="receipt-divider-solid"></div>
        <div class="receipt-row r-total">
            <span class="r-label">FOOD TOTAL</span>
            <span class="r-val">₱${totalFood.toFixed(2)}</span>
        </div>`;

    // ── TASKS ──
    let doneTasks = taskDatabase.filter(t => t.status === 'done' && t.createdAt >= startOfMonth);
    let tasksByDay = groupByDay(doneTasks, t => t.createdAt);
    let totalMins = doneTasks.reduce((s, t) => s + (t.timeSpent || t.estMins || 0), 0);
    let taskRows = tasksByDay.map(day => `
        <div class="receipt-day-header">${day.label}</div>
        ${day.items.map(t => `
            <div class="receipt-row">
                <span class="r-label">${t.title}</span>
                <span class="r-val">${t.timeSpent || t.estMins || 0}m</span>
            </div>`).join('')}
    `).join('') || '<p style="text-align:center;font-size:10px;color:#888;letter-spacing:1px;margin:12px 0;">NO TASKS COMPLETED</p>';

    let taskSection = `
        <div class="receipt-section-title">TASK PROGRESS</div>
        ${taskRows}
        <div class="receipt-divider-solid"></div>
        <div class="receipt-row r-total">
            <span class="r-label">TIME INVESTED</span>
            <span class="r-val">${totalMins} MINS</span>
        </div>`;

    // ── BUDGET ──
    let remaining = monthlyTarget - monthlySpent;
    let dailyLeft = remaining > 0 && daysLeft > 0 ? (remaining / daysLeft) : 0;
    let expensesByDay = groupByDay(
        transactionDatabase.filter(t => t.type === 'expense' && t.createdAt >= startOfMonth),
        t => t.createdAt
    );
    let expRows = expensesByDay.map(day => `
        <div class="receipt-day-header">${day.label}</div>
        ${day.items.map(t => `
            <div class="receipt-row">
                <span class="r-label">${t.note || t.category || 'Expense'}</span>
                <span class="r-val">-₱${parseFloat(t.amount).toFixed(2)}</span>
            </div>`).join('')}
    `).join('') || '<p style="text-align:center;font-size:10px;color:#888;letter-spacing:1px;margin:12px 0;">NO EXPENSES LOGGED</p>';

    let budgetSection = `
        <div class="receipt-section-title">BUDGET BREAKDOWN</div>
        ${expRows}
        <div class="receipt-divider-solid"></div>
        <div class="receipt-row" style="font-size:11px;">
            <span class="r-label">MONTHLY TARGET</span>
            <span class="r-val">₱${parseFloat(monthlyTarget).toFixed(2)}</span>
        </div>
        <div class="receipt-row" style="font-size:11px;">
            <span class="r-label">TOTAL SPENT</span>
            <span class="r-val">-₱${monthlySpent.toFixed(2)}</span>
        </div>
        <div class="receipt-divider-solid"></div>
        <div class="receipt-row r-total">
            <span class="r-label">REMAINING</span>
            <span class="r-val">₱${remaining.toFixed(2)}</span>
        </div>
        <div class="receipt-daily-budget">
            <p>DAILY ALLOWANCE LEFT</p>
            <h2>₱${dailyLeft.toFixed(2)}</h2>
        </div>`;

    return { debtSection, foodSection, taskSection, budgetSection };
}

function renderReceiptBody() {
    const body = document.getElementById('receiptBody');
    if (!body) return;
    const { debtSection, foodSection, taskSection, budgetSection } = buildReceiptSections();
    const f = activeReceiptFilter;
    let html = '';

    if (f === 'all' || f === 'debt')   { html += debtSection;   if (f === 'all') html += '<div class="receipt-divider"></div>'; }
    if (f === 'all' || f === 'food')   { html += foodSection;   if (f === 'all') html += '<div class="receipt-divider"></div>'; }
    if (f === 'all' || f === 'tasks')  { html += taskSection;   if (f === 'all') html += '<div class="receipt-divider"></div>'; }
    if (f === 'all' || f === 'budget') { html += budgetSection; }

    body.innerHTML = html;
}

function renderFullReceipt() {
    const content = document.getElementById('summaryContent');
    const nextBtn = document.getElementById('summaryNextBtn');
    if (nextBtn) nextBtn.style.display = 'none';

    const now = new Date();
    const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' }).toUpperCase();

    const bars = [3,1,4,2,1,3,2,1,4,2,1,3,1,4,2,3,1,2,4,1,3,2,1,4,2,1,3,2,4,1,2,3,1,4,2,1,3,2,1,4,3,1,2,1,3,4,2,1];
    let bx = 0;
    let barcodeSvg = `<svg width="200" height="44" viewBox="0 0 200 44" style="display:block;margin:0 auto;">`;
    bars.forEach((w, i) => {
        if (i % 2 === 0) barcodeSvg += `<rect x="${bx}" y="0" width="${w}" height="40" fill="#1a1a1a"/>`;
        bx += w + 1;
    });
    barcodeSvg += `</svg>`;

    const tabs = [
        { filter: 'all',    label: 'ALL' },
        { filter: 'debt',   label: 'DEBT' },
        { filter: 'food',   label: 'FOOD' },
        { filter: 'tasks',  label: 'TASKS' },
        { filter: 'budget', label: 'BUDGET' },
    ];


    content.innerHTML = `
        <div class="receipt-filter-bar">
            ${tabs.map(t => `
                <button class="rcpt-tab"
                    data-filter="${t.filter}"
                    onclick="setReceiptFilter('${t.filter}')"
                    style="
                        background: ${t.filter === activeReceiptFilter ? '#1a1a1a' : 'transparent'};
                        color:      ${t.filter === activeReceiptFilter ? '#f5f0e8' : '#888'};
                        border-color: ${t.filter === activeReceiptFilter ? '#1a1a1a' : '#ccc'};
                    ">
                    ${t.label}
                </button>
            `).join('')}
        </div>

        <div class="receipt-wrapper">
            <div class="thermal-receipt">

                <div class="receipt-logo">
                    <h1>FLUX</h1>
                    <p>PERSONAL OS  ·  V3.0</p>
                </div>

                <span class="receipt-stamp">MONTHLY REPORT</span>

                <p class="receipt-meta">
                    ENGINEER #001<br>
                    ${monthName}<br>
                    PRINTED: ${now.toLocaleDateString('en-CA')} ${now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
                </p>

                <div class="receipt-divider"></div>

                <div id="receiptBody"></div>

                <div class="receipt-divider"></div>

                <div class="receipt-barcode">
                    ${barcodeSvg}
                    <p>FLUX-OS-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}</p>
                </div>

                <p class="receipt-footer">*** THANK YOU, ENGINEER ***</p>

            </div>
        </div>
    `;

    renderReceiptBody();
}

window.setReceiptFilter = setReceiptFilter;




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

// ==========================================
// 🕒 BAGO: LIVE CLOCK & DATE
// ==========================================
function updateClock() {
    let clockEl = document.getElementById('liveClock');
    if (!clockEl) return;
    
    let now = new Date();
    // Ex format: "Thu, Apr 2, 2026 | 11:19 AM"
    let options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' };
    clockEl.innerText = now.toLocaleString('en-US', options).replace(',', ' |');
}
// I-run agad tapos i-set na mag-update kada isang segundo (1000ms)
updateClock();
setInterval(updateClock, 1000);

// ==========================================
// 🔄 BAGO: FORCE UPDATE / CLEAR CACHE
// ==========================================
function forceUpdateApp() {
    if (confirm("I-force update ang FLUX OS? (Magki-clear ito ng cache at mag-rerefresh para makuha ang latest code)")) {
        
        // 1. Unregister lahat ng naka-cache na Service Workers
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(function(registrations) {
                for(let registration of registrations) {
                    registration.unregister();
                }
                // 2. Force hard reload from server (bypass cache)
                window.location.reload(true);
            });
        } else {
            // Kung walang service worker, normal reload lang
            window.location.reload(true);
        }
    }
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
                    initRealtimeBudgetConfig();
                    initRealtimeAiAnalyses();
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
window.deleteTask = deleteTask;
window.deleteHabit = deleteHabit;
window.deleteTransaction = deleteTransaction;
window.openDailySummary = openDailySummary;
window.forceUpdateApp = forceUpdateApp;
window.setUtangView = setUtangView;
