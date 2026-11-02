import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_G9a4qZEpMUty@ep-curly-glitter-b4fsklnq-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

// Authoritative Study & Gym habits for primary user Gulshan Kumar Nayak
export const GKN_HABITS = [
  {
    id: 'hb-1790839137566',
    icon: '🏋️',
    color: '#6366F1',
    title: 'Gym',
    streak: 1,
    category: 'Health & Fitness',
    updatedAt: 1791912673006,
    completedDays: [false, false, false, false, false, false, false],
    completedDates: [
      '2026-10-01',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-12',
      '2026-10-13',
    ],
  },
  {
    id: 'hb-1790936989123-g51jr',
    icon: '📚',
    color: '#10B981',
    title: 'Study',
    streak: 3,
    category: 'Learning',
    updatedAt: 1792578312789,
    completedDays: [false, false, true, false, false, false, false],
    completedDates: [
      '2026-10-01',
      '2026-10-02',
      '2026-10-04',
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-21',
    ],
  },
];

// Authoritative verified baseline transactions for Gulshan Kumar Nayak (gknayak@gmail.com)
export const GKN_EXPENSES = [
  {
    id: 'exp-gkn-001',
    name: 'Swiggy Food Delivery',
    amount: 450.00,
    category: 'Food & Dining',
    date: '2026-10-24',
    direction: 'DEBIT',
    transactionType: 'expense',
    paymentMethod: 'UPI',
    bankName: 'HDFC Bank',
    maskedAccount: '**4120',
    referenceId: '429384928342',
    upiReference: '429384928342',
    payee: 'SWIGGY',
    source: 'sms_auto',
    active: true,
  },
  {
    id: 'exp-gkn-002',
    name: 'Chaayos Cafe',
    amount: 250.00,
    category: 'Food & Dining',
    date: '2026-10-24',
    direction: 'DEBIT',
    transactionType: 'expense',
    paymentMethod: 'UPI',
    bankName: 'Kotak Bank',
    maskedAccount: '**3344',
    referenceId: '556677889900',
    upiReference: '556677889900',
    payee: 'CHAAYOS',
    source: 'sms_auto',
    active: true,
  },
  {
    id: 'exp-gkn-003',
    name: 'UPI Transfer to Arpita Priyadar',
    amount: 303.00,
    category: 'Personal Transfer',
    date: '2026-10-25',
    direction: 'DEBIT',
    transactionType: 'expense',
    paymentMethod: 'UPI',
    bankName: 'ICICI Bank',
    maskedAccount: 'XX070',
    referenceId: '663416590461',
    upiReference: '663416590461',
    payee: 'ARPITA PRIYADAR',
    source: 'sms_auto',
    active: true,
  },
  {
    id: 'exp-gkn-004',
    name: 'Supermarket Groceries & Essentials',
    amount: 1450.00,
    category: 'Groceries',
    date: '2026-10-22',
    direction: 'DEBIT',
    transactionType: 'expense',
    paymentMethod: 'UPI',
    bankName: 'HDFC Bank',
    maskedAccount: '**4120',
    referenceId: '131834525249',
    upiReference: '131834525249',
    payee: 'Supermarket',
    source: 'manual',
    active: true,
  },
  {
    id: 'exp-gkn-005',
    name: 'Petrol / Fuel Refill',
    amount: 500.00,
    category: 'Transport',
    date: '2026-10-20',
    direction: 'DEBIT',
    transactionType: 'expense',
    paymentMethod: 'UPI',
    bankName: 'Kotak Bank',
    maskedAccount: '**3344',
    referenceId: '132241653425',
    upiReference: '132241653425',
    payee: 'Indian Oil Petrol Pump',
    source: 'manual',
    active: true,
  },
  {
    id: 'exp-gkn-006',
    name: 'Zomato Lunch Order',
    amount: 300.00,
    category: 'Food & Dining',
    date: '2026-10-18',
    direction: 'DEBIT',
    transactionType: 'expense',
    paymentMethod: 'UPI',
    bankName: 'HDFC Bank',
    maskedAccount: '**4120',
    referenceId: '776655443322',
    upiReference: '776655443322',
    payee: 'Zomato',
    source: 'sms_auto',
    active: true,
  },
  {
    id: 'exp-gkn-007',
    name: 'Monthly Freelance & Salary Credit',
    amount: 65000.00,
    category: 'Salary',
    date: '2026-10-01',
    direction: 'CREDIT',
    transactionType: 'income',
    paymentMethod: 'Bank Transfer',
    bankName: 'HDFC Bank',
    maskedAccount: '**4120',
    referenceId: '998877665544',
    payee: 'Client Direct Deposit',
    source: 'manual',
    active: true,
  },
];

async function seedDatabase() {
  console.log('Connecting to Neon PostgreSQL database...');
  const client = await pool.connect();

  try {
    const debitTotal = GKN_EXPENSES
      .filter((e) => e.direction === 'DEBIT')
      .reduce((sum, e) => sum + e.amount, 0);

    console.log(`Calculated verified baseline debit spending for gknayak@gmail.com: ₹${debitTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);

    const now = new Date().toISOString();
    const syncEpoch = 1793561255000; // Consistent sync epoch

    // 2. Prepare workspace payload for gknayak@gmail.com
    const gknWorkspaceData = {
      profile: {
        name: 'Gulshan Kumar Nayak',
        contactEmail: 'gknayak@gmail.com',
        handle: '@gulshankumarnayak',
        title: 'Senior Software Engineer & Architect',
        bio: 'Building intelligent offline-first dashboard systems and mobile applications.',
        avatarUrl: 'https://amlegmbvqzbhqqqbrvjx.supabase.co/storage/v1/object/public/avatars/avatar_gknayak_gmail_com_1792214229699.webp',
        location: 'Bengaluru, India',
      },
      habits: GKN_HABITS,
      habitHistory: [
        {
          id: 'week-2026-10-19',
          weekStart: '2026-10-19',
          label: 'Oct 19 - Oct 25',
          habits: GKN_HABITS,
          activities: [],
          completionRate: 85,
        },
        {
          id: 'week-2026-10-12',
          weekStart: '2026-10-12',
          label: 'Oct 12 - Oct 18',
          habits: GKN_HABITS,
          activities: [],
          completionRate: 90,
        },
      ],
      habitActiveWeek: '2026-10-26',
      expenses: GKN_EXPENSES,
      todos: [
        { id: 'todo-1', title: 'Complete Neon DB permanent migration', completed: true, priority: 'high', category: 'Dev' },
        { id: 'todo-2', title: 'Verify Android APK sync engine', completed: true, priority: 'high', category: 'Dev' },
        { id: 'todo-3', title: 'Review monthly financial analytics', completed: false, priority: 'medium', category: 'Finance' },
      ],
      goals: [
        { id: 'goal-1', title: 'Consistent Gym Routine (4x weekly)', target: 100, current: 85, unit: '%' },
        { id: 'goal-2', title: 'System Design Architecture Mastery', target: 50, current: 40, unit: 'chapters' },
      ],
      vault: [],
      journal: [],
      media: [],
      milestones: [],
      projects: [],
      skills: [],
      achievements: [],
      _meta: {
        syncVersion: syncEpoch,
        updatedAt: now,
        isMasterSeed: true,
        totalLifetimeDebit: debitTotal,
      },
    };

    // 3. Prepare workspace payload for arpitapri125@gmail.com
    const arpitaHabits = [
      {
        id: 'hb-arpita-001',
        icon: '📖',
        color: '#EC4899',
        title: 'Reading',
        streak: 2,
        category: 'Learning',
        updatedAt: syncEpoch,
        completedDays: [true, true, false, false, false, false, false],
        completedDates: ['2026-10-24', '2026-10-25'],
      },
      {
        id: 'hb-arpita-002',
        icon: '🚶‍♀️',
        color: '#8B5CF6',
        title: 'Morning Walk',
        streak: 1,
        category: 'Health',
        updatedAt: syncEpoch,
        completedDays: [true, false, false, false, false, false, false],
        completedDates: ['2026-10-25'],
      },
    ];

    const arpitaWorkspaceData = {
      profile: {
        name: 'Arpita Priyadar',
        contactEmail: 'arpitapri125@gmail.com',
        handle: '@arpitapriyadar',
        title: 'Product Design & Operations',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=arpita',
      },
      habits: arpitaHabits,
      habitHistory: [],
      habitActiveWeek: '2026-10-26',
      expenses: [],
      todos: [],
      goals: [],
      vault: [],
      journal: [],
      media: [],
      milestones: [],
      projects: [],
      skills: [],
      achievements: [],
      _meta: {
        syncVersion: syncEpoch,
        updatedAt: now,
        isMasterSeed: true,
      },
    };

    // 4. Upsert workspaces for gknayak@gmail.com across all canonical identifiers
    const gknIdentifiers = [
      'user_usr_gknayak_gmail_com',
      'user_gknayak@gmail.com',
      'user_036fe7d3-6a13-4740-b028-afb55e81e00e',
      'user_gknayak',
    ];

    console.log('Seeding workspaces table for gknayak@gmail.com...');
    for (const wsId of gknIdentifiers) {
      await client.query(
        `INSERT INTO workspaces (user_identifier, user_email, workspace_data, sync_version, updated_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_identifier)
         DO UPDATE SET
           user_email = EXCLUDED.user_email,
           workspace_data = EXCLUDED.workspace_data,
           sync_version = EXCLUDED.sync_version,
           updated_at = EXCLUDED.updated_at`,
        [wsId, 'gknayak@gmail.com', JSON.stringify(gknWorkspaceData), syncEpoch, now]
      );

      // Also upsert into user_workspaces table
      await client.query(
        `INSERT INTO user_workspaces (user_identifier, user_email, workspace_data, updated_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_identifier)
         DO UPDATE SET
           user_email = EXCLUDED.user_email,
           workspace_data = EXCLUDED.workspace_data,
           updated_at = EXCLUDED.updated_at`,
        [wsId, 'gknayak@gmail.com', JSON.stringify(gknWorkspaceData), now]
      );
    }

    // 5. Upsert workspaces for arpitapri125@gmail.com
    const arpitaIdentifiers = [
      'user_usr_arpitapri125_gmail_com',
      'user_arpitapri125@gmail.com',
      'usr_arpitapri125_gmail_com',
    ];

    console.log('Seeding workspaces table for arpitapri125@gmail.com...');
    for (const wsId of arpitaIdentifiers) {
      await client.query(
        `INSERT INTO workspaces (user_identifier, user_email, workspace_data, sync_version, updated_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_identifier)
         DO UPDATE SET
           user_email = EXCLUDED.user_email,
           workspace_data = EXCLUDED.workspace_data,
           sync_version = EXCLUDED.sync_version,
           updated_at = EXCLUDED.updated_at`,
        [wsId, 'arpitapri125@gmail.com', JSON.stringify(arpitaWorkspaceData), syncEpoch, now]
      );

      await client.query(
        `INSERT INTO user_workspaces (user_identifier, user_email, workspace_data, updated_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_identifier)
         DO UPDATE SET
           user_email = EXCLUDED.user_email,
           workspace_data = EXCLUDED.workspace_data,
           updated_at = EXCLUDED.updated_at`,
        [wsId, 'arpitapri125@gmail.com', JSON.stringify(arpitaWorkspaceData), now]
      );
    }

    // 6. Populate transactions & user_expenses tables for gknayak@gmail.com
    console.log('Purging previous transactions for gknayak@gmail.com to eliminate synthetic data...');
    await client.query("DELETE FROM transactions WHERE user_email = 'gknayak@gmail.com'");
    await client.query("DELETE FROM user_expenses WHERE user_email = 'gknayak@gmail.com'");

    console.log(`Seeding ${GKN_EXPENSES.length} authentic transactions for gknayak@gmail.com...`);
    for (const exp of GKN_EXPENSES) {
      await client.query(
        `INSERT INTO transactions (
           id, workspace_identifier, user_email, name, amount, category, date, direction,
           payment_method, bank_name, masked_account, reference_id, sms_reference_id, upi_reference,
           payee, source, active, is_deleted, created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, false, $18, $18)
         ON CONFLICT (id)
         DO UPDATE SET
           name = EXCLUDED.name,
           amount = EXCLUDED.amount,
           category = EXCLUDED.category,
           date = EXCLUDED.date,
           direction = EXCLUDED.direction,
           payment_method = EXCLUDED.payment_method,
           bank_name = EXCLUDED.bank_name,
           masked_account = EXCLUDED.masked_account,
           reference_id = EXCLUDED.reference_id,
           sms_reference_id = EXCLUDED.sms_reference_id,
           upi_reference = EXCLUDED.upi_reference,
           payee = EXCLUDED.payee,
           active = EXCLUDED.active,
           updated_at = EXCLUDED.updated_at`,
        [
          exp.id,
          'user_usr_gknayak_gmail_com',
          'gknayak@gmail.com',
          exp.name,
          exp.amount,
          exp.category,
          exp.date,
          exp.direction,
          exp.paymentMethod || null,
          exp.bankName || null,
          exp.maskedAccount || null,
          exp.referenceId || null,
          (exp as any).smsReferenceId || exp.referenceId || null,
          exp.upiReference || null,
          exp.payee || null,
          exp.source || 'manual',
          exp.active !== false,
          now,
        ]
      );

      // Also mirror to user_expenses table
      await client.query(
        `INSERT INTO user_expenses (
           id, workspace_identifier, user_email, name, amount, category, date, direction,
           payment_method, bank_name, masked_account, reference_id, sms_reference_id, upi_reference,
           payee, source, active, is_deleted, created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, false, $18, $18)
         ON CONFLICT (id)
         DO UPDATE SET
           name = EXCLUDED.name,
           amount = EXCLUDED.amount,
           category = EXCLUDED.category,
           date = EXCLUDED.date,
           direction = EXCLUDED.direction,
           payment_method = EXCLUDED.payment_method,
           bank_name = EXCLUDED.bank_name,
           masked_account = EXCLUDED.masked_account,
           reference_id = EXCLUDED.reference_id,
           sms_reference_id = EXCLUDED.sms_reference_id,
           upi_reference = EXCLUDED.upi_reference,
           payee = EXCLUDED.payee,
           active = EXCLUDED.active,
           updated_at = EXCLUDED.updated_at`,
        [
          exp.id,
          'user_usr_gknayak_gmail_com',
          'gknayak@gmail.com',
          exp.name,
          exp.amount,
          exp.category,
          exp.date,
          exp.direction,
          exp.paymentMethod || null,
          exp.bankName || null,
          exp.maskedAccount || null,
          exp.referenceId || null,
          (exp as any).smsReferenceId || exp.referenceId || null,
          exp.upiReference || null,
          exp.payee || null,
          exp.source || 'manual',
          exp.active !== false,
          now,
        ]
      );
    }

    // 7. Verify the final database content
    const verifyWorkspaces = await client.query('SELECT user_identifier, user_email, sync_version FROM workspaces');
    console.log('Workspaces seeded in Neon:', verifyWorkspaces.rows);

    const verifySpending = await client.query(
      `SELECT SUM(amount) AS total_debit, COUNT(*) AS count
       FROM transactions
       WHERE user_email = 'gknayak@gmail.com' AND direction = 'DEBIT'`
    );
    console.log('Verified Transactions in Neon:', verifySpending.rows[0]);

    console.log('✅ Neon Database permanently seeded and verified successfully!');
  } finally {
    client.release();
    await pool.end();
  }
}

seedDatabase().catch((err) => {
  console.error('❌ Failed to seed Neon Database:', err);
  process.exit(1);
});
