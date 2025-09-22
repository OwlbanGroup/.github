// Function to create Operations Chart
async function createOperationsChart() {
    try {
        const response = await fetch('/api/operations');
        const data = await response.json();
        const operationsCtx = document.getElementById('operationsChart').getContext('2d');
        const operationsChart = new Chart(operationsCtx, {
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
        const bankingChart = new Chart(bankingCtx, {
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
        const gpuChart = new Chart(gpuCtx, {
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

// Initialize charts on page load
document.addEventListener('DOMContentLoaded', () => {
    createOperationsChart();
    createBankingChart();
    createGPUChart();
});
