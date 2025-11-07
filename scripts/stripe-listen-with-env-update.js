#!/usr/bin/env node

// Script to run stripe listen and automatically update env files with webhook secret
// This script spawns 'stripe listen' and extracts the webhook secret from its output,
// then updates all environment files (.env.local, .env.production.local, .env.test)

import { spawn } from 'child_process'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const ENV_FILES = ['.env.local', '.env.production.local', '.env.test']
const WEBHOOK_SECRET_PATTERN = /whsec_[a-zA-Z0-9_+/=]+/
const WEBHOOK_SECRET_VAR = 'STRIPE_WEBHOOK_SECRET'

let webhookSecret = null
let secretExtracted = false
let accumulatedOutput = '' // Accumulate output across chunks to catch secrets split across boundaries

/**
 * Updates an env file with the webhook secret
 * @param {string} filePath - Path to the env file
 * @param {string} secret - Webhook secret to set
 */
function updateEnvFile(filePath, secret) {
  if (!existsSync(filePath)) {
    console.log(`⚠️  File ${filePath} does not exist, skipping...`)
    return false
  }

  try {
    let content = readFileSync(filePath, 'utf-8')
    const secretLine = `${WEBHOOK_SECRET_VAR}=${secret}`
    
    // Check if STRIPE_WEBHOOK_SECRET already exists
    const existingPattern = new RegExp(`^${WEBHOOK_SECRET_VAR}=.*$`, 'm')
    
    if (existingPattern.test(content)) {
      // Replace existing value
      content = content.replace(existingPattern, secretLine)
      console.log(`✅ Updated ${filePath}`)
    } else {
      // Add it in the STRIPE CONFIGURATION section
      // Look for the STRIPE CONFIGURATION section
      const stripeSectionPattern = /(# =+.*STRIPE CONFIGURATION.*\n.*\n)/s
      const match = content.match(stripeSectionPattern)
      
      if (match) {
        // Find the last line in the STRIPE section before APPLICATION CONFIGURATION
        const appConfigPattern = /# =+.*APPLICATION CONFIGURATION/
        const appConfigIndex = content.indexOf('# ===========================================\n# APPLICATION CONFIGURATION')
        
        if (appConfigIndex !== -1) {
          // Insert before APPLICATION CONFIGURATION section
          const beforeAppConfig = content.substring(0, appConfigIndex)
          const afterAppConfig = content.substring(appConfigIndex)
          
          // Find the last non-empty line before APPLICATION CONFIGURATION
          const lines = beforeAppConfig.split('\n')
          let insertIndex = lines.length - 1
          
          // Find the last line that's not empty or just whitespace
          while (insertIndex >= 0 && lines[insertIndex].trim() === '') {
            insertIndex--
          }
          
          lines.splice(insertIndex + 1, 0, secretLine)
          content = lines.join('\n') + afterAppConfig
        } else {
          // If no APPLICATION CONFIGURATION section, append to end of STRIPE section
          const stripeEndPattern = /(# Your Stripe webhook secret.*\n.*\n)/s
          if (stripeEndPattern.test(content)) {
            content = content.replace(stripeEndPattern, `$1${secretLine}\n`)
          } else {
            // Just append after the last Stripe-related line
            const lastStripeKeyPattern = /(NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=.*\n)/
            if (lastStripeKeyPattern.test(content)) {
              content = content.replace(lastStripeKeyPattern, `$1${secretLine}\n`)
            } else {
              // Fallback: append to end
              content += `\n${secretLine}\n`
            }
          }
        }
        console.log(`✅ Added ${WEBHOOK_SECRET_VAR} to ${filePath}`)
      } else {
        // No STRIPE section found, append to end
        content += `\n${WEBHOOK_SECRET_VAR}=${secret}\n`
        console.log(`✅ Added ${WEBHOOK_SECRET_VAR} to ${filePath} (appended to end)`)
      }
    }
    
    writeFileSync(filePath, content, 'utf-8')
    return true
  } catch (error) {
    console.error(`❌ Error updating ${filePath}:`, error.message)
    return false
  }
}

/**
 * Extracts webhook secret from a line of output
 * @param {string} line - Line of output from stripe listen
 * @returns {string|null} - Webhook secret if found, null otherwise
 */
function extractWebhookSecret(line) {
  const match = line.match(WEBHOOK_SECRET_PATTERN)
  return match ? match[0] : null
}

/**
 * Updates all env files with the webhook secret
 * @param {string} secret - Webhook secret to set
 */
function updateAllEnvFiles(secret) {
  if (secretExtracted) {
    return // Already updated
  }
  
  console.log(`\n🔧 Updating env files with webhook secret: ${secret.substring(0, 20)}...`)
  
  const projectRoot = process.cwd()
  let updatedCount = 0
  
  for (const envFile of ENV_FILES) {
    const filePath = join(projectRoot, envFile)
    if (updateEnvFile(filePath, secret)) {
      updatedCount++
    }
  }
  
  if (updatedCount > 0) {
    console.log(`✅ Updated ${updatedCount} env file(s)\n`)
  } else {
    console.log(`⚠️  No env files were updated\n`)
  }
  
  secretExtracted = true
}

// Main execution
console.log('🚀 Starting Stripe webhook listener...')
console.log('📝 Will automatically update env files when webhook secret is detected\n')

// Spawn stripe listen process
const stripeProcess = spawn('stripe', ['listen', '--forward-to', 'localhost:3000/api/webhooks/stripe'], {
  stdio: ['inherit', 'pipe', 'pipe']
})


/**
 * Checks accumulated output for webhook secret
 * @param {string} newOutput - New output chunk to add
 */
function checkForWebhookSecret(newOutput) {
  if (secretExtracted) {
    return
  }
  
  // Accumulate output (secrets might be split across chunks)
  accumulatedOutput += newOutput
  
  // Search the entire accumulated output for the secret
  // This handles cases where the secret is split across multiple data events
  const secret = extractWebhookSecret(accumulatedOutput)
  
  if (secret) {
    console.log('🔑 Webhook secret found:', secret)
    webhookSecret = secret
    updateAllEnvFiles(secret)
    // Keep accumulated output for potential future matches, but mark as extracted
  }
  
  // Limit accumulated output size to prevent memory issues
  // Keep last 10KB of output
  if (accumulatedOutput.length > 10000) {
    accumulatedOutput = accumulatedOutput.slice(-10000)
  }
}

// Handle stdout - look for webhook secret
stripeProcess.stdout.on('data', (data) => {
  const output = data.toString()
  
  // Forward output to terminal
  process.stdout.write(output)
  
  // Check for webhook secret in accumulated output
  checkForWebhookSecret(output)
})

// Handle stderr - also check for webhook secret (Stripe CLI might output it here)
stripeProcess.stderr.on('data', (data) => {
  const output = data.toString()
  
  // Forward output to terminal
  process.stderr.write(output)
  
  // Check for webhook secret in stderr too
  checkForWebhookSecret(output)
})

// Handle process exit
stripeProcess.on('exit', (code) => {
  if (code !== null && code !== 0) {
    console.error(`\n❌ Stripe process exited with code ${code}`)
    process.exit(code)
  }
})

// Handle process errors
stripeProcess.on('error', (error) => {
  console.error('❌ Error spawning stripe process:', error.message)
  console.error('💡 Make sure Stripe CLI is installed: https://stripe.com/docs/stripe-cli')
  process.exit(1)
})

// stdin is already inherited, no need to pipe

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down...')
  stripeProcess.kill('SIGINT')
  process.exit(0)
})

process.on('SIGTERM', () => {
  stripeProcess.kill('SIGTERM')
  process.exit(0)
})

