import { create } from 'zustand';

/** Whose perspective the admin is currently inspecting (drives the "vous regardez" banner). */
export type RoleView = 'de9' | 'client' | 'prestataire';

interface UiState {
  roleView: RoleView;
}

export const useUiStore = create<UiState>()(() => ({ roleView: 'de9' as RoleView }));

export const uiActions = {
  setRoleView: (roleView: RoleView): void => {
    useUiStore.setState({ roleView });
  },
};
