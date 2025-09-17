import { test, expect } from '@playwright/test'
import { TEST_USER, EXISTING_ATHLETES, loginUser } from './setup'

test.describe('Cart and Checkout Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page)
  })

  test('should add session to cart with existing athlete', async ({ page }) => {
    // Go to pricing page
    await page.goto('/pricing')
    await page.waitForSelector('[data-testid="add-to-cart"]', { timeout: 15000 })
    
    // Add first available session to cart
    await page.click('[data-testid="add-to-cart"]:first-of-type')
    
    // Select existing athlete
    await page.click(`text=${EXISTING_ATHLETES.athlete1}`)
    
    // Navigate to cart to verify item was added
    await page.goto('/cart')
    await expect(page.locator('[data-testid="cart-item"]')).toBeVisible()
  })

  test('should create new athlete during cart flow', async ({ page }) => {
    // Go to pricing page
    await page.goto('/pricing')
    await page.waitForSelector('[data-testid="add-to-cart"]', { timeout: 15000 })
    
    // Add session to cart
    await page.click('[data-testid="add-to-cart"]:first-of-type')
    
    // Create new athlete
    await page.click('text=Add New Athlete')
    await page.fill('[data-testid="athlete-name"]', 'New Test Athlete')
    await page.click('text=Add Athlete')
    
    // Navigate to cart to verify item was added
    await page.goto('/cart')
    await expect(page.locator('[data-testid="cart-item"]')).toBeVisible()
  })
})
