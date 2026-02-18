const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');

const MIGRATION_RELATIVE_PATH =
  'supabase/migrations/20260214000000_create_journal_entries.sql';

function loadEnvFile(envFilePath) {
  if (!fs.existsSync(envFilePath)) {
    return;
  }

  const text = fs.readFileSync(envFilePath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function rewriteMigrationSql(sql) {
  let nextSql = sql.replace(/\r\n/g, '\n');

  const triggerBlockPattern =
    /create trigger journal_entries_set_updated_at[\s\S]*?execute function public\.set_journal_entries_updated_at\(\);/i;
  if (
    triggerBlockPattern.test(nextSql) &&
    !/drop trigger if exists journal_entries_set_updated_at/i.test(nextSql)
  ) {
    nextSql = nextSql.replace(
      triggerBlockPattern,
      `drop trigger if exists journal_entries_set_updated_at on public.journal_entries;

create trigger journal_entries_set_updated_at
    before update on public.journal_entries
    for each row
    execute function public.set_journal_entries_updated_at();`
    );
  }

  const rlsPoliciesPattern =
    /alter table public\.journal_entries enable row level security;[\s\S]*$/i;

  if (rlsPoliciesPattern.test(nextSql)) {
    nextSql = nextSql.replace(
      rlsPoliciesPattern,
      'alter table public.journal_entries disable row level security;\n'
    );
  } else if (
    !/alter table public\.journal_entries disable row level security;/i.test(nextSql)
  ) {
    nextSql = `${nextSql.trim()}\n\nalter table public.journal_entries disable row level security;\n`;
  }

  return `${nextSql.trim()}\n`;
}

async function executeSqlViaRpc(supabase, sql) {
  const attempts = [
    { fn: 'exec_sql', args: { query: sql } },
    { fn: 'exec_sql', args: { sql } },
    { fn: 'run_sql', args: { query: sql } },
    { fn: 'run_sql', args: { sql } },
    { fn: 'sql', args: { query: sql } },
    { fn: 'sql', args: { sql } },
  ];

  for (const attempt of attempts) {
    const { error } = await supabase.rpc(attempt.fn, attempt.args);
    if (!error) {
      return { method: `rpc:${attempt.fn}` };
    }

    const isNotFound =
      error.code === 'PGRST202' ||
      error.code === '42883' ||
      /could not find the function/i.test(error.message || '');

    if (!isNotFound) {
      throw new Error(
        `RPC execution failed via ${attempt.fn}: ${error.code || 'unknown'} ${error.message || ''}`.trim()
      );
    }
  }

  return null;
}

async function executeSqlViaProjectEndpoint(supabaseUrl, serviceRoleKey, sql) {
  const paths = ['/pg/v1/query', '/sql/v1', '/sql/v1/query'];
  const endpointErrors = [];

  for (const endpointPath of paths) {
    const response = await fetch(`${supabaseUrl}${endpointPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ query: sql }),
    });

    if (response.ok) {
      return { method: `project-endpoint:${endpointPath}` };
    }

    if (response.status === 404) {
      continue;
    }

    const body = await response.text();
    endpointErrors.push(`${endpointPath}: ${response.status} ${body.slice(0, 160)}`);
  }

  if (endpointErrors.length > 0) {
    throw new Error(`Project SQL endpoint failed: ${endpointErrors.join(' | ')}`);
  }

  return null;
}

async function executeSqlViaManagementApi(supabaseUrl, sql) {
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  if (!accessToken) {
    return null;
  }

  const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Management API SQL execution failed (${response.status}): ${body.slice(0, 200)}`
    );
  }

  return { method: 'management-api:database/query' };
}

async function verifyJournalEntriesTable(supabase) {
  const { error } = await supabase
    .from('journal_entries')
    .select('id')
    .limit(1);

  if (error) {
    throw new Error(
      `journal_entries verification failed: ${error.code || 'unknown'} ${error.message || ''}`.trim()
    );
  }
}

async function probeAnonInsertAndCleanup(supabaseUrl, anonKey, serviceClient) {
  if (!anonKey) {
    return { checked: false, disabledLikely: null };
  }

  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const txSignature = `setup_probe_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const probeRow = {
    user_wallet: 'WHALE_WALLET',
    tx_signature: txSignature,
    rating: 3,
    tags: [],
    notes: {},
    screenshot_url: null,
  };

  const { error: insertError } = await anonClient
    .from('journal_entries')
    .insert(probeRow);

  if (insertError) {
    return {
      checked: true,
      disabledLikely: false,
      reason: `${insertError.code || 'unknown'} ${insertError.message || ''}`.trim(),
    };
  }

  const { error: deleteError } = await serviceClient
    .from('journal_entries')
    .delete()
    .eq('tx_signature', txSignature);

  if (deleteError) {
    console.warn(
      `[WARN] Probe row cleanup failed: ${deleteError.code || 'unknown'} ${deleteError.message || ''}`.trim()
    );
  }

  return { checked: true, disabledLikely: true };
}

async function main() {
  const repoRoot = path.resolve(__dirname, '..');
  loadEnvFile(path.join(repoRoot, '.env.local'));

  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const migrationPath = path.join(repoRoot, MIGRATION_RELATIVE_PATH);
  if (!fs.existsSync(migrationPath)) {
    throw new Error(`Migration file not found: ${migrationPath}`);
  }

  const originalSql = fs.readFileSync(migrationPath, 'utf8');
  const modifiedSql = rewriteMigrationSql(originalSql);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  console.log('[INFO] Loaded migration SQL and applied development RLS rewrite.');

  let executionResult = null;
  executionResult = await executeSqlViaRpc(supabase, modifiedSql);
  if (!executionResult) {
    executionResult = await executeSqlViaProjectEndpoint(
      supabaseUrl,
      serviceRoleKey,
      modifiedSql
    );
  }
  if (!executionResult) {
    executionResult = await executeSqlViaManagementApi(supabaseUrl, modifiedSql);
  }

  await verifyJournalEntriesTable(supabase);
  const rlsProbe = await probeAnonInsertAndCleanup(supabaseUrl, anonKey, supabase);

  if (executionResult) {
    console.log(`[OK] Migration SQL executed via ${executionResult.method}.`);
  } else {
    console.log(
      '[WARN] No SQL execution endpoint available for service role key in this project. Verified existing table state instead.'
    );
  }

  if (rlsProbe.checked && rlsProbe.disabledLikely === true) {
    console.log('[OK] RLS appears disabled for development (anon insert probe succeeded).');
  } else if (rlsProbe.checked && rlsProbe.disabledLikely === false) {
    throw new Error(
      `RLS may still be enabled or insert is blocked for anon access: ${rlsProbe.reason || 'unknown reason'}`
    );
  } else {
    console.log('[WARN] Skipped anon insert probe because NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured.');
  }

  console.log('[SUCCESS] journal_entries setup is complete.');
}

main().catch((error) => {
  console.error(`[ERROR] ${error.message}`);
  process.exitCode = 1;
});
