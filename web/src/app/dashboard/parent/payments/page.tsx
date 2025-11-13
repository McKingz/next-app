'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { ParentShell } from '@/components/dashboard/parent/ParentShell';
import {
  DollarSign,
  CreditCard,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  Download,
  Upload,
  FileText,
  Info,
  ArrowLeft,
} from 'lucide-react';

interface Payment {
  id: string;
  amount: number;
  dueDate: string;
  status: 'paid' | 'pending' | 'overdue';
  description: string;
  paidDate?: string;
  paymentMethod?: string;
}

interface FeeStructure {
  id: string;
  name: string;
  amount: number;
  frequency: 'monthly' | 'quarterly' | 'annual' | 'once-off';
  description: string;
}

export default function PaymentsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState<string>('');
  const [userId, setUserId] = useState<string>();
  const { slug } = useTenantSlug(userId);
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'upload'>('overview');
  const [loading, setLoading] = useState(true);

  // Mock data - replace with real API calls
  const [balance, setBalance] = useState(0);
  const [upcomingPayments, setUpcomingPayments] = useState<Payment[]>([
    {
      id: '1',
      amount: 1250,
      dueDate: '2025-02-05',
      status: 'pending',
      description: 'February 2025 Tuition',
    },
    {
      id: '2',
      amount: 350,
      dueDate: '2025-02-10',
      status: 'pending',
      description: 'February 2025 Meals',
    },
  ]);
  const [paymentHistory, setPaymentHistory] = useState<Payment[]>([
    {
      id: '3',
      amount: 1250,
      dueDate: '2025-01-05',
      status: 'paid',
      description: 'January 2025 Tuition',
      paidDate: '2025-01-04',
      paymentMethod: 'Bank Transfer',
    },
    {
      id: '4',
      amount: 350,
      dueDate: '2025-01-10',
      status: 'paid',
      description: 'January 2025 Meals',
      paidDate: '2025-01-09',
      paymentMethod: 'EFT',
    },
  ]);
  const [feeStructure, setFeeStructure] = useState<FeeStructure[]>([
    {
      id: '1',
      name: 'Monthly Tuition',
      amount: 1250,
      frequency: 'monthly',
      description: 'Regular monthly school fees',
    },
    {
      id: '2',
      name: 'Meals',
      amount: 350,
      frequency: 'monthly',
      description: 'Breakfast and lunch',
    },
    {
      id: '3',
      name: 'Registration Fee',
      amount: 500,
      frequency: 'once-off',
      description: 'One-time registration (already paid)',
    },
  ]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/sign-in');
        return;
      }
      setEmail(session.user.email || '');
      setUserId(session.user.id);
      
      // TODO: Fetch real payment data from database
      // const { data: payments } = await supabase
      //   .from('payments')
      //   .select('*')
      //   .eq('parent_id', session.user.id);
      
      setLoading(false);
    })();
  }, [router, supabase.auth]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-ZA', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: Payment['status']) => {
    switch (status) {
      case 'paid':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 10px',
            background: 'rgba(34, 197, 94, 0.1)',
            color: '#22c55e',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
          }}>
            <CheckCircle2 className="w-3 h-3" />
            Paid
          </span>
        );
      case 'pending':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 10px',
            background: 'rgba(251, 191, 36, 0.1)',
            color: '#fbbf24',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
          }}>
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      case 'overdue':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 10px',
            background: 'rgba(239, 68, 68, 0.1)',
            color: '#ef4444',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
          }}>
            <AlertCircle className="w-3 h-3" />
            Overdue
          </span>
        );
    }
  };

  const totalUpcoming = upcomingPayments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <ParentShell tenantSlug={slug} userEmail={email}>
      <div className="container">
        {/* Back Button */}
        <button
          onClick={() => router.push('/dashboard/parent')}
          className="btn"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 24,
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            padding: '8px 16px',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 500
          }}
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>

        <div className="section">
          <h1 className="h1" style={{ marginBottom: 'var(--space-2)' }}>Fees & Payments</h1>
          <p className="muted" style={{ marginBottom: 'var(--space-6)' }}>
            Manage your child's school fees, view payment history, and upload proof of payment.
          </p>

          {/* Overview Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: 'var(--space-4)',
            marginBottom: 'var(--space-6)',
          }}>
            <div className="card" style={{
              padding: 'var(--space-4)',
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.1) 100%)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                <span className="muted" style={{ fontSize: 13 }}>Outstanding Balance</span>
                <DollarSign className="w-5 h-5" style={{ color: '#ef4444' }} />
              </div>
              <div style={{ fontSize: 32, fontWeight: 'bold', color: '#ef4444' }}>
                {formatCurrency(balance)}
              </div>
              <p className="muted" style={{ fontSize: 12, marginTop: 'var(--space-2)' }}>
                {balance === 0 ? '✅ All caught up!' : `${upcomingPayments.length} payment(s) pending`}
              </p>
            </div>

            <div className="card" style={{ padding: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                <span className="muted" style={{ fontSize: 13 }}>Next Payment Due</span>
                <Calendar className="w-5 h-5" style={{ color: 'var(--primary)' }} />
              </div>
              <div style={{ fontSize: 24, fontWeight: 'bold' }}>
                {upcomingPayments.length > 0 ? formatDate(upcomingPayments[0].dueDate) : 'None'}
              </div>
              <p className="muted" style={{ fontSize: 12, marginTop: 'var(--space-2)' }}>
                {upcomingPayments.length > 0 ? upcomingPayments[0].description : 'No upcoming payments'}
              </p>
            </div>

            <div className="card" style={{ padding: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                <span className="muted" style={{ fontSize: 13 }}>Total This Month</span>
                <CreditCard className="w-5 h-5" style={{ color: 'var(--accent)' }} />
              </div>
              <div style={{ fontSize: 24, fontWeight: 'bold' }}>
                {formatCurrency(totalUpcoming)}
              </div>
              <p className="muted" style={{ fontSize: 12, marginTop: 'var(--space-2)' }}>
                Tuition + meals
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div style={{
            display: 'flex',
            gap: 'var(--space-2)',
            borderBottom: '1px solid var(--border)',
            marginBottom: 'var(--space-5)',
          }}>
            {[
              { id: 'overview', label: 'Upcoming' },
              { id: 'history', label: 'Payment History' },
              { id: 'upload', label: 'Upload Proof of Payment' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  padding: 'var(--space-3) var(--space-4)',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
                  color: activeTab === tab.id ? 'var(--text)' : 'var(--muted)',
                  fontWeight: activeTab === tab.id ? 600 : 400,
                  cursor: 'pointer',
                  fontSize: 14,
                }}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <div>
              <h2 className="h2" style={{ marginBottom: 'var(--space-4)' }}>Upcoming Payments</h2>
              
              {upcomingPayments.length === 0 ? (
                <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                  <CheckCircle2 className="w-12 h-12" style={{ color: 'var(--success)', margin: '0 auto var(--space-3)' }} />
                  <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 'var(--space-2)' }}>All Caught Up!</h3>
                  <p className="muted">You have no outstanding payments at this time.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                  {upcomingPayments.map((payment) => (
                    <div key={payment.id} className="card" style={{ padding: 'var(--space-4)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
                        <div style={{ flex: 1 }}>
                          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                            {payment.description}
                          </h3>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 13 }} className="muted">
                            <Calendar className="w-4 h-4" />
                            Due: {formatDate(payment.dueDate)}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 'var(--space-2)' }}>
                            {formatCurrency(payment.amount)}
                          </div>
                          {getStatusBadge(payment.status)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                        <button className="btn btnPrimary" style={{ flex: 1 }}>
                          <CreditCard className="icon16" />
                          Pay Now
                        </button>
                        <button className="btn btnSecondary" onClick={() => setActiveTab('upload')}>
                          <Upload className="icon16" />
                          Upload Proof
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Fee Structure */}
              <div style={{ marginTop: 'var(--space-6)' }}>
                <h2 className="h2" style={{ marginBottom: 'var(--space-4)' }}>Fee Structure</h2>
                <div className="card" style={{ padding: 'var(--space-4)' }}>
                  <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                    {feeStructure.map((fee) => (
                      <div
                        key={fee.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: 'var(--space-3)',
                          background: 'var(--surface)',
                          borderRadius: 'var(--radius-2)',
                        }}>
                        <div>
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>{fee.name}</div>
                          <div className="muted" style={{ fontSize: 12 }}>
                            {fee.description} • {fee.frequency}
                          </div>
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>
                          {formatCurrency(fee.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div>
              <h2 className="h2" style={{ marginBottom: 'var(--space-4)' }}>Payment History</h2>
              
              {paymentHistory.length === 0 ? (
                <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                  <FileText className="w-12 h-12" style={{ color: 'var(--muted)', margin: '0 auto var(--space-3)' }} />
                  <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 'var(--space-2)' }}>No Payment History</h3>
                  <p className="muted">Your payment history will appear here once you make your first payment.</p>
                </div>
              ) : (
                <div className="card">
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: 'var(--space-3)', textAlign: 'left', fontWeight: 600, fontSize: 13 }}>Description</th>
                        <th style={{ padding: 'var(--space-3)', textAlign: 'left', fontWeight: 600, fontSize: 13 }}>Due Date</th>
                        <th style={{ padding: 'var(--space-3)', textAlign: 'left', fontWeight: 600, fontSize: 13 }}>Paid Date</th>
                        <th style={{ padding: 'var(--space-3)', textAlign: 'right', fontWeight: 600, fontSize: 13 }}>Amount</th>
                        <th style={{ padding: 'var(--space-3)', textAlign: 'center', fontWeight: 600, fontSize: 13 }}>Status</th>
                        <th style={{ padding: 'var(--space-3)', textAlign: 'center', fontWeight: 600, fontSize: 13 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentHistory.map((payment) => (
                        <tr key={payment.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: 'var(--space-3)', fontSize: 14 }}>{payment.description}</td>
                          <td style={{ padding: 'var(--space-3)', fontSize: 14 }} className="muted">
                            {formatDate(payment.dueDate)}
                          </td>
                          <td style={{ padding: 'var(--space-3)', fontSize: 14 }} className="muted">
                            {payment.paidDate ? formatDate(payment.paidDate) : '-'}
                          </td>
                          <td style={{ padding: 'var(--space-3)', fontSize: 14, textAlign: 'right', fontWeight: 600 }}>
                            {formatCurrency(payment.amount)}
                          </td>
                          <td style={{ padding: 'var(--space-3)', textAlign: 'center' }}>
                            {getStatusBadge(payment.status)}
                          </td>
                          <td style={{ padding: 'var(--space-3)', textAlign: 'center' }}>
                            <button className="btn btnSmall btnSecondary">
                              <Download className="icon16" />
                              Receipt
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'upload' && (
            <div>
              <h2 className="h2" style={{ marginBottom: 'var(--space-4)' }}>Upload Proof of Payment</h2>
              
              <div className="card" style={{ padding: 'var(--space-5)' }}>
                <div style={{
                  padding: 'var(--space-4)',
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: 'var(--radius-2)',
                  marginBottom: 'var(--space-5)',
                }}>
                  <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
                    <Info className="w-5 h-5" style={{ color: '#3b82f6', flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 'var(--space-1)' }}>Upload Guidelines</h3>
                      <ul className="muted" style={{ fontSize: 13, paddingLeft: 'var(--space-4)', margin: 0 }}>
                        <li>Accepted formats: PDF, JPG, PNG</li>
                        <li>Maximum file size: 5MB</li>
                        <li>Include payment reference number if available</li>
                        <li>School will review and confirm payment within 24-48 hours</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: 'var(--space-4)' }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-2)', fontSize: 14 }}>
                    Select Payment
                  </label>
                  <select
                    style={{
                      width: '100%',
                      padding: 'var(--space-3)',
                      borderRadius: 'var(--radius-2)',
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--text)',
                      fontSize: 14,
                    }}>
                    <option value="">Choose a payment...</option>
                    {upcomingPayments.map((payment) => (
                      <option key={payment.id} value={payment.id}>
                        {payment.description} - {formatCurrency(payment.amount)}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: 'var(--space-4)' }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-2)', fontSize: 14 }}>
                    Reference Number (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., TXN123456"
                    style={{
                      width: '100%',
                      padding: 'var(--space-3)',
                      borderRadius: 'var(--radius-2)',
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--text)',
                      fontSize: 14,
                    }}
                  />
                </div>

                <div style={{ marginBottom: 'var(--space-5)' }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-2)', fontSize: 14 }}>
                    Upload File
                  </label>
                  <div style={{
                    border: '2px dashed var(--border)',
                    borderRadius: 'var(--radius-2)',
                    padding: 'var(--space-6)',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: 'var(--surface)',
                  }}>
                    <Upload className="w-8 h-8" style={{ color: 'var(--primary)', margin: '0 auto var(--space-3)' }} />
                    <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 'var(--space-1)' }}>Click to upload or drag and drop</p>
                    <p className="muted" style={{ fontSize: 12 }}>PDF, JPG or PNG (max 5MB)</p>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      style={{ display: 'none' }}
                      id="file-upload"
                    />
                  </div>
                </div>

                <button className="btn btnPrimary" style={{ width: '100%' }}>
                  <Upload className="icon16" />
                  Submit Proof of Payment
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </ParentShell>
  );
}
