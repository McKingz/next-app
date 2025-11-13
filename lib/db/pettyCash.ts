/**
 * Typed data access layer for petty cash management
 * All functions are tenant-scoped and enforce RLS policies
 */

import { z } from 'zod';
import { assertSupabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';

// Temporary declaration to satisfy TypeScript in app context
declare function withTenantContext<T>(schoolId: string, fn: (context: any, queryBuilder?: any) => Promise<T>): Promise<T>;

// ============================================================================
// ZOD SCHEMAS FOR VALIDATION
// ============================================================================

// Petty cash transaction types
export const TransactionType = z.enum(['expense', 'replenishment', 'adjustment']);
export const TransactionStatus = z.enum(['pending', 'approved', 'rejected']);

// Transaction payload for creation
export const CreateTransactionSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  type: TransactionType,
  category: z.string().optional(),
  description: z.string().min(1, 'Description is required'),
  reference_number: z.string().optional(),
  occurred_at: z.date().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// Transaction update schema (for approvals/rejections)
export const UpdateTransactionSchema = z.object({
  status: TransactionStatus.optional(),
  approved_by: z.string().uuid().optional(),
  approved_at: z.date().optional(),
  rejection_reason: z.string().optional(),
});

// Receipt file metadata
export const ReceiptFileSchema = z.object({
  fileName: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().positive(),
  extension: z.string(),
});

// Query filters
export const TransactionFiltersSchema = z.object({
  status: TransactionStatus.optional(),
  type: TransactionType.optional(),
  category: z.string().optional(),
  from: z.date().optional(),
  to: z.date().optional(),
  search: z.string().optional(),
  limit: z.number().min(1).max(100).optional().default(20),
  cursor: z.string().optional(),
});

export const SummaryOptionsSchema = z.object({
  from: z.date().optional(),
  to: z.date().optional(),
  groupBy: z.enum(['day', 'week', 'month']).optional(),
});

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type CreateTransactionPayload = z.infer<typeof CreateTransactionSchema>;
export type UpdateTransactionPayload = z.infer<typeof UpdateTransactionSchema>;
export type ReceiptFileMeta = z.infer<typeof ReceiptFileSchema>;
export type TransactionFilters = z.infer<typeof TransactionFiltersSchema>;
export type SummaryOptions = z.infer<typeof SummaryOptionsSchema>;

export interface PettyCashAccount {
  id: string;
  school_id: string;
  opening_balance: number;
  currency: string;
  low_balance_threshold: number;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface PettyCashTransaction {
  id: string;
  school_id: string;
  account_id: string;
  amount: number;
  type: z.infer<typeof TransactionType>;
  category?: string;
  description: string;
  reference_number?: string;
  status: z.infer<typeof TransactionStatus>;
  created_by: string;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  occurred_at: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

export interface PettyCashReceipt {
  id: string;
  school_id: string;
  transaction_id: string;
  storage_path: string;
  file_name: string;
  original_name?: string;
  content_type?: string;
  size_bytes?: number;
  created_by: string;
  created_at: string;
  signed_url?: string; // Added when retrieving for display
}

export interface PettyCashSummary {
  total_expenses: number;
  total_replenishments: number;
  total_adjustments: number;
  transaction_count: number;
  pending_count: number;
  current_balance: number;
  is_low_balance: boolean;
  low_balance_threshold: number;
}

export interface PaginatedTransactions {
  transactions: PettyCashTransaction[];
  has_more: boolean;
  next_cursor?: string;
  total_count?: number;
}

// ============================================================================
// DATA ACCESS FUNCTIONS
// ============================================================================

/**
 * Get or create petty cash account for a school
 */
export async function getAccountForSchool(schoolId: string): Promise<PettyCashAccount | null> {
  try {
    // Try to get existing account
    const { data: existing, error } = await assertSupabase()
      .from('petty_cash_accounts')
      .select('*')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .single();

    if (existing) {
      track('petty_cash.account_retrieved', {
        school_id: schoolId,
        account_id: existing.id,
      });
      return existing;
    }

    // Create account if it doesn't exist and no record found
    if (error?.code === 'PGRST116') {
      const { data: created, error: createError } = await assertSupabase()
        .rpc('ensure_petty_cash_account', { preschool_uuid: schoolId });

      if (createError) {
        console.error('Error creating petty cash account:', createError);
        throw new Error('Failed to create petty cash account');
      }

      // Fetch the created account
      const { data: newAccount, error: fetchError } = await assertSupabase()
        .from('petty_cash_accounts')
        .select('*')
        .eq('id', created)
        .single();

      if (fetchError || !newAccount) {
        throw new Error('Failed to fetch created account');
      }

      track('petty_cash.account_created', {
        school_id: schoolId,
        account_id: newAccount.id,
      });

      return newAccount;
    }

    return null;
  } catch (error) {
    console.error('Error in getAccountForSchool:', error);
    return null;
  }
}

/**
 * Get current petty cash balance for a school
 */
export async function getBalance(schoolId: string): Promise<number> {
  try {
    // Prefer direct computation to avoid dependency on RPC/view availability
    const { data: account, error: accountError } = await assertSupabase()
      .from('petty_cash_accounts')
      .select('opening_balance')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .maybeSingle();

    if (accountError) {
      console.warn('Failed to fetch petty cash account:', accountError);
      return 0;
    }

    const openingBalance = Number(account?.opening_balance || 0);

    const { data: txns, error: txnsError } = await assertSupabase()
      .from('petty_cash_transactions')
      .select('amount, type, status')
      .eq('school_id', schoolId)
      .eq('status', 'approved')
      .limit(1000);

    if (txnsError) {
      console.warn('Failed to fetch transactions for balance calculation:', txnsError);
      return openingBalance; // Return at least the opening balance
    }

    const approved = txns || [];
    const totalSigned = approved.reduce((sum, t: any) => {
      const amt = Number(t.amount || 0);
      if (t.type === 'expense') return sum - amt;
      if (t.type === 'replenishment') return sum + amt;
      if (t.type === 'adjustment') return sum - amt; // Adjustments reduce balance
      return sum;
    }, 0);

    return openingBalance + totalSigned;
  } catch (error) {
    console.error('Error in getBalance:', error);
    return 0;
  }
}

/**
 * Get petty cash summary with statistics
 */
export async function getSummary(
  schoolId: string,
  options: SummaryOptions = {}
): Promise<PettyCashSummary> {
  try {
    const validatedOptions = SummaryOptionsSchema.parse(options);

    // Get summary from RPC - handle potential RPC function not existing
    let summaryData = null;
    let summaryError = null;
    
    try {
      const response = await assertSupabase()
        .rpc('get_petty_cash_summary', {
          school_uuid: schoolId,
          start_date: validatedOptions.from?.toISOString(),
          end_date: validatedOptions.to?.toISOString(),
        });
      summaryData = response.data;
      summaryError = response.error;
    } catch (rpcError) {
      console.warn('RPC function get_petty_cash_summary not available, using fallback:', rpcError);
      summaryError = rpcError;
    }

    // Fetch petty cash account info; compute balance directly if needed
    const { data: accountData, error: accountError } = await assertSupabase()
      .from('petty_cash_accounts')
      .select('opening_balance, low_balance_threshold')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .maybeSingle();

    if (accountError) {
      console.warn('Failed to fetch petty cash account for summary:', accountError);
    }
    const openingBalance = Number(accountData?.opening_balance || 0);
    const lowThreshold = Number(accountData?.low_balance_threshold || 1000);

    // Fallback path if RPC is missing (PGRST202) or returned no data
    if (summaryError || !summaryData) {
      console.debug('Using petty cash summary fallback due to:', summaryError?.message || 'No RPC data');
      
      // Attempt to compute summary via direct queries (limited scope)
      try {
        let txQuery = assertSupabase()
          .from('petty_cash_transactions')
          .select('amount, type, status, created_at')
          .eq('school_id', schoolId);

        if (validatedOptions.from) {
          txQuery = txQuery.gte('created_at', validatedOptions.from.toISOString());
        }
        if (validatedOptions.to) {
          txQuery = txQuery.lt('created_at', validatedOptions.to.toISOString());
        }

        const { data: txns, error: txErr } = await txQuery.limit(1000);
        if (txErr) {
          console.warn('Error fetching transactions for summary fallback:', txErr);
          
          // If it's an RLS policy error or table doesn't exist, return minimal data
          if (txErr.code === 'PGRST301' || txErr.code === 'PGRST116' || txErr.message?.includes('relation') || txErr.message?.includes('policy')) {
            console.debug('Petty cash tables/policies not accessible, returning default summary');
            return {
              total_expenses: 0,
              total_replenishments: 0, 
              total_adjustments: 0,
              transaction_count: 0,
              pending_count: 0,
              current_balance: openingBalance,
              is_low_balance: false,
              low_balance_threshold: lowThreshold,
            } as PettyCashSummary;
          }
        }

        const list = txns || [];
        const approved = list.filter(t => t.status === 'approved');
        const total_expenses = approved
          .filter(t => t.type === 'expense')
          .reduce((s, t) => s + Number(t.amount || 0), 0);
        const total_replenishments = approved
          .filter(t => t.type === 'replenishment')
          .reduce((s, t) => s + Number(t.amount || 0), 0);
        const total_adjustments = approved
          .filter(t => t.type === 'adjustment')
          .reduce((s, t) => s + Number(t.amount || 0), 0);
        const transaction_count = approved.length;
        const pending_count = list.filter(t => t.status === 'pending').length;

        // Compute overall signed total for balance across ALL time
        const { data: allApproved, error: allApprovedError } = await assertSupabase()
          .from('petty_cash_transactions')
          .select('amount, type, status')
          .eq('school_id', schoolId)
          .eq('status', 'approved')
          .limit(1000);

        if (allApprovedError) {
          console.warn('Failed to fetch all approved transactions:', allApprovedError);
        }
        const totalSignedAll = (allApproved || []).reduce((sum, t: any) => {
          const amt = Number(t.amount || 0);
          if (t.type === 'expense') return sum - amt;
          if (t.type === 'replenishment') return sum + amt;
          if (t.type === 'adjustment') return sum - amt; // Adjustments reduce balance
          return sum;
        }, 0);
        const current_balance = openingBalance + totalSignedAll;

        return {
          total_expenses,
          total_replenishments,
          total_adjustments,
          transaction_count,
          pending_count,
          current_balance,
          is_low_balance: current_balance < lowThreshold,
          low_balance_threshold: lowThreshold,
        } as PettyCashSummary;
      } catch (fbErr) {
        console.error('Summary fallback failed:', fbErr);
        // As a last-resort fallback, compute balance from opening balance only (no estimates)
        return {
          total_expenses: 0,
          total_replenishments: 0,
          total_adjustments: 0,
          transaction_count: 0,
          pending_count: 0,
          current_balance: openingBalance,
          is_low_balance: openingBalance < lowThreshold,
          low_balance_threshold: lowThreshold,
        } as PettyCashSummary;
      }
    }

    // Normal path via RPC
    const summary = (Array.isArray(summaryData) ? summaryData[0] : summaryData) || {
      total_expenses: 0,
      total_replenishments: 0,
      total_adjustments: 0,
      transaction_count: 0,
      pending_count: 0,
    };

    // Compute overall signed total for balance across ALL time
    const { data: allApproved } = await assertSupabase()
      .from('petty_cash_transactions')
      .select('amount, type, status')
      .eq('school_id', schoolId)
      .eq('status', 'approved')
      .limit(1000);
    const totalSignedAll = (allApproved || []).reduce((sum, t: any) => {
      const amt = Number(t.amount || 0);
      if (t.type === 'expense') return sum - amt;
      if (t.type === 'replenishment' || t.type === 'adjustment') return sum + amt;
      return sum;
    }, 0);
    const current_balance = openingBalance + totalSignedAll;

    return {
      ...summary,
      current_balance,
      is_low_balance: current_balance < lowThreshold,
      low_balance_threshold: lowThreshold,
    };
  } catch (error) {
    console.error('Error in getSummary:', error);
    return {
      total_expenses: 0,
      total_replenishments: 0,
      total_adjustments: 0,
      transaction_count: 0,
      pending_count: 0,
      current_balance: 0,
      is_low_balance: false,
      low_balance_threshold: 1000,
    };
  }
}

/**
 * List petty cash transactions with filtering and pagination
 */
export async function listTransactions(
  schoolId: string,
  filters: Partial<TransactionFilters> = {}
): Promise<PaginatedTransactions> {
  try {
    const validatedFilters = TransactionFiltersSchema.parse({ limit: 20, ...filters });

    let query = assertSupabase()
      .from('petty_cash_transactions')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (validatedFilters.status) {
      query = query.eq('status', validatedFilters.status);
    }
    if (validatedFilters.type) {
      query = query.eq('type', validatedFilters.type);
    }
    if (validatedFilters.category) {
      query = query.eq('category', validatedFilters.category);
    }
    if (validatedFilters.from) {
      query = query.gte('created_at', validatedFilters.from.toISOString());
    }
    if (validatedFilters.to) {
      query = query.lte('created_at', validatedFilters.to.toISOString());
    }
    if (validatedFilters.search) {
      query = query.or(`description.ilike.%${validatedFilters.search}%,reference_number.ilike.%${validatedFilters.search}%`);
    }

    // Handle cursor-based pagination
    if (validatedFilters.cursor) {
      query = query.lt('created_at', validatedFilters.cursor);
    }

    // Limit with one extra to check for more results
    query = query.limit(validatedFilters.limit + 1);

    const { data, error } = await query;

    if (error) {
      console.error('Error listing transactions:', error);
      return {
        transactions: [],
        has_more: false,
        total_count: 0,
      };
    }

    const transactions = data || [];
    const hasMore = transactions.length > validatedFilters.limit;

    // Remove extra item if exists
    if (hasMore) {
      transactions.pop();
    }

    const nextCursor = hasMore && transactions.length > 0 
      ? transactions[transactions.length - 1].occurred_at 
      : undefined;

    track('petty_cash.transactions_listed', {
      school_id: schoolId,
      count: transactions.length,
      filters: validatedFilters,
    });

    return {
      transactions,
      has_more: hasMore,
      next_cursor: nextCursor,
      total_count: transactions.length,
    };
  } catch (error) {
    console.error('Error in listTransactions:', error);
    return {
      transactions: [],
      has_more: false,
      total_count: 0,
    };
  }
}

/**
 * Create a new petty cash transaction
 */
export async function createTransaction(
  schoolId: string,
  payload: CreateTransactionPayload
): Promise<PettyCashTransaction> {
  try {
    const validatedPayload = CreateTransactionSchema.parse(payload);

    // Get account for school
    const account = await getAccountForSchool(schoolId);
    if (!account) {
      throw new Error('No petty cash account found for school');
    }

    // Get current user
    const { data: { user } } = await assertSupabase().auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const transactionData = {
      school_id: schoolId,
      account_id: account.id,
      amount: validatedPayload.amount,
      type: validatedPayload.type,
      category: validatedPayload.category,
      description: validatedPayload.description,
      reference_number: validatedPayload.reference_number,
      status: 'pending' as const,
      created_by: user.id,
      occurred_at: validatedPayload.occurred_at?.toISOString() || new Date().toISOString(),
      metadata: validatedPayload.metadata || {},
    };

    const { data, error } = await assertSupabase()
      .from('petty_cash_transactions')
      .insert(transactionData)
      .select('*')
      .single();

    if (error) {
      console.error('Error creating transaction:', error);
      throw new Error('Failed to create transaction');
    }

    track('petty_cash.transaction_created', {
      school_id: schoolId,
      transaction_id: data.id,
      type: data.type,
      amount: data.amount,
      status: data.status,
    });

    return data;
  } catch (error) {
    console.error('Error in createTransaction:', error);
    throw error;
  }
}

/**
 * Approve a pending transaction
 */
export async function approveTransaction(schoolId: string, transactionId: string): Promise<PettyCashTransaction> {
  return withTenantContext(schoolId, async (context) => {
    // Check if user has permission to approve
    if (!['principal_admin', 'finance_admin', 'super_admin'].includes(context.role)) {
      throw new Error('Insufficient permissions to approve transactions');
    }

    const updateData = {
      status: 'approved' as const,
      approved_by: context.userId,
      approved_at: new Date().toISOString(),
    };

    const { data, error } = await assertSupabase()
      .from('petty_cash_transactions')
      .update(updateData)
      .eq('id', transactionId)
      .eq('school_id', schoolId)
      .eq('status', 'pending')
      .select('*')
      .single();

    if (error) {
      console.error('Error approving transaction:', error);
      throw new Error('Failed to approve transaction');
    }

    track('petty_cash.transaction_approved', {
      school_id: schoolId,
      user_id: context.userId,
      transaction_id: transactionId,
      approver_id: context.userId,
    });

    return data;
  });
}

/**
 * Reject a pending transaction
 */
export async function rejectTransaction(
  schoolId: string, 
  transactionId: string, 
  reason?: string
): Promise<PettyCashTransaction> {
  return withTenantContext(schoolId, async (context) => {
    // Check if user has permission to reject
    if (!['principal_admin', 'finance_admin', 'super_admin'].includes(context.role)) {
      throw new Error('Insufficient permissions to reject transactions');
    }

    const updateData = {
      status: 'rejected' as const,
      rejection_reason: reason || 'Transaction rejected',
      approved_by: context.userId, // Track who rejected it
      approved_at: new Date().toISOString(),
    };

    const { data, error } = await assertSupabase()
      .from('petty_cash_transactions')
      .update(updateData)
      .eq('id', transactionId)
      .eq('school_id', schoolId)
      .eq('status', 'pending')
      .select('*')
      .single();

    if (error) {
      console.error('Error rejecting transaction:', error);
      throw new Error('Failed to reject transaction');
    }

    track('petty_cash.transaction_rejected', {
      school_id: schoolId,
      user_id: context.userId,
      transaction_id: transactionId,
      reason,
    });

    return data;
  });
}

/**
 * Create signed upload URL for receipt
 */
export async function createReceiptUpload(
  schoolId: string,
  transactionId: string,
  fileMeta: ReceiptFileMeta
): Promise<{ uploadUrl: string; storagePath: string }> {
  const validatedFileMeta = ReceiptFileSchema.parse(fileMeta);

  return withTenantContext(schoolId, async (context) => {
    // Generate upload path
    const { data: uploadPath, error: pathError } = await assertSupabase()
      .rpc('generate_receipt_upload_path', {
        school_uuid: schoolId,
        transaction_id: transactionId,
        file_extension: validatedFileMeta.extension,
      });

    if (pathError || !uploadPath) {
      console.error('Error generating upload path:', pathError);
      throw new Error('Failed to generate upload path');
    }

    // Create signed upload URL
    const { data: signedUrlData, error: urlError } = await assertSupabase()
      .storage
      .from('petty-cash-receipts')
      .createSignedUploadUrl(uploadPath, {
        upsert: false,
      });

    if (urlError || !signedUrlData) {
      console.error('Error creating signed upload URL:', urlError);
      throw new Error('Failed to create upload URL');
    }

    track('petty_cash.receipt_upload_initiated', {
      school_id: schoolId,
      user_id: context.userId,
      transaction_id: transactionId,
      file_size: validatedFileMeta.sizeBytes,
    });

    return {
      uploadUrl: signedUrlData.signedUrl,
      storagePath: uploadPath,
    };
  });
}

/**
 * Attach receipt record to transaction after successful upload
 */
export async function attachReceiptRecord(
  schoolId: string,
  transactionId: string,
  storagePath: string,
  fileMeta: ReceiptFileMeta
): Promise<PettyCashReceipt> {
  const validatedFileMeta = ReceiptFileSchema.parse(fileMeta);

  return withTenantContext(schoolId, async (context) => {
    const receiptData = {
      school_id: schoolId,
      transaction_id: transactionId,
      storage_path: storagePath,
      file_name: validatedFileMeta.fileName,
      original_name: validatedFileMeta.fileName,
      content_type: validatedFileMeta.contentType,
      size_bytes: validatedFileMeta.sizeBytes,
      created_by: context.userId,
    };

    const { data, error } = await assertSupabase()
      .from('petty_cash_receipts')
      .insert(receiptData)
      .select('*')
      .single();

    if (error) {
      console.error('Error attaching receipt record:', error);
      throw new Error('Failed to attach receipt record');
    }

    track('petty_cash.receipt_uploaded', {
      school_id: schoolId,
      user_id: context.userId,
      transaction_id: transactionId,
      receipt_id: data.id,
      file_size: validatedFileMeta.sizeBytes,
    });

    return data;
  });
}

/**
 * Get receipts for a transaction with signed URLs
 */
export async function getReceipts(schoolId: string, transactionId: string): Promise<PettyCashReceipt[]> {
  return withTenantContext(schoolId, async (context, queryBuilder) => {
    const { data: receipts, error } = await queryBuilder
      .pettyCashReceipts()
      .select('*')
      .eq('transaction_id', transactionId);

    if (error) {
      console.error('Error fetching receipts:', error);
      throw new Error('Failed to fetch receipts');
    }

    // Generate signed URLs for each receipt
    const receiptsWithUrls = await Promise.all(
      (receipts || []).map(async (receipt: any) => {
        try {
          const { data: signedUrlData } = await assertSupabase()
            .storage
            .from('petty-cash-receipts')
            .createSignedUrl(receipt.storage_path, 3600); // 1 hour expiry

          return {
            ...receipt,
            signed_url: signedUrlData?.signedUrl,
          };
        } catch (error) {
          console.error('Error creating signed URL for receipt:', error);
          return receipt; // Return without signed URL
        }
      })
    );

    return receiptsWithUrls;
  });
}

/**
 * Delete a receipt
 */
export async function deleteReceipt(schoolId: string, receiptId: string): Promise<boolean> {
  return withTenantContext(schoolId, async (context) => {
    // Get receipt details first
    const { data: receipt, error: fetchError } = await assertSupabase()
      .from('petty_cash_receipts')
      .select('storage_path, transaction_id')
      .eq('id', receiptId)
      .eq('school_id', schoolId)
      .single();

    if (fetchError || !receipt) {
      console.error('Error fetching receipt for deletion:', fetchError);
      throw new Error('Receipt not found');
    }

    // Delete from storage first
    const { error: storageError } = await assertSupabase()
      .storage
      .from('petty-cash-receipts')
      .remove([receipt.storage_path]);

    if (storageError) {
      console.error('Error deleting from storage:', storageError);
      // Continue with database deletion anyway
    }

    // Delete database record
    const { error: dbError } = await assertSupabase()
      .from('petty_cash_receipts')
      .delete()
      .eq('id', receiptId)
      .eq('school_id', schoolId);

    if (dbError) {
      console.error('Error deleting receipt record:', dbError);
      throw new Error('Failed to delete receipt record');
    }

    track('petty_cash.receipt_deleted', {
      school_id: schoolId,
      user_id: context.userId,
      receipt_id: receiptId,
      transaction_id: receipt.transaction_id,
    });

    return true;
  });
}