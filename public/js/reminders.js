/* Habit-anchor reminders: reliable while FitPulse is open; the service worker
   displays the notification when the browser permits it. */
(function () {
  const STORAGE_KEY = 'fp_habit_time';
  let reminderTimer = null;

  function nextDelay(time) {
    if (!/^\d{2}:\d{2}$/.test(time || '')) return null;
    const [hours, minutes] = time.split(':').map(Number);
    const next = new Date();
    next.setHours(hours, minutes, 0, 0);
    if (next <= new Date()) next.setDate(next.getDate() + 1);
    return Math.max(0, next.getTime() - Date.now());
  }

  async function notify() {
    const user = typeof api !== 'undefined' ? api.user() : null;
    const name = user?.name?.split(' ')[0] || 'Hunter';
    const body = `Time for your ${localStorage.getItem('fp_theme') === 'hunter' ? 'Hunter Mode quest' : 'workout'}, ${name}!`;
    try {
      const registration = await navigator.serviceWorker?.ready;
      if (registration) await registration.showNotification('FitPulse · Move your body', {
        body,
        icon: '/assets/fitpulse-mark.png',
        badge: '/assets/fitpulse-mark.png',
        tag: 'fitpulse-habit-reminder',
        renotify: true,
        data: { url: '/planner.html' }
      });
      else if ('Notification' in window && Notification.permission === 'granted') new Notification('FitPulse · Move your body', { body });
    } catch (error) {
      console.warn('Could not show workout reminder', error);
    }
  }

  function schedule() {
    clearTimeout(reminderTimer);
    const time = localStorage.getItem(STORAGE_KEY);
    const delay = nextDelay(time);
    if (delay == null) return;
    reminderTimer = window.setTimeout(async () => {
      await notify();
      schedule();
    }, delay);
  }

  async function save(time) {
    if (!/^\d{2}:\d{2}$/.test(time || '')) throw new Error('Choose a workout time first.');
    if (!('Notification' in window)) throw new Error('Notifications are not supported by this browser.');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Allow notifications to turn on your workout reminder.');
    localStorage.setItem(STORAGE_KEY, time);
    schedule();
    return time;
  }

  window.HabitReminders = { save, schedule, getTime: () => localStorage.getItem(STORAGE_KEY) || '' };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule);
  else schedule();
})();
