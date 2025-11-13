// Chart data formatting service for react-native-chart-kit
// Transforms financial data into chart-ready formats

import type { FinanceOverviewData, TransactionRecord } from './FinancialDataService';

export interface LineChartData {
  labels: string[];
  datasets: {
    data: number[];
    color?: (opacity: number) => string;
    strokeWidth?: number;
  }[];
  legend?: string[];
}

export interface PieChartData {
  name: string;
  population: number;
  color: string;
  legendFontColor: string;
  legendFontSize: number;
}

export interface BarChartData {
  labels: string[];
  datasets: {
    data: number[];
    color?: (opacity: number) => string;
  }[];
}

const CHART_COLORS = [
  '#4F46E5', // Primary
  '#059669', // Green
  '#DC2626', // Red
  '#EA580C', // Orange
  '#7C3AED', // Purple
  '#0891B2', // Cyan
];

class ChartDataServiceImpl {
  // Format cash flow trend data for line chart
  formatCashFlowTrend(overview: FinanceOverviewData): LineChartData {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const currentMonth = new Date().getMonth();
    const labels = [];
    
    // Get last 6 months labels
    for (let i = 5; i >= 0; i--) {
      const monthIndex = (currentMonth - i + 12) % 12;
      labels.push(months[monthIndex]);
    }
    
    const revenueData = overview.revenueMonthly.slice(-6);
    const expenseData = overview.expensesMonthly.slice(-6);
    
    return {
      labels,
      datasets: [
        {
          data: revenueData,
          color: (opacity = 1) => `rgba(5, 150, 105, ${opacity})`, // Green
          strokeWidth: 2,
        },
        {
          data: expenseData,
          color: (opacity = 1) => `rgba(220, 38, 38, ${opacity})`, // Red
          strokeWidth: 2,
        },
      ],
      legend: ['Revenue', 'Expenses'],
    };
  }

  // Format expense categories for pie chart
  formatCategoriesBreakdown(overview: FinanceOverviewData): PieChartData[] {
    return overview.categoriesBreakdown.map((item, index) => ({
      name: item.name,
      population: item.value,
      color: CHART_COLORS[index % CHART_COLORS.length],
      legendFontColor: '#374151',
      legendFontSize: 12,
    }));
  }

  // Format monthly comparison for bar chart
  formatMonthlyComparison(overview: FinanceOverviewData): BarChartData {
    const currentMonth = new Date().getMonth();
    const lastMonth = (currentMonth - 1 + 12) % 12;
    
    const currentRevenue = overview.revenueMonthly[currentMonth] || 0;
    const lastRevenue = overview.revenueMonthly[lastMonth] || 0;
    const currentExpenses = overview.expensesMonthly[currentMonth] || 0;
    const lastExpenses = overview.expensesMonthly[lastMonth] || 0;
    
    return {
      labels: ['Last Month', 'This Month'],
      datasets: [
        {
          data: [lastRevenue, currentRevenue],
          color: (opacity = 1) => `rgba(5, 150, 105, ${opacity})`,
        },
        {
          data: [lastExpenses, currentExpenses],
          color: (opacity = 1) => `rgba(220, 38, 38, ${opacity})`,
        },
      ],
    };
  }

  // Format transaction volume over time
  formatTransactionVolume(transactions: TransactionRecord[]): LineChartData {
    // Group by day for last 7 days
    const days = 7;
    const labels = [];
    const incomeData = [];
    const expenseData = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      labels.push(date.toLocaleDateString('en', { weekday: 'short' }));
      
      const dayTransactions = transactions.filter(t => 
        t.date.startsWith(dateStr)
      );
      
      const dayIncome = dayTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      
      const dayExpenses = dayTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
      
      incomeData.push(dayIncome);
      expenseData.push(dayExpenses);
    }
    
    return {
      labels,
      datasets: [
        {
          data: incomeData,
          color: (opacity = 1) => `rgba(5, 150, 105, ${opacity})`,
          strokeWidth: 2,
        },
        {
          data: expenseData,
          color: (opacity = 1) => `rgba(220, 38, 38, ${opacity})`,
          strokeWidth: 2,
        },
      ],
      legend: ['Income', 'Expenses'],
    };
  }

  // Format budget utilization for progress charts
  formatBudgetUtilization(overview: FinanceOverviewData): {
    category: string;
    budgeted: number;
    spent: number;
    percentage: number;
    color: string;
  }[] {
    return overview.categoriesBreakdown.map((item, index) => {
      // Simulate budget data (in real app, this would come from budget service)
      const budgeted = item.value * 1.2; // Assume 20% over-budget scenario
      const spent = item.value;
      const percentage = (spent / budgeted) * 100;
      
      return {
        category: item.name,
        budgeted,
        spent,
        percentage,
        color: CHART_COLORS[index % CHART_COLORS.length],
      };
    });
  }

  // Common chart configuration for react-native-chart-kit
  getCommonChartConfig() {
    return {
      backgroundColor: '#ffffff',
      backgroundGradientFrom: '#ffffff',
      backgroundGradientTo: '#ffffff',
      decimalPlaces: 0,
      color: (opacity = 1) => `rgba(79, 70, 229, ${opacity})`,
      labelColor: (opacity = 1) => `rgba(55, 65, 81, ${opacity})`,
      style: {
        borderRadius: 16,
      },
      propsForDots: {
        r: '6',
        strokeWidth: '2',
        stroke: '#4F46E5',
      },
      propsForLabels: {
        fontSize: 12,
      },
    };
  }

  // Format currency for chart labels
  formatChartCurrency(amount: number): string {
    if (amount >= 1000000) {
      return `R${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `R${(amount / 1000).toFixed(0)}k`;
    } else {
      return `R${amount}`;
    }
  }
}

export const ChartDataService = new ChartDataServiceImpl();
