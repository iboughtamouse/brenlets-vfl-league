/**
 * Declare the deprecated <marquee> element so TypeScript doesn't complain.
 * We're going all-in on the geocities aesthetic — marquee is non-negotiable.
 */
import 'react';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      marquee: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          behavior?: string;
          direction?: string;
          scrollamount?: string;
        },
        HTMLElement
      >;
    }
  }
}
