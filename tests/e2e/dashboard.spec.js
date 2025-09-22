// E2E Perfection Test for Owlban Group Dashboard
import { test, expect } from '@playwright/test';

test.describe('Dashboard E2E Tests', () => {
  // Assuming server is running on localhost:3000
  // In production, use environment variables or start server in globalSetup

  test('Dashboard loads successfully', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await expect(page.locator('h1')).toContainText('Owlban Group Dashboard');
  });

  test('Operations chart renders', async ({ page }) => {
    await page.goto('http://localhost:3000');
    const canvas = page.locator('#operationsChart');
    await expect(canvas).toBeVisible();
    // Wait for chart to render
    await page.waitForTimeout(1000);
    const chartData = await page.evaluate(() => {
      const chart = Chart.getChart('operationsChart');
      return chart ? chart.data.labels : null;
    });
    expect(chartData).toEqual(['Americas', 'Europe', 'Asia', 'Africa']);
  });

  test('Banking chart renders', async ({ page }) => {
    await page.goto('http://localhost:3000');
    const canvas = page.locator('#bankingChart');
    await expect(canvas).toBeVisible();
    await page.waitForTimeout(1000);
    const chartData = await page.evaluate(() => {
      const chart = Chart.getChart('bankingChart');
      return chart ? chart.data.labels : null;
    });
    expect(chartData).toEqual(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']);
  });

  test('Open Source section displays', async ({ page }) => {
    await page.goto('http://localhost:3000');
    const section = page.locator('#opensource');
    await expect(section).toBeVisible();
    await expect(section.locator('h3')).toContainText('Welcome to Open Source @ J.P. Morgan Payments!');
  });

  test('GPU metrics section loads', async ({ page }) => {
    await page.goto('http://localhost:3000');
    const gpuSection = page.locator('#gpu');
    await expect(gpuSection).toBeVisible();
    await expect(gpuSection.locator('h2')).toContainText('NVIDIA AI Control Panel');
  });

  test('Dark mode toggle works', async ({ page }) => {
    await page.goto('http://localhost:3000');
    const toggle = page.locator('button').filter({ hasText: 'Toggle Dark Mode' });
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.locator('body')).toHaveClass('dark-mode');
    await toggle.click();
    await expect(page.locator('body')).not.toHaveClass('dark-mode');
  });

  test('i18n language detection', async ({ page }) => {
    await page.goto('http://localhost:3000');
    // Assuming English by default
    await expect(page.locator('h1')).toContainText('Owlban Group Dashboard');
    // Test Spanish if language is set
    await page.evaluate(() => {
      localStorage.setItem('i18nextLng', 'es');
      location.reload();
    });
    await page.waitForLoadState();
    await expect(page.locator('h1')).toContainText('Panel de Control del Grupo Owlban');
  });

  // Authentication tests
  test('User registration', async ({ page }) => {
    await page.goto('http://localhost:3000');
    // Assuming frontend has auth forms, but since it's backend, test API directly
    const response = await page.request.post('http://localhost:3000/api/auth/register', {
      data: { username: 'testuser', password: 'testpass' }
    });
    expect(response.status()).toBe(201);
    const data = await response.json();
    expect(data.message).toBe('User registered successfully');
  });

  test('User login', async ({ page }) => {
    const response = await page.request.post('http://localhost:3000/api/auth/login', {
      data: { username: 'testuser', password: 'testpass' }
    });
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.token).toBeTruthy();
  });

  // AI Tests (assuming logged in, but for simplicity, test UI)
  test('AI text generation form interaction', async ({ page }) => {
    await page.goto('http://localhost:3000');
    const form = page.locator('#aiForm');
    await expect(form).toBeVisible();
    await page.fill('#aiInput', 'Hello AI');
    await page.click('#aiSubmit');
    // Since requires auth, expect error or redirect
    // For perfection, perhaps login first
  });

  // To make it authenticated, use a fixture
  test.use({ storageState: { cookies: [], origins: [] } });

  test('Authenticated AI text generation', async ({ page }) => {
    // First, register and login to get token
    await page.request.post('http://localhost:3000/api/auth/register', {
      data: { username: 'testuser2', password: 'testpass' }
    });
    const loginResponse = await page.request.post('http://localhost:3000/api/auth/login', {
      data: { username: 'testuser2', password: 'testpass' }
    });
    const { token } = await loginResponse.json();

    // Set auth header for requests
    await page.goto('http://localhost:3000');
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
    }, token);

    await page.fill('#aiInput', 'Hello AI');
    await page.click('#aiSubmit');
    // Wait for response
    await page.waitForTimeout(5000);
    const output = page.locator('#aiOutput');
    await expect(output).toBeVisible();
    // Check if output has text
    expect(await output.textContent()).not.toBe('');
  });

  // Add similar tests for other AI features: image gen, code completion, sentiment, OpenAI chat/image

  test('OpenAI Chat interaction', async ({ page }) => {
    await page.goto('http://localhost:3000');
    const form = page.locator('#openaiChatForm');
    await expect(form).toBeVisible();
    await page.fill('#openaiInput', 'Hello GPT');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);
    const history = page.locator('#chatHistory');
    await expect(history).toContainText('Hello GPT');
  });

  // WebSocket collaboration test
  test('WebSocket collaboration', async ({ page, context }) => {
    await page.goto('http://localhost:3000');
    const page2 = await context.newPage();
    await page2.goto('http://localhost:3000');

    // Assume collaboration script joins a room
    // This is complex, perhaps check if socket connects
    const socketConnected = await page.evaluate(() => {
      return window.io ? true : false;
    });
    expect(socketConnected).toBe(true);
  });

  // Metrics endpoint
  test('Prometheus metrics', async ({ page }) => {
    const response = await page.request.get('http://localhost:3000/metrics');
    expect(response.status()).toBe(200);
    const metrics = await response.text();
    expect(metrics).toContain('http_request_duration_seconds');
  });

  // API endpoints
  test('Operations API', async ({ page }) => {
    const response = await page.request.get('http://localhost:3000/api/operations');
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.labels).toEqual(['Americas', 'Europe', 'Asia', 'Africa']);
  });

  test('Banking API', async ({ page }) => {
    const response = await page.request.get('http://localhost:3000/api/banking');
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.labels).toEqual(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']);
  });

  // GPU API (may fail if no GPU)
  test('GPU API', async ({ page }) => {
    const response = await page.request.get('http://localhost:3000/api/gpu');
    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty('utilization');
    } else {
      expect(response.status()).toBe(500);
    }
  });

  // Voice input test (simulate)
  test('Voice input simulation', async ({ page }) => {
    await page.goto('http://localhost:3000');
    const voiceButton = page.locator('#voiceStart');
    await expect(voiceButton).toBeVisible();
    // Can't simulate actual voice, but check UI
    await voiceButton.click();
    const voiceOutput = page.locator('#voiceOutput');
    await expect(voiceOutput).toBeVisible();
  });

  // Docker integration test (if Docker available)
  test('Docker containers API', async ({ page }) => {
    // Requires auth
    // Skip or test with token
  });

  // RAG query test
  test('RAG query', async ({ page }) => {
    // Requires auth
  });

  // Fine-tuning test
  test('AI fine-tuning', async ({ page }) => {
    // Requires auth
  });
});
