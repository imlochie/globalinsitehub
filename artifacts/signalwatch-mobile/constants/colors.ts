/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    text: '#142A48',
    tint: '#142A48',
    background: '#F5F3EF',
    foreground: '#142A48',
    card: '#FBFBF9',
    cardForeground: '#142A48',
    sidebar: '#212C3B',
    sidebarForeground: '#F0ECE6',
    primary: '#142A48',
    primaryForeground: '#F5F3EF',
    secondary: '#E8E4DE',
    secondaryForeground: '#142A48',
    muted: '#ECEAE4',
    mutedForeground: '#717378',
    accent: '#F8C844',
    accentForeground: '#142A48',
    destructive: '#C7352E',
    destructiveForeground: '#FBFBF9',
    border: '#DAD5CD',
    input: '#DAD5CD',
    success: '#3A8B79',
  },
  dark: {
    text: '#F0ECE6',
    tint: '#F8C844',
    background: '#121821',
    foreground: '#F0ECE6',
    card: '#1B222D',
    cardForeground: '#F0ECE6',
    sidebar: '#0F151E',
    sidebarForeground: '#F0ECE6',
    primary: '#F8C844',
    primaryForeground: '#142A48',
    secondary: '#1E2D43',
    secondaryForeground: '#F0ECE6',
    muted: '#1E2D43',
    mutedForeground: '#A3A8AE',
    accent: '#F8C844',
    accentForeground: '#142A48',
    destructive: '#D5554D',
    destructiveForeground: '#142A48',
    border: '#333D4D',
    input: '#333D4D',
    success: '#45A58F',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 8,
};

export default colors;
