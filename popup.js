document.addEventListener('DOMContentLoaded', initializePopup);

function initializePopup() {
    let timerInterval;
    let isRunning = false;
    let remainingTime = 25 * 60;
    let isPomodoro = true;
    let completedPomodoros = 0;

    const timerText = document.getElementById('timer-text');
    const timerProgress = document.getElementById('timer-progress');
    const startStopButton = document.getElementById('start-stop');
    const tomatoContainer = document.getElementById('tomato-container');
    const pomodoroTimeSlider = document.getElementById('pomodoro-time');
    const breakTimeSlider = document.getElementById('break-time');
    const pomodoroTimeValue = document.getElementById('pomodoro-time-value');
    const breakTimeValue = document.getElementById('break-time-value');
    const blockedSites = document.getElementById('blocked-sites');

    function updateTimerDisplay() {
        const minutes = Math.floor(remainingTime / 60);
        const seconds = remainingTime % 60;
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        timerText.textContent = timeString;

        const totalTime = isPomodoro ? pomodoroTimeSlider.value * 60 : breakTimeSlider.value * 60;
        const progress = 1 - (remainingTime / totalTime);
        const circumference = 2 * Math.PI * 40;
        timerProgress.style.strokeDasharray = circumference;
        timerProgress.style.strokeDashoffset = circumference * (1 - progress);

        // 更新颜色
        if (progress > 0.75) {
            timerProgress.classList.remove('text-orange-500');
            timerProgress.classList.add('text-red-500');
        } else if (progress > 0.5) {
            timerProgress.classList.remove('text-red-500', 'text-orange-300');
            timerProgress.classList.add('text-orange-500');
        } else if (progress > 0.25) {
            timerProgress.classList.remove('text-orange-500', 'text-orange-300');
            timerProgress.classList.add('text-orange-400');
        } else {
            timerProgress.classList.remove('text-orange-400');
            timerProgress.classList.add('text-orange-300');
        }

        sendMessageToContentScript({
            action: "updateTimer",
            time: timeString,
            progress: progress,
            isRunning: isRunning
        }).catch(error => console.error('Failed to update widget:', error));
    }

    function startTimer() {
        if (!isRunning) {
            isRunning = true;
            startStopButton.textContent = 'Pause';
            startStopButton.style.backgroundColor = '#e55a3c';
        } else {
            isRunning = false;
            startStopButton.textContent = 'Start';
            startStopButton.style.backgroundColor = '#ff6347';
        }

        // 同步 widget 的按钮状态
        sendMessageToContentScript({
            action: "updateTimerState",
            isRunning: isRunning,
            remainingTime: remainingTime,
            totalTime: isPomodoro ? pomodoroTimeSlider.value * 60 : breakTimeSlider.value * 60
        }).catch(error => console.error('Failed to update widget timer state:', error));

        // 保存计时器状态
        chrome.storage.sync.set({ isRunning, remainingTime, isPomodoro });
    }

    function updateTimer() {
        if (isRunning) {
            remainingTime--;
            if (remainingTime <= 0) {
                if (isPomodoro) {
                    completedPomodoros++;
                    updateTomatoDisplay();
                    chrome.runtime.sendMessage({type: 'showNotification', message: 'Pomodoro finished! Time for a break!'});
                    remainingTime = breakTimeSlider.value * 60;
                    isPomodoro = false;
                } else {
                    chrome.runtime.sendMessage({type: 'showNotification', message: 'Break finished! Start a new Pomodoro!'});
                    remainingTime = pomodoroTimeSlider.value * 60;
                    isPomodoro = true;
                }
                isRunning = false;
                startStopButton.textContent = 'Start';
                startStopButton.style.backgroundColor = '#ff6347';
            }
            updateTimerDisplay();
            // 保存状态
            chrome.storage.sync.set({ isRunning, remainingTime, isPomodoro, completedPomodoros });
        }
    }

    function updateTomatoDisplay() {
        tomatoContainer.innerHTML = '';
        for (let i = 0; i < completedPomodoros; i++) {
            const tomato = document.createElement('div');
            tomato.className = 'w-6 h-6 bg-red-500 rounded-full';
            tomatoContainer.appendChild(tomato);
        }
    }

    startStopButton.addEventListener('click', startTimer);

    pomodoroTimeSlider.addEventListener('input', () => {
        pomodoroTimeValue.textContent = pomodoroTimeSlider.value;
        if (isPomodoro && !isRunning) {
            remainingTime = pomodoroTimeSlider.value * 60;
            updateTimerDisplay();
        }
    });

    breakTimeSlider.addEventListener('input', () => {
        breakTimeValue.textContent = breakTimeSlider.value;
        if (!isPomodoro && !isRunning) {
            remainingTime = breakTimeSlider.value * 60;
            updateTimerDisplay();
        }
    });

    blockedSites.addEventListener('change', () => {
        chrome.storage.sync.set({blockedSites: blockedSites.value.split('\n')});
    });

    document.getElementById('toggle-widget').addEventListener('click', () => {
        sendMessageToContentScript({action: "toggleWidget"})
            .then(() => window.close())
            .catch(error => {
                console.error('Failed to toggle widget:', error);
                if (error.message === "Cannot access chrome:// URLs") {
                    alert("Widget cannot be displayed on chrome:// pages.");
                } else {
                    alert("Failed to toggle widget. Please refresh the page and try again.");
                }
            });
    });

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "timerTick") {
            updateTimer();
        }
    });

    chrome.storage.sync.get(['completedPomodoros', 'blockedSites'], (result) => {
        completedPomodoros = result.completedPomodoros || 0;
        updateTomatoDisplay();
        blockedSites.value = result.blockedSites ? result.blockedSites.join('\n') : '';
    });

    chrome.storage.sync.get(['isRunning', 'remainingTime', 'isPomodoro'], (result) => {
        if (result.isRunning) {
            isRunning = result.isRunning;
            remainingTime = result.remainingTime;
            isPomodoro = result.isPomodoro;
            startTimer();
        }
        updateTimerDisplay();
    });
}

function sendMessageToContentScript(message) {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0]) {
                if (tabs[0].url.startsWith("chrome://")) {
                    reject(new Error("Cannot access chrome:// URLs"));
                    return;
                }
                chrome.tabs.sendMessage(tabs[0].id, {action: "isContentScriptLoaded"}, function(response) {
                    if (chrome.runtime.lastError) {
                        console.log("Content script not loaded yet. Injecting now.");
                        chrome.scripting.executeScript({
                            target: {tabId: tabs[0].id},
                            files: ['content.js']
                        }, function() {
                            if (chrome.runtime.lastError) {
                                reject(chrome.runtime.lastError);
                            } else {
                                // Wait a bit for the content script to initialize
                                setTimeout(() => {
                                    chrome.tabs.sendMessage(tabs[0].id, message, function(response) {
                                        if (chrome.runtime.lastError) {
                                            reject(chrome.runtime.lastError);
                                        } else {
                                            resolve(response);
                                        }
                                    });
                                }, 100);
                            }
                        });
                    } else {
                        chrome.tabs.sendMessage(tabs[0].id, message, function(response) {
                            if (chrome.runtime.lastError) {
                                reject(chrome.runtime.lastError);
                            } else {
                                resolve(response);
                            }
                        });
                    }
                });
            } else {
                reject(new Error('No active tab'));
            }
        });
    });
}