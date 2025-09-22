// Chart instances
let operationsChart, bankingChart, gpuChart, aiAnalyticsChart;

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

// Image Generation Handler
async function handleImageGeneration(event) {
    event.preventDefault();
    const input = document.getElementById('imageGenInput').value.trim();
    if (!input) return;

    const outputDiv = document.getElementById('imageGenOutput');
    outputDiv.innerHTML = 'Generating image...';

    try {
        const response = await fetch('/api/ai/image-generation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: input })
        });
        if (response.ok) {
            const blob = await response.blob();
            const imgUrl = URL.createObjectURL(blob);
            outputDiv.innerHTML = `<img src="${imgUrl}" alt="Generated Image" style="max-width:100%;">`;
        } else {
            outputDiv.textContent = 'Image generation failed.';
        }
    } catch (error) {
        outputDiv.textContent = `Error: ${error.message}`;
    }
}

// Code Completion Handler
async function handleCodeCompletion(event) {
    event.preventDefault();
    const input = document.getElementById('codeCompInput').value.trim();
    if (!input) return;

    const outputDiv = document.getElementById('codeCompOutput');
    outputDiv.textContent = 'Completing code...';

    try {
        const response = await fetch('/api/ai/code-completion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: input })
        });
        const data = await response.json();
        outputDiv.textContent = data.output || 'No completion available.';
    } catch (error) {
        outputDiv.textContent = `Error: ${error.message}`;
    }
}

// Sentiment Analysis Handler
async function handleSentimentAnalysis(event) {
    event.preventDefault();
    const input = document.getElementById('sentimentInput').value.trim();
    if (!input) return;

    const outputDiv = document.getElementById('sentimentOutput');
    outputDiv.textContent = 'Analyzing sentiment...';

    try {
        const response = await fetch('/api/ai/sentiment-analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: input })
        });
        const data = await response.json();
        const sentiment = data.sentiment[0].label;
        outputDiv.textContent = `Sentiment: ${sentiment}`;
    } catch (error) {
        outputDiv.textContent = `Error: ${error.message}`;
    }
}

// Voice Input Handler
function handleVoiceInput() {
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        document.getElementById('voiceOutput').textContent = `You said: ${transcript}`;
        document.getElementById('voiceAiInput').value = transcript;
        document.getElementById('voiceAiForm').style.display = 'block';
    };

    recognition.onerror = (event) => {
        document.getElementById('voiceOutput').textContent = `Error: ${event.error}`;
    };

    recognition.start();
}

// Voice AI Inference Handler
async function handleVoiceAIInference(event) {
    event.preventDefault();
    const input = document.getElementById('voiceAiInput').value.trim();
    if (!input) return;

    const outputDiv = document.getElementById('voiceAiOutput');
    outputDiv.textContent = 'Processing...';

    try {
        const result = await nvidiaIntegration.runAIInference('text-generation', input);
        outputDiv.textContent = `AI Response: ${result.output}`;
    } catch (error) {
        outputDiv.textContent = `Error: ${error.message}`;
    }
}

// Create AI Analytics Chart
async function createAIAnalyticsChart() {
    const ctx = document.getElementById('aiAnalyticsChart').getContext('2d');
    aiAnalyticsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [{
                label: 'Predicted Revenue',
                data: [100, 120, 110, 130, 125, 140],
                borderColor: 'rgba(255, 193, 7, 1)',
                backgroundColor: 'rgba(255, 193, 7, 0.2)',
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
}

// Update AI Analytics with predictions
function updateAIAnalytics() {
    // Simple prediction: average + trend
    const data = aiAnalyticsChart.data.datasets[0].data;
    const newVal = data[data.length - 1] + (Math.random() - 0.5) * 10;
    data.push(newVal);
    data.shift();
    aiAnalyticsChart.update();
    document.getElementById('aiPredictions').textContent = `Next prediction: ${Math.round(newVal + 5)}`;
}

// OpenAI Chat Handler
async function handleOpenAIChat(event) {
    event.preventDefault();
    const input = document.getElementById('openaiInput').value.trim();
    if (!input) return;

    const chatHistory = document.getElementById('chatHistory');
    chatHistory.innerHTML += `<p><strong>You:</strong> ${input}</p>`;
    document.getElementById('openaiInput').value = '';

    try {
        const response = await fetch('/api/ai/openai-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: [{ role: 'user', content: input }] })
        });
        const data = await response.json();
        chatHistory.innerHTML += `<p><strong>GPT-4:</strong> ${data.response}</p>`;
    } catch (error) {
        chatHistory.innerHTML += `<p><strong>Error:</strong> ${error.message}</p>`;
    }
}

// OpenAI Image Handler
async function handleOpenAIImage(event) {
    event.preventDefault();
    const input = document.getElementById('openaiImageInput').value.trim();
    if (!input) return;

    const outputDiv = document.getElementById('openaiImageOutput');
    outputDiv.innerHTML = 'Generating image...';

    try {
        const response = await fetch('/api/ai/openai-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: input })
        });
        const data = await response.json();
        outputDiv.innerHTML = `<img src="${data.imageUrl}" alt="Generated Image" style="max-width:100%;">`;
    } catch (error) {
        outputDiv.textContent = `Error: ${error.message}`;
    }
}

// Initialize charts on page load
document.addEventListener('DOMContentLoaded', () => {
    createOperationsChart();
    createBankingChart();
    createGPUChart();
    createAIAnalyticsChart();

    // Add AI form handlers
    const aiForm = document.getElementById('aiForm');
    aiForm.addEventListener('submit', handleAIInference);

    const blackboxAiForm = document.getElementById('blackboxAiForm');
    blackboxAiForm.addEventListener('submit', handleBlackboxAIInference);

    const imageGenForm = document.getElementById('imageGenForm');
    imageGenForm.addEventListener('submit', handleImageGeneration);

    const codeCompForm = document.getElementById('codeCompForm');
    codeCompForm.addEventListener('submit', handleCodeCompletion);

    const sentimentForm = document.getElementById('sentimentForm');
    sentimentForm.addEventListener('submit', handleSentimentAnalysis);

    const voiceStartBtn = document.getElementById('voiceStart');
    voiceStartBtn.addEventListener('click', handleVoiceInput);

    const voiceAiForm = document.getElementById('voiceAiForm');
    voiceAiForm.addEventListener('submit', handleVoiceAIInference);

    // OpenAI handlers
    const openaiChatForm = document.getElementById('openaiChatForm');
    openaiChatForm.addEventListener('submit', handleOpenAIChat);

    const openaiImageForm = document.getElementById('openaiImageForm');
    openaiImageForm.addEventListener('submit', handleOpenAIImage);

    // Set up real-time updates every 5 seconds
    setInterval(() => {
        updateOperationsChart();
        updateBankingChart();
        updateGPUChart();
        updateAIAnalytics();
    }, 5000);
});
