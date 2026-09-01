import { insertBurgerMenu as sharedInsertBurgerMenu } from '/components/burger-menu.js?v=20260901-class-order';

export const insertBurgerMenu = sharedInsertBurgerMenu;

if (typeof window !== 'undefined') {
  window.insertBurgerMenu = insertBurgerMenu;

  // Keep the shared teacher session refresh helper available from the historical path.
  import('/Teachers/auth-refresh.js?v=20260901-class-order').catch(() => {});

  // Student Tracker-only enhancement: persistent admin class reordering.
  if (window.location.pathname.includes('/Teachers/tools/student_tracker/')) {
    import('/Teachers/tools/student_tracker/class-order.js?v=20260901-class-order').catch((error) => {
      console.warn('[class-order] failed to load', error);
    });
  }
}
