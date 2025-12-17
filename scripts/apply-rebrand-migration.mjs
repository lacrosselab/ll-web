// Apply rebrand migration to dev database
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import dotenv from 'dotenv'

// Load .env.local
dotenv.config({ path: '.env.local' })

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY

console.log('🔍 Database:', supabaseUrl)

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function runMigration() {
  console.log('\n🔄 Running rebrand migration on DEV database...')

  try {
    // Read the migration file
    const migrationPath = join(__dirname, '../supabase/migrations/20251217000000_rebrand_admin_policies.sql')
    const sql = readFileSync(migrationPath, 'utf-8')

    console.log('📄 Migration file loaded (' + sql.length + ' characters)\n')

    // Split into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    console.log(`📋 Executing ${statements.length} SQL statements...\n`)

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';'

      // Get a preview of the statement
      const preview = statement.substring(0, 80).replace(/\s+/g, ' ')
      console.log(`[${i + 1}/${statements.length}] ${preview}...`)

      const { error } = await supabase.rpc('exec_sql', { sql: statement })

      if (error) {
        console.error('❌ Error:', error.message)
        throw error
      }

      console.log('   ✅ Success')
    }

    console.log('\n✨ Migration completed successfully!')
    console.log('✅ Admin policies now support both @thelacrosselab.com and @experimentlacrosse.com\n')

  } catch (err) {
    console.error('\n❌ Migration failed:', err.message)
    console.error('\n💡 You may need to run this SQL manually in the Supabase dashboard.')
    process.exit(1)
  }
}

runMigration()
