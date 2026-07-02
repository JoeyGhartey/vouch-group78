import * as SecureStore from 'expo-secure-store';

// TODO: Revert to Render URL before next deployment
// const API_URL = 'https://vouch-api-gateway.onrender.com/api';
const API_URL = 'http://172.20.10.2:8080/api';
// const API_URL = 'http://10.0.2.2:8080/api'; // Android emulator
// const API_URL = 'http://YOUR_IP:8080/api'; // Physical device
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
    response = await fetch(`${API_URL}${endpoint}`, { ...config, signal: controller.signal });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new Error('Request timed out — please try again');
    throw e;
  } finally {
    clearTimeout(timeout);
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Something went wrong');
  }

  return data as T;
};

// Auth
export const register = (data: unknown) => request('/auth/register', 'POST', data);
export const login = (data: unknown) => request('/auth/login', 'POST', data);
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
export const acceptInvite = (circleId: number) => request(`/circles/${circleId}/accept`, 'POST');

// Loans
export const requestLoan = (data: unknown) => request('/loans/request', 'POST', data);
export const fundLoan = (data: unknown) => request('/loans/fund', 'POST', data);
export const signAgreement = (loanId: number) => request(`/loans/${loanId}/sign`, 'POST');
export const disburseLoan = (loanId: number) => request(`/loans/${loanId}/disburse`, 'POST');
export const repayLoan = (loanId: number, amount?: number) => request(`/loans/${loanId}/repay`, 'POST', amount ? { amount } : null);
export const defaultLoan = (loanId: number) => request(`/loans/${loanId}/default`, 'POST');
export const cancelLoan = (loanId: number) => request(`/loans/${loanId}/cancel`, 'POST');
export const rejectAgreement = (loanId: number) => request(`/loans/${loanId}/reject`, 'POST');
export const proposeCounterOffer = (loanId: number, newRate: number) => request(`/loans/${loanId}/counter-offer`, 'POST', { newRate });
export const respondToCounterOffer = (loanId: number, accept: boolean) => request(`/loans/${loanId}/counter-offer/respond`, 'POST', { accept });
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

// Personal Expenses
export const addPersonalExpense = (data: unknown) => request('/expenses/personal', 'POST', data);
export const getPersonalTransactions = () => request('/expenses/personal');
export const getMonthlySummary = (year: number, month: number) => request(`/expenses/personal/summary/${year}/${month}`);
export const setSpendingLimit = (data: unknown) => request('/expenses/personal/limits', 'POST', data);
export const getSpendingLimits = () => request('/expenses/personal/limits');
export const deleteSpendingLimit = (limitId: number) => request(`/expenses/personal/limits/${limitId}`, 'DELETE');

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
export const getBorrowerInsights = () => request('/insights/borrower');
export const getLenderInsights = () => request('/insights/lender');
export const getCircleInsights = (circleId: number) => request(`/circles/${circleId}/insights`);

// Payments
export const initializeDisbursement = (loanId: number) => request(`/payments/disburse/${loanId}`, 'POST');
export const initializeRepayment = (loanId: number, amount?: number) => request(`/payments/repay/${loanId}`, 'POST', amount ? { amount } : null);
export const verifyPayment = (reference: string) => request(`/payments/verify/${reference}`);

// Admin
export const getAdminOpenDisputes = () => request('/disputes/admin/open');
export const resolveDispute = (disputeId: number, data: unknown) => request(`/disputes/${disputeId}/resolve`, 'POST', data);
