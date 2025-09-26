// Test script to check user sync status
// Run this with: node scripts/test-user-sync.js

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables:')
  console.error('- NEXT_PUBLIC_SUPABASE_URL:', !!process.env.NEXT_PUBLIC_SUPABASE_URL)
  console.error('- SUPABASE_SECRET_KEY:', !!process.env.SUPABASE_SECRET_KEY)
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testUserSync() {
  try {
    console.log('🔍 Checking user sync status...\n')
    
    // Get auth users
    console.log('📡 Fetching auth users...')
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()
    if (authError) {
      console.error('❌ Error fetching auth users:', authError.message)
      return
    }
    
    // Get public users
    console.log('📡 Fetching public users...')
    const { data: publicUsers, error: publicError } = await supabase
      .from('users')
      .select('id, email, created_at')
    if (publicError) {
      console.error('❌ Error fetching public users:', publicError.message)
      return
    }
    
    console.log(`📊 Auth users: ${authUsers.users.length}`)
    console.log(`📊 Public users: ${publicUsers.length}`)
    
    // Find missing users
    const authUserIds = new Set(authUsers.users.map(u => u.id))
    const publicUserIds = new Set(publicUsers.map(u => u.id))
    const missingUsers = authUsers.users.filter(u => !publicUserIds.has(u.id))
    
    console.log(`❌ Missing users: ${missingUsers.length}`)
    
    if (missingUsers.length > 0) {
      console.log('\n🔍 Missing users:')
      missingUsers.forEach(user => {
        console.log(`  - ${user.email} (${user.id})`)
        console.log(`    Created: ${new Date(user.created_at).toLocaleString()}`)
      })
      
      console.log('\n💡 To fix this, run the migration:')
      console.log('   supabase db push')
    } else {
      console.log('\n✅ All users are synced!')
    }
    
    // Check if trigger exists
    console.log('\n🔧 Checking trigger status...')
    const { data: triggers, error: triggerError } = await supabase
      .rpc('check_trigger_exists', { trigger_name: 'on_auth_user_created' })
    
    if (triggerError) {
      console.log('⚠️  Could not check trigger status (this is normal)')
    } else {
      console.log('✅ Trigger check completed')
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error('Stack:', error.stack)
  }
}

testUserSync()
