chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "contentScriptLoaded") {
        console.log("Content script loaded in tab:", sender.tab.id);
    }
    if (request.type === 'showNotification') {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon.png',
            title: 'Pomodoro Timer',
            message: request.message
        });
    }
});

chrome.storage.sync.get('blockedSites', (result) => {
    const blockedSites = result && result.blockedSites ? result.blockedSites : [];
    
    if (chrome.webNavigation && chrome.webNavigation.onBeforeNavigate) {
        chrome.webNavigation.onBeforeNavigate.addListener((details) => {
            const url = new URL(details.url);
            if (blockedSites.some(site => url.hostname.includes(site))) {
                chrome.tabs.update(details.tabId, {url: 'blocked.html'});
            }
        });
    }
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'pomodoroReset') {
        chrome.storage.sync.set({completedPomodoros: 0});
    }
});

// 每天凌晨重置番茄钟计数
chrome.alarms.create('pomodoroReset', {
    when: Date.now() + (24 - new Date().getHours()) * 60 * 60 * 1000,
    periodInMinutes: 24 * 60
});

// 添加以下代码到文件末尾
let timerInterval;

function startTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    timerInterval = setInterval(() => {
        chrome.runtime.sendMessage({action: "timerTick"});
    }, 1000);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "startTimer") {
        startTimer();
    } else if (request.action === "stopTimer") {
        if (timerInterval) {
            clearInterval(timerInterval);
        }
    }
});

chrome.storage.onChanged.addListener((changes, namespace) => {
    if (changes.isRunning) {
        if (changes.isRunning.newValue) {
            startTimer();
        } else {
            if (timerInterval) {
                clearInterval(timerInterval);
            }
        }
    }
});