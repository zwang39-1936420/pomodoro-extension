console.log('Content script loaded');

let pomodoroWidget;
let isDragging = false;
let startX, startY;

function createPomodoroWidget() {
  pomodoroWidget = document.createElement('div');
  pomodoroWidget.id = 'pomodoro-widget';
  pomodoroWidget.innerHTML = `
    <div class="widget-header">
      <span class="widget-title">Pomodoro Timer</span>
      <button class="minimize-btn">_</button>
    </div>
    <div class="widget-content">
      <div class="timer-circle">
        <svg viewBox="0 0 100 100">
          <circle class="timer-background" cx="50" cy="50" r="45" />
          <circle class="timer-progress" cx="50" cy="50" r="45" />
        </svg>
        <span class="timer-text">25:00</span>
      </div>
      <button class="start-stop-btn">
        Start
      </button>
    </div>
  `;
  document.body.appendChild(pomodoroWidget);

  const header = pomodoroWidget.querySelector('.widget-header');
  header.addEventListener('mousedown', startDragging);
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', stopDragging);

  const minimizeBtn = pomodoroWidget.querySelector('.minimize-btn');
  minimizeBtn.addEventListener('click', toggleMinimize);

  const startStopBtn = pomodoroWidget.querySelector('.start-stop-btn');
  startStopBtn.addEventListener('click', toggleTimer);

  chrome.storage.sync.get(['widgetPosition'], (result) => {
    if (result.widgetPosition) {
      pomodoroWidget.style.left = result.widgetPosition.left;
      pomodoroWidget.style.top = result.widgetPosition.top;
    }
  });
}

function startDragging(e) {
  isDragging = true;
  startX = e.clientX - pomodoroWidget.offsetLeft;
  startY = e.clientY - pomodoroWidget.offsetTop;
}

function drag(e) {
  if (isDragging) {
    pomodoroWidget.style.left = `${e.clientX - startX}px`;
    pomodoroWidget.style.top = `${e.clientY - startY}px`;
  }
}

function stopDragging() {
  isDragging = false;
  chrome.storage.sync.set({
    widgetPosition: {
      left: pomodoroWidget.style.left,
      top: pomodoroWidget.style.top
    }
  });
}

function toggleMinimize() {
  pomodoroWidget.classList.toggle('minimized');
}

function toggleTimer() {
  // This function will be implemented to start/stop the timer
}

function updateWidgetTimer(time, progress, isRunning) {
  if (!pomodoroWidget) return;
  
  const timerText = pomodoroWidget.querySelector('.timer-text');
  const timerProgress = pomodoroWidget.querySelector('.timer-progress');
  const startStopBtn = pomodoroWidget.querySelector('.start-stop-btn');
  
  timerText.textContent = time;
  const circumference = 2 * Math.PI * 45;
  timerProgress.style.strokeDasharray = circumference;
  timerProgress.style.strokeDashoffset = circumference * (1 - progress);

  startStopBtn.textContent = isRunning ? 'Pause' : 'Start';
  startStopBtn.style.backgroundColor = isRunning ? '#e55a3c' : '#ff6347';
}

function toggleWidget() {
  if (pomodoroWidget) {
    pomodoroWidget.style.display = pomodoroWidget.style.display === 'none' ? 'block' : 'none';
  } else {
    createPomodoroWidget();
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received in content script:', request);
  if (request.action === "isContentScriptLoaded") {
    sendResponse({loaded: true});
  } else if (request.action === "updateTimer") {
    updateWidgetTimer(request.time, request.progress, request.isRunning);
  } else if (request.action === "toggleWidget") {
    toggleWidget();
  } else if (request.action === "updateTimerState") {
    updateWidgetTimer(request.time, request.progress, request.isRunning);
  }
  sendResponse({success: true});
  return true;  // This indicates we will send a response asynchronously
});

// Initialize the widget
createPomodoroWidget();