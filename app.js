const S = window.STORE;
const $ = (sel) => document.querySelector(sel);
const rupees = (n) => "₹" + n.toLocaleString("en-IN");
const SWATCH = { White: "#f8f8f8", Black: "#1c1c1e" };

let products = [];
let cart = load("cart", []);
let details = load("details", {});
let filter = "all";
let current = null;      // product open in the dialog
let choice = {};         // its selected options

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), 2200);
}

// ---------- setup ----------
function applyConfig() {
  document.title = S.name;
  $("#brand").textContent = S.name;
  $("#hero-title").textContent = S.name;
  $("#hero-tagline").textContent = S.tagline;
  $("#footer-name").textContent = `© ${new Date().getFullYear()} ${S.name}`;
  $("#footer-wa").href = `https://wa.me/${S.whatsapp}`;
  document.querySelectorAll(".delivery-days").forEach((el) => (el.textContent = S.deliveryDays));
  const unset = [];
  if (/yourname/.test(S.upiId)) unset.push("upiId");
  if (/X/.test(S.whatsapp)) unset.push("whatsapp");
  if (unset.length) {
    const w = $("#setup-warning");
    w.textContent = `Setup needed: fill in ${unset.join(" and ")} in config.js before taking orders.`;
    w.hidden = false;
  }
}

// ---------- catalog ----------
function variantFor(p, c) {
  return p.variants.find((v) => (!p.keyboard || v.keyboard === c.keyboard) && v.colour === c.colour)
      || p.variants[0];
}

function renderGrid() {
  const grid = $("#grid");
  grid.innerHTML = "";
  for (const p of products.filter((p) => filter === "all" || p.type === filter)) {
    const card = document.createElement("button");
    card.className = "card";
    card.innerHTML = `
      <img loading="lazy" alt="">
      <div class="card-body">
        <h3></h3>
        <div class="meta"><p class="price">${rupees(p.price)}</p><span class="swatches"></span></div>
      </div>`;
    card.querySelector("img").src = p.variants[0].image;
    card.querySelector("img").alt = p.title;
    card.querySelector("h3").textContent = p.title;
    for (const c of p.colours) {
      const s = document.createElement("span");
      s.className = "swatch";
      s.style.background = SWATCH[c] || c;
      s.title = c;
      card.querySelector(".swatches").append(s);
    }
    card.addEventListener("click", () => openProduct(p));
    grid.append(card);
  }
}

function openProduct(p) {
  current = p;
  choice = { colour: p.colours[0], size: p.sizes.length === 1 ? p.sizes[0] : null,
             keyboard: p.keyboard ? p.keyboard[0] : null };
  $("#pv-title").textContent = p.title;
  $("#pv-price").textContent = rupees(p.price);
  $("#pv-desc").textContent = p.description;
  $("#pv-qty").value = 1;
  renderOptions();
  $("#product-dialog").showModal();
}

function renderOptions() {
  const p = current;
  const box = $("#pv-options");
  box.innerHTML = "";
  const groups = [];
  if (p.keyboard) groups.push(["keyboard", "Keyboard", p.keyboard]);
  if (p.colours.length > 1) groups.push(["colour", "Colour", p.colours]);
  if (p.sizes.length > 1) groups.push(["size", "Size", p.sizes]);
  for (const [key, label, values] of groups) {
    const g = document.createElement("div");
    g.className = "opt";
    g.innerHTML = `<div class="opt-label">${label}</div><div class="opt-choices"></div>`;
    for (const val of values) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = val;
      b.setAttribute("aria-pressed", choice[key] === val);
      b.addEventListener("click", () => { choice[key] = val; renderOptions(); });
      g.querySelector(".opt-choices").append(b);
    }
    box.append(g);
  }
  $("#pv-img").src = variantFor(p, choice).image;
  $("#pv-img").alt = p.title;
}

$("#pv-add").addEventListener("click", () => {
  if (!choice.size) { toast("Pick a size first"); return; }
  const qty = Math.min(10, Math.max(1, parseInt($("#pv-qty").value, 10) || 1));
  const line = { id: current.id, keyboard: choice.keyboard, colour: choice.colour, size: choice.size };
  const same = cart.find((l) => l.id === line.id && l.keyboard === line.keyboard
                              && l.colour === line.colour && l.size === line.size);
  if (same) same.qty = Math.min(10, same.qty + qty); else cart.push({ ...line, qty });
  save("cart", cart);
  updateCount();
  $("#product-dialog").close();
  toast("Added to cart");
});

document.querySelectorAll(".chip").forEach((chip) => chip.addEventListener("click", () => {
  document.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c === chip));
  filter = chip.dataset.filter;
  renderGrid();
}));

// ---------- cart ----------
const productById = (id) => products.find((p) => p.id === id);
const subtotal = () => cart.reduce((n, l) => n + productById(l.id).price * l.qty, 0);
const total = () => subtotal() + (cart.length ? S.shipping : 0);

function updateCount() {
  $("#cart-count").textContent = cart.reduce((n, l) => n + l.qty, 0);
}

function lineLabel(l) {
  return [l.keyboard, l.colour, l.size].filter(Boolean).join(" · ");
}

function renderCart() {
  const ul = $("#cart-lines");
  ul.innerHTML = "";
  cart = cart.filter((l) => productById(l.id));
  if (!cart.length) {
    ul.innerHTML = `<li class="empty">Your cart is empty.</li>`;
    $("#cart-totals").innerHTML = "";
    $("#to-checkout").hidden = true;
    return;
  }
  cart.forEach((l, i) => {
    const p = productById(l.id);
    const li = document.createElement("li");
    li.className = "line";
    li.innerHTML = `
      <img alt="">
      <div><div class="line-title"></div><div class="line-sub"></div>
        <div class="line-qty"><button aria-label="Less">−</button><span>${l.qty}</span><button aria-label="More">+</button></div></div>
      <div class="line-right price">${rupees(p.price * l.qty)}</div>`;
    li.querySelector("img").src = variantFor(p, l).image;
    li.querySelector(".line-title").textContent = p.title;
    li.querySelector(".line-sub").textContent = lineLabel(l);
    const [less, more] = li.querySelectorAll(".line-qty button");
    less.addEventListener("click", () => { l.qty--; if (!l.qty) cart.splice(i, 1); cartChanged(); });
    more.addEventListener("click", () => { l.qty = Math.min(10, l.qty + 1); cartChanged(); });
    ul.append(li);
  });
  $("#cart-totals").innerHTML = `
    <div><span>Subtotal</span><span>${rupees(subtotal())}</span></div>
    <div><span>Shipping</span><span>${S.shipping ? rupees(S.shipping) : "Free"}</span></div>
    <div class="grand"><span>Total</span><span>${rupees(total())}</span></div>`;
  $("#to-checkout").hidden = false;
}

function cartChanged() {
  save("cart", cart);
  updateCount();
  renderCart();
}

function showStep(id) {
  for (const s of ["#step-cart", "#step-details", "#step-pay"]) $(s).hidden = s !== id;
}

$("#open-cart").addEventListener("click", () => {
  renderCart();
  showStep("#step-cart");
  $("#cart-dialog").showModal();
});

// ---------- checkout ----------
const form = $("#step-details");

$("#to-checkout").addEventListener("click", () => {
  for (const [k, v] of Object.entries(details)) if (form.elements[k]) form.elements[k].value = v;
  showStep("#step-details");
});
$("#back-to-cart").addEventListener("click", () => showStep("#step-cart"));
$("#back-to-details").addEventListener("click", () => showStep("#step-details"));

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const err = $("#details-error");
  const bad = [...form.elements].find((el) => el.name && !el.checkValidity());
  if (bad) {
    err.textContent = {
      phone: "Enter a 10-digit mobile number.",
      pincode: "Enter a 6-digit pincode.",
      email: "That email doesn't look right.",
    }[bad.name] || "Please fill in all the delivery details.";
    err.hidden = false;
    bad.focus();
    return;
  }
  err.hidden = true;
  details = Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, v.trim()]));
  save("details", details);
  startPayment();
});

function newOrderId() {
  const d = new Date();
  const ymd = [d.getFullYear() % 100, d.getMonth() + 1, d.getDate()].map((n) => String(n).padStart(2, "0")).join("");
  return `CS${ymd}-${Math.floor(1000 + Math.random() * 9000)}`;
}

let orderId = null;

function upiLink() {
  const q = new URLSearchParams({ pa: S.upiId, pn: S.payeeName, am: total().toFixed(2), cu: "INR", tn: `Order ${orderId}` });
  return `upi://pay?${q.toString().replace(/\+/g, "%20")}`;
}

function startPayment() {
  orderId = sessionStorage.getItem("orderId") || newOrderId();
  try { sessionStorage.setItem("orderId", orderId); } catch {}
  $("#pay-order-id").textContent = orderId;
  $("#pay-amount").textContent = rupees(total());
  $("#pay-upi").textContent = S.upiId;
  $("#upi-link").href = upiLink();
  const qr = $("#qr");
  qr.innerHTML = "";
  if (window.QRCode) new QRCode(qr, { text: upiLink(), width: 200, height: 200, correctLevel: QRCode.CorrectLevel.M });
  else qr.textContent = "QR code couldn't load. Use the UPI ID below.";
  $("#pay-error").hidden = true;
  showStep("#step-pay");
}

function orderText(utr) {
  const items = cart.map((l) => {
    const p = productById(l.id);
    return `• ${l.qty} × ${p.title} (${lineLabel(l)}) — ${rupees(p.price * l.qty)}\n   print: ${variantFor(p, l).sku}`;
  });
  return [
    `New order ${orderId}`,
    ``,
    ...items,
    ``,
    `Total paid: ${rupees(total())}${S.shipping ? ` (incl. ${rupees(S.shipping)} shipping)` : ""}`,
    `UPI ref: ${utr || "(not given)"}`,
    ``,
    `Ship to:`,
    details.name,
    details.address,
    `${details.city}, ${details.state} - ${details.pincode}`,
    `Phone: ${details.phone}`,
    details.email ? `Email: ${details.email}` : null,
  ].filter((x) => x !== null).join("\n");
}

function checkUtr() {
  const utr = $("#utr").value.replace(/\D/g, "");
  if (utr.length !== 12) {
    const e = $("#pay-error");
    e.textContent = "Enter the 12-digit UPI reference from your payment app so we can match your payment.";
    e.hidden = false;
    return null;
  }
  $("#pay-error").hidden = true;
  return utr;
}

$("#send-wa").addEventListener("click", () => {
  const utr = checkUtr();
  if (!utr) return;
  window.open(`https://wa.me/${S.whatsapp}?text=${encodeURIComponent(orderText(utr))}`, "_blank", "noopener");
  cart = [];
  cartChanged();
  try { sessionStorage.removeItem("orderId"); } catch {}
  showStep("#step-cart");
  $("#cart-lines").innerHTML = `<li class="empty">Thanks! Your order ${orderId} has been sent. We'll confirm on WhatsApp once your payment shows up.</li>`;
});

$("#copy-order").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(orderText($("#utr").value.replace(/\D/g, ""))); toast("Order details copied"); }
  catch { toast("Couldn't copy. Please send a screenshot instead."); }
});
$("#copy-upi").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(S.upiId); toast("UPI ID copied"); } catch {}
});

// ---------- start ----------
applyConfig();
updateCount();
fetch("products.json")
  .then((r) => r.json())
  .then((data) => { products = data; cart = cart.filter((l) => productById(l.id)); updateCount(); renderGrid(); })
  .catch(() => { $("#grid").innerHTML = `<p class="empty">Couldn't load products. Please refresh.</p>`; });
