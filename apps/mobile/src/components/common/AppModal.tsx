import { Modal, ModalProps, Platform } from 'react-native';

/** Android edge-to-edge requires matching status + navigation bar translucency on Modal. */
const ANDROID_EDGE_TO_EDGE_MODAL_PROPS: Partial<ModalProps> =
  Platform.OS === 'android'
    ? { statusBarTranslucent: true, navigationBarTranslucent: true }
    : {};

export function AppModal(props: ModalProps) {
  return <Modal {...ANDROID_EDGE_TO_EDGE_MODAL_PROPS} {...props} />;
}
