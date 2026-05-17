import { theme, type ThemeConfig } from 'antd';

/** antd token overrides — maps the design-spec palette onto antd's dark algorithm. */
export const antdTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorBgBase: '#0D1117',
    colorBgContainer: '#161B22',
    colorBgElevated: '#21262D',
    colorBorder: '#30363D',
    colorBorderSecondary: '#21262D',
    colorText: '#E6EDF3',
    colorTextSecondary: '#8B949E',
    colorTextTertiary: '#6E7681',
    colorPrimary: '#388BFD',
    colorSuccess: '#3FB950',
    colorWarning: '#D29922',
    colorError: '#F85149',
    borderRadius: 6,
    fontFamily:
      "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontFamilyCode: "'Geist Mono', 'Courier New', monospace",
    fontSize: 14,
  },
  components: {
    Input: {
      colorBgContainer: '#21262D',
      activeBorderColor: '#388BFD',
      hoverBorderColor: '#388BFD',
    },
    Button: {
      defaultBg: '#21262D',
    },
  },
};
