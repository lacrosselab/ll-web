import { test as base } from '@playwright/test'

// Test user credentials - using your actual test user
export const TEST_USER = {
  email: 'hello@thelacrosselab.com',
  password: 'test123',
  fullName: 'Test User'
}

// Use existing athletes from the system
export const EXISTING_ATHLETES = {
  athlete1: 'Titty Boy2',
  athlete2: 'Test 2'
}

// Test data for new athletes
export const TEST_ATHLETE = {
  name: 'Test Athlete',
  age: '16',
  school: 'Test High School',
  position: 'Midfielder'
}

// Helper functions
export const loginUser = async (page: any) => {
  await page.goto('/login')
  await page.waitForSelector('[data-testid="email"]', { timeout: 10000 })
  await page.fill('[data-testid="email"]', TEST_USER.email)
  await page.fill('[data-testid="password"]', TEST_USER.password)
  await page.click('[data-testid="login-button"]')
  await page.waitForURL('/member/dashboard', { timeout: 15000 })
}

export const createTestAthlete = async (page: any) => {
  await page.goto('/member/dashboard')
  await page.click('text=Add Athlete')
  await page.waitForSelector('[data-testid="athlete-name"]', { timeout: 10000 })
  await page.fill('[data-testid="athlete-name"]', TEST_ATHLETE.name)
  await page.fill('[data-testid="athlete-age"]', TEST_ATHLETE.age)
  await page.fill('[data-testid="athlete-school"]', TEST_ATHLETE.school)
  await page.fill('[data-testid="athlete-position"]', TEST_ATHLETE.position)
  await page.click('text=Add Athlete')
  await page.waitForSelector(`text=${TEST_ATHLETE.name}`, { timeout: 10000 })
}

export const waitForToast = async (page: any, message: string) => {
  await page.waitForSelector(`text=${message}`, { timeout: 5000 })
}
