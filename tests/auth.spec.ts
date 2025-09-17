import { test, expect } from '@playwright/test'
import { TEST_USER, loginUser } from './setup'

test.describe('User Authentication', () => {
  test('should allow user login', async ({ page }) => {
    await loginUser(page)
    await expect(page.locator('h1')).toContainText('Dashboard')
  })

  test('should redirect to login when accessing protected routes', async ({ page }) => {
    await page.goto('/member/dashboard')
    await expect(page).toHaveURL('/login')
  })

  test('should show user profile information after login', async ({ page }) => {
    await loginUser(page)
    
    // Should show athletes section
    await expect(page.locator('text=Your Athletes')).toBeVisible()
    
    // Should show payment history section
    await expect(page.locator('text=Payment History')).toBeVisible()
  })
})


