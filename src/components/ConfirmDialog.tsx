import { Alert } from 'react-native';

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

export function showConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogOptions): void {
  Alert.alert(
    title,
    message,
    [
      {
        text: cancelLabel,
        style: 'cancel',
        onPress: onCancel,
      },
      {
        text: confirmLabel,
        style: destructive ? 'destructive' : 'default',
        onPress: onConfirm,
      },
    ],
    { cancelable: true, onDismiss: onCancel },
  );
}

export default showConfirmDialog;