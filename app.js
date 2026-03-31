// ==========================================
// 🌐 GLOBAL SETTINGS & DATABASE SYNC
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

// Switch Screens Logic
function switchScreen(screenId) {
    let screens = document.querySelectorAll('.screen');
    screens.forEach(screen => screen.classList.remove('active-screen'));
    document.getElementById(screenId).classList.add('active-screen');
    
    if (screenId === 'utangScreen') renderUtangList();
    if (screenId === 'foodScreen') renderFoodList();
}

// ==========================================
// 💸 MODULE: UTANG TRACKER (FIREBASE)
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

    if (!utangId) { alert("Pakilagay yung 6-digit Utang ID!"); return; }

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
                    dueDate: dateVal, 
                    isPaid: false,
                    category: category,
                    appName: appName || "N/A",
                    createdAt: Date.now()
                });
            }
        }
        alert("Synced to Cloud! ✅");
        document.getElementById('addUtangForm').style.display = 'none';
    } catch (e) { console.error(e); }
}

async function markPaid(id) {
    try {
        const utangRef = window.dbMethods.doc(window.db, "utang", id);
        await window.dbMethods.updateDoc(utangRef, { isPaid: true });
    } catch (e) { console.error(e); }
}

function initRealtimeUtang() {
    const q = window.dbMethods.query(window.dbMethods.collection(window.db, "utang"), window.dbMethods.orderBy("createdAt", "desc"));
    window.dbMethods.onSnapshot(q, (querySnapshot) => {
        utangDatabase = [];
        querySnapshot.forEach((doc) => {
            let data = doc.data();
            utangDatabase.push({ ...data, id: doc.id, dueDate: new Date(data.dueDate) });
        });
        renderUtangList();
        runningTotalUtang = utangDatabase.filter(u => !u.isPaid).reduce((sum, u) => sum + u.amount, 0);
        runningTotalBayad = utangDatabase.filter(u => u.isPaid).reduce((sum, u) => sum + u.amount, 0);
        document.getElementById('displayTotalUtang').innerText = runningTotalUtang.toFixed(2);
        document.getElementById('displayTotalBayad').innerText = runningTotalBayad.toFixed(2);
    });
}

function renderUtangList() {
    let container = document.getElementById('utangListContainer');
    container.innerHTML = ''; 
    let viewMonthName = currentDateView.toLocaleString('default', { month: 'long', year: 'numeric' });
    document.getElementById('currentMonthLabel').innerText = viewMonthName;

    let filteredUtang = utangDatabase.filter(utang => 
        utang.dueDate.getMonth() === currentDateView.getMonth() &&
        utang.dueDate.getFullYear() === currentDateView.getFullYear()
    );

    if (filteredUtang.length === 0) {
        container.innerHTML = `<p style="text-align: center; color: var(--text-muted); font-style: italic; margin-top: 30px;">Walang due sa buwang ito.</p>`;
        return;
    }

    filteredUtang.forEach(utang => {
        let formattedDate = `${utang.dueDate.toLocaleString('default', { month: 'short' })} ${utang.dueDate.getDate()}`;
        let cardHTML = `
            <div class="utang-card" style="${utang.isPaid ? 'opacity: 0.5;' : ''}">
                <h4>ID: ${utang.utangId} <span>₱${utang.amount.toFixed(2)}</span></h4>
                <p>Due: ${formattedDate}</p>
                <button class="paid-btn" onclick="markPaid('${utang.id}')" ${utang.isPaid ? 'disabled' : ''}>
                    ${utang.isPaid ? 'Paid' : 'Mark as Paid'}
                </button>
            </div>`;
        container.innerHTML += cardHTML;
    });
}

function changeMonth(offset) {
    currentDateView.setMonth(currentDateView.getMonth() + offset);
    renderUtangList();
}

// ==========================================
// 🍔 MODULE: FOOD LOG (FIREBASE)
// ==========================================
let currentBase64 = null;
let currentMimeType = null;

async function saveFood() {
    let mealType = document.getElementById('mealType').value;
    let foodSource = document.getElementById('foodSource').value;
    let foodItem = document.getElementById('foodItem').value;

    if (!foodItem && !currentBase64) { alert("Piktyuran mo o i-type mo yung kinain mo!"); return; }

    try {
        await window.dbMethods.addDoc(window.dbMethods.collection(window.db, "foodLogs"), {
            meal: mealType,
            source: foodSource,
            item: foodItem || "*(May Picture)*",
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            image64: currentBase64,
            mimeType: currentMimeType,
            createdAt: Date.now()
        });
        document.getElementById('foodItem').value = '';
    } catch (e) { console.error(e); }
}

function initRealtimeFood() {
    const q = window.dbMethods.query(window.dbMethods.collection(window.db, "foodLogs"), window.dbMethods.orderBy("createdAt", "desc"));
    window.dbMethods.onSnapshot(q, (querySnapshot) => {
        foodDatabase = [];
        querySnapshot.forEach((doc) => foodDatabase.push({ id: doc.id, ...doc.data() }));
        renderFoodList();
    });
}

function renderFoodList() {
    let container = document.getElementById('foodListContainer');
    container.innerHTML = '<h3>FOOD LOG TODAY</h3>';
    foodDatabase.forEach(food => {
        container.innerHTML += `<div class="utang-card">
            <span>${food.meal} • ${food.source}</span>
            <h4>${food.item} ${food.image64 ? '📷' : ''}</h4>
        </div>`;
    });
}

// ==========================================
// 💰 MODULE: BUDGET & WALLETS (FIREBASE)
// ==========================================

async function saveWallet() {
    let name = document.getElementById('walletName').value;
    let bal = document.getElementById('walletBalance').value;
    if (!name || !bal) return;
    try {
        await window.dbMethods.addDoc(window.dbMethods.collection(window.db, "wallets"), {
            name: name,
            balance: parseFloat(bal),
            createdAt: Date.now()
        });
        closeBudgetModals();
    } catch (e) { console.error(e); }
}

async function saveTransaction() {
    let type = document.getElementById('transactionType').value;
    let walletId = document.getElementById('transactionWallet').value;
    let amount = parseFloat(document.getElementById('transactionAmount').value);
    
    if (!amount) return;

    try {
        const walletRef = window.dbMethods.doc(window.db, "wallets", walletId);
        let walletData = myWallets.find(w => w.id === walletId);
        let newBalance = type === 'income' ? walletData.balance + amount : walletData.balance - amount;

        await window.dbMethods.updateDoc(walletRef, { balance: newBalance });
        closeBudgetModals();
    } catch (e) { console.error(e); }
}

function initRealtimeBudget() {
    window.dbMethods.onSnapshot(window.dbMethods.collection(window.db, "wallets"), (querySnapshot) => {
        myWallets = [];
        querySnapshot.forEach((doc) => myWallets.push({ id: doc.id, ...doc.data() }));
        updateBudgetDashboard();
    });
}

function updateBudgetDashboard() {
    let totalPera = myWallets.reduce((sum, wallet) => sum + wallet.balance, 0);
    document.getElementById('totalNetWorth').innerText = `₱${totalPera.toLocaleString()}`;
    // Rendering logic for wallets container here...
}

function closeBudgetModals() {
    document.getElementById('walletModal').style.display = 'none';
    document.getElementById('transactionModal').style.display = 'none';
}

// ==========================================
// 🚀 INITIALIZE APP
// ==========================================
setTimeout(() => {
    initRealtimeUtang();
    initRealtimeFood();
    initRealtimeBudget();
}, 2000);
