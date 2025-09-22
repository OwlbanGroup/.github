// Chart instances
let operationsChart, bankingChart, gpuChart;

// Function to create Operations Chart
async function createOperationsChart() {
    try {
        const response = await fetch('/api/operations');
        const data = await response.json();
        const operationsCtx = document.getElementById('operationsChart').getContext('2d');
        operationsChart = new Chart(operationsCtx, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Performance Score (%)',
                    data: data.data,
                    backgroundColor: 'rgba(0, 123, 255, 0.5)',
                    borderColor: 'rgba(0, 123, 255, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error fetching operations data:', error);
    }
}

// Function to create Banking Chart
async function createBankingChart() {
    try {
        const response = await fetch('/api/banking');
        const data = await response.json();
        const bankingCtx = document.getElementById('bankingChart').getContext('2d');
        bankingChart = new Chart(bankingCtx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Revenue (in millions)',
                    data: data.data,
                    backgroundColor: 'rgba(40, 167, 69, 0.2)',
                    borderColor: 'rgba(40, 167, 69, 1)',
                    borderWidth: 2,
                    fill: true
                }]
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error fetching banking data:', error);
    }
}

// Function to create GPU Chart
async function createGPUChart() {
    try {
        await nvidiaIntegration.initialize();
        const metrics = await nvidiaIntegration.getGPUMetrics();
        const gpuCtx = document.getElementById('gpuChart').getContext('2d');
        gpuChart = new Chart(gpuCtx, {
            type: 'bar',
            data: {
                labels: ['Utilization (%)', 'Temperature (°C)', 'Memory Used (GB)'],
                datasets: [{
                    label: 'GPU Metrics',
                    data: [metrics.utilization, metrics.temperature, metrics.memory.used / (1024 * 1024 * 1024)],
                    backgroundColor: ['rgba(255, 99, 132, 0.5)', 'rgba(54, 162, 235, 0.5)', 'rgba(255, 205, 86, 0.5)'],
                    borderColor: ['rgba(255, 99, 132, 1)', 'rgba(54, 162, 235, 1)', 'rgba(255, 205, 86, 1)'],
                    borderWidth: 1
                }]
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error creating GPU chart:', error);
    }
}

// Function to update GPU Chart
async function updateGPUChart() {
    try {
        const metrics = await nvidiaIntegration.getGPUMetrics();
        gpuChart.data.datasets[0].data = [metrics.utilization, metrics.temperature, metrics.memory.used / (1024 * 1024 * 1024)];
        gpuChart.update();
    } catch (error) {
        console.error('Error updating GPU chart:', error);
    }
}

// Function to update Operations Chart (mock dynamic data)
async function updateOperationsChart() {
    try {
        // For demo, slightly vary the data
        operationsChart.data.datasets[0].data = operationsChart.data.datasets[0].data.map(val => Math.max(0, Math.min(100, val + (Math.random() - 0.5) * 10)));
        operationsChart.update();
    } catch (error) {
        console.error('Error updating operations chart:', error);
    }
}

// Function to update Banking Chart (mock dynamic data)
async function updateBankingChart() {
    try {
        // For demo, slightly vary the data
        bankingChart.data.datasets[0].data = bankingChart.data.datasets[0].data.map(val => val + (Math.random() - 0.5) * 5);
        bankingChart.update();
    } catch (error) {
        console.error('Error updating banking chart:', error);
    }
}

// AI Inference Handler
async function handleAIInference(event) {
    event.preventDefault();
    const input = document.getElementById('aiInput').value.trim();
    if (!input) return;

    const outputDiv = document.getElementById('aiOutput');
    outputDiv.textContent = 'Processing...';

    try {
        const result = await nvidiaIntegration.runAIInference('advanced-model', input);
        outputDiv.textContent = `AI Response: ${result.output || 'Mock response: This is a simulated response from the advanced AI model.'}`;
    } catch (error) {
        outputDiv.textContent = `Error: ${error.message}`;
    }
}

// Blackbox AI Inference Handler
async function handleBlackboxAIInference(event) {
    event.preventDefault();
    const input = document.getElementById('blackboxAiInput').value.trim();
    if (!input) return;

    const outputDiv = document.getElementById('blackboxAiOutput');
    outputDiv.textContent = 'Processing...';

    try {
        const result = await nvidiaIntegration.runAIInference('blackbox-ai', input);
        outputDiv.textContent = `Blackbox AI Response: ${result.output || 'Mock response: This is a simulated response from the Blackbox AI model on NVIDIA Grace Blackwell.'}`;
    } catch (error) {
        outputDiv.textContent = `Error: ${error.message}`;
    }
}

// Initialize charts on page load
document.addEventListener('DOMContentLoaded', () => {
    createOperationsChart();
    createBankingChart();
    createGPUChart();

    // Add AI form handler
    const aiForm = document.getElementById('aiForm');
    aiForm.addEventListener('submit', handleAIInference);

    // Add Blackbox AI form handler
    const blackboxAiForm = document.getElementById('blackboxAiForm');
    blackboxAiForm.addEventListener('submit', handleBlackboxAIInference);

    // Set up real-time updates every 5 seconds
    setInterval(() => {
        updateOperationsChart();
        updateBankingChart();
        updateGPUChart();
    }, 5000);
});
