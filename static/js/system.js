document.addEventListener('DOMContentLoaded', function() {
    
    // Mapping from database device name to CSS IDs
    const idMap = {
        'Device-A (Chiller)': 'chiller',
        'Device-B (Air Compressor)': 'compressor',
        'Device-C (HVAC)': 'hvac'
    };

    // Keep track of devices currently undergoing simulated OTA updates
    const updatingOTA = {};

    // Function to fetch system status and update UI
    async function fetchSystemStatus() {
        try {
            const response = await fetch('/api/system/status');
            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }
            const data = await response.json();
            
            data.forEach(device => {
                const key = idMap[device.device_name];
                if (!key) return;
                
                // 1. Update Edge AI health indicators
                const score = device.health_score;
                const scoreEl = document.getElementById(`${key}-health-score`);
                const barEl = document.getElementById(`${key}-health-bar`);
                const badgeEl = document.getElementById(`${key}-health-badge`);
                const descEl = document.getElementById(`${key}-status-desc`);
                
                if (scoreEl) scoreEl.textContent = `${score}%`;
                if (barEl) {
                    barEl.style.width = `${score}%`;
                    // Adjust bar colors dynamically
                    barEl.className = 'progress-bar-fill';
                    if (score >= 90) {
                        barEl.classList.add('bg-success');
                        badgeEl.className = 'badge bg-success';
                        badgeEl.textContent = '🟢 運行良好';
                        descEl.textContent = 'Edge AI 分析：運轉效率最佳，無磨損微兆。';
                    } else if (score >= 80) {
                        barEl.classList.add('bg-info');
                        badgeEl.className = 'badge bg-info';
                        badgeEl.textContent = '🔵 狀態正常';
                        descEl.textContent = 'Edge AI 分析：有微弱噪音，持續監控中。';
                    } else {
                        barEl.classList.add('bg-danger');
                        badgeEl.className = 'badge bg-danger';
                        badgeEl.textContent = '🔴 異常預警';
                        descEl.innerHTML = '<span class="text-danger fw-bold">⚠️ AI 檢測異常：零件微弱損耗，已自動建立報修單。</span>';
                    }
                }
                
                // 2. Update OTA versions (unless currently updating in frontend animation)
                if (!updatingOTA[device.device_name]) {
                    const verEl = document.getElementById(`${key}-version`);
                    if (verEl) verEl.textContent = device.firmware_version;
                    
                    const statusEl = document.getElementById(`${key}-ota-status`);
                    if (statusEl) {
                        statusEl.textContent = `最新版本 (更新於 ${device.last_update_time.split(' ')[0]})`;
                    }
                }
                
                // 3. Update Matter pairing states
                const isPaired = device.matter_paired === 1;
                const circleEl = document.getElementById(`node-${key}`);
                const linkEl = document.getElementById(`link-${key}`);
                const buttonBadgeEl = document.getElementById(`badge-matter-${key}`);
                
                if (circleEl) {
                    if (isPaired) {
                        circleEl.setAttribute('class', 'node-circle paired');
                        circleEl.setAttribute('fill', '#10b981');
                    } else {
                        circleEl.setAttribute('class', 'node-circle unpaired');
                        circleEl.setAttribute('fill', '#ef4444');
                    }
                }
                if (linkEl) {
                    if (isPaired) {
                        linkEl.classList.add('paired');
                    } else {
                        linkEl.classList.remove('paired');
                    }
                }
                if (buttonBadgeEl) {
                    if (isPaired) {
                        buttonBadgeEl.className = 'badge bg-success';
                        buttonBadgeEl.textContent = '已配網';
                    } else {
                        buttonBadgeEl.className = 'badge bg-danger';
                        buttonBadgeEl.textContent = '未配網';
                    }
                }
            });
            
        } catch (error) {
            console.error('Error fetching system status:', error);
        }
    }

    // Handle OTA Update clicks
    document.querySelectorAll('.btn-ota').forEach(button => {
        button.addEventListener('click', async function() {
            const deviceName = this.getAttribute('data-device');
            const key = idMap[deviceName];
            if (!key || updatingOTA[deviceName]) return;
            
            updatingOTA[deviceName] = true;
            this.disabled = true;
            this.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 更新中';
            
            const progressContainer = document.getElementById(`${key}-ota-progress-container`);
            const progressBar = document.getElementById(`${key}-ota-progress`);
            const statusEl = document.getElementById(`${key}-ota-status`);
            
            if (progressContainer && progressBar && statusEl) {
                progressContainer.classList.remove('d-none');
                statusEl.classList.add('d-none');
                progressBar.style.width = '0%';
                
                // Animate progress bar in frontend
                let progress = 0;
                const interval = setInterval(async () => {
                    progress += 10;
                    progressBar.style.width = `${progress}%`;
                    
                    if (progress >= 100) {
                        clearInterval(interval);
                        
                        // Call backend API to confirm version bump
                        try {
                            const formData = new FormData();
                            formData.append('device_name', deviceName);
                            
                            const response = await fetch('/api/system/ota-update', {
                                method: 'POST',
                                body: formData
                            });
                            const result = await response.json();
                            
                            if (response.ok) {
                                document.getElementById(`${key}-version`).textContent = result.new_version;
                                statusEl.textContent = 'OTA 更新完成！';
                            } else {
                                statusEl.textContent = '更新失敗';
                            }
                        } catch (e) {
                            console.error(e);
                            statusEl.textContent = '連線錯誤';
                        }
                        
                        setTimeout(() => {
                            progressContainer.classList.add('d-none');
                            statusEl.classList.remove('d-none');
                            this.disabled = false;
                            this.innerHTML = '<i class="fa-solid fa-rotate"></i> 更新';
                            updatingOTA[deviceName] = false;
                            fetchSystemStatus(); // Refresh data
                        }, 1000);
                    }
                }, 300);
            }
        });
    });

    // Handle Matter pairing toggle clicks
    document.querySelectorAll('.btn-matter').forEach(button => {
        button.addEventListener('click', async function() {
            const deviceName = this.getAttribute('data-device');
            const key = idMap[deviceName];
            if (!key) return;
            
            try {
                const formData = new FormData();
                formData.append('device_name', deviceName);
                
                const response = await fetch('/api/system/matter-toggle', {
                    method: 'POST',
                    body: formData
                });
                
                if (response.ok) {
                    fetchSystemStatus(); // Refresh nodes
                }
            } catch (error) {
                console.error('Error toggling Matter state:', error);
            }
        });
    });

    // Initial fetch
    fetchSystemStatus();
    // Poll every 3 seconds
    setInterval(fetchSystemStatus, 3000);
});
