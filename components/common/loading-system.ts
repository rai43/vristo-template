/**
 * Unified Loading & Transition System
 *
 * Usage examples:
 *
 * 1. Navigation Progress (auto-enabled in layout):
 *    - Shows a slim progress bar at the top during page navigation
 *    - No configuration needed, works automatically
 *
 * 2. Skeleton Loading:
 *    import { Skeleton, SkeletonCard, SkeletonTable, PageSkeleton } from '@/components/common/skeleton';
 *
 *    // Basic skeleton
 *    <Skeleton className="h-10 w-full" />
 *
 *    // Page skeleton for different layouts
 *    <PageSkeleton type="table" />
 *    <PageSkeleton type="form" />
 *    <PageSkeleton type="dashboard" />
 *
 * 3. Inline Loader:
 *    import InlineLoader, { LoadingOverlay, ButtonLoader, DataLoader } from '@/components/common/inline-loader';
 *
 *    // Simple spinner with text
 *    <InlineLoader size="lg" text="Loading..." />
 *
 *    // Wrap component with loading overlay
 *    <LoadingOverlay isLoading={isLoading}>
 *      <YourComponent />
 *    </LoadingOverlay>
 *
 *    // Button loading state
 *    <button>{isLoading ? <ButtonLoader /> : 'Submit'}</button>
 *
 *    // Data fetching wrapper
 *    <DataLoader isLoading={isLoading} isEmpty={data.length === 0} error={error}>
 *      <YourDataComponent data={data} />
 *    </DataLoader>
 *
 * 4. Full Page Loading (used in Suspense boundaries):
 *    import Loading from '@/components/layouts/loading';
 */

// Re-export all loading components
export { default as Loading } from '@/components/layouts/loading';
export { default as NavigationProgress } from '@/components/layouts/navigation-progress';
export { default as PageTransition } from '@/components/layouts/page-transition';
export { default as ContentAnimation } from '@/components/layouts/content-animation';

export { Skeleton, SkeletonText, SkeletonCard, SkeletonTable, SkeletonStats, SkeletonForm, PageSkeleton } from '@/components/common/skeleton';

export { default as InlineLoader, LoadingOverlay, ButtonLoader, DataLoader } from '@/components/common/inline-loader';

export { default as SavingOverlay } from '@/components/common/SavingOverlay';
export type { SavingOverlayProps, SavingOverlayStep } from '@/components/common/SavingOverlay';
