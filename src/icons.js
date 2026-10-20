import {HABIT_ICON_PATHS} from './habit-icons.js';

// Navigation and habits share a grid, but have separate names and meanings.
export const UI_ICON_PATHS={
 today:'<rect x="4.5" y="5.5" width="15" height="15" rx="1.5"/><path d="M8 3.5v4m8-4v4m-11.5 3h15m-11 4.5 2 2 4-4"/>',
 templates:'<path d="M7 3.5h11.5A1.5 1.5 0 0 1 20 5v15.5H7a3 3 0 0 1-3-3V6.5a3 3 0 0 1 3-3Zm0 0v17M4 17.5h3m4-9h5m-5 4h4"/>',
 goals:'<path d="M5.5 21V4m0 1c4-4 9 4 13 0v10c-4 4-9-4-13 0"/>',
 gift:'<rect x="4.5" y="10" width="15" height="10.5" rx="1"/><path d="M3.5 7h17v3h-17zM12 7v13.5m0-13.5C6 8 5.5 2 8.5 3.5 10 4 11 6 12 7Zm0 0c6 1 6.5-5 3.5-3.5C14 4 13 6 12 7Z"/>',
 history:'<path d="M4.5 8a8 8 0 1 1-.2 7M4.5 3.5V8H9m3-.5V12l3 2"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 check:'<path d="m5.5 12 4 4 9-9"/>',
 close:'<path d="m6 6 12 12M18 6 6 18"/>',
 coin:'<circle cx="12" cy="12" r="8"/><path d="M9.5 16V8h3a2.5 2.5 0 0 1 0 5h-3"/>',
 arrow:'<path d="M4.5 12h15m-5-5 5 5-5 5"/>',
 'chevron-left':'<path d="m14.5 6.5-5.5 5.5 5.5 5.5"/>',
 'chevron-right':'<path d="m9.5 6.5 5.5 5.5-5.5 5.5"/>',
 calendar:'<rect x="4.5" y="5.5" width="15" height="15" rx="1.5"/><path d="M8 3.5v4m8-4v4m-11.5 3h15M8.5 14h.01M12 14h.01M15.5 14h.01M8.5 17h.01M12 17h.01"/>',
 settings:'<path d="M4 7.5h4m5 0h7m-16 9h7m5 0h4"/><circle cx="10.5" cy="7.5" r="2.5"/><circle cx="13.5" cy="16.5" r="2.5"/>',
 lock:'<rect x="5.5" y="10.5" width="13" height="10" rx="1.5"/><path d="M8 10.5v-3a4 4 0 0 1 8 0v3m-4 4v2"/>',
 more:'<path d="M5 12h.01M12 12h.01M19 12h.01"/>'
};

export function renderIcon(name){
 const path=UI_ICON_PATHS[name]||HABIT_ICON_PATHS[name]||UI_ICON_PATHS.today;
 return `<svg class="app-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${path}</svg>`;
}
