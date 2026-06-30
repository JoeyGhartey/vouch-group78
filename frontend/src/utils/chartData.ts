interface Transaction {
  amount: number;
  type: string;
  transactionDate: string;
}

interface ChartData {
  labels: string[];
  datasets: [{ data: number[] }, { data: number[] }];
}

export type ChartPeriod = 'day' | 'week' | 'month' | 'year' | 'custom';

export function aggregateTransactions(
  transactions: Transaction[],
  period: ChartPeriod,
  fromDate?: string,
  toDate?: string,
): ChartData {
  switch (period) {
    case 'day': return aggregateDay(transactions);
    case 'week': return aggregateWeek(transactions);
    case 'month': return aggregateMonth(transactions);
    case 'year': return aggregateYear(transactions);
    case 'custom': return aggregateCustom(transactions, fromDate, toDate);
  }
}

function aggregateDay(transactions: Transaction[]): ChartData {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const income = new Array(8).fill(0);
  const expense = new Array(8).fill(0);
  const labels: string[] = [];

  for (let h = 0; h < 24; h += 3) {
    labels.push(`${h.toString().padStart(2, '0')}:00`);
  }

  for (const tx of transactions) {
    const txDate = new Date(tx.transactionDate);
    const txDay = new Date(txDate.getFullYear(), txDate.getMonth(), txDate.getDate());
    if (txDay.getTime() !== todayStart.getTime()) continue;
    const bucket = Math.min(Math.floor(txDate.getHours() / 3), 7);
    if (tx.type === 'INCOME') income[bucket] += tx.amount;
    else expense[bucket] += tx.amount;
  }

  return { labels, datasets: [{ data: income }, { data: expense }] };
}

function aggregateWeek(transactions: Transaction[]): ChartData {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const now = new Date();
  const income = new Array(7).fill(0);
  const expense = new Array(7).fill(0);
  const labels: string[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    labels.push(dayNames[d.getDay()]);
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (const tx of transactions) {
    const txDate = new Date(tx.transactionDate);
    const txDay = new Date(txDate.getFullYear(), txDate.getMonth(), txDate.getDate());
    const diffDays = Math.round((today.getTime() - txDay.getTime()) / 86400000);
    if (diffDays < 0 || diffDays > 6) continue;
    const idx = 6 - diffDays;
    if (tx.type === 'INCOME') income[idx] += tx.amount;
    else expense[idx] += tx.amount;
  }

  return { labels, datasets: [{ data: income }, { data: expense }] };
}

function aggregateMonth(transactions: Transaction[]): ChartData {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weekCount = Math.ceil(daysInMonth / 7);

  const income = new Array(weekCount).fill(0);
  const expense = new Array(weekCount).fill(0);
  const labels = Array.from({ length: weekCount }, (_, i) => `Week ${i + 1}`);

  for (const tx of transactions) {
    const txDate = new Date(tx.transactionDate);
    if (txDate.getFullYear() !== year || txDate.getMonth() !== month) continue;
    const weekIdx = Math.min(Math.floor((txDate.getDate() - 1) / 7), weekCount - 1);
    if (tx.type === 'INCOME') income[weekIdx] += tx.amount;
    else expense[weekIdx] += tx.amount;
  }

  return { labels, datasets: [{ data: income }, { data: expense }] };
}

function aggregateYear(transactions: Transaction[]): ChartData {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  const income = new Array(12).fill(0);
  const expense = new Array(12).fill(0);
  const labels: string[] = [];

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(monthNames[d.getMonth()]);
  }

  for (const tx of transactions) {
    const txDate = new Date(tx.transactionDate);
    const monthsDiff = (now.getFullYear() - txDate.getFullYear()) * 12 + (now.getMonth() - txDate.getMonth());
    if (monthsDiff < 0 || monthsDiff > 11) continue;
    const idx = 11 - monthsDiff;
    if (tx.type === 'INCOME') income[idx] += tx.amount;
    else expense[idx] += tx.amount;
  }

  return { labels, datasets: [{ data: income }, { data: expense }] };
}

function aggregateCustom(transactions: Transaction[], fromDate?: string, toDate?: string): ChartData {
  const empty: ChartData = { labels: ['—'], datasets: [{ data: [0] }, { data: [0] }] };
  if (!fromDate || !toDate) return empty;

  const from = new Date(fromDate + 'T00:00:00');
  const to = new Date(toDate + 'T23:59:59');
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) return empty;

  const fromDay = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const toDay = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  const totalDays = Math.round((toDay.getTime() - fromDay.getTime()) / 86400000) + 1;

  if (totalDays > 90) {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const months: { year: number; month: number }[] = [];
    const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    const endMonth = new Date(to.getFullYear(), to.getMonth(), 1);
    while (cursor <= endMonth) {
      months.push({ year: cursor.getFullYear(), month: cursor.getMonth() });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    const income = new Array(months.length).fill(0);
    const expense = new Array(months.length).fill(0);
    const labels = months.map((m) => monthNames[m.month] + (months.length > 12 ? ` '${String(m.year).slice(2)}` : ''));

    for (const tx of transactions) {
      const txDate = new Date(tx.transactionDate);
      if (txDate < from || txDate > to) continue;
      const idx = months.findIndex((m) => m.year === txDate.getFullYear() && m.month === txDate.getMonth());
      if (idx === -1) continue;
      if (tx.type === 'INCOME') income[idx] += tx.amount;
      else expense[idx] += tx.amount;
    }
    return { labels, datasets: [{ data: income }, { data: expense }] };
  }

  const income = new Array(totalDays).fill(0);
  const expense = new Array(totalDays).fill(0);
  const labels: string[] = [];

  for (let i = 0; i < totalDays; i++) {
    const d = new Date(fromDay);
    d.setDate(d.getDate() + i);
    labels.push(`${d.getDate()}/${d.getMonth() + 1}`);
  }

  for (const tx of transactions) {
    const txDate = new Date(tx.transactionDate);
    if (txDate < from || txDate > to) continue;
    const txDay = new Date(txDate.getFullYear(), txDate.getMonth(), txDate.getDate());
    const idx = Math.round((txDay.getTime() - fromDay.getTime()) / 86400000);
    if (idx < 0 || idx >= totalDays) continue;
    if (tx.type === 'INCOME') income[idx] += tx.amount;
    else expense[idx] += tx.amount;
  }

  return { labels, datasets: [{ data: income }, { data: expense }] };
}
