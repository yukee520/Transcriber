import { useCallback, useState } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import Toast from 'react-native-toast-message';

export interface PermissionResult {
  granted: boolean;
  neverAskAgain?: boolean;
}

interface UsePermissionsResult {
  requesting: boolean;
  requestNotifications: () => Promise<PermissionResult>;
  requestStorage: () => Promise<PermissionResult>;
}

async function requestAndroidNotification(): Promise<PermissionResult> {
  if (Platform.OS !== 'android') return { granted: true };
  if (Platform.Version < 33) return { granted: true };
  try {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    return {
      granted: result === PermissionsAndroid.RESULTS.GRANTED,
      neverAskAgain: result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
    };
  } catch {
    return { granted: false };
  }
}

async function requestAndroidStorage(): Promise<PermissionResult> {
  if (Platform.OS !== 'android') return { granted: true };
  if (Platform.Version >= 33) return { granted: true };
  try {
    const permission =
      Platform.Version >= 29
        ? PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
        : PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE;
    const result = await PermissionsAndroid.request(permission);
    return {
      granted: result === PermissionsAndroid.RESULTS.GRANTED,
      neverAskAgain: result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
    };
  } catch {
    return { granted: false };
  }
}

export function usePermissions(): UsePermissionsResult {
  const [requesting, setRequesting] = useState(false);

  const requestNotifications =
    useCallback(async (): Promise<PermissionResult> => {
      setRequesting(true);
      try {
        const result = await requestAndroidNotification();
        if (!result.granted) {
          Toast.show({
            type: 'info',
            text1: 'Notifications disabled',
            text2: 'You can enable them later in system settings.',
            position: 'bottom',
          });
        }
        return result;
      } finally {
        setRequesting(false);
      }
    }, []);

  const requestStorage = useCallback(async (): Promise<PermissionResult> => {
    setRequesting(true);
    try {
      const result = await requestAndroidStorage();
      if (!result.granted) {
        Toast.show({
          type: 'info',
          text1: 'Storage access limited',
          text2: 'Transcripts will still be saved to app storage.',
          position: 'bottom',
        });
      }
      return result;
    } finally {
      setRequesting(false);
    }
  }, []);

  return { requesting, requestNotifications, requestStorage };
}