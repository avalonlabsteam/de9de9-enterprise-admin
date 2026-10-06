import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Whether a live alert makes a sound on this browser — the speaker button of the drawer. */
interface SonState {
  actif: boolean;
}

export const useAlerteSonStore = create<SonState>()(
  persist((): SonState => ({ actif: true }), { name: 'de9de9-alertes-son' }),
);

export const alerteSonActions = {
  set: (actif: boolean): void => {
    useAlerteSonStore.setState({ actif });
  },
};
