import { theme, type ThemeConfig } from 'antd';

/** antd token overrides — light theme, matched to the index.css palette. */
export const antdTheme: ThemeConfig = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorBgBase: '#ffffff',
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    colorBorder: '#d1d9e0',
    colorBorderSecondary: '#e4e8ec',
    colorText: '#1f2328',
    colorTextSecondary: '#59636e',
    colorTextTertiary: '#818b98',
    colorPrimary: '#0969da',
    colorSuccess: '#1a7f37',
    colorWarning: '#9a6700',
    colorError: '#cf222e',
    borderRadius: 6,
    fontFamily:
      "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontFamilyCode: "'Geist Mono', 'Courier New', monospace",
    fontSize: 14,
  },
  components: {
    Input: {
      colorBgContainer: '#ffffff',
      activeBorderColor: '#0969da',
      hoverBorderColor: '#0969da',
    },
    Button: {
      defaultBg: '#f6f8fa',
    },
  },
};
