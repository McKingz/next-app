module.exports = function (api) {
  api.cache(true);
  const isProd = process.env.NODE_ENV === 'production';
  
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          // Ensure classes are transformed properly for Hermes
          jsxRuntime: 'automatic',
          lazyImports: true,
        }
      ]
    ],
    plugins: [
      [
        'module-resolver',
        {
          // Avoid transforming relative imports inside node_modules (e.g., '.' in react-native-svg)
          // Only provide explicit aliases we actually use
          alias: { '@': './', tslib: './node_modules/tslib/tslib.js' },
          extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
        },
      ],
      [
        'transform-inline-environment-variables',
        {
          include: [
            'EXPO_PUBLIC_SUPABASE_URL',
            'EXPO_PUBLIC_SUPABASE_ANON_KEY',
            'EXPO_PUBLIC_TENANT_SLUG',
            'EXPO_PUBLIC_ENVIRONMENT',
            'EXPO_PUBLIC_APP_SCHEME',
          ],
        },
      ],
      // Remove console statements in production builds (except errors)
      isProd ? [
        'transform-remove-console',
        { exclude: ['error'] }
      ] : null,
      'react-native-reanimated/plugin',
    ].filter(Boolean),
  };
};