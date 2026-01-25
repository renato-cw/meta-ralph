import type { Issue } from '../../src/lib/types';

/**
 * Mock issue data for E2E tests
 *
 * This test data provides a realistic dataset for testing:
 * - Multiple providers (zeropath, sentry)
 * - All severity levels (CRITICAL, HIGH, MEDIUM, LOW, INFO)
 * - Priority range from 25 to 95
 * - Various file locations and issue types
 */
export const mockIssues: Issue[] = [
  {
    id: 'zp-001',
    provider: 'zeropath',
    title: 'SQL Injection in user authentication',
    description: 'User input is directly concatenated into SQL query without sanitization',
    severity: 'CRITICAL',
    raw_severity: 'critical',
    priority: 95,
    count: 3,
    location: 'src/auth/login.ts',
    permalink: 'https://app.zeropath.com/issues/zp-001',
    metadata: {
      vulnerability_class: 'SQL Injection',
      cwe_id: 'CWE-89',
      owasp_category: 'A03:2021-Injection',
    },
  },
  {
    id: 'zp-002',
    provider: 'zeropath',
    title: 'Cross-Site Scripting (XSS) vulnerability',
    description: 'User-generated content rendered without escaping',
    severity: 'HIGH',
    raw_severity: 'high',
    priority: 85,
    count: 5,
    location: 'src/components/UserComment.tsx',
    permalink: 'https://app.zeropath.com/issues/zp-002',
    metadata: {
      vulnerability_class: 'Cross-Site Scripting',
      cwe_id: 'CWE-79',
      owasp_category: 'A03:2021-Injection',
    },
  },
  {
    id: 'zp-003',
    provider: 'zeropath',
    title: 'Insecure direct object reference',
    description: 'User can access other users resources by changing ID parameter',
    severity: 'HIGH',
    raw_severity: 'high',
    priority: 80,
    count: 2,
    location: 'src/api/documents/[id]/route.ts',
    permalink: 'https://app.zeropath.com/issues/zp-003',
    metadata: {
      vulnerability_class: 'IDOR',
      cwe_id: 'CWE-639',
      owasp_category: 'A01:2021-Broken Access Control',
    },
  },
  {
    id: 'sentry-001',
    provider: 'sentry',
    title: 'TypeError: Cannot read property of undefined',
    description: 'Uncaught exception when accessing user profile with missing data',
    severity: 'MEDIUM',
    raw_severity: 'medium',
    priority: 65,
    count: 127,
    location: 'src/pages/profile.tsx:45',
    permalink: 'https://sentry.io/issues/sentry-001',
    metadata: {
      error_type: 'TypeError',
      stack_trace: 'at ProfilePage (src/pages/profile.tsx:45)',
      affected_users: 1250,
    },
  },
  {
    id: 'sentry-002',
    provider: 'sentry',
    title: 'NetworkError: Failed to fetch',
    description: 'API requests failing due to network timeout',
    severity: 'LOW',
    raw_severity: 'low',
    priority: 45,
    count: 89,
    location: 'src/lib/api.ts:23',
    permalink: 'https://sentry.io/issues/sentry-002',
    metadata: {
      error_type: 'NetworkError',
      stack_trace: 'at fetchData (src/lib/api.ts:23)',
      affected_users: 890,
    },
  },
  {
    id: 'zp-004',
    provider: 'zeropath',
    title: 'Missing rate limiting on login endpoint',
    description: 'Login endpoint allows unlimited attempts enabling brute force attacks',
    severity: 'MEDIUM',
    raw_severity: 'medium',
    priority: 60,
    count: 1,
    location: 'src/api/auth/login/route.ts',
    permalink: 'https://app.zeropath.com/issues/zp-004',
    metadata: {
      vulnerability_class: 'Brute Force',
      cwe_id: 'CWE-307',
      owasp_category: 'A07:2021-Identification and Authentication Failures',
    },
  },
  {
    id: 'sentry-003',
    provider: 'sentry',
    title: 'Warning: Component lifecycle deprecation',
    description: 'Using deprecated componentWillMount lifecycle method',
    severity: 'INFO',
    raw_severity: 'info',
    priority: 25,
    count: 15,
    location: 'src/legacy/OldDashboard.tsx',
    permalink: 'https://sentry.io/issues/sentry-003',
    metadata: {
      error_type: 'Warning',
      stack_trace: 'at OldDashboard (src/legacy/OldDashboard.tsx)',
      affected_users: 50,
    },
  },
  {
    id: 'zp-005',
    provider: 'zeropath',
    title: 'Hardcoded API credentials',
    description: 'API key found hardcoded in source code',
    severity: 'CRITICAL',
    raw_severity: 'critical',
    priority: 92,
    count: 1,
    location: 'src/config/api.config.ts',
    permalink: 'https://app.zeropath.com/issues/zp-005',
    metadata: {
      vulnerability_class: 'Sensitive Data Exposure',
      cwe_id: 'CWE-798',
      owasp_category: 'A02:2021-Cryptographic Failures',
    },
  },
];

/**
 * Initial processing state for mock API
 */
export const mockProcessingState = {
  isProcessing: false,
  currentIssueId: null,
  logs: [] as string[],
  completed: [] as string[],
  failed: [] as string[],
};

/**
 * Create mock API response
 */
export function createMockApiResponse(
  issues = mockIssues,
  processing = mockProcessingState
) {
  return {
    issues,
    processing,
  };
}
