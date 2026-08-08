import Constants from 'expo-constants';

// Dynamically extract the host IP address of your dev computer running Metro & Express
const getHostIp = () => {
  const hostUri = Constants.expoConfig?.hostUri || Constants.manifest?.hostUri || Constants.manifest2?.extra?.expoGo?.developer?.tool;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip) return ip;
  }
  // Fallback to laptop Wi-Fi IP address
  return '10.27.238.231';
};

const HOST_IP = getHostIp();

export const API_BASE_URL = `http://${HOST_IP}:5000`;
export const SOCKET_URL = API_BASE_URL;

console.log('[ChatLoop Client] Connecting API & Socket to backend URL:', API_BASE_URL);

export const STORAGE_KEYS = {
  AUTH_TOKEN: '@chatloop_auth_token',
  USER_DATA: '@chatloop_user_data',
  THEME_MODE: '@chatloop_theme_mode',
};
