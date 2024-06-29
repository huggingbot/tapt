import 'dotenv/config';
// import { initializeApp } from 'firebase-admin/app';
// export { txnTracker, approvalSubmission } from './transactions';
// export { executeDcaOrders } from './trades';
// initializeApp();

/**
 * Testing locally
 */
// import { trackTransaction } from './transactions';
// import { executeLimitTrades } from './trades';
// import { submitApprovalTransactions } from './transactions';
// import { countdown } from './utils/helpers';
import { checkLimitOrderCriteria } from './trades';
// import { orderStatusChecker } from './trades';
// import { executeDcaOrders } from './trades';

// orderStatusChecker();
// executeDcaOrders();

// trackTransaction();
checkLimitOrderCriteria();
// executeLimitTrades();
// submitApprovalTransactions();

// async function main() {
//   await countdown(5, submitApprovalTransactions, 10_000);
// }

// main();
