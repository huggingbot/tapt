import 'dotenv/config';
// import { initializeApp } from 'firebase-admin/app';
// export { txnTracker, approvalSubmission } from './transactions';
// export { tradeExecution, limitOrderCriteriaChecker, orderMonitor, dcaOrderExecutor } from './trades';
// initializeApp();

/**
 * Testing locally
 */
// import { trackTransaction } from './transactions';
import { checkLimitOrderCriteria } from './trades';

// submitApprovalTransactions();
checkLimitOrderCriteria();
