import { safeParseBill } from './src/validators';

const billData = {
  id: "test",
  name: "Bredband",
  accountId: "konto1",
  splitType: "equal",
  defaultAmount: 48,
  interval: "all",
  isAutoTransfer: true
};

console.log(safeParseBill(billData));
