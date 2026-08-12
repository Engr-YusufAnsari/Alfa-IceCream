// Alfa Kulfi & Ice Cream — site interactions

document.addEventListener('DOMContentLoaded', () => {

  const WHATSAPP_PHONE = "918433829750"; // 91 = India country code, then mobile number, digits only

  /* Mobile nav toggle */
  const navToggle = document.getElementById('navToggle');
  const mainNav = document.getElementById('mainNav');
  if (navToggle && mainNav) {
    navToggle.addEventListener('click', () => {
      mainNav.classList.toggle('open');
    });
    mainNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => mainNav.classList.remove('open'));
    });
  }

  /* Menu tabs */
  const tabButtons = document.querySelectorAll('.menu-tab-btn');
  const panels = document.querySelectorAll('.menu-panel');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-tab');
      tabButtons.forEach(b => b.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = document.getElementById(target);
      if (panel) panel.classList.add('active');
    });
  });

  /* FAQ accordion */
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const q = item.querySelector('.faq-q');
    q.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      faqItems.forEach(i => i.classList.remove('open'));
      if (!isOpen) item.classList.add('open');
    });
  });

  /* Sticky header shrink shadow on scroll (subtle) */
  const header = document.querySelector('.site-header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 30) {
      header.style.boxShadow = '0 6px 20px rgba(20,49,59,0.18)';
    } else {
      header.style.boxShadow = 'none';
    }
  });

  /* ---------------------------------------------------------
     Order cart — per-dish "Order" buttons + checkout/receipt
     --------------------------------------------------------- */

  const cart = {}; // { dishName: { name, price(label), priceValue(number), qty, badgeEls: [] } }
  let currentOrderRef = '';
  let currentOrderDate = null;

  /* ---------- helpers ---------- */

  function parsePrice(label) {
    const match = String(label).replace(/,/g, '').match(/₹\s*([\d]+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : 0;
  }

  function formatRupees(n) {
    return '₹' + Math.round(n).toLocaleString('en-IN');
  }

  function computeTotal() {
    return Object.values(cart).reduce((sum, i) => sum + i.priceValue * i.qty, 0);
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, ch => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    ));
  }

  function generateOrderRef() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `ALFA${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${String(Date.now()).slice(-4)}`;
  }

  function formatReceiptDate(d) {
    return d.toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  /* Build a clean "₹45 (100g) / ₹450 (per kg)" style label from a .prices element,
     and read the FIRST price found as the orderable unit price (e.g. the 100g roll,
     or the single price for Kulfi Candy / Falooda items). */
  function readPrices(pricesEl) {
    const parts = [];
    pricesEl.querySelectorAll(':scope > span').forEach(span => {
      const labelEl = span.querySelector('.p-label');
      const labelText = labelEl ? labelEl.textContent.trim() : '';
      const clone = span.cloneNode(true);
      const lbl = clone.querySelector('.p-label');
      if (lbl) lbl.remove();
      const amount = clone.textContent.trim();
      parts.push(labelText ? `${amount} (${labelText})` : amount);
    });
    return parts.join(' / ');
  }

  function readDishName(flavourEl) {
    const clone = flavourEl.cloneNode(true);
    clone.querySelectorAll('.dot, .badge-pop').forEach(el => el.remove());
    return clone.textContent.trim().replace(/\s+/g, ' ');
  }

  /* ---------- cart bar (bottom) ---------- */

  function updateCartBar() {
    const bar = document.getElementById('orderCartBar');
    const countEl = document.getElementById('cartCount');
    const totalEl = document.getElementById('cartTotal');
    if (!bar) return;
    const items = Object.values(cart);
    const totalQty = items.reduce((sum, i) => sum + i.qty, 0);

    if (totalQty === 0) {
      bar.hidden = true;
      return;
    }
    bar.hidden = false;
    if (countEl) countEl.textContent = `${totalQty} item${totalQty > 1 ? 's' : ''} in order`;
    if (totalEl) totalEl.textContent = formatRupees(computeTotal());
  }

  /* ---------- cart mutation ---------- */

  function addToCart(name, priceLabel, priceValue, badgeEl, orderBtnEl) {
    if (!cart[name]) {
      cart[name] = { name, price: priceLabel, priceValue, qty: 0, badgeEls: [] };
    }
    cart[name].qty += 1;
    if (badgeEl && !cart[name].badgeEls.includes(badgeEl)) {
      cart[name].badgeEls.push(badgeEl);
    }
    cart[name].badgeEls.forEach(el => {
      el.hidden = false;
      el.textContent = `${cart[name].qty} added`;
    });
    if (orderBtnEl) {
      orderBtnEl.textContent = 'Added ✓';
      orderBtnEl.classList.add('added');
      clearTimeout(orderBtnEl._resetTimer);
      orderBtnEl._resetTimer = setTimeout(() => {
        orderBtnEl.textContent = 'Order';
        orderBtnEl.classList.remove('added');
      }, 900);
    }
    updateCartBar();
  }

  function removeFromCart(name) {
    const entry = cart[name];
    if (!entry || entry.qty <= 0) return;
    entry.qty -= 1;
    if (entry.qty <= 0) {
      entry.badgeEls.forEach(el => { el.hidden = true; el.textContent = ''; });
      delete cart[name];
    } else {
      entry.badgeEls.forEach(el => { el.textContent = `${entry.qty} added`; });
    }
    updateCartBar();
  }

  function clearCart() {
    Object.values(cart).forEach(entry => {
      entry.badgeEls.forEach(el => { el.hidden = true; el.textContent = ''; });
    });
    Object.keys(cart).forEach(key => delete cart[key]);
    updateCartBar();
  }

  function buildOrderMessage() {
    const items = Object.values(cart);
    const lines = items.map((i, idx) => {
      const lineTotal = i.priceValue * i.qty;
      return `${idx + 1}. ${i.name} — Qty ${i.qty} x ${i.price} = ${formatRupees(lineTotal)}`;
    });
    const total = computeTotal();
    return (
      "Hi, I'd like to order the following from Alfa Kulfi & Ice Cream:\n\n" +
      lines.join('\n') +
      `\n\nTotal Bill (approx.): ${formatRupees(total)}` +
      (currentOrderRef ? `\nOrder Ref: ${currentOrderRef}` : '') +
      "\n\nPlease confirm availability, final pricing & pickup/delivery time."
    );
  }

  /* ---------- per-dish order buttons on menu ---------- */

  function initDishOrderButtons() {
    document.querySelectorAll('.menu-panel .menu-row').forEach(item => {
      const priceEl = item.querySelector('.prices');
      const nameEl = item.querySelector('.flavour');
      if (!priceEl || !nameEl) return; // skip rows with no price

      const dishName = readDishName(nameEl);
      const priceLabel = readPrices(priceEl);
      const priceValue = parsePrice(priceLabel);

      // wrap price + controls together so the row keeps its two-column layout
      const rightWrap = document.createElement('span');
      rightWrap.className = 'menu-item-right';
      item.insertBefore(rightWrap, priceEl);
      rightWrap.appendChild(priceEl);

      const ctrl = document.createElement('div');
      ctrl.className = 'order-ctrl';

      const orderBtn = document.createElement('button');
      orderBtn.type = 'button';
      orderBtn.className = 'order-btn';
      orderBtn.textContent = 'Order';
      ctrl.appendChild(orderBtn);

      const qtyBadge = document.createElement('span');
      qtyBadge.className = 'order-qty';
      qtyBadge.hidden = true;
      ctrl.appendChild(qtyBadge);

      orderBtn.addEventListener('click', () => addToCart(dishName, priceLabel, priceValue, qtyBadge, orderBtn));

      // every item is a small treat — allow ordering more than one directly from the menu
      const plusBtn = document.createElement('button');
      plusBtn.type = 'button';
      plusBtn.className = 'order-plus';
      plusBtn.textContent = '+';
      plusBtn.setAttribute('aria-label', `Add one more ${dishName}`);
      plusBtn.addEventListener('click', () => addToCart(dishName, priceLabel, priceValue, qtyBadge, orderBtn));
      ctrl.appendChild(plusBtn);

      const minusBtn = document.createElement('button');
      minusBtn.type = 'button';
      minusBtn.className = 'order-minus';
      minusBtn.textContent = '−';
      minusBtn.setAttribute('aria-label', `Remove one ${dishName}`);
      minusBtn.addEventListener('click', () => removeFromCart(dishName));
      ctrl.appendChild(minusBtn);

      rightWrap.appendChild(ctrl);
    });
  }

  /* ---------- checkout / receipt overlay ---------- */

  const checkoutOverlay = document.getElementById('checkoutOverlay');
  const checkoutCartView = document.getElementById('checkoutCartView');
  const checkoutReceiptView = document.getElementById('checkoutReceiptView');

  function openCheckout() {
    if (!checkoutOverlay) return;
    showCartView();
    checkoutOverlay.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeCheckout() {
    if (!checkoutOverlay) return;
    checkoutOverlay.hidden = true;
    document.body.style.overflow = '';
  }

  function showCartView() {
    renderCheckoutItems();
    if (checkoutCartView) checkoutCartView.hidden = false;
    if (checkoutReceiptView) checkoutReceiptView.hidden = true;
  }

  function showReceiptView() {
    if (checkoutCartView) checkoutCartView.hidden = true;
    if (checkoutReceiptView) checkoutReceiptView.hidden = false;
  }

  function renderCheckoutItems() {
    const wrap = document.getElementById('checkoutItems');
    const totalEl = document.getElementById('checkoutTotal');
    const confirmBtn = document.getElementById('checkoutConfirmBtn');
    if (!wrap) return;
    const items = Object.values(cart);
    wrap.innerHTML = '';

    if (items.length === 0) {
      wrap.innerHTML = '<p class="checkout-empty">Your order is empty. Add flavours from the menu to get started.</p>';
      if (totalEl) totalEl.textContent = formatRupees(0);
      if (confirmBtn) confirmBtn.disabled = true;
      return;
    }
    if (confirmBtn) confirmBtn.disabled = false;

    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'checkout-item-row';
      row.innerHTML = `
        <span class="checkout-item-name">${escapeHtml(item.name)}<br><small>${escapeHtml(item.price)}</small></span>
        <div class="checkout-item-controls">
          <button type="button" class="co-minus" aria-label="Remove one ${escapeHtml(item.name)}">−</button>
          <span class="checkout-item-qty">${item.qty}</span>
          <button type="button" class="co-plus" aria-label="Add one more ${escapeHtml(item.name)}">+</button>
        </div>
        <span class="checkout-item-price">${formatRupees(item.priceValue * item.qty)}</span>
      `;
      row.querySelector('.co-minus').addEventListener('click', () => { removeFromCart(item.name); renderCheckoutItems(); });
      row.querySelector('.co-plus').addEventListener('click', () => { addToCart(item.name, item.price, item.priceValue, null, null); renderCheckoutItems(); });
      wrap.appendChild(row);
    });

    if (totalEl) totalEl.textContent = formatRupees(computeTotal());
  }

  function renderReceipt() {
    const itemsWrap = document.getElementById('receiptItems');
    const totalEl = document.getElementById('receiptTotal');
    const orderNoEl = document.getElementById('receiptOrderNo');
    const dateEl = document.getElementById('receiptDate');
    if (!itemsWrap) return;

    itemsWrap.innerHTML = '';
    Object.values(cart).forEach(item => {
      const row = document.createElement('div');
      row.className = 'receipt-item-row';
      row.innerHTML = `<span class="ri-name">${escapeHtml(item.name)} × ${item.qty}</span><span>${formatRupees(item.priceValue * item.qty)}</span>`;
      itemsWrap.appendChild(row);
    });

    if (totalEl) totalEl.textContent = formatRupees(computeTotal());
    if (orderNoEl) orderNoEl.textContent = `Order Ref: ${currentOrderRef}`;
    if (dateEl) dateEl.textContent = formatReceiptDate(currentOrderDate);
  }

  function confirmOrder() {
    if (Object.keys(cart).length === 0) return;
    currentOrderRef = generateOrderRef();
    currentOrderDate = new Date();
    renderReceipt();
    showReceiptView();
  }

  function sendFinalOrder() {
    if (Object.keys(cart).length === 0) return;
    const message = buildOrderMessage();
    const url = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;
    window.location.href = url;
  }

  /* ---------- receipt image download (canvas, site-themed) ---------- */

  function truncateText(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) {
      t = t.slice(0, -1);
    }
    return t + '…';
  }

  function drawDashedLine(ctx, x1, y, x2) {
    ctx.save();
    ctx.strokeStyle = 'rgba(20,49,59,.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();
    ctx.restore();
  }

  function downloadReceipt() {
    const items = Object.values(cart);
    if (items.length === 0) return;
    if (!currentOrderRef) {
      currentOrderRef = generateOrderRef();
      currentOrderDate = new Date();
    }

    const width = 600;
    const rowHeight = 30;
    const headerHeight = 108;
    const footerHeight = 110;
    const height = headerHeight + items.length * rowHeight + footerHeight + 70;

    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    // background
    ctx.fillStyle = '#F0FAFC';
    ctx.fillRect(0, 0, width, height);

    // sky-blue header band
    ctx.fillStyle = '#84D4E3';
    ctx.fillRect(0, 0, width, headerHeight - 18);

    // emblem
    ctx.beginPath();
    ctx.arc(50, 44, 22, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.fillStyle = '#0298E4';
    ctx.font = 'bold 22px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('A', 50, 46);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#14313B';
    ctx.font = 'bold 20px Georgia, serif';
    ctx.fillText('ALFA KULFI & ICE CREAM', 84, 38);
    ctx.font = '11px Arial';
    ctx.fillText('Byculla, Mumbai, Maharashtra', 84, 58);

    let y = headerHeight + 6;
    ctx.fillStyle = '#14313B';
    ctx.font = 'bold 13px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Order Ref: ${currentOrderRef}`, 24, y);
    ctx.textAlign = 'right';
    ctx.font = '12px Arial';
    ctx.fillText(formatReceiptDate(currentOrderDate), width - 24, y);
    ctx.textAlign = 'left';

    y += 18;
    drawDashedLine(ctx, 24, y, width - 24);
    y += 22;

    ctx.font = 'bold 11px Arial';
    ctx.fillStyle = '#0298E4';
    ctx.fillText('ITEM', 24, y);
    ctx.textAlign = 'center';
    ctx.fillText('QTY', width - 150, y);
    ctx.textAlign = 'right';
    ctx.fillText('AMOUNT', width - 24, y);
    ctx.textAlign = 'left';
    y += 16;
    drawDashedLine(ctx, 24, y, width - 24);
    y += 20;

    ctx.font = '13px Arial';
    items.forEach(item => {
      const lineTotal = item.priceValue * item.qty;
      ctx.fillStyle = '#14313B';
      ctx.textAlign = 'left';
      ctx.fillText(truncateText(ctx, item.name, width - 240), 24, y);
      ctx.textAlign = 'center';
      ctx.fillText(String(item.qty), width - 150, y);
      ctx.textAlign = 'right';
      ctx.fillText(formatRupees(lineTotal), width - 24, y);
      ctx.textAlign = 'left';
      y += rowHeight;
    });

    drawDashedLine(ctx, 24, y, width - 24);
    y += 30;

    ctx.font = 'bold 16px Georgia, serif';
    ctx.fillStyle = '#14313B';
    ctx.textAlign = 'left';
    ctx.fillText('TOTAL BILL', 24, y);
    ctx.textAlign = 'right';
    ctx.fillText(formatRupees(computeTotal()), width - 24, y);
    ctx.textAlign = 'left';

    y += 34;
    ctx.font = 'italic 13px Georgia, serif';
    ctx.fillStyle = '#3B5960';
    ctx.textAlign = 'center';
    ctx.fillText('Thank you for ordering with Alfa!', width / 2, y);
    y += 18;
    ctx.font = '11px Arial';
    ctx.fillText('+91 84338 29750 (WhatsApp)', width / 2, y);
    y += 15;
    ctx.fillText('Byculla, Mumbai, Maharashtra', width / 2, y);
    ctx.textAlign = 'left';

    const link = document.createElement('a');
    link.download = `Alfa-Kulfi-Receipt-${currentOrderRef}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  function initCheckout() {
    const viewBtn = document.getElementById('cartViewBtn');
    const closeBtn = document.getElementById('checkoutCloseBtn');
    const confirmBtn = document.getElementById('checkoutConfirmBtn');
    const clearLink = document.getElementById('checkoutClearLink');
    const sendBtn = document.getElementById('checkoutSendBtn');
    const downloadBtn = document.getElementById('checkoutDownloadBtn');

    if (viewBtn) viewBtn.addEventListener('click', openCheckout);
    if (closeBtn) closeBtn.addEventListener('click', closeCheckout);
    if (confirmBtn) confirmBtn.addEventListener('click', confirmOrder);
    if (clearLink) clearLink.addEventListener('click', () => { clearCart(); renderCheckoutItems(); });
    if (sendBtn) sendBtn.addEventListener('click', sendFinalOrder);
    if (downloadBtn) downloadBtn.addEventListener('click', downloadReceipt);

    if (checkoutOverlay) {
      checkoutOverlay.addEventListener('click', (e) => {
        if (e.target === checkoutOverlay) closeCheckout();
      });
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && checkoutOverlay && !checkoutOverlay.hidden) closeCheckout();
    });
  }

  initDishOrderButtons();
  initCheckout();

});
