document.addEventListener('DOMContentLoaded', function() {
    
    // UI Elements
    const ctx = document.getElementById('energyChart').getContext('2d');
    const logsTableBody = document.getElementById('logs-table-body');
    const refreshBtn = document.getElementById('refresh-btn');

    // Chart Configuration
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = "'Inter', sans-serif";
    
    // Define visually appealing colors for devices
    const deviceColors = {
        'Device-A (Chiller)': { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
        'Device-B (Air Compressor)': { border: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
        'Device-C (HVAC)': { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' }
    };

    let energyChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: []
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        boxWidth: 8
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#f8fafc',
                    bodyColor: '#e2e8f0',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    padding: 12
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'second',
                        displayFormats: {
                            second: 'HH:mm:ss'
                        },
                        tooltipFormat: 'HH:mm:ss'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    },
                    title: {
                        display: true,
                        text: 'Time'
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    },
                    title: {
                        display: true,
                        text: 'Power Consumption (kW)'
                    }
                }
            }
        }
    });

    // Function to fetch data and update UI
    async function fetchData() {
        try {
            // Add visual feedback to refresh button
            refreshBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Refreshing...';
            
            const response = await fetch('/api/data?limit=100');
            const data = await response.json();
            
            if (data.length > 0) {
                updateChart(data);
                updateTable(data);
            }
            
            // Reset button
            setTimeout(() => {
                refreshBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Refresh';
            }, 500);

        } catch (error) {
            console.error('Error fetching data:', error);
            refreshBtn.innerHTML = '<i class="fa-solid fa-triangle-exclamation text-warning"></i> Error';
        }
    }

    // Function to update the Chart.js graph
    function updateChart(data) {
        // Process data into datasets per device
        const processedData = {};
        
        data.forEach(item => {
            if (!processedData[item.device_name]) {
                processedData[item.device_name] = [];
            }
            // Add point to device series
            processedData[item.device_name].push({
                x: new Date(item.timestamp),
                y: item.power_consumption
            });
        });

        const datasets = [];
        const fallbackColors = [
            { border: '#ec4899', bg: 'rgba(236, 72, 153, 0.1)' },
            { border: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' },
            { border: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)' }
        ];
        
        let colorIndex = 0;

        for (const [deviceName, dataPoints] of Object.entries(processedData)) {
            // Use predefined colors or fallback
            const colors = deviceColors[deviceName] || fallbackColors[colorIndex % fallbackColors.length];
            colorIndex++;
            
            datasets.push({
                label: deviceName,
                data: dataPoints,
                borderColor: colors.border,
                backgroundColor: colors.bg,
                borderWidth: 2,
                pointRadius: 2,
                pointHoverRadius: 5,
                fill: true,
                tension: 0.4 // Smooth curves
            });
        }

        energyChart.data.datasets = datasets;
        energyChart.update('none'); // Update without animation for smoother polling
    }

    // Function to update the recent logs table
    function updateTable(data) {
        logsTableBody.innerHTML = '';
        
        // Show only the latest 10 items in the table
        // Since data is sorted chronologically for the chart, the latest are at the end
        const recentData = [...data].reverse().slice(0, 15);
        
        recentData.forEach(item => {
            const timeStr = moment(item.timestamp).format('HH:mm:ss');
            
            // Get color indicator
            let colorDot = '#ec4899';
            if (deviceColors[item.device_name]) {
                colorDot = deviceColors[item.device_name].border;
            }
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="text-muted"><small>${timeStr}</small></td>
                <td>
                    <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:${colorDot}; margin-right:6px;"></span>
                    ${item.device_name.split(' ')[0]} 
                </td>
                <td class="text-end fw-bold">${item.power_consumption.toFixed(2)}</td>
            `;
            logsTableBody.appendChild(tr);
        });
    }

    // Event Listeners
    refreshBtn.addEventListener('click', fetchData);

    // Initial fetch
    fetchData();

    // Setup polling every 3 seconds
    setInterval(fetchData, 3000);
});
