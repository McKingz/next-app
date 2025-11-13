// Core financial data service: fetches and shapes finance data
// In production, replace mock implementations with Supabase queries

export type TransactionType = 'income' | 'expense';

export interface TransactionRecord {
  id: string;
  type: TransactionType;
  category: string;
  amount: number;
  description: string;
  date: string; // ISO
  status: 'completed' | 'pending' | 'overdue' | 'approved' | 'rejected';
}

export interface FinanceOverviewData {
  revenueMonthly: number[]; // last 12 months
  expensesMonthly: number[]; // last 12 months
  categoriesBreakdown: { name: string; value: number }[];
  keyMetrics: {
    monthlyRevenue: number;
    monthlyExpenses: number;
    cashFlow: number;
  };
  // Indicates that the service returned fallback/sample (mock) data
  isSample?: boolean;
}

export interface DateRange {
  from: string; // ISO
  to: string;   // ISO
}

const categories = ['Tuition', 'Supplies', 'Salaries', 'Maintenance', 'Utilities', 'Other'];

function randomSeeded(seed: number) {
  let s = seed;
  return () => (s = Math.sin(s) * 10000) - Math.floor(Math.sin(s) * 10000);
}

class FinancialDataServiceImpl {
  // Mock: generate repeatable data
  private rng = randomSeeded(42);

  async getOverview(): Promise<FinanceOverviewData> {
    // Generate last 12 months revenue and expenses
    const revenueMonthly: number[] = [];
    const expensesMonthly: number[] = [];

    for (let i = 0; i < 12; i++) {
      const rev = 80000 + Math.floor(this.rng() * 30000);
      const exp = 60000 + Math.floor(this.rng() * 25000);
      revenueMonthly.push(rev);
      expensesMonthly.push(exp);
    }

    const categoriesBreakdown = categories.map((name) => ({
      name,
      value: Math.floor(this.rng() * 20000) + 2000,
    }));

    const monthlyRevenue = revenueMonthly[revenueMonthly.length - 1];
    const monthlyExpenses = expensesMonthly[expensesMonthly.length - 1];

    return {
      revenueMonthly,
      expensesMonthly,
      categoriesBreakdown,
      keyMetrics: {
        monthlyRevenue,
        monthlyExpenses,
        cashFlow: monthlyRevenue - monthlyExpenses,
      },
      isSample: true,
    };
  }

  async getTransactions(range: DateRange): Promise<TransactionRecord[]> {
    const start = new Date(range.from).getTime();
    const end = new Date(range.to).getTime();
    const days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));

    const out: TransactionRecord[] = [];
    for (let i = 0; i < Math.min(120, days); i++) {
      const isIncome = this.rng() > 0.35;
      const amount = Math.floor(this.rng() * (isIncome ? 5000 : 3000)) + (isIncome ? 1500 : 300);
      const date = new Date(start + (i * (end - start)) / Math.max(1, days - 1)).toISOString();
      const category = categories[Math.floor(this.rng() * categories.length)];
      out.push({
        id: `${date}-${i}`,
        type: isIncome ? 'income' : 'expense',
        category,
        amount,
        description: `${isIncome ? 'Income' : 'Expense'} • ${category}`,
        date,
        status: 'completed',
      });
    }
    // Sort newest first
    out.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return out;
  }
}

export const FinancialDataService = new FinancialDataServiceImpl();

