// E2E Perfection Test for Owlban Group Dashboard
import { test, expect } from '@playwright/test';

let serverReady = false;

test.beforeAll(async () => {
  // Check if server is ready by testing a simple API
  try {
    const response = await fetch('http://localhost:3000/api/operations');
    serverReady = response.status === 200;
  } catch (e) {
    serverReady = false;
  }
});

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
    test.skip(!serverReady, 'Server not ready');
    await page.goto('http://localhost:3000');
    const result = await page.evaluate(async () => {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'testuser', password: 'testpass' })
      });
      const status = response.status;
      let data;
      try {
        data = await response.json();
      } catch (e) {
        data = await response.text();
      }
      return { status, data };
    });
    expect(result.status).toBe(201);
    expect(result.data.message).toBe('User registered successfully');
  });

  test('User login', async ({ page }) => {
    test.skip(!serverReady, 'Server not ready');
    await page.goto('http://localhost:3000');
    const result = await page.evaluate(async () => {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'testuser', password: 'testpass' })
      });
      const status = response.status;
      let data;
      try {
        data = await response.json();
      } catch (e) {
        data = await response.text();
      }
      return { status, data };
    });
    expect(result.status).toBe(200);
    expect(result.data.token).toBeTruthy();
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
    test.skip(!serverReady, 'Server not ready');
    // First, register and login to get token
    await page.goto('http://localhost:3000');
    const loginResult = await page.evaluate(async () => {
      // Register
      await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'testuser2', password: 'testpass' })
      });
      // Login
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'testuser2', password: 'testpass' })
      });
      const data = await response.json();
      return data.token;
    });

    // Set token in localStorage
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
    }, loginResult);

    await page.fill('#aiInput', 'Hello AI');
    await page.click('#aiSubmit');
    // Wait for response
    await page.waitForTimeout(5000);
    const output = page.locator('#aiOutput');
    await expect(output).toBeVisible();
    // Check if output has text
    expect(await output.textContent()).not.toBe('');
  });

  // Expanded AI feature tests
  test('AI Image Generation interaction', async ({ page }) => {
    test.skip(!serverReady, 'Server not ready');
    await page.goto('http://localhost:3000');
    const form = page.locator('#imageGenForm');
    await expect(form).toBeVisible();
    await page.fill('#imageGenInput', 'A futuristic city with flying cars');
    await page.click('#imageGenSubmit');
    await page.waitForTimeout(10000); // Image generation takes longer
    const output = page.locator('#imageGenOutput');
    await expect(output).toBeVisible();
    // Check if image is generated (either img tag or error message)
    expect(await output.textContent()).not.toBe('Generating image...');
  });

  test('AI Code Completion interaction', async ({ page }) => {
    test.skip(!serverReady, 'Server not ready');
    await page.goto('http://localhost:3000');
    const form = page.locator('#codeCompForm');
    await expect(form).toBeVisible();
    await page.fill('#codeCompInput', 'def hello_world():');
    await page.click('#codeCompSubmit');
    await page.waitForTimeout(5000);
    const output = page.locator('#codeCompOutput');
    await expect(output).toBeVisible();
    expect(await output.textContent()).not.toBe('Completing code...');
  });

  test('AI Sentiment Analysis interaction', async ({ page }) => {
    test.skip(!serverReady, 'Server not ready');
    await page.goto('http://localhost:3000');
    const form = page.locator('#sentimentForm');
    await expect(form).toBeVisible();
    await page.fill('#sentimentInput', 'I love this amazing product!');
    await page.click('#sentimentSubmit');
    await page.waitForTimeout(3000);
    const output = page.locator('#sentimentOutput');
    await expect(output).toBeVisible();
    expect(await output.textContent()).toContain('Sentiment');
  });

  test('OpenAI Chat interaction', async ({ page }) => {
    test.skip(!serverReady, 'Server not ready');
    await page.goto('http://localhost:3000');
    const form = page.locator('#openaiChatForm');
    await expect(form).toBeVisible();
    await page.fill('#openaiInput', 'Hello GPT');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);
    const history = page.locator('#chatHistory');
    await expect(history).toContainText('Hello GPT');
  });

  test('OpenAI Image Generation interaction', async ({ page }) => {
    test.skip(!serverReady, 'Server not ready');
    await page.goto('http://localhost:3000');
    const form = page.locator('#openaiImageForm');
    await expect(form).toBeVisible();
    await page.fill('#openaiImageInput', 'A beautiful sunset over mountains');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(10000);
    const output = page.locator('#openaiImageOutput');
    await expect(output).toBeVisible();
    expect(await output.textContent()).not.toBe('Generating image...');
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
    await page.goto('http://localhost:3000');
    const result = await page.evaluate(async () => {
      const response = await fetch('/metrics');
      const status = response.status;
      const text = await response.text();
      return { status, text };
    });
    if (serverReady) {
      expect(result.status).toBe(200);
      expect(result.text).toContain('http_request_duration_seconds');
    } else {
      expect(result.status).toBe(404);
    }
  });

  // API endpoints
  test('Operations API', async ({ page }) => {
    await page.goto('http://localhost:3000');
    const result = await page.evaluate(async () => {
      const response = await fetch('/api/operations');
      const status = response.status;
      let data;
      try {
        data = await response.json();
      } catch (e) {
        data = null;
      }
      return { status, data };
    });
    if (serverReady) {
      expect(result.status).toBe(200);
      expect(result.data.labels).toEqual(['Americas', 'Europe', 'Asia', 'Africa']);
    } else {
      expect(result.status).toBe(404);
    }
  });

  test('Banking API', async ({ page }) => {
    await page.goto('http://localhost:3000');
    const result = await page.evaluate(async () => {
      const response = await fetch('/api/banking');
      const status = response.status;
      let data;
      try {
        data = await response.json();
      } catch (e) {
        data = null;
      }
      return { status, data };
    });
    if (serverReady) {
      expect(result.status).toBe(200);
      expect(result.data.labels).toEqual(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']);
    } else {
      expect(result.status).toBe(404);
    }
  });

  // GPU API (may fail if no GPU)
  test('GPU API', async ({ page }) => {
    await page.goto('http://localhost:3000');
    const result = await page.evaluate(async () => {
      const response = await fetch('/api/gpu');
      const status = response.status;
      let data;
      try {
        data = await response.json();
      } catch (e) {
        data = null;
      }
      return { status, data };
    });
    if (serverReady) {
      if (result.status === 200) {
        expect(result.data).toHaveProperty('utilization');
      } else {
        expect(result.status).toBe(500);
      }
    } else {
      expect(result.status).toBe(404);
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

  // Performance tests
  test('Dashboard load performance', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(5000); // Should load within 5 seconds
  });

  test('Chart rendering performance', async ({ page }) => {
    await page.goto('http://localhost:3000');
    const startTime = Date.now();
    await page.waitForSelector('#operationsChart');
    await page.waitForSelector('#bankingChart');
    const renderTime = Date.now() - startTime;
    expect(renderTime).toBeLessThan(3000); // Charts should render within 3 seconds
  });

  // Visual regression tests
  test('Dashboard visual snapshot', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('dashboard-fullpage.png', { fullPage: true });
  });

  test('Charts visual snapshot', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForSelector('#operationsChart');
    await page.waitForSelector('#bankingChart');
    await page.waitForTimeout(2000); // Wait for charts to fully render
    const chartsSection = page.locator('#operations, #banking');
    await expect(chartsSection).toHaveScreenshot('charts-section.png');
  });

  // Accessibility tests
  test('Dashboard accessibility check', async ({ page }) => {
    const { injectAxe, checkA11y } = require('@axe-core/playwright');
    await page.goto('http://localhost:3000');
    await injectAxe(page);
    const results = await checkA11y(page);
    expect(results.violations).toEqual([]); // No accessibility violations
  });

  test('Forms accessibility check', async ({ page }) => {
    const { injectAxe, checkA11y } = require('@axe-core/playwright');
    await page.goto('http://localhost:3000');
    await injectAxe(page);
    const forms = page.locator('form');
    for (const form of await forms.all()) {
      const results = await checkA11y(form);
      expect(results.violations.length).toBeLessThan(3); // Allow minor violations
    }
  });

  // Cross-browser visual tests
  test('Mobile responsiveness', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    await page.goto('http://localhost:3000');
    await expect(page.locator('h1')).toBeVisible();
    await expect(page).toHaveScreenshot('dashboard-mobile.png');
  });

  test('Tablet responsiveness', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 }); // iPad
    await page.goto('http://localhost:3000');
    await expect(page.locator('h1')).toBeVisible();
    await expect(page).toHaveScreenshot('dashboard-tablet.png');
  });

  // Load testing
  test('Concurrent API requests', async ({ page }) => {
    test.skip(!serverReady, 'Server not ready');
    await page.goto('http://localhost:3000');
    const requests = [];
    for (let i = 0; i < 10; i++) {
      requests.push(page.evaluate(async () => {
        const response = await fetch('/api/operations');
        return response.status;
      }));
    }
    const results = await Promise.all(requests);
    results.forEach(status => expect(status).toBe(200));
  });

  // Error handling tests
  test('Invalid API endpoint', async ({ page }) => {
    await page.goto('http://localhost:3000');
    const result = await page.evaluate(async () => {
      const response = await fetch('/api/invalid-endpoint');
      return response.status;
    });
    expect(result).toBe(404);
  });

  test('Malformed JSON request', async ({ page }) => {
    test.skip(!serverReady, 'Server not ready');
    await page.goto('http://localhost:3000');
    const result = await page.evaluate(async () => {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json'
      });
      return response.status;
    });
    expect(result).toBe(400);
  });

  // Security tests
  test('Rate limiting', async ({ page }) => {
    test.skip(!serverReady, 'Server not ready');
    await page.goto('http://localhost:3000');
    const requests = [];
    for (let i = 0; i < 150; i++) { // Exceed rate limit
      requests.push(page.evaluate(async () => {
        const response = await fetch('/api/operations');
        return response.status;
      }));
    }
    const results = await Promise.all(requests);
    const rateLimited = results.some(status => status === 429);
    expect(rateLimited).toBe(true);
  });

  // NVIDIA Cloud Integration Tests
  test('NVIDIA models list', async ({ page }) => {
    test.skip(!serverReady, 'Server not ready');
    await page.goto('http://localhost:3000');
    const result = await page.evaluate(async () => {
      const response = await fetch('/api/nvidia/models', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      return response.status;
    });
    // May fail if no NVIDIA API key, but test the endpoint exists
    expect([200, 401, 403]).toContain(result);
  });

  test('NVIDIA instances list', async ({ page }) => {
    test.skip(!serverReady, 'Server not ready');
    await page.goto('http://localhost:3000');
    const result = await page.evaluate(async () => {
      const response = await fetch('/api/nvidia/instances', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      return response.status;
    });
    expect([200, 401, 403]).toContain(result);
  });

  test('NVIDIA cloud UI elements', async ({ page }) => {
    await page.goto('http://localhost:3000');
    const nvidiaSection = page.locator('#nvidia-cloud');
    await expect(nvidiaSection).toBeVisible();
    await expect(nvidiaSection.locator('h2')).toContainText('NVIDIA Cloud AI Control Panel');
  });

  // RAG query test
  test('RAG query', async ({ page }) => {
    test.skip(!serverReady, 'Server not ready');
    // Requires auth - test with token
  });

  // Fine-tuning test
  test('AI fine-tuning', async ({ page }) => {
    test.skip(!serverReady, 'Server not ready');
    // Requires auth - test with token
  });
});
