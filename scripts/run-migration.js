// Run the rebrand migration on Supabase
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl)
  console.error('SUPABASE_SECRET_KEY:', !!supabaseServiceKey)
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function runMigration() {
  console.log('🔄 Running rebrand migration...')

  try {
    // Read the migration file
    const migrationPath = join(__dirname, '../supabase/migrations/20251217000000_rebrand_admin_policies.sql')
    const sql = readFileSync(migrationPath, 'utf-8')

    console.log('📄 Migration file loaded')
    console.log('📝 SQL length:', sql.length, 'characters')

    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql })

    if (error) {
      // If exec_sql doesn't exist, we'll need to run each statement separately
      console.log('⚠️  exec_sql RPC not found, running statements individually...')

      // Split SQL into individual statements
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'))

      console.log(`📋 Found ${statements.length} SQL statements to execute`)

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i]
        if (statement.length === 0) continue

        console.log(`\n[${i + 1}/${statements.length}] Executing statement...`)
        console.log('📝', statement.substring(0, 100) + (statement.length > 100 ? '...' : ''))

        const { error: stmtError } = await supabase.rpc('exec_sql', {
          sql_query: statement
        }).catch(async () => {
          // If RPC doesn't work, try using the REST API directly
          const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey,
              'Authorization': `Bearer ${supabaseServiceKey}`
            },
            body: JSON.stringify({ sql_query: statement })
          })

          if (!response.ok) {
            const text = await response.text()
            throw new Error(`HTTP ${response.status}: ${text}`)
          }

          return { data: await response.json(), error: null }
        })

        if (stmtError) {
          console.error('❌ Error executing statement:', stmtError)
          throw stmtError
        }

        console.log('✅ Statement executed successfully')
      }

      console.log('\n✅ All statements executed successfully!')
    } else {
      console.log('✅ Migration executed successfully!')
      if (data) {
        console.log('📊 Result:', data)
      }
    }

    console.log('\n🎉 Migration complete!')
    console.log('✅ Admin policies now support both @thelacrosselab.com and @experimentlacrosse.com')

  } catch (err) {
    console.error('\n❌ Migration failed:', err)
    process.exit(1)
  }
}

runMigration()
