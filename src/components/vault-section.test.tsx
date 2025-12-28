import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VaultSection } from './vault-section';
import { useAppStore } from '@/store/useAppStore';

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'mock-url');
global.URL.revokeObjectURL = vi.fn();

// Mock toast
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

describe('VaultSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly', () => {
    render(<VaultSection />);
    expect(screen.getByText('Vault Management')).toBeInTheDocument();
    expect(screen.getByText('Export Vault')).toBeInTheDocument();
    expect(screen.getByText('Import Vault')).toBeInTheDocument();
  });

  it('triggers export flow', () => {
    const mockExportVault = vi.fn(() => JSON.stringify({ flows: [] }));
    useAppStore.setState({ exportVault: mockExportVault });

    render(<VaultSection />);
    fireEvent.click(screen.getByText('Export Vault'));

    expect(mockExportVault).toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Vault Exported',
    }));
  });

  it('triggers import flow', async () => {
    const mockImportVault = vi.fn(() => ({ success: true, message: 'Success' }));
    useAppStore.setState({ importVault: mockImportVault });

    const { container } = render(<VaultSection />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    
    const file = new File(['{"flows":[]}'], 'vault.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockImportVault).toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Vault Imported',
      }));
    });
  });
});
