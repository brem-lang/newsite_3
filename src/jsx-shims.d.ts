/**
 * The ported Mazady app is authored in JSX (untyped). These wildcard module
 * declarations let TypeScript route files import them. Real .ts/.tsx modules
 * take precedence over wildcard declarations, so typed modules are unaffected.
 */
declare module "@/pages/*";
declare module "@/components/*";
declare module "@/lib/*";
declare module "@/api/*";
declare module "@/hooks/*";
