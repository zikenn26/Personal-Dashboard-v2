import { pool } from './db.js';

async function verify() {
  console.log('--- NEON DATABASE STATUS CHECK ---');

  const wsRes = await pool.query(`
    SELECT
      user_identifier,
      user_email,
      jsonb_array_length(workspace_data->'expenses') as expense_count,
      jsonb_array_length(workspace_data->'habits') as habit_count
    FROM workspaces
    ORDER BY user_email, user_identifier
  `);

  console.log('\nWorkspaces in Neon:');
  for (const r of wsRes.rows) {
    console.log(`- Identifier: ${r.user_identifier.padEnd(45)} | Email: ${r.user_email.padEnd(25)} | Expenses: ${String(r.expense_count).padStart(3)} | Habits: ${r.habit_count}`);
  }

  const txRes = await pool.query(`
    SELECT
      user_email,
      COUNT(*) as total_txs,
      SUM(CASE WHEN direction = 'DEBIT' THEN amount ELSE 0 END) as total_debit,
      SUM(CASE WHEN direction = 'CREDIT' THEN amount ELSE 0 END) as total_credit,
      SUM(CASE WHEN direction = 'CREDIT' THEN amount ELSE -amount END) as net_balance
    FROM transactions
    WHERE is_deleted = false
    GROUP BY user_email
    ORDER BY user_email
  `);

  console.log('\nFinancial Totals by Account in Neon:');
  for (const r of txRes.rows) {
    console.log(`- Email: ${r.user_email.padEnd(25)} | Transactions: ${String(r.total_txs).padStart(3)} | Total Debit: ₹${Number(r.total_debit).toFixed(2).padStart(10)} | Total Credit: ₹${Number(r.total_credit).toFixed(2).padStart(10)} | Net: ₹${Number(r.net_balance).toFixed(2)}`);
  }

  const authRes = await pool.query('SELECT COUNT(*) as count FROM expense_authority');
  console.log(`\nExpense Authority rows: ${authRes.rows[0].count}`);

  await pool.end();
}

verify().catch((err) => {
  console.error('Verification error:', err);
  process.exit(1);
});
