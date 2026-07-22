import baseConfig from '@garkuwa/config/eslint/base';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

const config = [...baseConfig, ...nextVitals, ...nextTypeScript];

export default config;
