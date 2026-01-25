import '@testing-library/jest-dom';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock window.location
delete window.location;
window.location = {
  href: 'http://localhost:3001',
  pathname: '/',
  search: '',
  hash: '',
  origin: 'http://localhost:3001',
  protocol: 'http:',
  host: 'localhost:3001',
  hostname: 'localhost',
  port: '3001',
  reload: jest.fn(),
  replace: jest.fn(),
  assign: jest.fn(),
};

// Mock window.history
const mockHistory = {
  replaceState: jest.fn(),
  pushState: jest.fn(),
  go: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  state: null,
  length: 1,
};

Object.defineProperty(window, 'history', {
  value: mockHistory,
  writable: true,
});

// Mock fetch
global.fetch = jest.fn();

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  localStorageMock.getItem.mockReturnValue(null);
});
