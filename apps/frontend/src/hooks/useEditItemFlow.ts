import { useSnackbar } from 'notistack';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CreateItemData, Item, useItems } from './useItems';

export interface EditItemFlowState {
  isOpen: boolean;
  editingItem: Item | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
}

export interface EditItemFlowActions {
  openEditDialog: (item: Item) => void;
  closeEditDialog: () => void;
  saveItem: (
    itemId: string,
    updateData: Partial<CreateItemData>
  ) => Promise<boolean>;
  resetState: () => void;
}

export const useEditItemFlow = (
  businessId?: string
): EditItemFlowState & EditItemFlowActions => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const {
    updateItem,
    loading: itemsLoading,
    error: itemsError,
  } = useItems(businessId);

  const [state, setState] = useState<EditItemFlowState>({
    isOpen: false,
    editingItem: null,
    isLoading: false,
    isSaving: false,
    error: null,
  });

  const openEditDialog = useCallback((item: Item) => {
    setState((prev) => ({
      ...prev,
      isOpen: true,
      editingItem: item,
      error: null,
    }));
  }, []);

  const closeEditDialog = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isOpen: false,
      editingItem: null,
      error: null,
    }));
  }, []);

  const saveItem = useCallback(
    async (
      itemId: string,
      updateData: Partial<CreateItemData>
    ): Promise<boolean> => {
      setState((prev) => ({
        ...prev,
        isSaving: true,
        error: null,
      }));

      try {
        await updateItem(itemId, updateData);

        enqueueSnackbar(t('business.inventory.itemUpdatedSuccessfully'), {
          variant: 'success',
        });

        setState((prev) => ({
          ...prev,
          isSaving: false,
          isOpen: false,
          editingItem: null,
        }));

        return true;
      } catch (error) {
        console.error('Failed to update item:', error);

        const errorMessage =
          error instanceof Error
            ? error.message
            : t('business.inventory.failedToUpdateItem');

        setState((prev) => ({
          ...prev,
          isSaving: false,
          error: errorMessage,
        }));

        enqueueSnackbar(errorMessage, {
          variant: 'error',
        });

        return false;
      }
    },
    [updateItem, enqueueSnackbar, t]
  );

  const resetState = useCallback(() => {
    setState({
      isOpen: false,
      editingItem: null,
      isLoading: false,
      isSaving: false,
      error: null,
    });
  }, []);

  return {
    // State
    isOpen: state.isOpen,
    editingItem: state.editingItem,
    isLoading: itemsLoading,
    isSaving: state.isSaving,
    error: state.error || itemsError,

    // Actions
    openEditDialog,
    closeEditDialog,
    saveItem,
    resetState,
  };
};
