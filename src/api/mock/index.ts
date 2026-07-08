// Side-effect import registers every mock route before the adapter is used.
import './handlers';

export { mockAdapter } from './router';
export type { MockRequest, MockResponse, MockHandler, MockMethod } from './router';
