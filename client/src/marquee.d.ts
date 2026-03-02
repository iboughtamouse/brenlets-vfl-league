/**
 * Declare the deprecated <marquee> element so TypeScript doesn't complain.
 * We're going all-in on the geocities aesthetic — marquee is non-negotiable.
 */
import 'preact';

declare module 'preact' {
  namespace JSX {
    interface IntrinsicElements {
      marquee: JSX.HTMLAttributes<HTMLElement> & {
        behavior?: string;
        direction?: string;
        scrollamount?: string;
      };
    }
  }
}
