-- Research foundation. Public-domain SEC data only.
--
-- Keyed on CIK, never ticker. Tickers get reassigned; CIK does not.
-- Quotes and candles are not stored here — they stay in the memory cache.
--
-- Apply from the Supabase SQL editor or CLI after the project exists.
-- RLS is enabled with no anon policies: nothing is public until auth lands.

create table if not exists companies (
  cik text primary key,
  ticker text not null,
  name text not null,
  exchange text,
  sic text,
  sic_description text,
  entity_type text,
  state_of_incorporation text,
  fiscal_year_end text,
  website text,
  ein text,
  former_names jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint companies_cik_padded check (cik ~ '^[0-9]{10}$')
);

create table if not exists ticker_aliases (
  id bigint generated always as identity primary key,
  cik text not null references companies (cik) on delete cascade,
  ticker text not null,
  is_current boolean not null default false,
  source text not null,
  valid_from date,
  valid_to date,
  created_at timestamptz not null default now(),
  constraint ticker_aliases_unique unique (cik, ticker)
);

create index if not exists ticker_aliases_ticker_idx on ticker_aliases (ticker);

create table if not exists filings (
  accession_number text primary key,
  cik text not null references companies (cik) on delete cascade,
  form text not null,
  filed_at date,
  accepted_at timestamptz,
  primary_document text,
  filing_url text,
  created_at timestamptz not null default now()
);

create index if not exists filings_cik_filed_idx on filings (cik, filed_at desc);
create index if not exists filings_form_idx on filings (form);

create table if not exists financial_statements (
  id bigint generated always as identity primary key,
  cik text not null references companies (cik) on delete cascade,
  accession_number text references filings (accession_number) on delete set null,
  form text,
  fiscal_year integer,
  fiscal_period text,
  start_date date,
  end_date date,
  statement_type text not null,
  concept text not null,
  label text,
  unit text,
  value numeric,
  created_at timestamptz not null default now(),
  constraint financial_statements_type_check
    check (statement_type in ('balance_sheet', 'income', 'cash_flow')),
  constraint financial_statements_unique
    unique (cik, accession_number, statement_type, concept)
);

create index if not exists financial_statements_cik_period_idx
  on financial_statements (cik, end_date desc);

create table if not exists insider_transactions (
  id bigint generated always as identity primary key,
  cik text not null references companies (cik) on delete cascade,
  accession_number text references filings (accession_number) on delete set null,
  reporter_name text not null,
  reporter_cik text,
  transaction_code text not null,
  is_derivative boolean not null default false,
  share_change numeric,
  shares_held numeric,
  price numeric,
  value numeric,
  transaction_date date,
  filed_at date,
  security_title text,
  created_at timestamptz not null default now()
);

create index if not exists insider_transactions_cik_date_idx
  on insider_transactions (cik, transaction_date desc);
create index if not exists insider_transactions_code_idx
  on insider_transactions (transaction_code);

alter table companies enable row level security;
alter table ticker_aliases enable row level security;
alter table filings enable row level security;
alter table financial_statements enable row level security;
alter table insider_transactions enable row level security;
