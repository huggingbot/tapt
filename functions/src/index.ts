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
// submitApprovalTransactions();
// checkLimitOrderCriteria();
// executeLimitTrades();

// async function main() {
//   const approvalTxns = await submitApprovalTransactions();
//   console.log('approvalSubmission', approvalTxns);
//   let count = 0;

//   const timeoutFunc = setTimeout(async () => {
//     const approvalTxns = await submitApprovalTransactions();
//     console.log('approvalSubmission', approvalTxns);
//     count++;
//     console.log('count', count);
//     if (count === 3) {
//       clearTimeout(timeoutFunc);
//     }
//   }, 2_000);
// }

// main();
// countdown(5, submitApprovalTransactions);
