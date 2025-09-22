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

// Initialize charts on page load
document.addEventListener('DOMContentLoaded', () => {
    createOperationsChart();
    createBankingChart();
});
