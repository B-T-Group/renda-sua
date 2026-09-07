import React, { useEffect } from 'react';
import { Alert, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { ActivityIndicator, Snackbar } from 'react-native-paper';
import { AddItemAiReviewStep } from '../../components/business/add-item/AddItemAiReviewStep';
import { AddItemDescriptionStep } from '../../components/business/add-item/AddItemDescriptionStep';
import { AddItemFulfillmentStep } from '../../components/business/add-item/AddItemFulfillmentStep';
import { AddItemProcessingStep } from '../../components/business/add-item/AddItemProcessingStep';
import { AddItemPublishStep } from '../../components/business/add-item/AddItemPublishStep';
import { AddItemSuccessStep } from '../../components/business/add-item/AddItemSuccessStep';
import { AddItemUploadStep } from '../../components/business/add-item/AddItemUploadStep';
import { BusinessListingWizardShell } from '../../components/business/BusinessListingWizardShell';
import {
  SALE_STEP,
  SALE_STEP_COUNT,
  useBusinessAddItemFromImage,
} from '../../hooks/business/useBusinessAddItemFromImage';
import type { BusinessRootStackParamList } from '../../navigation/types';
import { trackProductCreateEvent } from '../../utils/productCreateAnalytics';

export default function BusinessAddItemFromImageScreen() {
  const { t } = useTranslation();
  const route =
    useRoute<RouteProp<BusinessRootStackParamList, 'BusinessAddItemFromImage'>>();
  const initialLocationId = route.params?.locationId;
  const returnToDashboard = route.params?.returnToDashboard === true;
  const wizard = useBusinessAddItemFromImage();

  const handleRestart = () => {
    Alert.alert(
      t('business.onboarding.firstSale.restartTitle', 'Start over?'),
      t(
        'business.onboarding.firstSale.restartBody',
        'This will clear all your photos and progress. Are you sure?'
      ),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('business.onboarding.firstSale.restartConfirm', 'Start over'),
          style: 'destructive',
          onPress: () => wizard.resetWizard(),
        },
      ]
    );
  };

  useEffect(() => {
    if (
      !returnToDashboard ||
      wizard.step !== SALE_STEP.done ||
      !wizard.createdItem ||
      wizard.savedAsDraft
    ) {
      return;
    }
    wizard.navigation.replace('BusinessSetupStepSuccess', {
      step: 'catalog',
      variant: 'complete',
      isRental: false,
    });
  }, [
    returnToDashboard,
    wizard.step,
    wizard.createdItem,
    wizard.savedAsDraft,
    wizard.navigation,
  ]);

  const labels = [
    t('business.onboarding.firstSale.steps.upload', 'Photos'),
    t('business.onboarding.firstSale.steps.description', 'Description'),
    t('business.onboarding.firstSale.steps.processing', 'Processing'),
    t('business.onboarding.firstSale.steps.review', 'Review'),
    t('business.onboarding.firstSale.steps.fulfillment', 'Fulfillment'),
    t('business.onboarding.firstSale.steps.publish', 'Publish'),
    t('business.onboarding.firstSale.steps.done', 'Done'),
  ];

  return (
    <BusinessListingWizardShell
      title={t(
        'business.onboarding.firstSale.titleAdditional',
        'Add a product from photos'
      )}
      stepIndex={wizard.step}
      stepCount={SALE_STEP_COUNT}
      stepLabel={labels[wizard.step] ?? labels[0]}
      progressLabel={t(
        'business.onboarding.firstSale.stepProgress',
        'Step {{current}} of {{total}}',
        {
          current: wizard.step + 1,
          total: SALE_STEP_COUNT,
        }
      )}
      onBack={wizard.goBack}
      onRestart={wizard.step < SALE_STEP.done ? handleRestart : undefined}
    >
      {wizard.step === SALE_STEP.photos ? (
        <AddItemUploadStep
          assets={wizard.assets}
          busy={wizard.busy}
          profileLoading={wizard.profileLoading}
          canContinue={wizard.canContinuePhotos}
          minPhotos={wizard.minPhotos}
          aiTokens={wizard.aiTokens}
          cleanupKinds={wizard.cleanupKinds}
          onCleanupKindChange={wizard.setCleanupKindAt}
          onBuyTokens={wizard.buyTokens}
          onPick={() => void wizard.pickImages()}
          onTakePhoto={() => void wizard.takePhoto()}
          onRemove={wizard.removeAssetAt}
          onSetMain={wizard.setMainAt}
          onContinue={wizard.continueFromPhotos}
        />
      ) : null}

      {wizard.step === SALE_STEP.description ? (
        <AddItemDescriptionStep
          hint={wizard.hint}
          price={wizard.form.price}
          currency={wizard.currency}
          isFoodItem={wizard.isFoodItem}
          busy={wizard.busy}
          onChange={wizard.onHintChange}
          onPriceChange={wizard.onPriceChange}
          onFoodItemChange={wizard.onFoodItemChange}
          onContinue={() => void wizard.startProcessing()}
        />
      ) : null}

      {wizard.step === SALE_STEP.processing ? (
        <AddItemProcessingStep
          stages={wizard.processingStages}
          complete={wizard.processingComplete}
          failed={wizard.processingFailed}
          timedOut={wizard.processingTimedOut}
          error={wizard.processingError}
          onContinue={wizard.continueFromProcessing}
          onRetry={wizard.retryProcessing}
        />
      ) : null}

      {wizard.step === SALE_STEP.review ? (
        <AddItemAiReviewStep
          previewImageUri={wizard.previewImageUri}
          previewIsEnhanced={wizard.previewIsEnhanced}
          currency={wizard.currency}
          aiLoading={wizard.aiLoading}
          aiError={wizard.aiError}
          confidence={wizard.confidence}
          listingQuality={wizard.listingQuality}
          duplicateCandidates={wizard.duplicateCandidates}
          categoryAlternates={wizard.categoryAlternates}
          initialValues={wizard.form}
          busy={wizard.busy}
          onChange={wizard.onFormChange}
          onContinue={wizard.continueFromReview}
          onRetryAi={wizard.retryAi}
          onAddStockToDuplicate={wizard.onAddStockToDuplicate}
          onPreviewOpened={() =>
            trackProductCreateEvent('product_create.preview_opened')
          }
        />
      ) : null}

      {wizard.step === SALE_STEP.fulfillment ? (
        <AddItemFulfillmentStep
          values={wizard.form}
          currency={wizard.currency}
          busy={wizard.busy}
          onChange={wizard.onFormChange}
          onContinue={wizard.continueFromFulfillment}
        />
      ) : null}

      {wizard.step === SALE_STEP.publish ? (
        <AddItemPublishStep
          values={wizard.form}
          busy={wizard.busy}
          initialLocationId={initialLocationId}
          onChange={wizard.onFormChange}
          onPublish={() => void wizard.publish()}
          onSaveForLater={() => void wizard.saveForLater()}
        />
      ) : null}

      {wizard.step === SALE_STEP.done &&
      wizard.createdItem &&
      returnToDashboard &&
      !wizard.savedAsDraft ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      ) : null}

      {wizard.step === SALE_STEP.done &&
      wizard.createdItem &&
      (!returnToDashboard || wizard.savedAsDraft) ? (
        <AddItemSuccessStep
          item={wizard.createdItem}
          businessId={wizard.businessId}
          locationName={wizard.locationName}
          savedAsDraft={wizard.savedAsDraft}
          photoCount={wizard.assets.length}
          onBackToItems={() =>
            wizard.navigation.navigate(
              'BusinessItemsList',
              initialLocationId ? { locationId: initialLocationId } : undefined
            )
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
            wizard.navigation.replace('BusinessItemDetail', {
              itemId: wizard.createdItem!.id,
            })
          }
          onAddAnother={() => wizard.resetWizard()}
          onPhotoAdded={() =>
            wizard.navigation.replace('BusinessItemDetail', {
              itemId: wizard.createdItem!.id,
            })
          }
          onEnrichmentError={wizard.setSnackbarMessage}
        />
      ) : null}

      <Snackbar
        visible={!!wizard.snackbar}
        onDismiss={wizard.dismissSnackbar}
        duration={4000}
      >
        {wizard.snackbar}
      </Snackbar>
    </BusinessListingWizardShell>
  );
}
