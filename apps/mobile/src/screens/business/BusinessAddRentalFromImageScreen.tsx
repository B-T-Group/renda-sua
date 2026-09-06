import React, { useEffect } from 'react';
import { Alert, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { ActivityIndicator, Snackbar } from 'react-native-paper';
import { AddItemUploadStep } from '../../components/business/add-item/AddItemUploadStep';
import { AddRentalDetailsStep } from '../../components/business/add-rental/AddRentalDetailsStep';
import { AddRentalLocationStep } from '../../components/business/add-rental/AddRentalLocationStep';
import { AddRentalSuccessStep } from '../../components/business/add-rental/AddRentalSuccessStep';
import { BusinessListingWizardShell } from '../../components/business/BusinessListingWizardShell';
import { useBusinessAddRentalFromImage } from '../../hooks/business/useBusinessAddRentalFromImage';
import type { BusinessRootStackParamList } from '../../navigation/types';

const STEP_COUNT = 4;

export default function BusinessAddRentalFromImageScreen() {
  const { t } = useTranslation();
  const route =
    useRoute<RouteProp<BusinessRootStackParamList, 'BusinessAddRentalFromImage'>>();
  const returnToDashboard = route.params?.returnToDashboard === true;
  const wizard = useBusinessAddRentalFromImage();

  const handleRestart = () => {
    Alert.alert(
      t('business.rentals.wizard.restartTitle', 'Start over?'),
      t(
        'business.rentals.wizard.restartBody',
        'This will clear all your photos and progress. Are you sure?'
      ),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('business.rentals.wizard.restartConfirm', 'Start over'),
          style: 'destructive',
          onPress: () => wizard.resetWizard(),
        },
      ]
    );
  };

  useEffect(() => {
    if (
      !returnToDashboard ||
      wizard.step !== 3 ||
      !wizard.createdItem ||
      wizard.savedAsDraft
    ) {
      return;
    }
    wizard.navigation.replace('BusinessSetupStepSuccess', {
      step: 'catalog',
      variant: 'complete',
      isRental: true,
    });
  }, [
    returnToDashboard,
    wizard.step,
    wizard.createdItem,
    wizard.savedAsDraft,
    wizard.navigation,
  ]);

  const labels = [
    t('business.rentals.wizard.steps.upload', 'Photos'),
    t('business.rentals.wizard.steps.details', 'Details'),
    t('business.rentals.wizard.steps.location', 'Location & price'),
    t('business.rentals.wizard.steps.done', 'Done'),
  ];

  return (
    <BusinessListingWizardShell
      title={t('business.rentals.wizard.title', 'Add a rental from photos')}
      stepIndex={wizard.step}
      stepCount={STEP_COUNT}
      stepLabel={labels[wizard.step]}
      progressLabel={t('business.rentals.wizard.stepProgress', 'Step {{current}} of {{total}}', {
        current: wizard.step + 1,
        total: STEP_COUNT,
      })}
      onBack={wizard.goBack}
      onRestart={wizard.step < 3 ? handleRestart : undefined}
    >
      {wizard.step === 0 ? (
        <AddItemUploadStep
          assets={wizard.assets}
          busy={wizard.busy}
          profileLoading={wizard.profileLoading}
          canContinue={wizard.canContinueUpload}
          minPhotos={wizard.minPhotos}
          validationResults={wizard.validationResults}
          aiTokens={wizard.aiTokensRemaining}
          cleanupKinds={wizard.cleanupKinds}
          onCleanupKindChange={wizard.setCleanupKindAt}
          onBuyTokens={wizard.buyTokens}
          onPick={() => void wizard.pickImages()}
          onTakePhoto={() => void wizard.takePhoto()}
          onRemove={wizard.removeAssetAt}
          onSetMain={wizard.setMainAt}
          onContinue={() => void wizard.uploadAndContinue()}
        />
      ) : null}

      {wizard.step === 1 ? (
        <AddRentalDetailsStep
          imageIds={wizard.imageIds}
          busy={wizard.busy}
          onSubmit={(form) => void wizard.createItem(form)}
        />
      ) : null}

      {wizard.step === 2 && wizard.createdItem ? (
        <AddRentalLocationStep
          item={wizard.createdItem}
          busy={wizard.busy}
          previewImageUri={wizard.assets[0]?.uri}
          onFinish={(form, publish) => void wizard.finishWithLocation(form, publish)}
        />
      ) : null}

      {wizard.step === 3 &&
      wizard.createdItem &&
      returnToDashboard &&
      !wizard.savedAsDraft ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      ) : null}

      {wizard.step === 3 &&
      wizard.createdItem &&
      (!returnToDashboard || wizard.savedAsDraft) ? (
        <AddRentalSuccessStep
          item={wizard.createdItem}
          locationName={wizard.locationName}
          savedAsDraft={wizard.savedAsDraft}
          onBackToStudio={() =>
            wizard.navigation.navigate('BusinessRentalsStudio', { tab: 'catalog' })
          }
          onBackToDashboard={
            returnToDashboard
              ? () =>
                  wizard.navigation.navigate('BusinessMainTabs', {
                    screen: 'BusinessDashboard',
                  })
              : undefined
          }
          onViewItem={() =>
            wizard.navigation.replace('BusinessRentalItemDetail', {
              itemId: wizard.createdItem!.id,
            })
          }
          onAddAnother={() => {
            wizard.resetWizard();
          }}
        />
      ) : null}

      <Snackbar visible={!!wizard.snackbar} onDismiss={wizard.dismissSnackbar} duration={4000}>
        {wizard.snackbar}
      </Snackbar>
    </BusinessListingWizardShell>
  );
}
