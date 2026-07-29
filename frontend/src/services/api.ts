import * as SecureStore from 'expo-secure-store';

// No api-gateway deployed — each service is called directly on its own host.
// This mirrors the routing rules that would otherwise live in api-gateway/application.yml.
const SERVICE_URLS: Record<string, string> = {
  auth: 'https://auth-service-production-5e70.up.railway.app/api',
  profile: 'https://auth-service-production-5e70.up.railway.app/api',
  notifications: 'https://notification-service-production-a457.up.railway.app/api',
  circles: 'https://loan-service-production-1765.up.railway.app/api',
  loans: 'https://loan-service-production-1765.up.railway.app/api',
  payments: 'https://payment-service-production-ac0d.up.railway.app/api',
  disputes: 'https://dispute-service-production-0116.up.railway.app/api',
  expenses: 'https://expense-service-u749.onrender.com/api',
};

const resolveBaseUrl = (endpoint: string): string => {
  const segment = endpoint.split('/').filter(Boolean)[0] ?? '';
  const base = SERVICE_URLS[segment];
  if (!base) {
    throw new Error(`No service URL configured for endpoint segment "${segment}" (from "${endpoint}")`);
  }
  return base;
};

let token: string | null = null;

export const setToken = (newToken: string): void => {
  token = newToken;
};

export const getToken = (): string | null => token;

export const saveToken = async (newToken: string): Promise<void> => {
  token = newToken;
  try {
    await SecureStore.setItemAsync('token', newToken);
  } catch (e) {
    localStorage.setItem('token', newToken);
  }
};

export const loadToken = async (): Promise<string | null> => {
  try {
    const stored = await SecureStore.getItemAsync('token');
    if (stored) token = stored;
    return stored;
  } catch (e) {
    const stored = localStorage.getItem('token');
    if (stored) token = stored;
    return stored;
  }
};

export const clearToken = async (): Promise<void> => {
  token = null;
  try {
    await SecureStore.deleteItemAsync('token');
  } catch (e) {
    localStorage.removeItem('token');
  }
};

interface RequestConfig {
  method: string;
  headers: Record<string, string>;
  body?: string;
}

const request = async <T = unknown>(
  endpoint: string,
  method: string = 'GET',
  body: unknown = null
): Promise<T> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestConfig = { method, headers };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  let response: Response;
  try {
    response = await fetch(`${resolveBaseUrl(endpoint)}${endpoint}`, { ...config, signal: controller.signal });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new Error('Request timed out — please try again');
    throw e;
  } finally {
    clearTimeout(timeout);
  }

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    if (isJson) {
      try {
        const errorData = await response.json();
        if (errorData && errorData.message) message = errorData.message;
      } catch {
        // body claimed to be JSON but wasn't parseable — keep the generic status message
      }
    }
    throw new Error(message);
  }

  if (!isJson) {
    throw new Error(`Unexpected response format (${response.status})`);
  }

  const data = await response.json();
  return data as T;
};

// Auth
export const initiateRegistration = (data: unknown) => request('/auth/register/initiate', 'POST', data);
export const verifyRegistration = (phone: string, otp: string) => request('/auth/register/verify', 'POST', { phone, otp });
export const resendRegistrationOtp = (phone: string) => request('/auth/register/resend', 'POST', { phone });
export const login = (data: unknown) => request('/auth/login', 'POST', data);
export const forgotPassword = (identifier: string) => request('/auth/forgot-password', 'POST', { identifier });
export const resetPassword = (identifier: string, otp: string, newPassword: string) => request('/auth/reset-password', 'POST', { identifier, otp, newPassword });
export const registerPushToken = (token: string) => request('/auth/push-token', 'POST', { token });

// Profile
export const getProfile = () => request('/profile');
export const getBadges = () => request('/profile/badges');
export const updateProfile = (data: unknown) => request('/profile', 'PUT', data);
export const getUserProfile = (userId: number) => request(`/profile/${userId}`);

// Circles
export const getMyCircles = () => request('/circles');
export const getPendingInvites = () => request('/circles/pending');
export const getCircle = (circleId: number) => request(`/circles/${circleId}`);
export const createCircle = (data: unknown) => request('/circles', 'POST', data);
export const updateCircle = (circleId: number, data: unknown) => request(`/circles/${circleId}`, 'PUT', data);
export const inviteMember = (circleId: number, phone: string) => request(`/circles/${circleId}/invite`, 'POST', { phone });
export const approveMember = (circleId: number, memberId: number) => request(`/circles/${circleId}/approve/${memberId}`, 'POST');
export const removeMember = (circleId: number, userId: number) => request(`/circles/${circleId}/remove/${userId}`, 'POST');
export const leaveCircle = (circleId: number) => request(`/circles/${circleId}/leave`, 'POST');
export const transferCircleOwnership = (circleId: number, userId: number) => request(`/circles/${circleId}/transfer-ownership/${userId}`, 'POST');
export const deleteCircle = (circleId: number) => request(`/circles/${circleId}`, 'DELETE');
export const acceptInvite = (circleId: number) => request(`/circles/${circleId}/accept`, 'POST');
export const rejectInvite = (circleId: number) => request(`/circles/${circleId}/reject`, 'POST');

// Loans
export const requestLoan = (data: unknown) => request('/loans/request', 'POST', data);
export const fundLoan = (data: unknown) => request('/loans/fund', 'POST', data);
export const contributeToLoan = (data: unknown) => request('/loans/group/contribute', 'POST', data);
export const getLoanContributions = (loanId: number) => request(`/loans/group/${loanId}/contributions`);
export const signAgreement = (loanId: number) => request(`/loans/${loanId}/sign`, 'POST');
export const signGroupAgreement = (loanId: number) => request(`/loans/group/${loanId}/sign`, 'POST');
export const disburseLoan = (loanId: number) => request(`/loans/${loanId}/disburse`, 'POST');
export const disburseGroupLoan = (loanId: number) => request(`/loans/group/${loanId}/disburse`, 'POST');
export const repayLoan = (loanId: number, amount?: number) => request(`/loans/${loanId}/repay`, 'POST', amount ? { amount } : null);
export const defaultLoan = (loanId: number) => request(`/loans/${loanId}/default`, 'POST');
export const cancelLoan = (loanId: number) => request(`/loans/${loanId}/cancel`, 'POST');
export const rejectAgreement = (loanId: number) => request(`/loans/${loanId}/reject`, 'POST');
export const proposeCounterOffer = (loanId: number, newRate: number) => request(`/loans/${loanId}/counter-offer`, 'POST', { newRate });
export const respondToCounterOffer = (loanId: number, accept: boolean) => request(`/loans/${loanId}/counter-offer/respond`, 'POST', { accept });
export const hideLoan = (loanId: number) => request(`/loans/${loanId}/hide`, 'POST');
export const getCircleLoans = (circleId: number) => request(`/loans/circle/${circleId}`);
export const getCircleLoanRequests = (circleId: number) => request(`/loans/circle/${circleId}/requests`);
export const getMyBorrowedLoans = () => request('/loans/borrowed');
export const getMyLentLoans = () => request('/loans/lent');
export const getLoan = (loanId: number) => request(`/loans/${loanId}`);

// Shared Expenses
export const createSharedExpense = (data: unknown) => request('/expenses/shared', 'POST', data);
export const getCircleExpenses = (circleId: number) => request(`/expenses/shared/circle/${circleId}`);
export const getCircleBalances = (circleId: number) => request(`/expenses/shared/circle/${circleId}/balances`);
export const settleExpense = (splitId: number) => request(`/expenses/shared/settle/${splitId}`, 'POST');
export const deleteSharedExpense = (expenseId: number) => request(`/expenses/shared/${expenseId}`, 'DELETE');
export const requestPayment = (splitId: number) => request(`/expenses/shared/splits/${splitId}/request-payment`, 'POST');
export const confirmPayment = (splitId: number) => request(`/expenses/shared/splits/${splitId}/confirm-payment`, 'POST');

// Personal Expenses
export const addPersonalExpense = (data: unknown) => request('/expenses/personal', 'POST', data);
export const getPersonalTransactions = () => request('/expenses/personal');
export const deletePersonalTransaction = (transactionId: number) => request(`/expenses/personal/${transactionId}`, 'DELETE');
export const getMonthlySummary = (year: number, month: number) => request(`/expenses/personal/summary/${year}/${month}`);
export const setSpendingLimit = (data: unknown) => request('/expenses/personal/limits', 'POST', data);
export const getSpendingLimits = () => request('/expenses/personal/limits');
export const deleteSpendingLimit = (limitId: number) => request(`/expenses/personal/limits/${limitId}`, 'DELETE');
export const resetSpendingLimit = (limitId: number) => request(`/expenses/personal/limits/${limitId}/reset`, 'POST');
export const setMonthlyIncome = (amount: number) => request('/expenses/personal/income', 'POST', { amount });
export const getMonthlyIncome = () => request('/expenses/personal/income');

// Notifications
export const getNotifications = () => request('/notifications');
export const getUnreadNotifications = () => request('/notifications/unread');
export const getUnreadCount = () => request('/notifications/count');
export const markNotificationRead = (notificationId: number) => request(`/notifications/${notificationId}/read`, 'POST');
export const markAllNotificationsRead = () => request('/notifications/read-all', 'POST');
export const deleteNotification = (id: number) => request(`/notifications/${id}`, 'DELETE');
export const clearReadNotifications = () => request('/notifications/read', 'DELETE');

// Disputes
export const openDispute = (data: unknown) => request('/disputes', 'POST', data);
export const getMyDisputes = () => request('/disputes');
export const getDispute = (disputeId: number) => request(`/disputes/${disputeId}`);

// Insights
export const getBorrowerInsights = () => request('/loans/insights/borrower');
export const getLenderInsights = () => request('/loans/insights/lender');
export const getCircleInsights = (circleId: number) => request(`/circles/${circleId}/insights`);

// Payments
export const initializeDisbursement = (loanId: number) => request(`/payments/disburse/${loanId}`, 'POST');
export const initializeRepayment = (loanId: number, amount?: number) => request(`/payments/repay/${loanId}`, 'POST', amount ? { amount } : null);
export const initializeGroupContribution = (loanId: number, amount: number) => request(`/payments/group-contribute/${loanId}`, 'POST', { amount });
export const verifyPayment = (reference: string) => request(`/payments/verify/${reference}`);

// Admin
export const getAdminOpenDisputes = () => request('/disputes/admin/open');
export const getCircleDisputes = (circleId: number) => request(`/disputes/circle/${circleId}`);
export const getDisputeByLoan = (loanId: number) => request(`/disputes/by-loan/${loanId}`);
export const escalateDispute = (disputeId: number) => request(`/disputes/${disputeId}/escalate`, 'POST');
export const resolveDispute = (disputeId: number, data: unknown) => request(`/disputes/${disputeId}/resolve`, 'POST', data);
