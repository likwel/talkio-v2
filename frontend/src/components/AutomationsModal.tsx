import Modal from '@/components/Modal';
import AutomationsPanel from '@/components/AutomationsPanel';
import { useT } from '@/i18n';

export default function AutomationsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  return (
    <Modal open={open} onClose={onClose} size="lg" title={t('auto.title')}>
      <AutomationsPanel />
    </Modal>
  );
}
