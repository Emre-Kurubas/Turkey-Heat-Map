import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// RTL does not register its own auto-cleanup when `globals: false`.
afterEach(() => { cleanup(); });
