import 'dotenv/config';
import { initializeApp } from 'firebase-admin/app';
export { txnTracker, approvalSubmission } from './transactions';
export { tradeExecution, limitOrderCriteriaChecker, orderMonitor, dcaOrderExecutor } from './trades';
initializeApp();

/**
 * Testing locally
 */
// import { trackTransaction } from './transactions';
// import { executeLimitTrades } from './trades';
// import { submitApprovalTransactions } from './transactions';
// import { countdown } from './utils/helpers';
// import { checkLimitOrderCriteria } from './trades';

// trackTransaction();
// checkLimitOrderCriteria();
// executeLimitTrades();

// async function main() {
//   await countdown(5, submitApprovalTransactions, 10_000);
// }

// main();
