// Load environment variables
require('dotenv').config({ path: '.env.local' })

const { Stripe } = require('stripe')
const { createClient } = require('@supabase/supabase-js')

// Check if environment variables are loaded
if (!process.env.STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY not found in environment variables')
  process.exit(1)
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL not found in environment variables')
  process.exit(1)
}

if (!process.env.SUPABASE_SECRET_KEY) {
  console.error('❌ SUPABASE_SECRET_KEY not found in environment variables')
  process.exit(1)
}

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

async function syncStripeProducts() {
  console.log('🔄 Starting Stripe products sync...')
  
  try {
    // Fetch all products from Stripe
    const products = await stripe.products.list({ active: true })
    console.log(`📦 Found ${products.data.length} products in Stripe`)
    
    for (const product of products.data) {
      console.log(`\n🔄 Processing: ${product.name}`)
      
      // Get the first price for this product (assuming one price per product)
      const prices = await stripe.prices.list({ product: product.id, active: true })
      const price = prices.data[0]
      
      if (!price) {
        console.log(`⚠️  No active price found for ${product.name}, skipping...`)
        continue
      }
      
      // Determine session date based on product name
      let sessionDate
      if (product.name.includes('High School')) {
        sessionDate = '2024-10-15' // Mid-October for High School
      } else if (product.name.includes('Middle School')) {
        sessionDate = '2024-10-22' // Late October for Middle School
      } else {
        sessionDate = '2024-10-31' // Default to end of October
      }
      
      // Check if product already exists in our database
      const { data: existingProduct } = await supabase
        .from('products')
        .select('id')
        .eq('stripe_product_id', product.id)
        .single()
      
      if (existingProduct) {
        console.log(`✅ Product already exists, updating...`)
        
        // Update existing product
        const { error: updateError } = await supabase
          .from('products')
          .update({
            name: product.name,
            description: product.description,
            price_cents: price.unit_amount || 0,
            currency: price.currency,
            session_date: sessionDate,
            stock_quantity: 10, // Set initial stock
            is_active: product.active,
            updated_at: new Date().toISOString()
          })
          .eq('stripe_product_id', product.id)
        
        if (updateError) {
          console.error(`❌ Error updating ${product.name}:`, updateError)
        } else {
          console.log(`✅ Updated ${product.name}`)
        }
      } else {
        console.log(`➕ Creating new product...`)
        
        // Create new product
        const { error: insertError } = await supabase
          .from('products')
          .insert({
            stripe_product_id: product.id,
            stripe_price_id: price.id,
            name: product.name,
            description: product.description,
            price_cents: price.unit_amount || 0,
            currency: price.currency,
            session_date: sessionDate,
            stock_quantity: 10, // Set initial stock
            is_active: product.active
          })
        
        if (insertError) {
          console.error(`❌ Error creating ${product.name}:`, insertError)
        } else {
          console.log(`✅ Created ${product.name}`)
        }
      }
    }
    
    console.log('\n🎉 Sync completed successfully!')
    
    // Show summary
    const { data: allProducts } = await supabase
      .from('products')
      .select('name, stock_quantity, session_date')
      .order('session_date')
    
    console.log('\n📊 Current products in database:')
    allProducts?.forEach(product => {
      console.log(`  • ${product.name} - Stock: ${product.stock_quantity}, Session: ${product.session_date}`)
    })
    
  } catch (error) {
    console.error('❌ Sync failed:', error)
    process.exit(1)
  }
}

// Run the sync
syncStripeProducts()
