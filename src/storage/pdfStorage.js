import * as Print   from 'expo-print';
import * as Sharing from 'expo-sharing';
import { buildLedger } from './ledgerStorage';

// ── Generate HTML for single customer ledger ──────────────
const generateCustomerHTML = (customer) => {
  const date = new Date().toLocaleDateString('en-PK', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  const activeFarmers = customer.farmers.filter(f => f.outstanding > 0);

  const farmersHTML = activeFarmers.map(farmer => {
    const txRows = farmer.transactions.map((tx, idx) => `
      <tr class="${idx % 2 === 0 ? 'row-even' : 'row-odd'}">
        <td>${tx.date}</td>
        <td>${tx.type === 'bill' ? 'Bill' : 'Payment'}</td>
        <td class="right">${tx.debit  > 0 ? tx.debit.toLocaleString()  : ''}</td>
        <td class="right">${tx.credit > 0 ? tx.credit.toLocaleString() : ''}</td>
        <td class="right"><b>${tx.runningBalance.toLocaleString()}</b></td>
      </tr>
    `).join('');

    return `
      <tr class="farmer-row">
        <td colspan="4"><b>👨‍🌾 ${farmer.farmerName}</b></td>
        <td class="right"><b>Rs ${farmer.outstanding.toLocaleString()}</b></td>
      </tr>
      ${txRows}
      <tr class="spacer"><td colspan="5"></td></tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: Arial, sans-serif;
          font-size: 11px;
          color: #000;
          padding: 16px;
        }
        .header {
          border-bottom: 2px solid #000;
          padding-bottom: 8px;
          margin-bottom: 10px;
        }
        .header h2 { font-size: 14px; }
        .header p  { font-size: 11px; margin-top: 2px; }
        .summary {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
          font-size: 11px;
          border-bottom: 1px solid #000;
          padding-bottom: 6px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10px;
        }
        th {
          background: #000;
          color: #fff;
          padding: 4px 6px;
          text-align: left;
        }
        th.right, td.right { text-align: right; }
        td { padding: 3px 6px; border-bottom: 1px solid #ddd; }
        .row-even { background: #f9f9f9; }
        .row-odd  { background: #fff; }
        .farmer-row td {
          background: #e0e0e0;
          padding: 4px 6px;
          font-size: 10px;
        }
        .spacer td { height: 4px; border: none; }
        .footer {
          margin-top: 12px;
          border-top: 1px solid #000;
          padding-top: 6px;
          font-size: 9px;
          color: #555;
        }
      </style>
    </head>
    <body>

      <div class="header">
        <h2>NSBill — Customer Ledger</h2>
        <p>${customer.customerName} &nbsp;|&nbsp; Generated: ${date}</p>
      </div>

      <div class="summary">
        <span>Farmers: ${activeFarmers.length}</span>
        <span>Total Billed: Rs ${customer.totalBilled.toLocaleString()}</span>
        <span>Total Paid: Rs ${customer.totalPaid.toLocaleString()}</span>
        ${customer.advanceBalance > 0
          ? `<span>Advance: Rs ${customer.advanceBalance.toLocaleString()}</span>`
          : ''}
        <span><b>Outstanding: Rs ${customer.outstanding.toLocaleString()}</b></span>
      </div>

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th class="right">Debit</th>
            <th class="right">Credit</th>
            <th class="right">Balance</th>
          </tr>
        </thead>
        <tbody>
          ${activeFarmers.length === 0
            ? '<tr><td colspan="5" style="text-align:center;padding:20px">No outstanding balances.</td></tr>'
            : farmersHTML}
        </tbody>
      </table>

      <div class="footer">
        NSBill — Agricultural Products Distribution &nbsp;|&nbsp; Computer generated statement
      </div>

    </body>
    </html>
  `;
};

// ── Generate and share PDF for a customer ─────────────────
export const generateAndShareCustomerPDF = async (customerName) => {
  try {
    // Get fresh ledger data
    const ledger   = await buildLedger();
    const customer = ledger.find(
      c => c.customerName.toLowerCase() === customerName.toLowerCase()
    );

    if (!customer) {
      throw new Error('No outstanding balance found for this customer.');
    }

    const html = generateCustomerHTML(customer);

    // Generate PDF
    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    // Share it
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) throw new Error('Sharing not available on this device.');

    const date     = new Date().toISOString().split('T')[0];
    const fileName = `${customerName.replace(/\s+/g, '_')}_Ledger_${date}.pdf`;

    await Sharing.shareAsync(uri, {
      mimeType:    'application/pdf',
      dialogTitle: `Share Ledger — ${customerName}`,
      UTI:         'com.adobe.pdf',
    });

    return fileName;
  } catch (e) {
    console.error('generateAndShareCustomerPDF error:', e);
    throw e;
  }
};
// ── Generate chronological ledger report for a customer ───
export const generateLedgerReport = async (customerName, fromDate, toDate) => {
  try {
    const { getAllBills }    = await import('./billStorage');
    const { getAllPayments } = await import('./paymentStorage');

    const allBills    = await getAllBills();
    const allPayments = await getAllPayments();

    // ── Filter to this customer ─────────────────────────
    const customerBills = allBills.filter(
      b => b.customerName.toLowerCase() === customerName.toLowerCase()
    );
    const customerPayments = allPayments.filter(
      p => p.customerName.toLowerCase() === customerName.toLowerCase()
    );

    // ── Date helpers ────────────────────────────────────
    const parseDate = (str) => {
      if (!str) return new Date(0);
      const [d, m, y] = str.split('/');
      return new Date(y, m - 1, d);
    };

    const formatDateDisplay = (d) => {
      const day   = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year  = d.getFullYear();
      return `${day}/${month}/${year}`;
    };

    const fromD = fromDate ? parseDate(fromDate) : new Date(0);
    const toD   = toDate   ? parseDate(toDate)   : new Date(9999, 11, 31);
    toD.setHours(23, 59, 59);

    // ── Build transaction list ───────────────────────────
    const transactions = [];

    customerBills.forEach(bill => {
      const d = parseDate(bill.date);
      if (d >= fromD && d <= toD) {
        transactions.push({
          date:        bill.date,
          dateObj:     d,
          particulars: `${bill.farmerName || 'General'} — Bill`,
          farmerName:  bill.farmerName || 'General',
          debit:       bill.amount,
          credit:      0,
          type:        'bill',
          id:          bill.id,
        });
      }
    });

    customerPayments.forEach(payment => {
      const d = parseDate(payment.date);
      if (d >= fromD && d <= toD) {
        const particulars = payment.type === 'advance'
          ? 'Advance Received'
          : `Payment Received${payment.farmerName ? ' — ' + payment.farmerName : ''}`;
        transactions.push({
          date:        payment.date,
          dateObj:     d,
          particulars,
          farmerName:  payment.farmerName || (payment.type === 'advance' ? '__advance__' : 'General'),
          debit:       0,
          credit:      payment.amount,
          type:        payment.type === 'advance' ? 'advance' : 'payment',
          id:          payment.id,
        });
      }
    });

    // Sort chronologically
    transactions.sort((a, b) => a.dateObj - b.dateObj);

    // ── Compute running balance ──────────────────────────
    let running = 0;
    const txWithBalance = transactions.map(tx => {
      running += tx.debit - tx.credit;
      return { ...tx, balance: running };
    });

    const totalDebit  = transactions.reduce((s, t) => s + t.debit,  0);
    const totalCredit = transactions.reduce((s, t) => s + t.credit, 0);
    const closing     = totalDebit - totalCredit;

    // ── Farmer-wise summary ──────────────────────────────
    const farmerMap = {};
    transactions.forEach(tx => {
      const key = tx.farmerName;
      if (!farmerMap[key]) {
        farmerMap[key] = { name: key, debit: 0, credit: 0 };
      }
      farmerMap[key].debit  += tx.debit;
      farmerMap[key].credit += tx.credit;
    });
    const farmerSummaries = Object.values(farmerMap).map(f => ({
      ...f,
      balance: f.debit - f.credit,
    }));

    // ── Period label ─────────────────────────────────────
    const periodLabel = fromDate && toDate
      ? `${fromDate} to ${toDate}`
      : fromDate
        ? `From ${fromDate}`
        : toDate
          ? `Up to ${toDate}`
          : 'All Dates';

    const printedOn = formatDateDisplay(new Date());

    // ── HTML ─────────────────────────────────────────────
    const rowsHTML = txWithBalance.map(tx => `
      <tr>
        <td>${tx.date}</td>
        <td>${tx.particulars}</td>
        <td class="r">${tx.debit  > 0 ? tx.debit.toLocaleString()  : '—'}</td>
        <td class="r">${tx.credit > 0 ? tx.credit.toLocaleString() : '—'}</td>
        <td class="r b">${tx.balance.toLocaleString()}</td>
      </tr>
    `).join('');

    const farmerRowsHTML = farmerSummaries.map(f => `
      <tr>
        <td colspan="2">${f.name === '__advance__' ? 'Advance (General)' : f.name}</td>
        <td class="r">${f.debit  > 0 ? f.debit.toLocaleString()  : '—'}</td>
        <td class="r">${f.credit > 0 ? f.credit.toLocaleString() : '—'}</td>
        <td class="r b">${f.balance.toLocaleString()}</td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: Arial, sans-serif; font-size: 11px; color: #000; padding: 20px; }
.center { text-align: center; }
.company { font-size: 16px; font-weight: bold; letter-spacing: 1px; }
.sub { font-size: 11px; color: #555; margin-top: 2px; }
.title { font-size: 13px; font-weight: bold; margin: 6px 0 2px; }
.meta { font-size: 10px; color: #555; }
hr.thick { border: none; border-top: 2px solid #000; margin: 8px 0; }
hr.thin  { border: none; border-top: 0.5px solid #ccc; margin: 0; }
table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 10px; }
th { border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 4px 6px; font-weight: bold; text-align: left; }
th.r { text-align: right; }
td { padding: 3px 6px; border-bottom: 0.5px solid #ddd; }
td.r { text-align: right; }
td.b { font-weight: bold; }
.section-header td { background: #f0f0f0; font-weight: bold; padding: 4px 6px; border-top: 1px solid #000; border-bottom: 1px solid #000; letter-spacing: 0.5px; font-size: 9px; }
.closing td { border-top: 2px solid #000; font-weight: bold; padding: 5px 6px; }
.spacer td { border: none; padding: 8px 0; }
.footer { margin-top: 16px; border-top: 0.5px solid #ccc; padding-top: 6px; display: flex; justify-content: space-between; font-size: 9px; color: #777; }
</style>
</head>
<body>

<div class="center">
  <div class="company">NAYA SAWERA</div>
  <div class="sub">Agricultural Products Distribution</div>
</div>
<hr class="thick">
<div class="center">
  <div class="title">CUSTOMER LEDGER STATEMENT</div>
  <div class="meta">Customer: ${customerName} &nbsp;|&nbsp; Period: ${periodLabel}</div>
  <div class="meta">Printed: ${printedOn}</div>
</div>

<table>
  <thead>
    <tr>
      <th style="width:70px">Date</th>
      <th>Farmer / Particulars</th>
      <th class="r" style="width:75px">Debit</th>
      <th class="r" style="width:75px">Credit</th>
      <th class="r" style="width:80px">Balance</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>${fromDate || '—'}</td>
      <td>Opening Balance</td>
      <td class="r">—</td>
      <td class="r">—</td>
      <td class="r b">0</td>
    </tr>
    ${rowsHTML}
    <tr class="spacer"><td colspan="5"></td></tr>
    <tr class="section-header">
      <td colspan="5">FARMER-WISE SUMMARY</td>
    </tr>
    ${farmerRowsHTML}
    <tr class="spacer"><td colspan="5"></td></tr>
    <tr class="closing">
      <td colspan="2">Closing Balance &nbsp;|&nbsp; ${toDate || printedOn}</td>
      <td class="r">${totalDebit.toLocaleString()}</td>
      <td class="r">${totalCredit.toLocaleString()}</td>
      <td class="r">${closing.toLocaleString()}</td>
    </tr>
  </tbody>
</table>

<div class="footer">
  <span>NSBill — computer generated statement</span>
  <span>Page 1 of 1</span>
</div>

</body>
</html>`;

    // ── Generate PDF & Share ─────────────────────────────

    const { uri } = await Print.printToFileAsync({ html, base64: false });

    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) throw new Error('Sharing not available on this device.');

    const fileName = `${customerName.replace(/\s+/g, '_')}_Ledger_${periodLabel.replace(/\//g, '-').replace(/\s+/g, '_')}.pdf`;

    await Sharing.shareAsync(uri, {
      mimeType:    'application/pdf',
      dialogTitle: `Ledger Report — ${customerName}`,
      UTI:         'com.adobe.pdf',
    });

    return fileName;
  } catch (e) {
    console.error('generateLedgerReport error:', e);
    throw e;
  }
};