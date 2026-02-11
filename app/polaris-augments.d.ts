// Augment JSX IntrinsicElements for custom elements not covered by @shopify/polaris-types
// s-app-nav is a Shopify App Bridge element without official type declarations

export {};

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "s-app-nav": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
    }
  }
}
