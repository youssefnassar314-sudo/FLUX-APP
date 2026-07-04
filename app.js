// ==========================================
// 🔊 SOUND ENGINE (COSMIC UI)
// ==========================================
const soundFX = {
    click: new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'),
    success: new Audio('https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3'),
    transition: new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3')
};

function playSound(type) {
    if (soundFX[type]) {
        soundFX[type].volume = 0.2; 
        soundFX[type].currentTime = 0; 
        soundFX[type].play().catch(e => console.log("Sound blocked by browser until first interaction."));
    }
}

// ==========================================
// 🔗 GOOGLE SHEETS SYNC ENGINE
// ==========================================
const GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/AKfycbzmUohkXuIy00zUn4csr1EQAHuuhGVnTgWQtOSw6E7oJcd_JALvNfvj3-CXpbLP343o/exec";

async function syncToSheets(payload) {
    try {
        await fetch(GOOGLE_SHEETS_URL, {
            method: 'POST',
            mode: 'no-cors', // Para iwas error sa browser security
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(payload)
        });
        console.log("Synced to Sheets:", payload.action);
    } catch (e) {
        console.error("Sheet sync failed:", e);
    }
}

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
let monthlyTarget = 0;
let monthlySpent = 0;
let budgetDocId = null;

let dueCounter = 1; 
let currentDateView = new Date(); 
let transactionDatabase = [];

let currentUtangView = 'date';
let lastFoodSummaryCache = null; // instant restore cache 

const NAV_VISIBLE_SCREENS = ['dashboardScreen', 'utangScreen', 'taskScreen', 'kanbanScreen', 'foodScreen', 'budgetScreen', 'summaryScreen', 'wishlistScreen', 'statsScreen', 'quotesScreen', 'paylaterScreen'];

function switchScreen(screenId) {
    playSound('transition'); 
    let screens = document.querySelectorAll('.screen');
    screens.forEach(screen => screen.classList.remove('active-screen'));
    document.getElementById(screenId).classList.add('active-screen');
    
    if (screenId === 'utangScreen') renderUtangList();
    if (screenId === 'taskScreen') { renderTasks(); renderKanban(); }
    if (screenId === 'foodScreen') { renderFoodList(); if (lastFoodSummaryCache) applyFoodSummaryUI(lastFoodSummaryCache); }
    if (screenId === 'budgetScreen') updateBudgetDashboard();
    if (screenId === 'kanbanScreen') renderKanban();
    if (screenId === 'dashboardScreen') updateQuickGlance();
    if (screenId === 'wishlistScreen') renderWishlist();
    if (screenId === 'statsScreen') renderStats();
    if (screenId === 'quotesScreen') renderQuotesScreen();
    if (screenId === 'paylaterScreen') renderPaylaterAccounts();

    let bottomNav = document.getElementById('bottomNav');
    if (bottomNav) {
        if (NAV_VISIBLE_SCREENS.includes(screenId)) {
            bottomNav.style.display = 'flex';
            bottomNav.querySelectorAll('.nav-btn').forEach(btn => {
                btn.classList.toggle('active', btn.getAttribute('data-nav') === screenId);
            });
        } else {
            bottomNav.style.display = 'none';
        }
    }
}

// ==========================================
// 💸 MODULE 1: UTANG TRACKER (FIREBASE)
// ==========================================
function setUtangView(mode) {
    currentUtangView = mode;
    let btnDate = document.getElementById('btnViewDate');
    let btnApp = document.getElementById('btnViewApp');
    if (btnDate && btnApp) {
        btnDate.classList.toggle('active', mode === 'date');
        btnApp.classList.toggle('active', mode === 'app');
    }
    renderUtangList(); 
}

function showAddForm() {
    let overlay = document.getElementById('addUtangModalOverlay');
    if (overlay) overlay.style.display = 'flex';
}

function closeAddUtangForm() {
    let overlay = document.getElementById('addUtangModalOverlay');
    if (overlay) overlay.style.display = 'none';
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
            <button type="button" onclick="playSound('click'); this.closest('.due-row').remove()" style="background: rgba(194, 86, 79, 0.1); color: var(--danger); border: 1px solid rgba(194, 86, 79, 0.2); padding: 0 10px; border-radius: 5px; cursor: pointer; font-size: 16px;"><i class="ph-bold ph-trash"></i></button>
        </div>
    `;
    container.appendChild(newRow);
}

async function saveUtang() {
    let category = document.getElementById('utangCategory').value;
    let appName = document.getElementById('appName').value;
    let utangId = document.getElementById('utangId').value;

    if (!utangId) { alert("Pakilagay yung 6-digit Utang ID!"); return; }
    if (!appName) appName = "N/A";

    let amounts = document.querySelectorAll('.dynamic-amt');
    let dates = document.querySelectorAll('.dynamic-date');

    try {
        for (let i = 0; i < amounts.length; i++) {
            let amt = parseFloat(amounts[i].value);
            // I-check kung disabled ang date picker (meaning 'Flexible' naka-check)
            let dateVal = dates[i].disabled ? "Flexible" : dates[i].value;

            if (!isNaN(amt) && (dateVal !== "" && dateVal !== undefined)) {
    // 1. Kunin muna yung reference ng bagong document para makuha yung ID
    let docRef = await window.dbMethods.addDoc(window.dbMethods.collection(window.db, "utang"), {
        userId: window.currentUid,
        utangId: utangId + ` (Due ${i + 1})`,
        amount: amt,
        dueDate: dateVal, 
        isPaid: false,
        category: category,
        appName: appName,
        createdAt: Date.now()
    });

    // 2. I-send ang data sa Google Sheets!
    syncToSheets({
        action: 'addUtang',
        firebaseId: docRef.id,
        utangId: utangId + ` (Due ${i + 1})`,
        appName: appName,
        amount: amt,
        dueDate: dateVal,
        category: category
    });
}
        }
        playSound('success'); 
        document.getElementById('utangId').value = ''; document.getElementById('appName').value = '';
        document.getElementById('duesContainer').innerHTML = `
            <div class="due-row">
                <label style="font-size: 11px; color: var(--primary); font-weight: 700; display: block; margin-bottom: 8px; text-transform: uppercase;">Due 1:</label>
                <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                    <input type="number" class="dynamic-amt" placeholder="Amount" style="flex: 1;">
                    <input type="date" class="dynamic-date" style="flex: 1;">
                </div>
            </div>`;
        dueCounter = 1; closeAddUtangForm();
    } catch (e) { console.error(e); alert("May error sa pag-save ng utang!"); }
}

function openPayUtangModal(id, amount, utangIdLabel) {
    if (myWallets.length === 0) return alert("Gumawa ka muna ng wallet sa Budget tab!");
    playSound('click');
    document.getElementById('payUtangId').value = id;
    document.getElementById('payUtangAmount').value = amount; // Ito yung reference natin sa buong balanse
    document.getElementById('payUtangDetails').innerText = `Balanse: ID ${utangIdLabel} (₱${amount.toLocaleString()})`;
    
    let payInput = document.getElementById('payUtangAmountInput');
    if(payInput) payInput.value = amount; // Default ay full payment

    let select = document.getElementById('payUtangWallet');
    select.innerHTML = '<option value="">Saan kukunin ang pera?</option>';
    myWallets.forEach(w => { select.innerHTML += `<option value="${w.id}">${w.name} (Bal: ₱${parseFloat(w.balance).toLocaleString()})</option>`; });
    
    let interestInput = document.getElementById('payUtangInterest');
    if(interestInput) interestInput.value = '';
    
    document.getElementById('payUtangModal').style.display = 'flex';
}

async function confirmPayUtang() {
    let utangIds = document.getElementById('payUtangId').value.split(','); 
    let baseAmount = parseFloat(document.getElementById('payUtangAmount').value); // Original balance
    let inputAmount = parseFloat(document.getElementById('payUtangAmountInput').value); // Magkano ibabayad
    
    // Kunin yung interest input kung meron man na nilagay (mula sa previous update natin)
    let interestInput = document.getElementById('payUtangInterest');
    let interestAmount = interestInput ? (parseFloat(interestInput.value) || 0) : 0;
    
    if (isNaN(inputAmount) || inputAmount <= 0) return alert("Pakilagay ng tamang amount na ibabayad.");
    if (inputAmount > baseAmount) return alert("Sobra yung ibabayad mo sa mismong utang balance!");

    let isPartial = inputAmount < baseAmount;
    if (isPartial && utangIds.length > 1) {
        return alert("Oops! Kapag 'Pay Full Bal' (maraming dues), hindi pwede ang partial. Pakibayaran nang isahan kung partial ang ipapasok mo.");
    }

    let totalAmountToPay = inputAmount + interestAmount;
    let walletId = document.getElementById('payUtangWallet').value;
    let utangLabel = document.getElementById('payUtangDetails').innerText;

    if (!walletId) return alert("Pumili ng wallet!");
    let walletObj = myWallets.find(w => w.id === walletId);
    if (!walletObj || parseFloat(walletObj.balance) < totalAmountToPay) return alert("Kulang ang pondo mo para sa utang (at interest)!");

    try {
        // Bawas sa wallet ng total amount (kasama interest)
        await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "wallets", walletId), { balance: parseFloat(walletObj.balance) - totalAmountToPay });
        
        // Update Firebase
        let fullyPaidIds = [];
        for (let id of utangIds) {
            if (id) {
                if (isPartial) {
                    // Update lang yung natitirang amount at i-save ang partial record
                    let remainingBalance = baseAmount - inputAmount;
                    let currentUtang = utangDatabase.find(u => u.id === id);
                    let existingPartials = currentUtang.partials || [];
                    
                    let newPartial = {
                        id: 'P_' + Date.now().toString(),
                        amount: inputAmount,
                        date: Date.now(),
                        walletId: walletId,
                        walletName: walletObj.name
                    };
                    existingPartials.push(newPartial);

                    await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "utang", id), { 
                        amount: remainingBalance,
                        partials: existingPartials
                    });
                } else {
                    // Full payment para dito — i-record kung KAILAN talaga nagbayad (hindi yung due date)
                    await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "utang", id), { isPaid: true, paidAt: Date.now() });
                    fullyPaidIds.push(id);
                    syncToSheets({ action: 'payUtang', firebaseId: id });
                }
            }
        }

        // Transaction Note Styling
        let cleanUtangLabel = utangLabel.split('(')[0].replace('Balanse: ', '').trim();
        let paymentType = isPartial ? "Partial Pay" : "Bayad Utang";
        let transactionNote = interestAmount > 0 
            ? `${paymentType}: ${cleanUtangLabel} (+₱${interestAmount} Interest)` 
            : `${paymentType}: ${cleanUtangLabel}`;

        // Save sa Transactions History — naka-link sa mismong utang IDs para ma-undo nang tama sa hinaharap
        await window.dbMethods.addDoc(window.dbMethods.collection(window.db, "transactions"), {
            userId: window.currentUid, type: 'expense', walletId: walletId, amount: totalAmountToPay,
            note: transactionNote, category: "Debt Payment", paidFromWallet: walletObj.name, linkedUtangIds: fullyPaidIds, createdAt: Date.now()
        });
        playSound('success'); 
        closeBudgetModals();
    } catch (e) { console.error(e); }
}

// BAGONG FUNCTION PARA SA FULL PAYMENT
function openPayFullUtang(baseId) {
    // Hahanapin lahat ng dues sa ilalim ng ID na 'to na isPaid = false
    let unpaidItems = utangDatabase.filter(u => u.utangId.split(' (Due')[0] === baseId && !u.isPaid);
    if(unpaidItems.length === 0) return alert("Bayad na lahat ng dues para dito!");
    
    // Ipag-add yung total utang
    let totalAmount = unpaidItems.reduce((sum, u) => sum + u.amount, 0);
    // Pagsasamahin yung mga Firebase IDs nila gamit ang comma
    let ids = unpaidItems.map(u => u.id).join(',');
    
    if (myWallets.length === 0) return alert("Gumawa ka muna ng wallet sa Budget tab!");
    playSound('click');
    
    document.getElementById('payUtangId').value = ids; // Naka-store dito lahat ng IDs
    document.getElementById('payUtangAmount').value = totalAmount;
    document.getElementById('payUtangDetails').innerText = `Balanse: FULL BALANCE ID ${baseId} (₱${totalAmount.toLocaleString()})`;
    
    let payInput = document.getElementById('payUtangAmountInput');
    if(payInput) payInput.value = totalAmount; // Default ay full payment

    let select = document.getElementById('payUtangWallet');
    select.innerHTML = '<option value="">Saan kukunin ang pera?</option>';
    myWallets.forEach(w => { select.innerHTML += `<option value="${w.id}">${w.name} (Bal: ₱${parseFloat(w.balance).toLocaleString()})</option>`; });
    
    let interestInput = document.getElementById('payUtangInterest');
    if(interestInput) interestInput.value = '';

    document.getElementById('payUtangModal').style.display = 'flex';
}

function changeMonth(offset) { currentDateView.setMonth(currentDateView.getMonth() + offset); renderUtangList(); }

function initRealtimeUtang() {
    const q = window.dbMethods.query(window.dbMethods.collection(window.db, "utang"), window.dbMethods.where("userId", "==", window.currentUid));
    window.dbMethods.onSnapshot(q, (snapshot) => {
        utangDatabase = []; runningTotalUtang = 0; runningTotalBayad = 0;
        snapshot.forEach(doc => {
            let data = doc.data(); utangDatabase.push({ id: doc.id, ...data, dueDate: new Date(data.dueDate) });
            if (data.isPaid) runningTotalBayad += data.amount; else runningTotalUtang += data.amount;
        });
        document.getElementById('displayTotalUtang').innerText = runningTotalUtang.toFixed(2);
        document.getElementById('displayTotalBayad').innerText = runningTotalBayad.toFixed(2);
        updateQuickGlance(); renderUtangList();
    });
}

function getUtangStatusInfo(utang, isFlex) {
    if (utang.isPaid) return { label: 'Paid', tone: 'tone-green' };
    if (isFlex) return { label: 'Flexible', tone: 'tone-blue' };
    let today = new Date(); today.setHours(0,0,0,0);
    let due = new Date(utang.dueDate); due.setHours(0,0,0,0);
    let diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { label: 'Overdue', tone: 'tone-pink' };
    if (diffDays === 0) return { label: 'Due today', tone: 'tone-pink' };
    if (diffDays === 1) return { label: 'Due tomorrow', tone: 'tone-amber' };
    if (diffDays <= 3) return { label: `${diffDays} days left`, tone: 'tone-amber' };
    return { label: `${diffDays} days left`, tone: 'tone-green' };
}

function renderUtangList() {
    let container = document.getElementById('utangListContainer'); container.innerHTML = ''; 
    let viewMonthName = currentDateView.toLocaleString('default', { month: 'long', year: 'numeric' });
    document.getElementById('currentMonthLabel').innerText = viewMonthName;

    // Kukunin yung value sa search bar
    let searchInput = document.getElementById('searchUtangId');
    let searchVal = searchInput ? searchInput.value.toLowerCase().trim() : '';

    let filteredUtang = utangDatabase.filter(utang => {
        // Kapag "Flexible", isama palagi sa display kahit anong buwan
        if (isNaN(utang.dueDate)) return true;
        // Kapag may date, i-check kung tugma sa current view
        return utang.dueDate.getMonth() === currentDateView.getMonth() && utang.dueDate.getFullYear() === currentDateView.getFullYear();
    });
    
    // Compute total utang BEFORE filtering para hindi bumaba yung display sa stat boxes
    // Hindi kasama ang Flexible entries dito — wala silang eksaktong due date kaya hindi dapat sila
    // isama sa "due this month" na computation (pero nananatili silang visible sa listahan mismo).
    let monthUtang = 0; let monthBayad = 0;
    filteredUtang.forEach(u => { if (isNaN(u.dueDate)) return; if (u.isPaid) monthBayad += u.amount; else monthUtang += u.amount; });
    document.getElementById('displayMonthUtang').innerText = monthUtang.toFixed(2);
    document.getElementById('displayMonthBayad').innerText = monthBayad.toFixed(2);

    // Apply Search Filter for Date View
    if (searchVal) {
        filteredUtang = filteredUtang.filter(u => u.utangId.toLowerCase().includes(searchVal));
    }
    filteredUtang.sort((a, b) => a.isPaid - b.isPaid || a.dueDate - b.dueDate);

if (currentUtangView === 'date') {
        if (filteredUtang.length === 0) { container.innerHTML = `<p style="text-align: center; color: var(--text-muted); font-style: italic; margin-top: 30px;">Walang due para sa buwang ito.</p>`; return; }
        
        let unpaidHTML = '';
        let paidHTML = '';
        
        filteredUtang.forEach(utang => {
            let isFlex = isNaN(utang.dueDate);
            let isMyApp = utang.category === 'My App';
            let avatarTone = isMyApp ? 'tone-peach' : 'tone-blue';
            let avatarIcon = isMyApp ? 'ph-device-mobile' : 'ph-user';
            let status = getUtangStatusInfo(utang, isFlex);
            let dueLabel = isFlex ? 'Flexible' : utang.dueDate.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' });
            let metaLine = `${utang.utangId} • Due ${dueLabel}`;
            if (utang.isPaid && utang.paidAt) {
                metaLine += ` • Paid ${new Date(utang.paidAt).toLocaleDateString('default', { month: 'short', day: 'numeric' })}`;
            }

            let cardContent = `<div class="utang-card list-card" style="${utang.isPaid ? 'opacity: 0.55;' : ''}">
                <button onclick="playSound('click'); deleteUtang('${utang.id}')" class="list-card-close"><i class="ph-bold ph-x"></i></button>
                <button onclick="playSound('click'); openEditUtangModal('${utang.id}')" class="list-card-close" style="right: 32px;"><i class="ph-bold ph-pencil-simple"></i></button>
                <div class="list-card-row" style="margin-bottom: 12px;">
                    <div class="list-card-avatar ${avatarTone}"><i class="ph-duotone ${avatarIcon}"></i></div>
                    <div class="list-card-main">
                        <p class="list-card-title">${utang.appName}</p>
                        <p class="list-card-meta" style="font-family: monospace;">${metaLine}</p>
                    </div>
                    <span class="pill-badge ${status.tone}">${status.label}</span>
                </div>
                ${(utang.partials && utang.partials.length > 0) ? `
                <div style="margin: 0 0 10px; border-top: 1px dashed var(--glass-border); padding-top: 10px;">
                    <span style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px;">↳ Partial Payments:</span>
                    ${utang.partials.map(p => `
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 5px; font-size: 11px;">
                            <span style="color: var(--text-main);">₱${p.amount.toFixed(2)} <span style="color: var(--text-muted);">(${new Date(p.date).toLocaleDateString('default', { month: 'short', day: 'numeric' })} - ${p.walletName})</span></span>
                            <button onclick="playSound('click'); undoPartialPayment('${utang.id}', '${p.id}')" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size: 14px; padding: 0;"><i class="ph-bold ph-x"></i></button>
                        </div>
                    `).join('')}
                </div>
                ` : ''}
                <div class="list-card-action-row">
                    <div class="list-card-amount" style="font-size: 19px;">₱${utang.amount.toFixed(2)}</div>
                    ${utang.isPaid
                        ? `<button class="pay-pill-btn" style="background: var(--pastel-green-bg); color: var(--pastel-green-fg);" onclick="playSound('click'); undoFullPayment('${utang.id}')"><i class="ph-bold ph-arrow-counter-clockwise"></i> Undo</button>`
                        : `<button class="pay-pill-btn" onclick="openPayUtangModal('${utang.id}', ${utang.amount}, '${utang.utangId}')">Pay</button>`}
                </div>
            </div>`;

            if (utang.isPaid) paidHTML += cardContent;
            else unpaidHTML += cardContent;
        });

        // Ilalabas muna lahat ng unpaid
        container.innerHTML += unpaidHTML ? `<p class="section-label tone-pink">Active</p>${unpaidHTML}` : '';

        // Kung may bayad na, gagawan natin ng clickable folder sa ibaba
        if (paidHTML !== '') {
            container.innerHTML += `
            <div class="date-section">
                <button onclick="playSound('click'); togglePaidFolder()" style="width: 100%; background: none; border: none; color: var(--success); border-bottom: 2px solid rgba(78, 154, 107, 0.2); padding-bottom: 10px; font-size: 14px; margin-top: 25px; text-align: left; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-weight: 700;">
                    <span><i class="ph-bold ph-check-circle"></i> Paid This Month</span>
                    <i id="paidFolderIcon" class="ph-bold ph-caret-down"></i>
                </button>
            </div>
            <div id="paidUtangFolder" style="display: none; margin-top: 15px;">
                ${paidHTML}
            </div>`;
        }
} else {
        // Apply Search Filter for App View
        let baseData = searchVal ? utangDatabase.filter(u => u.utangId.toLowerCase().includes(searchVal)) : utangDatabase;
        
        if (baseData.length === 0) { container.innerHTML = `<p style="text-align: center; color: var(--text-muted); font-style: italic; margin-top: 30px;">Walang nahanap na Utang ID.</p>`; return; }
        
        let apps = {}; let allUtangSorted = [...baseData].sort((a, b) => a.dueDate - b.dueDate);
        allUtangSorted.forEach(u => {
            let appName = u.appName && u.appName !== "N/A" ? u.appName : "Other Utang"; let baseId = u.utangId.split(' (Due')[0]; 
            if(!apps[appName]) apps[appName] = {};
            if(!apps[appName][baseId]) apps[appName][baseId] = { totalAmount: 0, totalPaid: 0, items: [] };
            apps[appName][baseId].items.push(u); apps[appName][baseId].totalAmount += u.amount;
            if(u.isPaid) apps[appName][baseId].totalPaid += u.amount;
        });

        for (let app in apps) {
            container.innerHTML += `<div class="date-section"><h3 style="color: var(--secondary); border-bottom: 2px solid rgba(108, 79, 148, 0.2); padding-bottom: 5px; font-size: 14px; margin-top: 25px; text-transform: uppercase; letter-spacing: 1px;"><i class="ph-bold ph-device-mobile"></i> ${app}</h3></div>`;
            for (let id in apps[app]) {
                let group = apps[app][id]; let allPaid = group.items.every(u => u.isPaid);
                let cardStyle = allPaid ? 'opacity: 0.5; background-color: var(--glass-bg); border-left: 4px solid var(--success);' : 'background: var(--card-bg); border-left: 4px solid var(--secondary);';
                let duesHTML = group.items.map(u => {
                    let isFlex = isNaN(u.dueDate);
                    let dateDisplay = isFlex ? 'Flexible' : `${u.dueDate.toLocaleString('default', { month: 'short' })} ${u.dueDate.getDate()}${u.dueDate.getFullYear() !== new Date().getFullYear() ? ` '${u.dueDate.getFullYear().toString().slice(-2)}` : ''}`;
                    
                    let dueLabel = u.utangId.includes('(Due') ? u.utangId.split('(')[1].replace(')', '') : 'Full';
                    let controls = u.isPaid ? `<button onclick="playSound('click'); undoFullPayment('${u.id}')" style="background: var(--pastel-green-bg); border: none; color: var(--pastel-green-fg); padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: bold; cursor: pointer;"><i class="ph-bold ph-arrow-counter-clockwise"></i> Paid${u.paidAt ? ' ' + new Date(u.paidAt).toLocaleDateString('default', { month: 'short', day: 'numeric' }) : ''}</button>` : `<button onclick="openPayUtangModal('${u.id}', ${u.amount}, '${u.utangId}')" style="background:none; border:1px solid var(--primary); color:var(--primary); padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: bold; cursor: pointer;">Pay</button>`;
                    return `<div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed var(--glass-border); padding-top: 10px; margin-top: 10px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <button onclick="playSound('click'); openEditUtangModal('${u.id}')" style="background:none; border:none; color:var(--text-muted); font-size:14px; cursor:pointer; padding:0;"><i class="ph-bold ph-pencil-simple"></i></button>
                            <button onclick="playSound('click'); deleteUtang('${u.id}')" style="background:none; border:none; color:var(--danger); font-size:14px; cursor:pointer; padding:0;"><i class="ph-bold ph-x"></i></button>
                            <span style="font-size: 11px; color: var(--text-muted);"><strong style="color:var(--text-main);">${dueLabel}</strong> • ${dateDisplay}</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;"><span style="font-size: 13px; color: var(--text-main);">₱${u.amount.toFixed(2)}</span>${controls}</div>
                    </div>
                    ${(u.partials && u.partials.length > 0) ? `
                    <div style="margin-top: 5px; padding-left: 15px; border-left: 2px solid var(--glass-border);">
                        ${u.partials.map(p => `
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px; font-size: 10px;">
                                <span style="color: var(--text-muted);">↳ Partial: <strong style="color: var(--text-main);">₱${p.amount.toFixed(2)}</strong> via ${p.walletName}</span>
                                <button onclick="playSound('click'); undoPartialPayment('${u.id}', '${p.id}')" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size: 12px; padding: 0;"><i class="ph-bold ph-x"></i></button>
                            </div>
                        `).join('')}
                    </div>
                    ` : ''}`;
                }).join('');
let payAllBtn = !allPaid ? `<button onclick="playSound('click'); openPayFullUtang('${id}')" style="background: rgba(78, 154, 107, 0.1); border: 1px solid rgba(78, 154, 107, 0.3); color: var(--success); padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: bold; cursor: pointer; text-transform: uppercase; letter-spacing: 1px;"><i class="ph-bold ph-check-circle"></i> Pay Full Bal</button>` : '';

                container.innerHTML += `<div class="utang-card" style="${cardStyle} margin-bottom: 12px; padding: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                        <span style="font-size: 10px; font-weight: 700; background: var(--glass-bg); padding: 3px 8px; border-radius: 5px; text-transform: uppercase;">ID: ${id}</span>
                        <span style="font-size: 11px; color: ${allPaid ? 'var(--success)' : 'var(--danger)'};">Balance: ₱${(group.totalAmount - group.totalPaid).toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin: 5px 0 0 0;">
                        <h4 style="margin: 0; font-size: 16px; color: var(--text-main);">Total: ₱${group.totalAmount.toFixed(2)}</h4>
                        ${payAllBtn}
                    </div>
                    ${duesHTML}
                </div>`;
            }
        }
    }
}

function togglePaidFolder() {
    let folder = document.getElementById('paidUtangFolder');
    let icon = document.getElementById('paidFolderIcon');
    if (folder) {
        if (folder.style.display === 'none') {
            folder.style.display = 'block';
            if (icon) icon.className = 'ph-bold ph-caret-up';
        } else {
            folder.style.display = 'none';
            if (icon) icon.className = 'ph-bold ph-caret-down';
        }
    }
}

function openEditUtangModal(id) {
    let utang = utangDatabase.find(u => u.id === id);
    if (!utang) return;
    document.getElementById('editUtangId').value = id;
    document.getElementById('editUtangAppName').value = utang.appName || '';
    document.getElementById('editUtangAmount').value = utang.amount;
    let isFlex = isNaN(utang.dueDate instanceof Date ? utang.dueDate : new Date(utang.dueDate));
    document.getElementById('editUtangFlexible').checked = isFlex;
    document.getElementById('editUtangDueDate').disabled = isFlex;
    document.getElementById('editUtangDueDate').value = isFlex ? '' : new Date(utang.dueDate).toISOString().split('T')[0];
    document.getElementById('editUtangModal').style.display = 'flex';
}

function closeEditUtangModal() {
    document.getElementById('editUtangModal').style.display = 'none';
}

async function saveEditUtang() {
    let id = document.getElementById('editUtangId').value;
    let appName = document.getElementById('editUtangAppName').value.trim();
    let amount = parseFloat(document.getElementById('editUtangAmount').value);
    let isFlex = document.getElementById('editUtangFlexible').checked;
    let dueDateVal = isFlex ? 'Flexible' : document.getElementById('editUtangDueDate').value;

    if (!appName || isNaN(amount) || amount <= 0 || !dueDateVal) { alert("Kumpletuhin ang App Name, Amount, at Due Date!"); return; }

    try {
        await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "utang", id), { appName: appName, amount: amount, dueDate: dueDateVal });
        playSound('success');
        closeEditUtangModal();
    } catch (e) { console.error(e); alert("May error sa pag-save ng changes."); }
}
window.openEditUtangModal = openEditUtangModal; window.closeEditUtangModal = closeEditUtangModal; window.saveEditUtang = saveEditUtang;

async function deleteUtang(id) {
    if (confirm("Sigurado ka bang gusto mong burahin ang utang na ito? Hindi na ito maibabalik.")) {
        try { await window.dbMethods.deleteDoc(window.dbMethods.doc(window.db, "utang", id)); playSound('click'); } catch (e) { console.error(e); }
    }
}
// ==========================================
// 🚀 MODULE 2: TASKS, DEADLINES & HABITS (FIREBASE)
// ==========================================
async function estimateAITask() {
    let title = document.getElementById('aiTaskTitle').value; let details = document.getElementById('aiTaskDetails').value;
    let category = document.getElementById('aiTaskCategory').value; let dateVal = document.getElementById('aiTaskDate').value;
    if (!title || !dateVal) { alert("Pakilagay ang Task Title at Date!"); return; }
    let aiBtn = document.querySelector('button[onclick="playSound(\'click\'); estimateAITask()"]'); 
    let originalText = aiBtn ? aiBtn.innerHTML : "Estimate with AI";
    if (aiBtn) { aiBtn.innerHTML = '<i class="ph-bold ph-hourglass"></i> FLUX AI is thinking...'; aiBtn.disabled = true; }
    try {
        const response = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'estimateTask', title: title, details: details, category: category }) });
        const data = await response.json(); let estMins = data.estMins || 30;
        alert(`FLUX AI says: Naisip ko na! Yung "${title}" aabutin yan ng mga ${estMins} minutes.`);
        await window.dbMethods.addDoc(window.dbMethods.collection(window.db, "tasks"), { userId: window.currentUid, title: title, category: category, dueDate: dateVal, estMins: estMins, status: 'todo', createdAt: Date.now() });
        playSound('success');
        document.getElementById('aiTaskTitle').value = ''; document.getElementById('aiTaskDetails').value = ''; document.getElementById('aiTaskDate').value = '';
    } catch (e) { console.error(e); alert("API Error. Hindi maka-connect sa FLUX AI."); } finally { if(aiBtn) { aiBtn.innerHTML = originalText; aiBtn.disabled = false; } }
}

async function saveManualTask() {
    let title = document.getElementById('manualTaskTitle').value; let category = document.getElementById('manualTaskCategory').value;
    let dateVal = document.getElementById('manualTaskDate').value; let mins = document.getElementById('manualTaskMins').value;
    if (!title || !dateVal) { alert("Pakikumpleto ang Manual Task details!"); return; }
    await window.dbMethods.addDoc(window.dbMethods.collection(window.db, "tasks"), { userId: window.currentUid, title: title, category: category, dueDate: dateVal, estMins: parseInt(mins) || 0, status: 'todo', createdAt: Date.now() });
    playSound('success');
    document.getElementById('manualTaskTitle').value = ''; document.getElementById('manualTaskDate').value = ''; document.getElementById('manualTaskMins').value = '';
}

async function saveHabit() {
    let name = document.getElementById('habitName').value; let timeVal = document.getElementById('habitTime').value;
    if (!name || !timeVal) { alert("Pakilagay yung Habit at Oras!"); return; }
    await window.dbMethods.addDoc(window.dbMethods.collection(window.db, "habits"), { userId: window.currentUid, name: name, time: timeVal, lastDoneDate: "", createdAt: Date.now() });
    playSound('success');
    document.getElementById('habitName').value = ''; document.getElementById('habitTime').value = '';
}

async function markHabitDone(id) {
    playSound('click');
    let todayStr = new Date().toLocaleDateString('en-CA');
    await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "habits", id), { lastDoneDate: todayStr });
}

function initRealtimeTasks() {
    const qTasks = window.dbMethods.query(window.dbMethods.collection(window.db, "tasks"), window.dbMethods.where("userId", "==", window.currentUid));
    window.dbMethods.onSnapshot(qTasks, (snapshot) => {
        taskDatabase = [];
        snapshot.forEach(doc => taskDatabase.push({ id: doc.id, ...doc.data(), dueDate: new Date(doc.data().dueDate) }));
        renderTasks(); renderKanban(); updateQuickGlance();
    });
    const qHabits = window.dbMethods.query(window.dbMethods.collection(window.db, "habits"), window.dbMethods.where("userId", "==", window.currentUid));
    window.dbMethods.onSnapshot(qHabits, (snapshot) => {
        habitDatabase = []; snapshot.forEach(doc => habitDatabase.push({ id: doc.id, ...doc.data() })); renderTasks();
    });
}

async function deleteTask(id) { if (confirm("Sigurado ka bang gusto mong burahin ang task na ito?")) { try { await window.dbMethods.deleteDoc(window.dbMethods.doc(window.db, "tasks", id)); playSound('click'); } catch(e) { console.error(e); } } }
async function deleteHabit(id) { if (confirm("Sigurado ka bang gusto mong burahin ang habit na ito?")) { try { await window.dbMethods.deleteDoc(window.dbMethods.doc(window.db, "habits", id)); playSound('click'); } catch(e) { console.error(e); } } }

async function moveTaskStatus(id, newState) {
    playSound('click');
    let task = taskDatabase.find(t => t.id === id); if(!task) return;
    let now = Date.now(); let updates = { status: newState }; let elapsedMins = 0;
    if (task.lastStarted && (newState === 'paused' || newState === 'done' || newState === 'todo')) { elapsedMins = Math.floor((now - task.lastStarted) / 60000); }
    if (newState === 'doing') { updates.lastStarted = now; } else if (newState === 'paused' || newState === 'done' || newState === 'todo') { updates.timeSpent = (task.timeSpent || 0) + Math.max(0, elapsedMins); updates.lastStarted = null; }
    await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "tasks", id), updates);
}

function renderTasks() {
    let taskContainer = document.getElementById('taskListContainer'); let habitContainer = document.getElementById('habitListContainer'); let schedContainer = document.getElementById('schedListContainer');
    if(!taskContainer || !habitContainer) return; 
    taskContainer.innerHTML = `<p class="section-label">Pending Tasks</p>`;
    habitContainer.innerHTML = `<p class="section-label tone-green">Daily Habits</p>`;
    if (schedContainer) { schedContainer.innerHTML = `<p class="section-label tone-amber">Upcoming Sched</p>`; }

    let todayDateStr = new Date().toLocaleDateString('en-CA');
    let normalTasks = taskDatabase.filter(t => t.category !== 'Sched'); let schedTasks = taskDatabase.filter(t => t.category === 'Sched');

    if (normalTasks.length === 0) { taskContainer.innerHTML += '<p style="color: var(--text-muted); font-size: 12px; font-style: italic;">No pending tasks.</p>'; } else {
        normalTasks.forEach(task => {
            let isDone = task.status === 'done'; let isDoing = task.status === 'doing';
            let catTone = task.category === 'Work' ? 'tone-blue' : task.category === 'School' ? 'tone-purple' : 'tone-green';
            let catIcon = task.category === 'Work' ? 'ph-briefcase' : task.category === 'School' ? 'ph-graduation-cap' : 'ph-user';
            let totalSpent = task.timeSpent || 0; let est = task.estMins || 0;
            let runningText = isDoing ? `<span style="color: var(--primary);"> • ⏱️ Running...</span>` : '';
            let timeText = `<span style="font-size: 11px; color: var(--text-muted);"><i class="ph-bold ph-clock"></i> Spent: ${totalSpent}m / Est: ${est}m ${runningText}</span>`;
            let controlsHTML = '';
            if (isDone) { controlsHTML = `<span style="color: var(--success); font-weight: bold; font-size: 12px;"><i class="ph-bold ph-check-circle"></i> Completed (${totalSpent}m spent)</span>`; } else {
                let playPauseBtn = isDoing ? `<button style="background: var(--pastel-pink-bg); color: var(--danger); border: none; padding: 8px 12px; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 12px;" onclick="moveTaskStatus('${task.id}', 'paused')"><i class="ph-bold ph-pause"></i> Pause</button>` : `<button style="background: var(--pastel-blue-bg); color: var(--pastel-blue-fg); border: none; padding: 8px 12px; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 12px;" onclick="moveTaskStatus('${task.id}', 'doing')"><i class="ph-bold ph-play"></i> Play</button>`;
                controlsHTML = `<div style="display: flex; gap: 8px; margin-top: 10px;">${playPauseBtn}<button style="background: var(--pastel-green-bg); color: var(--success); border: none; padding: 8px 12px; border-radius: 10px; cursor: pointer; flex: 1; font-weight: 600; font-size: 12px;" onclick="moveTaskStatus('${task.id}', 'done')"><i class="ph-bold ph-check"></i> Finish Task</button></div>`;
            }
            taskContainer.innerHTML += `<div class="utang-card list-card" style="${isDone ? 'opacity: 0.55;' : ''} margin-bottom: 10px;">
                <button onclick="deleteTask('${task.id}')" class="list-card-close"><i class="ph-bold ph-x"></i></button>
                <div class="list-card-row" style="margin-bottom: 8px;">
                    <div class="list-card-avatar ${catTone}"><i class="ph-duotone ${catIcon}"></i></div>
                    <div class="list-card-main">
                        <p class="list-card-title">${task.title}</p>
                        <span class="pill-badge ${catTone}" style="margin-top:4px;">${task.category}</span>
                    </div>
                </div>
                ${timeText}${controlsHTML}</div>`;
        });
    }

    if (habitDatabase.length === 0) { habitContainer.innerHTML += '<p style="color: var(--text-muted); font-size: 12px; font-style: italic;">No habits yet.</p>'; } else {
        habitDatabase.forEach(habit => {
            let timeParts = (habit.time || "12:00").split(':'); let hour = parseInt(timeParts[0]);
            let formattedTime = (hour % 12 || 12) + ':' + (timeParts[1] || "00") + (hour >= 12 ? ' PM' : ' AM');
            let isDoneToday = habit.lastDoneDate === todayDateStr; 
            habitContainer.innerHTML += `<div class="utang-card list-card" style="${isDoneToday ? 'opacity: 0.55;' : ''} margin-bottom: 10px;">
                <button onclick="deleteHabit('${habit.id}')" class="list-card-close"><i class="ph-bold ph-x"></i></button>
                <div class="list-card-row" style="margin-bottom: 6px;">
                    <div class="list-card-avatar tone-green"><i class="ph-duotone ph-arrows-clockwise"></i></div>
                    <div class="list-card-main">
                        <p class="list-card-title">${habit.name}</p>
                        <p class="list-card-meta"><i class="ph-bold ph-clock"></i> ${formattedTime}</p>
                    </div>
                </div>
                <button class="paid-btn" style="border-color: var(--success); color: var(--success); margin-top: 4px; padding: 8px;" onclick="markHabitDone('${habit.id}')" ${isDoneToday ? 'disabled' : ''}>${isDoneToday ? '<i class="ph-bold ph-check"></i> Done Today' : 'Mark Done'}</button>
            </div>`;
        });
    }

    if (schedContainer) {
        if (schedTasks.length === 0) { schedContainer.innerHTML += '<p style="color: var(--text-muted); font-size: 12px; font-style: italic;">No upcoming schedules.</p>'; } else {
            schedTasks.forEach(task => {
                let isDone = task.status === 'done'; let dateObj = new Date(task.dueDate);
                let dateFormatted = isNaN(dateObj) ? "Date not set" : dateObj.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' });
                let controlsHTML = isDone ? `<span style="color: var(--success); font-weight: bold; font-size: 12px;"><i class="ph-bold ph-check-circle"></i> Event Completed</span>` : `<button class="paid-btn" style="border-color: var(--pastel-amber-fg); color: var(--pastel-amber-fg); padding: 8px; margin-top: 4px;" onclick="moveTaskStatus('${task.id}', 'done')"><i class="ph-bold ph-check"></i> Mark Done</button>`;
                schedContainer.innerHTML += `<div class="utang-card list-card" style="${isDone ? 'opacity: 0.55;' : ''} margin-bottom: 10px;">
                    <button onclick="deleteTask('${task.id}')" class="list-card-close"><i class="ph-bold ph-x"></i></button>
                    <div class="list-card-row" style="margin-bottom: 6px;">
                        <div class="list-card-avatar tone-amber"><i class="ph-duotone ph-calendar-blank"></i></div>
                        <div class="list-card-main">
                            <p class="list-card-title">${task.title}</p>
                            <p class="list-card-meta"><i class="ph-bold ph-calendar"></i> ${dateFormatted}</p>
                        </div>
                    </div>
                    ${controlsHTML}
                </div>`;
            });
        }
    }
}

function renderKanban() {
    let colTodo = document.getElementById('kb-todo'); let colDoing = document.getElementById('kb-doing'); let colDone = document.getElementById('kb-done');
    if(!colTodo || !colDoing || !colDone) return;
    colTodo.innerHTML = ''; colDoing.innerHTML = ''; colDone.innerHTML = '';
    let kanbanTasks = taskDatabase.filter(t => t.category !== 'Sched');
    kanbanTasks.forEach(task => {
        let actionButtons = ''; let cardHTML = '';
        if (task.status === 'todo') {
            actionButtons = `<button class="kb-btn" style="width: 100%; color: var(--primary);" onclick="moveTaskStatus('${task.id}', 'doing')">Start Task <i class="ph-bold ph-play"></i></button>`;
            cardHTML = `<div class="kanban-card"><h4 style="margin: 8px 0; font-size: 14px; color: var(--text-main);">${task.title}</h4><div class="kanban-actions">${actionButtons}</div></div>`;
            colTodo.innerHTML += cardHTML;
        } else if (task.status === 'doing' || task.status === 'paused') {
            let isPaused = task.status === 'paused';
            let playPauseBtn = isPaused ? `<button class="kb-btn" style="color: var(--primary);" onclick="moveTaskStatus('${task.id}', 'doing')"><i class="ph-bold ph-play"></i> Resume</button>` : `<button class="kb-btn" style="color: var(--danger);" onclick="moveTaskStatus('${task.id}', 'paused')"><i class="ph-bold ph-pause"></i> Pause</button>`;
            actionButtons = `${playPauseBtn}<button class="kb-btn" style="color: var(--success);" onclick="moveTaskStatus('${task.id}', 'done')"><i class="ph-bold ph-check"></i> Done</button>`;
            let statusLabel = isPaused ? `<span class="pill-badge tone-pink">Paused</span>` : `<span class="pill-badge tone-blue">Running...</span>`;
            cardHTML = `<div class="kanban-card" style="${isPaused ? 'opacity: 0.6;' : 'border-left: 3px solid var(--pastel-blue-fg);'}">${statusLabel}<h4 style="margin: 8px 0 8px 0; font-size: 14px; color: var(--text-main);">${task.title}</h4><div class="kanban-actions">${actionButtons}</div></div>`;
            colDoing.innerHTML += cardHTML;
        } else if (task.status === 'done') {
            actionButtons = `<button class="kb-btn" style="width: 100%; color: var(--text-muted);" onclick="moveTaskStatus('${task.id}', 'doing')"><i class="ph-bold ph-arrow-left"></i> Re-open</button>`;
            cardHTML = `<div class="kanban-card" style="opacity: 0.5; background: var(--glass-bg);"><h4 style="margin: 8px 0; font-size: 14px; color: var(--text-muted); text-decoration: line-through;">${task.title}</h4><div class="kanban-actions">${actionButtons}</div></div>`;
            colDone.innerHTML += cardHTML;
        }
    });
}

// ==========================================
// 🍔 MODULE 3: FOOD LOG & MULTIMODAL AI (FIREBASE)
// ==========================================
async function saveFood() {
    let mealType = document.getElementById('mealType').value; let foodSource = document.getElementById('foodSource').value;
    let foodItem = document.getElementById('foodItem').value; let priceInput = document.getElementById('foodPrice');
    let notesInput = document.getElementById('foodNotes'); let notes = notesInput ? notesInput.value.trim() : '';
    let walletInput = document.getElementById('foodWallet'); let price = priceInput ? parseFloat(priceInput.value || 0) : 0;
    let walletId = walletInput ? walletInput.value : null;

    if (!foodItem) { alert("I-type mo muna kung anong kinain mo!"); return; }

    try {
        if (price > 0 && walletId) {
            let walletObj = myWallets.find(w => w.id === walletId);
            if (!walletObj || parseFloat(walletObj.balance) < price) { alert("Oops! Kulang ang pondo mo sa wallet na ito."); return; }
            await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "wallets", walletId), { balance: parseFloat(walletObj.balance) - price });
            monthlySpent += price; 
            await window.dbMethods.addDoc(window.dbMethods.collection(window.db, "transactions"), {
                userId: window.currentUid, type: 'expense', walletId: walletId, amount: price, note: `Food: ${foodItem}`, category: "Food & Drinks", createdAt: Date.now()
            });
        }
        await window.dbMethods.addDoc(window.dbMethods.collection(window.db, "foodLogs"), {
            userId: window.currentUid, meal: mealType, source: foodSource, item: foodItem, notes: notes, cost: price, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), createdAt: Date.now()
        });
        playSound('success');
        document.getElementById('foodItem').value = ''; if (priceInput) priceInput.value = ''; if (notesInput) notesInput.value = '';
    } catch (e) { console.error(e); alert("May error sa pag-save!"); }
}

function openEditFoodModal(id) {
    let food = foodDatabase.find(f => f.id === id);
    if (!food) return;
    document.getElementById('editFoodId').value = id;
    document.getElementById('editFoodMeal').value = food.meal || 'Breakfast';
    document.getElementById('editFoodItem').value = food.item || '';
    document.getElementById('editFoodNotes').value = food.notes || '';
    document.getElementById('editFoodPrice').value = food.cost || '';
    document.getElementById('editFoodModal').style.display = 'flex';
}

function closeEditFoodModal() {
    document.getElementById('editFoodModal').style.display = 'none';
}

async function saveEditFood() {
    let id = document.getElementById('editFoodId').value;
    let meal = document.getElementById('editFoodMeal').value;
    let item = document.getElementById('editFoodItem').value.trim();
    let notes = document.getElementById('editFoodNotes').value.trim();
    let price = parseFloat(document.getElementById('editFoodPrice').value) || 0;

    if (!item) { alert("I-type mo kung anong kinain mo!"); return; }

    try {
        await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "foodLogs", id), { meal: meal, item: item, notes: notes, cost: price });
        playSound('success');
        closeEditFoodModal();
    } catch (e) { console.error(e); alert("May error sa pag-save ng changes."); }
}
window.openEditFoodModal = openEditFoodModal; window.closeEditFoodModal = closeEditFoodModal; window.saveEditFood = saveEditFood;

async function deleteFood(id) { 
    if (confirm("Gusto mo bang burahin ang food log na ito?")) {
        await window.dbMethods.deleteDoc(window.dbMethods.doc(window.db, "foodLogs", id)); 
        playSound('click');
    }
}

function initRealtimeFood() {
    const q = window.dbMethods.query(window.dbMethods.collection(window.db, "foodLogs"), window.dbMethods.where("userId", "==", window.currentUid));
    window.dbMethods.onSnapshot(q, (snapshot) => {
        foodDatabase = []; snapshot.forEach(doc => foodDatabase.push({ id: doc.id, ...doc.data() }));
        foodDatabase.sort((a, b) => b.createdAt - a.createdAt); renderFoodList(); updateBudgetDashboard();
    });
}

let customFoodCategories = [];

function initRealtimeFoodCategories() {
    const q = window.dbMethods.query(window.dbMethods.collection(window.db, "foodCategories"), window.dbMethods.where("userId", "==", window.currentUid));
    window.dbMethods.onSnapshot(q, (snapshot) => {
        customFoodCategories = []; snapshot.forEach(doc => customFoodCategories.push({ id: doc.id, ...doc.data() }));
        customFoodCategories.sort((a, b) => a.name.localeCompare(b.name));
        renderFoodSourceOptions();
    });
}

function renderFoodSourceOptions() {
    let select = document.getElementById('foodSource');
    let divider = document.getElementById('foodSourceDivider');
    if (!select || !divider) return;
    let currentVal = select.value;
    // Alisin muna lahat ng dating custom options (may data-custom="1" tag)
    select.querySelectorAll('option[data-custom="1"]').forEach(opt => opt.remove());
    // Ilagay yung custom categories bago yung divider
    customFoodCategories.forEach(cat => {
        let opt = document.createElement('option');
        opt.value = cat.name; opt.textContent = cat.name; opt.dataset.custom = "1";
        divider.parentNode.insertBefore(opt, divider);
    });
    // Ibalik yung napiling value kung meron pa (hindi yung __add_new__ sentinel)
    if (currentVal && currentVal !== '__add_new__') select.value = currentVal;
}

async function handleFoodSourceChange(selectEl) {
    if (selectEl.value !== '__add_new__') return;
    let newCat = prompt("Anong bagong food category ang gusto mong idagdag?\n(Ex: Panaderya, Delivery App, Buffet)");
    if (newCat && newCat.trim() !== "") {
        let finalName = newCat.trim();
        // Check muna kung existing na yung category (case-insensitive) para hindi magduplicate
        let allOptions = Array.from(selectEl.options).map(o => o.value.toLowerCase());
        if (allOptions.includes(finalName.toLowerCase())) {
            selectEl.value = finalName; playSound('click'); return;
        }
        try {
            await window.dbMethods.addDoc(window.dbMethods.collection(window.db, "foodCategories"), {
                userId: window.currentUid, name: finalName, createdAt: Date.now()
            });
            playSound('success');
            // Yung realtime listener na ang bahalang mag-render; i-set lang natin yung pending value
            setTimeout(() => { selectEl.value = finalName; }, 400);
        } catch (e) { console.error(e); alert("May error sa pag-save ng bagong category."); selectEl.value = "Home-cooked"; }
    } else {
        selectEl.value = "Home-cooked";
    }
}

let customExpenseCategories = [];

function initRealtimeExpenseCategories() {
    const q = window.dbMethods.query(window.dbMethods.collection(window.db, "expenseCategories"), window.dbMethods.where("userId", "==", window.currentUid));
    window.dbMethods.onSnapshot(q, (snapshot) => {
        customExpenseCategories = []; snapshot.forEach(doc => customExpenseCategories.push({ id: doc.id, ...doc.data() }));
        customExpenseCategories.sort((a, b) => a.name.localeCompare(b.name));
        renderExpenseCategoryOptions();
    });
}

function renderExpenseCategoryOptions() {
    let select = document.getElementById('transactionCategory');
    let divider = document.getElementById('expenseCategoryDivider');
    if (!select || !divider) return;
    let currentVal = select.value;
    select.querySelectorAll('option[data-custom="1"]').forEach(opt => opt.remove());
    customExpenseCategories.forEach(cat => {
        let opt = document.createElement('option');
        opt.value = cat.name; opt.textContent = cat.name; opt.dataset.custom = "1";
        divider.parentNode.insertBefore(opt, divider);
    });
    if (currentVal && currentVal !== '__add_new__') select.value = currentVal;
}

async function handleExpenseCategoryChange(selectEl) {
    if (selectEl.value !== '__add_new__') return;
    let newCat = prompt("Anong bagong expense category ang gusto mong idagdag?\n(Ex: Bills, Transport, Subscriptions)");
    if (newCat && newCat.trim() !== "") {
        let finalName = newCat.trim();
        let allOptions = Array.from(selectEl.options).map(o => o.value.toLowerCase());
        if (allOptions.includes(finalName.toLowerCase())) {
            selectEl.value = finalName; playSound('click'); return;
        }
        try {
            await window.dbMethods.addDoc(window.dbMethods.collection(window.db, "expenseCategories"), {
                userId: window.currentUid, name: finalName, createdAt: Date.now()
            });
            playSound('success');
            setTimeout(() => { selectEl.value = finalName; }, 400);
        } catch (e) { console.error(e); alert("May error sa pag-save ng bagong category."); selectEl.value = ""; }
    } else {
        selectEl.value = "";
    }
}
window.handleExpenseCategoryChange = handleExpenseCategoryChange;

function getFoodGradeColor(grade) {
    if (!grade || grade === '--' || grade === 'N/A') return { bg: 'var(--glass-bg)', border: 'var(--glass-border)', text: 'var(--text-muted)' };
    const g = grade.toUpperCase();
    if (g.startsWith('A')) return { bg: 'rgba(78, 154, 107,0.12)', border: 'rgba(78, 154, 107,0.4)', text: 'var(--success)' };
    if (g.startsWith('B')) return { bg: 'rgba(76, 95, 160,0.12)', border: 'rgba(76, 95, 160,0.4)', text: 'var(--pastel-blue-fg)' };
    if (g.startsWith('C')) return { bg: 'rgba(156, 122, 46,0.12)', border: 'rgba(156, 122, 46,0.4)', text: 'var(--pastel-amber-fg)' };
    return { bg: 'rgba(194, 86, 79,0.12)', border: 'rgba(194, 86, 79,0.4)', text: 'var(--danger)' };
}

function applyFoodSummaryUI(result) {
    if (result && result.grade && result.grade !== '--') lastFoodSummaryCache = result;
    let gradeEl = document.getElementById('foodGradeDisplay'); let gradeText = document.getElementById('foodGradeText');
    let calEl = document.getElementById('foodCalorieText'); let tipEl = document.getElementById('foodSummaryTip');
    if (!gradeEl) return;
    let grade = result.grade || '--'; let colors = getFoodGradeColor(grade);
    gradeEl.style.background = colors.bg; gradeEl.style.borderColor = colors.border; gradeText.style.color = colors.text; gradeText.innerText = grade;
    let glanceGrade = document.getElementById('glance-food-grade');
    if (glanceGrade) { glanceGrade.innerText = grade; glanceGrade.style.color = colors.text; }
    calEl.innerHTML = result.calories > 0 ? `${result.calories.toLocaleString()} <span style="font-size: 11px; font-weight: 400; color: var(--text-muted);">kcal</span>` : `-- <span style="font-size: 11px; font-weight: 400; color: var(--text-muted);">kcal</span>`;
    tipEl.innerText = result.summary || '';
}

async function fetchFoodSummary(forceRefresh = false) {
    if (!window.currentUid) return;
    if (lastFoodSummaryCache && !forceRefresh) applyFoodSummaryUI(lastFoodSummaryCache);
    let todayKey = new Date().toLocaleDateString('en-CA'); let todayFood = foodDatabase.filter(f => new Date(f.createdAt).toLocaleDateString('en-CA') === todayKey);
    if (todayFood.length === 0) { applyFoodSummaryUI({ calories: 0, grade: '--', summary: 'Mag-log ng pagkain mo para makita ang summary.' }); return; }
    if (!forceRefresh) {
        try {
            const q = window.dbMethods.query(window.dbMethods.collection(window.db, "foodSummaries"), window.dbMethods.where("userId", "==", window.currentUid), window.dbMethods.where("dateKey", "==", todayKey));
            const snap = await window.dbMethods.getDocs(q);
            if (!snap.empty) {
                let savedData = snap.docs[0].data();
                if (savedData.foodCount === todayFood.length) { applyFoodSummaryUI(savedData); return; }
            }
        } catch(e) { console.error("Firebase Cache Error:", e); }
    }
    let tipEl = document.getElementById('foodSummaryTip'); let gradeText = document.getElementById('foodGradeText');
    if (tipEl) tipEl.innerText = 'Analyzing your meal...'; if (gradeText) gradeText.innerText = '...';
    try {
        let foodItems = todayFood.map(f => ({ meal: f.meal, item: f.item }));
        const response = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'getFoodSummary', foodItems }) });
        const result = await response.json(); applyFoodSummaryUI(result);
        const q = window.dbMethods.query(window.dbMethods.collection(window.db, "foodSummaries"), window.dbMethods.where("userId", "==", window.currentUid), window.dbMethods.where("dateKey", "==", todayKey));
        const snap = await window.dbMethods.getDocs(q);
        if (!snap.empty) { await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "foodSummaries", snap.docs[0].id), { ...result, foodCount: todayFood.length }); } 
        else { await window.dbMethods.addDoc(window.dbMethods.collection(window.db, "foodSummaries"), { userId: window.currentUid, dateKey: todayKey, ...result, foodCount: todayFood.length, createdAt: Date.now() }); }
    } catch(e) { console.error('Food summary API error:', e); if (tipEl) tipEl.innerText = 'Hindi ma-analyze ngayon. Pindutin ang refresh button.'; }
}

function refreshFoodSummary() { fetchFoodSummary(true); }

function renderFoodList() {
    let container = document.getElementById('foodListContainer'); container.innerHTML = `<p class="section-label">Food Log Today</p>`;
    let today = new Date().toLocaleDateString('en-CA');
    let todayFood = foodDatabase.filter(food => { return new Date(food.createdAt).toLocaleDateString('en-CA') === today; });
    if (todayFood.length === 0) { container.innerHTML += '<p style="color: var(--text-muted); font-size: 12px; font-style: italic;">Wala ka pang kinakain today.</p>'; return; }
    const mealIcons = { Breakfast: 'ph-coffee', Lunch: 'ph-bowl-food', Dinner: 'ph-cooking-pot', Snack: 'ph-cookie' };
    todayFood.forEach(food => {
        let tone = food.meal === 'Breakfast' ? 'tone-amber' : food.meal === 'Lunch' ? 'tone-blue' : food.meal === 'Dinner' ? 'tone-purple' : 'tone-pink';
        let icon = mealIcons[food.meal] || 'ph-fork-knife';
        let picIcon = food.image64 ? ' <i class="ph-bold ph-image"></i>' : ''; let priceTag = food.cost > 0 ? ` • ₱${food.cost}` : '';
        let noteTag = food.notes ? `<p style="font-size: 11px; color: var(--text-muted); font-style: italic; margin-top: 6px;"><i class="ph-bold ph-note"></i> ${food.notes}</p>` : '';
        container.innerHTML += `<div class="utang-card list-card" style="margin-bottom: 10px;">
            <button onclick="deleteFood('${food.id}')" class="list-card-close"><i class="ph-bold ph-x"></i></button>
            <button onclick="playSound('click'); openEditFoodModal('${food.id}')" class="list-card-close" style="right: 32px;"><i class="ph-bold ph-pencil-simple"></i></button>
            <div class="list-card-row">
                <div class="list-card-avatar ${tone}"><i class="ph-duotone ${icon}"></i></div>
                <div class="list-card-main">
                    <p class="list-card-title">${food.item}${picIcon}</p>
                    <p class="list-card-meta">${food.meal} • ${food.source}${priceTag}</p>
                </div>
                <span style="font-size: 11px; color: var(--text-muted); flex-shrink:0;">${food.time}</span>
            </div>
            ${noteTag}
        </div>`;
    });
}

// MULTI-TAP FOOD AI LOGIC
async function analyzeFoodAI() {
    if (foodDatabase.length === 0) { alert("Kumain ka muna!"); return; }
    let todayKey = new Date().toLocaleDateString('en-CA');
    
    let aiBtn = document.querySelector('button[onclick="playSound(\'click\'); analyzeFoodAI()"]') || document.querySelector('button[onclick="analyzeFoodAI()"]');
    let originalText = aiBtn ? aiBtn.innerHTML : "Analyze My Day (AI)";
    if (aiBtn) { aiBtn.innerHTML = '<i class="ph-bold ph-hourglass"></i> Analyzing Daily Food...'; aiBtn.disabled = true; }

    let todayFood = foodDatabase.filter(f => new Date(f.createdAt).toLocaleDateString('en-CA') === todayKey);
    if (todayFood.length === 0) { alert("Wala kang kinain today!"); if(aiBtn) { aiBtn.innerHTML = originalText; aiBtn.disabled = false; } return; }

    let tipEl = document.getElementById('foodSummaryTip'); let gradeText = document.getElementById('foodGradeText');
    if (tipEl) tipEl.innerText = 'Calculating calories...'; if (gradeText) gradeText.innerText = '...';

    try {
        let allFoodText = todayFood.map(f => `${f.meal}: ${f.item}`).join(" | ");
        const response = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'analyzeDailyFood', foodLog: allFoodText, userName: window.currentUserName || "Pat" }) });
        const data = await response.json();
        const verdict = data.verdict || "Kumain ka pa ng masustansya!"; const grade = data.grade || "N/A"; const calories = data.calories || 0;

        if(typeof applyFoodSummaryUI === "function") { applyFoodSummaryUI({ grade: grade, calories: calories, summary: "Updated for today!" }); }
        
        await window.dbMethods.addDoc(window.dbMethods.collection(window.db, "aiAnalyses"), { userId: window.currentUid, verdict: verdict, grade: grade, calories: calories, type: 'food', dateKey: todayKey, createdAt: Date.now() });
        playSound('success'); 
        if (aiBtn) { aiBtn.innerHTML = '<i class="ph-bold ph-sparkle"></i> Analyze My Day (AI)'; aiBtn.disabled = false; aiBtn.style.opacity = "1"; }
    } catch (e) { 
        console.error(e); alert("API Error. Hindi ko ma-analyze ngayon."); 
        if (tipEl) tipEl.innerText = 'Error. Try again later.'; 
        if (aiBtn) { aiBtn.innerHTML = originalText; aiBtn.disabled = false; } 
    }
}

function initRealtimeAiAnalyses() {
    const q = window.dbMethods.query(window.dbMethods.collection(window.db, "aiAnalyses"), window.dbMethods.where("userId", "==", window.currentUid));
    window.dbMethods.onSnapshot(q, (snapshot) => {
        aiAnalyses = [];
        snapshot.forEach(doc => { aiAnalyses.push({ id: doc.id, ...doc.data() }); });
        aiAnalyses.sort((a, b) => a.createdAt - b.createdAt);

        // Palaging ipakita yung PINAKA-HULING food analysis, kahit anong araw pa 'yon —
        // manatili ito hanggang sa mag-Analyze ulit (hindi dapat basta nagre-reset sa "--" pagtawid ng bagong araw)
        let foodAnalyses = aiAnalyses.filter(a => a.type === 'food');
        if (foodAnalyses.length > 0) {
            let latest = foodAnalyses[foodAnalyses.length - 1];
            let resultDiv = document.getElementById('aiFoodResult'); let textDiv = document.getElementById('aiVerdictText');
            if (resultDiv && textDiv) { resultDiv.style.display = 'block'; textDiv.innerHTML = latest.verdict; }
            if (latest.grade) {
                applyFoodSummaryUI({ grade: latest.grade, calories: latest.calories || 0, summary: latest.verdict || '' });
            }
        }
    });
}

// ==========================================
// 🍽️ REALTIME FOOD SUMMARY LISTENER
// ==========================================
function initRealtimeFoodSummary() {
    let todayKey = new Date().toLocaleDateString('en-CA');
    const q = window.dbMethods.query(
        window.dbMethods.collection(window.db, "foodSummaries"),
        window.dbMethods.where("userId", "==", window.currentUid),
        window.dbMethods.where("dateKey", "==", todayKey)
    );
    window.dbMethods.onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            let data = snapshot.docs[0].data();
            if (data.grade && data.grade !== '--') {
                lastFoodSummaryCache = data;
                applyFoodSummaryUI(data);
            }
        }
    });
}

// ==========================================
// 💰 MODULE 4: MULTI-WALLET & BUDGET SYSTEM (FIREBASE)
// ==========================================
function updateBudgetDashboard() {
    let totalPera = myWallets.reduce((sum, wallet) => sum + parseFloat(wallet.balance), 0);
    document.getElementById('totalNetWorth').innerText = `₱${totalPera.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
    let glanceWallet = document.getElementById('glance-wallet');
    if (glanceWallet) { glanceWallet.setAttribute('data-value', totalPera.toLocaleString('en-US', {minimumFractionDigits: 2})); updateGlanceVisibility(); }
    
    let container = document.getElementById('walletsContainer'); container.innerHTML = '';
    if (myWallets.length === 0) container.innerHTML = `<p style="color: var(--text-muted); font-size: 12px; font-style: italic;">Wala pang wallet.</p>`;
    else {
        const walletTypeMap = {
            'E-wallet':    { tone: 'tone-blue',   icon: 'ph-device-mobile' },
            'Bank':        { tone: 'tone-purple', icon: 'ph-bank' },
            'Cash':        { tone: 'tone-peach',  icon: 'ph-money' },
            'Savings':     { tone: 'tone-green',  icon: 'ph-piggy-bank' },
            'Credit Card': { tone: 'tone-pink',   icon: 'ph-credit-card' },
        };
        myWallets.forEach((wallet) => {
            let typeInfo = walletTypeMap[wallet.type] || { tone: 'tone-amber', icon: 'ph-wallet' };
            container.innerHTML += `<div class="wallet-chip ${typeInfo.tone}">
                <button onclick="playSound('click'); deleteWallet('${wallet.id}')" class="list-card-close" style="top: 8px; right: 8px;"><i class="ph-bold ph-x"></i></button>
                <button onclick="playSound('click'); openEditWalletModal('${wallet.id}')" class="list-card-close" style="top: 8px; right: 28px;"><i class="ph-bold ph-pencil-simple"></i></button>
                <div class="wallet-chip-icon"><i class="ph-duotone ${typeInfo.icon}"></i></div>
                <p class="wallet-chip-name">${wallet.name}</p>
                <h4 class="wallet-chip-balance">₱${parseFloat(wallet.balance).toLocaleString()}</h4>
                ${wallet.type ? `<span class="wallet-chip-type">${wallet.type}</span>` : ''}
            </div>`;
        });
    }

    let now = new Date(); let computedSpent = 0;
    if (typeof transactionDatabase !== 'undefined') {
        transactionDatabase.forEach(tx => {
            if (tx.type === 'expense' && tx.category !== 'Debt Payment' && tx.includeInBudget !== false) {
                let d = new Date(tx.createdAt);
                if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) { computedSpent += parseFloat(tx.amount); }
            }
        });
    }
    monthlySpent = computedSpent; 
    document.getElementById('monthlyTarget').innerText = `₱${parseFloat(monthlyTarget).toLocaleString()}`;
    document.getElementById('monthlySpent').innerText = `₱${parseFloat(monthlySpent).toLocaleString()}`;
    
    let bar = document.getElementById('budgetProgressBar'); let progress = monthlyTarget > 0 ? Math.min((monthlySpent / monthlyTarget) * 100, 100) : 0;
    bar.style.width = `${progress}%`; bar.style.background = progress >= 90 ? 'var(--danger)' : 'var(--success)';

    let foodWalletSelect = document.getElementById('foodWallet');
    if (foodWalletSelect) {
        foodWalletSelect.innerHTML = '<option value="">Saan ibabawas?</option>';
        myWallets.forEach(wallet => { foodWalletSelect.innerHTML += `<option value="${wallet.id}">${wallet.name} (Bal: ₱${parseFloat(wallet.balance).toLocaleString()})</option>`; });
    }
}

function showAddWalletModal() {
    playSound('click');
    document.getElementById('walletEditId').value = '';
    document.getElementById('walletModalTitle').innerText = 'Add Wallet';
    document.getElementById('walletModalSaveBtn').innerText = 'Save Wallet';
    document.getElementById('walletName').value = '';
    document.getElementById('walletType').value = '';
    document.getElementById('walletBalance').value = '';
    document.getElementById('walletBalance').placeholder = 'Initial Balance';
    document.getElementById('walletModal').style.display = 'flex';
}

function openEditWalletModal(id) {
    let wallet = myWallets.find(w => w.id === id);
    if (!wallet) return;
    playSound('click');
    document.getElementById('walletEditId').value = id;
    document.getElementById('walletModalTitle').innerText = 'Edit Wallet';
    document.getElementById('walletModalSaveBtn').innerText = 'Save Changes';
    document.getElementById('walletName').value = wallet.name;
    document.getElementById('walletType').value = wallet.type || '';
    document.getElementById('walletBalance').value = wallet.balance;
    document.getElementById('walletBalance').placeholder = 'Balance';
    document.getElementById('walletModal').style.display = 'flex';
}
window.openEditWalletModal = openEditWalletModal;

function initRealtimeBudget() {
    const q = window.dbMethods.query(window.dbMethods.collection(window.db, "wallets"), window.dbMethods.where("userId", "==", window.currentUid));
    window.dbMethods.onSnapshot(q, (snapshot) => { myWallets = []; snapshot.forEach(doc => myWallets.push({ id: doc.id, ...doc.data() })); updateBudgetDashboard(); updateQuickGlance(); });
}

async function saveWallet() {
    let editId = document.getElementById('walletEditId').value;
    let name = document.getElementById('walletName').value; let bal = document.getElementById('walletBalance').value;
    let typeInput = document.getElementById('walletType'); let type = typeInput ? typeInput.value : '';
    if (!name || !bal) return alert("Kulang details!");
    if (!type) return alert("Pumili ng Wallet Type!");
    try {
        if (editId) {
            await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "wallets", editId), { name: name, type: type, balance: parseFloat(bal) });
        } else {
            await window.dbMethods.addDoc(window.dbMethods.collection(window.db, "wallets"), { userId: window.currentUid, name: name, type: type, balance: parseFloat(bal), createdAt: Date.now() });
        }
        playSound('success'); document.getElementById('walletName').value = ''; document.getElementById('walletBalance').value = ''; if (typeInput) typeInput.value = ''; closeBudgetModals();
    } catch (e) { console.error(e); alert("May error sa pag-save!"); }
}

async function deleteWallet(id) { if (confirm("Sigurado ka bang gusto mong burahin ang wallet na ito? Hindi na ito maibabalik.")) { try { await window.dbMethods.deleteDoc(window.dbMethods.doc(window.db, "wallets", id)); playSound('click'); } catch (e) { console.error(e); alert("May error sa pagbura ng wallet."); } } }

// ==========================================
// 🎯 WISHLIST / SAVINGS GOALS (label-only wallet reference, manual tracking)
// ==========================================
let wishlistGoals = [];

function initRealtimeWishlist() {
    const q = window.dbMethods.query(window.dbMethods.collection(window.db, "wishlistGoals"), window.dbMethods.where("userId", "==", window.currentUid));
    window.dbMethods.onSnapshot(q, (snapshot) => {
        wishlistGoals = []; snapshot.forEach(doc => wishlistGoals.push({ id: doc.id, ...doc.data() }));
        wishlistGoals.sort((a, b) => (a.targetDate ? new Date(a.targetDate) : 0) - (b.targetDate ? new Date(b.targetDate) : 0));
        renderWishlist();
    });
}

function openAddGoalForm() {
    document.getElementById('goalEditId').value = '';
    document.getElementById('goalModalTitle').innerHTML = '<i class="ph-duotone ph-target"></i> Add Savings Goal';
    document.getElementById('goalStartingAmountLabel').innerText = 'Naka-ipon na ba ito? (Starting amount, optional)';
    document.getElementById('goalModalSaveBtn').innerHTML = '<i class="ph-bold ph-floppy-disk"></i> Save Goal';
    document.getElementById('goalName').value = '';
    document.getElementById('goalTarget').value = '';
    document.getElementById('goalDate').value = '';
    document.getElementById('goalStartingAmount').value = '';
    let walletSelect = document.getElementById('goalWalletLabel');
    walletSelect.innerHTML = '<option value="">Wala / Iba pa</option>' + myWallets.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
    document.getElementById('goalModal').style.display = 'flex';
}

function openEditGoalForm(goalId) {
    let goal = wishlistGoals.find(g => g.id === goalId);
    if (!goal) return;
    document.getElementById('goalEditId').value = goalId;
    document.getElementById('goalModalTitle').innerHTML = '<i class="ph-duotone ph-pencil-simple"></i> Edit Goal';
    document.getElementById('goalStartingAmountLabel').innerText = 'Saved Amount';
    document.getElementById('goalModalSaveBtn').innerHTML = '<i class="ph-bold ph-floppy-disk"></i> Save Changes';
    document.getElementById('goalName').value = goal.name;
    document.getElementById('goalTarget').value = goal.targetAmount;
    document.getElementById('goalDate').value = goal.targetDate;
    document.getElementById('goalStartingAmount').value = goal.savedAmount || 0;
    let walletSelect = document.getElementById('goalWalletLabel');
    walletSelect.innerHTML = '<option value="">Wala / Iba pa</option>' + myWallets.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
    walletSelect.value = goal.walletId || '';
    document.getElementById('goalModal').style.display = 'flex';
}

function closeGoalModal() {
    document.getElementById('goalModal').style.display = 'none';
    document.getElementById('contributeGoalModal').style.display = 'none';
}

async function saveGoal() {
    let editId = document.getElementById('goalEditId').value;
    let name = document.getElementById('goalName').value;
    let target = parseFloat(document.getElementById('goalTarget').value);
    let dateVal = document.getElementById('goalDate').value;
    let savedAmount = parseFloat(document.getElementById('goalStartingAmount').value) || 0;
    let walletId = document.getElementById('goalWalletLabel').value || null;

    if (!name || isNaN(target) || target <= 0 || !dateVal) { alert("Pakilagay ang Goal Name, Target Amount, at Target Date!"); return; }

    try {
        if (editId) {
            await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "wishlistGoals", editId), {
                name: name, targetAmount: target, targetDate: dateVal, savedAmount: savedAmount, walletId: walletId
            });
        } else {
            await window.dbMethods.addDoc(window.dbMethods.collection(window.db, "wishlistGoals"), {
                userId: window.currentUid, name: name, targetAmount: target, targetDate: dateVal,
                savedAmount: savedAmount, walletId: walletId, createdAt: Date.now()
            });
        }
        playSound('success');
        closeGoalModal();
    } catch (e) { console.error(e); alert("May error sa pag-save ng goal."); }
}
window.openEditGoalForm = openEditGoalForm;

function openContributeModal(goalId) {
    let goal = wishlistGoals.find(g => g.id === goalId);
    if (!goal) return;
    document.getElementById('contributeGoalId').value = goalId;
    document.getElementById('contributeGoalLabel').innerText = `Para sa: ${goal.name}`;
    document.getElementById('contributeAmount').value = '';
    document.getElementById('contributeGoalModal').style.display = 'flex';
}

async function confirmContributeGoal() {
    let goalId = document.getElementById('contributeGoalId').value;
    let amount = parseFloat(document.getElementById('contributeAmount').value);
    if (isNaN(amount) || amount <= 0) { alert("Pakilagay ng tamang amount!"); return; }

    let goal = wishlistGoals.find(g => g.id === goalId);
    if (!goal) return;

    try {
        await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "wishlistGoals", goalId), { savedAmount: (goal.savedAmount || 0) + amount });
        playSound('success');
        closeGoalModal();
    } catch (e) { console.error(e); alert("May error sa pag-update ng goal."); }
}

async function deleteGoal(id) {
    if (confirm("Sigurado ka bang gusto mong burahin ang goal na ito?")) {
        try { await window.dbMethods.deleteDoc(window.dbMethods.doc(window.db, "wishlistGoals", id)); playSound('click'); } catch (e) { console.error(e); }
    }
}

function renderWishlist() {
    let container = document.getElementById('wishlistContainer');
    if (!container) return;
    if (wishlistGoals.length === 0) { container.innerHTML = ''; return; }

    container.innerHTML = wishlistGoals.map(goal => {
        let saved = goal.savedAmount || 0;
        let target = goal.targetAmount || 1;
        let percent = Math.min((saved / target) * 100, 100);

        let today = new Date(); today.setHours(0,0,0,0);
        let targetD = new Date(goal.targetDate);
        let monthsLeft = Math.max(0, Math.round((targetD - today) / (1000 * 60 * 60 * 24 * 30)));
        let timeLabel = monthsLeft <= 0 ? 'Due na' : `${monthsLeft} mos left`;

        let remaining = target - saved;
        let monthlyNeeded = (remaining > 0 && monthsLeft > 0) ? (remaining / monthsLeft) : 0;
        let captionText = remaining <= 0 ? 'Tapos na! 🎉' : `${percent.toFixed(0)}% complete${monthlyNeeded > 0 ? ` • ₱${monthlyNeeded.toLocaleString(undefined, {maximumFractionDigits:0})}/mo to hit goal` : ''}`;

        let walletObj = goal.walletId ? myWallets.find(w => w.id === goal.walletId) : null;
        let walletShareHTML = '';
        if (walletObj) {
            let walletBal = parseFloat(walletObj.balance) || 0;
            let walletPercent = walletBal > 0 ? Math.min((saved / walletBal) * 100, 100) : 0;
            walletShareHTML = `<div class="goal-wallet-share"><span>₱${saved.toLocaleString()} of ₱${walletBal.toLocaleString()} sa ${walletObj.name}</span><strong>${walletPercent.toFixed(0)}%</strong></div>`;
        }

        return `<div class="utang-card goal-card">
            <div class="goal-card-top">
                <div class="list-card-avatar tone-purple"><i class="ph-duotone ph-target"></i></div>
                <div class="goal-card-main">
                    <p class="goal-card-title">${goal.name}</p>
                    ${walletObj ? `<p class="goal-card-wallet">${walletObj.name}</p>` : ''}
                </div>
                <span class="pill-badge tone-purple">${timeLabel}</span>
            </div>
            <div class="goal-card-amounts">
                <span class="goal-card-saved">₱${saved.toLocaleString()}</span>
                <span class="goal-card-target">of ₱${target.toLocaleString()}</span>
            </div>
            <div class="goal-progress-track"><div class="goal-progress-fill" style="width: ${percent}%;"></div></div>
            <p class="goal-card-caption">${captionText}</p>
            ${walletShareHTML}
            <div class="goal-card-actions">
                <button class="goal-add-btn" onclick="playSound('click'); openContributeModal('${goal.id}')"><i class="ph-bold ph-plus"></i> Add Savings</button>
                <button class="goal-delete-btn" style="background: var(--glass-bg); color: var(--text-muted);" onclick="playSound('click'); openEditGoalForm('${goal.id}')"><i class="ph-bold ph-pencil-simple"></i></button>
                <button class="goal-delete-btn" onclick="playSound('click'); deleteGoal('${goal.id}')"><i class="ph-bold ph-trash"></i></button>
            </div>
        </div>`;
    }).join('');
}

window.openAddGoalForm = openAddGoalForm; window.closeGoalModal = closeGoalModal; window.saveGoal = saveGoal;
window.openContributeModal = openContributeModal; window.confirmContributeGoal = confirmContributeGoal; window.deleteGoal = deleteGoal;

// ==========================================
// 📊 STATS — Comprehensive "where did my money go" overview (kasama ang Utang payments)
// ==========================================
let currentStatsView = new Date();
const STATS_PALETTE = [
    { bg: 'var(--pastel-pink-bg)',  fg: 'var(--pastel-pink-fg)',  hex: '#B4534B' },
    { bg: 'var(--pastel-amber-bg)', fg: 'var(--pastel-amber-fg)', hex: '#9C7A2E' },
    { bg: 'var(--pastel-blue-bg)',  fg: 'var(--pastel-blue-fg)',  hex: '#4C5FA0' },
    { bg: 'var(--pastel-green-bg)', fg: 'var(--pastel-green-fg)', hex: '#3F7A54' },
    { bg: 'var(--pastel-purple-bg)',fg: 'var(--pastel-purple-fg)',hex: '#6C4F94' },
    { bg: 'var(--pastel-peach-bg)', fg: 'var(--pastel-peach-fg)', hex: '#8A5A2B' },
];
const STATS_ICON_MAP = {
    'Debt Payment': 'ph-hand-coins',
    'Food & Drinks': 'ph-hamburger',
    'Needs (Essentials)': 'ph-shopping-cart',
    'Wants / Lifestyle': 'ph-sparkle',
};

function getCategoryColor(name) {
    // Stable hash base sa pangalan mismo — para hindi nagpapalit ng kulay ang isang category
    // depende sa ranking (ex. palaging green si "Food" kahit hindi na siya pinaka-malaki this month)
    let hash = 0;
    for (let i = 0; i < name.length; i++) { hash = (hash * 31 + name.charCodeAt(i)) % 997; }
    return STATS_PALETTE[hash % STATS_PALETTE.length];
}

function changeStatsMonth(offset) {
    currentStatsView.setMonth(currentStatsView.getMonth() + offset);
    renderStats();
}

function buildDonutChart(segments, totalAmount) {
    const size = 180, strokeWidth = 26, radius = (size / 2) - (strokeWidth / 2), circumference = 2 * Math.PI * radius, center = size / 2;
    if (totalAmount <= 0) {
        return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="var(--glass-bg)" stroke-width="${strokeWidth}"/></svg>`;
    }
    let cumulative = 0;
    let circles = segments.map(seg => {
        let segLength = (seg.percent / 100) * circumference;
        let offset = -1 * (cumulative / 100) * circumference;
        cumulative += seg.percent;
        return `<circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${seg.color.hex}" stroke-width="${strokeWidth}" stroke-dasharray="${segLength} ${circumference - segLength}" stroke-dashoffset="${offset}" transform="rotate(-90 ${center} ${center})" stroke-linecap="butt"/>`;
    }).join('');
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${circles}</svg>`;
}

function renderStats() {
    let monthLabel = document.getElementById('statsMonthLabel');
    if (monthLabel) monthLabel.innerText = currentStatsView.toLocaleString('default', { month: 'long', year: 'numeric' });

    let year = currentStatsView.getFullYear(), month = currentStatsView.getMonth();
    // Comprehensive: LAHAT ng expense type transactions, kasama ang Debt Payment (hindi tulad ng Budget screen na exclusive lang sa discretionary spend)
    let monthTx = transactionDatabase.filter(t => {
        if (t.type !== 'expense') return false;
        let d = new Date(t.createdAt);
        return d.getFullYear() === year && d.getMonth() === month;
    });

    let totalSpent = monthTx.reduce((s, t) => s + parseFloat(t.amount || 0), 0);

    document.getElementById('statsSpentTotal').innerText = `₱${totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    let budgetSubtitle = document.getElementById('statsBudgetSubtitle');
    if (monthlyTarget > 0) {
        let usedPercent = Math.min((totalSpent / monthlyTarget) * 100, 999);
        budgetSubtitle.innerText = `of ₱${parseFloat(monthlyTarget).toLocaleString()} budget • ${usedPercent.toFixed(0)}% used`;
    } else {
        budgetSubtitle.innerText = 'Walang naka-set na budget';
    }

    // Group by category
    let grouped = {};
    monthTx.forEach(t => {
        let cat = t.category || 'Others';
        grouped[cat] = (grouped[cat] || 0) + parseFloat(t.amount || 0);
    });
    let categories = Object.keys(grouped).map(name => ({ name, amount: grouped[name] })).sort((a, b) => b.amount - a.amount);
    categories.forEach((cat) => { cat.percent = totalSpent > 0 ? (cat.amount / totalSpent) * 100 : 0; cat.color = getCategoryColor(cat.name); cat.icon = STATS_ICON_MAP[cat.name] || 'ph-tag'; });

    // Donut chart
    document.getElementById('statsDonutContainer').innerHTML = buildDonutChart(categories, totalSpent);

    // Legend
    let legendContainer = document.getElementById('statsLegendContainer');
    if (categories.length === 0) {
        legendContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 12px; font-style: italic;">Walang expenses ngayong buwan.</p>';
    } else {
        legendContainer.innerHTML = categories.map(cat => `<span style="display:flex; align-items:center; gap:5px; font-size: 11px; color: var(--text-main);"><span style="width:9px; height:9px; border-radius:50%; background:${cat.color.hex}; display:inline-block;"></span>${cat.name} ${cat.percent.toFixed(0)}%</span>`).join('');
    }

    // Category list
    let listContainer = document.getElementById('statsCategoryList');
    if (categories.length === 0) {
        listContainer.innerHTML = '';
    } else {
        listContainer.innerHTML = categories.map(cat => `<div class="quick-access-row" style="cursor: default;">
            <div class="quick-access-icon" style="background:${cat.color.bg}; color:${cat.color.fg};"><i class="ph-duotone ${cat.icon}"></i></div>
            <span class="quick-access-text">${cat.name}</span>
            <span style="font-weight: 700; color: var(--text-main); font-size: 13px;">₱${cat.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>`).join('');
    }
}
window.changeStatsMonth = changeStatsMonth;

// ==========================================
// 💬 QUOTES — Morning / Lunch / Dinner, cached once a day
// ==========================================
const QUOTES_FALLBACK = [
    { quote: "The secret of getting ahead is getting started.", author: "Mark Twain" },
    { quote: "Do something today that your future self will thank you for.", author: "Sean Patrick Flanery" },
    { quote: "It always seems impossible until it's done.", author: "Nelson Mandela" },
    { quote: "Well done is better than well said.", author: "Benjamin Franklin" },
    { quote: "Little by little, a little becomes a lot.", author: "Tanzanian Proverb" },
    { quote: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
    { quote: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" },
    { quote: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
    { quote: "Progress, not perfection.", author: "Unknown" },
    { quote: "Every day is a chance to get it right.", author: "Unknown" },
    { quote: "Rest if you must, but don't you quit.", author: "Edgar Guest" },
    { quote: "Small steps every day add up to big results.", author: "Unknown" },
];

function getQuotesPeriod() {
    let hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return { key: 'morning', label: 'Morning Motivation', index: 0 };
    if (hour >= 11 && hour < 17) return { key: 'lunch', label: 'Lunch Break Thought', index: 1 };
    return { key: 'dinner', label: 'Dinner Reflection', index: 2 };
}

function pickFallbackTrio(dateStr) {
    // I-seed base sa date string para consistent ang napipiling 3 quotes sa buong araw kahit walang internet
    let seed = dateStr.split('-').reduce((s, n) => s + parseInt(n), 0);
    let shuffled = [...QUOTES_FALLBACK];
    for (let i = 0; i < shuffled.length; i++) {
        let j = (seed * (i + 7)) % shuffled.length;
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, 3);
}

async function loadDailyQuotes() {
    let today = new Date().toLocaleDateString('en-CA');
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem('flux_daily_quotes') || 'null'); } catch (e) { cached = null; }

    if (cached && cached.date === today && Array.isArray(cached.quotes) && cached.quotes.length === 3) {
        return cached.quotes;
    }

    // Bagong araw (o wala pang cache) — kumuha ng 3 bagong quotes
    try {
        let res = await fetch('https://quoteslate.vercel.app/api/quotes/random?count=3');
        if (!res.ok) throw new Error('API error');
        let data = await res.json();
        let quotes = data.map(q => ({ quote: q.quote, author: q.author || 'Unknown' }));
        if (quotes.length < 3) throw new Error('Incomplete data');
        localStorage.setItem('flux_daily_quotes', JSON.stringify({ date: today, quotes }));
        return quotes;
    } catch (e) {
        console.warn('Quotes API unavailable, gagamit na lang ng offline quotes:', e);
        let quotes = pickFallbackTrio(today);
        localStorage.setItem('flux_daily_quotes', JSON.stringify({ date: today, quotes }));
        return quotes;
    }
}

async function renderQuotesScreen() {
    let period = getQuotesPeriod();
    let labelEl = document.getElementById('quotesPeriodLabel');
    let textEl = document.getElementById('quotesText');
    let authorEl = document.getElementById('quotesAuthor');
    if (labelEl) labelEl.innerText = period.label;
    if (textEl) textEl.innerText = 'Loading...';
    if (authorEl) authorEl.innerText = '';

    try {
        let quotes = await loadDailyQuotes();
        let current = quotes[period.index] || quotes[0];
        if (textEl) textEl.innerText = `"${current.quote}"`;
        if (authorEl) authorEl.innerText = `— ${current.author}`;
    } catch (e) {
        if (textEl) textEl.innerText = '"Progress, not perfection."';
        if (authorEl) authorEl.innerText = '— Unknown';
    }
}

// ==========================================
// 💳 PAYLATER & CREDIT CARDS — items accumulate, "Finalize" bills them into Utang
// ==========================================
let paylaterAccounts = [];
let paylaterItems = [];

function initRealtimePaylater() {
    const qAcc = window.dbMethods.query(window.dbMethods.collection(window.db, "paylaterAccounts"), window.dbMethods.where("userId", "==", window.currentUid));
    window.dbMethods.onSnapshot(qAcc, (snapshot) => {
        paylaterAccounts = []; snapshot.forEach(doc => paylaterAccounts.push({ id: doc.id, ...doc.data() }));
        renderPaylaterAccounts();
    });
    const qItems = window.dbMethods.query(window.dbMethods.collection(window.db, "paylaterItems"), window.dbMethods.where("userId", "==", window.currentUid));
    window.dbMethods.onSnapshot(qItems, (snapshot) => {
        paylaterItems = []; snapshot.forEach(doc => paylaterItems.push({ id: doc.id, ...doc.data() }));
        renderPaylaterAccounts();
    });
}

function openAddPaylaterAccountForm() {
    document.getElementById('paylaterAccountEditId').value = '';
    document.getElementById('paylaterAccountModalTitle').innerHTML = '<i class="ph-duotone ph-credit-card"></i> Add Account';
    document.getElementById('paylaterAccountSaveBtn').innerHTML = '<i class="ph-bold ph-floppy-disk"></i> Save Account';
    document.getElementById('paylaterAccountType').disabled = false;
    document.getElementById('paylaterAccountName').value = '';
    document.getElementById('paylaterCutoffDay').value = '';
    document.getElementById('paylaterAccountType').value = 'PayLater';
    document.getElementById('paylaterAccountModal').style.display = 'flex';
}

function openEditPaylaterAccountForm(accountId) {
    let account = paylaterAccounts.find(a => a.id === accountId);
    if (!account) return;
    document.getElementById('paylaterAccountEditId').value = accountId;
    document.getElementById('paylaterAccountModalTitle').innerHTML = '<i class="ph-duotone ph-pencil-simple"></i> Edit Account';
    document.getElementById('paylaterAccountSaveBtn').innerHTML = '<i class="ph-bold ph-floppy-disk"></i> Save Changes';
    document.getElementById('paylaterAccountType').value = account.type;
    document.getElementById('paylaterAccountType').disabled = true; // hindi na baguhin ang type once existing na items depend dito
    document.getElementById('paylaterAccountName').value = account.name;
    document.getElementById('paylaterCutoffDay').value = account.cutoffDay;
    document.getElementById('paylaterAccountModal').style.display = 'flex';
}
window.openEditPaylaterAccountForm = openEditPaylaterAccountForm;

function closePaylaterModals() {
    document.getElementById('paylaterAccountModal').style.display = 'none';
    document.getElementById('paylaterItemModal').style.display = 'none';
    document.getElementById('paylaterFinalizeModal').style.display = 'none';
    document.getElementById('paylaterAccountType').disabled = false;
}

async function savePaylaterAccount() {
    let editId = document.getElementById('paylaterAccountEditId').value;
    let type = document.getElementById('paylaterAccountType').value;
    let name = document.getElementById('paylaterAccountName').value.trim();
    let cutoffDay = parseInt(document.getElementById('paylaterCutoffDay').value);
    if (!name || isNaN(cutoffDay) || cutoffDay < 1 || cutoffDay > 31) { alert("Kumpletuhin ang Account Name at Cutoff Day (1-31)!"); return; }
    try {
        if (editId) {
            await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "paylaterAccounts", editId), { name: name, cutoffDay: cutoffDay });
        } else {
            await window.dbMethods.addDoc(window.dbMethods.collection(window.db, "paylaterAccounts"), {
                userId: window.currentUid, type: type, name: name, cutoffDay: cutoffDay, carriedBalance: 0, createdAt: Date.now()
            });
        }
        playSound('success');
        closePaylaterModals();
    } catch (e) { console.error(e); alert("May error sa pag-save."); }
}

async function deletePaylaterAccount(id) {
    if (confirm("Buburahin ang account na ito pati lahat ng items dito. Sigurado ka?")) {
        try {
            let itemsToDelete = paylaterItems.filter(it => it.accountId === id);
            for (let it of itemsToDelete) { await window.dbMethods.deleteDoc(window.dbMethods.doc(window.db, "paylaterItems", it.id)); }
            await window.dbMethods.deleteDoc(window.dbMethods.doc(window.db, "paylaterAccounts", id));
            playSound('click');
        } catch (e) { console.error(e); }
    }
}

function openAddItemModal(accountId) {
    let account = paylaterAccounts.find(a => a.id === accountId);
    if (!account) return;
    document.getElementById('paylaterItemEditId').value = '';
    document.getElementById('paylaterItemModalTitle').innerHTML = '<i class="ph-duotone ph-shopping-bag"></i> Add Item';
    document.getElementById('paylaterItemSaveBtn').innerHTML = '<i class="ph-bold ph-plus"></i> Add Item';
    document.getElementById('paylaterItemAccountId').value = accountId;
    document.getElementById('paylaterItemName').value = '';
    document.getElementById('paylaterItemAmount').value = '';
    document.getElementById('paylaterItemMonths').value = '';
    document.getElementById('paylaterItemMonthsField').style.display = account.type === 'PayLater' ? 'block' : 'none';
    document.getElementById('paylaterItemModal').style.display = 'flex';
}

function openEditItemModal(itemId) {
    let item = paylaterItems.find(it => it.id === itemId);
    if (!item) return;
    let account = paylaterAccounts.find(a => a.id === item.accountId);
    if (!account) return;
    document.getElementById('paylaterItemEditId').value = itemId;
    document.getElementById('paylaterItemModalTitle').innerHTML = '<i class="ph-duotone ph-pencil-simple"></i> Edit Item';
    document.getElementById('paylaterItemSaveBtn').innerHTML = '<i class="ph-bold ph-floppy-disk"></i> Save Changes';
    document.getElementById('paylaterItemAccountId').value = item.accountId;
    document.getElementById('paylaterItemName').value = item.name;
    document.getElementById('paylaterItemAmount').value = item.amount;
    document.getElementById('paylaterItemMonths').value = item.totalMonths || '';
    document.getElementById('paylaterItemMonthsField').style.display = account.type === 'PayLater' ? 'block' : 'none';
    document.getElementById('paylaterItemModal').style.display = 'flex';
}
window.openEditItemModal = openEditItemModal;

async function savePaylaterItem() {
    let editId = document.getElementById('paylaterItemEditId').value;
    let accountId = document.getElementById('paylaterItemAccountId').value;
    let account = paylaterAccounts.find(a => a.id === accountId);
    if (!account) return;
    let name = document.getElementById('paylaterItemName').value.trim();
    let amount = parseFloat(document.getElementById('paylaterItemAmount').value);
    if (!name || isNaN(amount) || amount <= 0) { alert("Kumpletuhin ang Item at Amount!"); return; }

    let payload = { name: name, amount: amount };
    if (account.type === 'PayLater') {
        let months = parseInt(document.getElementById('paylaterItemMonths').value);
        if (isNaN(months) || months < 1) { alert("Pakilagay kung ilang buwan hahatiin!"); return; }
        payload.totalMonths = months;
        if (!editId) payload.monthsPaid = 0;
        // Sa edit, hindi na natin binabago ang monthsPaid — yun yung tumataas kada finalize
    }

    try {
        if (editId) {
            await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "paylaterItems", editId), payload);
        } else {
            payload.userId = window.currentUid; payload.accountId = accountId; payload.createdAt = Date.now();
            await window.dbMethods.addDoc(window.dbMethods.collection(window.db, "paylaterItems"), payload);
        }
        playSound('success');
        closePaylaterModals();
    } catch (e) { console.error(e); alert("May error sa pag-save."); }
}

async function deletePaylaterItem(id) {
    if (confirm("Burahin ang item na ito?")) {
        try { await window.dbMethods.deleteDoc(window.dbMethods.doc(window.db, "paylaterItems", id)); playSound('click'); } catch (e) { console.error(e); }
    }
}

function getNextCutoffDate(cutoffDay) {
    let now = new Date();
    let target = new Date(now.getFullYear(), now.getMonth(), cutoffDay);
    if (target < now) target.setMonth(target.getMonth() + 1);
    return target;
}

function openFinalizeModal(accountId) {
    let account = paylaterAccounts.find(a => a.id === accountId);
    if (!account) return;
    let items = paylaterItems.filter(it => it.accountId === accountId);

    let currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM
    if (account.lastFinalizedPeriod === currentPeriod) {
        let finalizedDateLabel = account.lastFinalizedAt ? new Date(account.lastFinalizedAt).toLocaleDateString('default', { month: 'short', day: 'numeric' }) : 'kanina';
        if (!confirm(`Na-finalize mo na ang "${account.name}" this month noong ${finalizedDateLabel}. Sigurado ka bang gusto mo pa ring mag-finalize ulit? (Baka madoble ang utang mo.)`)) return;
    }

    document.getElementById('finalizeAccountId').value = accountId;
    let minDueField = document.getElementById('finalizeMinDueField');
    let summaryText = document.getElementById('finalizeSummaryText');
    let dueDateLabel = getNextCutoffDate(account.cutoffDay).toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' });

    if (account.type === 'PayLater') {
        let activeItems = items.filter(it => it.monthsPaid < it.totalMonths);
        let total = activeItems.reduce((s, it) => s + (it.amount / it.totalMonths), 0);
        if (total <= 0) { alert("Walang active na items para i-finalize."); return; }
        summaryText.innerText = `Total para sa cycle na ito: ₱${total.toLocaleString(undefined, { minimumFractionDigits: 2 })} (${activeItems.length} item/s). Ito ay idadagdag sa Utang mo, due sa ${dueDateLabel}.`;
        minDueField.style.display = 'none';
    } else {
        let total = items.reduce((s, it) => s + it.amount, 0) + (account.carriedBalance || 0);
        summaryText.innerText = `Total Balance: ₱${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}${account.carriedBalance > 0 ? ` (kasama ₱${account.carriedBalance.toLocaleString()} na carried over)` : ''}. Ilagay kung magkano ang babayaran mo bilang Minimum Due — ang natitira ay idadala sa susunod na cycle.`;
        minDueField.style.display = 'block';
        document.getElementById('finalizeMinDue').value = '';
    }

    document.getElementById('paylaterFinalizeModal').style.display = 'flex';
}

async function confirmFinalizePaylater() {
    let accountId = document.getElementById('finalizeAccountId').value;
    let account = paylaterAccounts.find(a => a.id === accountId);
    if (!account) return;
    let items = paylaterItems.filter(it => it.accountId === accountId);
    let dueDate = getNextCutoffDate(account.cutoffDay);
    let mm = String(dueDate.getMonth() + 1).padStart(2, '0'); let dd = String(dueDate.getDate()).padStart(2, '0'); let yy = String(dueDate.getFullYear()).slice(-2);
    let accCode = account.name.replace(/[^A-Za-z]/g, '').toUpperCase().substring(0, 4) || 'XXXX';
    let utangId = `MY${accCode}${mm}${dd}${yy}`;
    let dueDateStr = `${dueDate.getFullYear()}-${mm}-${dd}`;
    let currentPeriod = new Date().toISOString().slice(0, 7);

    try {
        if (account.type === 'PayLater') {
            let activeItems = items.filter(it => it.monthsPaid < it.totalMonths);
            let total = activeItems.reduce((s, it) => s + (it.amount / it.totalMonths), 0);
            if (total <= 0) return;

            let docRef = await window.dbMethods.addDoc(window.dbMethods.collection(window.db, "utang"), {
                userId: window.currentUid, utangId: utangId, amount: total, dueDate: dueDateStr,
                isPaid: false, category: 'My App', appName: account.name, createdAt: Date.now()
            });
            syncToSheets({ action: 'addUtang', firebaseId: docRef.id, utangId: utangId, appName: account.name, amount: total, dueDate: dueDateStr, category: 'My App' });

            for (let it of activeItems) {
                let newMonthsPaid = it.monthsPaid + 1;
                if (newMonthsPaid >= it.totalMonths) {
                    await window.dbMethods.deleteDoc(window.dbMethods.doc(window.db, "paylaterItems", it.id));
                } else {
                    await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "paylaterItems", it.id), { monthsPaid: newMonthsPaid });
                }
            }
            await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "paylaterAccounts", accountId), { lastFinalizedPeriod: currentPeriod, lastFinalizedAt: Date.now() });
        } else {
            let minDue = parseFloat(document.getElementById('finalizeMinDue').value);
            if (isNaN(minDue) || minDue <= 0) { alert("Pakilagay ang Minimum Amount Due!"); return; }
            let total = items.reduce((s, it) => s + it.amount, 0) + (account.carriedBalance || 0);
            let remaining = Math.max(0, total - minDue);

            let docRef = await window.dbMethods.addDoc(window.dbMethods.collection(window.db, "utang"), {
                userId: window.currentUid, utangId: utangId, amount: minDue, dueDate: dueDateStr,
                isPaid: false, category: 'My App', appName: account.name, createdAt: Date.now()
            });
            syncToSheets({ action: 'addUtang', firebaseId: docRef.id, utangId: utangId, appName: account.name, amount: minDue, dueDate: dueDateStr, category: 'My App' });

            for (let it of items) { await window.dbMethods.deleteDoc(window.dbMethods.doc(window.db, "paylaterItems", it.id)); }
            await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "paylaterAccounts", accountId), { carriedBalance: remaining, lastFinalizedPeriod: currentPeriod, lastFinalizedAt: Date.now() });
        }
        playSound('success');
        closePaylaterModals();
        alert("Na-add na sa Utang mo! Puntahan mo ang Utang screen para makita.");
    } catch (e) { console.error(e); alert("May error sa pag-finalize."); }
}

function renderPaylaterAccounts() {
    let container = document.getElementById('paylaterAccountsContainer');
    if (!container) return;
    if (paylaterAccounts.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); font-size: 12px; font-style: italic; text-align:center; margin-top: 20px;">Wala ka pang PayLater o Credit Card account. Pindutin ang + sa taas para magdagdag.</p>';
        return;
    }

    container.innerHTML = paylaterAccounts.map(account => {
        let items = paylaterItems.filter(it => it.accountId === account.id);
        let isCC = account.type === 'Credit Card';
        let total = isCC
            ? items.reduce((s, it) => s + it.amount, 0) + (account.carriedBalance || 0)
            : items.filter(it => it.monthsPaid < it.totalMonths).reduce((s, it) => s + (it.amount / it.totalMonths), 0);

        let itemsHTML = items.length === 0
            ? '<p style="font-size: 11px; color: var(--text-muted); font-style: italic; margin: 8px 0;">Wala pang item.</p>'
            : items.map(it => {
                if (isCC) {
                    return `<div class="paylater-item-row"><span>${it.name}</span><span>₱${it.amount.toLocaleString()} <button onclick="playSound('click'); openEditItemModal('${it.id}')" style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:0 0 0 6px;"><i class="ph-bold ph-pencil-simple"></i></button> <button onclick="playSound('click'); deletePaylaterItem('${it.id}')" style="background:none;border:none;color:var(--danger);cursor:pointer;padding:0 0 0 6px;"><i class="ph-bold ph-x"></i></button></span></div>`;
                } else {
                    let monthly = it.amount / it.totalMonths;
                    return `<div class="paylater-item-row"><span>${it.name} <span style="opacity:0.6;">(${it.monthsPaid}/${it.totalMonths} mos)</span></span><span>₱${monthly.toLocaleString(undefined, { maximumFractionDigits: 2 })}/mo <button onclick="playSound('click'); openEditItemModal('${it.id}')" style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:0 0 0 6px;"><i class="ph-bold ph-pencil-simple"></i></button> <button onclick="playSound('click'); deletePaylaterItem('${it.id}')" style="background:none;border:none;color:var(--danger);cursor:pointer;padding:0 0 0 6px;"><i class="ph-bold ph-x"></i></button></span></div>`;
                }
            }).join('');

        return `<div class="utang-card" style="margin-bottom: 16px;">
            <div class="form-header" style="justify-content: space-between; margin-bottom: 10px;">
                <div style="display:flex; align-items:center; gap: 12px;">
                    <div class="list-card-avatar tone-amber"><i class="ph-duotone ${isCC ? 'ph-credit-card' : 'ph-device-mobile'}"></i></div>
                    <div>
                        <p class="list-card-title">${account.name}</p>
                        <p class="list-card-meta">${account.type} • Cutoff: ${account.cutoffDay}</p>
                    </div>
                </div>
                <button onclick="playSound('click'); openEditPaylaterAccountForm('${account.id}')" style="background:none;border:none;color:var(--text-muted);cursor:pointer; margin-right: 4px;"><i class="ph-bold ph-pencil-simple"></i></button>
                <button onclick="playSound('click'); deletePaylaterAccount('${account.id}')" style="background:none;border:none;color:var(--danger);cursor:pointer;"><i class="ph-bold ph-trash"></i></button>
            </div>
            ${account.carriedBalance > 0 ? `<div class="pill-badge tone-pink" style="margin-bottom:8px;">Carried over: ₱${account.carriedBalance.toLocaleString()}</div>` : ''}
            <div style="border-top: 1px dashed var(--glass-border); padding-top: 8px; margin-bottom: 10px;">${itemsHTML}</div>
            <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom: 12px;">
                <span style="font-size:11px; color:var(--text-muted); text-transform:uppercase;">Current Cycle Total</span>
                <span style="font-size:18px; font-weight:800; color:var(--text-main);">₱${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div style="display:flex; gap:8px;">
                <button class="icon-action-btn" onclick="playSound('click'); openAddItemModal('${account.id}')"><i class="ph-bold ph-plus"></i> Add Item</button>
                <button class="icon-action-btn" style="background:var(--pastel-amber-fg); color:#fff;" onclick="playSound('click'); openFinalizeModal('${account.id}')"><i class="ph-bold ph-check-circle"></i> Finalize</button>
            </div>
        </div>`;
    }).join('');
}

window.openAddPaylaterAccountForm = openAddPaylaterAccountForm; window.closePaylaterModals = closePaylaterModals;
window.savePaylaterAccount = savePaylaterAccount; window.deletePaylaterAccount = deletePaylaterAccount;
window.openAddItemModal = openAddItemModal; window.savePaylaterItem = savePaylaterItem; window.deletePaylaterItem = deletePaylaterItem;
window.openFinalizeModal = openFinalizeModal; window.confirmFinalizePaylater = confirmFinalizePaylater;



function initRealtimeTransactions() {
    const q = window.dbMethods.query(window.dbMethods.collection(window.db, "transactions"), window.dbMethods.where("userId", "==", window.currentUid));
    window.dbMethods.onSnapshot(q, (snapshot) => { transactionDatabase = []; snapshot.forEach(doc => transactionDatabase.push({ id: doc.id, ...doc.data() })); transactionDatabase.sort((a, b) => b.createdAt - a.createdAt); renderTransactions(); updateBudgetDashboard(); });
}

function renderTransactions() {
    let container = document.getElementById('transactionListContainer'); if (!container) return; container.innerHTML = '';
    if (transactionDatabase.length === 0) { container.innerHTML = '<p style="text-align: center; color: var(--text-muted); font-size: 12px; font-style: italic;">Walang recent transactions.</p>'; return; }
    let recentTx = transactionDatabase.slice(0, 10);
    recentTx.forEach(t => {
        let isIncome = t.type === 'income'; let isTransfer = t.type === 'transfer';
        let icon = isIncome ? 'ph-trend-up' : (isTransfer ? 'ph-arrows-left-right' : 'ph-trend-down');
        let tone = isIncome ? 'tone-green' : (isTransfer ? 'tone-blue' : 'tone-pink');
        let amountColor = isIncome ? 'var(--success)' : (isTransfer ? 'var(--pastel-blue-fg)' : 'var(--danger)');
        let sign = isIncome ? '+' : (isTransfer ? '' : '-');
        let walletObj = myWallets.find(w => w.id === t.walletId); let walletName = walletObj ? walletObj.name : 'Deleted Wallet';
        let dateStr = new Date(t.createdAt).toLocaleDateString('default', { month: 'short', day: 'numeric' });
        let displayNote = t.note && t.note !== "N/A" ? t.note : t.category;
        let categoryTag = '';
        if (t.category === 'Debt Payment') { categoryTag = `<span class="pill-badge tone-pink" style="margin-left: 6px;">Utang</span>`; } else if (t.category === 'Food & Drinks') { categoryTag = `<span class="pill-badge tone-amber" style="margin-left: 6px;">Food</span>`; }
        let targetWalletId = t.walletToId || '';
        container.innerHTML += `<div class="utang-card list-card" style="margin-bottom: 10px;">
            <button onclick="playSound('click'); deleteTransaction('${t.id}', '${t.type}', ${t.amount}, '${t.walletId}', '${targetWalletId}')" class="list-card-close"><i class="ph-bold ph-x"></i></button>
            <div class="list-card-row">
                <div class="list-card-avatar ${tone}"><i class="ph-bold ${icon}"></i></div>
                <div class="list-card-main">
                    <p class="list-card-title">${displayNote}${categoryTag}</p>
                    <p class="list-card-meta">${walletName} • ${dateStr}</p>
                </div>
                <div class="list-card-amount" style="color: ${amountColor};">${sign}₱${parseFloat(t.amount).toLocaleString()}</div>
            </div>
        </div>`;
    });
}

async function saveTransaction() {
    let type = document.getElementById('transactionType').value; let walletId = document.getElementById('transactionWallet').value; 
    let amount = parseFloat(document.getElementById('transactionAmount').value); let note = document.getElementById('transactionNote').value; let category = document.getElementById('transactionCategory').value;
    if (!amount || isNaN(amount) || amount <= 0) return alert("Maglagay ng tamang halaga!");
    let walletObj = myWallets.find(w => w.id === walletId); if (!walletObj) return alert("Pumili ng wallet!");
    if (type === 'expense' && !category) return alert("Pumili ng category para sa expense!"); 
    let newBal = parseFloat(walletObj.balance);
    if (type === 'income') {
        newBal += amount; await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "wallets", walletId), { balance: newBal });
        await window.dbMethods.addDoc(window.dbMethods.collection(window.db, "transactions"), { userId: window.currentUid, type: 'income', walletId: walletId, amount: amount, note: note || "N/A", category: "Income", createdAt: Date.now() });
    } else if (type === 'expense') { 
        let includeInBudget = document.getElementById('includeInBudget') ? document.getElementById('includeInBudget').checked : true;
        if (newBal < amount) return alert("Kulang pondo sa wallet na ito!"); newBal -= amount;
        if (includeInBudget) monthlySpent += amount;
        await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "wallets", walletId), { balance: newBal });
        await window.dbMethods.addDoc(window.dbMethods.collection(window.db, "transactions"), { userId: window.currentUid, type: 'expense', walletId: walletId, amount: amount, note: note || "N/A", category: category, includeInBudget: includeInBudget, createdAt: Date.now() });
    } else if (type === 'transfer') {
        let walletToId = document.getElementById('transactionWalletTo').value;
        if (!walletToId || walletId === walletToId) return alert("Pumili ng tamang wallet na paglilipatan!");
        let walletToObj = myWallets.find(w => w.id === walletToId);
        if (!walletToObj) return alert("Hindi mahanap ang destination wallet. I-refresh muna ang page.");
        if (newBal < amount) return alert("Kulang ang pondo pampa-transfer!");
        try {
            let newTargetBal = parseFloat(walletToObj.balance) + amount;
            newBal -= amount;
            await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "wallets", walletId), { balance: newBal });
            await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "wallets", walletToId), { balance: newTargetBal });
            await window.dbMethods.addDoc(window.dbMethods.collection(window.db, "transactions"), { userId: window.currentUid, type: 'transfer', walletId: walletId, walletToId: walletToId, amount: amount, note: note || "Wallet Transfer", category: "Transfer", createdAt: Date.now() });
        } catch (e) {
            console.error("Transfer error:", e);
            return alert("May error sa transfer: " + e.message);
        }
    }
    try { playSound('success'); document.getElementById('transactionAmount').value = ''; document.getElementById('transactionNote').value = ''; document.getElementById('transactionCategory').value = ''; closeBudgetModals(); updateBudgetDashboard(); } catch (e) { console.error(e); }
}

async function deleteTransaction(id, type, amount, walletId, walletToId) {
    // Kung Debt Payment 'to, gamitin yung proper na "Undo" flow (sa Utang screen) imbes na dito lang direktang burahin —
    // para hindi ma-desync yung status ng utang (paid pa rin kahit na-refund na yung pera).
    let txRecord = transactionDatabase.find(t => t.id === id);
    if (txRecord && txRecord.category === 'Debt Payment' && Array.isArray(txRecord.linkedUtangIds) && txRecord.linkedUtangIds.length > 0) {
        return alert("Para ma-undo nang tama ang bayad na 'to (kasama ang pagbabalik ng status ng utang), pumunta ka sa Utang screen at pindutin ang 'Undo' doon sa specific na utang. Hindi puwedeng dito lang direktang burahin para hindi masira ang pagkakasync ng datos mo.");
    }

    if (confirm("Burahin itong transaction? (Ire-reverse ang epekto nito sa wallet mo)")) {
        try {
            let walletObj = myWallets.find(w => w.id === walletId);
            if (walletObj) {
                let currentBal = parseFloat(walletObj.balance);
                if (type === 'income') { await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "wallets", walletId), { balance: currentBal - amount }); } 
                else if (type === 'expense') { await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "wallets", walletId), { balance: currentBal + amount }); } 
                else if (type === 'transfer' && walletToId) {
                    let targetWallet = myWallets.find(w => w.id === walletToId);
                    if (targetWallet) { await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "wallets", walletId), { balance: currentBal + amount }); await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "wallets", walletToId), { balance: parseFloat(targetWallet.balance) - amount }); }
                }
            }
            await window.dbMethods.deleteDoc(window.dbMethods.doc(window.db, "transactions", id));
            playSound('click');
        } catch (e) { console.error(e); alert("May error sa pagbura ng transaction."); }
    }
}

async function setMonthlyBudget() {
    let target = prompt("Magkano ang limit ng budget mo for this month?");
    if (target && !isNaN(target)) { 
        let parsedTarget = parseFloat(target); 
        try {
            if (budgetDocId) { await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "budgetConfig", budgetDocId), { target: parsedTarget }); } 
            else { let docRef = await window.dbMethods.addDoc(window.dbMethods.collection(window.db, "budgetConfig"), { userId: window.currentUid, target: parsedTarget }); budgetDocId = docRef.id; }
            playSound('success');
        } catch (e) { console.error("Error saving budget:", e); alert("May error sa pag-save ng budget sa database."); }
    }
}

function initRealtimeBudgetConfig() {
    const q = window.dbMethods.query(window.dbMethods.collection(window.db, "budgetConfig"), window.dbMethods.where("userId", "==", window.currentUid));
    window.dbMethods.onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) { let doc = snapshot.docs[0]; budgetDocId = doc.id; monthlyTarget = doc.data().target || 0; } else { monthlyTarget = 0; }
        updateBudgetDashboard(); 
    });
}

function openTransactionModal(type) {
    if (myWallets.length === 0) return alert("Gumawa ka muna ng wallet!");
    if (type === 'transfer' && myWallets.length < 2) return alert("Kailangan mo ng at least 2 wallets para makapag-transfer!");
    playSound('click');
    document.getElementById('transactionModal').style.display = 'flex'; document.getElementById('transactionType').value = type;
    let title = document.getElementById('transactionTitle'); let btn = document.getElementById('saveTransactionBtn'); let selectTo = document.getElementById('transactionWalletTo'); let selectCat = document.getElementById('transactionCategory'); 
    
    if (type === 'income') { title.innerHTML = '<i class="ph-bold ph-trend-up"></i> Add Income'; title.style.color = 'var(--success)'; btn.style.background = 'var(--success)'; selectTo.style.display = 'none'; selectCat.style.display = 'none'; }
    else if (type === 'expense') { title.innerHTML = '<i class="ph-bold ph-trend-down"></i> Add Expense'; title.style.color = 'var(--danger)'; btn.style.background = 'var(--danger)'; selectTo.style.display = 'none'; selectCat.style.display = 'block'; }
    else if (type === 'transfer') { title.innerHTML = '<i class="ph-bold ph-arrows-left-right"></i> Transfer Funds'; title.style.color = 'var(--secondary)'; btn.style.background = 'var(--secondary)'; selectTo.style.display = 'block'; selectCat.style.display = 'none'; }
    let budgetCheckboxRow = document.getElementById('budgetCheckboxRow');
    if (budgetCheckboxRow) { budgetCheckboxRow.style.display = type === 'expense' ? 'flex' : 'none'; }
    let includeInBudgetCb = document.getElementById('includeInBudget');
    if (includeInBudgetCb) includeInBudgetCb.checked = true;

    let select = document.getElementById('transactionWallet'); select.innerHTML = type === 'transfer' ? '<option value="">Transfer From...</option>' : ''; selectTo.innerHTML = '<option value="">Transfer To...</option>';
    myWallets.forEach(w => { select.innerHTML += `<option value="${w.id}">${w.name} (Bal: ₱${parseFloat(w.balance).toLocaleString()})</option>`; selectTo.innerHTML += `<option value="${w.id}">${w.name}</option>`; });
}
function addIncome() { openTransactionModal('income'); } function addExpense() { openTransactionModal('expense'); } function addTransfer() { openTransactionModal('transfer'); } 

function openHistoryModal() {
    playSound('click');
    document.getElementById('historyModal').style.display = 'flex';
    let container = document.getElementById('fullHistoryContainer');
    container.innerHTML = '';
    
    if (transactionDatabase.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-muted); font-size: 12px; font-style: italic; margin-top: 20px;">Walang history ng transactions.</p>';
        return;
    }

    transactionDatabase.forEach(t => {
        let isIncome = t.type === 'income'; let isTransfer = t.type === 'transfer';
        let color = isIncome ? 'var(--success)' : (isTransfer ? 'var(--secondary)' : 'var(--danger)');
        let sign = isIncome ? '+' : (isTransfer ? '' : '-');
        let walletObj = myWallets.find(w => w.id === t.walletId); let walletName = walletObj ? walletObj.name : 'Deleted Wallet';
        let dateStr = new Date(t.createdAt).toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' });
        
        container.innerHTML += `<div class="utang-card" style="padding: 10px; margin-bottom: 8px; background: var(--glass-bg); display: flex; justify-content: space-between; align-items: center; border-left: 3px solid ${color};">
            <div><p style="margin: 0; font-size: 13px; color: var(--text-main); font-weight: 600;">${t.note !== "N/A" ? t.note : t.category}</p><p style="margin: 0; font-size: 10px; color: var(--text-muted);">${walletName} • ${dateStr}</p></div>
            <h4 style="margin: 0; font-size: 13px; color: ${color};">${sign}₱${parseFloat(t.amount).toLocaleString()}</h4>
        </div>`;
    });
}

function closeBudgetModals() { 
    document.getElementById('walletModal').style.display = 'none'; 
    document.getElementById('transactionModal').style.display = 'none'; 
    let payUtangModal = document.getElementById('payUtangModal'); if (payUtangModal) payUtangModal.style.display = 'none'; 
    let histModal = document.getElementById('historyModal'); if (histModal) histModal.style.display = 'none';
}

let activeReceiptFilter = 'all';
function openDailySummary() { activeReceiptFilter = 'all'; switchScreen('summaryScreen'); renderFullReceipt(); }
function setReceiptFilter(filter) {
    playSound('click');
    activeReceiptFilter = filter;
    document.querySelectorAll('.rcpt-tab').forEach(btn => { let isActive = btn.dataset.filter === filter; btn.style.background = isActive ? '#1a1a1a' : 'transparent'; btn.style.color = isActive ? '#f5f0e8' : '#888'; btn.style.borderColor = isActive ? '#1a1a1a' : '#ccc'; });
    renderReceiptBody();
}
function groupByDay(items, getTimestamp) {
    let days = {};
    items.forEach(item => { let d = new Date(getTimestamp(item)); let key = d.toLocaleDateString('en-CA'); let label = d.toLocaleDateString('default', { month: 'short', day: 'numeric', weekday: 'short' }).toUpperCase(); if (!days[key]) days[key] = { label, items: [] }; days[key].items.push(item); });
    return Object.keys(days).sort().map(k => days[k]);
}

function buildReceiptSections() {
    const now = new Date(); const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime(); const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(); const daysLeft = daysInMonth - now.getDate() + 1;
    let paidUtang = utangDatabase.filter(u => { if (!u.isPaid) return false; let paidTime = u.paidAt || u.dueDate || u.createdAt; let d = paidTime instanceof Date ? paidTime : new Date(paidTime); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).sort((a, b) => (b.paidAt || b.dueDate || b.createdAt) - (a.paidAt || a.dueDate || a.createdAt));
    let utangByDay = groupByDay(paidUtang, u => { let t = u.paidAt || u.dueDate || u.createdAt; return t instanceof Date ? t.getTime() : new Date(t).getTime(); }); let totalUtangPaid = paidUtang.reduce((s, u) => s + u.amount, 0);
    let utangRows = utangByDay.map(day => `<div class="receipt-day-header">PAID ${day.label}</div>${day.items.map(u => { let dueD = u.dueDate instanceof Date ? u.dueDate : new Date(u.dueDate); let dueLabel = isNaN(dueD) ? 'Flexible' : dueD.toLocaleDateString('default', { month: 'short', day: 'numeric' }); return `<div class="receipt-row"><span class="r-label">ID: ${u.utangId} <span style="opacity:0.6;">(Due ${dueLabel})</span><span class="receipt-paid-tag">PAID</span></span><span class="r-val">₱${u.amount.toFixed(2)}</span></div>`; }).join('')}`).join('') || '<p style="text-align:center;font-size:10px;color:#888;letter-spacing:1px;margin:12px 0;">NO DEBTS PAID THIS MONTH</p>';
    let debtSection = `<div class="receipt-section-title">DEBT REPAYMENT</div>${utangRows}<div class="receipt-divider-solid"></div><div class="receipt-row r-total"><span class="r-label">TOTAL REPAID</span><span class="r-val">₱${totalUtangPaid.toFixed(2)}</span></div>`;

    let foodThisMonth = foodDatabase.filter(f => f.createdAt >= startOfMonth); let foodByDay = groupByDay(foodThisMonth, f => f.createdAt); let totalFood = foodThisMonth.reduce((s, f) => s + (f.cost || 0), 0);
    let aiByDay = {}; aiAnalyses.forEach(a => { let key = a.dateKey || new Date(a.createdAt).toLocaleDateString('en-CA'); aiByDay[key] = a.verdict; });
    let foodRows = foodByDay.map(day => { let dayKey = Object.keys(aiByDay).length > 0 ? new Date(day.items[0].createdAt).toLocaleDateString('en-CA') : null; let dayVerdict = dayKey && aiByDay[dayKey] ? aiByDay[dayKey] : null; return `<div class="receipt-day-header">${day.label}</div>${day.items.map(f => { let subLine = [f.source, f.notes ? `(${f.notes})` : ''].filter(Boolean).join(' '); return `<div class="receipt-food-row"><div class="receipt-food-top"><span class="r-label">• ${f.item}</span><span class="r-val">${f.cost > 0 ? '₱' + f.cost.toFixed(2) : '—'}</span></div>${subLine ? `<div class="receipt-food-sub">${subLine}</div>` : ''}</div>`; }).join('')}${dayVerdict ? `<div class="receipt-ai-box">AI: ${dayVerdict}</div>` : ''}`; }).join('') || '<p style="text-align:center;font-size:10px;color:#888;letter-spacing:1px;margin:12px 0;">NO FOOD LOGGED</p>';
    let foodSection = `<div class="receipt-section-title">FOOD CONSUMPTION</div>${foodRows}<div class="receipt-divider-solid"></div><div class="receipt-row r-total"><span class="r-label">FOOD TOTAL</span><span class="r-val">₱${totalFood.toFixed(2)}</span></div>`;

    let doneTasks = taskDatabase.filter(t => t.status === 'done' && t.createdAt >= startOfMonth); let tasksByDay = groupByDay(doneTasks, t => t.createdAt); let totalMins = doneTasks.reduce((s, t) => s + (t.timeSpent || t.estMins || 0), 0);
    let taskRows = tasksByDay.map(day => `<div class="receipt-day-header">${day.label}</div>${day.items.map(t => `<div class="receipt-row"><span class="r-label">${t.title}</span><span class="r-val">${t.timeSpent || t.estMins || 0}m</span></div>`).join('')}`).join('') || '<p style="text-align:center;font-size:10px;color:#888;letter-spacing:1px;margin:12px 0;">NO TASKS COMPLETED</p>';
    let taskSection = `<div class="receipt-section-title">TASK PROGRESS</div>${taskRows}<div class="receipt-divider-solid"></div><div class="receipt-row r-total"><span class="r-label">TIME INVESTED</span><span class="r-val">${totalMins} MINS</span></div>`;

    let remaining = monthlyTarget - monthlySpent; let dailyLeft = remaining > 0 && daysLeft > 0 ? (remaining / daysLeft) : 0;
    let expensesByDay = groupByDay(transactionDatabase.filter(t => t.type === 'expense' && t.category !== 'Debt Payment' && t.createdAt >= startOfMonth && t.includeInBudget !== false), t => t.createdAt);
    let expRows = expensesByDay.map(day => `<div class="receipt-day-header">${day.label}</div>${day.items.map(t => `<div class="receipt-row"><span class="r-label">${t.note || t.category || 'Expense'}</span><span class="r-val">-₱${parseFloat(t.amount).toFixed(2)}</span></div>`).join('')}`).join('') || '<p style="text-align:center;font-size:10px;color:#888;letter-spacing:1px;margin:12px 0;">NO EXPENSES LOGGED</p>';
    let budgetSection = `<div class="receipt-section-title">BUDGET BREAKDOWN</div>${expRows}<div class="receipt-divider-solid"></div><div class="receipt-row" style="font-size:11px;"><span class="r-label">MONTHLY TARGET</span><span class="r-val">₱${parseFloat(monthlyTarget).toFixed(2)}</span></div><div class="receipt-row" style="font-size:11px;"><span class="r-label">TOTAL SPENT</span><span class="r-val">-₱${monthlySpent.toFixed(2)}</span></div><div class="receipt-divider-solid"></div><div class="receipt-row r-total"><span class="r-label">REMAINING</span><span class="r-val">₱${remaining.toFixed(2)}</span></div><div class="receipt-daily-budget"><p>DAILY ALLOWANCE LEFT</p><h2>₱${dailyLeft.toFixed(2)}</h2></div>`;
    return { debtSection, foodSection, taskSection, budgetSection };
}

function renderReceiptBody() {
    const body = document.getElementById('receiptBody'); if (!body) return;
    const { debtSection, foodSection, taskSection, budgetSection } = buildReceiptSections(); const f = activeReceiptFilter; let html = '';
    if (f === 'all' || f === 'debt') { html += debtSection; if (f === 'all') html += '<div class="receipt-divider"></div>'; }
    if (f === 'all' || f === 'food') { html += foodSection; if (f === 'all') html += '<div class="receipt-divider"></div>'; }
    if (f === 'all' || f === 'tasks') { html += taskSection; if (f === 'all') html += '<div class="receipt-divider"></div>'; }
    if (f === 'all' || f === 'budget') { html += budgetSection; }
    body.innerHTML = html;
}

function renderFullReceipt() {
    const content = document.getElementById('summaryContent'); const nextBtn = document.getElementById('summaryNextBtn'); if (nextBtn) nextBtn.style.display = 'none';
    const now = new Date(); const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' }).toUpperCase();
    const bars = [3,1,4,2,1,3,2,1,4,2,1,3,1,4,2,3,1,2,4,1,3,2,1,4,2,1,3,2,4,1,2,3,1,4,2,1,3,2,1,4,3,1,2,1,3,4,2,1];
    let totalWidth = bars.reduce((sum, w) => sum + w + 1, 0); let bx = 0;
    let barcodeSvg = `<svg width="${totalWidth}" height="44" viewBox="0 0 ${totalWidth} 44" style="display:block;margin:0 auto;">`;
    bars.forEach((w, i) => { if (i % 2 === 0) barcodeSvg += `<rect x="${bx}" y="0" width="${w}" height="40" fill="#1a1a1a"/>`; bx += w + 1; }); barcodeSvg += `</svg>`;
    const tabs = [{ filter: 'all', label: 'ALL' }, { filter: 'debt', label: 'DEBT' }, { filter: 'food', label: 'FOOD' }, { filter: 'tasks', label: 'TASKS' }, { filter: 'budget', label: 'BUDGET' }];
    content.innerHTML = `<div class="receipt-filter-bar">${tabs.map(t => `<button class="rcpt-tab" data-filter="${t.filter}" onclick="setReceiptFilter('${t.filter}')" style="background: ${t.filter === activeReceiptFilter ? '#1a1a1a' : 'transparent'}; color: ${t.filter === activeReceiptFilter ? '#f5f0e8' : '#888'}; border-color: ${t.filter === activeReceiptFilter ? '#1a1a1a' : '#ccc'};">${t.label}</button>`).join('')}</div>
        <div class="receipt-wrapper"><div class="thermal-receipt"><div class="receipt-logo"><h1>FLUX</h1><p>PERSONAL OS · V3.0</p></div><span class="receipt-stamp">MONTHLY REPORT</span>
        <p class="receipt-meta">${window.currentUserName || 'USER'} #001<br>${monthName}<br>PRINTED: ${now.toLocaleDateString('en-CA')} ${now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</p>
        <div class="receipt-divider"></div><div id="receiptBody"></div><div class="receipt-divider"></div><div class="receipt-barcode">${barcodeSvg}<p>FLUX-OS-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}</p></div><p class="receipt-footer">*** THANK YOU, ${window.currentUserName || 'USER'} ***</p></div></div>`;
    renderReceiptBody();
}

// ==========================================
// 🕒 LIVE CLOCK & DATE (COSMIC FORMAT)
// ==========================================
function updateClock() {
    let clockEl = document.getElementById('liveClock');
    if (!clockEl) return;
    
    let now = new Date();
    let dayStr = now.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
    let dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
    let timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    clockEl.innerHTML = `<span style="color: var(--text-muted);">${dayStr} | ${dateStr}</span><br><span style="color: var(--primary); font-size: 14px; letter-spacing: 2px;">${timeStr}</span>`;
}
updateClock();
setInterval(updateClock, 1000);

// ==========================================
// 🔄 FORCE UPDATE / CLEAR CACHE
// ==========================================
function forceUpdateApp() {
    if (confirm("I-force update ang FLUX OS? (Magki-clear ito ng cache at mag-rerefresh para makuha ang latest code)")) {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(function(registrations) { for(let registration of registrations) { registration.unregister(); } window.location.reload(true); });
        } else { window.location.reload(true); }
    }
}

// ==========================================
// 🎨 DYNAMIC THEME SWITCHER (UPDATED: 4 THEMES)
// ==========================================
function toggleTheme() {
    let body = document.body;
    if (body.classList.contains('theme-green')) {
        body.classList.remove('theme-green'); body.classList.add('theme-pink'); localStorage.setItem('flux_theme', 'pink');
    } else if (body.classList.contains('theme-pink')) {
        body.classList.remove('theme-pink'); body.classList.add('theme-light'); localStorage.setItem('flux_theme', 'light');
    } else if (body.classList.contains('theme-light')) {
        body.classList.remove('theme-light'); localStorage.setItem('flux_theme', 'default');
    } else {
        body.classList.add('theme-green'); localStorage.setItem('flux_theme', 'green');
    }
}

function loadSavedTheme() {
    let savedTheme = localStorage.getItem('flux_theme'); let body = document.body;
    body.classList.remove('theme-green', 'theme-pink', 'theme-light');
    if (savedTheme === 'green') { body.classList.add('theme-green'); } 
    else if (savedTheme === 'pink') { body.classList.add('theme-pink'); }
    else if (savedTheme === 'light') { body.classList.add('theme-light'); }
}
loadSavedTheme();

// ==========================================
// 👤 CUSTOM USERNAME PROFILE
// ==========================================
async function setCustomUsername() {
    let defaultName = window.currentUserName || "Engineer";
    let newName = prompt("Ano ang gusto mong itawag sa'yo ng FLUX OS?", defaultName);
    if (newName && newName.trim() !== "") {
        let finalName = newName.trim().toUpperCase();
        try {
            const q = window.dbMethods.query(window.dbMethods.collection(window.db, "userProfiles"), window.dbMethods.where("userId", "==", window.currentUid));
            const snap = await window.dbMethods.getDocs(q);
            if (snap.empty) { await window.dbMethods.addDoc(window.dbMethods.collection(window.db, "userProfiles"), { userId: window.currentUid, username: finalName }); } 
            else { await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "userProfiles", snap.docs[0].id), { username: finalName }); }
        } catch (e) { console.error("Error saving username:", e); alert("May error sa pag-save ng username."); }
    }
}

// ==========================================
// 🔐 AUTHENTICATION & INITIALIZE SYSTEM
// ==========================================
let isAppInitialized = false;

function getTimeGreeting() {
    let h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
}

function updateGreetingHeader() {
    let eyebrow = document.getElementById('greetingEyebrow');
    let nameEl = document.getElementById('greetingName');
    let welcomeNameEl = document.getElementById('welcomeName');
    let displayName = window.currentUserName ? (window.currentUserName.charAt(0) + window.currentUserName.slice(1).toLowerCase()) : "Engineer";
    if (eyebrow) eyebrow.innerText = getTimeGreeting();
    if (nameEl) nameEl.innerText = `Hi, ${displayName}`;
    if (welcomeNameEl) welcomeNameEl.innerText = `Hi, ${displayName}`;
}
setInterval(updateGreetingHeader, 60000);

function openNotifications() {
    let pendingTasks = taskDatabase.filter(t => t.status !== 'done' && t.category !== 'Sched').length;
    if (pendingTasks > 0) {
        alert(`You have ${pendingTasks} pending task${pendingTasks === 1 ? '' : 's'}.`);
    } else {
        alert("You're all caught up. No new notifications.");
    }
}

function openQuickAdd() {
    let m = document.getElementById('quickAddModal');
    if (m) m.style.display = 'flex';
}
function closeQuickAdd() {
    let m = document.getElementById('quickAddModal');
    if (m) m.style.display = 'none';
}
function openProfileSheet() {
    let m = document.getElementById('profileModal');
    if (m) m.style.display = 'flex';
}
function closeProfileSheet() {
    let m = document.getElementById('profileModal');
    if (m) m.style.display = 'none';
}

function handleLogin() {
    playSound('click');
    window.authMethods.signInWithPopup(window.auth, window.provider).then((result) => { console.log("Welcome back, Engineer:", result.user.displayName); }).catch((error) => { console.error("Login failed:", error); alert("May error sa pag-login. Try again."); });
}

function handleLogout() { window.authMethods.signOut(window.auth).then(() => { console.log("System offline."); }); }

function startApp() {
    if (window.auth && window.authMethods && window.db) {
        window.authMethods.onAuthStateChanged(window.auth, (user) => {
            if (user) {
                window.currentUid = user.uid;
                let fallbackName = user.displayName ? user.displayName.split(' ')[0].toUpperCase() : "USER"; window.currentUserName = fallbackName; 
                updateGreetingHeader();
                const qProfile = window.dbMethods.query(window.dbMethods.collection(window.db, "userProfiles"), window.dbMethods.where("userId", "==", window.currentUid));
                window.dbMethods.onSnapshot(qProfile, (snapshot) => {
                    if (!snapshot.empty) { window.currentUserName = snapshot.docs[0].data().username.toUpperCase(); }
                    updateGreetingHeader();
                });

                // Pumunta muna sa Welcome + Swipe Up screen (walang disguise, tapos PIN gate)
                switchScreen('welcomeScreen');
            } else {
                switchScreen('loginScreen');
            }
        });
        document.getElementById('googleLoginBtn').addEventListener('click', handleLogin);
    } else { setTimeout(startApp, 500); }
}
startApp();

// ==========================================
// 👁️ MODULE 7: QUICK GLANCE, PRIVACY & BADGING
// ==========================================
let isWalletHidden = localStorage.getItem('flux_hide_wallet') === 'true';
let isUtangHidden = localStorage.getItem('flux_hide_utang') === 'true';

function updateGlanceVisibility() {
    let walletEl = document.getElementById('glance-wallet'); let utangEl = document.getElementById('glance-utang');
    let eyeWallet = document.getElementById('eye-wallet'); let eyeUtang = document.getElementById('eye-utang');
    if(walletEl && eyeWallet) { let val = walletEl.getAttribute('data-value') || "0.00"; walletEl.innerText = isWalletHidden ? "₱••••" : `₱${val}`; eyeWallet.className = isWalletHidden ? "ph-bold ph-eye-closed" : "ph-bold ph-eye"; }
    if(utangEl && eyeUtang) { let val = utangEl.getAttribute('data-value') || "0.00"; utangEl.innerText = isUtangHidden ? "₱••••" : `₱${val}`; eyeUtang.className = isUtangHidden ? "ph-bold ph-eye-closed" : "ph-bold ph-eye"; }
}

function toggleVisibility(type) {
    if (type === 'wallet') { isWalletHidden = !isWalletHidden; localStorage.setItem('flux_hide_wallet', isWalletHidden); } 
    else if (type === 'utang') { isUtangHidden = !isUtangHidden; localStorage.setItem('flux_hide_utang', isUtangHidden); }
    updateGlanceVisibility();
}

function updateQuickGlance() {
    let totalPera = myWallets.reduce((sum, wallet) => sum + parseFloat(wallet.balance), 0);
    let walletEl = document.getElementById('glance-wallet');
    if (walletEl) walletEl.setAttribute('data-value', totalPera.toLocaleString('en-US', {minimumFractionDigits: 2}));

    let todayStr = new Date().toLocaleDateString('en-CA');
    let dueToday = utangDatabase.filter(u => { let d = u.dueDate instanceof Date ? u.dueDate : new Date(u.dueDate); return !u.isPaid && d.toLocaleDateString('en-CA') === todayStr; }).reduce((sum, u) => sum + parseFloat(u.amount), 0);
    let utangEl = document.getElementById('glance-utang');
    if (utangEl) utangEl.setAttribute('data-value', dueToday.toLocaleString('en-US', {minimumFractionDigits: 2}));

    let pendingTasks = taskDatabase.filter(t => t.status !== 'done' && t.category !== 'Sched').length;
    let glanceStreak = document.getElementById('glance-streak');
    
    if (glanceStreak) {
        if (pendingTasks === 0 && taskDatabase.length > 0) {
            glanceStreak.innerHTML = `ALL <span style="font-size: 14px; color: var(--success); font-weight: normal;">Clear</span>`;
            glanceStreak.style.color = 'var(--success)';
        } else {
            glanceStreak.innerHTML = `${pendingTasks} <span style="font-size: 14px; color: var(--text-main); font-weight: normal;">Left</span>`;
            glanceStreak.style.color = 'var(--primary)';
        }
    }
    updateGlanceVisibility();

    // 🔴 APP BADGING API (Red notification dot sa home screen)
    if ('setAppBadge' in navigator) {
        if (pendingTasks > 0) {
            navigator.setAppBadge(pendingTasks).catch(error => console.error("Badge error:", error));
        } else {
            navigator.clearAppBadge().catch(error => console.error("Clear badge error:", error));
        }
    }
}

function exportUtangToCSV() {
    // 1. Setup the CSV headers (Kasama na ang Firebase ID)
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Firebase ID,Utang ID,App Name,Amount,Due Date,Category,Status\n";

    // 2. Loop through your existing utangDatabase
    utangDatabase.forEach(utang => {
        let status = utang.isPaid ? "Paid" : "Unpaid";
        // Format the date so it's clean
        let dateObj = new Date(utang.dueDate);
        let formattedDate = !isNaN(dateObj) ? dateObj.toLocaleDateString('en-CA') : "N/A";
        
        // 3. Create the row (Nandito na sa unahan ang utang.id)
        let row = `${utang.id},${utang.utangId},${utang.appName},${utang.amount},${formattedDate},${utang.category},${status}`;
        csvContent += row + "\n";
    });

    // 4. Trigger the download automatically
    var encodedUri = encodeURI(csvContent);
    var link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    // Iniba ko ng konti yung file name para madaling ma-identify
    link.setAttribute("download", "flux_utang_export_with_id.csv"); 
    document.body.appendChild(link); 
    
    playSound('success'); 
    link.click();
    document.body.removeChild(link);
}
// ==========================================
// 🔒 MODULE 8: PIN LOCK SYSTEM (Phone-unlock numpad)
// ==========================================
let savedPin = localStorage.getItem('flux_pin');
let pinBuffer = '';
let pinMode = 'verify'; // 'create' | 'confirm' | 'verify'
let tempNewPin = '';

function updatePinDots() {
    let dots = document.querySelectorAll('#pinDots .pin-dot');
    dots.forEach((dot, i) => dot.classList.toggle('filled', i < pinBuffer.length));
}

function shakePinDots(message) {
    let container = document.getElementById('pinDots');
    if (container) {
        container.classList.add('shake');
        setTimeout(() => container.classList.remove('shake'), 400);
    }
    if (message) {
        let subtitle = document.getElementById('pinSubtitle');
        if (subtitle) subtitle.innerText = message;
    }
}

function numpadPress(digit) {
    if (pinBuffer.length >= 4) return;
    pinBuffer += digit;
    updatePinDots();
    if (pinBuffer.length === 4) { setTimeout(handlePinComplete, 150); }
}

function numpadBackspace() {
    pinBuffer = pinBuffer.slice(0, -1);
    updatePinDots();
}

function resetPinBuffer() {
    pinBuffer = '';
    updatePinDots();
}

function handlePinComplete() {
    let pinTitle = document.getElementById('pinTitle');
    let pinSubtitle = document.getElementById('pinSubtitle');

    if (pinMode === 'create') {
        tempNewPin = pinBuffer;
        resetPinBuffer();
        pinMode = 'confirm';
        playSound('click');
        if (pinTitle) pinTitle.innerText = "Confirm your PIN";
        if (pinSubtitle) pinSubtitle.innerText = "Type it again to make sure.";
    } else if (pinMode === 'confirm') {
        if (pinBuffer === tempNewPin) {
            localStorage.setItem('flux_pin', tempNewPin);
            savedPin = tempNewPin;
            playSound('success');
            resetPinBuffer();
            proceedToApp();
        } else {
            shakePinDots("PINs didn't match. Try again.");
            playSound('click');
            resetPinBuffer();
            tempNewPin = '';
            pinMode = 'create';
            setTimeout(() => {
                if (pinTitle) pinTitle.innerText = "Create your PIN";
                if (pinSubtitle) pinSubtitle.innerText = "Set a 4-digit PIN for this device.";
            }, 400);
        }
    } else { // verify
        if (pinBuffer === savedPin) {
            playSound('success');
            resetPinBuffer();
            proceedToApp();
        } else {
            shakePinDots("Wrong PIN. Try again.");
            playSound('click');
            resetPinBuffer();
        }
    }
}

function checkPinStatus() {
    savedPin = localStorage.getItem('flux_pin');
    let pinTitle = document.getElementById('pinTitle');
    let pinSubtitle = document.getElementById('pinSubtitle');
    resetPinBuffer();
    tempNewPin = '';

    if (!savedPin) {
        pinMode = 'create';
        if (pinTitle) pinTitle.innerText = "Create your PIN";
        if (pinSubtitle) pinSubtitle.innerText = "Set a 4-digit PIN for this device.";
    } else {
        pinMode = 'verify';
        if (pinTitle) pinTitle.innerText = "Enter PIN";
        if (pinSubtitle) pinSubtitle.innerText = "Unlock FLUX OS.";
    }
    switchScreen('pinScreen');
}

function forgotPin() {
    if (confirm("Nakalimutan mo ba talaga ang PIN mo, Engineer? Ire-reset natin ito pero kailangan mong mag-login ulit gamit ang Google account mo para makagawa ng bago.")) {
        localStorage.removeItem('flux_pin');
        savedPin = null;
        playSound('click');
        alert("PIN has been reset. Please sign in again.");
        handleLogout();
    }
}

function proceedToApp() {
    switchScreen('dashboardScreen');
    if (!isAppInitialized) { 
        initRealtimeUtang(); initRealtimeTasks(); initRealtimeFood(); initRealtimeBudget(); initRealtimeFoodCategories(); initRealtimeWishlist(); initRealtimeExpenseCategories(); initRealtimePaylater();
        initRealtimeTransactions(); initRealtimeBudgetConfig(); initRealtimeAiAnalyses(); 
        initRealtimeFoodSummary(); 
        isAppInitialized = true; 
    }
}

// ==========================================
// 👆 WELCOME SCREEN — SWIPE UP TO CONTINUE
// ==========================================
function goToPinGate() {
    checkPinStatus();
}

let recentTouchGate = false;

function handleSwipeTap() {
    // Fallback for desktop / non-touch: tap anywhere on welcome screen.
    // Skipped if a touch gesture already handled it (avoids double-trigger from synthetic click).
    if (recentTouchGate) return;
    playSound('click');
    goToPinGate();
}

function initSwipeGesture() {
    let welcomeScreen = document.getElementById('welcomeScreen');
    if (!welcomeScreen) return;
    let startY = null;
    const THRESHOLD = 50;

    welcomeScreen.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; }, { passive: true });
    welcomeScreen.addEventListener('touchmove', (e) => {
        // Panatilihing static/hindi gumagalaw ang screen habang nagsu-swipe (parang totoong lock screen)
        e.preventDefault();
    }, { passive: false });
    welcomeScreen.addEventListener('touchend', (e) => {
        if (startY === null) return;
        let endY = e.changedTouches[0].clientY;
        if (startY - endY > THRESHOLD) {
            recentTouchGate = true;
            goToPinGate();
            setTimeout(() => { recentTouchGate = false; }, 500);
        }
        startY = null;
    }, { passive: true });
}
initSwipeGesture();

// ==========================================
// 🧹 MODULE 9: CLEAR ALL (RESET) FUNCTIONS
// ==========================================
async function clearAllUtang() {
    if (utangDatabase.length === 0) return alert("Wala namang utang na buburahin!");
    if (confirm("🚨 WARNING: Sigurado ka bang gusto mong burahin LAHAT ng Utang records? Permanente ito!")) {
        try {
            for (let u of utangDatabase) { await window.dbMethods.deleteDoc(window.dbMethods.doc(window.db, "utang", u.id)); }
            playSound('click'); alert("Lahat ng utang ay nabura na.");
        } catch(e) { console.error(e); alert("May error sa pagbura."); }
    }
}

async function clearAllTasks() {
    if (taskDatabase.length === 0 && habitDatabase.length === 0) return alert("Walang tasks o habits na buburahin!");
    if (confirm("🚨 WARNING: Burahin LAHAT ng Tasks at Habits? Permanente ito!")) {
        try {
            for (let t of taskDatabase) await window.dbMethods.deleteDoc(window.dbMethods.doc(window.db, "tasks", t.id));
            for (let h of habitDatabase) await window.dbMethods.deleteDoc(window.dbMethods.doc(window.db, "habits", h.id));
            playSound('click'); alert("Lahat ng tasks at habits ay nabura na.");
        } catch(e) { console.error(e); }
    }
}

async function clearAllFood() {
    if (foodDatabase.length === 0) return alert("Walang food logs na buburahin!");
    if (confirm("🚨 WARNING: Burahin LAHAT ng Food Logs? Permanente ito!")) {
        try {
            for (let f of foodDatabase) await window.dbMethods.deleteDoc(window.dbMethods.doc(window.db, "foodLogs", f.id));
            playSound('click'); alert("Lahat ng food logs ay nabura na.");
        } catch(e) { console.error(e); }
    }
}

async function clearAllTransactions() {
    if (transactionDatabase.length === 0) return alert("Walang transactions na buburahin!");
    if (confirm("🚨 WARNING: Burahin LAHAT ng Transaction History? (Hindi gagalawin ang Wallet Balances dito, history lang). Permanente ito!")) {
        try {
            for (let t of transactionDatabase) await window.dbMethods.deleteDoc(window.dbMethods.doc(window.db, "transactions", t.id));
            playSound('click'); alert("Lahat ng transaction history ay nabura na.");
        } catch(e) { console.error(e); }
    }
}

// ==========================================
// 🏷️ MODULE 10: AUTO-ID & FORM TOGGLES
// ==========================================
function toggleWhoInput() {
    let cat = document.getElementById('utangCategory').value;
    document.getElementById('whoContainer').style.display = (cat === 'Other Person') ? 'block' : 'none';
}

function generateUtangID() {
    let cat = document.getElementById('utangCategory').value;
    let who = document.getElementById('whoName') ? document.getElementById('whoName').value.trim().toUpperCase() : '';
    let app = document.getElementById('appName') ? document.getElementById('appName').value.trim().toUpperCase() : '';
    let dateVal = document.getElementById('dateBorrowed') ? document.getElementById('dateBorrowed').value : '';

    let prefix = (cat === 'My App') ? 'MY' : (who.length >= 2 ? who.substring(0, 2) : 'XX');
    let appCode = app.length >= 4 ? app.substring(0, 4) : (app.length > 0 ? app : 'XXXX');
    
    let dateCode = '000000';
    if (dateVal) {
        let d = new Date(dateVal);
        let mm = String(d.getMonth() + 1).padStart(2, '0');
        let dd = String(d.getDate()).padStart(2, '0');
        let yy = String(d.getFullYear()).slice(-2);
        dateCode = `${mm}${dd}${yy}`;
    }
    
    let idField = document.getElementById('utangId');
    if(idField) idField.value = `${prefix}${appCode}${dateCode}`;
}

function toggleNoDueDate() {
    let isChecked = document.getElementById('noDueDateCb').checked;
    let dates = document.querySelectorAll('.dynamic-date');
    dates.forEach(d => {
        d.disabled = isChecked;
        if (isChecked) d.value = '';
    });
    document.getElementById('addDueBtn').style.display = isChecked ? 'none' : 'block';
}

// Para automatic today ang Date Borrowed pagka-open
document.addEventListener("DOMContentLoaded", () => {
    let today = new Date().toLocaleDateString('en-CA');
    let dbInput = document.getElementById('dateBorrowed');
    if(dbInput) { dbInput.value = today; generateUtangID(); }
});

// ==========================================
// 🎮 MODULE 11: ARCADE GAME SYSTEM
// ==========================================
function openGame(url, title) {
    let modal = document.getElementById('playGameModal');
    let iframe = document.getElementById('gameIframe');
    let titleEl = document.getElementById('gameModalTitle');
    
    if (modal && iframe && titleEl) {
        titleEl.innerHTML = `<i class="ph-duotone ph-game-controller"></i> ${title}`;
        iframe.src = url;
        modal.style.display = 'flex';
    }
}

function closeGame() {
    let modal = document.getElementById('playGameModal');
    let iframe = document.getElementById('gameIframe');
    
    if (modal && iframe) {
        // Clear the iframe src to stop game audio/processing in the background
        iframe.src = "";
        modal.style.display = 'none';
    }
}

async function undoPartialPayment(utangFirebaseId, partialId) {
    if (!confirm("I-undo ang partial payment na ito? Ibabalik nito ang pera sa wallet mo at tataas ulit ang balance ng utang.")) return;
    
    let utang = utangDatabase.find(u => u.id === utangFirebaseId);
    if (!utang || !utang.partials) return alert("Hindi mahanap ang record ng utang na ito.");

    let partialRecord = utang.partials.find(p => p.id === partialId);
    if (!partialRecord) return alert("Hindi mahanap ang partial payment na ito.");

    let walletObj = myWallets.find(w => w.id === partialRecord.walletId);
    if (!walletObj) return alert("Hindi mahanap ang wallet na ginamit (baka nabura na). Hindi ma-refund ang pera, pero maibabalik natin ang balance sa utang.");

    try {
        // 1. Ibalik ang pera sa wallet (kung nag-eexist pa yung wallet)
        if (walletObj) {
            let newWalletBal = parseFloat(walletObj.balance) + partialRecord.amount;
            await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "wallets", walletObj.id), { balance: newWalletBal });
        }

        // 2. Ibalik ang amount sa utang at tanggalin sa partials array
        let newUtangAmount = utang.amount + partialRecord.amount;
        let updatedPartials = utang.partials.filter(p => p.id !== partialId);
        await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "utang", utangFirebaseId), { 
            amount: newUtangAmount,
            partials: updatedPartials
        });

        // 3. I-log sa transactions as "Refund" (Kung nahanap yung wallet)
        if (walletObj) {
            await window.dbMethods.addDoc(window.dbMethods.collection(window.db, "transactions"), {
                userId: window.currentUid, type: 'income', walletId: walletObj.id, amount: partialRecord.amount,
                note: `Refund: Partial Pay Undo (ID ${utang.utangId.split(' (')[0]})`, category: "Refund", createdAt: Date.now()
            });
        }

        playSound('success');
    } catch (e) {
        console.error(e);
        alert("May error sa pag-undo.");
    }
}

window.undoPartialPayment = undoPartialPayment;

async function undoFullPayment(utangFirebaseId) {
    let utang = utangDatabase.find(u => u.id === utangFirebaseId);
    if (!utang) return alert("Hindi mahanap ang utang na ito.");
    if (!utang.isPaid) return alert("Hindi pa naman ito bayad.");

    let tx = transactionDatabase.find(t => t.category === 'Debt Payment' && Array.isArray(t.linkedUtangIds) && t.linkedUtangIds.includes(utangFirebaseId));

    if (!tx) {
        if (!confirm("Hindi mahanap ang kaugnay na transaction nito (baka matagal na o hindi na-link). Gusto mo bang i-unmark na lang bilang unpaid ang utang na ito? (Hindi na-refund sa wallet — kailangan mo na lang i-adjust nang manual kung kinakailangan.)")) return;
        try {
            await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "utang", utangFirebaseId), { isPaid: false, paidAt: null });
            playSound('click');
        } catch (e) { console.error(e); alert("May error sa pag-undo."); }
        return;
    }

    let otherLinked = tx.linkedUtangIds.filter(id => id !== utangFirebaseId);
    let warningExtra = otherLinked.length > 0 ? `\n\nNote: Kasama itong binayaran mo dati kasabay ng ${otherLinked.length} pang ibang utang sa iisang transaction — mababalik silang lahat sa "unpaid" kasama nito.` : '';

    if (!confirm(`I-undo ang pagbabayad na ito? Ibabalik ang ₱${tx.amount.toFixed(2)} sa wallet mo, at babalik sa "unpaid" ang utang.${warningExtra}`)) return;

    try {
        let walletObj = myWallets.find(w => w.id === tx.walletId);

        // 1. Ibalik lahat ng utang na naka-link sa transaction na 'to pabalik sa unpaid
        for (let id of tx.linkedUtangIds) {
            await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "utang", id), { isPaid: false, paidAt: null });
        }

        // 2. Ibalik ang pera sa wallet (kung nag-eexist pa)
        if (walletObj) {
            await window.dbMethods.updateDoc(window.dbMethods.doc(window.db, "wallets", walletObj.id), { balance: parseFloat(walletObj.balance) + tx.amount });
        }

        // 3. I-log bilang Refund (audit trail — hindi binubura yung orihinal na Debt Payment record)
        if (walletObj) {
            await window.dbMethods.addDoc(window.dbMethods.collection(window.db, "transactions"), {
                userId: window.currentUid, type: 'income', walletId: walletObj.id, amount: tx.amount,
                note: `Refund: Payment Undo (${tx.note || 'Utang'})`, category: "Refund", createdAt: Date.now()
            });
        }

        playSound('success');
    } catch (e) {
        console.error(e);
        alert("May error sa pag-undo.");
    }
}
window.undoFullPayment = undoFullPayment;

// ==========================================
// 🌍 GLOBAL EXPORTS 
// ==========================================
window.switchScreen = switchScreen; window.showAddForm = showAddForm; window.addDueRow = addDueRow; window.saveUtang = saveUtang;
window.changeMonth = changeMonth; window.openPayUtangModal = openPayUtangModal; window.confirmPayUtang = confirmPayUtang;
window.estimateAITask = estimateAITask; window.saveManualTask = saveManualTask; window.saveHabit = saveHabit;
window.moveTaskStatus = moveTaskStatus; window.markHabitDone = markHabitDone; window.saveFood = saveFood;
window.deleteFood = deleteFood; window.analyzeFoodAI = analyzeFoodAI; window.showAddWalletModal = showAddWalletModal;
window.saveWallet = saveWallet; window.deleteWallet = deleteWallet; window.setMonthlyBudget = setMonthlyBudget;
window.addIncome = addIncome; window.addExpense = addExpense; window.addTransfer = addTransfer; window.saveTransaction = saveTransaction;
window.closeBudgetModals = closeBudgetModals; window.deleteUtang = deleteUtang; window.deleteTask = deleteTask; window.deleteHabit = deleteHabit;
window.openPayFullUtang = openPayFullUtang;
window.openHistoryModal = openHistoryModal;
window.deleteTransaction = deleteTransaction; window.openDailySummary = openDailySummary; window.forceUpdateApp = forceUpdateApp;
window.togglePaidFolder = togglePaidFolder;
window.setUtangView = setUtangView; window.toggleTheme = toggleTheme; window.setCustomUsername = setCustomUsername;
window.refreshFoodSummary = refreshFoodSummary; window.toggleVisibility = toggleVisibility; window.updateQuickGlance = updateQuickGlance;
window.setReceiptFilter = setReceiptFilter; window.playSound = playSound; window.exportUtangToCSV = exportUtangToCSV;
window.forgotPin = forgotPin;
window.clearAllUtang = clearAllUtang; window.clearAllTasks = clearAllTasks; window.clearAllFood = clearAllFood; window.clearAllTransactions = clearAllTransactions;
window.openGame = openGame; window.closeGame = closeGame;
window.numpadPress = numpadPress; window.numpadBackspace = numpadBackspace; window.checkPinStatus = checkPinStatus;
window.handleSwipeTap = handleSwipeTap; window.goToPinGate = goToPinGate;
window.handleFoodSourceChange = handleFoodSourceChange;
window.closeAddUtangForm = closeAddUtangForm;
window.openQuickAdd = openQuickAdd; window.closeQuickAdd = closeQuickAdd;
window.openProfileSheet = openProfileSheet; window.closeProfileSheet = closeProfileSheet;
window.openNotifications = openNotifications; window.updateGreetingHeader = updateGreetingHeader;
window.handleLogout = handleLogout;
