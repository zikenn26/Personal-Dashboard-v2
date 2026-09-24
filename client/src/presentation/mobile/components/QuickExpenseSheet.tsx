import React, { useState } from 'react';
import { BottomSheet } from '../gestures/BottomSheet';
import { ExpenseItem } from '../../../types';
import { nativeService } from '../../../services/nativeService';
import { Plus, CreditCard, Tag, Calendar, Building2 } from 'lucide-react';

export interface QuickExpenseSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onAddExpense?: (item: Omit<ExpenseItem, 'id'>) => void;
}

export const QuickExpenseSheet: React.FC<QuickExpenseSheetProps> = ({
  isOpen,
  onClose,
  onAddExpense,
}) => {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Dining Out');
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'Credit Card' | 'Debit Card' | 'Cash' | 'Net Banking'>('UPI');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);

  const categories = [
    'Dining Out',
    'Groceries',
    'Shopping',
    'Transport',
    'Utilities',
    'Entertainment',
    'Health',
    'Education',
    'Other',
  ];

  const paymentMethods: Array<'UPI' | 'Credit Card' | 'Debit Card' | 'Cash'> = [
    'UPI',
    'Credit Card',
    'Debit Card',
    'Cash',
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    const cleanTitle = title.trim();
    if (!cleanTitle || isNaN(parsedAmount) || parsedAmount <= 0 || !onAddExpense) return;

    void nativeService.triggerHaptic('success');
    onAddExpense({
      name: cleanTitle,
      amount: parsedAmount,
      category,
      paymentMethod,
      date,
      billingCycle: 'one-time',
      active: true,
      notes: 'Added from Android quick access',
    });

    setTitle('');
    setAmount('');
    onClose();
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Add Expense" subtitle="Quickly track a spending transaction">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Amount Input */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
            Amount (₹)
          </label>
          <div className="relative">
            <span className="text-xl font-bold text-violet-600 dark:text-violet-400 absolute left-4 top-2.5">
              ₹
            </span>
            <input
              type="number"
              step="any"
              required
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full pl-9 pr-4 py-3 rounded-2xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] text-xl font-bold text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
        </div>

        {/* Merchant / Description */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
            Merchant / Description
          </label>
          <div className="relative">
            <Building2 className="w-4 h-4 text-violet-500 absolute left-3.5 top-3.5" />
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Swiggy, Starbucks, Amazon"
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
        </div>

        {/* Payment Method Pills */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
            Payment Method
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {paymentMethods.map((method) => {
              const isSelected = paymentMethod === method;
              return (
                <button
                  key={method}
                  type="button"
                  onClick={() => {
                    void nativeService.triggerHaptic('selection');
                    setPaymentMethod(method);
                  }}
                  className={`py-2 px-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer text-center ${
                    isSelected
                      ? 'bg-violet-600 text-white shadow-xs'
                      : 'bg-gray-50 dark:bg-[#1A2234] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {method}
                </button>
              );
            })}
          </div>
        </div>

        {/* Category & Date */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Category
            </label>
            <div className="relative">
              <Tag className="w-4 h-4 text-gray-400 absolute left-3 top-3 pointer-events-none" />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Date
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-3 pointer-events-none" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={!title.trim() || !amount}
            className="w-full py-3 px-4 rounded-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold text-sm shadow-md shadow-violet-500/25 flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Log Expense</span>
          </button>
        </div>
      </form>
    </BottomSheet>
  );
};
