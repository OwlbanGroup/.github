# TODO: Enhance Owlban Group Dashboard for Advanced AI Model

- [x] Add `/api/gpu` endpoint in `app.js` to execute `nvidia-smi` and parse real GPU metrics (utilization, temperature, memory)
- [x] Update `dashboard/nvidia.js`: Modify `getGPUMetrics` to fetch data from `/api/gpu` instead of mock
- [x] Update `dashboard/index.html`: Add new section for AI Inference with input form and output display
- [x] Update `dashboard/script.js`: Add form submission handler for AI inference, display responses, and implement real-time chart updates every 5 seconds
- [x] Update `dashboard/styles.css`: Enhance styling with modern design, responsiveness, and TailwindCSS integration
- [ ] Test: Run `npm start`, verify real GPU metrics, AI inference UI, real-time updates, and overall functionality
- [x] Add Blackbox AI section to the dashboard for Grace Blackwell NVIDIA model inference
