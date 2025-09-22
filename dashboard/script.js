// Operations Chart
const operationsCtx = document.getElementById('operationsChart').getContext('2d');
const operationsChart = new Chart(operationsCtx, {
    type: 'bar',
    data: {
        labels: ['Americas', 'Europe', 'Asia', 'Africa'],
        datasets: [{
            label: 'Performance Score (%)',
            data: [85, 92, 78, 88],
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

// Banking Chart
const bankingCtx = document.getElementById('bankingChart').getContext('2d');
const bankingChart = new Chart(bankingCtx, {
    type: 'line',
    data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [{
            label: 'Revenue (in millions)',
            data: [100, 120, 110, 130, 125, 140],
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
