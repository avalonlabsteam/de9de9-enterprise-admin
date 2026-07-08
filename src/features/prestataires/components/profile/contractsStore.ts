// Contrat de partenariat — prototype-local UI state (logic.ts state.contracts +
// setContractFile / toggleContractStatus / removeContract). No API route exists
// for contracts, so this stays a client-side store seeded like the prototype.
import { create } from 'zustand';

export interface ContractRec {
  fileName: string;
  signedDate: string;
  validUntil: string;
  status: 'signed' | 'unsigned';
}

interface ContractsState {
  contracts: Record<string, ContractRec>;
}

export const useContractsStore = create<ContractsState>(() => ({
  contracts: {
    p1: {
      fileName: 'contrat-partenariat-electroplus-signe.pdf',
      signedDate: '12/03/2026',
      validUntil: '12/03/2027',
      status: 'signed',
    },
    p4: {
      fileName: 'contrat-partenariat-vertjardin-signe.pdf',
      signedDate: '05/01/2026',
      validUntil: '05/01/2027',
      status: 'signed',
    },
  },
}));

export const contractsActions = {
  /** logic.ts setContractFile — upload/replace marks the contract signed. */
  upload(id: string, fileName: string): void {
    useContractsStore.setState((s) => {
      const cur = s.contracts[id];
      const today = new Date().toLocaleDateString('fr-FR');
      return {
        contracts: {
          ...s.contracts,
          [id]: {
            fileName,
            signedDate: cur?.signedDate ?? today,
            validUntil: cur?.validUntil ?? '',
            status: 'signed',
          },
        },
      };
    });
  },
  /** logic.ts toggleContractStatus. */
  toggle(id: string): void {
    useContractsStore.setState((s) => {
      const cur = s.contracts[id];
      if (!cur) return s;
      return {
        contracts: {
          ...s.contracts,
          [id]: { ...cur, status: cur.status === 'signed' ? 'unsigned' : 'signed' },
        },
      };
    });
  },
  /** logic.ts removeContract. */
  remove(id: string): void {
    useContractsStore.setState((s) => {
      const next = { ...s.contracts };
      delete next[id];
      return { contracts: next };
    });
  },
};
