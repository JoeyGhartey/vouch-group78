import * as SecureStore from 'expo-secure-store';

//const API_URL = 'http://10.0.2.2:8080/api'; // Android emulator
const API_URL = 'http://localhost:8080/api'; // Web
// const API_URL = 'http://YOUR_IP:8080/api'; // Physical device

let token = null;

export const setToken = (newToken) => {
  token = newToken;
};

export const getToken = () => token;

export const saveToken = async (newToken) => {
  token = newToken;
  try {
    await SecureStore.setItemAsync('token', newToken);
  } catch (e) {
    // Web fallback
    localStorage.setItem('token', newToken);
  }
};

export const loadToken = async () => {
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

export const clearToken = async () => {
  token = null;
  try {
    await SecureStore.deleteItemAsync('token');
  } catch (e) {
    localStorage.removeItem('token');
  }
};

const request = async (endpoint, method = 'GET', body = null) => {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    method,
    headers,
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${endpoint}`, config);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Something went wrong');
  }

  return data;
};

// Auth
export const register = (data) => request('/auth/register', 'POST', data);
export const login = (data) => request('/auth/login', 'POST', data);

// Profile
export const getProfile = () => request('/profile');
export const updateProfile = (data) => request('/profile', 'PUT', data);
export const getUserProfile = (userId) => request(`/profile/${userId}`);

// Circles
export const getMyCircles = () => request('/circles');
export const getCircle = (circleId) => request(`/circles/${circleId}`);
export const createCircle = (data) => request('/circles', 'POST', data);
export const updateCircle = (circleId, data) => request(`/circles/${circleId}`, 'PUT', data);
export const inviteMember = (circleId, phone) => request(`/circles/${circleId}/invite`, 'POST', { phone });
export const approveMember = (circleId, memberId) => request(`/circles/${circleId}/approve/${memberId}`, 'POST');
export const removeMember = (circleId, userId) => request(`/circles/${circleId}/remove/${userId}`, 'POST');
export const leaveCircle = (circleId) => request(`/circles/${circleId}/leave`, 'POST');

// Loans
export const requestLoan = (data) => request('/loans/request', 'POST', data);
export const fundLoan = (data) => request('/loans/fund', 'POST', data);
export const signAgreement = (loanId) => request(`/loans/${loanId}/sign`, 'POST');
export const disburseLoan = (loanId) => request(`/loans/${loanId}/disburse`, 'POST');
export const repayLoan = (loanId, amount) => request(`/loans/${loanId}/repay`, 'POST', amount ? { amount } : null);
export const defaultLoan = (loanId) => request(`/loans/${loanId}/default`, 'POST');
export const cancelLoan = (loanId) => request(`/loans/${loanId}/cancel`, 'POST');
export const getCircleLoans = (circleId) => request(`/loans/circle/${circleId}`);
export const getCircleLoanRequests = (circleId) => request(`/loans/circle/${circleId}/requests`);
export const getMyBorrowedLoans = () => request('/loans/borrowed');
export const getMyLentLoans = () => request('/loans/lent');
export const getLoan = (loanId) => request(`/loans/${loanId}`);

// Shared Expenses
export const createSharedExpense = (data) => request('/expenses/shared', 'POST', data);
export const getCircleExpenses = (circleId) => request(`/expenses/shared/circle/${circleId}`);
export const getCircleBalances = (circleId) => request(`/expenses/shared/circle/${circleId}/balances`);
export const settleExpense = (splitId) => request(`/expenses/shared/settle/${splitId}`, 'POST');

// Personal Expenses
export const addPersonalExpense = (data) => request('/expenses/personal', 'POST', data);
export const getPersonalTransactions = () => request('/expenses/personal');
export const getMonthlySummary = (year, month) => request(`/expenses/personal/summary/${year}/${month}`);
export const setSpendingLimit = (data) => request('/expenses/personal/limits', 'POST', data);
export const getSpendingLimits = () => request('/expenses/personal/limits');
export const deleteSpendingLimit = (limitId) => request(`/expenses/personal/limits/${limitId}`, 'DELETE');

// Notifications
export const getNotifications = () => request('/notifications');
export const getUnreadNotifications = () => request('/notifications/unread');
export const getUnreadCount = () => request('/notifications/count');
export const markNotificationRead = (notificationId) => request(`/notifications/${notificationId}/read`, 'POST');
export const markAllNotificationsRead = () => request('/notifications/read-all', 'POST');

// Disputes
export const openDispute = (data) => request('/disputes', 'POST', data);
export const getMyDisputes = () => request('/disputes');
export const getDispute = (disputeId) => request(`/disputes/${disputeId}`);

// Insights
export const getBorrowerInsights = () => request('/insights/borrower');
export const getLenderInsights = () => request('/insights/lender');
export const getCircleInsights = (circleId) => request(`/insights/circle/${circleId}`);
