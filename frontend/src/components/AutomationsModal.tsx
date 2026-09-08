import Modal from '@/components/Modal';
import AutomationsPanel from '@/components/AutomationsPanel';

export default function AutomationsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} size="lg" title="Automatisation">
      <AutomationsPanel />
    </Modal>
  );
}
