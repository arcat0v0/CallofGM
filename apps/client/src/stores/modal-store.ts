import { useEffect } from "react";
import { create } from "zustand";

export const BlockingModalPriority = {
  end: 40,
  check: 30,
  handout: 20,
  library: 10,
  sheet: 5,
} as const;

export type BlockingModal = keyof typeof BlockingModalPriority;

export type BlockingModalOpen = Record<BlockingModal, boolean>;

const closedModals: BlockingModalOpen = {
  end: false,
  check: false,
  handout: false,
  library: false,
  sheet: false,
};

export function activeBlockingModal(open: BlockingModalOpen): BlockingModal | null {
  let active: BlockingModal | null = null;
  for (const modal of Object.keys(BlockingModalPriority) as BlockingModal[]) {
    if (!open[modal]) {
      continue;
    }
    if (active === null || BlockingModalPriority[modal] > BlockingModalPriority[active]) {
      active = modal;
    }
  }
  return active;
}

type ModalState = {
  open: BlockingModalOpen;
  setModalOpen: (modal: BlockingModal, open: boolean) => void;
  reset: () => void;
};

export const useModalStore = create<ModalState>((set) => ({
  open: { ...closedModals },
  setModalOpen: (modal, open) =>
    set((state) => (state.open[modal] === open ? {} : { open: { ...state.open, [modal]: open } })),
  reset: () => set({ open: { ...closedModals } }),
}));

export function useActiveBlockingModal(): BlockingModal | null {
  return useModalStore((state) => activeBlockingModal(state.open));
}

export function useBlockingModalOpen(): boolean {
  return useActiveBlockingModal() !== null;
}

export function useBlockingDialog(
  modal: BlockingModal,
  requested: boolean,
  onRequestedChange: (open: boolean) => void,
): { open: boolean; onOpenChange: (open: boolean) => void } {
  const active = useActiveBlockingModal();
  const setModalOpen = useModalStore((state) => state.setModalOpen);

  useEffect(() => {
    setModalOpen(modal, requested);
  }, [modal, requested, setModalOpen]);

  useEffect(() => () => setModalOpen(modal, false), [modal, setModalOpen]);

  return {
    open: requested && active === modal,
    onOpenChange: (open: boolean) => {
      setModalOpen(modal, open);
      onRequestedChange(open);
    },
  };
}
