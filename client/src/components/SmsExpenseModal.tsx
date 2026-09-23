import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  ShieldCheck,
  Zap,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Sparkles,
  Inbox,
  ArrowRight,
  Filter,
  Trash2,
  ExternalLink,
  Info,
  Clock,
  Check,
  CreditCard,
  MessageSquare,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { smsExpenseService } from '../services/smsExpenseService';
import { Storage } from '../utils/storage';
import { Sound } from '../utils/audio';
import { SmsTransactionLogItem, ParsedSmsTransaction } from '../types';

interface SmsExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  soundEnabled: boolean;
}

const SAMPLE_BANK_SMS = [
  {
    title: 'HDFC Bank (Swiggy)',
    sender: 'HDFCBK',
    text: 'Rs.450.00 debited from HDFC Bank A/c **4120 on 23-Sep-26 to SWIGGY. UPI: 429384928342. Avl bal: Rs.14,200.00.',
  },
  {
    title: 'SBI UPI (Mohit Sharma)',
    sender: 'SBIINB',
    text: 'Dear UPI user A/C 9876 debited by 1200.00 on 23Sep26 transfer to MOHIT SHARMA Ref No 429482938492. Avail Bal: Rs 4,500.',
  },
  {
    title: 'ICICI Credit Card (Amazon)',
    sender: 'ICICIB',
    text: 'Your ICICI Bank Credit Card XX2004 has been used for purchase of INR 2,499.00 at AMAZON INDIA on 23-Sep-2026. Avl Lmt: INR 85,000.',
  },
  {
    title: 'Axis Bank (Starbucks)',
    sender: 'AXISBK',
    text: 'Axis Bank: INR 350.00 spent on Card ending 4412 at STARBUCKS on 23-09-2026 14:15:30. Avail Bal: INR 12,500.00.',
  },
  {
    title: 'Zepto Quick Grocery',
    sender: 'GPAY',
    text: 'Paid Rs.199 to ZEPTO via Google Pay UPI. Txn ID: 40928392834.',
  },
  {
    title: 'ATM Cash Withdrawal',
    sender: 'HDFCBK',
    text: 'Rs.2000.00 withdrawn from ATM using Debit Card **1234 on 23-Sep-26. Avl bal: Rs.8,500.',
  },
  {
    title: 'Bank OTP (Should be Ignored)',
    sender: 'HDFCBK',
    text: 'Your OTP for transaction of Rs.500 at Swiggy is 492810. Do not share this OTP with anyone. Valid for 10 mins.',
  },
  {
    title: 'Personal Loan Offer (Should be Ignored)',
    sender: 'BAJAJ',
    text: 'Congratulations! You are eligible for pre-approved instant personal loan up to Rs. 5,00,000. Click here to claim: https://sample.link',
  },
];

export const SmsExpenseModal: React.FC<SmsExpenseModalProps> = ({
  isOpen,
  onClose,
  soundEnabled,
}) => {
  const [enabled, setEnabled] = useState(smsExpenseService.isAutoTrackingEnabled());
  const [permissionStatus, setPermissionStatus] = useState<string>('prompt');
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [logs, setLogs] = useState<SmsTransactionLogItem[]>([]);
  const [activeTab, setActiveTab] = useState<'settings' | 'test' | 'logs'>('settings');

  // Interactive Test State
  const [testSmsText, setTestSmsText] = useState(SAMPLE_BANK_SMS[0].text);
  const [testSender, setTestSender] = useState(SAMPLE_BANK_SMS[0].sender);
  const [testResult, setTestResult] = useState<{
    status: string;
    reason?: string;
    parsed: ParsedSmsTransaction;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setEnabled(smsExpenseService.isAutoTrackingEnabled());
      setLogs(Storage.getSmsTransactionLogs());
      smsExpenseService.checkPermission().then(setPermissionStatus);
    }
  }, [isOpen]);

  // Listen for storage or logging events
  useEffect(() => {
    const handleLogUpdate = () => {
      setLogs(Storage.getSmsTransactionLogs());
    };
    window.addEventListener('sms_transaction_logged', handleLogUpdate);
    return () => {
      window.removeEventListener('sms_transaction_logged', handleLogUpdate);
    };
  }, []);

  if (!isOpen) return null;

  const handleToggleEnable = async () => {
    Sound.click(soundEnabled);
    const next = !enabled;
    setEnabled(next);
    await smsExpenseService.setAutoTrackingEnabled(next);
  };

  const handleRequestPermission = async () => {
    Sound.click(soundEnabled);
    const res = await smsExpenseService.requestPermission();
    setPermissionStatus(res);
    setEnabled(smsExpenseService.isAutoTrackingEnabled());
  };

  const handleScanInbox = async () => {
    Sound.click(soundEnabled);
    setIsScanning(true);
    setScanMessage(null);
    try {
      const summary = await smsExpenseService.scanRecentInbox(30);
      setScanMessage(
        `Scanned ${summary.scanned} SMS: ${summary.logged} new logged, ${summary.skippedDuplicates} duplicates skipped.`
      );
      setLogs(Storage.getSmsTransactionLogs());
    } catch (err: any) {
      setScanMessage(err?.message || 'Inbox scan requires Android device with SMS permission.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleClearLogs = () => {
    Sound.click(soundEnabled);
    Storage.clearSmsTransactionLogs();
    setLogs([]);
  };

  const handleRunTest = () => {
    Sound.click(soundEnabled);
    const result = smsExpenseService.processSms(testSmsText, testSender, Date.now(), true);
    setTestResult({
      status: result.status,
      reason: result.reason,
      parsed: result.parsed,
    });
    setLogs(Storage.getSmsTransactionLogs());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-2xl bg-white dark:bg-[#111827] rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  SMS Expense Auto-Logger
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Android Native
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Automatically detects bank & UPI transactions to record spendings
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center px-6 pt-2 border-b border-gray-100 dark:border-gray-800 gap-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`pb-2.5 border-b-2 cursor-pointer transition-colors ${
              activeTab === 'settings'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Settings & Permissions
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('test')}
            className={`pb-2.5 border-b-2 cursor-pointer transition-colors ${
              activeTab === 'test'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Test SMS Parser
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`pb-2.5 border-b-2 cursor-pointer transition-colors flex items-center gap-1.5 ${
              activeTab === 'logs'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <span>Activity Log</span>
            {logs.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                {logs.length}
              </span>
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {activeTab === 'settings' && (
            <>
              {/* Privacy & Security Guarantee Banner */}
              <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>100% On-Device Privacy Guaranteed</span>
                </div>
                <p className="text-emerald-700/90 dark:text-emerald-400/90 leading-relaxed text-[11px]">
                  All SMS processing happens locally on your Android phone. No SMS text or financial details ever leave your device or reach any server. Unrelated SMS messages (OTPs, personal chats, promotional ads) are immediately ignored and never logged.
                </p>
              </div>

              {/* Main Toggle Switch */}
              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                      Automatic SMS Expense Detection
                    </span>
                    {enabled && (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Instantly create spending records whenever a bank debit, card purchase, or UPI confirmation SMS arrives.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleEnable}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    enabled ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Permission Status & Action */}
              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-gray-500" />
                    <span className="text-xs font-bold text-gray-900 dark:text-white">
                      Android SMS Permission
                    </span>
                  </div>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      permissionStatus === 'granted'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}
                  >
                    {permissionStatus === 'granted' ? 'Permission Granted' : 'Permission Required'}
                  </span>
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Requires <code className="text-[11px] bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">RECEIVE_SMS</code> and <code className="text-[11px] bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">READ_SMS</code> to detect incoming transaction messages in the background and verify against duplicate alerts.
                </p>

                {permissionStatus !== 'granted' && (
                  <button
                    type="button"
                    onClick={handleRequestPermission}
                    className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Grant SMS Permission</span>
                  </button>
                )}
              </div>

              {/* Duplicate Prevention Guarantee */}
              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-900 dark:text-white">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span>Smart Duplicate Protection</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Banks often send repeated SMS notifications for the same transaction (e.g. from bank and UPI app). The auto-logger matches reference numbers, timestamps, amounts, and merchant fingerprints to guarantee zero duplicate spending entries.
                </p>
              </div>

              {/* Historical Inbox Scan Action */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Import recent unlogged transactions from your SMS inbox:
                </div>
                <button
                  type="button"
                  onClick={handleScanInbox}
                  disabled={isScanning}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                  <span>{isScanning ? 'Scanning Inbox...' : 'Scan Recent Bank SMS'}</span>
                </button>
              </div>

              {scanMessage && (
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs">
                  {scanMessage}
                </div>
              )}
            </>
          )}

          {activeTab === 'test' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Choose a Sample Bank SMS or Type Your Own:
                </span>
              </div>

              {/* Presets Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {SAMPLE_BANK_SMS.map((sample, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      Sound.click(soundEnabled);
                      setTestSmsText(sample.text);
                      setTestSender(sample.sender);
                      setTestResult(null);
                    }}
                    className={`p-2 rounded-lg text-left text-[11px] font-medium transition-all border ${
                      testSmsText === sample.text
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300'
                        : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <p className="truncate font-semibold">{sample.title}</p>
                    <span className="text-[10px] text-gray-400">[{sample.sender}]</span>
                  </button>
                ))}
              </div>

              {/* Custom Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <label htmlFor="test-sender-input">Sender ID:</label>
                  <input
                    id="test-sender-input"
                    type="text"
                    value={testSender}
                    onChange={(e) => setTestSender(e.target.value)}
                    className="px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700 text-xs bg-transparent dark:text-white w-28"
                    placeholder="e.g. HDFCBK"
                  />
                </div>
                <textarea
                  value={testSmsText}
                  onChange={(e) => setTestSmsText(e.target.value)}
                  rows={3}
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs text-gray-900 dark:text-gray-100 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 font-mono"
                  placeholder="Paste bank or transaction SMS text here..."
                />
              </div>

              <button
                type="button"
                onClick={handleRunTest}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm"
              >
                <Sparkles className="w-4 h-4" />
                <span>Parse SMS & Auto-Log Entry</span>
              </button>

              {/* Test Output Card */}
              {testResult && (
                <div
                  className={`p-4 rounded-xl border text-xs space-y-2.5 ${
                    testResult.status === 'logged'
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800'
                      : testResult.status === 'duplicate_skipped'
                      ? 'bg-amber-50/70 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800'
                      : 'bg-rose-50/70 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5">
                      {testResult.status === 'logged' && (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span className="text-emerald-800 dark:text-emerald-300">
                            Transaction Successfully Auto-Logged
                          </span>
                        </>
                      )}
                      {testResult.status === 'duplicate_skipped' && (
                        <>
                          <AlertCircle className="w-4 h-4 text-amber-600" />
                          <span className="text-amber-800 dark:text-amber-300">
                            Duplicate Skipped (Already Present)
                          </span>
                        </>
                      )}
                      {testResult.status === 'ignored_not_financial' && (
                        <>
                          <Info className="w-4 h-4 text-rose-600" />
                          <span className="text-rose-800 dark:text-rose-300">
                            Ignored (Not a Financial Transaction)
                          </span>
                        </>
                      )}
                    </span>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-black/10 dark:bg-white/10 font-bold">
                      {testResult.status}
                    </span>
                  </div>

                  {testResult.reason && (
                    <p className="text-[11px] opacity-80 italic">{testResult.reason}</p>
                  )}

                  {testResult.parsed.isTransaction && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-black/10 dark:border-white/10 text-[11px]">
                      <div>
                        <span className="text-gray-400 block text-[10px]">Amount:</span>
                        <span className="font-bold">
                          {testResult.parsed.currency} {testResult.parsed.amount.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[10px]">Merchant / Payee:</span>
                        <span className="font-bold">{testResult.parsed.merchant}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[10px]">Category:</span>
                        <span className="font-bold">{testResult.parsed.category}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[10px]">Type / Method:</span>
                        <span className="font-bold">
                          {testResult.parsed.type.toUpperCase()} • {testResult.parsed.paymentMethod}
                        </span>
                      </div>
                      {testResult.parsed.bankOrAccount && (
                        <div>
                          <span className="text-gray-400 block text-[10px]">Bank / Account:</span>
                          <span className="font-medium">{testResult.parsed.bankOrAccount}</span>
                        </div>
                      )}
                      {testResult.parsed.referenceId && (
                        <div>
                          <span className="text-gray-400 block text-[10px]">Reference ID:</span>
                          <span className="font-mono text-[10px]">{testResult.parsed.referenceId}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-400 block text-[10px]">Date:</span>
                        <span>{testResult.parsed.date} {testResult.parsed.time || ''}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 dark:text-gray-400">
                  History of processed incoming SMS messages:
                </span>
                {logs.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearLogs}
                    className="text-rose-500 hover:text-rose-600 flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Logs</span>
                  </button>
                )}
              </div>

              {logs.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-gray-200 dark:border-gray-800 rounded-xl space-y-2">
                  <Inbox className="w-8 h-8 text-gray-400 mx-auto" />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    No SMS messages processed yet. Incoming messages will be automatically logged here.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              log.status === 'logged'
                                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                                : log.status === 'duplicate_skipped'
                                ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                                : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                            }`}
                          >
                            {log.status === 'logged'
                              ? '✓ Auto-Logged'
                              : log.status === 'duplicate_skipped'
                              ? 'ℹ Duplicate Skipped'
                              : '✕ Ignored'}
                          </span>
                          {log.sender && (
                            <span className="font-mono text-[10px] text-gray-400">
                              [{log.sender}]
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-400">
                          {new Date(log.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      {log.parsed && (
                        <div className="flex items-center gap-2 font-semibold text-gray-800 dark:text-gray-200">
                          <span>₹{log.parsed.amount.toLocaleString()}</span>
                          <span>•</span>
                          <span>{log.parsed.merchant}</span>
                          <span>•</span>
                          <span className="text-gray-500 text-[11px]">{log.parsed.category}</span>
                        </div>
                      )}

                      {log.reason && (
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 italic">
                          {log.reason}
                        </p>
                      )}

                      <p className="text-[10px] font-mono text-gray-400 dark:text-gray-500 truncate">
                        "{log.rawSms}"
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-[#111827]/50">
          <span className="text-[11px] text-gray-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Private & Local on Android</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer"
          >
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
};
