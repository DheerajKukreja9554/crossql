// data.jsx — Sample data for CrossQL (fintech / Vegapay-flavored)

const SERVER_HOST = 'vegapay-sandbox-postgres-server.postgres.database.azure.com';

const ENVIRONMENTS = [
  {
    id: 'sandbox',
    label: 'sandbox',
    color: 'var(--env-sandbox)',
    host: 'vegapay-sandbox-postgres-server.postgres.database.azure.com',
    user: 'postgres',
    region: 'ap-south-1',
  },
  {
    id: 'staging',
    label: 'staging',
    color: 'var(--env-staging)',
    host: 'vegapay-staging-postgres-server.postgres.database.azure.com',
    user: 'postgres',
    region: 'ap-south-1',
  },
  {
    id: 'prod',
    label: 'production',
    color: 'var(--env-prod)',
    host: 'vegapay-prod-postgres-server.postgres.database.azure.com',
    user: 'app_readonly',
    region: 'ap-south-1',
    danger: true,
  },
  {
    id: 'dev',
    label: 'dev',
    color: 'var(--env-dev)',
    host: 'vegapay-dev-postgres-server.postgres.database.azure.com',
    user: 'postgres',
    region: 'ap-south-1',
  },
];

// Databases per environment (each has tables + columns)
const DATABASES = [
  {
    name: 'account_management',
    service: 'accounts-service',
    desc: 'Customer accounts, KYC state, limits',
    tables: [
      {
        name: 'accounts', rows: 1_284_902,
        columns: [
          { name: 'account_id', type: 'uuid', pk: true },
          { name: 'customer_id', type: 'uuid', fk: 'on_boarding.customers' },
          { name: 'program_id', type: 'varchar(32)' },
          { name: 'status', type: 'varchar(16)' },
          { name: 'balance_minor', type: 'bigint' },
          { name: 'currency', type: 'char(3)' },
          { name: 'credit_limit_minor', type: 'bigint' },
          { name: 'created_at', type: 'timestamptz' },
          { name: 'updated_at', type: 'timestamptz' },
        ],
      },
      {
        name: 'account_limits', rows: 1_280_114,
        columns: [
          { name: 'account_id', type: 'uuid', pk: true },
          { name: 'daily_limit_minor', type: 'bigint' },
          { name: 'monthly_limit_minor', type: 'bigint' },
          { name: 'atm_limit_minor', type: 'bigint' },
        ],
      },
      {
        name: 'account_holds', rows: 48_221,
        columns: [
          { name: 'hold_id', type: 'uuid', pk: true },
          { name: 'account_id', type: 'uuid' },
          { name: 'amount_minor', type: 'bigint' },
          { name: 'reason', type: 'varchar(64)' },
          { name: 'created_at', type: 'timestamptz' },
        ],
      },
    ],
  },
  {
    name: 'on_boarding',
    service: 'onboarding-service',
    desc: 'Customer onboarding + KYC pipeline',
    tables: [
      {
        name: 'customers', rows: 1_301_443,
        columns: [
          { name: 'customer_id', type: 'uuid', pk: true },
          { name: 'first_name', type: 'varchar(64)' },
          { name: 'last_name', type: 'varchar(64)' },
          { name: 'email', type: 'varchar(128)' },
          { name: 'phone', type: 'varchar(16)' },
          { name: 'country', type: 'char(2)' },
          { name: 'kyc_status', type: 'varchar(16)' },
          { name: 'risk_tier', type: 'varchar(8)' },
          { name: 'created_at', type: 'timestamptz' },
        ],
      },
      {
        name: 'kyc_documents', rows: 3_822_100,
        columns: [
          { name: 'document_id', type: 'uuid', pk: true },
          { name: 'customer_id', type: 'uuid' },
          { name: 'doc_type', type: 'varchar(24)' },
          { name: 'status', type: 'varchar(16)' },
          { name: 'uploaded_at', type: 'timestamptz' },
        ],
      },
      {
        name: 'onboarding_events', rows: 9_440_022,
        columns: [
          { name: 'event_id', type: 'bigint', pk: true },
          { name: 'customer_id', type: 'uuid' },
          { name: 'step', type: 'varchar(32)' },
          { name: 'result', type: 'varchar(16)' },
          { name: 'at', type: 'timestamptz' },
        ],
      },
    ],
  },
  {
    name: 'cards',
    service: 'cards-service',
    desc: 'Issued cards, card programs',
    tables: [
      {
        name: 'cards', rows: 1_120_330,
        columns: [
          { name: 'card_id', type: 'uuid', pk: true },
          { name: 'account_id', type: 'uuid' },
          { name: 'last4', type: 'char(4)' },
          { name: 'brand', type: 'varchar(16)' },
          { name: 'state', type: 'varchar(16)' },
          { name: 'activated_at', type: 'timestamptz' },
          { name: 'expires_on', type: 'date' },
        ],
      },
      {
        name: 'card_programs', rows: 42,
        columns: [
          { name: 'program_id', type: 'varchar(32)', pk: true },
          { name: 'name', type: 'varchar(64)' },
          { name: 'bin', type: 'char(6)' },
          { name: 'currency', type: 'char(3)' },
        ],
      },
    ],
  },
  {
    name: 'ledger',
    service: 'ledger-service',
    desc: 'Authoritative transactions + postings',
    tables: [
      {
        name: 'transactions', rows: 48_221_003,
        columns: [
          { name: 'txn_id', type: 'uuid', pk: true },
          { name: 'account_id', type: 'uuid' },
          { name: 'card_id', type: 'uuid' },
          { name: 'amount_minor', type: 'bigint' },
          { name: 'currency', type: 'char(3)' },
          { name: 'mcc', type: 'char(4)' },
          { name: 'merchant_name', type: 'varchar(64)' },
          { name: 'status', type: 'varchar(16)' },
          { name: 'posted_at', type: 'timestamptz' },
        ],
      },
      {
        name: 'postings', rows: 96_442_007,
        columns: [
          { name: 'posting_id', type: 'bigint', pk: true },
          { name: 'txn_id', type: 'uuid' },
          { name: 'account_id', type: 'uuid' },
          { name: 'direction', type: 'varchar(8)' },
          { name: 'amount_minor', type: 'bigint' },
        ],
      },
      {
        name: 'reversals', rows: 210_442,
        columns: [
          { name: 'reversal_id', type: 'uuid', pk: true },
          { name: 'txn_id', type: 'uuid' },
          { name: 'reason', type: 'varchar(32)' },
          { name: 'at', type: 'timestamptz' },
        ],
      },
    ],
  },
  {
    name: 'rewards',
    service: 'rewards-service',
    desc: 'Points, cashback, campaigns',
    tables: [
      {
        name: 'reward_ledger', rows: 22_110_223,
        columns: [
          { name: 'entry_id', type: 'bigint', pk: true },
          { name: 'customer_id', type: 'uuid' },
          { name: 'points', type: 'integer' },
          { name: 'source', type: 'varchar(24)' },
          { name: 'at', type: 'timestamptz' },
        ],
      },
      {
        name: 'campaigns', rows: 118,
        columns: [
          { name: 'campaign_id', type: 'varchar(32)', pk: true },
          { name: 'name', type: 'varchar(64)' },
          { name: 'multiplier', type: 'numeric(4,2)' },
          { name: 'active', type: 'boolean' },
        ],
      },
    ],
  },
];

// The example query that shows up across the demo
const DEFAULT_QUERY = `-- High-value transactions by risk tier (last 24h, IN customers only)
SELECT
  c.risk_tier,
  c.country,
  COUNT(*)              AS txn_count,
  SUM(t.amount_minor)/100.0 AS total_inr,
  AVG(t.amount_minor)/100.0 AS avg_inr
FROM ledger.transactions AS t
JOIN account_management.accounts AS a
  ON a.account_id = t.account_id
JOIN on_boarding.customers AS c
  ON c.customer_id = a.customer_id
WHERE t.posted_at > NOW() - INTERVAL '24 hours'
  AND t.status = 'posted'
  AND c.country = 'IN'
GROUP BY c.risk_tier, c.country
ORDER BY total_inr DESC;`;

// Pre-baked results table
const RESULT_COLUMNS = [
  { name: 'risk_tier', type: 'varchar', align: 'left' },
  { name: 'country', type: 'char', align: 'left' },
  { name: 'txn_count', type: 'bigint', align: 'right' },
  { name: 'total_inr', type: 'numeric', align: 'right', money: true },
  { name: 'avg_inr', type: 'numeric', align: 'right', money: true },
];

const RESULT_ROWS = [
  ['T0', 'IN', 128_441, 48_229_110.42, 375.51],
  ['T1', 'IN', 312_207, 41_008_552.18, 131.35],
  ['T2', 'IN', 488_101,  28_114_009.77,  57.60],
  ['T3', 'IN', 244_550,  12_995_471.08,  53.14],
  ['T4', 'IN',  62_118,   3_220_118.60,  51.84],
  ['T5', 'IN',  14_220,     401_551.22,  28.24],
];

// Per-DB sub-query stats
const SUBQUERY_STATS = [
  { db: 'ledger', rows: 48_221, scanned: 2_104_288, ms: 412, limit: 50_000 },
  { db: 'account_management', rows: 48_221, scanned: 48_221, ms: 86, limit: 50_000 },
  { db: 'on_boarding', rows: 48_221, scanned: 48_221, ms: 124, limit: 50_000 },
];

// Autocomplete suggestions (contextual to current cursor)
const AUTOCOMPLETE_TABLES_LEDGER = [
  { kind: 'table', name: 'transactions', detail: '48.2M rows · ledger' },
  { kind: 'table', name: 'postings', detail: '96.4M rows · ledger' },
  { kind: 'table', name: 'reversals', detail: '210K rows · ledger' },
];

const PYTHON_CODE = `# 'df' is the merged result. Per-db frames: df_ledger, df_account_management, df_on_boarding
import pandas as pd

pivot = df.pivot_table(
    index='risk_tier',
    values=['txn_count', 'total_inr'],
    aggfunc='sum',
).sort_values('total_inr', ascending=False)

pivot['share_pct'] = (pivot['total_inr'] / pivot['total_inr'].sum() * 100).round(1)
pivot`;

const PYTHON_OUTPUT = [
  ['risk_tier', 'txn_count', 'total_inr',   'share_pct'],
  ['T0',        128441,      48229110.42,   36.7],
  ['T1',        312207,      41008552.18,   31.2],
  ['T2',        488101,      28114009.77,   21.4],
  ['T3',        244550,      12995471.08,    9.9],
  ['T4',         62118,       3220118.60,    2.5],
  ['T5',         14220,        401551.22,    0.3],
];

Object.assign(window, {
  ENVIRONMENTS, DATABASES, DEFAULT_QUERY, RESULT_COLUMNS, RESULT_ROWS,
  SUBQUERY_STATS, AUTOCOMPLETE_TABLES_LEDGER, PYTHON_CODE, PYTHON_OUTPUT,
  SERVER_HOST,
});
