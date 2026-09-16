import { SERVICE_FEE_DISCOUNT_LABEL } from '@/lib/fees';
import type { ThermalReceiptData } from './thermalReceiptTypes';

const money = (n: number) => `Rs.${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
const moneyPlain = (n: number) => (Number.isFinite(n) ? n : 0).toFixed(2);

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const THERMAL_STYLES = `
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:#fff;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.trc-root{width:280px;max-width:48ch;margin:0 auto;padding:10px 8px 12px;
  font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;
  font-size:12px;line-height:1.35;color:#000;background:#fff}
.trc-root *{box-sizing:border-box}
.trc-brand{text-align:center;font-weight:700;font-size:13px;letter-spacing:0.06em;margin:0 0 2px}
.trc-sub{text-align:center;margin:0 0 8px;font-weight:500;color:#374151}
.trc-dash{border:none;border-top:1px dashed #9ca3af;margin:8px 0;height:0}
.trc-meta{margin:3px 0;text-align:left;word-break:break-word}
.trc-metaLabel{font-weight:600}
.trc-section{margin:10px 0 6px;font-weight:700;font-size:11px;letter-spacing:0.05em;text-transform:uppercase;color:#4b5563}
.trc-grid{display:grid;grid-template-columns:1.5fr 0.5fr 0.9fr 1fr;column-gap:8px;row-gap:4px;align-items:center;width:100%;min-width:0}
.trc-thead{margin-bottom:4px;padding-bottom:4px;border-bottom:1px solid #d1d5db;align-items:end}
.trc-th{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.03em;color:#6b7280;min-width:0}
.trc-thRight{text-align:right}
.trc-row{margin:4px 0;padding:4px 0;border-bottom:1px solid #e5e7eb;min-width:0}
.trc-itemName{font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:13.5px;line-height:1.2;min-width:0;word-break:break-word;overflow-wrap:break-word}
.trc-qty{font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:13.5px;line-height:1.2;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;min-width:0}
.trc-rate,.trc-amt{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;font-variant-numeric:tabular-nums;font-weight:500;font-size:12px;line-height:1.2;text-align:right;white-space:nowrap;overflow:hidden;min-width:0}
.trc-rate{min-width:55px}
.trc-amt{min-width:65px}
.trc-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;font-variant-numeric:tabular-nums}
.trc-summary{margin-top:10px}
.trc-sumRow{display:flex;justify-content:space-between;gap:8px;margin:3px 0;flex-wrap:nowrap}
.trc-total{margin-top:8px;padding-top:8px;border-top:2px solid #000;font-weight:700;font-size:13px}
.trc-foot{text-align:center;margin-top:12px;font-size:11px;color:#4b5563}
@page{margin:0;size:80mm auto}
@media print{
  .trc-root{width:80mm!important;max-width:80mm!important;margin:0!important;padding:4mm 3mm!important}
}
`;

export function renderThermalReceiptHtml(data: ThermalReceiptData): string {
  const brand = (data.brandTitle ?? 'LAUNDROSWIPE').trim();
  const subtitle = (data.subtitle ?? '').trim();
  const items = data.items;
  const amounts = items.map((i) => i.qty * i.rate);
  const subtotal = amounts.reduce((s, a) => s + a, 0);
  const discount = Math.max(0, data.discount);
  const serviceFee = Number.isFinite(data.serviceFee) ? data.serviceFee : 0;
  const computedTotal = subtotal - discount + serviceFee;
  const total = data.total != null && Number.isFinite(data.total) ? data.total : computedTotal;
  const totalItems = items.reduce((s, i) => s + i.qty, 0);

  const metaRow = (label: string, value: string | undefined | null) =>
    value && value.trim() !== '' && value !== '—'
      ? `<p class="trc-meta"><span class="trc-metaLabel">${esc(label)}:</span> ${esc(value)}</p>`
      : '';

  const itemsHtml = items
    .map(
      (it) => `
      <div class="trc-grid trc-row">
        <div class="trc-itemName" title="${esc(it.name)}">${esc(it.name)}</div>
        <div class="trc-qty">${esc(it.qty)}</div>
        <div class="trc-rate">${esc(moneyPlain(it.rate))}</div>
        <div class="trc-amt">${esc(moneyPlain(it.qty * it.rate))}</div>
      </div>`,
    )
    .join('');

  const discountLabel = serviceFee === 0 ? SERVICE_FEE_DISCOUNT_LABEL : 'Discount';
  const discountRow =
    discount > 0
      ? `<div class="trc-sumRow"><span>${esc(discountLabel)}</span><span class="trc-mono">&minus;${esc(money(discount))}</span></div>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Bill #${esc(data.token)}</title>
<style>${THERMAL_STYLES}</style>
</head>
<body>
<div class="trc-root">
  <header>
    <p class="trc-brand">${esc(brand)}</p>
    ${subtitle ? `<p class="trc-sub">${esc(subtitle)}</p>` : ''}
  </header>
  <hr class="trc-dash"/>
  <section>
    ${metaRow('Token', `#${data.token}`)}
    ${metaRow('Order', data.orderId)}
    ${metaRow('Customer ID', data.customerId)}
    ${data.userEmail ? metaRow('Email', data.userEmail) : ''}
  </section>
  <hr class="trc-dash"/>
  <section>
    ${metaRow('Customer', data.customer.name)}
    ${metaRow('Phone', data.customer.phone)}
    ${metaRow('Reg no', data.customer.regNo)}
    ${metaRow('Location', data.customer.location)}
    ${metaRow('Date', data.dateTime)}
  </section>
  <hr class="trc-dash"/>
  <p class="trc-section">Items</p>
  <div aria-label="Line items">
    <div class="trc-grid trc-thead">
      <div class="trc-th">Item</div>
      <div class="trc-th trc-thRight">Qty</div>
      <div class="trc-th trc-thRight">Rate</div>
      <div class="trc-th trc-thRight">Amt</div>
    </div>
    ${itemsHtml}
  </div>
  <hr class="trc-dash"/>
  <section class="trc-summary">
    <div class="trc-sumRow"><span>Total items</span><span>${esc(totalItems)}</span></div>
    <div class="trc-sumRow"><span>Subtotal</span><span class="trc-mono">${esc(money(subtotal))}</span></div>
    ${discountRow}
    <div class="trc-sumRow"><span>Service fee</span><span class="trc-mono">${esc(money(serviceFee))}</span></div>
    <div class="trc-sumRow trc-total"><span>TOTAL</span><span class="trc-mono">${esc(money(total))}</span></div>
  </section>
  <p class="trc-foot">${esc(data.footer ?? 'Thank you!')}</p>
  <p class="trc-foot">Note: Customers must count and check their clothes at collection.</p>
</div>
</body>
</html>`;
}
