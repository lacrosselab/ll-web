import { test, expect } from '@playwright/test'
import { TEST_USER, EXISTING_ATHLETES, loginUser } from './setup'

test.describe('Complete User Journey', () => {
  test('should complete full user journey: login → add athlete → add to cart → checkout', async ({ page }) => {
    // Step 1: Login
    await loginUser(page)
    await expect(page.locator('h1')).toContainText('Dashboard')

    // Step 2: Go to pricing page
    await page.goto('/pricing')
    await page.waitForSelector('[data-testid="add-to-cart"]', { timeout: 15000 })

    // Step 3: Add session to cart
    const addToCartButton = page.locator('[data-testid="add-to-cart"]').first()
    await expect(addToCartButton).toBeEnabled()
    await addToCartButton.click()

    // Step 4: Select existing athlete
    await page.waitForSelector(`text=${EXISTING_ATHLETES.athlete1}`, { timeout: 10000 })
    await page.click(`text=${EXISTING_ATHLETES.athlete1}`)

    // Step 5: Navigate directly to cart (more reliable than clicking icon)
    await page.goto('/cart')
    await expect(page.locator('[data-testid="cart-item"]')).toBeVisible()

    // Step 6: Proceed to checkout
    await page.click('[data-testid="checkout-button"]')
    
    // Step 7: Should redirect to Stripe checkout
    await expect(page.url()).toContain('checkout.stripe.com')
  })

  test('should show available sessions (no sold out sessions currently)', async ({ page }) => {
    await loginUser(page)
    await page.goto('/pricing')
    
    // Wait for sessions to load
    await page.waitForSelector('[data-testid="add-to-cart"]', { timeout: 15000 })
    
    // All sessions should be available (no sold out sessions currently)
    const addToCartButtons = page.locator('[data-testid="add-to-cart"]')
    const count = await addToCartButtons.count()
    
    for (let i = 0; i < count; i++) {
      await expect(addToCartButtons.nth(i)).toBeEnabled()
    }
  })

  test('should prevent duplicate purchases', async ({ page }) => {
    await loginUser(page)
    await page.goto('/pricing')
    await page.waitForSelector('[data-testid="add-to-cart"]', { timeout: 15000 })

    // Add session to cart
    await page.click('[data-testid="add-to-cart"]:first-of-type')
    await page.click(`text=${EXISTING_ATHLETES.athlete1}`)

    // Navigate to cart to verify item was added
    await page.goto('/cart')
    const cartItems = page.locator('[data-testid="cart-item"]')
    await expect(cartItems).toHaveCount(1)

    // Go back to pricing and try to add the same session again
    await page.goto('/pricing')
    await page.click('[data-testid="add-to-cart"]:first-of-type')
    
    // Wait for any async operations
    await page.waitForTimeout(1000)
    
    // Go back to cart to verify no duplicate was added
    await page.goto('/cart')
    await expect(cartItems).toHaveCount(1) // Still only 1 item
  })

  test('should allow removing items from cart', async ({ page }) => {
    await loginUser(page)

    // Add item to cart
    await page.goto('/pricing')
    await page.waitForSelector('[data-testid="add-to-cart"]', { timeout: 15000 })
    await page.click('[data-testid="add-to-cart"]:first-of-type')
    await page.click(`text=${EXISTING_ATHLETES.athlete1}`)

    // Navigate to cart to verify item was added
    await page.goto('/cart')
    await expect(page.locator('[data-testid="cart-item"]')).toBeVisible()

    // Remove item
    await page.click('[data-testid="remove-item"]')

    // Verify cart is empty by checking no cart items exist
    await expect(page.locator('[data-testid="cart-item"]')).not.toBeVisible()
  })
})
