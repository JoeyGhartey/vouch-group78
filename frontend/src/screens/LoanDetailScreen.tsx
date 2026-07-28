import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Modal, TouchableWithoutFeedback, Pressable,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import {
  getLoan, fundLoan, signAgreement, disburseLoan, repayLoan,
  cancelLoan, defaultLoan, openDispute, getProfile,
  initializeDisbursement, initializeRepayment, verifyPayment,
  rejectAgreement, proposeCounterOffer, respondToCounterOffer,
  getDisputeByLoan, escalateDispute,
  contributeToLoan, getLoanContributions,
  signGroupAgreement, initializeGroupContribution,
} from '../services/api';
import { useAppAlert } from '../components/AppAlert';
import { useConfirmModal } from '../components/ConfirmModal';
import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import { ColorScheme } from '../theme/colors';
import { formatMoney } from '../utils/formatMoney';
import { fonts } from '../theme/fonts';

type Props = {
  route: RouteProp<RootStackParamList, 'LoanDetail'>;
  navigation: NativeStackNavigationProp<RootStackParamList, 'LoanDetail'>;
};

interface Loan {
  id: number;
  amount: number;
  status: string;
  reason: string;
  borrowerName: string;
  borrowerId: number;
  lenderName?: string;
  lenderId?: number;
  circleName: string;
  interestRate: number;
  counterOfferRate?: number | null;
  totalRepaymentAmount: number;
  amountRepaid: number;
  overdueInterestAccrued: number;
  repaymentType: string;
  repaymentPeriodMonths: number;
  dueDate?: string;
  createdAt: string;
  disbursedAt?: string;
  platformFee?: number;
  borrowerReceivedAmount?: number;
  gracePeriodEnd?: string;
  borrowerSigned?: boolean;
  lenderSigned?: boolean;
  borrowerMaxInterestRate: number;
  borrowerTrustTier: string;
  isGroupFunded?: boolean;
}

interface Contribution {
  id: number;
  lenderName: string;
  lenderId: number;
  amount: number;
  interestRate: number;
  amountRepaid: number;
  signed: boolean;
  paid: boolean;
}

interface ContributionsSummary {
  totalContributed: number;
  remaining: number;
  percentFunded: number;
  contributorCount: number;
  contributions: Contribution[];
}

interface Profile {
  id: number;
}

interface Dispute {
  id: number;
  status: string;
  reason: string;
  evidence?: string;
  openedByName: string;
  resolution?: string;
  escalated?: boolean;
}

interface PaymentInitResponse {
  authorizationUrl: string;
  reference: string;
  message: string;
  callbackUrl?: string;
}

const createStyles = (c: ColorScheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, paddingTop: 56, backgroundColor: c.surface,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  back: { color: c.accent, fontSize: 16, fontWeight: '600', fontFamily: fonts.semibold },
  title: { color: c.dark, fontSize: 18, fontWeight: '700', fontFamily: fonts.bold },
  amountCard: {
    backgroundColor: c.heroCardBg, marginHorizontal: 16, borderRadius: 20,
    padding: 28, alignItems: 'center', marginTop: 16, marginBottom: 16,
    overflow: 'hidden',
  },
  loanIdTag: { color: c.accent, fontSize: 11, fontWeight: '700', fontFamily: fonts.bold, letterSpacing: 1.2, marginBottom: 10 },
  amountLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontFamily: fonts.regular },
  amount: { color: '#fff', fontSize: 42, fontWeight: '800', fontFamily: fonts.extrabold, marginTop: 4, letterSpacing: -1 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 16,
  },
  badgeText: { color: c.surface, fontSize: 12, fontWeight: '700', fontFamily: fonts.bold, letterSpacing: 0.4 },

  // Parties card — borrower/lender shown as avatars either side of an arrow
  partiesCard: {
    backgroundColor: c.surface, marginHorizontal: 16, borderRadius: 14,
    padding: 18, marginBottom: 12, borderWidth: 1, borderColor: c.border,
    flexDirection: 'row', alignItems: 'center',
  },
  partyBox: { flex: 1, alignItems: 'center' },
  avatarCircle: {
    width: 48, height: 48, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  avatarText: { color: c.surface, fontSize: 18, fontWeight: '700', fontFamily: fonts.bold },
  partyName: { color: c.dark, fontSize: 13, fontWeight: '700', fontFamily: fonts.bold, textAlign: 'center' },
  partyRole: { color: c.muted, fontSize: 11, fontFamily: fonts.regular, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  partyArrowBox: { width: 36, alignItems: 'center', justifyContent: 'center' },

  card: {
    backgroundColor: c.surface, marginHorizontal: 16, borderRadius: 14,
    padding: 16, marginBottom: 12, borderWidth: 1, borderColor: c.border,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  cardTitle: { color: c.dark, fontSize: 15, fontWeight: '700', fontFamily: fonts.bold },
  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border,
  },
  rowLabel: { color: c.muted, fontSize: 13, fontFamily: fonts.regular },
  rowValue: { color: c.dark, fontSize: 13, fontWeight: '600', fontFamily: fonts.semibold, textAlign: 'right', flex: 1, marginLeft: 16 },

  // Icon-led detail rows
  detailRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: c.border,
  },
  detailIconBox: {
    width: 30, height: 30, borderRadius: 9,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  detailLabel: { color: c.muted, fontSize: 12.5, fontFamily: fonts.regular, flex: 1 },
  detailValue: { color: c.dark, fontSize: 13, fontWeight: '700', fontFamily: fonts.bold, textAlign: 'right', maxWidth: '48%' },
  progressBar: { height: 6, backgroundColor: c.border, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: c.success, borderRadius: 4 },
  progressText: { color: c.muted, fontSize: 12, fontFamily: fonts.regular, marginTop: 8, textAlign: 'center' },
  remaining: { color: c.warning, fontSize: 13, fontWeight: '600', fontFamily: fonts.semibold, textAlign: 'center', marginTop: 4 },
  actions: { paddingHorizontal: 16, marginTop: 8 },
  primaryBtn: {
    backgroundColor: c.buttonDark, borderRadius: 12, padding: 16,
    alignItems: 'center', marginBottom: 10,
  },
  primaryBtnDisabled: { opacity: 0.4 },
  dangerBtn: {
    backgroundColor: c.danger, borderRadius: 12, padding: 16,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  outlineBtn: {
    borderWidth: 1.5, borderColor: c.accent, borderRadius: 12,
    padding: 16, alignItems: 'center', marginBottom: 10,
  },
  btnText: { color: c.buttonDarkText, fontSize: 15, fontWeight: '700', fontFamily: fonts.bold },
  dangerBtnText: { color: c.surface, fontSize: 15, fontWeight: '700', fontFamily: fonts.bold, textAlign: 'center' },
  outlineText: { color: c.accent, fontSize: 15, fontWeight: '600', fontFamily: fonts.semibold },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  modal: { backgroundColor: c.surface, borderRadius: 16, padding: 24 },
  modalTitle: { color: c.dark, fontSize: 20, fontWeight: '700', fontFamily: fonts.bold, textAlign: 'center' },
  modalSub: { color: c.muted, fontSize: 13, fontFamily: fonts.regular, textAlign: 'center', marginTop: 4, marginBottom: 16 },
  trustTierBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: c.bg, borderRadius: 8, padding: 10, marginBottom: 8,
    borderWidth: 1, borderColor: c.border,
  },
  trustTierBannerText: { color: c.muted, fontSize: 12, fontFamily: fonts.regular, flex: 1 },
  label: { color: c.muted, fontSize: 13, fontFamily: fonts.regular, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: c.bg, borderRadius: 12, padding: 14,
    fontSize: 15, fontFamily: fonts.regular, color: c.dark, borderWidth: 1, borderColor: c.border,
  },
  calcText: { color: c.success, fontSize: 13, fontFamily: fonts.regular, marginTop: 8, textAlign: 'center' },
  rateErrorText: { color: c.danger, fontSize: 12, fontFamily: fonts.regular, marginTop: 6 },
  cancelBtn: { padding: 14, alignItems: 'center', marginTop: 4 },
  cancelText: { color: c.muted, fontSize: 15, fontFamily: fonts.regular },
  actionRow: { flexDirection: 'row', gap: 10 },
  counterCard: {
    backgroundColor: c.warningBgTint, marginHorizontal: 16, borderRadius: 14,
    padding: 16, marginBottom: 12, borderWidth: 1, borderColor: c.warningBorderTint,
  },
  counterTitle: { color: c.dark, fontSize: 14, fontWeight: '700', fontFamily: fonts.bold, marginBottom: 4 },
  counterText: { color: c.muted, fontSize: 13, fontFamily: fonts.regular, marginBottom: 12 },
  counterRow: { flexDirection: 'row', gap: 10 },
  counterAcceptBtn: { flex: 1, backgroundColor: c.success, borderRadius: 10, padding: 12, alignItems: 'center' },
  counterDeclineBtn: { flex: 1, backgroundColor: c.danger, borderRadius: 10, padding: 12, alignItems: 'center' },
  counterBtnText: { color: c.surface, fontSize: 14, fontWeight: '700', fontFamily: fonts.bold },

  // Terms & Conditions modal
  termsScroll: { maxHeight: 340, marginBottom: 16 },
  termsText: { fontSize: 13, color: c.muted, fontFamily: fonts.regular, lineHeight: 20 },
  termsSectionTitle: { fontSize: 13, fontWeight: '700', fontFamily: fonts.bold, color: c.dark, marginTop: 12, marginBottom: 4 },
  checkboxRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderRadius: 10, backgroundColor: c.bg,
    borderWidth: 1, borderColor: c.border, marginBottom: 16,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 5,
    borderWidth: 2, borderColor: c.border,
    justifyContent: 'center', alignItems: 'center',
  },
  checkboxChecked: { backgroundColor: c.accent, borderColor: c.accent },
  checkboxLabel: { fontSize: 13, color: c.muted, fontFamily: fonts.regular, flex: 1 },
  checkboxLabelChecked: { color: c.dark, fontWeight: '600', fontFamily: fonts.semibold },
  alreadySignedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#f0fdf4', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#bbf7d0', marginBottom: 10,
  },
  alreadySignedText: { color: '#16a34a', fontSize: 13, fontWeight: '600', fontFamily: fonts.semibold },
});

export default function LoanDetailScreen({ route, navigation }: Props) {
  const { loanId } = route.params;
  const { confirm } = useConfirmModal();
  const { showAlert } = useAppAlert();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [loan, setLoan] = useState<Loan | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [acting, setActing] = useState<boolean>(false);
  const [showFund, setShowFund] = useState<boolean>(false);
  const [fundOverride, setFundOverride] = useState<boolean>(false);
  const [showContribute, setShowContribute] = useState<boolean>(false);
  const [contributeAmount, setContributeAmount] = useState<string>('');
  const [contributeRate, setContributeRate] = useState<string>('');
  const [contributions, setContributions] = useState<ContributionsSummary | null>(null);
  const [showRepay, setShowRepay] = useState<boolean>(false);
  const [showDispute, setShowDispute] = useState<boolean>(false);
  const [showCounterOffer, setShowCounterOffer] = useState<boolean>(false);
  const [showTerms, setShowTerms] = useState<boolean>(false);
  const [termsAccepted, setTermsAccepted] = useState<boolean>(false);
  const [counterRate, setCounterRate] = useState<string>('');
  const [interestRate, setInterestRate] = useState<string>('');
  const [repayAmount, setRepayAmount] = useState<string>('');
  const [disputeReason, setDisputeReason] = useState<string>('');
  const [disputeEvidence, setDisputeEvidence] = useState<string>('');
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [escalating, setEscalating] = useState<boolean>(false);
  const [fundRateError, setFundRateError] = useState<string>('');
  const [contributeAmountError, setContributeAmountError] = useState<string>('');
  const [contributeRateError, setContributeRateError] = useState<string>('');
  const [counterRateError, setCounterRateError] = useState<string>('');
  const [disputeReasonError, setDisputeReasonError] = useState<string>('');
  const confirmingRef = useRef(false);

  const loadData = async (): Promise<void> => {
    try {
      const [loanData, profileData] = await Promise.all([getLoan(loanId), getProfile()]);
      setLoan(loanData as Loan);
      setProfile(profileData as Profile);
      if ((loanData as Loan).status === 'DISPUTED') {
        try {
          setDispute(await getDisputeByLoan(loanId) as Dispute);
        } catch {
          setDispute(null);
        }
      } else {
        setDispute(null);
      }
      if ((loanData as Loan).isGroupFunded) {
        try {
          setContributions(await getLoanContributions(loanId) as ContributionsSummary);
        } catch {
          setContributions(null);
        }
      } else {
        setContributions(null);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const doAction = async (action: () => Promise<void>, successMsg?: string): Promise<void> => {
    setActing(true);
    try {
      await action();
      await loadData();
      if (successMsg) showAlert('success', 'Success', successMsg);
    } catch (e) {
      showAlert('error', 'Error', (e as Error).message);
    } finally {
      setActing(false);
    }
  };

  const handleFund = (): void => {
    setFundRateError('');
    if (!interestRate || parseFloat(interestRate) < 0) {
      setFundRateError('Enter a valid interest rate');
      return;
    }
    doAction(async () => {
      await fundLoan({
        loanId: loan!.id,
        interestRate: parseFloat(interestRate),
        overrideGroupFunding: fundOverride || undefined,
      });
      setShowFund(false);
      setFundOverride(false);
    }, 'Loan funded. Agreement pending signatures.');
  };

  const handleFundAloneOverride = async (): Promise<void> => {
    const ok = await confirm(
      'Fund This Loan Alone?',
      `This loan is recommended for group funding based on the borrower's trust tier. You're choosing to fund the full GHS ${formatMoney(loan!.amount)} yourself and take on the full risk alone. Continue?`,
      'Yes, Fund Alone'
    );
    if (!ok) return;
    setFundOverride(true);
    setShowFund(true);
  };

  const remainingToFund = (): number => {
    if (!loan) return 0;
    return contributions ? contributions.remaining : loan.amount;
  };

  // Contributing is a free pledge only -- no money moves yet. Real payment
  // happens later, once the loan is fully funded and every party (borrower +
  // all lenders) has signed the agreement, via handlePayShare below.
  const handleContribute = (): void => {
    setContributeAmountError('');
    setContributeRateError('');
    const amt = parseFloat(contributeAmount);
    const rate = parseFloat(contributeRate);
    if (!amt || amt <= 0) {
      setContributeAmountError('Enter a valid amount'); return;
    }
    if (amt > remainingToFund()) {
      setContributeAmountError(`Amount exceeds what's still needed (GHS ${formatMoney(remainingToFund())})`); return;
    }
    if (!contributeRate || rate < 0) {
      setContributeRateError('Enter a valid interest rate'); return;
    }
    doAction(async () => {
      await contributeToLoan({ loanId: loan!.id, amount: amt, interestRate: rate });
      setShowContribute(false);
      setContributeAmount('');
      setContributeRate('');
    }, 'Contribution recorded.');
  };

  // Shown once the loan is AGREEMENT_SIGNED -- each contributor sends their
  // own pledged amount via Paystack. loan-service auto-activates the loan
  // the moment every contributor has paid, so there's no separate manual
  // "release funds" step.
  const handlePayShare = async (): Promise<void> => {
    if (!myContribution) return;
    const ok = await confirm(
      'Send Your Share',
      `You will be taken to Paystack to send GHS ${formatMoney(myContribution.amount)} to ${loan!.borrowerName}. Continue?`,
      'Continue to Payment'
    );
    if (!ok) return;
    setActing(true);
    try {
      const response = await initializeGroupContribution(loan!.id, myContribution.amount) as PaymentInitResponse;
      if (response.authorizationUrl) {
        const result = response.callbackUrl
          ? await WebBrowser.openAuthSessionAsync(response.authorizationUrl, response.callbackUrl)
          : await WebBrowser.openBrowserAsync(response.authorizationUrl);
        if (result.type === 'success' || result.type === 'dismiss' || result.type === 'cancel') {
          try {
            const verification = await verifyPayment(response.reference) as { status: string; message: string };
            if (verification.status === 'SUCCESS') {
              showAlert('success', 'Success', 'Your share has been sent.');
            } else {
              showAlert('error', 'Payment Pending', verification.message);
            }
          } catch {
            // Verification call itself failed (network etc.) -- refresh below regardless.
          }
        }
      }
      await loadData();
    } catch (e) {
      showAlert('error', 'Error', (e as Error).message);
    } finally {
      setActing(false);
    }
  };

  // Opens T&C modal first, then signs after acceptance
  const handleSignPress = (): void => {
    setTermsAccepted(false);
    setShowTerms(true);
  };

  const handleSign = async (): Promise<void> => {
    setShowTerms(false);
    const ok = await confirm('Sign Agreement', 'Are you sure you want to sign this loan agreement? This action is binding.', 'Yes, Sign');
    if (!ok) return;
    // Group loans have no single lenderId, so they use a separate sign
    // endpoint that checks contributor membership instead -- calling the
    // single-lender one here would fail with "not a party to this loan".
    doAction(async () => {
      if (loan!.isGroupFunded) {
        await signGroupAgreement(loan!.id);
      } else {
        await signAgreement(loan!.id);
      }
    }, 'Agreement signed.');
  };

  const handleReject = async (): Promise<void> => {
    const ok = await confirm('Reject Agreement', 'Reject this funding offer? The loan will be open for another lender to fund.', 'Reject');
    if (!ok) return;
    doAction(async () => { await rejectAgreement(loan!.id); }, 'Agreement rejected.');
  };

  const handleProposeCounterOffer = (): void => {
    setCounterRateError('');
    if (!counterRate || parseFloat(counterRate) < 0) {
      setCounterRateError('Enter a valid interest rate');
      return;
    }
    doAction(async () => {
      await proposeCounterOffer(loan!.id, parseFloat(counterRate));
      setShowCounterOffer(false);
      setCounterRate('');
    }, 'Counter-offer sent to lender.');
  };

  const handleRespondToCounterOffer = async (accept: boolean): Promise<void> => {
    if (accept) {
      const ok = await confirm('Accept Counter-Offer', `Accept the borrower's proposed rate of ${loan!.counterOfferRate}%?`, 'Accept');
      if (!ok) return;
    }
    doAction(async () => { await respondToCounterOffer(loan!.id, accept); },
      accept ? 'Counter-offer accepted. Both parties must re-sign.' : 'Counter-offer declined.');
  };

  const handleDisburse = async (): Promise<void> => {
    const ok = await confirm('Disburse Loan', `You will be taken to Paystack to send GHS ${formatMoney(loan!.amount)} to ${loan!.borrowerName}. Continue?`, 'Continue to Payment');
    if (!ok) return;
    setActing(true);
    try {
      const response = await initializeDisbursement(loan!.id) as PaymentInitResponse;
      if (response.authorizationUrl) {
        // openAuthSessionAsync (not openBrowserAsync) watches for navigation to
        // callbackUrl and closes the browser automatically the moment Paystack
        // redirects there after payment — no need for the user to manually tap
        // "Done". Falls back to a plain browser if callbackUrl wasn't returned.
        const result = response.callbackUrl
          ? await WebBrowser.openAuthSessionAsync(response.authorizationUrl, response.callbackUrl)
          : await WebBrowser.openBrowserAsync(response.authorizationUrl);
        if (result.type === 'success' || result.type === 'dismiss' || result.type === 'cancel') {
          setActing(true);
          try {
            const verification = await verifyPayment(response.reference) as { status: string; message: string };
            if (verification.status === 'SUCCESS') {
              showAlert('success', 'Success', 'Payment successful. Loan is now active.');
              loadData();
            } else {
              showAlert('error', 'Payment Pending', verification.message);
              loadData();
            }
          } catch (e) {
            loadData();
          } finally {
            setActing(false);
          }
        }
      } else {
        await disburseLoan(loan!.id);
        showAlert('success', 'Success', 'Loan disbursed and active.');
        loadData();
      }
    } catch (e) {
      showAlert('error', 'Error', (e as Error).message);
    } finally {
      setActing(false);
    }
  };

  const handleRepay = async (): Promise<void> => {
    if (confirmingRef.current) return;
    confirmingRef.current = true;
    const amt = repayAmount ? parseFloat(repayAmount) : undefined;
    setShowRepay(false);
    const ok = await confirm('Confirm Repayment', `You will be taken to Paystack to repay GHS ${formatMoney(amt !== undefined ? amt : totalOwed)}. Continue?`, 'Continue to Payment');
    if (!ok) { setShowRepay(true); return; }
    setActing(true);
    try {
      const response = await initializeRepayment(loan!.id, amt) as PaymentInitResponse;
      if (response.authorizationUrl) {
        const result = response.callbackUrl
          ? await WebBrowser.openAuthSessionAsync(response.authorizationUrl, response.callbackUrl)
          : await WebBrowser.openBrowserAsync(response.authorizationUrl);
        if (result.type === 'success' || result.type === 'dismiss' || result.type === 'cancel') {
          setActing(true);
          try {
            const verification = await verifyPayment(response.reference) as { status: string; message: string };
            if (verification.status === 'SUCCESS') {
              showAlert('success', 'Success', 'Repayment successful.');
              loadData();
            } else {
              showAlert('error', 'Payment Pending', verification.message);
              loadData();
            }
          } catch (e) {
            loadData();
          } finally {
            setActing(false);
          }
        }
      } else {
        await repayLoan(loan!.id, amt);
        showAlert('success', 'Success', 'Repayment recorded.');
        loadData();
      }
    } catch (e) {
      showAlert('error', 'Error', (e as Error).message);
    } finally {
      setActing(false);
      setRepayAmount('');
      confirmingRef.current = false;
    }
  };

  const handleCancel = async (): Promise<void> => {
    const ok = await confirm('Cancel Loan', 'Cancel this request?', 'Yes, Cancel');
    if (!ok) return;
    doAction(async () => { await cancelLoan(loan!.id); }, 'Loan cancelled.');
  };

  const handleDefault = async (): Promise<void> => {
    const ok = await confirm('Mark Defaulted', "This will significantly impact the borrower's trust score.", 'Mark Defaulted');
    if (!ok) return;
    doAction(async () => { await defaultLoan(loan!.id); }, 'Loan defaulted.');
  };

  const handleDispute = (): void => {
    setDisputeReasonError('');
    if (!disputeReason.trim()) { setDisputeReasonError('Enter a reason'); return; }
    doAction(async () => {
      await openDispute({ loanId: loan!.id, reason: disputeReason, evidence: disputeEvidence });
      setShowDispute(false);
      setDisputeReason('');
      setDisputeEvidence('');
    }, 'Dispute opened.');
  };

  const handleEscalate = async (): Promise<void> => {
    const ok = await confirm(
      'Escalate to Platform Admin',
      "This bypasses your circle owner and sends the dispute straight to Vouch's platform team. Use this if you feel it isn't being handled fairly or quickly enough. Continue?",
      'Escalate'
    );
    if (!ok) return;
    setEscalating(true);
    try {
      await escalateDispute(dispute!.id);
      showAlert('success', 'Escalated', "A platform admin has been notified and will review this dispute.");
      loadData();
    } catch (e) {
      showAlert('error', 'Error', (e as Error).message);
    } finally {
      setEscalating(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.accent} /></View>;
  if (!loan) return <View style={styles.center}><Text style={{ color: colors.danger, fontSize: 16 }}>Loan not found</Text></View>;

  const isBorrower = profile?.id === loan.borrowerId;
  const isLender = profile?.id === loan.lenderId;
  const myContribution = contributions?.contributions.find((c) => c.lenderId === profile?.id);
  const isContributor = !!myContribution;
  const totalOwed = loan.totalRepaymentAmount + loan.overdueInterestAccrued - loan.amountRepaid;
  const iHaveSigned = (isBorrower && loan.borrowerSigned) || (isLender && loan.lenderSigned) || (isContributor && !!myContribution?.signed);

  const statusColor = (s: string): string => ({
    REQUESTED: colors.warning, AGREEMENT_PENDING: colors.statusOrange, AGREEMENT_SIGNED: colors.statusBlue,
    ACTIVE: colors.success, DUE: colors.warning, GRACE_PERIOD: colors.danger,
    REPAID: colors.success, DEFAULTED: colors.danger, DISPUTED: colors.statusPurple, CANCELLED: colors.muted,
  }[s] || colors.muted);

  const statusIcon = (s: string): keyof typeof Ionicons.glyphMap => ({
    REQUESTED: 'hourglass-outline', AGREEMENT_PENDING: 'create-outline', AGREEMENT_SIGNED: 'checkmark-circle-outline',
    ACTIVE: 'flash-outline', DUE: 'alert-circle-outline', GRACE_PERIOD: 'warning-outline',
    REPAID: 'checkmark-done-circle-outline', DEFAULTED: 'close-circle-outline', DISPUTED: 'shield-outline', CANCELLED: 'ban-outline',
  }[s] as keyof typeof Ionicons.glyphMap || 'ellipse-outline');

  const fmtDate = (d?: string): string =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

  const disputeStatusLabel = (d: Dispute): string => {
    if (d.status === 'RESOLVED_BORROWER_FAVOR') return 'RESOLVED — BORROWER FAVOUR';
    if (d.status === 'RESOLVED_LENDER_FAVOR') return 'RESOLVED — LENDER FAVOUR';
    if (d.escalated) return 'ESCALATED — AWAITING ADMIN';
    return 'OPEN — CIRCLE OWNER REVIEWING';
  };

  const disputeStatusColor = (d: Dispute): string => {
    if (d.status.startsWith('RESOLVED')) return colors.success;
    if (d.escalated) return colors.statusPurple;
    return colors.warning;
  };

  type IconName = keyof typeof Ionicons.glyphMap;
  const details: [string, string, IconName][] = [
    ['Circle', loan.circleName, 'people-outline'],
    ['Reason', loan.reason, 'document-text-outline'],
    ['Interest Rate', `${loan.interestRate}%`, 'trending-up-outline'],
    ['Total Repayment', `GHS ${formatMoney(loan.totalRepaymentAmount)}`, 'cash-outline'],
    ['Amount Repaid', `GHS ${formatMoney(loan.amountRepaid)}`, 'checkmark-done-outline'],
    ['Repayment Type', loan.repaymentType, 'repeat-outline'],
    ['Period', `${loan.repaymentPeriodMonths} month(s)`, 'calendar-outline'],
    ['Due Date', fmtDate(loan.dueDate), 'alarm-outline'],
    ['Created', fmtDate(loan.createdAt), 'time-outline'],
    ...(loan.disbursedAt ? [['Disbursed', fmtDate(loan.disbursedAt), 'send-outline'] as [string, string, IconName]] : []),
    ...(loan.platformFee ? [['Platform Fee (2%)', `GHS ${formatMoney(loan.platformFee)}`, 'pricetag-outline'] as [string, string, IconName]] : []),
    ...(loan.borrowerReceivedAmount ? [['Borrower Received', `GHS ${formatMoney(loan.borrowerReceivedAmount)}`, 'wallet-outline'] as [string, string, IconName]] : []),
    ...(loan.overdueInterestAccrued > 0 ? [['Overdue Interest', `GHS ${formatMoney(loan.overdueInterestAccrued)}`, 'warning-outline'] as [string, string, IconName]] : []),
    ...(loan.gracePeriodEnd ? [['Grace Period Ends', fmtDate(loan.gracePeriodEnd), 'hourglass-outline'] as [string, string, IconName]] : []),
  ];

  const initialOf = (name?: string): string => (name && name.trim().length > 0 ? name.trim()[0].toUpperCase() : '?');

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Loan Details</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.amountCard}>
        <Text style={styles.loanIdTag}>LOAN #{loan.id}</Text>
        <Text style={styles.amountLabel}>Loan Amount</Text>
        <Text style={styles.amount}>GHS {formatMoney(loan.amount)}</Text>
        <View style={[styles.badge, { backgroundColor: statusColor(loan.status) }]}>
          <Ionicons name={statusIcon(loan.status)} size={14} color={colors.surface} />
          <Text style={styles.badgeText}>{loan.status.replace(/_/g, ' ')}</Text>
        </View>
      </View>

      <View style={styles.partiesCard}>
        <View style={styles.partyBox}>
          <View style={[styles.avatarCircle, { backgroundColor: colors.accent }]}>
            <Text style={styles.avatarText}>{initialOf(loan.borrowerName)}</Text>
          </View>
          <Text style={styles.partyName} numberOfLines={1}>{loan.borrowerName}</Text>
          <Text style={styles.partyRole}>Borrower</Text>
        </View>
        <View style={styles.partyArrowBox}>
          <Ionicons name="swap-horizontal" size={20} color={colors.muted} />
        </View>
        <View style={styles.partyBox}>
          <View style={[styles.avatarCircle, {
            backgroundColor: loan.isGroupFunded ? colors.accent : (loan.lenderName ? colors.statusBlue : colors.slate400),
          }]}>
            {loan.isGroupFunded
              ? <Ionicons name="people" size={20} color="#fff" />
              : <Text style={styles.avatarText}>{loan.lenderName ? initialOf(loan.lenderName) : '?'}</Text>}
          </View>
          {/* Group loans never set a single lenderName -- there isn't one --
              so showing "Waiting" here was misleading regardless of how far
              along the loan actually was. Show contributor count instead.
              Cancelled/defaulted loans with no lender will never get one,
              so "Waiting" is wrong there too -- show the actual status instead. */}
          <Text style={styles.partyName} numberOfLines={1}>
            {loan.isGroupFunded
              ? `${contributions?.contributorCount ?? 0} Lender${contributions?.contributorCount === 1 ? '' : 's'}`
              : (loan.lenderName || (['CANCELLED', 'DEFAULTED'].includes(loan.status) ? loan.status.replace(/_/g, ' ').toLowerCase() : 'Waiting'))}
          </Text>
          <Text style={styles.partyRole}>Lender</Text>
        </View>
      </View>

      {loan.isGroupFunded && contributions && (
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="people-circle-outline" size={17} color={colors.accent} />
            <Text style={styles.cardTitle}>Group Funding Progress</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${Math.min(contributions.percentFunded, 100)}%` as any }]} />
          </View>
          <Text style={styles.progressText}>
            GHS {formatMoney(contributions.totalContributed)} / {formatMoney(loan.amount)} funded ({contributions.contributorCount} contributor{contributions.contributorCount === 1 ? '' : 's'})
          </Text>
          {contributions.remaining > 0 && loan.status === 'REQUESTED' && (
            <Text style={styles.remaining}>GHS {formatMoney(contributions.remaining)} still needed</Text>
          )}
          {contributions.contributions.map((c) => {
            // Contributions progress through three stages, each shown only
            // once it's relevant: pledged (REQUESTED) -> signed (AGREEMENT_PENDING)
            // -> paid (AGREEMENT_SIGNED onward, once real money starts moving).
            let statusSuffix = '';
            if (loan.status === 'AGREEMENT_PENDING') {
              statusSuffix = c.signed ? '  ✓ Signed' : '  · Awaiting signature';
            } else if (loan.status !== 'REQUESTED') {
              statusSuffix = c.paid ? '  ✓ Paid' : '  · Awaiting payment';
            }
            return (
              <View key={c.id} style={styles.detailRow}>
                <View style={[styles.detailIconBox, { backgroundColor: colors.accent + '22' }]}>
                  <Ionicons name="person-outline" size={15} color={colors.accent} />
                </View>
                <Text style={styles.detailLabel}>{c.lenderName}</Text>
                <Text style={styles.detailValue}>
                  GHS {formatMoney(c.amount)} @ {c.interestRate}%{statusSuffix}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="information-circle-outline" size={17} color={colors.accent} />
          <Text style={styles.cardTitle}>Loan Information</Text>
        </View>
        {details.map(([label, value, icon], i) => (
          <View key={i} style={[styles.detailRow, i === details.length - 1 && { borderBottomWidth: 0 }]}>
            <View style={[styles.detailIconBox, { backgroundColor: label === 'Overdue Interest' ? colors.dangerBgTint : colors.goldBgTint }]}>
              <Ionicons name={icon} size={15} color={label === 'Overdue Interest' ? colors.danger : colors.accent} />
            </View>
            <Text style={styles.detailLabel}>{label}</Text>
            <Text style={[styles.detailValue, label === 'Overdue Interest' && { color: colors.danger }]} numberOfLines={2}>{value}</Text>
          </View>
        ))}
      </View>

      {loan.totalRepaymentAmount > 0 && !['REPAID', 'CANCELLED', 'REQUESTED'].includes(loan.status) && (
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="bar-chart-outline" size={17} color={colors.accent} />
            <Text style={styles.cardTitle}>Repayment Progress</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, {
              width: `${Math.min((loan.amountRepaid / (loan.totalRepaymentAmount + loan.overdueInterestAccrued)) * 100, 100)}%` as any
            }]} />
          </View>
          <Text style={styles.progressText}>
            GHS {formatMoney(loan.amountRepaid)} / {formatMoney(loan.totalRepaymentAmount + loan.overdueInterestAccrued)}
          </Text>
          {totalOwed > 0 && <Text style={styles.remaining}>Remaining: GHS {formatMoney(totalOwed)}</Text>}
        </View>
      )}

      {dispute && (
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="shield-outline" size={17} color={colors.statusPurple} />
            <Text style={styles.cardTitle}>Dispute</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: disputeStatusColor(dispute), alignSelf: 'flex-start', marginTop: 0, marginBottom: 12 }]}>
            <Text style={styles.badgeText}>{disputeStatusLabel(dispute)}</Text>
          </View>
          <Text style={styles.rowLabel}>Opened by {dispute.openedByName}</Text>
          <Text style={{ color: colors.dark, fontSize: 13, marginTop: 4, marginBottom: 10, lineHeight: 19 }}>{dispute.reason}</Text>
          {dispute.evidence ? (
            <>
              <Text style={styles.rowLabel}>Evidence</Text>
              <Text style={{ color: colors.dark, fontSize: 13, marginTop: 4, marginBottom: 10, lineHeight: 19 }}>{dispute.evidence}</Text>
            </>
          ) : null}
          {dispute.status.startsWith('RESOLVED') && dispute.resolution && (
            <>
              <Text style={styles.rowLabel}>Resolution</Text>
              <Text style={{ color: colors.dark, fontSize: 13, marginTop: 4, lineHeight: 19 }}>{dispute.resolution}</Text>
            </>
          )}
          {!dispute.status.startsWith('RESOLVED') && dispute.escalated && (
            <View style={styles.trustTierBanner}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.statusPurple} />
              <Text style={styles.trustTierBannerText}>Escalated to a Vouch platform admin — your circle owner can no longer resolve this.</Text>
            </View>
          )}
          {!dispute.status.startsWith('RESOLVED') && !dispute.escalated && (isBorrower || isLender) && (
            <TouchableOpacity
              style={[styles.outlineBtn, { marginTop: 4 }, escalating && { opacity: 0.6 }]}
              onPress={handleEscalate}
              disabled={escalating}
            >
              {escalating ? <ActivityIndicator color={colors.accent} /> : <Text style={styles.outlineText}>Escalate to Platform Admin</Text>}
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={styles.actions}>
        {loan.status === 'REQUESTED' && !isBorrower && !loan.isGroupFunded && (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowFund(true)}>
            <Text style={styles.btnText}>Fund This Loan</Text>
          </TouchableOpacity>
        )}
        {loan.status === 'REQUESTED' && !isBorrower && loan.isGroupFunded && (
          <>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowContribute(true)}>
              <Text style={styles.btnText}>Contribute to This Loan</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.outlineBtn} onPress={handleFundAloneOverride}>
              <Text style={styles.outlineText}>Fund This Loan Alone Instead</Text>
            </TouchableOpacity>
          </>
        )}
        {loan.status === 'AGREEMENT_PENDING' && isLender && loan.counterOfferRate != null && (
          <View style={styles.counterCard}>
            <Text style={styles.counterTitle}>Counter-Offer Received</Text>
            <Text style={styles.counterText}>
              Borrower proposed {loan.counterOfferRate}% instead of {loan.interestRate}%
            </Text>
            <View style={styles.counterRow}>
              <TouchableOpacity style={styles.counterAcceptBtn} onPress={() => handleRespondToCounterOffer(true)} disabled={acting}>
                <Text style={styles.counterBtnText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.counterDeclineBtn} onPress={() => handleRespondToCounterOffer(false)} disabled={acting}>
                <Text style={styles.counterBtnText}>Decline</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Sign Agreement — only show if not yet signed. isLender covers
            single-lender loans; group loans have no lenderId, so isContributor
            covers those instead. */}
        {loan.status === 'AGREEMENT_PENDING' && (isBorrower || isLender || isContributor) && (
          iHaveSigned ? (
            <View style={styles.alreadySignedBadge}>
              <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
              <Text style={styles.alreadySignedText}>You have signed — waiting for the other party</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.primaryBtn} onPress={handleSignPress} disabled={acting}>
              {acting ? <ActivityIndicator color={colors.buttonDarkText} /> : <Text style={styles.btnText}>Sign Agreement</Text>}
            </TouchableOpacity>
          )
        )}

        {loan.status === 'AGREEMENT_PENDING' && isBorrower && (
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.outlineBtn, { flex: 1 }]} onPress={() => setShowCounterOffer(true)}>
              <Text style={styles.outlineText}>Propose Different Rate</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.dangerBtn, { flex: 1 }]} onPress={handleReject} disabled={acting}>
              <Text style={styles.dangerBtnText}>Reject</Text>
            </TouchableOpacity>
          </View>
        )}
        {loan.status === 'AGREEMENT_SIGNED' && isLender && !loan.isGroupFunded && (
          <TouchableOpacity style={styles.primaryBtn} onPress={handleDisburse} disabled={acting}>
            <Text style={styles.btnText}>Send GHS {formatMoney(loan.amount)} to {loan.borrowerName}</Text>
          </TouchableOpacity>
        )}
        {loan.status === 'AGREEMENT_SIGNED' && loan.isGroupFunded && isContributor && !myContribution?.paid && (
          <TouchableOpacity style={styles.primaryBtn} onPress={handlePayShare} disabled={acting}>
            <Text style={styles.btnText}>Send Your Share: GHS {formatMoney(myContribution?.amount)}</Text>
          </TouchableOpacity>
        )}
        {loan.status === 'AGREEMENT_SIGNED' && loan.isGroupFunded && isContributor && myContribution?.paid && (
          <View style={styles.alreadySignedBadge}>
            <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
            <Text style={styles.alreadySignedText}>You've sent your share — waiting for other lenders</Text>
          </View>
        )}
        {['ACTIVE', 'DUE', 'GRACE_PERIOD'].includes(loan.status) && isBorrower && (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => { setActing(false); setRepayAmount(totalOwed.toFixed(2)); setShowRepay(true); }}>
            <Text style={styles.btnText}>Repay via Paystack</Text>
          </TouchableOpacity>
        )}
        {['REQUESTED', 'AGREEMENT_PENDING'].includes(loan.status) && isBorrower && (
          <TouchableOpacity style={styles.dangerBtn} onPress={handleCancel}>
            <Text style={styles.dangerBtnText}>Cancel Loan</Text>
          </TouchableOpacity>
        )}
        {loan.status === 'GRACE_PERIOD' && isLender && (
          <TouchableOpacity style={styles.dangerBtn} onPress={handleDefault}>
            <Text style={styles.dangerBtnText}>Mark as Defaulted</Text>
          </TouchableOpacity>
        )}
        {['ACTIVE', 'DUE', 'GRACE_PERIOD', 'REPAID'].includes(loan.status) && (isBorrower || isLender) && (
          <TouchableOpacity style={styles.outlineBtn} onPress={() => setShowDispute(true)}>
            <Text style={styles.outlineText}>Open Dispute</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Terms & Conditions Modal */}
      <Modal visible={showTerms} animationType="slide" transparent onRequestClose={() => setShowTerms(false)}>
        {/* Pressable all the way down, not TouchableWithoutFeedback -- that
            family competes with the ScrollView below for the touch responder
            on Android and can block scrolling even when it's an ancestor
            rather than the ScrollView's direct parent. This is the only
            modal in this file with an actual ScrollView inside it, which is
            why it's the only one that hit this. */}
        <Pressable style={styles.modalBg} onPress={() => setShowTerms(false)}>
          <Pressable onPress={() => {}}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Loan Agreement</Text>
            <Text style={styles.modalSub}>Please read and accept before signing</Text>

            <ScrollView style={styles.termsScroll} showsVerticalScrollIndicator nestedScrollEnabled>
              <Text style={styles.termsSectionTitle}>1. Repayment Obligation</Text>
              <Text style={styles.termsText}>
                The borrower agrees to repay the full principal amount plus the agreed interest rate by the specified due date. Failure to repay on time will result in overdue interest accruing daily during a 7-day grace period.
              </Text>

              <Text style={styles.termsSectionTitle}>2. Overdue Interest</Text>
              <Text style={styles.termsText}>
                If the loan is not repaid by the due date, daily overdue interest will be charged on the outstanding balance for up to 7 days. After the grace period, the lender may mark the loan as defaulted.
              </Text>

              <Text style={styles.termsSectionTitle}>3. Trust Score Impact</Text>
              <Text style={styles.termsText}>
                Defaulting on a loan will significantly reduce your trust score. A first default results in a score drop and a circle-wide notification. A second default results in a 30-day borrowing suspension. A third default results in a permanent borrowing ban.
              </Text>

              <Text style={styles.termsSectionTitle}>4. Platform Fee</Text>
              <Text style={styles.termsText}>
                A 2% platform fee is deducted from the disbursed amount. The borrower receives the loan amount minus this fee.
              </Text>

              <Text style={styles.termsSectionTitle}>5. Disputes</Text>
              <Text style={styles.termsText}>
                Either party may open a dispute through the app. All disputes are reviewed by Vouch administrators. This agreement may be used as evidence in any dispute resolution process.
              </Text>

              <Text style={styles.termsSectionTitle}>6. Binding Agreement</Text>
              <Text style={styles.termsText}>
                By signing, both parties confirm they have read, understood and agreed to these terms. This is a legally binding agreement between the borrower and lender within the Vouch platform.
              </Text>
            </ScrollView>

            {/* Checkbox */}
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setTermsAccepted(v => !v)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
                {termsAccepted && <Ionicons name="checkmark" size={13} color="#fff" />}
              </View>
              <Text style={[styles.checkboxLabel, termsAccepted && styles.checkboxLabelChecked]}>
                I have read and agree to the terms and conditions
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryBtn, !termsAccepted && styles.primaryBtnDisabled]}
              onPress={handleSign}
              disabled={!termsAccepted || acting}
            >
              {acting
                ? <ActivityIndicator color={colors.buttonDarkText} />
                : <Text style={styles.btnText}>Sign Agreement</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowTerms(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Fund Modal */}
      <Modal visible={showFund} animationType="slide" transparent onRequestClose={() => { setShowFund(false); setFundOverride(false); }}>
        <TouchableWithoutFeedback onPress={() => { setShowFund(false); setFundOverride(false); }}>
        <View style={styles.modalBg}>
          <TouchableWithoutFeedback onPress={() => {}}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{fundOverride ? 'Fund This Loan Alone' : 'Fund This Loan'}</Text>
            <Text style={styles.modalSub}>GHS {formatMoney(loan.amount)} to {loan.borrowerName}</Text>
            {fundOverride && (
              <View style={[styles.trustTierBanner, { borderColor: colors.warningBorderTint, backgroundColor: colors.warningBgTint }]}>
                <Ionicons name="warning-outline" size={16} color={colors.warning} />
                <Text style={styles.trustTierBannerText}>
                  You're overriding the group funding recommendation and taking on the full loan risk alone.
                </Text>
              </View>
            )}
            <View style={styles.trustTierBanner}>
              <Ionicons name="shield-checkmark-outline" size={16} color={colors.muted} />
              <Text style={styles.trustTierBannerText}>
                Borrower trust tier: {loan.borrowerTrustTier} — max rate: {loan.borrowerMaxInterestRate}%
              </Text>
            </View>
            <Text style={styles.label}>Interest Rate (%)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 5"
              placeholderTextColor={colors.muted}
              value={interestRate}
              onChangeText={(text) => { setInterestRate(text); setFundRateError(''); }}
              keyboardType="numeric"
            />
            {fundRateError !== '' && <Text style={{ color: colors.errorRed, fontSize: 13, marginTop: 6 }}>{fundRateError}</Text>}
            {parseFloat(interestRate) > loan.borrowerMaxInterestRate && (
              <Text style={styles.rateErrorText}>
                Exceeds the {loan.borrowerMaxInterestRate}% max for this borrower
              </Text>
            )}
            {parseFloat(interestRate) > 0 && (
              <Text style={styles.calcText}>
                Total repayment: GHS {formatMoney(loan.amount * (1 + parseFloat(interestRate || '0') / 100))}
              </Text>
            )}
            <TouchableOpacity
              style={[styles.primaryBtn, parseFloat(interestRate) > loan.borrowerMaxInterestRate && { opacity: 0.5 }]}
              onPress={handleFund}
              disabled={acting || parseFloat(interestRate) > loan.borrowerMaxInterestRate}
            >
              {acting ? <ActivityIndicator color={colors.buttonDarkText} /> : <Text style={styles.btnText}>Confirm & Fund</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowFund(false); setFundOverride(false); }}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
          </TouchableWithoutFeedback>
        </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Contribute Modal (group funding) */}
      <Modal visible={showContribute} animationType="slide" transparent onRequestClose={() => setShowContribute(false)}>
        <TouchableWithoutFeedback onPress={() => setShowContribute(false)}>
        <View style={styles.modalBg}>
          <TouchableWithoutFeedback onPress={() => {}}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Contribute to This Loan</Text>
            <Text style={styles.modalSub}>
              GHS {formatMoney(remainingToFund())} still needed of GHS {formatMoney(loan.amount)}
            </Text>
            <View style={styles.trustTierBanner}>
              <Ionicons name="shield-checkmark-outline" size={16} color={colors.muted} />
              <Text style={styles.trustTierBannerText}>
                Borrower trust tier: {loan.borrowerTrustTier} — max rate: {loan.borrowerMaxInterestRate}%
              </Text>
            </View>
            <Text style={styles.label}>Amount to Contribute (GHS)</Text>
            <TextInput
              style={styles.input}
              placeholder={`Up to ${remainingToFund().toFixed(2)}`}
              placeholderTextColor={colors.muted}
              value={contributeAmount}
              onChangeText={(text) => { setContributeAmount(text); setContributeAmountError(''); }}
              keyboardType="numeric"
            />
            {contributeAmountError !== '' && <Text style={{ color: colors.errorRed, fontSize: 13, marginTop: 6 }}>{contributeAmountError}</Text>}
            <Text style={styles.label}>Interest Rate (%)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 5"
              placeholderTextColor={colors.muted}
              value={contributeRate}
              onChangeText={(text) => { setContributeRate(text); setContributeRateError(''); }}
              keyboardType="numeric"
            />
            {contributeRateError !== '' && <Text style={{ color: colors.errorRed, fontSize: 13, marginTop: 6 }}>{contributeRateError}</Text>}
            {parseFloat(contributeRate) > loan.borrowerMaxInterestRate && (
              <Text style={styles.rateErrorText}>
                Exceeds the {loan.borrowerMaxInterestRate}% max for this borrower
              </Text>
            )}
            {parseFloat(contributeAmount) > 0 && (
              <Text style={styles.calcText}>
                You'll receive: GHS {formatMoney(parseFloat(contributeAmount) * (1 + parseFloat(contributeRate || '0') / 100))}
              </Text>
            )}
            <TouchableOpacity
              style={[styles.primaryBtn, parseFloat(contributeRate) > loan.borrowerMaxInterestRate && { opacity: 0.5 }]}
              onPress={handleContribute}
              disabled={acting || parseFloat(contributeRate) > loan.borrowerMaxInterestRate}
            >
              {acting ? <ActivityIndicator color={colors.buttonDarkText} /> : <Text style={styles.btnText}>Confirm Contribution</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowContribute(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
          </TouchableWithoutFeedback>
        </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Counter-Offer Modal */}
      <Modal visible={showCounterOffer} animationType="slide" transparent onRequestClose={() => setShowCounterOffer(false)}>
        <TouchableWithoutFeedback onPress={() => setShowCounterOffer(false)}>
        <View style={styles.modalBg}>
          <TouchableWithoutFeedback onPress={() => {}}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Propose Different Rate</Text>
            <Text style={styles.modalSub}>Current rate: {loan.interestRate}%</Text>
            <Text style={styles.label}>New Interest Rate (%)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 3"
              placeholderTextColor={colors.muted}
              value={counterRate}
              onChangeText={(text) => { setCounterRate(text); setCounterRateError(''); }}
              keyboardType="numeric"
            />
            {counterRateError !== '' && <Text style={{ color: colors.errorRed, fontSize: 13, marginTop: 6 }}>{counterRateError}</Text>}
            <TouchableOpacity style={styles.primaryBtn} onPress={handleProposeCounterOffer} disabled={acting}>
              {acting ? <ActivityIndicator color={colors.buttonDarkText} /> : <Text style={styles.btnText}>Send Counter-Offer</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCounterOffer(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
          </TouchableWithoutFeedback>
        </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Repay Modal */}
      <Modal visible={showRepay} animationType="slide" transparent onRequestClose={() => setShowRepay(false)}>
        <TouchableWithoutFeedback onPress={() => setShowRepay(false)}>
        <View style={styles.modalBg}>
          <TouchableWithoutFeedback onPress={() => {}}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Repay Loan</Text>
            <Text style={styles.modalSub}>Outstanding: GHS {formatMoney(totalOwed)}</Text>
            <Text style={styles.label}>Amount (GHS)</Text>
            <TextInput
              style={styles.input}
              placeholder={totalOwed.toFixed(2)}
              placeholderTextColor={colors.muted}
              value={repayAmount}
              onChangeText={setRepayAmount}
              keyboardType="numeric"
            />
            <TouchableOpacity style={styles.primaryBtn} onPress={handleRepay} disabled={acting}>
              {acting ? <ActivityIndicator color={colors.buttonDarkText} /> : <Text style={styles.btnText}>Confirm Repayment</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowRepay(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
          </TouchableWithoutFeedback>
        </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Dispute Modal */}
      <Modal visible={showDispute} animationType="slide" transparent onRequestClose={() => setShowDispute(false)}>
        <TouchableWithoutFeedback onPress={() => setShowDispute(false)}>
        <View style={styles.modalBg}>
          <TouchableWithoutFeedback onPress={() => {}}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Open Dispute</Text>
            <Text style={styles.label}>Reason *</Text>
            <TextInput
              style={[styles.input, { height: 80 }]}
              placeholder="Why are you disputing?"
              placeholderTextColor={colors.muted}
              value={disputeReason}
              onChangeText={(text) => { setDisputeReason(text); setDisputeReasonError(''); }}
              multiline
            />
            {disputeReasonError !== '' && <Text style={{ color: colors.errorRed, fontSize: 13, marginTop: 6 }}>{disputeReasonError}</Text>}
            <Text style={styles.label}>Evidence</Text>
            <TextInput
              style={[styles.input, { height: 80 }]}
              placeholder="Any supporting evidence"
              placeholderTextColor={colors.muted}
              value={disputeEvidence}
              onChangeText={setDisputeEvidence}
              multiline
            />
            <TouchableOpacity style={styles.primaryBtn} onPress={handleDispute} disabled={acting}>
              {acting ? <ActivityIndicator color={colors.buttonDarkText} /> : <Text style={styles.btnText}>Submit Dispute</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowDispute(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
          </TouchableWithoutFeedback>
        </View>
        </TouchableWithoutFeedback>
      </Modal>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}