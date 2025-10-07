
import {
  getFirestore, collection, getDocs, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const { db, auth, signInAnonymously, onAuthStateChanged } = window.__FIREBASE__;

// --- Simple demo “bank” value in memory (replace with real balance later)
let bankPounds = 500;

// Cache DOM
const listEl   = document.getElementById('list');
const searchEl = document.getElementById('searchInput');
const sectionEl= document.getElementById('sectionSelect');
const totalEl  = document.getElementById('totalPrice');
const bankEl   = document.getElementById('bankBalance');
const saveBtn  = document.getElementById('saveBtn');
const confirmEl= document.getElementById('confirm');

let PRODUCTS = [];   // Firestore data
let UI_ROWS  = [];   // references to inputs for calcs

function money(n){ return `£${(Number(n)||0).toFixed(2)}`; }

function render(products){
  listEl.innerHTML = '';
  UI_ROWS = [];
  products.forEach(p=>{
    const id = p.id;
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="row">
        <div class="name">${p.name}</div>
        <div class="price">${money(p.price)} / ${p.unit}</div>
      </div>
      <div class="row">
        <input class="qty" type="number" min="0" step="any" placeholder="Qty (Par ${p.parLevel||0})" id="qty_${id}">
        <input class="stock" type="number" min="0" step="any" placeholder="Current stock" id="stk_${id}">
        <div class="itemTotal" id="tot_${id}">£0.00</div>
      </div>
    `;
    listEl.appendChild(card);

    const qty = card.querySelector(`#qty_${id}`);
    const stk = card.querySelector(`#stk_${id}`);
    const tot = card.querySelector(`#tot_${id}`);
    const row = { p, qty, stk, tot };
    UI_ROWS.push(row);

    const update = () => {
      const q = parseFloat(qty.value)||0;
      const value = q * (p.price||0);
      tot.textContent = money(value);
      recalcTotals();
    };
    qty.addEventListener('input', update);
    stk.addEventListener('input', () => {
      // (optional) add stock-based logic here
    });
  });
  recalcTotals();
}

function recalcTotals(){
  const sum = UI_ROWS.reduce((acc, r)=>{
    const text = r.tot.textContent.replace('£','');
    return acc + (parseFloat(text)||0);
  }, 0);
  totalEl.textContent = `Total: ${money(sum)}`;
  bankEl.textContent  = `Bank: ${money(bankPounds - sum)}`;
  if ((bankPounds - sum) < 0) {
    saveBtn.disabled = true;
  } else {
    saveBtn.disabled = false;
  }
}

function filterList(){
  const q = (searchEl.value||'').toLowerCase().trim();
  const filtered = PRODUCTS.filter(p =>
    p.name.toLowerCase().includes(q) ||
    (p.code||'').toLowerCase().includes(q)
  );
  render(filtered);
}

searchEl.addEventListener('input', filterList);

saveBtn.addEventListener('click', async ()=>{
  const section = sectionEl.value;
  if (!section) {
    alert('Pick a section first.');
    return;
  }
  const items = UI_ROWS
    .map(r => ({
      productId: r.p.id,
      name: r.p.name,
      unit: r.p.unit,
      price: r.p.price,
      qty: parseFloat(r.qty.value)||0,
      stock: parseFloat(r.stk.value)||null
    }))
    .filter(i => i.qty > 0);

  if (!items.length) {
    alert('No quantities entered.');
    return;
  }

  const total = items.reduce((a,i)=> a + (i.qty * i.price), 0);

  try {
    await addDoc(collection(db, 'orders'), {
      section,
      items,
      total,
      createdAt: serverTimestamp(),
      orderDate: new Date().toISOString().slice(0,10)
    });
    showConfirmation(section, items);
    // Optional: clear inputs after save
    UI_ROWS.forEach(r => { r.qty.value=''; r.tot.textContent='£0.00'; });
    recalcTotals();
  } catch (e) {
    alert('Failed to save order: ' + e.message);
  }
});

function showConfirmation(section, items){
  const html = [
    `<h3>Order Submitted (${section})</h3>`,
    `<ul>`,
    ...items.map(i => `<li>${i.qty} ${i.unit} × ${i.name}</li>`),
    `</ul>`
  ].join('');
  confirmEl.innerHTML = html;
  confirmEl.classList.remove('hidden');
}

// --- Boot: sign in anonymous, then load products
onAuthStateChanged(auth, async (user)=>{
  if (!user) await signInAnonymously(auth);
  await loadProducts();
});

async function loadProducts(){
  // Fetch 10 test products from Firestore
  const snap = await getDocs(collection(db, 'products'));
  PRODUCTS = snap.docs.map(d => ({ id:d.id, ...d.data() }))
                      .slice(0, 50); // safe cap
  render(PRODUCTS);
}
