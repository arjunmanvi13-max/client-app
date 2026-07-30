import type { ExpenseEntry, ExpenseLineItem } from "./expenseTypes";
import { formatInr } from "./expenseFormat";

export function getExpenseLineItems(entry: Pick<
  ExpenseEntry,
  "items" | "rate" | "quantity" | "amount" | "sub_category" | "expense_head_name"
>): ExpenseLineItem[] {
  if (entry.items?.length) return entry.items;
  if (entry.rate != null && entry.quantity != null) {
    return [{
      item_name: entry.sub_category || entry.expense_head_name || "Item",
      rate: entry.rate,
      quantity: entry.quantity,
      amount: entry.amount,
    }];
  }
  return [{
    item_name: entry.sub_category || entry.expense_head_name || "Expense",
    rate: 0,
    quantity: 1,
    amount: entry.amount,
  }];
}

export function expenseItemsSummary(entry: Pick<
  ExpenseEntry,
  "items" | "rate" | "quantity" | "amount" | "sub_category" | "expense_head_name"
>): string {
  const items = getExpenseLineItems(entry);
  if (items.length === 1) return items[0].item_name;
  return `${items.length} items · ${formatInr(entry.amount)}`;
}

export function expenseItemsTableRows(entry: Pick<
  ExpenseEntry,
  "items" | "rate" | "quantity" | "amount" | "sub_category" | "expense_head_name"
>): string[][] {
  return getExpenseLineItems(entry).map((it) => [
    it.item_name,
    formatInr(it.rate, 0),
    String(it.quantity),
    formatInr(it.amount),
  ]);
}
