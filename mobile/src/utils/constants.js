// Production Cloud Backend API URL hosted on Render
export const API_BASE_URL = 'https://nomi-vgxi.onrender.com';
export const SOCKET_URL = API_BASE_URL;

console.log('[ChatLoop Client] Connected to 24/7 Cloud Backend:', API_BASE_URL);

export const STORAGE_KEYS = {
  AUTH_TOKEN: '@chatloop_auth_token',
  USER_DATA: '@chatloop_user_data',
  THEME_MODE: '@chatloop_theme_mode',
};
