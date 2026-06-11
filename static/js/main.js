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

    // Define energy consumption thresholds (kW)
    const deviceThresholds = {
        'Device-A (Chiller)': 180.0,
        'Device-B (Air Compressor)': 110.0,
        'Device-C (HVAC)': 55.0
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
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toFixed(2) + ' kW';
                            }
                            
                            // Add alert warning in tooltip
                            const threshold = deviceThresholds[context.dataset.label];
                            if (context.parsed.y > threshold) {
                                label += ' ⚠️ (超標)';
                            }
                            return label;
                        }
                    }
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
            if (refreshBtn) {
                refreshBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Refreshing...';
            }
            
            const response = await fetch('/api/data?limit=100');
            if (response.status === 401) {
                // Redirect if session expired
                window.location.href = '/login';
                return;
            }
            const data = await response.json();
            
            if (data.length > 0) {
                updateChart(data);
                updateTable(data);
            }
            
            // Reset button
            if (refreshBtn) {
                setTimeout(() => {
                    refreshBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Refresh';
                }, 500);
            }

        } catch (error) {
            console.error('Error fetching data:', error);
            if (refreshBtn) {
                refreshBtn.innerHTML = '<i class="fa-solid fa-triangle-exclamation text-warning"></i> Error';
            }
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
            
            const threshold = deviceThresholds[deviceName] || 999.0;
            
            datasets.push({
                label: deviceName,
                data: dataPoints,
                borderColor: colors.border,
                backgroundColor: colors.bg,
                borderWidth: 2,
                // Custom dot colors: highlight warnings in red
                pointBackgroundColor: function(context) {
                    const index = context.dataIndex;
                    const value = context.dataset.data[index];
                    if (value && value.y > threshold) {
                        return '#ef4444'; // Warning Red
                    }
                    return colors.border;
                },
                pointBorderColor: function(context) {
                    const index = context.dataIndex;
                    const value = context.dataset.data[index];
                    if (value && value.y > threshold) {
                        return '#ffffff'; // White border for red dots
                    }
                    return colors.border;
                },
                pointRadius: function(context) {
                    const index = context.dataIndex;
                    const value = context.dataset.data[index];
                    if (value && value.y > threshold) {
                        return 5; // Larger warning dots
                    }
                    return 2;
                },
                pointHoverRadius: 7,
                fill: true,
                tension: 0.4 // Smooth curves
            });
        }

        energyChart.data.datasets = datasets;
        energyChart.update('none'); // Update without animation for smoother polling
    }

    // Function to update the recent logs table
    function updateTable(data) {
        if (!logsTableBody) return;
        logsTableBody.innerHTML = '';
        
        // Show only the latest 15 items in the table
        const recentData = [...data].reverse().slice(0, 15);
        
        recentData.forEach(item => {
            const timeStr = moment(item.timestamp).format('HH:mm:ss');
            
            // Get color indicator
            let colorDot = '#ec4899';
            if (deviceColors[item.device_name]) {
                colorDot = deviceColors[item.device_name].border;
            }
            
            // Check if value exceeds threshold
            const threshold = deviceThresholds[item.device_name] || 999.0;
            const isExceeded = item.power_consumption > threshold;
            
            const tr = document.createElement('tr');
            if (isExceeded) {
                tr.style.backgroundColor = 'rgba(239, 68, 68, 0.05)';
            }
            
            const badgeHtml = isExceeded 
                ? `<span class="badge bg-danger ms-2"><i class="fa-solid fa-triangle-exclamation"></i> 高耗電</span>` 
                : '';
                
            const usageClass = isExceeded ? 'text-danger fw-bold' : 'fw-bold';
            
            tr.innerHTML = `
                <td class="text-muted"><small>${timeStr}</small></td>
                <td>
                    <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:${colorDot}; margin-right:6px;"></span>
                    ${item.device_name.split(' ')[0]} 
                </td>
                <td class="text-end ${usageClass}">
                    ${item.power_consumption.toFixed(2)} ${badgeHtml}
                </td>
            `;
            logsTableBody.appendChild(tr);
        });
    }

    // Function to fetch system status and update Edge AI Health on homepage
    async function fetchSystemStatus() {
        try {
            const response = await fetch('/api/system/status');
            if (response.status === 401) return;
            const data = await response.json();
            
            const idMap = {
                'Device-A (Chiller)': 'chiller',
                'Device-B (Air Compressor)': 'compressor',
                'Device-C (HVAC)': 'hvac'
            };
            
            let hasAnomaly = false;
            
            data.forEach(device => {
                const key = idMap[device.device_name];
                if (!key) return;
                
                const score = device.health_score;
                if (score < 80) {
                    hasAnomaly = true;
                }
                
                const scoreEl = document.getElementById(`index-${key}-health`);
                const barEl = document.getElementById(`index-${key}-bar`);
                
                if (scoreEl) scoreEl.textContent = `${score}%`;
                if (barEl) {
                    barEl.style.width = `${score}%`;
                    
                    // Reset class names
                    barEl.className = 'progress-bar';
                    if (score >= 90) {
                        barEl.classList.add('bg-success');
                    } else if (score >= 80) {
                        barEl.classList.add('bg-info');
                    } else {
                        barEl.classList.add('bg-danger');
                    }
                }
            });
            
            const bannerEl = document.getElementById('ai-anomaly-banner');
            if (bannerEl) {
                if (hasAnomaly) {
                    bannerEl.classList.remove('d-none');
                } else {
                    bannerEl.classList.add('d-none');
                }
            }
        } catch (error) {
            console.error('Error fetching system status on index:', error);
        }
    }

    // Event Listeners
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            fetchData();
            fetchSystemStatus();
        });
    }

    // Initial fetch
    fetchData();
    fetchSystemStatus();

    // Setup polling every 3 seconds
    setInterval(() => {
        fetchData();
        fetchSystemStatus();
    }, 3000);
});
